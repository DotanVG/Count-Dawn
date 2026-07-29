import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_GAME_SETTINGS,
  compactGameSettings,
  normalizeGameSettings,
  shouldShowCursorSettings,
} from '../src/data/gameSettings.ts';

test('game settings reject corrupt values and clamp numeric ranges', () => {
  assert.deepEqual(normalizeGameSettings(null), DEFAULT_GAME_SETTINGS);
  assert.deepEqual(
    normalizeGameSettings({
      redBlindPalette: true,
      cursorScale: 99,
      cursorSpeed: -2,
    }),
    {
      redBlindPalette: true,
      cursorScale: 2,
      cursorSpeed: 0.25,
    },
  );
  assert.deepEqual(
    normalizeGameSettings({
      cursorScale: 99,
      cursorSpeed: 99,
    }),
    {
      ...DEFAULT_GAME_SETTINGS,
      cursorScale: 2,
      cursorSpeed: 2,
    },
  );
});

test('game settings persistence omits defaults and removes an empty save', () => {
  assert.equal(compactGameSettings({ ...DEFAULT_GAME_SETTINGS }), null);
  assert.deepEqual(
    compactGameSettings({
      ...DEFAULT_GAME_SETTINGS,
      cursorScale: 1.25,
    }),
    { cursorScale: 1.25 },
  );
});

test('cursor settings exist on desktop and never enter the mobile UI tree', () => {
  assert.equal(shouldShowCursorSettings(false), true);
  assert.equal(shouldShowCursorSettings(true), false);
});
