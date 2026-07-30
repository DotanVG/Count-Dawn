import assert from 'node:assert/strict';
import test from 'node:test';

import { EVENTS } from '../src/game/events.ts';
import { GameFlowSystem } from '../src/systems/GameFlowSystem.ts';
import { SingleFireGate } from '../src/systems/SingleFireGate.ts';
import { UltimateState, ultimateWaveDelays } from '../src/systems/ultimateState.ts';

test('Ultimate activation requires a full meter and an allowed gameplay state', () => {
  const state = new UltimateState(100);
  state.gain(99);

  assert.equal(state.tryActivate(true), false);
  assert.deepEqual(state.snapshot(), { charge: 99, active: false });

  state.gain(1);
  assert.equal(state.tryActivate(false), false, 'pause/end gating must reject activation');
  assert.deepEqual(state.snapshot(), { charge: 100, active: false });
  assert.equal(state.tryActivate(true), true);
});

test('Ultimate consumes exactly once and cannot queue a second activation', () => {
  const state = new UltimateState(100);
  state.gain(100);

  assert.equal(state.tryActivate(true), true);
  assert.deepEqual(state.snapshot(), { charge: 0, active: true });
  assert.equal(state.tryActivate(true), false);
  assert.equal(
    state.gain(50),
    50,
    'rewards earned during the sequence remain available after it ends',
  );
  assert.equal(state.tryActivate(true), false, 'refilling cannot queue behind an active sequence');

  state.finish();
  assert.equal(state.tryActivate(true), false, 'a partial refill cannot activate');
});

test('a full refill earned during an active sequence needs a fresh post-finish activation', () => {
  const state = new UltimateState(100);
  state.gain(100);
  assert.equal(state.tryActivate(true), true);

  state.gain(100);
  assert.deepEqual(state.snapshot(), { charge: 100, active: true });
  assert.equal(state.tryActivate(true), false);

  state.finish();
  assert.deepEqual(state.snapshot(), { charge: 100, active: false });
  assert.equal(state.tryActivate(true), true);
});

test('restart resets Ultimate state and shutdown clears an active sequence', () => {
  const state = new UltimateState(100);
  state.gain(100);
  state.tryActivate(true);
  state.interrupt();

  assert.deepEqual(state.snapshot(), { charge: 0, active: false });
  state.gain(70);
  state.reset();
  assert.deepEqual(state.snapshot(), { charge: 0, active: false });
});

test('Ultimate wave timing is safe with zero enemies and bounded for a roster', () => {
  assert.deepEqual(ultimateWaveDelays(0, 260), []);
  assert.deepEqual(ultimateWaveDelays(1, 260), [0]);
  assert.deepEqual(ultimateWaveDelays(5, 260), [0, 65, 130, 195, 260]);
});

test('single-fire death handling prevents duplicate rewards and boss progression', () => {
  const events = [];
  const emitter = {
    emit(name, ...args) {
      events.push({ name, args });
      return true;
    },
  };
  const flow = new GameFlowSystem(emitter, 10);
  const gate = new SingleFireGate();
  const boss = {};
  let rewards = 0;

  flow.addBlood(10);
  flow.notifyBossSpawned();
  const resolveBossDeath = () => {
    if (!gate.claim(boss)) return;
    rewards += 30;
    flow.notifyBossDefeated();
  };
  resolveBossDeath();
  resolveBossDeath();

  assert.equal(rewards, 30);
  assert.equal(flow.isCoffinActive, true);
  assert.equal(
    events.filter(({ name }) => name === EVENTS.BOSS_DEFEATED).length,
    1,
  );
  assert.equal(
    events.filter(({ name }) => name === EVENTS.COFFIN_ACTIVATED).length,
    1,
  );
});

test('single-fire gate can be reset for a fresh run', () => {
  const gate = new SingleFireGate();
  const enemy = {};

  assert.equal(gate.claim(enemy), true);
  assert.equal(gate.claim(enemy), false);
  gate.reset();
  assert.equal(gate.claim(enemy), true);
});
