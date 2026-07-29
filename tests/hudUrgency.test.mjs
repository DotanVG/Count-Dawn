import assert from 'node:assert/strict';
import test from 'node:test';

import {
  countdownUrgencyCue,
  wrathOrbitParticleCount,
} from '../src/ui/hudUrgency.ts';

test('countdown screen flashes on the authored warning beats', () => {
  const flashed = [];
  for (let second = 12; second >= 0; second -= 1) {
    if (countdownUrgencyCue(second).screenFlash) flashed.push(second);
  }
  assert.deepEqual(flashed, [10, 5, 3, 2, 1, 0]);
});

test('last two complete seconds add a halfway screen flash', () => {
  assert.equal(countdownUrgencyCue(3).followUpFlashDelayMs, null);
  assert.equal(countdownUrgencyCue(2).followUpFlashDelayMs, 500);
  assert.equal(countdownUrgencyCue(1).followUpFlashDelayMs, 500);
  assert.equal(countdownUrgencyCue(0).followUpFlashDelayMs, null);
});

test('timer doubles briefly for each of the final five seconds', () => {
  assert.equal(countdownUrgencyCue(6).timerPopScale, 1.3);
  for (let second = 5; second >= 0; second -= 1) {
    assert.equal(countdownUrgencyCue(second).timerPopScale, 2);
  }
});

test('Wrath earns one orbit particle per complete tenth and twenty at full', () => {
  assert.equal(wrathOrbitParticleCount(0), 0);
  assert.equal(wrathOrbitParticleCount(0.09), 0);
  assert.equal(wrathOrbitParticleCount(0.1), 1);
  assert.equal(wrathOrbitParticleCount(0.6), 6);
  assert.equal(wrathOrbitParticleCount(0.9), 9);
  assert.equal(wrathOrbitParticleCount(0.999), 9);
  assert.equal(wrathOrbitParticleCount(1), 20);
  assert.equal(wrathOrbitParticleCount(4), 20);
});
