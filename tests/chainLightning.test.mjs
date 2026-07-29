import test from 'node:test';
import assert from 'node:assert/strict';

import {
  chainLightningDuration,
  orderChainTargets,
} from '../src/systems/chainLightning.ts';

test('chain ordering repeatedly selects the nearest unvisited target', () => {
  const targets = [
    { id: 'far', x: 100, y: 0 },
    { id: 'near', x: 10, y: 0 },
    { id: 'middle', x: 35, y: 0 },
    { id: 'up', x: 35, y: 30 },
  ];

  const ordered = orderChainTargets(targets, { x: 0, y: 0 });

  assert.deepEqual(
    ordered.map((target) => target.id),
    ['near', 'middle', 'up', 'far'],
  );
});

test('chain ordering has no target cap and never mutates the supplied list', () => {
  const targets = Array.from({ length: 24 }, (_, index) => ({
    id: index,
    x: index * 11,
    y: index % 2,
  })).reverse();
  const before = [...targets];

  const ordered = orderChainTargets(targets, { x: -10, y: 0 });

  assert.equal(ordered.length, 24);
  assert.deepEqual(targets, before);
  assert.deepEqual(
    ordered.map((target) => target.id),
    Array.from({ length: 24 }, (_, index) => index),
  );
});

test('without a source the first supplied point anchors the chain', () => {
  const targets = [
    { id: 'anchor', x: 50, y: 50 },
    { id: 'later', x: 100, y: 50 },
    { id: 'next', x: 55, y: 50 },
  ];

  assert.deepEqual(
    orderChainTargets(targets).map((target) => target.id),
    ['anchor', 'next', 'later'],
  );
});

test('non-finite points are ignored before choreography begins', () => {
  const ordered = orderChainTargets([
    { id: 'valid', x: 2, y: 3 },
    { id: 'invalid-x', x: Number.NaN, y: 4 },
    { id: 'invalid-y', x: 5, y: Number.POSITIVE_INFINITY },
  ]);

  assert.deepEqual(ordered.map((target) => target.id), ['valid']);
});

test('the 16-enemy cinematic chain has an exact 1.04 second completion contract', () => {
  assert.equal(chainLightningDuration(16), 1040);
  assert.equal(chainLightningDuration(0), 0);
});
