import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MusicStateMachine,
  musicKeyForState,
  musicStateForKey,
} from '../src/systems/MusicStateMachine.ts';
import { AUDIO } from '../src/utils/assetKeys.ts';

test('the game starts silent and the menu raises the Main Title once', () => {
  const music = new MusicStateMachine();

  assert.equal(music.current, 'none');
  assert.equal(music.request('main-title'), true);
  assert.equal(music.current, 'main-title');
});

test('re-requesting the active track is not a transition', () => {
  const music = new MusicStateMachine();
  music.request('main-title');

  // Start pressed, cold open running, a second scene asking for it: no change.
  assert.equal(music.request('main-title'), false);
  assert.equal(music.current, 'main-title');
});

test('the gameplay cue cannot fire twice for the same run', () => {
  const music = new MusicStateMachine();
  music.request('main-title');

  assert.equal(music.request('level'), true);
  // Every later night re-enters gameplay without restarting the track.
  assert.equal(music.request('level'), false);
  assert.equal(music.request('level'), false);
  assert.equal(music.current, 'level');
});

test('the death transition cannot fire twice', () => {
  const music = new MusicStateMachine();
  music.request('main-title');
  music.request('level');

  assert.equal(music.request('main-title'), true);
  // A repeated death signal, then the game-over scene asserting the same track.
  assert.equal(music.request('main-title'), false);
  assert.equal(music.request('main-title'), false);
  assert.equal(music.current, 'main-title');
});

test('Game Over -> Main Menu leaves the Main Title exactly where it was', () => {
  const music = new MusicStateMachine();
  music.request('main-title');
  music.request('level');
  music.request('main-title'); // death

  // Back to the menu, then straight into another run's cold open.
  assert.equal(music.request('main-title'), false);
  assert.equal(music.request('main-title'), false);
  assert.equal(music.current, 'main-title');

  // Only the new run gaining control moves it again.
  assert.equal(music.request('level'), true);
});

test('a full run round-trips through exactly four transitions', () => {
  const music = new MusicStateMachine();
  const changes = [];
  const request = (state) => {
    if (music.request(state)) changes.push(state);
  };

  request('main-title'); // menu
  request('main-title'); // START pressed
  request('main-title'); // cold open
  request('level'); //     first night, control handed over
  request('level'); //     night survived, next night
  request('level'); //     and the next
  request('main-title'); // death
  request('main-title'); // game-over screen
  request('main-title'); // back to the menu
  request('level'); //     second run gains control
  request('none'); //      game torn down

  assert.deepEqual(changes, ['main-title', 'level', 'main-title', 'level', 'none']);
});

test('force restores a state without reporting a transition', () => {
  const music = new MusicStateMachine();
  music.request('level');

  music.force('main-title');
  assert.equal(music.current, 'main-title');
  assert.equal(music.request('main-title'), false);
});

test('states and keys map both ways', () => {
  assert.equal(musicKeyForState('main-title'), AUDIO.mainTitle);
  assert.equal(musicKeyForState('level'), AUDIO.levelMusic);
  assert.equal(musicKeyForState('none'), null);

  assert.equal(musicStateForKey(AUDIO.mainTitle), 'main-title');
  assert.equal(musicStateForKey(AUDIO.levelMusic), 'level');
  assert.equal(musicStateForKey(AUDIO.playerAttackSlurp), 'none');
});
