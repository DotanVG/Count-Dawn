import assert from 'node:assert/strict';
import test from 'node:test';
import { selectPixelScale } from '../src/game/pixelScalePolicy.ts';

const decide = (width, height) => selectPixelScale(width, height, 1280, 720);

test('uses exact integer scales at and above the internal resolution', () => {
  assert.deepEqual(decide(1280, 720), {
    scale: 1,
    displayWidth: 1280,
    displayHeight: 720,
    mode: 'integer-upscale',
    downscaleDivisor: null,
  });
  assert.equal(decide(1917, 1078).scale, 1);
  assert.equal(decide(2560, 1440).scale, 2);
  assert.equal(decide(3840, 2160).scale, 3);
});

test('letterboxes rather than selecting a fractional upscale', () => {
  const decision = decide(1536, 864);
  assert.equal(decision.scale, 1);
  assert.equal(decision.displayWidth, 1280);
  assert.equal(decision.displayHeight, 720);
  assert.equal(decision.mode, 'integer-upscale');
});

test('uses exact reciprocal scales when a mobile viewport is smaller than the render', () => {
  assert.deepEqual(decide(844, 390), {
    scale: 0.5,
    displayWidth: 640,
    displayHeight: 360,
    mode: 'reciprocal-downscale',
    downscaleDivisor: 2,
  });
  assert.deepEqual(decide(568, 320), {
    scale: 0.25,
    displayWidth: 320,
    displayHeight: 180,
    mode: 'reciprocal-downscale',
    downscaleDivisor: 4,
  });
});

test('always returns finite whole CSS display dimensions', () => {
  for (const [width, height] of [
    [0, 0],
    [Number.NaN, Number.POSITIVE_INFINITY],
    [1170, 658],
    [1917, 1078],
  ]) {
    const decision = decide(width, height);
    assert.ok(Number.isFinite(decision.scale));
    assert.ok(Number.isInteger(decision.displayWidth));
    assert.ok(Number.isInteger(decision.displayHeight));
  }
});
