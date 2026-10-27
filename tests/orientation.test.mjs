import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { installOrientationGate } from '../src/game/orientation.ts';
import { enterGameShell, prepareLandingStart } from '../src/game/landing.ts';
import { CountdownSystem } from '../src/systems/CountdownSystem.ts';

function withGate(coarse, run) {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const classes = new Set();
  const elements = { 'landing-shell': {}, 'start-night': { disabled: true }, 'landing-status': {} };
  const callbacks = new Map();
  let timer;
  globalThis.document = {
    documentElement: { classList: { contains: key => classes.has(key), add: key => classes.add(key) } },
    getElementById: id => elements[id],
  };
  globalThis.window = {
    innerWidth: 390, innerHeight: 844,
    matchMedia: () => ({ matches: coarse, addEventListener() {} }),
    addEventListener: (name, callback) => callbacks.set(name, callback),
    screen: {}, scrollTo() {}, clearTimeout() {},
    setTimeout: callback => { timer = callback; return 1; },
  };
  const scale = new EventEmitter();
  scale.refresh = () => scale.emit('resize');
  const scene = {
    active: false, paused: false, pauses: 0, resumes: 0,
    isActive() { return this.active && !this.paused; },
    isPaused() { return this.paused; },
    pause() { this.paused = true; this.pauses++; },
    resume() { this.paused = false; this.resumes++; },
  };
  const game = { scene, scale, input: { keyboard: {} } };
  const rotate = portrait => {
    window.innerWidth = portrait ? 390 : 844;
    window.innerHeight = portrait ? 844 : 390;
    callbacks.get('resize')();
    timer();
  };
  try {
    installOrientationGate(game);
    timer(); // Initial portrait check happens before GameScene exists.
    scene.active = true;
    prepareLandingStart(game, () => enterGameShell(game));
    run({ game, scene, elements, rotate });
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
}

test('portrait-first Start pauses without a rotation and resumes the same night in landscape', () => {
  withGate(true, ({ game, scene, elements, rotate }) => {
    game.scale.refresh();
    assert.equal(scene.paused, false, 'landing menu stays usable before entry');
    assert.equal(elements['start-night'].disabled, false);
    elements['start-night'].onclick();
    assert.equal(scene.paused, true);
    game.scale.refresh();
    assert.equal(scene.pauses, 1, 'repeated refresh does not pause twice');
    const countdown = new CountdownSystem({ emit() {} }, 60, 10);
    for (let seconds = 0; seconds < 20; seconds++) if (!scene.paused) countdown.update(1000);
    assert.equal(countdown.remainingMs, 60000);
    rotate(false);
    assert.equal(scene.paused, false);
    assert.equal(scene.resumes, 1);
    countdown.update(1000);
    assert.equal(countdown.remainingMs, 59000);
    rotate(true);
    assert.equal(scene.paused, true);
  });
});

test('orientation changes preserve a user-opened pause', () => {
  withGate(true, ({ game, scene, rotate }) => {
    rotate(false);
    enterGameShell(game);
    scene.paused = true;
    rotate(true);
    rotate(false);
    assert.equal(scene.paused, true);
    assert.equal(scene.resumes, 0);
  });
});

test('fine-pointer portrait entry stays active', () => {
  withGate(false, ({ game, scene }) => {
    enterGameShell(game);
    assert.equal(scene.paused, false);
  });
});
