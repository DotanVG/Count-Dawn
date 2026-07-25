import test from 'node:test';
import assert from 'node:assert/strict';

import { GameFlowSystem } from '../src/systems/GameFlowSystem.ts';
import { EVENTS } from '../src/game/events.ts';

function createRecorder() {
  const events = [];
  return {
    events,
    emit(name, ...args) {
      events.push({ name, args });
      return true;
    },
    count(name) {
      return events.filter((e) => e.name === name).length;
    },
  };
}

test('coffin does not activate with only full blood', () => {
  const emitter = createRecorder();
  const flow = new GameFlowSystem(emitter, 100);

  flow.addBlood(100);

  assert.equal(flow.isCoffinActive, false);
  assert.equal(emitter.count(EVENTS.COFFIN_ACTIVATED), 0);
  assert.equal(emitter.count(EVENTS.BOSS_SPAWN_REQUESTED), 1);
});

test('reaching the blood target requests the boss exactly once', () => {
  const emitter = createRecorder();
  const flow = new GameFlowSystem(emitter, 100);

  flow.addBlood(99);
  assert.equal(emitter.count(EVENTS.BOSS_SPAWN_REQUESTED), 0);
  flow.addBlood(1);
  flow.addBlood(20);

  assert.equal(emitter.count(EVENTS.BOSS_SPAWN_REQUESTED), 1);
});

test('coffin does not activate with only the boss defeated', () => {
  const emitter = createRecorder();
  const flow = new GameFlowSystem(emitter, 100);

  flow.notifyBossSpawned();
  flow.notifyBossDefeated();

  assert.equal(flow.isCoffinActive, false);
  assert.equal(emitter.count(EVENTS.COFFIN_ACTIVATED), 0);
});

test('coffin activates once blood is full AND the boss is defeated', () => {
  const emitter = createRecorder();
  const flow = new GameFlowSystem(emitter, 100);

  flow.addBlood(60);
  flow.notifyBossSpawned();
  flow.notifyBossDefeated();
  assert.equal(flow.isCoffinActive, false);

  flow.addBlood(40);
  assert.equal(flow.isCoffinActive, true);
  assert.equal(emitter.count(EVENTS.COFFIN_ACTIVATED), 1);
});

test('entering the coffin early does nothing; entering when active wins exactly once', () => {
  const emitter = createRecorder();
  const flow = new GameFlowSystem(emitter, 100);

  assert.equal(flow.tryEnterCoffin(), false);

  flow.addBlood(100);
  flow.notifyBossSpawned();
  flow.notifyBossDefeated();

  assert.equal(flow.tryEnterCoffin(), true);
  assert.equal(flow.result, 'victory');
  assert.equal(flow.tryEnterCoffin(), false);
  assert.equal(emitter.count(EVENTS.GAME_ENDED), 1);
});

test('the run can only end once — later causes do not overwrite the first', () => {
  const emitter = createRecorder();
  const flow = new GameFlowSystem(emitter, 100);

  flow.notifyPlayerDied();
  flow.notifyDawnReached();

  assert.equal(flow.result, 'death');
  assert.equal(emitter.count(EVENTS.GAME_ENDED), 1);
});

test('objective follows game state', () => {
  const emitter = createRecorder();
  const flow = new GameFlowSystem(emitter, 100);

  assert.equal(flow.objective, 'collect-blood');
  flow.notifyBossSpawned();
  assert.equal(flow.objective, 'defeat-boss');
  flow.notifyBossDefeated();
  assert.equal(flow.objective, 'collect-more-blood');
  flow.addBlood(100);
  assert.equal(flow.objective, 'return-to-coffin');
});

test('blood past the target overflows instead of inflating the meter', () => {
  const emitter = createRecorder();
  const flow = new GameFlowSystem(emitter, 100);

  flow.addBlood(100);
  assert.equal(flow.currentBlood, 100);

  flow.addBlood(7);

  // The meter stays pinned at the target so "full" keeps one meaning, and
  // the surplus is reported for GameScene to turn into healing.
  assert.equal(flow.currentBlood, 100);
  const overflows = emitter.events.filter((e) => e.name === EVENTS.BLOOD_OVERFLOWED);
  assert.equal(overflows.length, 1);
  assert.deepEqual(overflows[0].args, [7]);
});

test('the bloodlet that tips the meter over spills only its surplus', () => {
  const emitter = createRecorder();
  const flow = new GameFlowSystem(emitter, 100);

  flow.addBlood(98);
  flow.addBlood(5);

  assert.equal(flow.currentBlood, 103);
  const overflows = emitter.events.filter((e) => e.name === EVENTS.BLOOD_OVERFLOWED);
  assert.deepEqual(overflows[0].args, [3]);
});

test('overflow never fires a second boss request', () => {
  const emitter = createRecorder();
  const flow = new GameFlowSystem(emitter, 100);

  flow.addBlood(100);
  flow.addBlood(50);
  flow.addBlood(50);

  assert.equal(emitter.count(EVENTS.BOSS_SPAWN_REQUESTED), 1);
});
