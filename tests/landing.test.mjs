import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareLandingStart, enterGameShell } from '../src/game/landing.ts';

test('native entry reuses the menu callback and hands focus to the game', () => {
  const classes = new Set();
  let starts = 0;
  let refreshes = 0;
  let focused = false;
  let scrolled = false;
  const elements = {
    'landing-shell': {},
    'start-night': { disabled: true },
    'landing-status': {},
    'game-root': { focus: () => { focused = true; } },
  };
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  globalThis.document = {
    documentElement: { classList: { contains: (key) => classes.has(key), add: (key) => classes.add(key) } },
    getElementById: (id) => elements[id],
  };
  globalThis.window = { scrollTo: () => { scrolled = true; } };
  const game = { input: { keyboard: { preventDefault: true } }, scale: { refresh: () => refreshes++ } };
  try {
    prepareLandingStart(game, () => starts++);
    assert.equal(elements['start-night'].disabled, false);
    assert.equal(game.input.keyboard.preventDefault, false);
    let stopped = false;
    elements['landing-shell'].onkeydown({ stopPropagation: () => { stopped = true; } });
    assert.ok(stopped, 'landing links and buttons keep native keyboard behavior');
    elements['start-night'].onclick();
    assert.equal(starts, 1);
    enterGameShell(game);
    assert.ok(classes.has('game-active'));
    assert.equal(game.input.keyboard.preventDefault, true);
    assert.equal(refreshes, 1);
    assert.ok(focused && scrolled);
    prepareLandingStart(game, () => starts++);
    assert.equal(game.input.keyboard.preventDefault, true, 'returning to the canvas menu keeps game input');
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});
