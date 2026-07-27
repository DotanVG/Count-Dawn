import Phaser from 'phaser';
import { ARMED, WEAPONS, type WeaponKind } from '../data/balance';
import { DEPTHS } from '../game/constants';
import { TEXTURES, type Dir4 } from '../utils/assetKeys';
import { Hunter, PILGRIM_LOOK, type HunterLook, type HunterStats } from './Hunter';

/** Romi drew one frame each for the spike and fork, two for the torch's flame. */
const WEAPON_TEXTURES: Record<WeaponKind, string[]> = {
  spike: [TEXTURES.weaponSpike],
  pitchfork: [TEXTURES.weaponPitchfork],
  torch: [TEXTURES.weaponTorch1, TEXTURES.weaponTorch2],
};

/**
 * Where the prop sits while he is just carrying it: which side of his body the
 * hand is on (as a fraction of his display width), how the shaft leans, and
 * whether the weapon passes in front of him or behind his back. How far DOWN
 * the fist is belongs to the character, not the direction — see
 * HunterLook.handY.
 *
 * Romi's hunters are about 18x31 of a 64x64 sheet, so there is more body to
 * hang a weapon off than the bought pack's 12x21 had, and these are wider than
 * they used to be to match. Still deliberately inside the silhouette: pushed
 * out any further and the prop stops reading as held and starts reading as a
 * totem standing next to him.
 */
const CARRY: Record<Dir4, { handX: number; lean: number; behind: boolean }> = {
  down: { handX: 0.07, lean: 0.3, behind: false },
  up: { handX: -0.07, lean: -0.3, behind: true },
  left: { handX: -0.08, lean: -0.55, behind: false },
  right: { handX: 0.09, lean: 0.55, behind: false },
};

/**
 * The props are drawn point-up, so the sprite pivots about his fist and the
 * head sits this far along the shaft from there. WHERE the fist closes is per
 * weapon (see WEAPONS.gripY): a stake is gripped at the very bottom, a
 * pitchfork partway up the shaft so its butt end sticks out behind him.
 */
const HEAD_FRACTION = 0.6;

/** Radians past the target a chop carries through to; a thrust stops on it. */
const CHOP_FOLLOW_THROUGH = 0.55;
/**
 * How far the FIST drives forward over a swing, as a fraction of his height.
 * The thrust gets the bigger number because for a stab the travel IS the
 * attack: a chop is sold by its arc, a stab by the point going in.
 */
const LUNGE: Record<'thrust' | 'chop', number> = { thrust: 0.08, chop: 0.03 };
/**
 * How much of a thrust is spent bringing the point to bear before he drives it
 * in. A chop rotates all the way through its arc; a stab must be POINTED for
 * the whole travel or it is just a swing with extra steps, so it finishes
 * aiming inside the first quarter and then holds still and pushes.
 */
const THRUST_AIM_FRACTION = 0.25;

/** Milliseconds each torch frame is held before the flame flickers to the other. */
const FLICKER_MS = 110;

/** Shortest rotation from `from` to `to`, so a swing never takes the long way. */
function lerpAngle(from: number, to: number, t: number): number {
  return from + Phaser.Math.Angle.Wrap(to - from) * t;
}

/**
 * A hunter carrying one of Romi's three weapons: a wooden spike, a pitchfork
 * or a burning torch. This is now the ORDINARY hunter — the pilgrim and the
 * huntress both arrive armed, and there is no unarmed swordsman left to be the
 * default.
 *
 * None of Romi's humans has an attack sheet — two frames per direction is all
 * any of them has — so none of the swing lives in the body's animation. The
 * prop is a separate image pinned to his fist every frame, and one counter
 * (`swingT`) drives the whole strike: at 0 the weapon rests against his
 * shoulder, at 1 it is fully extended at the Count. A `Back.easeIn` on that
 * counter dips it briefly below zero at the start, which is the wind-up, and
 * the yoyo back to 0 is the recovery.
 *
 * What the three weapons actually change is reach and cadence, never damage —
 * the flat 5-per-hit economy holds (see WEAPONS in balance.ts). The pitchfork
 * lets him jab from outside sword range; the spike jabs fast and close; the
 * torch chops in an arc and throws embers the whole time.
 */
export class ArmedHunter extends Hunter {
  readonly weaponKind: WeaponKind;

  private readonly weapon: Phaser.GameObjects.Image;
  private readonly textures: string[];
  private readonly motion: 'thrust' | 'chop';
  private readonly embers: Phaser.GameObjects.Particles.ParticleEmitter | null;
  /**
   * His actual display scale, which is NOT always ARMED.spriteScale: a Captain
   * (HunterCaptain) is this same class scaled up to BOSS.spriteScale instead.
   * The swing tween below has to animate around this, not the module default,
   * or every attack resets a Captain back down to a regular hunter's size.
   */
  private readonly baseSpriteScale: number;
  /** 0 = shouldered, 1 = fully extended at the target. Drives the whole swing. */
  private swingT = 0;
  /** Radians toward the target, locked when the swing starts. */
  private swingAim = 0;
  private swingTween?: Phaser.Tweens.Tween;
  private swingUntil = 0;
  private frameIndex = -1;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    kind: WeaponKind,
    look: HunterLook = PILGRIM_LOOK,
    stats: HunterStats = ARMED,
    spriteScale: number = ARMED.spriteScale,
  ) {
    super(scene, x, y, stats, look);
    const spec = WEAPONS[kind];
    this.weaponKind = kind;
    this.textures = WEAPON_TEXTURES[kind];
    this.motion = spec.motion;
    this.meleeReachFactor = spec.reach;
    this.meleeIntervalMs = spec.intervalMs;
    this.meleeHitDelayMs = spec.hitDelayMs;
    this.baseSpriteScale = spriteScale;
    this.setScale(spriteScale);

    this.weapon = scene.add
      .image(x, y, this.textures[0])
      .setOrigin(0.5, spec.gripY)
      .setScale(this.scaleX * spec.scale);

    // Only the torch burns, and it burns the whole time he is carrying it —
    // he is walking a live flame across a hall lit by the same fire.
    this.embers = this.textures.length > 1 ? this.createEmbers() : null;

    this.updateWeapon();
  }

  /** Embers rising off a lit torch head, carried or dropped. */
  private createEmbers(): Phaser.GameObjects.Particles.ParticleEmitter {
    return this.scene.add.particles(0, 0, TEXTURES.particle, {
      speed: { min: 10, max: 45 },
      angle: { min: 235, max: 305 },
      lifespan: { min: 240, max: 560 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.9, end: 0 },
      gravityY: -70,
      tint: [0xffd76b, 0xff9a3d, 0xff5a2a],
      frequency: 120,
      quantity: 1,
    });
  }

  override pursue(targetX: number, targetY: number): void {
    super.pursue(targetX, targetY);
    this.updateWeapon();
  }

  /** The prop's own clock — his body has no attack animation to read. */
  protected override get isSwinging(): boolean {
    return this.scene.time.now < this.swingUntil;
  }

  protected override playSwing(_dir: Dir4, aimAngle: number): void {
    const spec = WEAPONS[this.weaponKind];
    this.swingAim = aimAngle;
    this.startSwingTween(spec.swingMs);

    // The body has to sell the effort as well, or a floating weapon does all
    // the work: he lunges his whole frame into it, exactly like the thrower's
    // throw pops his scale.
    this.scene.tweens.add({
      targets: this,
      scale: { from: this.baseSpriteScale * 1.1, to: this.baseSpriteScale },
      duration: spec.swingMs,
      ease: 'Back.easeOut',
    });
  }

  /** A landed strike interrupts the swing — the weapon drops back to a carry. */
  override applyKnockback(sourceX: number, sourceY: number): void {
    const wasSwinging = this.isSwinging;
    super.applyKnockback(sourceX, sourceY);
    if (!wasSwinging) return;
    this.swingTween?.stop();
    this.swingTween = undefined;
    this.swingUntil = 0;
    this.swingT = 0;
  }

  /** The weapon he was carrying clatters to the floor and fades with him. */
  override spawnCorpse(): void {
    super.spawnCorpse();

    const dropped = this.scene.add
      .image(this.weapon.x, this.weapon.y, this.weapon.texture.key)
      .setOrigin(this.weapon.originX, this.weapon.originY)
      .setScale(this.weapon.scaleX)
      .setRotation(this.weapon.rotation)
      .setDepth(DEPTHS.corpse);
    this.scene.tweens.add({
      targets: dropped,
      rotation: dropped.rotation + Phaser.Math.FloatBetween(-1.4, 1.4),
      y: dropped.y + 10,
      duration: 260,
      ease: 'Quad.easeOut',
    });

    // A dropped torch is still on fire. It used to be handed off as a single
    // still frame with the embers cut dead, so the one thing on screen that is
    // supposed to be alive read as frozen for the whole fade. The drop gets its
    // own flicker and its own embers — the hunter's emitter dies with him.
    const burning = this.textures.length > 1;
    const flicker = burning
      ? this.scene.time.addEvent({
          delay: FLICKER_MS,
          loop: true,
          startAt: FLICKER_MS * this.frameIndex,
          callback: () => {
            const next = (this.textures.indexOf(dropped.texture.key) + 1) % this.textures.length;
            dropped.setTexture(this.textures[next]);
          },
        })
      : null;
    const embers = burning ? this.createEmbers() : null;
    if (embers) {
      const shaft = dropped.displayHeight * HEAD_FRACTION;
      embers
        .setPosition(
          dropped.x + Math.sin(dropped.rotation) * shaft,
          dropped.y - Math.cos(dropped.rotation) * shaft,
        )
        .setDepth(DEPTHS.corpse);
    }

    this.scene.tweens.add({
      targets: dropped,
      alpha: 0,
      delay: 700,
      duration: 900,
      onUpdate: () => embers?.setAlpha(dropped.alpha),
      onComplete: () => {
        flicker?.remove();
        embers?.destroy();
        dropped.destroy();
      },
    });
  }

  /** The prop and its embers are loose objects — both go when he does. */
  override destroy(fromScene?: boolean): void {
    if (!this.scene) return; // already destroyed; see the note in Priest.destroy
    this.swingTween?.stop();
    this.weapon.destroy();
    this.embers?.destroy();
    super.destroy(fromScene);
  }

  private startSwingTween(swingMs: number): void {
    this.swingTween?.stop();
    this.swingUntil = this.scene.time.now + swingMs * 2;
    this.swingTween = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: swingMs,
      // Back.easeIn dips below zero before it climbs — that dip IS the wind-up,
      // and the yoyo runs the same curve backwards as the recovery.
      ease: 'Back.easeIn',
      yoyo: true,
      onUpdate: (tween) => (this.swingT = tween.getValue() ?? 0),
      onComplete: () => {
        this.swingT = 0;
        this.swingTween = undefined;
      },
    });
  }

  /**
   * Pins the prop to his fist for this frame. Everything about how it is held
   * — which side, which way it leans, whether it passes in front of him — is
   * read from his facing, and the swing is layered on top as a rotation toward
   * the locked aim plus a forward lunge of the hand.
   */
  private updateWeapon(): void {
    const carry = CARRY[this.facing];
    const t = this.swingT;
    const rest = carry.lean;
    // A thrust ends pointing straight down the aim line; a chop carries past it.
    const strike =
      this.swingAim +
      Math.PI / 2 +
      (this.motion === 'chop' ? CHOP_FOLLOW_THROUGH : 0);
    // The chop's rotation IS the attack, so it tracks t the whole way. The
    // thrust finishes aiming early and then holds, so the travel reads as a
    // stab rather than as a slower swing.
    const aimT =
      this.motion === 'chop' ? t : Math.min(1, Math.max(0, t) / THRUST_AIM_FRACTION);
    const rotation = lerpAngle(rest, strike, aimT);

    const lunge = this.displayHeight * LUNGE[this.motion] * Math.max(0, t);
    // No walk-cycle bob to ride any more: the bought pack's sheets lifted him
    // off the floor and set him down again, so a prop at a fixed offset slid
    // against his fist every step and had to be corrected frame by frame.
    // Romi's sheets are registered on the FEET (tools/build_hunter_sheets.py),
    // so his painted top does not move within a direction and neither does his
    // hand.
    const x = this.x + this.displayWidth * carry.handX + Math.cos(this.swingAim) * lunge;
    const y = this.y + this.displayHeight * this.look.handY + Math.sin(this.swingAim) * lunge;

    this.weapon
      .setPosition(x, y)
      .setRotation(rotation)
      .setScale(this.scaleX * WEAPONS[this.weaponKind].scale)
      .setDepth(this.depth + (carry.behind ? -1 : 1));

    if (!this.embers) return;

    // Flicker the flame, and pour embers off the head wherever the swing has
    // just carried it — the trail is what makes the chop read as a fire arc.
    const index = Math.floor(this.scene.time.now / FLICKER_MS) % this.textures.length;
    if (index !== this.frameIndex) {
      this.frameIndex = index;
      this.weapon.setTexture(this.textures[index]);
    }
    const shaft = this.weapon.displayHeight * HEAD_FRACTION;
    this.embers
      .setPosition(x + Math.sin(rotation) * shaft, y - Math.cos(rotation) * shaft)
      .setDepth(this.depth + (carry.behind ? -1 : 1));
  }
}
