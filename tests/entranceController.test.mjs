import assert from 'node:assert/strict';
import test from 'node:test';

import { ARENA } from '../src/game/constants.ts';
import { ENTRANCE_DEFS, EntranceController } from '../src/systems/EntranceController.ts';

function withFixedRandom(value, fn) {
  const original = Math.random;
  Math.random = () => value;
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

test('every entrance walks a straight perpendicular line — spawn, threshold and release share an axis', () => {
  for (const def of ENTRANCE_DEFS) {
    const sameX = def.spawnPoint.x === def.threshold.x && def.threshold.x === def.releasePoint.x;
    const sameY = def.spawnPoint.y === def.threshold.y && def.threshold.y === def.releasePoint.y;
    assert.ok(sameX || sameY, `${def.id} entrance is not a straight perpendicular walk`);
  }
});

test('every threshold sits exactly on the arena bounds', () => {
  const onBounds = (p) =>
    p.x === ARENA.left || p.x === ARENA.right || p.y === ARENA.top || p.y === ARENA.bottom;
  for (const def of ENTRANCE_DEFS) {
    assert.ok(onBounds(def.threshold), `${def.id} threshold is not on the arena edge`);
  }
});

test('a door stays occupied until its entrant arrives, then frees up', () => {
  const farAway = { x: -10000, y: -10000 };
  const spawned = [];
  const controller = new EntranceController(
    () => farAway,
    0,
    (spawnX, spawnY, releaseX, releaseY) => {
      const entrant = { onEntranceArrived: null, spawnX, spawnY, releaseX, releaseY };
      spawned.push(entrant);
      return entrant;
    },
  );

  // Claim all three doors — one entrant per door, none repeating.
  withFixedRandom(0, () => {
    controller.spawnAt();
    controller.spawnAt();
    controller.spawnAt();
  });
  assert.equal(spawned.length, 3);
  assert.equal(new Set(ENTRANCE_DEFS.map((d) => d.id)).size, 3);
  for (const id of ENTRANCE_DEFS.map((d) => d.id)) {
    assert.ok(controller.isOccupied(id), `${id} should be occupied`);
  }

  // A fourth request finds every door busy and queues instead of spawning.
  controller.spawnAt();
  assert.equal(spawned.length, 3);
  assert.equal(controller.queuedCount, 1);

  // The first entrant reaches its release point — its door frees, and the
  // queued request immediately spawns through it.
  spawned[0].onEntranceArrived();
  assert.equal(spawned.length, 4);
  assert.equal(controller.queuedCount, 0);
  assert.equal(spawned[3].spawnX, spawned[0].spawnX);
  assert.equal(spawned[3].spawnY, spawned[0].spawnY);
});

test('a door too close to the player is skipped without spawning or queueing', () => {
  const leftDoor = ENTRANCE_DEFS.find((d) => d.id === 'left');
  const spawnCalls = [];
  const controller = new EntranceController(
    () => leftDoor.spawnPoint,
    9999,
    (spawnX, spawnY, releaseX, releaseY) => {
      spawnCalls.push({ spawnX, spawnY, releaseX, releaseY });
      return { onEntranceArrived: null };
    },
  );

  controller.spawnAt();
  assert.equal(spawnCalls.length, 0);
  assert.equal(controller.queuedCount, 0);
});

test('chained onEntranceArrived callbacks are composed, not overwritten', () => {
  let originalCalled = false;
  let entrant;
  const controller = new EntranceController(
    () => ({ x: -10000, y: -10000 }),
    0,
    () => {
      entrant = {
        onEntranceArrived: () => {
          originalCalled = true;
        },
      };
      return entrant;
    },
  );

  controller.spawnAt();
  const occupiedId = ENTRANCE_DEFS.find((d) => controller.isOccupied(d.id)).id;

  entrant.onEntranceArrived();
  assert.ok(originalCalled, 'the factory-supplied callback must still run');
  assert.ok(!controller.isOccupied(occupiedId), 'the door must free up after arrival');
});
