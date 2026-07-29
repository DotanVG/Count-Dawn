import assert from 'node:assert/strict';
import test from 'node:test';

import { ARENA, GAME_HEIGHT, GAME_WIDTH } from '../src/game/constants.ts';
import { offCanvasSpawnPoint } from '../src/systems/entrance.ts';

test('side arrivals near the upper corners still enter through side walls', () => {
  assert.deepEqual(
    offCanvasSpawnPoint({ x: ARENA.left + 40, y: ARENA.top + 40 }),
    { x: -60, y: ARENA.top + 40 },
  );
  assert.deepEqual(
    offCanvasSpawnPoint({ x: ARENA.right - 40, y: ARENA.top + 40 }),
    { x: GAME_WIDTH + 60, y: ARENA.top + 40 },
  );
});

test('no gameplay arrival can produce a north-wall spawn', () => {
  const arrivals = [
    { x: ARENA.left + 40, y: ARENA.top + 40 },
    { x: ARENA.right - 40, y: ARENA.top + 40 },
    { x: GAME_WIDTH / 2, y: ARENA.top },
    { x: GAME_WIDTH / 2, y: ARENA.bottom - 40 },
  ];
  for (const arrival of arrivals) {
    const spawn = offCanvasSpawnPoint(arrival);
    assert.notEqual(spawn.y, -60);
    assert.ok(spawn.x < 0 || spawn.x > GAME_WIDTH || spawn.y > GAME_HEIGHT);
  }
});
