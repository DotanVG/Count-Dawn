import assert from 'node:assert/strict';
import test from 'node:test';
import { installDeferredStart, prepareLandingStart, enterGameShell } from '../src/game/landing.ts';

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
  const game = { events: { listenerCount: () => 0 }, input: { keyboard: { preventDefault: true } }, scale: { refresh: () => refreshes++ } };
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

test('deferred entry waits once, unlocks audio in the gesture, and uses the menu callback', async () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const calls = [];
  const attributes = new Map();
  let finish;
  let canvasClick;
  const button = {
    disabled: true,
    setAttribute: (key, value) => attributes.set(key, value),
    removeAttribute: key => attributes.delete(key),
  };
  const status = {};
  const game = { events: { listenerCount: () => 1, emit: (name, start) => finish(start) } };
  globalThis.document = {
    documentElement: { classList: { contains: () => false } },
    getElementById: id => ({
      'landing-shell': {}, 'start-night': button, 'landing-status': status,
      'game-root': { addEventListener: (name, handler) => { canvasClick = handler; } },
    })[id],
  };
  globalThis.window = {
    AudioContext: class { resume() { calls.push('resume'); return Promise.resolve(); } },
    addEventListener() {},
  };
  try {
    installDeferredStart(async (context, progress) => {
      calls.push('load');
      assert.ok(context);
      assert.equal(button.disabled, true);
      assert.equal(attributes.get('aria-busy'), 'true');
      progress(0.5);
      return new Promise(resolve => { finish = resolve; });
    });
    assert.deepEqual(calls, [], 'no engine or audio work before entry');
    const loading = button.onclick();
    canvasClick();
    assert.deepEqual(calls, ['resume', 'load'], 'duplicate entry cannot boot twice');
    assert.match(status.textContent, /50%/);
    prepareLandingStart(game, () => calls.push('intro'));
    await loading;
    assert.deepEqual(calls, ['resume', 'load', 'intro']);
    assert.equal(attributes.has('aria-busy'), false);
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});

test('failed deferred load exposes a readable reload retry', async () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const button = { setAttribute() {}, removeAttribute() {} };
  const status = {};
  let reloaded = false;
  globalThis.document = {
    getElementById: id => ({ 'landing-shell': {}, 'start-night': button, 'landing-status': status })[id],
  };
  globalThis.window = { addEventListener() {}, location: { reload: () => { reloaded = true; } } };
  try {
    installDeferredStart(async () => { throw new Error('offline'); });
    await button.onclick();
    assert.match(status.textContent, /could not load/);
    assert.equal(button.disabled, false);
    assert.equal(button.textContent, 'Retry loading');
    button.onclick();
    assert.ok(reloaded);
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});
