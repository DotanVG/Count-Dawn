import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import * as balance from '../src/data/audioBalance.ts';
import * as manifest from '../src/data/audioManifest.ts';
import * as music from '../src/systems/MusicStateMachine.ts';
import { AUDIO } from '../src/utils/assetKeys.ts';
import { loadTsModule } from './helpers/loadTsModule.mjs';

class FakeSoundManager extends EventEmitter {
  sounds = [];
  play(key, config) {
    const sound = {
      key, ...config, isPlaying: true, isPaused: false, destroyed: false,
      pause() { this.isPlaying = false; this.isPaused = true; },
      resume() {
        assert.equal(this.destroyed, false, 'destroyed sounds cannot resume');
        this.isPlaying = true;
        this.isPaused = false;
      },
      stop() { this.isPlaying = false; this.isPaused = false; },
      destroy() { this.stop(); this.destroyed = true; },
    };
    this.sounds.push(sound);
    return true;
  }
  getAll(key) { return this.sounds.filter(sound => key === undefined || sound.key === key); }
  stopByKey(key) { for (const sound of this.getAll(key)) sound.stop(); }
  removeByKey(key) {
    for (const sound of this.getAll(key)) sound.destroy();
    this.sounds = this.sounds.filter(sound => sound.key !== key);
  }
}

function setup(globals = {}, entries = [[AUDIO.batSound1, {}], [AUDIO.batDashSound, {}]]) {
  const sound = new FakeSoundManager();
  const buffers = new Map(entries);
  const game = {
    sound, events: new EventEmitter(),
    cache: { audio: {
      events: new EventEmitter(), exists: key => buffers.has(key),
      get: key => buffers.get(key), add: (key, value) => buffers.set(key, value),
    } },
  };
  const { AudioDirector } = loadTsModule(new URL('../src/systems/AudioDirector.ts', import.meta.url), {
    phaser: { Core: { Events: { PRE_STEP: 'prestep', DESTROY: 'destroy' } },
      Sound: { Events: { UNLOCKED: 'unlocked' } }, Cache: { Events: { ADD: 'add' } } },
    '../data/audioBalance': balance,
    '../data/audioManifest': manifest,
    './MusicStateMachine': music,
  }, { Math: Object.assign(Object.create(Math), { random: () => 0 }), ...globals });
  return { director: new AudioDirector(game), sound, buffers };
}

test('stopping repeated bat flights destroys every loop without removing other cues', () => {
  const { director, sound } = setup();
  director.playSfx(AUDIO.batDashSound);
  const other = sound.getAll(AUDIO.batDashSound)[0];
  for (let flight = 0; flight < 50; flight++) {
    director.playSfx(AUDIO.batSound1, { loop: true });
    director.playSfx(AUDIO.batSound1, { loop: true });
    const loops = sound.getAll(AUDIO.batSound1);
    assert.equal(loops.length, 2);
    director.stopSfx(AUDIO.batSound1);
    assert.equal(sound.getAll(AUDIO.batSound1).length, 0);
    assert.ok(loops.every(loop => loop.destroyed && !loop.isPlaying));
  }
  assert.deepEqual(sound.getAll(), [other]);
  assert.equal(other.isPlaying, true);
  director.destroy();
});

test('a stopped paused loop is removed from the resumable set', () => {
  const { director, sound } = setup();
  director.playSfx(AUDIO.batSound1, { loop: true });
  director.playSfx(AUDIO.batDashSound);
  const loop = sound.getAll(AUDIO.batSound1)[0];
  const other = sound.getAll(AUDIO.batDashSound)[0];
  director.enterMenuMode(true);
  assert.equal(loop.isPaused, true);
  director.stopSfx(AUDIO.batSound1);
  assert.equal(director.pausedSfx.has(loop), false);
  director.exitMenuMode();
  assert.equal(loop.destroyed, true);
  assert.equal(other.isPlaying, true);
  director.destroy();
});

test('missing audio keys are silent no-ops', () => {
  const { director, sound } = setup({}, []);
  director.playSfx(AUDIO.batSound1, { loop: true });
  assert.equal(director.addSfx(AUDIO.batSound1), null);
  director.stopSfx(AUDIO.batSound1);
  assert.equal(sound.getAll().length, 0);
  director.destroy();
});

test('an unavailable AudioBuffer constructor falls back once to the original sound', () => {
  let attempts = 0;
  class LegacyAudioBuffer {
    constructor() { attempts++; throw new TypeError('Illegal constructor'); }
  }
  const source = Object.create(LegacyAudioBuffer.prototype);
  Object.assign(source, { length: 3, numberOfChannels: 1, sampleRate: 44100 });
  const { director, sound, buffers } = setup({ AudioBuffer: LegacyAudioBuffer }, [
    [AUDIO.playerAttackWhoosh, source],
  ]);
  assert.doesNotThrow(() => {
    director.playSfx(AUDIO.playerAttackWhoosh);
    director.playSfx(AUDIO.playerAttackWhoosh);
  });
  assert.equal(attempts, 1, 'unsupported buffers must not be retried on every attack');
  assert.deepEqual(sound.getAll().map(s => s.key), [AUDIO.playerAttackWhoosh, AUDIO.playerAttackWhoosh]);
  assert.equal(buffers.has(`${AUDIO.playerAttackWhoosh}--reversed`), false);
  director.destroy();
});

test('supported AudioBuffer playback reverses each channel once and reuses the cache', () => {
  let copies = 0;
  class FakeAudioBuffer {
    constructor({ length, numberOfChannels, sampleRate }) {
      copies++;
      Object.assign(this, { length, numberOfChannels, sampleRate });
      this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
    }
    getChannelData(channel) { return this.channels[channel]; }
  }
  const source = new FakeAudioBuffer({ length: 3, numberOfChannels: 2, sampleRate: 44100 });
  source.channels[0].set([1, 2, 3]);
  source.channels[1].set([4, 5, 6]);
  const { director, sound, buffers } = setup({ AudioBuffer: FakeAudioBuffer }, [
    [AUDIO.playerAttackWhoosh, source],
  ]);
  director.playSfx(AUDIO.playerAttackWhoosh);
  director.playSfx(AUDIO.playerAttackWhoosh);
  const key = `${AUDIO.playerAttackWhoosh}--reversed`;
  assert.deepEqual(sound.getAll().map(s => s.key), [key, key]);
  assert.deepEqual(Array.from(buffers.get(key).channels[0]), [3, 2, 1]);
  assert.deepEqual(Array.from(buffers.get(key).channels[1]), [6, 5, 4]);
  assert.deepEqual(Array.from(source.channels[0]), [1, 2, 3]);
  assert.equal(copies, 2, 'one source and one cached reverse');
  director.destroy();
});

test('the audio context preserves reversal, variance and caching with a legacy AudioBuffer', () => {
  class LegacyAudioBuffer {
    constructor() { throw new TypeError('Illegal constructor'); }
  }
  const channels = [new Float32Array([1, 2, 3]), new Float32Array([4, 5, 6])];
  const source = Object.assign(Object.create(LegacyAudioBuffer.prototype), {
    length: 3, numberOfChannels: 2, sampleRate: 44100,
    getChannelData: channel => channels[channel],
  });
  const rolls = [0, 1, 0, 1, 0, 0];
  const { director, sound, buffers } = setup({
    AudioBuffer: LegacyAudioBuffer,
    Math: Object.assign(Object.create(Math), { random: () => rolls.shift() }),
  }, [[AUDIO.playerAttackWhoosh, source]]);
  let allocations = 0;
  sound.context = {
    createBuffer(numberOfChannels, length, sampleRate) {
      assert.equal(this, sound.context, 'the factory keeps its AudioContext receiver');
      assert.deepEqual([numberOfChannels, length, sampleRate], [2, 3, 44100]);
      allocations++;
      const reversed = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
      return { getChannelData: channel => reversed[channel] };
    },
  };
  director.playSfx(AUDIO.playerAttackWhoosh);
  director.playSfx(AUDIO.playerAttackWhoosh);
  const key = `${AUDIO.playerAttackWhoosh}--reversed`;
  assert.deepEqual(sound.getAll().map(s => s.key), [key, key]);
  const reversed = buffers.get(key);
  assert.deepEqual(Array.from(reversed.getChannelData(0)), [3, 2, 1]);
  assert.deepEqual(Array.from(reversed.getChannelData(1)), [6, 5, 4]);
  assert.deepEqual(channels.map(channel => Array.from(channel)), [[1, 2, 3], [4, 5, 6]]);
  assert.equal(allocations, 1, 'the reversed buffer is cached across plays');
  const volume = balance.effectiveSfxVolume(director.getBalance(), AUDIO.playerAttackWhoosh);
  assert.deepEqual(sound.getAll().map(s => s.detune), [220, -220]);
  assert.ok(sound.getAll()[0].volume < volume);
  assert.ok(sound.getAll()[1].volume > volume);
  director.destroy();
});

test('a failed context allocation falls back once without interrupting playback', () => {
  class LegacyAudioBuffer {
    constructor() { throw new TypeError('Illegal constructor'); }
  }
  const source = Object.assign(Object.create(LegacyAudioBuffer.prototype), {
    length: 3, numberOfChannels: 1, sampleRate: 44100,
    getChannelData: () => new Float32Array([1, 2, 3]),
  });
  const { director, sound, buffers } = setup({ AudioBuffer: LegacyAudioBuffer }, [
    [AUDIO.playerAttackWhoosh, source],
  ]);
  let attempts = 0;
  sound.context = { createBuffer() { attempts++; throw new RangeError('Allocation failed'); } };
  assert.doesNotThrow(() => {
    director.playSfx(AUDIO.playerAttackWhoosh);
    director.playSfx(AUDIO.playerAttackWhoosh);
  });
  assert.equal(attempts, 1, 'failed allocations must not be retried on every attack');
  assert.deepEqual(sound.getAll().map(s => s.key), [AUDIO.playerAttackWhoosh, AUDIO.playerAttackWhoosh]);
  assert.equal(buffers.has(`${AUDIO.playerAttackWhoosh}--reversed`), false);
  director.destroy();
});
