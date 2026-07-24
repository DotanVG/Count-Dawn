import test from 'node:test';
import assert from 'node:assert/strict';

import { CountdownSystem } from '../src/systems/CountdownSystem.ts';
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

test('dawn fires exactly once, even if update keeps running', () => {
  const emitter = createRecorder();
  const countdown = new CountdownSystem(emitter, 120, 10);

  for (let i = 0; i < 130; i++) countdown.update(1000);

  assert.equal(countdown.hasDawnFired, true);
  assert.equal(countdown.remainingMs, 0);
  assert.equal(emitter.count(EVENTS.DAWN_REACHED), 1);
});

test('final-ten-seconds warning fires exactly once', () => {
  const emitter = createRecorder();
  const countdown = new CountdownSystem(emitter, 120, 10);

  for (let i = 0; i < 125; i++) countdown.update(1000);

  assert.equal(emitter.count(EVENTS.FINAL_TEN_SECONDS), 1);
});

test('remaining time is delta-driven and clamps at zero', () => {
  const emitter = createRecorder();
  const countdown = new CountdownSystem(emitter, 10, 3);

  countdown.update(2500);
  assert.equal(countdown.remainingMs, 7500);
  assert.equal(countdown.remainingSeconds, 8);

  countdown.update(60000);
  assert.equal(countdown.remainingMs, 0);
});
