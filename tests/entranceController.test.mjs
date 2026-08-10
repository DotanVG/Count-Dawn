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

test('the left door releases a hunter clear of the coffin — regression for the coffin-collision softlock', () => {
  // Mirrors GameScene's COFFIN_POS (150, 430) and Coffin.ts's own static
  // body (160x230 art at 0.55 scale), expanded by the largest actor on the
  // field (a Captain, ~27px collision radius at BOSS.spriteScale) plus the
  // same 8px clearance coffinDetourWaypoints itself uses. A release point
  // inside this box is exactly the bug: collision re-arms already
  // overlapping the coffin, and Arcade's separation fights the AI's own
  // steering instead of resolving.
  const coffin = { x: 150, y: 430, halfWidth: (160 * 0.55) / 2, halfHeight: (230 * 0.55) / 2 };
  const actorRadius = 27;
  const clearance = 8;
  const box = {
    left: coffin.x - coffin.halfWidth - actorRadius - clearance,
    right: coffin.x + coffin.halfWidth + actorRadius + clearance,
    top: coffin.y - coffin.halfHeight - actorRadius - clearance,
    bottom: coffin.y + coffin.halfHeight + actorRadius + clearance,
  };

  const left = ENTRANCE_DEFS.find((d) => d.id === 'left');
  const inside =
    left.releasePoint.x >= box.left &&
    left.releasePoint.x <= box.right &&
    left.releasePoint.y >= box.top &&
    left.releasePoint.y <= box.bottom;
  assert.ok(
    !inside,
    `left door releasePoint ${JSON.stringify(left.releasePoint)} lands inside the coffin's expanded box ${JSON.stringify(box)}`,
  );
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

test('ignoreProximity=true spawns even when the player is too close to every door — the night-10 boss-soft-lock regression', () => {
  // Reproduces the exact bug: a one-off arrival (a boss) gets exactly one
  // spawnAt() call, with nothing to retry it if a plain proximity check
  // silently drops it — GameScene.spawnBoss() calls flow.notifyBossSpawned()
  // regardless, leaving the "defeat the boss" objective permanently
  // unsatisfiable with zero actual bosses on the field.
  const anyPlayerPosition = { x: 640, y: 410 }; // doesn't matter where — the radius below covers the whole map
  const spawnCalls = [];
  const controller = new EntranceController(
    () => anyPlayerPosition,
    999999, // an absurdly large radius: every door is "too close" by this metric
    () => {
      const entrant = { onEntranceArrived: null };
      spawnCalls.push(entrant);
      return entrant;
    },
  );

  // A regular hunter spawn (no override) still respects proximity and is
  // correctly skipped — this must NOT regress.
  controller.spawnAt();
  assert.equal(spawnCalls.length, 0, 'a regular spawn must still honor the proximity gate');
  assert.equal(controller.queuedCount, 0, 'a proximity skip must not queue — the timer retries it, not the queue');

  // A boss-style spawn with ignoreProximity=true must succeed anyway.
  controller.spawnAt(undefined, true);
  assert.equal(spawnCalls.length, 1, 'a one-off arrival must not be silently dropped by player proximity');
});

test('a queued boss request replays with ignoreProximity still true once its door frees', () => {
  const farPlayer = { x: -10000, y: -10000 };
  const spawnedBy = [];
  const controller = new EntranceController(
    () => farPlayer,
    0,
    () => {
      const entrant = { onEntranceArrived: null };
      spawnedBy.push({ who: 'default', entrant });
      return entrant;
    },
  );
  const bossFactory = () => {
    const entrant = { onEntranceArrived: null };
    spawnedBy.push({ who: 'boss', entrant });
    return entrant;
  };

  withFixedRandom(0, () => {
    controller.spawnAt(); // door 1
    controller.spawnAt(); // door 2
    controller.spawnAt(); // door 3 — all full
    controller.spawnAt(bossFactory, true); // queues (occupancy, not proximity)
  });
  assert.equal(controller.queuedCount, 1);

  spawnedBy[0].entrant.onEntranceArrived();
  assert.equal(spawnedBy.length, 4);
  assert.equal(spawnedBy[3].who, 'boss');
});

test('spawnAt accepts a per-call factory override without disturbing the default', () => {
  const defaultSpawned = [];
  const overrideSpawned = [];
  const controller = new EntranceController(
    () => ({ x: -10000, y: -10000 }),
    0,
    (spawnX, spawnY, releaseX, releaseY) => {
      const entrant = { onEntranceArrived: null, kind: 'default' };
      defaultSpawned.push(entrant);
      return entrant;
    },
  );

  const bossFactory = (spawnX, spawnY, releaseX, releaseY) => {
    const entrant = { onEntranceArrived: null, kind: 'boss' };
    overrideSpawned.push(entrant);
    return entrant;
  };

  withFixedRandom(0, () => {
    controller.spawnAt(bossFactory);
    controller.spawnAt(); // default, must land on a different door
  });

  assert.equal(overrideSpawned.length, 1);
  assert.equal(defaultSpawned.length, 1);
});

test('a queued request replays with its OWN factory once a door frees, not the default one', () => {
  const spawnedBy = [];
  const controller = new EntranceController(
    () => ({ x: -10000, y: -10000 }),
    0,
    () => {
      const entrant = { onEntranceArrived: null };
      spawnedBy.push({ who: 'default', entrant });
      return entrant;
    },
  );

  const bossFactory = () => {
    const entrant = { onEntranceArrived: null };
    spawnedBy.push({ who: 'boss', entrant });
    return entrant;
  };

  withFixedRandom(0, () => {
    controller.spawnAt(); // occupies door 1
    controller.spawnAt(); // occupies door 2
    controller.spawnAt(); // occupies door 3 — all three now full
    controller.spawnAt(bossFactory); // every door busy: queues WITH its own factory
  });

  assert.equal(spawnedBy.length, 3);
  assert.equal(controller.queuedCount, 1);

  // Free one door — the queued request should drain using bossFactory, not the default.
  spawnedBy[0].entrant.onEntranceArrived();

  assert.equal(spawnedBy.length, 4);
  assert.equal(spawnedBy[3].who, 'boss');
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
