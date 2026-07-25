import Phaser from 'phaser';
import { HUNTER, KNOCKBACK } from '../data/balance';
import { ARENA, DEPTHS } from '../game/constants';
import { TEXTURES, animKey, type CharacterKey, type Dir4 } from '../utils/assetKeys';
import { angleToDir4 } from '../utils/direction';

export interface HunterStats {
  health: number;
  contactDamage: number;
  moveSpeed: number;
}

/**
 * Which spritesheet family a hunter wears. Passed through the constructor
 * (not a subclass field) because the base constructor already plays an
 * animation — subclass field initializers would still be undefined by then.
 */
export interface HunterLook {
  charKey: CharacterKey;
  walkTexture: string;
  deathTexture: string;
}

const SWORDSMAN_LOOK: HunterLook = {
  charKey: 'hunter',
  walkTexture: TEXTURES.hunterWalk,
  deathTexture: TEXTURES.hunterDeath,
};

/**
 * A regular human hunter: walks straight at the player, damages on contact,
 * dies to melee hits. HunterCaptain extends this with boss stats.
 */
export class Hunter extends Phaser.Physics.Arcade.Sprite {
  health: number;
  readonly contactDamage: number;
  protected readonly moveSpeed: number;
  facing: Dir4 = 'down';
  /** Set by GameScene: called when a sword swing actually connects. */
  onStrikeHit: (() => void) | null = null;
  /** Set by GameScene for the boss: called once the walk-in entrance finishes. */
  onEntranceArrived: (() => void) | null = null;
  /** Depth once the entrance finishes (below the wall band while entering). */
  protected normalDepth: number = DEPTHS.hunter;
  /** Multiplier on incoming knockback — the Captain plants his feet harder. */
  protected knockbackResistance = 1;
  /**
   * Melee timing and reach, overridable because a hunter's weapon owns them:
   * a pitchfork genuinely outranges a sword arm and a wooden spike jabs faster
   * than either (see ArmedHunter / WEAPONS).
   */
  protected meleeReachFactor = 1;
  protected meleeIntervalMs: number = HUNTER.meleeIntervalMs;
  protected meleeHitDelayMs: number = HUNTER.meleeHitDelayMs;
  protected readonly look: HunterLook;
  private nextSwingAt = 0;
  private lastTargetDist = Infinity;
  private entering = false;
  private arrivalPoint: { x: number; y: number } | null = null;
  private coffinDetour: { x: number; y: number } | null = null;
  private knockbackUntil = 0;
  private readonly knockbackVelocity = new Phaser.Math.Vector2();
  /** Bumped whenever a swing is started or interrupted; a stale token can't land a hit. */
  private swingToken = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    stats: HunterStats = HUNTER,
    look: HunterLook = SWORDSMAN_LOOK,
  ) {
    super(scene, x, y, look.walkTexture, 0);
    this.look = look;
    this.health = stats.health;
    this.contactDamage = stats.contactDamage;
    this.moveSpeed = stats.moveSpeed;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(HUNTER.spriteScale);
    this.setCircle(10, 22, 28);
    this.setDepth(DEPTHS.hunter);
    this.play(animKey(look.charKey, 'walk', 'down'));
  }

  get isAlive(): boolean {
    return this.health > 0;
  }

  /** True while walking in from off-screen — used to skip the coffin collider until arrival. */
  get isEntering(): boolean {
    return this.entering;
  }

  /** True while being shoved by a landed strike; subclasses must not steer then. */
  protected get isKnockedBack(): boolean {
    return this.scene.time.now < this.knockbackUntil;
  }

  /**
   * Shove this hunter directly away from `(sourceX, sourceY)` — the visible
   * "you hit me" beat. The shove decays linearly to zero over
   * KNOCKBACK.durationMs, during which pursuit is suspended and any swing
   * already wound up is cancelled: a landed hit interrupts, it doesn't just
   * tickle. Hunters still walking in from off-screen are left alone so the
   * entrance path can't be knocked off course.
   */
  applyKnockback(sourceX: number, sourceY: number): void {
    if (!this.active || !this.isAlive || this.entering) return;

    const away = Phaser.Math.Angle.Between(sourceX, sourceY, this.x, this.y);
    const speed = KNOCKBACK.speed * this.knockbackResistance;
    this.knockbackVelocity.set(Math.cos(away) * speed, Math.sin(away) * speed);
    this.knockbackUntil = this.scene.time.now + KNOCKBACK.durationMs;
    this.setVelocity(this.knockbackVelocity.x, this.knockbackVelocity.y);

    // Flinch toward whoever hit him, and drop the pending swing.
    this.swingToken++;
    this.facing = angleToDir4(away + Math.PI);
    this.play(animKey(this.look.charKey, 'hurt', this.facing), true);
  }

  /**
   * Start a walk-in entrance: this hunter is expected to already be
   * positioned off-screen (see entrance.ts's offCanvasSpawnPoint). Until it
   * reaches `(arrivalX, arrivalY)`, pursue() ignores the player and beelines
   * there instead, hidden behind the wall layer the whole way in.
   */
  beginEntrance(arrivalX: number, arrivalY: number): void {
    this.arrivalPoint = { x: arrivalX, y: arrivalY };
    this.entering = true;
    this.setDepth(DEPTHS.enteringHunter);
    // He starts outside the hall by definition, so the bounds have to be off
    // until he is in - they go back on the moment he arrives.
    this.setCollideWorldBounds(false);
  }

  /**
   * Top of the PAINTED sprite, which is not the top of its frame: the source
   * art leaves rows 0-21 of every 64px frame empty above the head. Anything
   * that hangs over a hunter (the Captain's health bar) has to anchor here,
   * or it floats a scaled 10px of nothing above him.
   */
  get visibleTopY(): number {
    return this.y - 10 * this.scaleY;
  }

  /** Direct pursuit — intentionally no steering or pathfinding. */
  pursue(targetX: number, targetY: number): void {
    if (!this.isAlive) return;
    if (this.updateForcedMovement()) return;

    const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
    const dir = angleToDir4(angle);
    this.facing = dir;

    // Range check against sprite scale so the bigger Captain swings sooner.
    const dist = Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY);
    this.lastTargetDist = dist;
    const inMeleeRange = dist <= this.meleeRange;

    // Let a started swing play out before movement anims take over again.
    const swinging = this.isSwinging;

    if (inMeleeRange) {
      this.setVelocity(0, 0);
      const now = this.scene.time.now;
      if (!swinging && now >= this.nextSwingAt) {
        this.nextSwingAt = now + this.meleeIntervalMs;
        this.playSwing(dir, angle);
        const token = ++this.swingToken;
        // The blade connects mid-animation — if the target is still in reach
        // and nothing (a knockback) interrupted the swing in the meantime.
        this.scene.time.delayedCall(this.meleeHitDelayMs, () => {
          if (!this.active || !this.isAlive || token !== this.swingToken) return;
          if (this.lastTargetDist <= this.meleeRange * HUNTER.meleeHitReachFactor) {
            this.onStrikeHit?.();
          }
        });
      } else if (!swinging) {
        this.play(animKey(this.look.charKey, 'idle', dir), true);
      }
      return;
    }

    this.setVelocity(Math.cos(angle) * this.moveSpeed, Math.sin(angle) * this.moveSpeed);
    if (!swinging) {
      this.play(animKey(this.look.charKey, 'walk', dir), true);
    }
  }

  /** How close this hunter has to be to start swinging — scale plus weapon length. */
  protected get meleeRange(): number {
    return HUNTER.meleeRange * (this.scaleX / 2) * this.meleeReachFactor;
  }

  /**
   * True while a swing is still playing out. Read off the attack animation,
   * which is why ArmedHunter — whose unarmed body has no attack sheet and
   * whose swing lives on the weapon prop — overrides it with its own clock.
   */
  protected get isSwinging(): boolean {
    return (
      this.anims.currentAnim?.key.startsWith(`${this.look.charKey}-attack`) === true &&
      this.anims.isPlaying
    );
  }

  /**
   * Start one swing. `aimAngle` is the exact radians toward the target, which
   * the 4-direction attack sheet has no use for but a swung prop does.
   */
  protected playSwing(dir: Dir4, _aimAngle: number): void {
    this.play(animKey(this.look.charKey, 'attack', dir), true);
  }

  /**
   * Movement this hunter doesn't get a say in — being shoved, walking in from
   * off-screen, routing around the coffin — in priority order. Returns true
   * when it owns this frame, so subclasses with their own behaviour
   * (GarlicThrower) can defer to it exactly like pursue() does.
   */
  protected updateForcedMovement(): boolean {
    if (this.isKnockedBack) {
      this.updateKnockback();
      return true;
    }

    if (this.entering && this.arrivalPoint) {
      this.walkToward(this.arrivalPoint.x, this.arrivalPoint.y);
      if (Phaser.Math.Distance.Between(this.x, this.y, this.arrivalPoint.x, this.arrivalPoint.y) < 10) {
        this.entering = false;
        this.arrivalPoint = null;
        this.setDepth(this.normalDepth);
        // He is inside the hall now, so the hall's walls apply to him. Without
        // this a knockback near a wall punts him into the wall band, where he
        // stands stuck and drops his blood outside the playfield.
        this.setCollideWorldBounds(true);
        this.onEntranceArrived?.();
      }
      return true;
    }

    if (this.coffinDetour) {
      this.walkToward(this.coffinDetour.x, this.coffinDetour.y);
      if (Phaser.Math.Distance.Between(this.x, this.y, this.coffinDetour.x, this.coffinDetour.y) < 12) {
        this.coffinDetour = null;
      }
      return true;
    }

    return false;
  }

  /**
   * Decays the shove to zero over its duration (framerate-independent) and
   * keeps the target inside the hall, so a hit near a wall can't punt anyone
   * into the wall band or off-canvas.
   */
  private updateKnockback(): void {
    const remaining = (this.knockbackUntil - this.scene.time.now) / KNOCKBACK.durationMs;
    this.setVelocity(this.knockbackVelocity.x * remaining, this.knockbackVelocity.y * remaining);
    this.setPosition(
      Phaser.Math.Clamp(this.x, ARENA.left + 8, ARENA.right - 8),
      Phaser.Math.Clamp(this.y, ARENA.top + 8, ARENA.bottom - 8),
    );
  }

  /**
   * Pick a stable route around the coffin on first contact. Hunters that hit
   * its upper half go above it; hunters that hit its lower half go below it.
   * The waypoint is placed beyond the coffin on the player's side so direct
   * pursuit cannot immediately steer the hunter back into the obstacle.
   */
  avoidCoffin(
    coffinX: number,
    coffinY: number,
    coffinHalfWidth: number,
    coffinHalfHeight: number,
    targetX: number,
  ): void {
    if (this.entering || this.coffinDetour) return;
    const clearance = 24 + 10 * this.scaleX;
    this.coffinDetour = {
      x: targetX >= coffinX
        ? coffinX + coffinHalfWidth + clearance
        : coffinX - coffinHalfWidth - clearance,
      y: this.y < coffinY
        ? coffinY - coffinHalfHeight - clearance
        : coffinY + coffinHalfHeight + clearance,
    };
  }

  protected walkToward(targetX: number, targetY: number, speed = this.moveSpeed): void {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
    const dir = angleToDir4(angle);
    this.facing = dir;
    this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    const key = animKey(this.look.charKey, 'walk', dir);
    if (this.anims.currentAnim?.key !== key) this.play(key, true);
  }

  /** Returns true if this hit killed the hunter. Caller handles drops/removal. */
  takeDamage(amount: number): boolean {
    if (!this.isAlive) return false;
    this.health -= amount;

    // White hit flash (Phaser 4 tint API).
    this.setTint(0xffffff);
    this.setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(70, () => {
      if (!this.active) return;
      this.clearTint();
      this.setTintMode(Phaser.TintModes.MULTIPLY);
      this.applyBaseTint();
    });

    return this.health <= 0;
  }

  /** Re-applied after hit flashes; the Captain overrides with his color. */
  protected applyBaseTint(): void {
    this.clearTint();
  }

  /**
   * Spawns a non-colliding corpse playing the death animation, fading out.
   * Called by the scene when this hunter dies, right before removal.
   */
  spawnCorpse(): void {
    const corpse = this.scene.add
      .sprite(this.x, this.y, this.look.deathTexture, 0)
      .setScale(this.scaleX, this.scaleY)
      .setDepth(DEPTHS.corpse);
    corpse.play(animKey(this.look.charKey, 'death', this.facing));
    this.scene.tweens.add({
      targets: corpse,
      alpha: 0,
      delay: 700,
      duration: 900,
      onComplete: () => corpse.destroy(),
    });
  }
}
