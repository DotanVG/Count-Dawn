import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bossLineupForNight,
  captainCountForNight,
  throwerCapForNight,
} from '../src/data/balance.ts';

test('captain squads gain one member every five nights', () => {
  assert.equal(captainCountForNight(1), 1);
  assert.equal(captainCountForNight(4), 1);
  assert.equal(captainCountForNight(5), 2);
  assert.equal(captainCountForNight(9), 2);
  assert.equal(captainCountForNight(10), 3);
  assert.equal(captainCountForNight(15), 4);
});

test('every fifth night sends the Priest in place of a Captain slot', () => {
  // Nights that are not multiples of five are unchanged.
  assert.deepEqual(bossLineupForNight(1), { priests: 0, captains: 1 });
  assert.deepEqual(bossLineupForNight(4), { priests: 0, captains: 1 });
  assert.deepEqual(bossLineupForNight(6), { priests: 0, captains: 2 });
  // He takes the step up the night was going to make AND the slot it added.
  assert.deepEqual(bossLineupForNight(5), { priests: 1, captains: 0 });
  assert.deepEqual(bossLineupForNight(10), { priests: 1, captains: 1 });
  assert.deepEqual(bossLineupForNight(15), { priests: 1, captains: 2 });
});

test('a Priest night is never bigger than the Captain night it replaces', () => {
  for (let night = 1; night <= 40; night++) {
    const { priests, captains } = bossLineupForNight(night);
    assert.ok(priests + captains <= captainCountForNight(night));
    assert.ok(priests + captains >= 1, `night ${night} must still send a boss`);
  }
});

test('all garlic throwers share a hard cap of five', () => {
  assert.equal(throwerCapForNight(1), 1);
  assert.equal(throwerCapForNight(3), 3);
  assert.equal(throwerCapForNight(5), 5);
  assert.equal(throwerCapForNight(10), 5);
});
