import Phaser from 'phaser';
import { ARMED, WEAPONS, type WeaponKind } from '../data/balance';
import { DEPTHS } from '../game/constants';
import { TEXTURES, type Dir4 } from '../utils/assetKeys';
import { Hunter, type HunterLook } from './Hunter';

/** Same unarmed body the garlic throwers wear — the weapon is a separate prop. */
const ARMED_LOOK: HunterLook = {
  charKey: 'thrower',
  walkTexture: TEXTURES.throwerWalk,
  deathTexture: TEXTURES.throwerDeath,
};

/** Romi drew one frame each for the spike and fork, two for the torch's flame. */
const WEAPON_TEXTURES: Record<WeaponKind, string[]> = {
  spike: [TEXTURES.weaponSpike],
  pitchfork: [TEXTURES.weaponPitchfork],
  torch: [TEXTURES.weaponTorch1, TEXTURES.weaponTorch2],
};

/**
 * Where the prop sits while he is just carrying it: which side of his body the
 * hand is on (as a fraction of his display size), how the shaft leans, and
 * whether the weapon passes in front of him or behind his back.
 */
const CARRY: Record<Dir4, { handX: number; handY: number; lean: number; behind: boolean }> = {
  down: { handX: 0.09, handY: 0.02, lean: 0.3, behind: false },
  up: { handX: -0.09, handY: 0.0, lean: -0.3, behind: true },
  left: { handX: -0.11, handY: 0.02, lean: -0.5, behind: false },
  right: { handX: 0.12, handY: 0.02, lean: 0.5, behind: false },
};

/**
 * The props are drawn point-up with the grip at the bottom of the frame, so
 * the sprite pivots about (0.5, 0.92) — his fist — and the head of the weapon
 * sits this far along the shaft from there.
 */
const GRIP_ORIGIN_Y = 0.92;
const HEAD_FRACTION = 0.6;

/** Radians past the target a chop carries through to; a thrust stops on it. */
const CHOP_FOLLOW_THROUGH = 0.55;
/**
 * How far the FIST drives forward over a swing, as a fraction of his height —
 * an arm's worth, not a step. Any more and the prop visibly detaches from the
 * hunter and flies at the Count on its own.
 */
const LUNGE: Record<'thrust' | 'chop', number> = { thrust: 0.07, chop: 0.03 };

/** Milliseconds each torch frame is held before the flame flickers to the other. */
const FLICKER_MS = 110;

/** Shortest rotation from `from` to `to`, so a swing never takes the long way. */
function lerpAngle(from: number, to: number, t: number): number {
  return from + Phaser.Math.Angle.Wrap(to - from) * t;
}

/**
 * A hunter carrying one of Romi's three weapons: a wooden spike, a pitchfork
 * or a burning torch.
 *
 * He is drawn from the same UNARMED pack as the garlic throwers, which ships
 * no attack sheet — so unlike the sword hunters, none of his swing lives in
 * his body's animation. The prop is a separate image pinned to his fist every
 * frame, and one counter (`swingT`) drives the whole strike: at 0 the weapon
 * rests against his shoulder, at 1 it is fully extended at the Count. A
 * `Back.easeIn` on that counter dips it briefly below zero at the start, which
 * is the wind-up, and the yoyo back to 0 is the recovery.
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
  /** 0 = shouldered, 1 = fully extended at the target. Drives the whole swing. */
  private swingT = 0;
  /** Radians toward the target, locked when the swing starts. */
  private swingAim = 0;
  private swingTween?: Phaser.Tweens.Tween;
  private swingUntil = 0;
  private frameIndex = -1;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: WeaponKind) {
    super(scene, x, y, ARMED, ARMED_LOOK);
    const spec = WEAPONS[kind];
    this.weaponKind = kind;
    this.textures = WEAPON_TEXTURES[kind];
    this.motion = spec.motion;
    this.meleeReachFactor = spec.reach;
    this.meleeIntervalMs = spec.intervalMs;
    this.meleeHitDelayMs = spec.hitDelayMs;
    this.setScale(ARMED.spriteScale);

    this.weapon = scene.add
      .image(x, y, this.textures[0])
      .setOrigin(0.5, GRIP_ORIGIN_Y)
      .setScale(this.scaleX * ARMED.propScale);

    // Only the torch burns, and it burns the whole time he is carrying it —
    // he is walking a live flame across a hall lit by the same fire.
    this.embers =
      kind === 'torch'
        ? scene.add.particles(0, 0, TEXTURES.particle, {
            speed: { min: 10, max: 45 },
            angle: { min: 235, max: 305 },
            lifespan: { min: 240, max: 560 },
            scale: { start: 0.7, end: 0 },
            alpha: { start: 0.9, end: 0 },
            gravityY: -70,
            tint: [0xffd76b, 0xff9a3d, 0xff5a2a],
            frequency: 120,
            quantity: 1,
          })
        : null;

    this.updateWeapon();
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
      scale: { from: ARMED.spriteScale * 1.1, to: ARMED.spriteScale },
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
    this.embers?.stop();

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
    this.scene.tweens.add({
      targets: dropped,
      alpha: 0,
      delay: 700,
      duration: 900,
      onComplete: () => dropped.destroy(),
    });
  }

  /** The prop and its embers are loose objects — both go when he does. */
  override destroy(fromScene?: boolean): void {
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
    const rotation = lerpAngle(rest, strike, t);

    const lunge = this.displayHeight * LUNGE[this.motion] * Math.max(0, t);
    const x = this.x + this.displayWidth * carry.handX + Math.cos(this.swingAim) * lunge;
    const y = this.y + this.displayHeight * carry.handY + Math.sin(this.swingAim) * lunge;

    this.weapon
      .setPosition(x, y)
      .setRotation(rotation)
      .setScale(this.scaleX * ARMED.propScale)
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
