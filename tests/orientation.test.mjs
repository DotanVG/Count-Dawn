import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { installOrientationGate } from '../src/game/orientation.ts';
import { CountdownSystem } from '../src/systems/CountdownSystem.ts';

async function withGate(coarse, run) {
  const originalWindow = globalThis.window;
  const callbacks = new Map();
  let timer;
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
  const sceneEvents = new EventEmitter();
  scene.getScene = () => ({ events: sceneEvents });
  const game = { scene, scale, events: new EventEmitter() };
  const rotate = portrait => {
    window.innerWidth = portrait ? 390 : 844;
    window.innerHeight = portrait ? 844 : 390;
    callbacks.get('resize')();
    timer();
  };
  try {
    installOrientationGate(game);
    timer(); // Initial portrait check happens before GameScene exists.
    game.events.emit('ready');
    const create = () => { scene.active = true; sceneEvents.emit('create'); };
    await run({ game, scene, create, rotate });
  } finally {
    globalThis.window = originalWindow;
  }
}

test('portrait-first boot pauses the menu after a cold preload and resumes in landscape', async () => {
  await withGate(true, ({ game, scene, create, rotate }) => {
    assert.equal(scene.paused, false, 'preload does not consume the portrait pause');
    create();
    assert.equal(scene.paused, true, 'no entry click or rotation is required');
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

test('orientation changes preserve a user-opened pause', async () => {
  await withGate(true, ({ scene, create, rotate }) => {
    rotate(false);
    create();
    scene.paused = true;
    rotate(true);
    rotate(false);
    assert.equal(scene.paused, true);
    assert.equal(scene.resumes, 0);
  });
});

test('fine-pointer portrait boot stays active', async () => {
  await withGate(false, ({ scene, create }) => {
    create();
    assert.equal(scene.paused, false);
  });
});
