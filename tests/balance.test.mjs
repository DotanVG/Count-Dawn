import test from 'node:test';
import assert from 'node:assert/strict';
import {
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

test('all garlic throwers share a hard cap of five', () => {
  assert.equal(throwerCapForNight(1), 1);
  assert.equal(throwerCapForNight(3), 3);
  assert.equal(throwerCapForNight(5), 5);
  assert.equal(throwerCapForNight(10), 5);
});
