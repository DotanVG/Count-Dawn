import assert from 'node:assert/strict';
import test from 'node:test';

import {
  POLISH,
  resolvePolishProfile,
  scaledParticleCount,
} from '../src/data/polish.ts';

test('high desktop polish enables short event-driven effects', () => {
  const profile = resolvePolishProfile({
    quality: 'high',
    isTouch: false,
    reducedMotion: false,
  });

  assert.equal(profile.enableCameraShake, true);
  assert.equal(profile.enableHitStop, true);
  assert.equal(profile.enableAmbientParticles, true);
  assert.equal(profile.enableExpensiveFx, true);
  assert.equal(profile.maxActiveParticles, POLISH.particles.maxActive);
});

test('mobile profile caps particles, bolts, and expensive full-screen work', () => {
  const profile = resolvePolishProfile({
    quality: 'high',
    isTouch: true,
    reducedMotion: false,
  });

  assert.equal(profile.enableHitStop, false);
  assert.equal(profile.enableAmbientParticles, false);
  assert.equal(profile.enableExpensiveFx, false);
  assert.equal(profile.maxActiveParticles, POLISH.mobile.maxActiveParticles);
  assert.equal(profile.maxSimultaneousBolts, POLISH.mobile.maxSimultaneousBolts);
  assert.ok(profile.particleMultiplier < 1);
});

test('reduced motion preserves feedback while suppressing disruptive motion', () => {
  const profile = resolvePolishProfile({
    quality: 'high',
    isTouch: false,
    reducedMotion: true,
  });

  assert.equal(profile.enableCameraShake, true);
  assert.equal(profile.enableHitStop, false);
  assert.equal(profile.enableAmbientParticles, false);
  assert.ok(profile.cameraShakeMultiplier <= POLISH.reducedMotion.cameraShakeMultiplier);
  assert.ok(profile.zoomMultiplier < 1);
  assert.ok(profile.flashMultiplier < 1);
  assert.ok(scaledParticleCount(profile, 20) < 20);
});

test('minimal quality remains readable without ambient or motion-heavy extras', () => {
  const profile = resolvePolishProfile({
    quality: 'minimal',
    isTouch: false,
    reducedMotion: false,
  });

  assert.equal(profile.enableCameraShake, false);
  assert.equal(profile.enableHitStop, false);
  assert.equal(profile.enableAmbientParticles, false);
  assert.equal(profile.enableZoomPunch, false);
  assert.equal(scaledParticleCount(profile, 0), 0);
  assert.equal(scaledParticleCount(profile, 1), 1);
});
