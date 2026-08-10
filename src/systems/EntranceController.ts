// Explicit .ts extension so Node can run this module directly in unit tests.
import { ARENA } from '../game/constants.ts';

export type EntranceId = 'left' | 'right' | 'down';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface EntranceDef {
  readonly id: EntranceId;
  /** Where a hunter first appears, tucked in the doorway's shadow just outside the arena. */
  readonly spawnPoint: Point;
  /** The arena-bounds edge the door sits on — the point a straight walk-in crosses. */
  readonly threshold: Point;
  /** Where the walk-in ends: depth, collision and AI hand back to normal here. */
  readonly releasePoint: Point;
}

/**
 * Door positions measured directly off Romi's room_bg.jpeg (the three dark
 * recesses: two side doors and the one below the north wall). Kept here
 * rather than in world/CastleMap.ts because this file has to stay
 * Phaser-free for the unit tests, same discipline as systems/entrance.ts and
 * systems/coldOpen.ts — CastleMap imports these back for anything it needs
 * to draw at a door.
 */
export const ENTRANCES: Readonly<Record<EntranceId, Point>> = {
  left: { x: 46, y: 383 },
  right: { x: 1233, y: 383 },
  down: { x: 640, y: 646 },
};

/** How far past the wall threshold a hunter walks before being handed back to normal AI. */
const RELEASE_INSET = 56;

/**
 * The left door's own release inset, overriding the shared one above.
 *
 * The coffin (GameScene's COFFIN_POS, (150, 430)) sits close enough to the
 * left wall that its static collision box — expanded to the coffin's own
 * half-extents (~44w/~63h) — spans world x 106-194 at the left door's walk
 * height (y 383, itself inside the coffin's y-range of ~367-493). The
 * default 56px inset lands the release point at x=120: INSIDE that box. An
 * entrant becomes "active" (collision re-enabled) already overlapping a
 * static body, and Arcade's separation impulse fights the AI's own
 * steering every physics step instead of resolving — the coffin-collision
 * softlock this exists to prevent.
 *
 * There's no inset that clears the coffin on the near (wall) side without
 * shrinking the walk to a couple of pixels — the box's near edge (106) is
 * only 42px past the threshold (64), well inside even a base hunter's
 * collision radius, let alone the ~27px-radius a Captain carries at
 * BOSS.spriteScale. Clearing the FAR side instead needs release.x past the
 * box's right edge (194), plus a Captain's radius (27) plus the same 8px
 * clearance coffinDetourWaypoints itself routes around the coffin with
 * (enemyNavigation.ts's DETOUR_CLEARANCE) — 194 + 27 + 8 = 229 — so this
 * inset (176 -> release.x 240) adds a real margin past that, not just past
 * the coffin's bare edge. The walk takes longer than the other two doors'
 * as a result (~1.6s instead of ~0.6s at HUNTER.moveSpeed) — a real cost,
 * but a visibly-working slower entrance beats a fast one that gets
 * physically wedged in the coffin every single time.
 */
const LEFT_RELEASE_INSET = 176;

function defineEntrance(
  id: EntranceId,
  spawnPoint: Point,
  threshold: Point,
  dir: Point,
  releaseInset: number = RELEASE_INSET,
): EntranceDef {
  return {
    id,
    spawnPoint,
    threshold,
    releasePoint: { x: threshold.x + dir.x * releaseInset, y: threshold.y + dir.y * releaseInset },
  };
}

/**
 * The three doors, each walked straight-on (perpendicular to its wall): for
 * every entry, spawnPoint/threshold/releasePoint share the one axis the door
 * doesn't move along, so a straight walkToward() can never clip a wall
 * corner on the way in.
 */
export const ENTRANCE_DEFS: readonly EntranceDef[] = [
  defineEntrance(
    'left',
    ENTRANCES.left,
    { x: ARENA.left, y: ENTRANCES.left.y },
    { x: 1, y: 0 },
    LEFT_RELEASE_INSET,
  ),
  defineEntrance('right', ENTRANCES.right, { x: ARENA.right, y: ENTRANCES.right.y }, { x: -1, y: 0 }),
  defineEntrance('down', ENTRANCES.down, { x: ENTRANCES.down.x, y: ARENA.bottom }, { x: 0, y: -1 }),
];

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Anything spawnAt() can hand a walk-in through — just needs somewhere to hang the arrival hook. */
export interface Entrant {
  onEntranceArrived: (() => void) | null;
}

export type SpawnEntrant = (
  spawnX: number,
  spawnY: number,
  releaseX: number,
  releaseY: number,
  thresholdX: number,
  thresholdY: number,
) => Entrant;

const DEFAULT_WEIGHTS: Readonly<Record<EntranceId, number>> = { left: 1, right: 1, down: 1 };

/**
 * Routes every regular spawn through one of the three doors instead of a
 * random arena edge. One entrant walks in per door at a time — a second
 * request for a busy door queues instead of stacking a sprite on top of the
 * first — and the queue drains itself the instant a door frees up, chained
 * off each entrant's own onEntranceArrived hook.
 */
/** A blocked spawnAt() request waiting for a door — remembers not just WHO but how to retry. */
interface QueuedRequest {
  readonly spawnEntrant: SpawnEntrant;
  readonly ignoreProximity: boolean;
}

export class EntranceController {
  private readonly occupied = new Set<EntranceId>();
  /**
   * FIFO of blocked requests waiting for a door, not just a count — a
   * queued request (a boss lineup member, say) needs its OWN factory AND
   * its own ignoreProximity flag remembered and replayed once a door
   * frees, not whichever factory/flag happens to be the default (see
   * spawnAt's parameters).
   */
  private readonly queue: QueuedRequest[] = [];
  private lastDoor: EntranceId | null = null;

  constructor(
    private readonly getPlayerPosition: () => Point,
    private readonly minSpawnDistanceFromPlayer: number,
    private readonly spawnEntrant: SpawnEntrant,
    private readonly weights: Readonly<Record<EntranceId, number>> = DEFAULT_WEIGHTS,
  ) {}

  /** Requests waiting for a door to free up. */
  get queuedCount(): number {
    return this.queue.length;
  }

  /** True while a hunter is still mid walk-in through this door. */
  isOccupied(id: EntranceId): boolean {
    return this.occupied.has(id);
  }

  /**
   * Claims a free, weighted, non-repeating door far enough from the player
   * and walks an entrant in through it. If every door is mid-entrance, the
   * request queues and fires off whichever door frees first; if doors are
   * free but all too close to the player, the tick is simply skipped — same
   * fallback the old random-edge picker used, the next call tries again.
   *
   * `spawnEntrant`, if given, overrides the constructor's default for this
   * one call — the regular hunter spawner never passes it (every hunter
   * uses the same factory), while a one-off arrival like a boss lineup
   * member hands in its own so it shares the same three doors and occupancy
   * as everything else instead of getting its own separate arrival math.
   *
   * `ignoreProximity`, if true, skips the too-close-to-player filter for
   * this call. A regular hunter relies on the timer calling spawnAt() again
   * every tick, so a proximity skip today just tries again in a second — but
   * a one-off arrival (a boss) gets exactly one spawnAt() call ever, with no
   * such retry loop of its own, so a plain proximity skip there would drop
   * it silently: `flow.notifyBossSpawned()` still fires regardless, and
   * with zero Captains actually on the field the "defeat the boss" objective
   * can never complete — this is the mechanism behind the night-10 bug where
   * bosses failed to spawn and the run could only end by running out the
   * clock. Only the occupied-door path still queues-and-waits, which is
   * fine: that one genuinely does self-heal the moment any door frees.
   */
  spawnAt(spawnEntrant: SpawnEntrant = this.spawnEntrant, ignoreProximity = false): void {
    const def = this.claimDoor(ignoreProximity);
    if (def) {
      this.enter(def, spawnEntrant);
      return;
    }
    if (this.occupied.size >= ENTRANCE_DEFS.length) {
      this.queue.push({ spawnEntrant, ignoreProximity });
    }
  }

  private claimDoor(ignoreProximity: boolean): EntranceDef | null {
    const player = this.getPlayerPosition();
    const free = ENTRANCE_DEFS.filter(
      (def) =>
        !this.occupied.has(def.id) &&
        (ignoreProximity || distance(def.spawnPoint, player) >= this.minSpawnDistanceFromPlayer),
    );
    if (free.length === 0) return null;

    // Prefer not repeating the last door used, unless that's the only one free.
    const preferred = free.filter((def) => def.id !== this.lastDoor);
    const pool = preferred.length > 0 ? preferred : free;
    return this.weightedPick(pool);
  }

  private weightedPick(pool: readonly EntranceDef[]): EntranceDef {
    const total = pool.reduce((sum, def) => sum + this.weights[def.id], 0);
    let roll = Math.random() * total;
    for (const def of pool) {
      roll -= this.weights[def.id];
      if (roll <= 0) return def;
    }
    return pool[pool.length - 1];
  }

  private enter(def: EntranceDef, spawnEntrant: SpawnEntrant): void {
    this.occupied.add(def.id);
    this.lastDoor = def.id;
    const entrant = spawnEntrant(
      def.spawnPoint.x,
      def.spawnPoint.y,
      def.releasePoint.x,
      def.releasePoint.y,
      def.threshold.x,
      def.threshold.y,
    );
    // Compose rather than overwrite: some entrants (bosses) already hang
    // their own post-arrival hook off this callback.
    const chained = entrant.onEntranceArrived;
    entrant.onEntranceArrived = () => {
      chained?.();
      this.occupied.delete(def.id);
      const next = this.queue.shift();
      if (next) this.spawnAt(next.spawnEntrant, next.ignoreProximity);
    };
  }
}
