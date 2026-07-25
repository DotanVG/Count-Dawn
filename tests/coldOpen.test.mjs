import test from 'node:test';
import assert from 'node:assert/strict';

import { COLD_OPEN, coldOpenTimerSeconds, coldOpenSkyProgress } from '../src/systems/coldOpen.ts';

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

test('every beat lands before the lid shuts, in staging order', () => {
  const beats = [
    COLD_OPEN.flyInMs,
    COLD_OPEN.lineStartMs,
    COLD_OPEN.huntersInMs,
    COLD_OPEN.strikeMs,
    COLD_OPEN.bloodStartMs,
    COLD_OPEN.toCoffinMs,
  ];
  for (let i = 1; i < beats.length; i++) {
    assert.ok(beats[i] >= beats[i - 1], `beat ${i} runs before the one before it`);
  }
  assert.ok(beats[beats.length - 1] < COLD_OPEN.coffinShutMs);

  // The last bloodlet has to land before he leaves for the coffin, or the
  // meter would still be filling while he is already asleep.
  const lastBloodletAt =
    COLD_OPEN.bloodStartMs +
    (COLD_OPEN.bloodlets - 1) * COLD_OPEN.bloodletStaggerMs +
    COLD_OPEN.bloodletFlightMs;
  assert.ok(lastBloodletAt <= COLD_OPEN.toCoffinMs, `bloodlets still arriving at ${lastBloodletAt}ms`);

  // And the flight has to actually be over when the lid shuts.
  assert.equal(COLD_OPEN.toCoffinMs + COLD_OPEN.coffinFlightMs, COLD_OPEN.coffinShutMs);
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
