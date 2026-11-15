import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import * as balance from '../src/data/audioBalance.ts';
import * as manifest from '../src/data/audioManifest.ts';
import * as music from '../src/systems/MusicStateMachine.ts';
import { SCENES } from '../src/game/constants.ts';
import { AUDIO } from '../src/utils/assetKeys.ts';
import { loadTsModule } from './helpers/loadTsModule.mjs';

const SOUND_EVENTS = { UNLOCKED: 'unlocked', COMPLETE: 'complete', STOP: 'stop' };

/**
 * Phaser-like manager that reproduces the mid-dash death crash: a
 * playSfxSegment instance registers destroy() on STOP/COMPLETE, and
 * SoundManager.removeByKey / a second destroy() then throws
 * `TypeError: Cannot read properties of null (reading 'disconnect')`.
 */
class FragileWebAudioSoundManager extends EventEmitter {
  sounds = [];

  play(key, config) {
    const sound = this.add(key, config);
    sound.play();
    return true;
  }

  add(key, config = {}) {
    const manager = this;
    const sound = {
      key,
      ...config,
      isPlaying: false,
      isPaused: false,
      destroyed: false,
      manager,
      webAudioSource: { disconnect() {} },
      _events: new EventEmitter(),
      markers: {},
      once(event, fn) {
        this._events.once(event, fn);
        return this;
      },
      addMarker(marker) {
        this.markers[marker.name] = marker;
        return this;
      },
      play() {
        this.isPlaying = true;
        this.isPaused = false;
        return true;
      },
      stop() {
        const wasActive = this.isPlaying || this.isPaused;
        this.isPlaying = false;
        this.isPaused = false;
        if (wasActive) this._events.emit(SOUND_EVENTS.STOP);
      },
      complete() {
        this.isPlaying = false;
        this.isPaused = false;
        this._events.emit(SOUND_EVENTS.COMPLETE);
      },
      destroy() {
        if (this.webAudioSource == null) {
          throw new TypeError("Cannot read properties of null (reading 'disconnect')");
        }
        this.webAudioSource = null;
        this.manager = null;
        if (this.isPlaying || this.isPaused) this.stop();
        this.destroyed = true;
        this.isPlaying = false;
      },
    };
    this.sounds.push(sound);
    return sound;
  }

  getAll(key) {
    return this.sounds.filter((sound) => key === undefined || sound.key === key);
  }

  stopByKey(key) {
    for (const sound of this.getAll(key)) sound.stop();
  }

  removeByKey(key) {
    for (const sound of this.getAll(key)) sound.destroy();
    this.sounds = this.sounds.filter((sound) => sound.key !== key);
  }
}

function setup() {
  const sound = new FragileWebAudioSoundManager();
  const buffers = new Map([
    [AUDIO.batSound1, {}],
    [AUDIO.batDashSound, {}],
  ]);
  const game = {
    sound,
    events: new EventEmitter(),
    cache: {
      audio: {
        events: new EventEmitter(),
        exists: (key) => buffers.has(key),
        get: (key) => buffers.get(key),
        add: (key, value) => buffers.set(key, value),
      },
    },
  };
  const { AudioDirector } = loadTsModule(new URL('../src/systems/AudioDirector.ts', import.meta.url), {
    phaser: {
      Core: { Events: { PRE_STEP: 'prestep', DESTROY: 'destroy' } },
      Sound: { Events: SOUND_EVENTS },
      Cache: { Events: { ADD: 'add' } },
    },
    '../data/audioBalance': balance,
    '../data/audioManifest': manifest,
    './MusicStateMachine': music,
  }, { Math: Object.assign(Object.create(Math), { random: () => 0 }) });
  return { director: new AudioDirector(game), sound };
}

/** GameScene.cleanup audio teardown, run as Phaser would during scene.start. */
function shutdownToGameOver(director) {
  const started = [];
  let cleanupError = null;
  const scene = {
    start(key) {
      try {
        director.stopSfx(AUDIO.batSound1);
        director.stopSfx(AUDIO.batDashSound);
      } catch (error) {
        cleanupError = error;
        throw error;
      }
      started.push(key);
    },
  };
  scene.start(SCENES.gameOver);
  return { started, cleanupError };
}

test('stopSfx does not throw when removeByKey hits a torn-down WebAudio node', () => {
  const { director, sound } = setup();
  director.playSfxSegment(AUDIO.batDashSound, 0.5, 1);
  const [segment] = sound.getAll(AUDIO.batDashSound);
  assert.equal(segment.isPlaying, true);
  // The segment already destroyed itself (COMPLETE), but is still registered.
  segment.complete();
  assert.equal(segment.destroyed, true);
  assert.doesNotThrow(() => director.stopSfx(AUDIO.batDashSound));
  director.destroy();
});

test('stopSfx does not throw while a bat-dash segment is still playing', () => {
  const { director, sound } = setup();
  director.playSfxSegment(AUDIO.batDashSound, 0.5, 1);
  assert.equal(sound.getAll(AUDIO.batDashSound).length, 1);
  assert.equal(sound.getAll(AUDIO.batDashSound)[0].isPlaying, true);
  assert.doesNotThrow(() => director.stopSfx(AUDIO.batDashSound));
  director.destroy();
});

test('death mid-dash during the bat-dash sfx still triggers GameOver', () => {
  const { director, sound } = setup();

  // GameScene BAT_FORM_CHANGED: an active dash starts the excerpt.
  director.stopSfx(AUDIO.batDashSound);
  director.playSfxSegment(AUDIO.batDashSound, 0.5, 1);
  assert.equal(sound.getAll(AUDIO.batDashSound)[0].isPlaying, true);

  // PLAYER_DIED → delayedCall(900) → scene.start(GameOver). Phaser runs
  // SHUTDOWN / cleanup as part of that start; a throw aborts GameOver.
  const { started, cleanupError } = shutdownToGameOver(director);
  assert.equal(cleanupError, null);
  assert.deepEqual(started, [SCENES.gameOver]);
  director.destroy();
});

test('death mid-dash still triggers GameOver if the dash segment already completed', () => {
  const { director, sound } = setup();
  director.stopSfx(AUDIO.batDashSound);
  director.playSfxSegment(AUDIO.batDashSound, 0.5, 1);
  sound.getAll(AUDIO.batDashSound)[0].complete();

  const { started, cleanupError } = shutdownToGameOver(director);
  assert.equal(cleanupError, null);
  assert.deepEqual(started, [SCENES.gameOver]);
  director.destroy();
});
