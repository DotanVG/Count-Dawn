import { ARENA, GAME_WIDTH, GAME_HEIGHT } from '../game/constants';

/**
 * Given an arrival point near one of the arena's four edges, returns a spawn
 * point beyond the corresponding canvas edge. Hunters and the Captain start
 * here and walk in to the arrival point, so they visibly enter from outside
 * the screen instead of popping into the room. The margin comfortably clears
 * every edge-inset used by both regular spawns (~40px in) and the boss's
 * spawn (~70px in).
 */
export function offCanvasSpawnPoint(arrival: { x: number; y: number }): { x: number; y: number } {
  const margin = 60;
  const near = 90;
  if (arrival.y <= ARENA.top + near) return { x: arrival.x, y: -margin };
  if (arrival.y >= ARENA.bottom - near) return { x: arrival.x, y: GAME_HEIGHT + margin };
  if (arrival.x <= ARENA.left + near) return { x: -margin, y: arrival.y };
  return { x: GAME_WIDTH + margin, y: arrival.y };
}
