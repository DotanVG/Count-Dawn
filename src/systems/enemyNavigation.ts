export interface NavigationPoint {
  x: number;
  y: number;
}

export interface NavigationBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface NavigationObstacle extends NavigationPoint {
  halfWidth: number;
  halfHeight: number;
}

export interface NavigationActor {
  halfWidth: number;
  halfHeight: number;
}

export interface AutoAttackCandidate extends NavigationPoint {
  active: boolean;
  isAlive: boolean;
  isEntering: boolean;
  displayWidth: number;
}

const DETOUR_CLEARANCE = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Builds an L-shaped route around a solid obstacle.
 *
 * The old coffin route placed its destination just beyond the coffin without
 * accounting for the hunter's body or the arena wall. On the coffin's cramped
 * left side that point could be outside the body's reachable bounds, leaving
 * the hunter forever trying to walk into the wall. These waypoints expand the
 * coffin by the actor's body, clamp every destination to a reachable center,
 * and clear the near corner before crossing to the player's side.
 */
export function coffinDetourWaypoints(
  origin: NavigationPoint,
  target: NavigationPoint,
  coffin: NavigationObstacle,
  arena: NavigationBounds,
  actor: NavigationActor,
): NavigationPoint[] {
  const halfWidth = Math.max(0, actor.halfWidth);
  const halfHeight = Math.max(0, actor.halfHeight);
  const minX = arena.left + halfWidth;
  const maxX = arena.right - halfWidth;
  const minY = arena.top + halfHeight;
  const maxY = arena.bottom - halfHeight;

  const expandedLeft = coffin.x - coffin.halfWidth - halfWidth - DETOUR_CLEARANCE;
  const expandedRight = coffin.x + coffin.halfWidth + halfWidth + DETOUR_CLEARANCE;
  const expandedTop = coffin.y - coffin.halfHeight - halfHeight - DETOUR_CLEARANCE;
  const expandedBottom = coffin.y + coffin.halfHeight + halfHeight + DETOUR_CLEARANCE;

  const originIsLeft = origin.x < coffin.x;
  const targetIsLeft = target.x < coffin.x;
  const routeAbove = origin.y < coffin.y;

  const nearX = clamp(originIsLeft ? expandedLeft : expandedRight, minX, maxX);
  const farX = clamp(targetIsLeft ? expandedLeft : expandedRight, minX, maxX);
  const routeY = clamp(routeAbove ? expandedTop : expandedBottom, minY, maxY);
  const waypoints: NavigationPoint[] = [{ x: nearX, y: routeY }];

  // Crossing the coffin needs a second corner. When both actor and target are
  // on the same side, reaching the first clear corner is enough.
  if (originIsLeft !== targetIsLeft && Math.abs(farX - nearX) > 1) {
    waypoints.push({ x: farX, y: routeY });
  }

  return waypoints;
}

/**
 * Mobile sword targeting only considers enemies a swing can currently reach.
 * In particular, an off-canvas hunter still walking in must not steal aim
 * from a visible enemy beside the Count.
 */
export function selectAutoAttackTarget<T extends AutoAttackCandidate>(
  origin: NavigationPoint,
  candidates: readonly T[],
  attackRange: number,
): T | null {
  let nearest: T | null = null;
  let nearestDistanceSq = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    if (!candidate.active || !candidate.isAlive || candidate.isEntering) continue;
    const dx = candidate.x - origin.x;
    const dy = candidate.y - origin.y;
    const distanceSq = dx * dx + dy * dy;
    const reach = attackRange + candidate.displayWidth / 2;
    if (distanceSq > reach * reach || distanceSq >= nearestDistanceSq) continue;
    nearest = candidate;
    nearestDistanceSq = distanceSq;
  }

  return nearest;
}
