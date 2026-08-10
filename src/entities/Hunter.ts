import Phaser from 'phaser';
import { COFFIN_COLLISION, HUNTER, KNOCKBACK } from '../data/balance';
import { ARENA, DEPTHS } from '../game/constants';
import { TEXTURES, animKey, type CharacterKey, type Dir4 } from '../utils/assetKeys';
import { angleToDir4 } from '../utils/direction';
import { coffinDetourWaypoints, type NavigationPoint } from '../systems/enemyNavigation';

export interface HunterStats {
  health: number;
  contactDamage: number;
  moveSpeed: number;
}

/** The doorway-shadow tint a hunter wears while still inside the door frame. */
const ENTRANCE_SHADOW_TINT = 0x404060;

/** How long since the last reported coffin contact counts as "actually cleared" — see noteCoffinContact(). */
const COFFIN_CONTACT_GAP_MS = 100;

/** Channel-wise lerp between two 0xRRGGBB colors, t clamped 0 (from) - 1 (to). */
function lerpTint(from: number, to: number, t: number): number {
  const clamped = Phaser.Math.Clamp(t, 0, 1);
  const fr = (from >> 16) & 0xff;
  const fg = (from >> 8) & 0xff;
  const fb = from & 0xff;
  const tr = (to >> 16) & 0xff;
  const tg = (to >> 8) & 0xff;
  const tb = to & 0xff;
  const r = Math.round(fr + (tr - fr) * clamped);
  const g = Math.round(fg + (tg - fg) * clamped);
  const b = Math.round(fb + (tb - fb) * clamped);
  return (r << 16) | (g << 8) | b;
}

/**
 * Which of Romi's humans a hunter is. Passed through the constructor (not a
 * subclass field) because the base constructor already plays an animation —
 * subclass field initializers would still be undefined by then.
 *
 * One `sheet` rather than the walk/death pair this used to carry: every
 * character is a single 2x4 sheet now, so there was never a second texture to
 * name.
 */
export interface HunterLook {
  charKey: CharacterKey;
  sheet: string;
  /**
   * Where this character's fist sits, as a fraction of display height below the
   * sprite's centre. Per character because Romi drew them differently: the
   * huntress carries her arms a good five texture rows lower than the pilgrim,
   * and a weapon has to hang off the hand that is actually painted rather than
   * off an average of everybody's.
   */
  handY: number;
}

/** The two basic hunters. A melee spawn is one or the other, rolled per hunter. */
export const PILGRIM_LOOK: HunterLook = {
  charKey: 'pilgrim',
  sheet: TEXTURES.pilgrim,
  handY: 0.03,
};
export const HUNTRESS_LOOK: HunterLook = {
  charKey: 'huntress',
  sheet: TEXTURES.huntress,
  handY: 0.115,
};
/** The garlic farmer — the one of them who throws instead of swinging. */
export const FARMER_LOOK: HunterLook = {
  charKey: 'farmer',
  sheet: TEXTURES.farmer,
  handY: 0.06,
};

export const BASIC_LOOKS: readonly HunterLook[] = [PILGRIM_LOOK, HUNTRESS_LOOK];

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
  /**
   * spawning: holding still in the doorway's shadow, fading in.
   * entering: walking the straight line from the door to its release point.
   * active: normal AI — pursue() steers, combat and contact damage apply.
   */
  private entryState: 'spawning' | 'entering' | 'active' = 'active';
  private spawnHoldUntil = 0;
  private arrivalPoint: { x: number; y: number } | null = null;
  /** Where this walk-in started — the far end of the entrance tint gradient below. */
  private entranceSpawnPoint: { x: number; y: number } | null = null;
  /**
   * The door-frame/room boundary along the walk, if this entrance has one
   * (only door spawns do — see EntranceController). Defaults to the spawn
   * point itself, which collapses the "stay dark inside the frame" hold to
   * zero distance so the brighten gradient just runs the whole walk instead.
   */
  private entranceThreshold: { x: number; y: number } | null = null;
  /**
   * Optional scenery-only steering used by the opening cinematic. It keeps an
   * actor walking/standing without ever entering the melee state, so closing
   * the ring cannot accidentally start a swing at the Count.
   */
  private cutsceneTarget: {
    x: number;
    y: number;
    faceX: number;
    faceY: number;
  } | null = null;
  private coffinDetour: {
    waypoints: NavigationPoint[];
    index: number;
    lastDistance: number;
    lastProgressAt: number;
  } | null = null;
  /** When continuous coffin contact began, if any is ongoing — see noteCoffinContact(). */
  private coffinContactStartAt: number | null = null;
  /** Most recent frame contact was actually reported; a gap this long means it's cleared. */
  private lastCoffinContactAt = 0;
  private knockbackUntil = 0;
  private readonly knockbackVelocity = new Phaser.Math.Vector2();
  /** Bumped whenever a swing is started or interrupted; a stale token can't land a hit. */
  private swingToken = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    stats: HunterStats = HUNTER,
    look: HunterLook = PILGRIM_LOOK,
  ) {
    super(scene, x, y, look.sheet, 0);
    this.look = look;
    this.health = stats.health;
    this.contactDamage = stats.contactDamage;
    this.moveSpeed = stats.moveSpeed;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(HUNTER.spriteScale);
    // Body in unscaled 64x64 texture space: a circle over the torso and legs.
    // Romi's humans stand from about row 17 to row 48 of the frame (see
    // tools/build_hunter_sheets.py), lower and taller than the bought pack sat,
    // and this is sized to land on the same on-screen radius they had — the
    // hitbox is how often a hunter's body actually touches the Count, and that
    // should not change just because the art did.
    this.setCircle(12, 19, 28);
    this.setDepth(DEPTHS.hunter);
    this.play(animKey(look.charKey, 'walk', 'down'));
  }

  get isAlive(): boolean {
    return this.health > 0;
  }

  /**
   * True while spawning or walking in from a door — used to skip the coffin
   * collider, exempt this hunter from the player's sword and contact
   * damage, and keep pursue() from steering, until arrival.
   */
  get isEntering(): boolean {
    return this.entryState !== 'active';
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
    if (!this.active || !this.isAlive || this.isEntering) return;

    // A committed attack is not interrupted, only shoved. This is the line
    // between a hunter and a boss: pressuring a hunter stops him hitting you,
    // pressuring a boss mid-special buys you a shove and nothing else, so the
    // answer to a boss's telegraph has to be footwork rather than damage.
    if (this.isCommitted) {
      this.applyShove(sourceX, sourceY);
      return;
    }

    this.applyShove(sourceX, sourceY);

    // Flinch toward whoever hit him, and drop the pending swing.
    this.swingToken++;
    const away = Phaser.Math.Angle.Between(sourceX, sourceY, this.x, this.y);
    this.facing = angleToDir4(away + Math.PI);
    this.play(animKey(this.look.charKey, 'hurt', this.facing), true);
  }

  /**
   * True while this hunter is mid-attack in a way a hit cannot cancel. Bosses
   * override it for their specials; a plain hunter is never committed.
   */
  protected get isCommitted(): boolean {
    return false;
  }

  /** The shove itself, with no say over whether the attack survives it. */
  private applyShove(sourceX: number, sourceY: number): void {
    const away = Phaser.Math.Angle.Between(sourceX, sourceY, this.x, this.y);
    const speed = KNOCKBACK.speed * this.knockbackResistance;
    this.knockbackVelocity.set(Math.cos(away) * speed, Math.sin(away) * speed);
    this.knockbackUntil = this.scene.time.now + KNOCKBACK.durationMs;
    this.setVelocity(this.knockbackVelocity.x, this.knockbackVelocity.y);
  }

  /**
   * Start a walk-in entrance: this hunter is expected to already be
   * positioned at (or off) the edge of the hall. Two beats before pursue()
   * takes over: he holds in place for HUNTER.entranceSpawnHoldMs, tinted
   * dark and fading in from alpha 0 as if stepping out of the doorway's own
   * shadow, then walks the straight line to `(arrivalX, arrivalY)` — see
   * updateForcedMovement(). Combat, contact damage and knockback are all
   * suppressed for both beats via isEntering.
   *
   * `thresholdX`/`thresholdY` mark where the door frame ends and the lit
   * room floor begins (see EntranceController's `threshold`). The shadow
   * tint holds at full strength from the spawn point to there, then eases
   * out smoothly the rest of the way to `(arrivalX, arrivalY)` — see
   * updateEntranceTint(). Callers with no real door frame (the cold open,
   * boss arrivals) can omit them: with no distance between spawn and
   * threshold, the ease just starts immediately and runs the whole walk.
   */
  beginEntrance(arrivalX: number, arrivalY: number, thresholdX?: number, thresholdY?: number): void {
    this.arrivalPoint = { x: arrivalX, y: arrivalY };
    this.entranceSpawnPoint = { x: this.x, y: this.y };
    this.entranceThreshold = { x: thresholdX ?? this.x, y: thresholdY ?? this.y };
    this.entryState = 'spawning';
    this.spawnHoldUntil = this.scene.time.now + HUNTER.entranceSpawnHoldMs;
    this.setDepth(DEPTHS.enteringHunter);
    // He starts outside the hall by definition, so the bounds have to be off
    // until he is in - they go back on the moment he arrives.
    this.setCollideWorldBounds(false);
    this.setVelocity(0, 0);
    this.play(animKey(this.look.charKey, 'idle', this.facing), true);

    this.setAlpha(0);
    // MULTIPLY throughout (not FILL): a FILL tint eased toward white would
    // paint a flat white silhouette instead of restoring his real colors, so
    // MULTIPLY is the only mode where "fully brightened" and "no tint at
    // all" are the same state — see updateEntranceTint().
    this.setTintMode(Phaser.TintModes.MULTIPLY);
    this.setTint(ENTRANCE_SHADOW_TINT);
    this.scene.tweens.add({
      targets: this,
      alpha: 1,
      duration: HUNTER.entranceFadeMs,
      ease: 'Quad.easeOut',
    });
  }

  /**
   * Holds full shadow tint from the spawn point to the door threshold, then
   * eases it out linearly by walked distance from there to the arrival
   * point — dark inside the door frame, gradually brightening across the
   * room floor, fully lit by the time pursue() takes over. Distance-based
   * rather than time-based so it always matches the actual walk, whatever
   * its length or this hunter's speed.
   */
  private updateEntranceTint(): void {
    if (!this.entranceSpawnPoint || !this.arrivalPoint) return;
    const spawn = this.entranceSpawnPoint;
    const arrival = this.arrivalPoint;
    const threshold = this.entranceThreshold ?? spawn;

    const totalDist = Phaser.Math.Distance.Between(spawn.x, spawn.y, arrival.x, arrival.y);
    if (totalDist <= 0) {
      this.setTint(0xffffff);
      return;
    }
    const traveled = Phaser.Math.Distance.Between(spawn.x, spawn.y, this.x, this.y);
    const progress = Phaser.Math.Clamp(traveled / totalDist, 0, 1);

    const doorFrameDist = Phaser.Math.Distance.Between(spawn.x, spawn.y, threshold.x, threshold.y);
    const doorFrameFraction = Phaser.Math.Clamp(doorFrameDist / totalDist, 0, 1);

    const brighten =
      doorFrameFraction >= 1
        ? 0
        : Phaser.Math.Clamp((progress - doorFrameFraction) / (1 - doorFrameFraction), 0, 1);
    this.setTint(lerpTint(ENTRANCE_SHADOW_TINT, 0xffffff, brighten));
  }

  /**
   * Steer this scenery actor toward a moving formation point while facing the
   * cinematic subject. Normal `pursue` still runs, so subclass props and boss
   * UI stay attached; `updateCutsceneMovement` intercepts before combat.
   */
  setCutsceneTarget(targetX: number, targetY: number, faceX: number, faceY: number): void {
    this.cutsceneTarget = { x: targetX, y: targetY, faceX, faceY };
  }

  /**
   * Top of the PAINTED sprite, which is not the top of its frame: Romi's humans
   * start around row 17 of every 64px frame, leaving everything above it empty.
   * Anything that hangs over a hunter (a Captain's health bar) has to anchor
   * here, or it floats a scaled 15px of nothing above him.
   */
  get visibleTopY(): number {
    return this.y - 15 * this.scaleY;
  }

  /** Direct pursuit — intentionally no steering or pathfinding. */
  pursue(targetX: number, targetY: number): void {
    if (!this.isAlive) return;
    if (this.updateForcedMovement()) return;
    if (this.updateCutsceneMovement()) return;

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
    // The collider's process callback only ever tells us contact is
    // HAPPENING (see noteCoffinContact); nothing calls in to say it's
    // stopped. This runs every frame regardless of state, so a gap this
    // long since the last reported contact is what "actually cleared the
    // coffin" looks like — reset the timer so the next approach starts
    // counting fresh instead of inheriting time from a previous, unrelated
    // brush against it.
    if (
      this.coffinContactStartAt !== null &&
      this.scene.time.now - this.lastCoffinContactAt > COFFIN_CONTACT_GAP_MS
    ) {
      this.coffinContactStartAt = null;
    }

    if (this.isKnockedBack) {
      this.updateKnockback();
      return true;
    }

    if (this.entryState === 'spawning') {
      // Hold dead still in the doorway while the fade-in plays; walking
      // starts only once the shadow beat has actually elapsed.
      this.setVelocity(0, 0);
      if (this.scene.time.now >= this.spawnHoldUntil) {
        this.entryState = 'entering';
      }
      return true;
    }

    if (this.entryState === 'entering' && this.arrivalPoint) {
      this.walkToward(this.arrivalPoint.x, this.arrivalPoint.y);
      this.updateEntranceTint();
      if (Phaser.Math.Distance.Between(this.x, this.y, this.arrivalPoint.x, this.arrivalPoint.y) < 10) {
        this.entryState = 'active';
        this.arrivalPoint = null;
        this.entranceSpawnPoint = null;
        this.entranceThreshold = null;
        this.setDepth(this.normalDepth);
        // He is inside the hall now, so the hall's walls apply to him. Without
        // this a knockback near a wall punts him into the wall band, where he
        // stands stuck and drops his blood outside the playfield.
        this.setCollideWorldBounds(true);
        this.clearTint();
        this.applyBaseTint();
        this.onEntranceArrived?.();
      }
      return true;
    }

    if (this.coffinDetour) {
      const route = this.coffinDetour;
      const waypoint = route.waypoints[route.index];
      const distance = Phaser.Math.Distance.Between(this.x, this.y, waypoint.x, waypoint.y);

      if (distance < 14) {
        route.index++;
        const next = route.waypoints[route.index];
        if (!next) {
          this.coffinDetour = null;
          return false;
        }
        route.lastDistance = Phaser.Math.Distance.Between(this.x, this.y, next.x, next.y);
        route.lastProgressAt = this.scene.time.now;
        this.walkToward(next.x, next.y);
        return true;
      }

      if (distance < route.lastDistance - 2) {
        route.lastDistance = distance;
        route.lastProgressAt = this.scene.time.now;
      } else if (this.scene.time.now - route.lastProgressAt > 700) {
        // Physics or a moving crowd can still pin a route temporarily. Drop
        // stale steering so direct pursuit resumes and the next coffin contact
        // can calculate a fresh route from the hunter's new position.
        this.coffinDetour = null;
        return false;
      }

      this.walkToward(waypoint.x, waypoint.y);
      return true;
    }

    return false;
  }

  /**
   * Walk to the current cinematic formation point, then hold and face inward.
   * Returning true tells every combat state machine to stop here for the
   * frame: no melee swing, target lock, ward, projectile or contact chase.
   */
  protected updateCutsceneMovement(): boolean {
    const target = this.cutsceneTarget;
    if (!target) return false;

    const distance = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);
    if (distance > 6) {
      this.walkToward(target.x, target.y);
      return true;
    }

    this.setVelocity(0, 0);
    this.facing = angleToDir4(Phaser.Math.Angle.Between(this.x, this.y, target.faceX, target.faceY));
    const key = animKey(this.look.charKey, 'idle', this.facing);
    if (this.anims.currentAnim?.key !== key) this.play(key, true);
    return true;
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
    if (this.isEntering || this.coffinDetour) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const waypoints = coffinDetourWaypoints(
      { x: this.x, y: this.y },
      { x: targetX, y: this.y },
      {
        x: coffinX,
        y: coffinY,
        halfWidth: coffinHalfWidth,
        halfHeight: coffinHalfHeight,
      },
      ARENA,
      {
        halfWidth: body.halfWidth,
        halfHeight: body.halfHeight,
      },
    );
    const first = waypoints[0];
    this.coffinDetour = {
      waypoints,
      index: 0,
      lastDistance: Phaser.Math.Distance.Between(this.x, this.y, first.x, first.y),
      lastProgressAt: this.scene.time.now,
    };
  }

  /**
   * Called from the coffin collider's process callback in GameScene every
   * physics step this hunter's body is actually overlapping the coffin's —
   * returning false there skips separation for that step, letting the
   * hunter pass straight through instead of colliding. Normal routing
   * (avoidCoffin/coffinDetour) assumes a route starting from OUTSIDE the
   * coffin; if a hunter's body ever ends up already inside it, Arcade's own
   * separation impulse fights that steering every step instead of
   * resolving it, and this is the only way out. Contact under
   * COFFIN_COLLISION.stuckTimeoutMs collides completely normally — this is
   * a last resort, not a routine substitute for the detour.
   */
  noteCoffinContact(): boolean {
    const now = this.scene.time.now;
    if (this.coffinContactStartAt === null) this.coffinContactStartAt = now;
    this.lastCoffinContactAt = now;
    return now - this.coffinContactStartAt < COFFIN_COLLISION.stuckTimeoutMs;
  }

  /**
   * A landed strike is definitive evidence of the Count's current position.
   * Forget any old scenery detour so, after knockback, pursuit immediately
   * reacquires him instead of completing a route chosen for an earlier spot.
   */
  refreshPursuit(): void {
    this.coffinDetour = null;
    if (!this.isEntering) this.cutsceneTarget = null;
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
    this.refreshPursuit();
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
   * Spawns a non-colliding corpse, fading out. Called by the scene when this
   * hunter dies, right before removal.
   *
   * None of Romi's humans has a death sheet — two frames per direction is all
   * any of them has — so the fall is a TWEEN rather than an animation: he keels
   * over sideways and sinks a little as he fades. Two frames on their own cannot
   * sell falling down, and rotating him can, which is also how the Priest goes
   * (he overrides this only to fall slower and heavier).
   */
  spawnCorpse(): void {
    const corpse = this.scene.add
      .sprite(this.x, this.y, this.look.sheet, 0)
      .setScale(this.scaleX, this.scaleY)
      .setDepth(DEPTHS.corpse);
    corpse.play(animKey(this.look.charKey, 'death', this.facing));
    // Away from whichever way he was facing, so he does not fall through
    // himself, and never straight up- or down-screen where it reads as nothing.
    const away = this.facing === 'right' ? -1 : 1;
    this.scene.tweens.add({
      targets: corpse,
      angle: away * Phaser.Math.Between(72, 96),
      y: corpse.y + 6 * this.scaleY,
      duration: 360,
      ease: 'Quad.easeIn',
    });
    this.scene.tweens.add({
      targets: corpse,
      alpha: 0,
      delay: 700,
      duration: 900,
      onComplete: () => corpse.destroy(),
    });
  }
}
