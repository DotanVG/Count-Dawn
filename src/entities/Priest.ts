import Phaser from 'phaser';
import { KNOCKBACK, PRIEST } from '../data/balance';
import { DEPTHS } from '../game/constants';
import type { GameEventEmitter } from '../game/events';
import { BossHealthBar } from '../ui/BossHealthBar';
import { TEXTURES, animKey } from '../utils/assetKeys';
import { BossCharge } from './BossCharge';
import { Hunter, type HunterLook, type HunterStats } from './Hunter';
import { captainTookDamage, type CaptainTraits } from './HunterCaptain';

const PRIEST_LOOK: HunterLook = {
  charKey: 'priest',
  sheet: TEXTURES.priest,
  // He never carries a swung prop — his stake is painted into his own frames.
  handY: 0,
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
 * Romi drew the cross leaning, which is right for one flying end over end (the
 * huntress Captain throws it that way) and wrong for one standing in the middle
 * of a consecration. Rotating it back by this much stands it upright — measured
 * by rendering the built PNG through a sweep of angles and taking the one that
 * reads as a crucifix rather than an X.
 *
 * Negative because Phaser turns clockwise on positive radians and the drawing
 * leans clockwise already.
 */
const CROSS_UPRIGHT_ROTATION = -0.46;
/** Its painted height once upright, in source pixels — the scale is set off this. */
const CROSS_UPRIGHT_HEIGHT = 63;
/** How much wider the soft copy behind the blade is, for the glow. */
const CROSS_GLOW_SPREAD = 1.35;

/** Yellows for the trailing ripples, deepest first — see spawnCross's siblings. */
const RIPPLE_SHADES = [HOLY_PALE, HOLY_LIGHT, HOLY_GLOW];

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
 * invulnerability carries the Count clean. Damage is NOT an answer — once the
 * circle is up he sees it through no matter how hard he is hit (see
 * isCommitted), which is exactly why the telegraph is as loud as it is.
 */
export class Priest extends Hunter implements CaptainTraits {
  readonly maxHealth = PRIEST.health;
  readonly healthBar: BossHealthBar;
  readonly bossName = 'Priest';
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
  /** The paler rings trailing the damage edge — decoration, no hitbox. */
  private ripples: Phaser.GameObjects.Arc[] = [];
  /** Held so teardown can stop them; see the note in releaseWard. */
  private rippleTweens: Phaser.Tweens.Tween[] = [];
  private crossTweens: Phaser.Tweens.Tween[] = [];
  /** The cross that rises out of the circle as the light goes out. */
  private cross: Phaser.GameObjects.Container | null = null;
  private sparkles: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private charge: BossCharge | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly emitter: GameEventEmitter,
    /** Overridable so the cold open can march him at the squad's pace instead of his own. */
    stats: HunterStats = PRIEST,
  ) {
    super(scene, x, y, stats, PRIEST_LOOK);
    this.setScale(PRIEST.spriteScale);
    // Romi's priest fills far more of the 64px frame than the CraftPix men, so
    // the inherited body would sit around his knees. This is his torso.
    this.setCircle(9, 23, 35);
    this.normalDepth = DEPTHS.boss;
    this.setDepth(DEPTHS.boss);
    this.healthBar = new BossHealthBar(scene, this.bossName);
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

  /**
   * Once the ward is up he sees it through. Hitting him shoves him — and the
   * whole ward slides with him, because it is anchored on his body — but it
   * does not stop. Trading damage into a Priest mid-cast is not an answer; the
   * telegraph is there so that footwork can be.
   */
  protected override get isCommitted(): boolean {
    return this.warding;
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
    // Phaser nulls `scene` on the first destroy and quietly ignores a second
    // one — but this override runs BEFORE that guard, and everything below
    // reaches through `this.scene`. A scene shutdown destroying a Priest that
    // was already killed would throw straight out of the shutdown, which is
    // exactly the kind of thing that leaves a run frozen.
    if (!this.scene) return;

    this.charge?.destroy();
    this.charge = null;
    // Same rule as the ripples: nothing may still be animating an object we are
    // about to destroy, or the scene's step throws on it forever after.
    for (const tween of this.crossTweens) tween.stop();
    this.crossTweens = [];
    this.cross?.destroy();
    this.cross = null;
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

    // The tell on his body, matching every other boss: a gold ring closing in
    // on him, tightening and brightening as the wind-up runs out.
    this.charge = new BossCharge(
      this.scene,
      this.x,
      this.y,
      HOLY_LIGHT,
      this.displayHeight * 0.75,
      PRIEST.wardWindupMs,
    );

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

    this.charge?.finish(true);
    this.charge = null;
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

    // Ripples: the same sweep again in paler golds, each one launched a beat
    // later than the last. Only the ring above carries damage — these exist so
    // the ward lands like something dropped in water instead of one flat hoop.
    //
    // Every one of these tweens is KEPT, because a counter tween's target is an
    // internal counter rather than the Arc it drives, so killTweensOf(ripple)
    // cannot reach it. A ripple that is still expanding (or still sitting on its
    // stagger delay) when the ward ends would otherwise go on calling setRadius
    // on a destroyed Arc from inside TweenManager.step — which throws out of the
    // scene's step every frame and freezes the entire game with the audio still
    // playing. That is exactly the bug this shape of code caused.
    for (let i = 1; i <= PRIEST.wardRipples; i++) {
      const ripple = this.scene.add
        .circle(this.x, this.y, 1, HOLY_GLOW, 0)
        .setStrokeStyle(6 - i, RIPPLE_SHADES[i % RIPPLE_SHADES.length], 0.8)
        .setDepth(DEPTHS.groundFx)
        .setAlpha(0);
      this.ripples.push(ripple);
      this.rippleTweens.push(
        this.scene.tweens.addCounter({
          from: 0,
          to: PRIEST.wardRadius,
          delay: PRIEST.wardRippleDelayMs * i,
          duration: PRIEST.wardExpandMs,
          ease: 'Cubic.easeOut',
          onUpdate: (tween) => {
            // Second line of defence: even a tween that escapes teardown can
            // never touch an Arc that is already gone.
            if (!ripple.active) return;
            const r = tween.getValue() ?? 0;
            ripple.setRadius(Math.max(1, r)).setAlpha(0.85 * (1 - r / PRIEST.wardRadius));
          },
        }),
      );
    }

    this.spawnCross();

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
   * The cross. It rises out of the circle as the light goes out, grows past the
   * ward's own radius and holds a moment longer than the rings do, so the last
   * thing on screen is the shape of what just burned him. Sparks trail off both
   * arms the whole way out.
   *
   * This is ROMI'S cross now — the same drawing the huntress Captain throws —
   * where it used to be four rectangles in a Container. Two copies of it: a
   * soft oversized one behind for the glow, and the sharp one in front. It is
   * still a Container so that one scale tween drives both and the ward can drag
   * the whole thing along when he is shoved mid-cast.
   *
   * Her drawing is tilted about 21 degrees off vertical, which is right for a
   * cross flying end over end and wrong for one standing in the middle of a
   * consecration, so it is counter-rotated to stand up straight.
   */
  private spawnCross(): void {
    const reach = PRIEST.wardRadius * PRIEST.crossOvershoot;
    // Sized off the cross's UPRIGHT painted height, so it finishes standing as
    // tall as the drawn one used to — tall enough to read as a crucifix over the
    // ward, short enough not to run off the top of the hall.
    const full = (reach * 1.15) / CROSS_UPRIGHT_HEIGHT;

    const glow = this.scene.add
      .image(0, 0, TEXTURES.weaponGoldCross)
      .setScale(full * CROSS_GLOW_SPREAD)
      .setTint(HOLY_GLOW)
      .setAlpha(0.4);
    const blade = this.scene.add.image(0, 0, TEXTURES.weaponGoldCross).setScale(full);

    const cross = this.scene.add
      .container(this.x, this.y, [glow, blade])
      .setDepth(DEPTHS.attackFx)
      .setRotation(CROSS_UPRIGHT_ROTATION)
      .setScale(0.05)
      // Translucent, so he stays visible through his own light rather than
      // hidden behind it.
      .setAlpha(0.85);
    this.cross = cross;

    // Sparks off the arms, following the cross as it opens out.
    this.sparkles = this.scene.add
      .particles(this.x, this.y, TEXTURES.particle, {
        speed: { min: 30, max: 170 },
        angle: { min: 0, max: 360 },
        lifespan: { min: 260, max: 700 },
        scale: { start: 1.1, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: [HOLY_PALE, HOLY_LIGHT, 0xffffff],
        frequency: 25,
        quantity: 3,
        emitZone: {
          type: 'random',
          source: new Phaser.Geom.Circle(0, 0, reach * 0.5),
          quantity: 1,
        },
      })
      .setDepth(DEPTHS.attackFx);

    this.crossTweens = [
      this.scene.tweens.add({
        targets: cross,
        scale: 1,
        // Held back a beat so the ring leads and the cross comes up THROUGH it,
        // rather than the two opening out together as one shape.
        delay: PRIEST.crossRiseDelayMs,
        duration: PRIEST.wardExpandMs,
        ease: 'Cubic.easeOut',
      }),
      this.scene.tweens.add({
        targets: cross,
        alpha: 0,
        delay: PRIEST.crossRiseDelayMs + PRIEST.wardExpandMs,
        duration: PRIEST.crossLingerMs,
        onComplete: () => {
          cross.destroy();
          if (this.cross === cross) this.cross = null;
        },
      }),
    ];
    this.scene.time.delayedCall(
      PRIEST.crossRiseDelayMs + PRIEST.wardExpandMs,
      () => this.sparkles?.stop(),
    );
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

    // Everything the ward draws is anchored on him, so a shove that lands
    // mid-cast carries the whole thing with him rather than leaving it behind.
    circle.setPosition(this.x, this.y);
    this.charge?.follow(this.x, this.y);
    for (const ripple of this.ripples) ripple.setPosition(this.x, this.y);
    this.cross?.setPosition(this.x, this.y);
    this.sparkles?.setPosition(this.x, this.y);

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
    // Only reached without firing if he died or was destroyed mid-charge.
    this.charge?.finish(false);
    this.charge = null;

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

    // The cross and its sparks outlive the rings on purpose (see spawnCross),
    // so they are handed their own fade rather than cut here.
    //
    // The ripples' expansion tweens MUST die before their Arcs do — a live
    // tween writing to a destroyed Arc throws out of the scene step and freezes
    // the game (see the note in releaseWard).
    for (const tween of this.rippleTweens) tween.stop();
    this.rippleTweens = [];
    for (const ripple of this.ripples) {
      this.scene.tweens.add({
        targets: ripple,
        alpha: 0,
        duration: 200,
        onComplete: () => ripple.destroy(),
      });
    }
    this.ripples = [];

    const sparkles = this.sparkles;
    this.sparkles = null;
    if (sparkles) {
      sparkles.stop();
      this.scene.time.delayedCall(900, () => sparkles.destroy());
    }

    this.warding = false;
    this.wardRadius = 0;
    this.nextWardAt = this.scene.time.now + PRIEST.wardIntervalMs;
  }
}
