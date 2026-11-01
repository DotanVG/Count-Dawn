import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import * as constants from '../src/game/constants.ts';
import * as assetKeys from '../src/utils/assetKeys.ts';
import * as manifest from '../src/data/audioManifest.ts';
import { loadTsModule } from './helpers/loadTsModule.mjs';

function setup() {
  let started = false;
  const warnings = [];
  const { PreloadScene } = loadTsModule(new URL('../src/scenes/PreloadScene.ts', import.meta.url), {
    phaser: { Scene: class {} },
    '../game/constants': constants,
    '../utils/assetKeys': assetKeys,
    '../data/audioManifest': manifest,
    '../utils/animations': { createCharacterAnimations() {} },
    '../utils/placeholderTextures': { createPlaceholderTextures() {} },
  }, { console: { warn: message => warnings.push(message) } });
  const scene = new PreloadScene();
  scene.game = { events: new EventEmitter() };
  scene.load = Object.assign(new EventEmitter(), { image() {}, spritesheet() {}, audio() {} });
  scene.scene = { start: key => { assert.equal(key, constants.SCENES.game); started = true; } };
  scene.createChromaKeyedRoomBg = () => {};
  scene.preload();
  let errors = 0;
  scene.game.events.on('boot-load-error', () => errors++);
  return { scene, warnings, started: () => started, errors: () => errors };
}

test('optional audio failures do not prevent the preload scene from starting the game', () => {
  const game = setup();
  game.scene.load.emit('loaderror', { type: 'audio', key: 'missing-sfx' });
  game.scene.load.emit('loaderror', { type: 'audio', key: 'missing-music' });
  game.scene.create();
  assert.equal(game.errors(), 0);
  assert.equal(game.started(), true);
});

test('a critical failure after an audio failure still blocks boot and reports only once', () => {
  for (const type of ['image', 'spritesheet']) {
    const game = setup();
    game.scene.load.emit('loaderror', { type: 'audio', key: 'missing-sfx' });
    game.scene.load.emit('loaderror', { type, key: 'missing-critical' });
    game.scene.load.emit('loaderror', { type, key: 'another-critical' });
    game.scene.create();
    assert.equal(game.errors(), 1, type);
    assert.equal(game.started(), false, type);
  }
});
