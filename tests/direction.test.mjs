import assert from 'node:assert/strict';
import test from 'node:test';

import { deathRenderDirection } from '../src/utils/direction.ts';

test('left deaths mirror the known-correct right-facing animation', () => {
  assert.deepEqual(deathRenderDirection('left'), {
    animationDirection: 'right',
    flipX: true,
  });
});

test('other death directions use their own rows without mirroring', () => {
  for (const direction of ['right', 'up', 'down']) {
    assert.deepEqual(deathRenderDirection(direction), {
      animationDirection: direction,
      flipX: false,
    });
  }
});
