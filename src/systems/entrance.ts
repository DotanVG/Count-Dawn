import { ARENA, GAME_WIDTH, GAME_HEIGHT } from '../game/constants.ts';

/**
 * Given an arrival point near an allowed arena edge, returns a spawn point
 * beyond the left, right, or bottom canvas edge. Hunters and Captains start
 * here and walk in to the arrival point, so they visibly enter from outside
 * the screen instead of popping into the room. The window wall is never an
 * entrance—not even at its far corners.
 */
export function offCanvasSpawnPoint(arrival: { x: number; y: number }): { x: number; y: number } {
  const margin = 60;
  const near = 90;
  // Check the side walls before vertical position. A side arrival near the
  // north-west/north-east corner used to satisfy the old "near top" test
  // first and secretly enter through the window wall.
  if (arrival.x <= ARENA.left + near) return { x: -margin, y: arrival.y };
  if (arrival.x >= ARENA.right - near) return { x: GAME_WIDTH + margin, y: arrival.y };
  return { x: arrival.x, y: GAME_HEIGHT + margin };
}
