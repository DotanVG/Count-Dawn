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

function defineEntrance(id: EntranceId, spawnPoint: Point, threshold: Point, dir: Point): EntranceDef {
  return {
    id,
    spawnPoint,
    threshold,
    releasePoint: { x: threshold.x + dir.x * RELEASE_INSET, y: threshold.y + dir.y * RELEASE_INSET },
  };
}

/**
 * The three doors, each walked straight-on (perpendicular to its wall): for
 * every entry, spawnPoint/threshold/releasePoint share the one axis the door
 * doesn't move along, so a straight walkToward() can never clip a wall
 * corner on the way in.
 */
export const ENTRANCE_DEFS: readonly EntranceDef[] = [
  defineEntrance('left', ENTRANCES.left, { x: ARENA.left, y: ENTRANCES.left.y }, { x: 1, y: 0 }),
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
) => Entrant;

const DEFAULT_WEIGHTS: Readonly<Record<EntranceId, number>> = { left: 1, right: 1, down: 1 };

/**
 * Routes every regular spawn through one of the three doors instead of a
 * random arena edge. One entrant walks in per door at a time — a second
 * request for a busy door queues instead of stacking a sprite on top of the
 * first — and the queue drains itself the instant a door frees up, chained
 * off each entrant's own onEntranceArrived hook.
 */
export class EntranceController {
  private readonly occupied = new Set<EntranceId>();
  private queued = 0;
  private lastDoor: EntranceId | null = null;

  constructor(
    private readonly getPlayerPosition: () => Point,
    private readonly minSpawnDistanceFromPlayer: number,
    private readonly spawnEntrant: SpawnEntrant,
    private readonly weights: Readonly<Record<EntranceId, number>> = DEFAULT_WEIGHTS,
  ) {}

  /** Requests waiting for a door to free up. */
  get queuedCount(): number {
    return this.queued;
  }

  /** True while a hunter is still mid walk-in through this door. */
  isOccupied(id: EntranceId): boolean {
    return this.occupied.has(id);
  }

  /**
   * Called once per spawn tick. Claims a free, weighted, non-repeating door
   * far enough from the player and walks an entrant in through it. If every
   * door is mid-entrance, the request queues and fires off whichever door
   * frees first; if doors are free but all too close to the player, the tick
   * is simply skipped — same fallback the old random-edge picker used, the
   * next timer tick tries again.
   */
  spawnAt(): void {
    const def = this.claimDoor();
    if (def) {
      this.enter(def);
      return;
    }
    if (this.occupied.size >= ENTRANCE_DEFS.length) {
      this.queued++;
    }
  }

  private claimDoor(): EntranceDef | null {
    const player = this.getPlayerPosition();
    const free = ENTRANCE_DEFS.filter(
      (def) =>
        !this.occupied.has(def.id) &&
        distance(def.spawnPoint, player) >= this.minSpawnDistanceFromPlayer,
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

  private enter(def: EntranceDef): void {
    this.occupied.add(def.id);
    this.lastDoor = def.id;
    const entrant = this.spawnEntrant(
      def.spawnPoint.x,
      def.spawnPoint.y,
      def.releasePoint.x,
      def.releasePoint.y,
    );
    // Compose rather than overwrite: some entrants (bosses) already hang
    // their own post-arrival hook off this callback.
    const chained = entrant.onEntranceArrived;
    entrant.onEntranceArrived = () => {
      chained?.();
      this.occupied.delete(def.id);
      if (this.queued > 0) {
        this.queued--;
        this.spawnAt();
      }
    };
  }
}
