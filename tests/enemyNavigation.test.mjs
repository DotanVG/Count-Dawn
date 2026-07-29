import test from 'node:test';
import assert from 'node:assert/strict';

import {
  coffinDetourWaypoints,
  selectAutoAttackTarget,
} from '../src/systems/enemyNavigation.ts';

const arena = { left: 64, right: 1216, top: 192, bottom: 640 };
const coffin = { x: 150, y: 430, halfWidth: 44, halfHeight: 63 };
const hunter = { halfWidth: 20, halfHeight: 20 };

test('left-side coffin routes remain reachable by the whole hunter body', () => {
  const waypoints = coffinDetourWaypoints(
    { x: 90, y: 420 },
    { x: 80, y: 500 },
    coffin,
    arena,
    hunter,
  );

  assert.equal(waypoints.length, 1);
  assert.ok(waypoints[0].x >= arena.left + hunter.halfWidth);
  assert.ok(waypoints[0].y <= arena.bottom - hunter.halfHeight);
});

test('cross-coffin pursuit clears the near corner before crossing sides', () => {
  const waypoints = coffinDetourWaypoints(
    { x: 90, y: 360 },
    { x: 500, y: 480 },
    coffin,
    arena,
    hunter,
  );

  assert.equal(waypoints.length, 2);
  assert.equal(waypoints[0].y, waypoints[1].y);
  assert.ok(waypoints[0].x < coffin.x);
  assert.ok(waypoints[1].x > coffin.x);
  assert.ok(waypoints[0].y < coffin.y - coffin.halfHeight);
});

test('mobile auto attack ignores entering and out-of-range aim thieves', () => {
  const entering = {
    id: 'entering',
    x: -10,
    y: 400,
    active: true,
    isAlive: true,
    isEntering: true,
    displayWidth: 50,
  };
  const nearby = {
    id: 'nearby',
    x: 150,
    y: 400,
    active: true,
    isAlive: true,
    isEntering: false,
    displayWidth: 50,
  };
  const far = {
    id: 'far',
    x: 500,
    y: 400,
    active: true,
    isAlive: true,
    isEntering: false,
    displayWidth: 50,
  };

  assert.equal(
    selectAutoAttackTarget({ x: 80, y: 400 }, [entering, far, nearby], 115)?.id,
    'nearby',
  );
});

test('mobile auto attack returns no target when no swing can connect', () => {
  const far = {
    x: 500,
    y: 400,
    active: true,
    isAlive: true,
    isEntering: false,
    displayWidth: 50,
  };

  assert.equal(selectAutoAttackTarget({ x: 80, y: 400 }, [far], 115), null);
});
