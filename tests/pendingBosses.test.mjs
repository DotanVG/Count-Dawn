import assert from 'node:assert/strict';
import test from 'node:test';

import { EntranceController } from '../src/systems/EntranceController.ts';
import { PendingBossLineup, bossRosterNames } from '../src/systems/pendingBosses.ts';

function withFixedRandom(value, fn) {
  const original = Math.random;
  Math.random = () => value;
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

function makeEntrant(bucket) {
  let notify = null;
  const entrant = {
    onEntranceArrived: null,
    onceDestroyed(cb) {
      notify = cb;
    },
    destroy() {
      notify?.();
    },
  };
  bucket.push(entrant);
  return entrant;
}

test('the first boss kill does not finish a lineup that still has someone pending', () => {
  const lineup = new PendingBossLineup();
  assert.equal(lineup.begin(2), true);
  assert.equal(lineup.begin(2), false, 'a second booking must wait until this lineup is dead');
  assert.equal(lineup.defeat(), false);
  assert.equal(lineup.remaining, 1);
  assert.equal(lineup.defeat(), true);
  assert.equal(lineup.remaining, 0);
  assert.equal(lineup.defeat(), false, 'an extra kill must not report another victory');
});

test('reset clears a lineup so the next night can book again', () => {
  const lineup = new PendingBossLineup();
  lineup.begin(2);
  lineup.defeat();
  lineup.reset();
  assert.equal(lineup.remaining, 0);
  assert.equal(lineup.begin(1), true);
  assert.equal(lineup.defeat(), true);
});

test('an empty booking is refused', () => {
  const lineup = new PendingBossLineup();
  assert.equal(lineup.begin(0), false);
  assert.equal(lineup.remaining, 0);
  assert.equal(lineup.defeat(), false);
});

test('roster keeps entered names and still counts bosses waiting on a door', () => {
  assert.deepEqual(
    bossRosterNames([{ name: 'Huntress Captain', priest: false }], { priests: 1, captains: 1 }),
    ['Huntress Captain', 'Priest'],
  );
  assert.deepEqual(bossRosterNames([], { priests: 1, captains: 2 }), ['Priest', 'Captain', 'Captain']);
  assert.deepEqual(
    bossRosterNames(
      [
        { name: 'Priest', priest: true },
        { name: 'Garlic Captain', priest: false },
      ],
      { priests: 1, captains: 1 },
    ),
    ['Priest', 'Garlic Captain'],
  );
});

test('a boss still queued at a busy door blocks defeat until it has spawned and died', () => {
  const hunters = [];
  const bosses = [];
  const controller = new EntranceController(
    () => ({ x: -10000, y: -10000 }),
    0,
    () => makeEntrant(hunters),
  );
  const lineup = new PendingBossLineup();

  withFixedRandom(0, () => {
    controller.spawnAt();
    controller.spawnAt();
    controller.spawnAt();
  });
  assert.equal(lineup.begin(2), true);
  const bossFactory = () => makeEntrant(bosses);
  controller.spawnAt(bossFactory, true);
  controller.spawnAt(bossFactory, true);
  assert.equal(bosses.length, 0, 'both bosses wait while every door is occupied');
  assert.equal(controller.queuedCount, 2);

  // One hunter arrives. The first boss claims that door; the second stays queued.
  hunters[0].onEntranceArrived();
  assert.equal(bosses.length, 1);
  assert.equal(controller.queuedCount, 1);

  // Killing the boss who made it through must not finish the lineup, and must
  // hand the freed door to the boss still waiting.
  bosses[0].destroy();
  assert.equal(lineup.defeat(), false);
  assert.equal(bosses.length, 2);
  assert.equal(controller.queuedCount, 0);

  bosses[1].destroy();
  assert.equal(lineup.defeat(), true);
});
