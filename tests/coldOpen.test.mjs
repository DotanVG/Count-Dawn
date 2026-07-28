import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COLD_OPEN,
  COLD_OPEN_CAPTAIN_STATS,
  COLD_OPEN_CENTER,
  COLD_OPEN_MARCH_SPEED,
  COLD_OPEN_PRIEST_STATS,
  COLD_OPEN_THROWER_STATS,
  coldOpenRingSlot,
  coldOpenSlotActor,
  coldOpenSlotIsThrower,
  coldOpenTimerSeconds,
  coldOpenSkyProgress,
} from '../src/systems/coldOpen.ts';
import { BOSS, HUNTER, PRIEST, THROWER } from '../src/data/balance.ts';
import { ARENA, GAME_WIDTH, GAME_HEIGHT } from '../src/game/constants.ts';

test('the cold open clock opens on the full countdown', () => {
  assert.equal(coldOpenTimerSeconds(0), COLD_OPEN.startSeconds);
});

test('the clock reads exactly one second as the lid shuts', () => {
  assert.equal(coldOpenTimerSeconds(COLD_OPEN.coffinShutMs), COLD_OPEN.minSeconds);
});

test('the clock never reaches zero, at any elapsed time', () => {
  // Every millisecond of the scene itself...
  for (let ms = 0; ms <= COLD_OPEN.coffinShutMs; ms++) {
    const seconds = coldOpenTimerSeconds(ms);
    assert.ok(seconds >= COLD_OPEN.minSeconds, `hit ${seconds} at ${ms}ms`);
  }

  // ...and well past it, which is where a slow or backgrounded machine ends
  // up: tab throttling can hand the scene one enormous delta, and the scene
  // must still not show the Count being caught by the sunrise.
  for (const ms of [COLD_OPEN.coffinShutMs + 1, 20_000, 60_000, 3_600_000, Number.MAX_SAFE_INTEGER]) {
    assert.equal(coldOpenTimerSeconds(ms), COLD_OPEN.minSeconds, `at ${ms}ms`);
  }
});

test('the clock only ever counts down', () => {
  let previous = Infinity;
  for (let ms = 0; ms <= COLD_OPEN.coffinShutMs; ms += 10) {
    const seconds = coldOpenTimerSeconds(ms);
    assert.ok(seconds <= previous, `went up to ${seconds} at ${ms}ms`);
    previous = seconds;
  }
});

test('the clock counts down in real lockstep, not faster than elapsed time', () => {
  // One displayed second per 1000ms elapsed - the whole point of the fix:
  // the clock used to run noticeably faster than a real clock beside it.
  const span = COLD_OPEN.startSeconds - COLD_OPEN.minSeconds;
  const rate = span / COLD_OPEN.coffinShutMs; // displayed-seconds per ms
  assert.ok(
    Math.abs(rate - 1 / 1000) < 1e-9,
    `clock runs at ${(rate * 1000).toFixed(3)}x real time, not 1.0x`,
  );
});

test('the beats stage in the order the scene needs them', () => {
  // He is on his feet before he speaks, and the ring is already closing in by
  // then - some of them have the longest walk of anything in the scene.
  assert.ok(COLD_OPEN.huntersInMs < COLD_OPEN.lineStartMs);
  assert.ok(COLD_OPEN.flyInMs <= COLD_OPEN.lineStartMs);
  // The line is gone (or forcibly cleared) before the demo fires.
  assert.ok(COLD_OPEN.lineStartMs < COLD_OPEN.demoMs);
  // The kill lands after the summon pose and the flash, and before blood starts.
  const killAt = COLD_OPEN.demoMs + COLD_OPEN.demoSummonMs + COLD_OPEN.demoStrikeMs;
  assert.ok(killAt <= COLD_OPEN.bloodStartMs, 'blood starts flying before the kill lands');

  // The last bloodlet has to arrive before he leaves for the coffin, or the
  // meter would still be filling while he is already asleep.
  const lastBloodletAt =
    COLD_OPEN.bloodStartMs +
    (COLD_OPEN.bloodlets - 1) * COLD_OPEN.bloodletStaggerMs +
    COLD_OPEN.bloodletFlightMs;
  assert.ok(lastBloodletAt <= COLD_OPEN.toCoffinMs, `bloodlets still arriving at ${lastBloodletAt}ms`);

  // And the flight has to actually be over when the lid shuts.
  assert.equal(COLD_OPEN.toCoffinMs + COLD_OPEN.coffinFlightMs, COLD_OPEN.coffinShutMs);
});

test('the whole cold open fits inside its own countdown', () => {
  assert.ok(
    COLD_OPEN.coffinShutMs <= COLD_OPEN.startSeconds * 1000,
    `cold open runs ${COLD_OPEN.coffinShutMs}ms against a ${COLD_OPEN.startSeconds}s clock`,
  );
});

test('the sky reaches the edge of sunrise but never dawn', () => {
  assert.ok(coldOpenSkyProgress(0) > 0.5);
  for (let ms = 0; ms <= COLD_OPEN.coffinShutMs; ms += 50) {
    const p = coldOpenSkyProgress(ms);
    assert.ok(p >= 0 && p < 1, `sky progress ${p} at ${ms}ms`);
  }
  assert.ok(coldOpenSkyProgress(COLD_OPEN.coffinShutMs) > 0.9);
  // Clamped past the end, same as the clock.
  assert.ok(coldOpenSkyProgress(999_999) < 1);
});

test('every actor is standing in its ring slot before the Ultimate demo fires', () => {
  // They walk in at the ring's marching pace and the demo does not wait.
  // This margin is asserted rather than eyeballed, same as the old block
  // formation's version of this test.
  for (let i = 0; i < COLD_OPEN.hunterCount; i++) {
    const { spawn, arrival } = coldOpenRingSlot(i, COLD_OPEN.hunterCount);
    const distance = Math.hypot(spawn.x - arrival.x, spawn.y - arrival.y);
    const inPlaceAt = COLD_OPEN.huntersInMs + (distance / COLD_OPEN_MARCH_SPEED) * 1000;
    assert.ok(
      inPlaceAt <= COLD_OPEN.demoMs,
      `actor ${i} (${coldOpenSlotActor(i)}) is still walking at the demo (in place at ${Math.round(inPlaceAt)}ms)`,
    );
  }
});

test('the ring stands inside the hall, and every actor enters from off-canvas', () => {
  for (let i = 0; i < COLD_OPEN.hunterCount; i++) {
    const { spawn, arrival } = coldOpenRingSlot(i, COLD_OPEN.hunterCount);
    assert.ok(arrival.x > ARENA.left && arrival.x < ARENA.right, `actor ${i} stands outside the hall`);
    assert.ok(arrival.y > ARENA.top && arrival.y < ARENA.bottom, `actor ${i} stands outside the hall`);
    // Off the canvas entirely to start (any of the four sides), so each one
    // walks into view instead of appearing already on screen.
    const offCanvas = spawn.x < 0 || spawn.x > GAME_WIDTH || spawn.y < 0 || spawn.y > GAME_HEIGHT;
    assert.ok(offCanvas, `actor ${i} pops into the open hall from (${spawn.x}, ${spawn.y})`);
  }
});

test('the ring surrounds him from every side, not one flank', () => {
  // A genuine surround has entrants spread across all four quadrants around
  // the centre, not clustered into the one corner a single-flank formation
  // used to enter from.
  const quadrants = new Set();
  for (let i = 0; i < COLD_OPEN.hunterCount; i++) {
    const { spawn } = coldOpenRingSlot(i, COLD_OPEN.hunterCount);
    const right = spawn.x >= COLD_OPEN_CENTER.x;
    const below = spawn.y >= COLD_OPEN_CENTER.y;
    quadrants.add(`${right}-${below}`);
  }
  assert.equal(quadrants.size, 4, 'the ring does not reach all four sides of the hall');
});

test('the ring is evenly spaced around one shared centre', () => {
  const radii = [];
  for (let i = 0; i < COLD_OPEN.hunterCount; i++) {
    const { arrival } = coldOpenRingSlot(i, COLD_OPEN.hunterCount);
    radii.push(Math.hypot(arrival.x - COLD_OPEN_CENTER.x, arrival.y - COLD_OPEN_CENTER.y));
  }
  for (const r of radii) {
    assert.ok(Math.abs(r - COLD_OPEN.ringRadius) < 1, `arrival radius ${r} does not match ringRadius`);
  }
});

test('the roster includes every kind of enemy the player will actually face', () => {
  const kinds = new Set();
  for (let i = 0; i < COLD_OPEN.hunterCount; i++) kinds.add(coldOpenSlotActor(i));
  for (const expected of [
    'priest',
    'pilgrim',
    'huntress',
    'spike',
    'pitchfork',
    'torch',
    'thrower',
    'hunterCaptain',
    'garlicCaptain',
    'crossCaptain',
  ]) {
    assert.ok(kinds.has(expected), `roster is missing ${expected}`);
  }
});

test('the roster is mixed: both melee and ranged flavours actually turn up', () => {
  const slots = [...Array(COLD_OPEN.hunterCount).keys()];
  const throwers = slots.filter(coldOpenSlotIsThrower);
  const others = slots.filter((i) => !coldOpenSlotIsThrower(i));
  assert.ok(throwers.length > 0, 'no ranged actors in the cold open');
  assert.ok(others.length > 0, 'no melee actors in the cold open');
});

test('the whole ring marches at one shared pace, not any flavour own', () => {
  // The override exists for one reason, so state it for every overridden
  // flavour: at its own pace it is still walking when the demo fires.
  assert.equal(COLD_OPEN_MARCH_SPEED, HUNTER.moveSpeed);

  assert.ok(THROWER.moveSpeed < COLD_OPEN_MARCH_SPEED);
  assert.equal(COLD_OPEN_THROWER_STATS.moveSpeed, COLD_OPEN_MARCH_SPEED);
  assert.equal(COLD_OPEN_THROWER_STATS.health, THROWER.health);
  assert.equal(COLD_OPEN_THROWER_STATS.contactDamage, THROWER.contactDamage);

  assert.ok(PRIEST.moveSpeed < COLD_OPEN_MARCH_SPEED);
  assert.equal(COLD_OPEN_PRIEST_STATS.moveSpeed, COLD_OPEN_MARCH_SPEED);
  assert.equal(COLD_OPEN_PRIEST_STATS.health, PRIEST.health);

  assert.ok(BOSS.moveSpeed < COLD_OPEN_MARCH_SPEED);
  assert.equal(COLD_OPEN_CAPTAIN_STATS.moveSpeed, COLD_OPEN_MARCH_SPEED);
  assert.equal(COLD_OPEN_CAPTAIN_STATS.health, BOSS.health);

  // Unlike the old single-flank block (every thrower equally far in one back
  // column), a ring scatters throwers at a MIX of distances - some slots
  // would arrive in time even at their own slower pace. The override still
  // has to matter for at least the farthest one, or it would be dead weight
  // everywhere.
  const throwerSlots = [...Array(COLD_OPEN.hunterCount).keys()].filter(coldOpenSlotIsThrower);
  const distanceOf = (i) => {
    const { spawn, arrival } = coldOpenRingSlot(i, COLD_OPEN.hunterCount);
    return Math.hypot(spawn.x - arrival.x, spawn.y - arrival.y);
  };
  const farthest = throwerSlots.reduce((a, b) => (distanceOf(a) >= distanceOf(b) ? a : b));
  const atOwnPace = COLD_OPEN.huntersInMs + (distanceOf(farthest) / THROWER.moveSpeed) * 1000;
  assert.ok(
    atOwnPace > COLD_OPEN.demoMs,
    `even the farthest thrower would have made it at its own pace - the speed override is dead weight`,
  );
});
