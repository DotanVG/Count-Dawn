import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_AUDIO_BALANCE,
  assetVolume,
  clamp01,
  effectiveMusicVolume,
  effectiveSfxVolume,
  effectiveVolume,
  normalizeBalance,
} from '../src/data/audioBalance.ts';
import { AUDIO } from '../src/utils/assetKeys.ts';

function balance(overrides = {}) {
  return {
    ...DEFAULT_AUDIO_BALANCE,
    assets: { ...DEFAULT_AUDIO_BALANCE.assets },
    ...overrides,
  };
}

test('music volume is master * music group * individual level', () => {
  const config = balance({ master: 0.5, music: 0.5, assets: { [AUDIO.mainTitle]: 0.5 } });

  assert.equal(effectiveMusicVolume(config, AUDIO.mainTitle), 0.125);
});

test('sfx volume is master * sfx group * individual level', () => {
  const config = balance({ master: 1, sfx: 0.5, assets: { [AUDIO.playerAttackWhoosh]: 0.4 } });

  assert.equal(effectiveSfxVolume(config, AUDIO.playerAttackWhoosh), 0.2);
});

test('the two groups are independent — music sliders never touch sfx', () => {
  const config = balance({ master: 1, music: 0, sfx: 1 });

  assert.equal(effectiveMusicVolume(config, AUDIO.levelMusic), 0);
  assert.ok(effectiveSfxVolume(config, AUDIO.bloodPickup) > 0);
});

test('effectiveVolume routes each key through its own group', () => {
  const config = balance({ master: 1, music: 1, sfx: 0, assets: { [AUDIO.levelMusic]: 1 } });

  assert.equal(effectiveVolume(config, AUDIO.levelMusic), 1);
  assert.equal(effectiveVolume(config, AUDIO.playerAttackWhoosh), 0);
});

test('every factor and the result are clamped to 0..1', () => {
  assert.equal(clamp01(-3), 0);
  assert.equal(clamp01(4), 1);
  assert.equal(clamp01(Number.NaN), 0);
  assert.equal(clamp01(0.42), 0.42);

  const loud = balance({ master: 9, music: 9, assets: { [AUDIO.mainTitle]: 9 } });
  assert.equal(effectiveMusicVolume(loud, AUDIO.mainTitle), 1);

  const negative = balance({ master: -2, assets: { [AUDIO.mainTitle]: -2 } });
  assert.equal(effectiveMusicVolume(negative, AUDIO.mainTitle), 0);
});

test('an unknown key falls back to a full individual level, not silence', () => {
  const config = balance({ master: 1, sfx: 1 });

  assert.equal(assetVolume(config, 'sfx-does-not-exist'), 1);
});

test('an incomplete saved config keeps the fields it does have', () => {
  const restored = normalizeBalance({ master: 0.25, assets: { [AUDIO.levelMusic]: 0.1 } });

  assert.equal(restored.master, 0.25);
  assert.equal(restored.assets[AUDIO.levelMusic], 0.1);
  // Missing fields take the defaults rather than collapsing to zero.
  assert.equal(restored.music, DEFAULT_AUDIO_BALANCE.music);
  assert.equal(restored.sfx, DEFAULT_AUDIO_BALANCE.sfx);
  assert.equal(restored.muted, false);
  assert.equal(
    restored.assets[AUDIO.mainTitle],
    DEFAULT_AUDIO_BALANCE.assets[AUDIO.mainTitle],
  );
});

test('garbage saved data falls back to the defaults instead of throwing', () => {
  for (const raw of [null, undefined, 'nope', 7, [], { assets: 'broken' }]) {
    const restored = normalizeBalance(raw);
    assert.equal(restored.master, DEFAULT_AUDIO_BALANCE.master);
    assert.equal(restored.music, DEFAULT_AUDIO_BALANCE.music);
    assert.equal(restored.sfx, DEFAULT_AUDIO_BALANCE.sfx);
    assert.deepEqual(restored.assets, DEFAULT_AUDIO_BALANCE.assets);
  }
});

test('out-of-range and non-numeric saved values are repaired per field', () => {
  const restored = normalizeBalance({
    master: 5,
    music: 'loud',
    sfx: -1,
    muted: 'yes',
    assets: { [AUDIO.mainTitle]: 12, [AUDIO.levelMusic]: null },
  });

  assert.equal(restored.master, 1);
  assert.equal(restored.music, DEFAULT_AUDIO_BALANCE.music);
  assert.equal(restored.sfx, 0);
  assert.equal(restored.muted, false);
  assert.equal(restored.assets[AUDIO.mainTitle], 1);
  assert.equal(restored.assets[AUDIO.levelMusic], DEFAULT_AUDIO_BALANCE.assets[AUDIO.levelMusic]);
});

test('normalizing drops keys the manifest does not know about', () => {
  const restored = normalizeBalance({ assets: { 'sfx-from-a-future-build': 0.3 } });

  assert.equal(restored.assets['sfx-from-a-future-build'], undefined);
});
