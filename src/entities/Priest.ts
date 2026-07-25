import Phaser from 'phaser';
import { KNOCKBACK, PRIEST } from '../data/balance';
import { DEPTHS } from '../game/constants';
import type { GameEventEmitter } from '../game/events';
import { BossHealthBar } from '../ui/BossHealthBar';
import { TEXTURES, animKey } from '../utils/assetKeys';
import { Hunter, type HunterLook } from './Hunter';
import { captainTookDamage, type CaptainTraits } from './HunterCaptain';

const PRIEST_LOOK: HunterLook = {
  charKey: 'priest',
  walkTexture: TEXTURES.priest,
  deathTexture: TEXTURES.priest,
};

/**
 * Gold — the ward's light, and the cross he wears. The fill has to stay warm
 * rather than pale: over the hall's blue-grey floor a whitish wash at low
 * alpha just reads as a grey smudge, not as consecrated ground.
 */
const HOLY_LIGHT = 0xffd76b;
const HOLY_GLOW = 0xffa32b;
const HOLY_PALE = 0xfff3c4;

/**
 * Top of his PAINTED sprite in unscaled texture rows, measured off the built
 * sheet: he stands from row 13 to row 52 of the 64px frame, where the CraftPix
 * men only fill rows 22-43. His health bar has to hang off his own head.
 */
const PAINTED_TOP_OFFSET = -19;

/**
 * The Priest: the boss the fifth night sends in place of the Hunter Captains.
 *
 * He fights like a Captain up close — same heavy hit, same planted stance
 * against knockback — but he carries a wooden stake rather than a sword, and
 * his real threat is the WARD: every few seconds he stops, raises the cross,
 * paints a circle of holy light on the floor around himself, and then drives
 * it outward. Anything the expanding edge sweeps over gets burned.
 *
 * The ward is deliberately slow to start and fully drawn before it fires, so
 * it is a decision rather than a tax: walk out of the circle while it is being
 * painted, or dash through the edge in bat form, where the dash's own
 * invulnerability carries the Count clean. Landing a strike on him mid-ward
 * cancels it outright.
 */
export class Priest extends Hunter implements CaptainTraits {
  readonly maxHealth = PRIEST.health;
  readonly healthBar: BossHealthBar;
  /** He plants his feet like a Captain — the Count cannot shove him around. */
  protected override knockbackResistance = KNOCKBACK.bossFactor;

  /** Fired once per ward, when the expanding edge passes the Count. */
  onWardHit: (() => void) | null = null;

  private nextWardAt = 0;
  private warding = false;
  /** 0 while the circle is only being painted; grows once the light sweeps. */
  private wardRadius = 0;
  private wardSwept = false;
  private wardCircle: Phaser.GameObjects.Arc | null = null;
  private wardTween: Phaser.Tweens.Tween | null = null;
  private wardTimer: Phaser.Time.TimerEvent | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly emitter: GameEventEmitter,
  ) {
    super(scene, x, y, PRIEST, PRIEST_LOOK);
    this.setScale(PRIEST.spriteScale);
    // Romi's priest fills far more of the 64px frame than the CraftPix men, so
    // the inherited body would sit around his knees. This is his torso.
    this.setCircle(9, 23, 35);
    this.normalDepth = DEPTHS.boss;
    this.setDepth(DEPTHS.boss);
    this.healthBar = new BossHealthBar(scene, 'The Priest');
    this.nextWardAt = scene.time.now + PRIEST.wardIntervalMs;
  }

  override get visibleTopY(): number {
    return this.y + PAINTED_TOP_OFFSET * this.scaleY;
  }

  override pursue(targetX: number, targetY: number): void {
    if (!this.isAlive) return;

    if (this.warding) {
      // He is committed: planted, facing the Count, letting the light out.
      this.setVelocity(0, 0);
      this.updateWard(targetX, targetY);
    } else {
      super.pursue(targetX, targetY);
      this.maybeStartWard(targetX, targetY);
    }

    this.healthBar.follow(this.x, this.visibleTopY);
  }

  /** A landed strike breaks his concentration and the ward with it. */
  override applyKnockback(sourceX: number, sourceY: number): void {
    const interrupted = this.warding;
    super.applyKnockback(sourceX, sourceY);
    if (interrupted) this.endWard();
  }

  override takeDamage(amount: number): boolean {
    const killed = super.takeDamage(amount);
    captainTookDamage(this, this.emitter);
    return killed;
  }

  /** He topples rather than fading upright — the two frames alone won't sell it. */
  override spawnCorpse(): void {
    const corpse = this.scene.add
      .sprite(this.x, this.y, TEXTURES.priest, 0)
      .setScale(this.scaleX, this.scaleY)
      .setDepth(DEPTHS.corpse);
    corpse.play(animKey('priest', 'death', this.facing));
    this.scene.tweens.add({
      targets: corpse,
      angle: this.facing === 'right' ? -80 : 80,
      y: corpse.y + 8 * this.scaleY,
      duration: 520,
      ease: 'Quad.easeIn',
    });
    this.scene.tweens.add({
      targets: corpse,
      alpha: 0,
      delay: 900,
      duration: 900,
      onComplete: () => corpse.destroy(),
    });
  }

  override destroy(fromScene?: boolean): void {
    this.endWard();
    this.healthBar.destroy();
    super.destroy(fromScene);
  }

  /**
   * Arrival flourish, matching the Captains': a stomp-bounce and a shake, so
   * the hall knows which of them just walked in.
   */
  playEntrance(): void {
    const targetScale = this.scaleX;
    this.scene.tweens.add({
      targets: this,
      scale: { from: targetScale * 1.18, to: targetScale },
      duration: 260,
      ease: 'Back.easeOut',
    });
    this.scene.cameras.main.shake(250, 0.006);
  }

  // ── The ward ────────────────────────────────────────────────────────────

  private maybeStartWard(targetX: number, targetY: number): void {
    if (this.isEntering || this.scene.time.now < this.nextWardAt) return;
    if (Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY) > PRIEST.wardRange) return;

    this.warding = true;
    this.wardRadius = 0;
    this.wardSwept = false;
    this.setVelocity(0, 0);
    this.play(animKey('priest', 'attack', this.facing), true);

    // The telegraph: the full circle, drawn faint on the floor and pulsing,
    // for long enough to walk out of before any of it burns.
    // A big translucent fill over the hall's blue-grey floor always washes out
    // to grey, so the circle is carried by its EDGE: a thin bright gold ring
    // with only a breath of fill inside it.
    this.wardCircle = this.scene.add
      .circle(this.x, this.y, PRIEST.wardRadius, HOLY_GLOW, 0.08)
      .setStrokeStyle(5, HOLY_LIGHT, 1)
      .setDepth(DEPTHS.groundFx);
    this.wardTween = this.scene.tweens.add({
      targets: this.wardCircle,
      alpha: { from: 0.45, to: 1 },
      duration: PRIEST.wardWindupMs / 2,
      yoyo: true,
      repeat: 1,
    });

    this.wardTimer = this.scene.time.delayedCall(PRIEST.wardWindupMs, () => this.releaseWard());
  }

  /** The light leaves him: the ring collapses to his feet, then sweeps out. */
  private releaseWard(): void {
    this.wardTimer = null;
    const circle = this.wardCircle;
    if (!this.active || !this.isAlive || !circle) {
      this.endWard();
      return;
    }

    this.wardTween?.stop();
    circle.setAlpha(1).setRadius(1).setFillStyle(HOLY_GLOW, 0.1).setStrokeStyle(11, HOLY_LIGHT, 1);
    this.wardTween = this.scene.tweens.addCounter({
      from: 0,
      to: PRIEST.wardRadius,
      duration: PRIEST.wardExpandMs,
      ease: 'Cubic.easeOut',
      onUpdate: (tween) => (this.wardRadius = tween.getValue() ?? 0),
      onComplete: () => this.endWard(),
    });

    const motes = this.scene.add
      .particles(this.x, this.y, TEXTURES.particle, {
        speed: { min: 90, max: 260 },
        angle: { min: 0, max: 360 },
        lifespan: { min: 300, max: 620 },
        scale: { start: 1.4, end: 0 },
        alpha: { start: 0.95, end: 0 },
        tint: [HOLY_LIGHT, HOLY_PALE, 0xffffff],
        emitting: false,
      })
      .setDepth(DEPTHS.attackFx);
    motes.explode(26);
    this.scene.time.delayedCall(800, () => motes.destroy());
    this.scene.cameras.main.shake(200, 0.005);
  }

  /**
   * Keeps the ring drawn on him and burns the Count the moment the expanding
   * edge reaches him — once per ward, so standing inside the circle after it
   * has already passed is safe. Being invulnerable when the edge arrives (a
   * dash) is what makes the ward dodgeable at the last instant; the Player
   * owns that check, not this.
   */
  private updateWard(targetX: number, targetY: number): void {
    const circle = this.wardCircle;
    if (!circle) return;

    circle.setPosition(this.x, this.y);
    if (this.wardRadius <= 0) return; // still only the telegraph

    circle.setRadius(this.wardRadius);
    // Full brightness for most of the sweep — the edge is the dangerous part
    // and has to stay readable — then it burns out over the last quarter.
    const progress = this.wardRadius / PRIEST.wardRadius;
    circle.setAlpha(1 - Math.max(0, (progress - 0.75) / 0.25) * 0.65);
    if (this.wardSwept) return;

    const distance = Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY);
    if (this.wardRadius < distance) return;
    this.wardSwept = true;
    this.onWardHit?.();
  }

  private endWard(): void {
    this.wardTimer?.remove();
    this.wardTimer = null;
    this.wardTween?.stop();
    this.wardTween = null;

    const circle = this.wardCircle;
    this.wardCircle = null;
    if (circle) {
      this.scene.tweens.add({
        targets: circle,
        alpha: 0,
        duration: 200,
        onComplete: () => circle.destroy(),
      });
    }

    this.warding = false;
    this.wardRadius = 0;
    this.nextWardAt = this.scene.time.now + PRIEST.wardIntervalMs;
  }
}
