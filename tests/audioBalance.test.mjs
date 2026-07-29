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
import {
  audioAsset,
  shouldReverse,
  variedDetune,
  variedVolume,
} from '../src/data/audioManifest.ts';
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

test('music and sfx can be muted independently without losing their levels', () => {
  const musicOnly = balance({ music: 0.42, sfx: 0.63, musicMuted: true });
  assert.equal(effectiveMusicVolume(musicOnly, AUDIO.levelMusic), 0);
  assert.ok(effectiveSfxVolume(musicOnly, AUDIO.bloodPickup) > 0);

  const sfxOnly = { ...musicOnly, musicMuted: false, sfxMuted: true };
  assert.ok(effectiveMusicVolume(sfxOnly, AUDIO.levelMusic) > 0);
  assert.equal(effectiveSfxVolume(sfxOnly, AUDIO.bloodPickup), 0);

  const restored = { ...sfxOnly, sfxMuted: false };
  assert.equal(restored.music, 0.42);
  assert.equal(restored.sfx, 0.63);
  assert.ok(effectiveMusicVolume(restored, AUDIO.levelMusic) > 0);
  assert.ok(effectiveSfxVolume(restored, AUDIO.bloodPickup) > 0);
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
  assert.equal(restored.musicMuted, false);
  assert.equal(restored.sfxMuted, false);
  assert.equal(
    restored.assets[AUDIO.mainTitle],
    DEFAULT_AUDIO_BALANCE.assets[AUDIO.mainTitle],
  );
});

test('independent mute choices survive normalization and legacy mute-all migrates safely', () => {
  const split = normalizeBalance({ muted: false, musicMuted: true, sfxMuted: false });
  assert.equal(split.musicMuted, true);
  assert.equal(split.sfxMuted, false);

  const legacy = normalizeBalance({ muted: true });
  assert.equal(legacy.muted, true);
  assert.equal(legacy.musicMuted, true);
  assert.equal(legacy.sfxMuted, true);
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
  assert.equal(restored.musicMuted, false);
  assert.equal(restored.sfxMuted, false);
  assert.equal(restored.assets[AUDIO.mainTitle], 1);
  assert.equal(restored.assets[AUDIO.levelMusic], DEFAULT_AUDIO_BALANCE.assets[AUDIO.levelMusic]);
});

test('normalizing drops keys the manifest does not know about', () => {
  const restored = normalizeBalance({ assets: { 'sfx-from-a-future-build': 0.3 } });

  assert.equal(restored.assets['sfx-from-a-future-build'], undefined);
});

// ── Per-play variance ─────────────────────────────────────────────────────
// Each helper takes its own roll in [0, 1), so the spread is pinned at its
// edges rather than sampled and hoped for.

test('detune spans the full symmetric range and centres on no change', () => {
  const variance = { detuneCents: 220 };

  assert.equal(variedDetune(variance, 0), -220);
  assert.equal(variedDetune(variance, 0.5), 0);
  assert.ok(Math.abs(variedDetune(variance, 0.999) - 220) < 1);
});

test('volume jitter moves around the balanced level, never away from it', () => {
  const variance = { volumeJitter: 0.2 };

  assert.equal(variedVolume(0.5, variance, 0.5), 0.5);
  assert.equal(variedVolume(0.5, variance, 0), 0.4);
  assert.ok(Math.abs(variedVolume(0.5, variance, 0.999) - 0.6) < 0.001);
});

test('jitter can never push a sound past full scale', () => {
  // The editor's ceiling is 1.0; a lucky roll must not sneak past it.
  assert.equal(variedVolume(1, { volumeJitter: 0.5 }, 0.999), 1);
  assert.equal(variedVolume(0.01, { volumeJitter: 5 }, 0), 0);
});

test('a sound with no variance declared is played exactly as balanced', () => {
  assert.equal(variedVolume(0.42, undefined, 0), 0.42);
  assert.equal(variedVolume(0.42, {}, 0.999), 0.42);
  assert.equal(variedDetune(undefined, 0), 0);
  assert.equal(variedDetune({}, 0.999), 0);
  assert.equal(shouldReverse(undefined, 0), false);
  assert.equal(shouldReverse({}, 0), false);
});

test('reverse fires at its declared rate, and never when it is zero', () => {
  const variance = { reverseChance: 0.33 };

  assert.equal(shouldReverse(variance, 0), true);
  assert.equal(shouldReverse(variance, 0.32), true);
  assert.equal(shouldReverse(variance, 0.33), false);
  assert.equal(shouldReverse(variance, 0.9), false);
  assert.equal(shouldReverse({ reverseChance: 0 }, 0), false);
});

test('the attack whoosh actually declares variance, and stays inside sane bounds', () => {
  const whoosh = audioAsset(AUDIO.playerAttackWhoosh);
  const variance = whoosh.variance;

  assert.ok(variance, 'the whoosh is the one sound that repeats fastest');
  assert.equal(whoosh.defaultVolume, 0.32, 'the whoosh stays tucked under the attack');
  // Wide enough to hear, not so wide the swing changes weapon.
  assert.ok(variance.detuneCents > 0 && variance.detuneCents <= 400);
  assert.ok(variance.volumeJitter > 0 && variance.volumeJitter < 0.5);
  assert.ok(variance.reverseChance > 0 && variance.reverseChance < 1);

  // And the loudest possible roll still lands under the balanced ceiling.
  const loudest = variedVolume(
    effectiveSfxVolume(DEFAULT_AUDIO_BALANCE, AUDIO.playerAttackWhoosh),
    variance,
    0.999,
  );
  assert.ok(loudest <= 1);
});
