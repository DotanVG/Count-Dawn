import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COLD_OPEN,
  COLD_OPEN_GROUP,
  COLD_OPEN_MARCH_SPEED,
  COLD_OPEN_STRIKE_SPOT,
  COLD_OPEN_THROWER_STATS,
  coldOpenHunterSlot,
  coldOpenSlotIsThrower,
  coldOpenTimerSeconds,
  coldOpenSkyProgress,
} from '../src/systems/coldOpen.ts';
import { HUNTER, THROWER } from '../src/data/balance.ts';
import { ARENA } from '../src/game/constants.ts';

test('the cold open clock opens on the full ten seconds', () => {
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
  for (const ms of [COLD_OPEN.coffinShutMs + 1, 10_000, 60_000, 3_600_000, Number.MAX_SAFE_INTEGER]) {
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

test('the beats stage in the order the scene needs them', () => {
  // He is on his feet before he speaks, and the hunters are already on their
  // way in by then - they have the longest walk of anything in the scene.
  assert.ok(COLD_OPEN.huntersInMs < COLD_OPEN.lineStartMs);
  assert.ok(COLD_OPEN.flyInMs <= COLD_OPEN.lineStartMs);

  // He crosses to the group and has LANDED before he swings at it.
  assert.ok(COLD_OPEN.lineStartMs < COLD_OPEN.toGroupMs);
  assert.ok(
    COLD_OPEN.toGroupMs + COLD_OPEN.groupFlightMs <= COLD_OPEN.strikeMs,
    'the strike lands while he is still crossing the hall',
  );

  // The last bloodlet has to arrive before he leaves for the coffin, or the
  // meter would still be filling while he is already asleep.
  const lastBloodletAt =
    COLD_OPEN.bloodStartMs +
    (COLD_OPEN.bloodlets - 1) * COLD_OPEN.bloodletStaggerMs +
    COLD_OPEN.bloodletFlightMs;
  assert.ok(COLD_OPEN.strikeMs <= COLD_OPEN.bloodStartMs);
  assert.ok(lastBloodletAt <= COLD_OPEN.toCoffinMs, `bloodlets still arriving at ${lastBloodletAt}ms`);

  // And the flight has to actually be over when the lid shuts.
  assert.equal(COLD_OPEN.toCoffinMs + COLD_OPEN.coffinFlightMs, COLD_OPEN.coffinShutMs);
});

test('the whole cold open fits inside its ten seconds', () => {
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

test('every hunter is standing in place before the strike lands', () => {
  // They walk in at an ordinary hunter's pace and the strike does not wait.
  // This margin is thin by design - the scene has ten seconds - so it is
  // asserted rather than eyeballed.
  for (let i = 0; i < COLD_OPEN.hunterCount; i++) {
    const { spawn, arrival } = coldOpenHunterSlot(i);
    const distance = Math.hypot(spawn.x - arrival.x, spawn.y - arrival.y);
    const inPlaceAt = COLD_OPEN.huntersInMs + (distance / COLD_OPEN_MARCH_SPEED) * 1000;
    assert.ok(
      inPlaceAt <= COLD_OPEN.strikeMs,
      `hunter ${i} is still walking at the strike (in place at ${Math.round(inPlaceAt)}ms)`,
    );
  }
});

test('the hunters stand inside the hall, and enter from behind the wall', () => {
  for (let i = 0; i < COLD_OPEN.hunterCount; i++) {
    const { spawn, arrival } = coldOpenHunterSlot(i);
    assert.ok(arrival.x > ARENA.left && arrival.x < ARENA.right, `hunter ${i} stands outside the hall`);
    assert.ok(arrival.y > ARENA.top && arrival.y < ARENA.bottom, `hunter ${i} stands outside the hall`);
    // Off the playfield to start, so they walk into view instead of appearing.
    assert.ok(spawn.x > ARENA.right, `hunter ${i} pops into the open hall`);
  }
});

test('the squad is mixed, with the ranged row standing behind the swords', () => {
  const slots = [...Array(COLD_OPEN.hunterCount).keys()];
  const throwers = slots.filter(coldOpenSlotIsThrower);
  const swords = slots.filter((i) => !coldOpenSlotIsThrower(i));

  // Both types actually turn up - a squad of one kind is not a mixed squad.
  assert.ok(throwers.length > 0, 'no throwers in the cold open');
  assert.ok(swords.length > 0, 'no swordsmen in the cold open');

  // And every thrower stands further from the Count than every swordsman, so
  // the ranged row reads as the back of the block rather than salt scattered
  // through it.
  const reach = (i) => coldOpenHunterSlot(i).arrival.x - COLD_OPEN_STRIKE_SPOT.x;
  const nearestThrower = Math.min(...throwers.map(reach));
  const furthestSword = Math.max(...swords.map(reach));
  assert.ok(nearestThrower > furthestSword, 'a thrower is standing in the sword line');
});

test('the whole squad marches at the swordsmen pace, not the throwers own', () => {
  // The override exists for one reason, so state it: at his own pace a
  // thrower is still walking when the strike lands.
  assert.ok(THROWER.moveSpeed < COLD_OPEN_MARCH_SPEED);
  assert.equal(COLD_OPEN_MARCH_SPEED, HUNTER.moveSpeed);
  assert.equal(COLD_OPEN_THROWER_STATS.moveSpeed, COLD_OPEN_MARCH_SPEED);
  // Everything else about him is untouched - this is a cutscene actor, not a
  // rebalanced enemy.
  assert.equal(COLD_OPEN_THROWER_STATS.health, THROWER.health);
  assert.equal(COLD_OPEN_THROWER_STATS.contactDamage, THROWER.contactDamage);

  for (const i of [...Array(COLD_OPEN.hunterCount).keys()].filter(coldOpenSlotIsThrower)) {
    const { spawn, arrival } = coldOpenHunterSlot(i);
    const distance = Math.hypot(spawn.x - arrival.x, spawn.y - arrival.y);
    const atOwnPace = COLD_OPEN.huntersInMs + (distance / THROWER.moveSpeed) * 1000;
    assert.ok(
      atOwnPace > COLD_OPEN.strikeMs,
      `thrower ${i} would have made it anyway - the speed override is dead weight`,
    );
  }
});

test('the block is filled, with no ragged last row', () => {
  assert.equal(COLD_OPEN.hunterCount % COLD_OPEN.columns, 0);
});

test('the Count strikes from beside the group, not on top of it', () => {
  const gap = COLD_OPEN_GROUP.x - COLD_OPEN_STRIKE_SPOT.x;
  assert.ok(gap > 0, 'he lands on the wrong side of the group');
  assert.ok(gap < 260, 'he lands too far away for the strike to read');
  assert.ok(COLD_OPEN_STRIKE_SPOT.x > ARENA.left);
});
