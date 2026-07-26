import Phaser from 'phaser';
import { THROWER } from '../data/balance';
import { ARENA } from '../game/constants';
import { TEXTURES, animKey } from '../utils/assetKeys';
import { angleToDir4 } from '../utils/direction';
import { Hunter, type HunterLook, type HunterStats } from './Hunter';
import { GarlicTarget } from './GarlicTarget';

const THROWER_LOOK: HunterLook = {
  charKey: 'thrower',
  walkTexture: TEXTURES.throwerWalk,
  deathTexture: TEXTURES.throwerDeath,
};

/**
 * `reposition` — shuffling back into the standoff band between throws.
 * `tracking`   — crosshair crawling from his feet toward the Count.
 * `locked`     — crosshair held him long enough; strobing through the wind-up.
 */
type ThrowerState = 'reposition' | 'tracking' | 'locked' | 'volley';

interface GarlicThrowerOptions {
  stats?: HunterStats;
  spriteScale?: number;
  garlicPerThrow?: number;
  garlicThrowGapMs?: number;
}

/** How long his hand stays empty after a throw before the next bulb appears. */
const HELD_RELOAD_MS = 700;

/**
 * The garlic thrower: an unarmed hunter who never closes for a melee. He
 * keeps a standoff distance, paints a glowing crosshair that starts at his
 * feet and chases the Count around the hall, and the moment it holds him for
 * half a second it locks in place and he lobs a garlic bulb at that spot.
 *
 * Everything he does is interruptible: a landed strike knocks him back and
 * wipes the crosshair, so pressuring the throwers is the counterplay.
 */
export class GarlicThrower extends Hunter {
  /** Set by GameScene: spawns the actual projectile, which the scene owns. */
  onThrow: ((fromX: number, fromY: number, toX: number, toY: number) => void) | null = null;

  protected aimState: ThrowerState = 'reposition';
  /** When the current aim state gives up / advances on its own. */
  private aimStateDeadline = 0;
  private target: GarlicTarget | null = null;
  private lockHeldMs = 0;
  /**
   * How many bulbs he throws per lock, and the beat between them. A plain
   * thrower lobs one; the Captain has a bulb in each hand and throws them
   * almost together (see GarlicCaptain).
   */
  protected readonly garlicPerThrow: number;
  protected readonly garlicThrowGapMs: number;
  private readonly baseSpriteScale: number;
  /** The bulbs he carries — hidden between a throw and digging out the next. */
  private heldGarlics: Phaser.GameObjects.Image[] = [];
  private heldHiddenUntil: number[] = [];
  private volleyShotsFired = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, options: GarlicThrowerOptions = {}) {
    super(scene, x, y, options.stats ?? THROWER, THROWER_LOOK);
    this.garlicPerThrow = options.garlicPerThrow ?? 1;
    this.garlicThrowGapMs = options.garlicThrowGapMs ?? 0;
    this.baseSpriteScale = options.spriteScale ?? THROWER.spriteScale;
    this.setScale(this.baseSpriteScale);
    for (let i = 0; i < this.garlicPerThrow; i++) {
      this.heldGarlics.push(
        scene.add.image(x, y, TEXTURES.garlic).setScale(THROWER.garlicHeldScale).setDepth(this.depth + 1),
      );
      this.heldHiddenUntil.push(0);
    }
    this.enterReposition();
  }

  /**
   * Called every frame by GameScene like any other hunter — the base class
   * still owns being shoved, walking in, and routing around the coffin.
   */
  override pursue(targetX: number, targetY: number): void {
    if (!this.isAlive) return;
    this.updateHeldGarlic();

    // A hit (or the walk-in) takes precedence and cancels any aim in progress —
    // unless this thrower is one that holds its aim under fire, in which case
    // the shove lands but the lock survives it and the state machine picks the
    // volley back up as soon as he stops sliding (see GarlicCaptain).
    if (this.updateForcedMovement()) {
      if (this.aimState !== 'reposition' && !this.keepsAimUnderFire) this.enterReposition();
      return;
    }

    const now = this.scene.time.now;
    const deltaMs = this.scene.game.loop.delta;
    const distance = Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY);

    switch (this.aimState) {
      case 'reposition':
        this.holdStandoff(targetX, targetY, distance);
        if (now >= this.aimStateDeadline && distance <= THROWER.maxStandoff) {
          this.beginTracking();
        }
        break;

      case 'tracking':
        this.faceAndStand(targetX, targetY);
        this.updateTracking(targetX, targetY, deltaMs, now);
        break;

      case 'locked':
        this.faceAndStand(targetX, targetY);
        if (now >= this.aimStateDeadline) this.beginVolley();
        break;

      case 'volley':
        this.faceAndStand(targetX, targetY);
        this.target?.moveToward(targetX, targetY, deltaMs);
        if (now >= this.aimStateDeadline) this.releaseVolleyShot();
        break;
    }

    this.target?.draw(now);
  }

  /** Drop the crosshair and start the cooldown over (round ended, etc.). */
  abortAim(): void {
    this.enterReposition();
  }

  /**
   * True from the moment the crosshair locks until the last bulb has left his
   * hand — the beats a boss refuses to have knocked out of him.
   */
  protected get isAiming(): boolean {
    return this.aimState === 'locked' || this.aimState === 'volley';
  }

  /** A plain thrower loses his lock to a hit; a Captain does not. */
  protected get keepsAimUnderFire(): boolean {
    return false;
  }

  /** The crosshair just locked on. Bosses hang their wind-up tell here. */
  protected onLocked(): void {
    // Nothing for an ordinary thrower — the crosshair is his whole tell.
  }

  /** The crosshair and the held bulb are loose objects — both go when he does. */
  override destroy(fromScene?: boolean): void {
    if (!this.scene) return; // already destroyed; see the note in Priest.destroy
    this.clearTarget();
    for (const bulb of this.heldGarlics) bulb.destroy();
    super.destroy(fromScene);
  }

  /**
   * Keeps the carried bulb pinned to his hand: he walks in visibly armed, and
   * the bulb only vanishes for the beat after a throw, while he digs out the
   * next one. Depth tracks his own so it stays hidden behind the wall band
   * during the walk-in, and sits behind his body when his back is turned.
   */
  private updateHeldGarlic(): void {
    const handX = this.displayWidth * 0.13;
    const handY = this.displayHeight * 0.06;

    for (let i = 0; i < this.heldGarlics.length; i++) {
      const bulb = this.heldGarlics[i];
      const side = this.heldGarlics.length === 1 ? 1 : i === 0 ? -1 : 1;
      const facingSide = this.facing === 'left' ? -1 : this.facing === 'right' ? 1 : side;
      const spread = this.heldGarlics.length === 1 ? 0.8 : 0.72 + i * 0.28;
      bulb
        .setPosition(
          this.x + handX * facingSide * spread,
          this.y + handY + (this.facing === 'left' || this.facing === 'right' ? side * 5 : 0),
        )
        .setDepth(this.facing === 'up' ? this.depth - 1 : this.depth + 1)
        .setVisible(this.scene.time.now >= this.heldHiddenUntil[i]);
    }
  }

  // ── States ──────────────────────────────────────────────────────────────

  /**
   * Walk back into the standoff band: too close, back off; too far, close in.
   * Backing off is clamped to the hall — cornered against a wall he has to
   * stand and take it rather than retreat off-canvas.
   */
  private holdStandoff(targetX: number, targetY: number, distance: number): void {
    if (distance < THROWER.minStandoff) {
      const away = Phaser.Math.Angle.Between(targetX, targetY, this.x, this.y);
      this.walkToward(this.x + Math.cos(away) * 100, this.y + Math.sin(away) * 100);
      this.setPosition(
        Phaser.Math.Clamp(this.x, ARENA.left + 20, ARENA.right - 20),
        Phaser.Math.Clamp(this.y, ARENA.top + 20, ARENA.bottom - 20),
      );
    } else if (distance > THROWER.maxStandoff) {
      this.walkToward(targetX, targetY);
    } else {
      this.faceAndStand(targetX, targetY);
    }
  }

  /** Plant his feet and turn toward the Count — the aiming pose. */
  private faceAndStand(targetX: number, targetY: number): void {
    this.setVelocity(0, 0);
    this.facing = angleToDir4(Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY));
    const key = animKey(this.look.charKey, 'idle', this.facing);
    if (this.anims.currentAnim?.key !== key) this.play(key, true);
  }

  /**
   * Crawl the crosshair after the Count. Contact has to be UNBROKEN: step out
   * of it and the hold resets to zero, which is what makes kiting work.
   */
  private updateTracking(targetX: number, targetY: number, deltaMs: number, now: number): void {
    const target = this.target;
    if (!target) {
      this.enterReposition();
      return;
    }

    target.moveToward(targetX, targetY, deltaMs);

    if (target.isOnTarget(targetX, targetY)) {
      this.lockHeldMs += deltaMs;
      if (this.lockHeldMs >= THROWER.lockHoldMs) {
        target.lock();
        this.aimState = 'locked';
        this.aimStateDeadline = now + THROWER.throwWindupMs;
        this.onLocked();
      }
      return;
    }

    this.lockHeldMs = 0;
    if (now >= this.aimStateDeadline) this.enterReposition(); // he lost him; try again later
  }

  private beginTracking(): void {
    this.clearTarget();
    // The crosshair is cast from his feet, then hunts outward from there.
    this.target = new GarlicTarget(this.scene, this.x, this.y + this.displayHeight * 0.18);
    this.lockHeldMs = 0;
    this.aimState = 'tracking';
    this.aimStateDeadline = this.scene.time.now + THROWER.maxTrackMs;
  }

  /** No attack sheet exists for the unarmed pack — the throw is a scale-punch. */
  private beginVolley(): void {
    const target = this.target;
    if (!target) {
      this.enterReposition();
      return;
    }

    this.volleyShotsFired = 0;
    this.aimState = 'volley';
    this.releaseVolleyShot();
  }

  /** Fire one bulb; extra bulbs briefly keep tracking before they follow. */
  private releaseVolleyShot(): void {
    const target = this.target;
    if (!target) {
      this.enterReposition();
      return;
    }

    const shotIndex = this.volleyShotsFired++;
    this.onThrow?.(this.x, this.y, target.x, target.y);
    this.heldHiddenUntil[shotIndex] = this.scene.time.now + HELD_RELOAD_MS;
    this.scene.tweens.add({
      targets: this,
      scale: { from: this.baseSpriteScale * 1.12, to: this.baseSpriteScale },
      duration: 140,
      ease: 'Back.easeOut',
    });

    if (this.volleyShotsFired >= this.garlicPerThrow) {
      this.enterReposition();
      return;
    }

    target.unlock();
    this.aimStateDeadline = this.scene.time.now + this.garlicThrowGapMs;
  }

  private enterReposition(): void {
    this.clearTarget();
    this.lockHeldMs = 0;
    this.volleyShotsFired = 0;
    this.aimState = 'reposition';
    this.aimStateDeadline = this.scene.time.now + THROWER.aimCooldownMs;
  }

  private clearTarget(): void {
    this.target?.destroy();
    this.target = null;
  }
}
