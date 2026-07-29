/** A world-space point that can participate in a lightning chain. */
export interface ChainPoint {
  x: number;
  y: number;
}

/** Default travel cadence used by the cold-open all-enemy chain. */
export const CHAIN_LIGHTNING_DEFAULT_HOP_MS = 36;
/** Time reserved for the final arc's flicker, corona, and particles to fade. */
export const CHAIN_LIGHTNING_TAIL_MS = 500;

/** Exact wall-clock contract returned by the Phaser visual player. */
export function chainLightningDuration(
  targetCount: number,
  hopDelayMs = CHAIN_LIGHTNING_DEFAULT_HOP_MS,
): number {
  const count = Math.max(0, Math.floor(targetCount));
  if (count === 0) return 0;
  const hop = Math.max(24, hopDelayMs);
  return (count - 1) * hop + CHAIN_LIGHTNING_TAIL_MS;
}

/**
 * Orders targets by repeatedly taking the nearest unvisited point.
 *
 * This is the same traversal rule used by BeatEmPie-Phaser's Lemon Meringue
 * pie, without that attack's range or target cap: a Count Dawn cinematic must
 * be able to visit every enemy in the hall. The input array is never mutated.
 */
export function orderChainTargets<T extends ChainPoint>(
  targets: readonly T[],
  start?: ChainPoint,
): T[] {
  const remaining = targets.filter(
    (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
  );
  if (remaining.length <= 1) return [...remaining];

  const ordered: T[] = [];
  let current: ChainPoint;

  if (start && Number.isFinite(start.x) && Number.isFinite(start.y)) {
    current = start;
  } else {
    current = remaining.shift() as T;
    ordered.push(current as T);
  }

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistanceSq = Number.POSITIVE_INFINITY;

    for (let index = 0; index < remaining.length; index++) {
      const candidate = remaining[index];
      const dx = candidate.x - current.x;
      const dy = candidate.y - current.y;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq < nearestDistanceSq) {
        nearestDistanceSq = distanceSq;
        nearestIndex = index;
      }
    }

    const [nearest] = remaining.splice(nearestIndex, 1);
    ordered.push(nearest);
    current = nearest;
  }

  return ordered;
}
