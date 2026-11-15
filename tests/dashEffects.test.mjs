import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { BAT, DASH, DASH_FX, PLAYER } from '../src/data/balance.ts';
import { DashEffects } from '../src/systems/DashEffects.ts';

// Only the renderer boundary is faked. Run the real FX clock, pooling, RNG,
// emission and cleanup without loading Phaser's DOM-dependent runtime.
class Image extends EventEmitter {
  constructor(key = 'bat', frame = 0) {
    super();
    Object.assign(this, {
      texture: { key }, frame: { name: frame }, x: 200, y: 300,
      scaleX: BAT.dashRenderScale, scaleY: BAT.dashRenderScale,
      originX: 0.5, originY: 0.5, rotation: 0, flipX: false, flipY: false,
      scrollFactorX: 1, scrollFactorY: 1, depth: 30, alpha: 1,
      active: true, visible: true, tintTopLeft: 0xffffff,
      tintTopRight: 0xffffff, tintBottomLeft: 0xffffff, tintBottomRight: 0xffffff,
      body: Object.freeze({ radius: 15, width: 30, height: 30, vx: 980, vy: 0 }),
    });
  }
  setTexture(key, frame) { this.texture = { key }; this.frame = { name: frame }; return this; }
  setVisible(visible) { this.visible = visible; return this; }
  setPosition(x, y) { Object.assign(this, { x, y }); return this; }
  setScale(scaleX, scaleY = scaleX) { Object.assign(this, { scaleX, scaleY }); return this; }
  setRotation(rotation) { this.rotation = rotation; return this; }
  setOrigin(originX, originY) { Object.assign(this, { originX, originY }); return this; }
  setScrollFactor() { return this; }
  setFlip(flipX, flipY) { Object.assign(this, { flipX, flipY }); return this; }
  setTint(tint) { this.tintTopLeft = tint; return this; }
  setAlpha(alpha) { this.alpha = alpha; return this; }
  setDepth(depth) { this.depth = depth; return this; }
  destroy() { this.active = false; this.visible = false; this.emit('destroy'); }
}

function harness() {
  const images = [];
  const ink = {
    active: true, draws: [],
    setDepth() { return this; },
    clear() { this.draws = []; return this; },
    fillStyle() { return this; },
    fillRect(...args) { this.draws.push(['rect', ...args]); return this; },
    fillTriangle(...args) { this.draws.push(['triangle', ...args]); return this; },
    destroy() { this.active = false; },
  };
  const scene = {
    time: { now: 1000 }, events: new EventEmitter(),
    add: {
      image: (x, y, key, frame) => {
        const image = new Image(key, frame).setPosition(x, y);
        images.push(image);
        return image;
      },
      graphics: () => ink,
    },
  };
  // Node EventEmitter doesn't support Phaser's context argument.
  const listeners = new Map();
  const events = scene.events;
  scene.events = {
    on(name, fn, context) {
      const bound = fn.bind(context); listeners.set(fn, bound); events.on(name, bound);
    },
    once(name, fn, context) {
      const bound = fn.bind(context); listeners.set(fn, bound); events.once(name, bound);
    },
    off(name, fn) { events.off(name, listeners.get(fn)); },
  };
  const source = new Image();
  const originalOnce = source.once.bind(source);
  const originalOff = source.off.bind(source);
  const sourceListeners = new Map();
  source.once = (name, fn, context) => {
    const bound = fn.bind(context); sourceListeners.set(fn, bound); originalOnce(name, bound);
  };
  source.off = (name, fn) => originalOff(name, sourceListeners.get(fn));
  const fx = new DashEffects(scene, source);
  return {
    source, fx, images, ink, events, scene,
    tick(ms) { scene.time.now = 1000 + ms; events.emit('postupdate'); },
  };
}

test('dash gameplay values and bat-form baseline stay fixed; all six FX layers have tuning', () => {
  assert.deepEqual(DASH, {
    speed: 980, durationMs: 175, invulnerabilityMs: 280, cooldownMs: 1100, afterimages: 5,
  });
  assert.equal(BAT.dashRenderScale, PLAYER.spriteScale * BAT.scaleFactor);
  for (const layer of ['ghost', 'lines', 'dust', 'stones', 'stretch', 'smear', 'skid']) {
    assert.ok(DASH_FX[layer], `missing tuning for ${layer}`);
  }
  assert.ok(DASH_FX.particles.limit <= 192);
});

test('stretch, smear and skid affect the render double without changing the source or its body', () => {
  const h = harness();
  const before = { scaleX: h.source.scaleX, scaleY: h.source.scaleY, rotation: h.source.rotation, body: h.source.body };
  h.fx.start(1, 0);
  const visual = h.images[0];
  h.tick(DASH.durationMs / 2);
  assert.ok(visual.scaleX > BAT.dashRenderScale);
  assert.ok(visual.scaleY < BAT.dashRenderScale);
  assert.equal(h.source.scaleX, before.scaleX);
  assert.equal(h.source.scaleY, before.scaleY);
  h.source.setTexture('vampire', 7).setScale(PLAYER.spriteScale);
  h.tick(DASH.durationMs);
  h.fx.finish();
  assert.equal(visual.texture.key, 'vampire');
  assert.ok(visual.rotation < 0);
  assert.equal(visual.scaleX, PLAYER.spriteScale * DASH_FX.stretch.squash);
  h.tick(DASH.durationMs + DASH_FX.skid.lifeMs);
  assert.equal(h.source.visible, true);
  assert.equal(visual.visible, false);
  assert.equal(h.source.scaleX, PLAYER.spriteScale);
  assert.equal(h.source.rotation, before.rotation);
  assert.equal(h.source.body, before.body);
  assert.equal(before.scaleX, BAT.dashRenderScale);
  h.fx.destroy();
});

test('25 ms cadence retains bat frames, mirrors left, fades out and reuses all images', () => {
  const h = harness();
  h.source.flipX = true;
  h.fx.start(-1, 0);
  for (let ms = 25; ms <= 150; ms += 25) {
    h.source.x -= 25;
    h.source.frame.name = ms % 50 ? 1 : 0;
    h.tick(ms);
  }
  const ghosts = h.images.slice(1).filter((image) => image.visible);
  assert.equal(ghosts.length, 7);
  assert.ok(ghosts.every((image) => image.texture.key === 'bat' && image.flipX));
  assert.ok(ghosts.some((image) => image.frame.name === 1));
  assert.ok(ghosts[0].alpha < ghosts.at(-1).alpha);
  h.fx.finish();
  h.tick(600);
  assert.ok(h.images.every((image) => !image.visible));
  assert.deepEqual(h.ink.draws, []);
  const count = h.images.length;
  for (let i = 0; i < 20; i++) { h.fx.start(1, 0); h.fx.finish(); h.fx.cancel(); }
  assert.equal(h.images.length, count);
  h.fx.destroy();
});

test('vertical dashes stretch along travel, and slow frames bound catch-up emissions', () => {
  const h = harness();
  h.fx.start(0, -1);
  h.tick(87.5);
  assert.ok(h.images[0].scaleY > h.source.scaleY);
  assert.ok(h.images[0].scaleX < h.source.scaleX);
  h.tick(10_000);
  assert.ok(h.images.slice(1).filter((image) => image.visible).length <= DASH_FX.ghost.limit);
  assert.ok(h.ink.draws.every((draw) => draw.slice(1).every(Number.isFinite)));
  h.fx.cancel();
  h.fx.destroy();
});

test('exhausted pools skip cosmetics without allocations or errors', () => {
  const ghostLimit = DASH_FX.ghost.limit;
  const particleLimit = DASH_FX.particles.limit;
  try {
    DASH_FX.ghost.limit = 1;
    DASH_FX.particles.limit = 1;
    const h = harness();
    h.fx.start(1, 0);
    for (let ms = 25; ms < 175; ms += 25) h.tick(ms);
    h.fx.finish();
    assert.equal(h.images.length, 2); // one render double + one ghost
    h.fx.cancel();
    assert.ok(h.images.every((image) => !image.visible));
    assert.deepEqual(h.ink.draws, []);
    assert.equal(h.source.visible, true);
    h.fx.destroy();
  } finally {
    DASH_FX.ghost.limit = ghostLimit;
    DASH_FX.particles.limit = particleLimit;
  }
});

test('private RNG never reads global randomness and gives reproducible cosmetic jitter', () => {
  const original = Math.random;
  try {
    Math.random = () => { throw new Error('gameplay RNG consumed'); };
    const a = harness();
    const b = harness();
    a.fx.start(1, 0); b.fx.start(1, 0);
    a.tick(40); b.tick(40);
    assert.deepEqual(a.ink.draws, b.ink.draws);
    a.fx.destroy(); b.fx.destroy();
  } finally { Math.random = original; }
});

test('interruptions and shutdown restore visibility, release cosmetics and unregister callbacks', () => {
  for (const phase of ['dash', 'skid']) {
    const h = harness();
    h.fx.start(1, 0);
    if (phase === 'skid') h.fx.finish();
    h.fx.cancel(); // Player calls this before death or coffin ownership changes.
    assert.equal(h.source.visible, true);
    assert.ok(h.images.every((image) => !image.visible));
    assert.deepEqual(h.ink.draws, []);
    h.source.setScale(0.2).setRotation(0.3).setVisible(false);
    h.tick(90);
    assert.equal(h.source.scaleX, 0.2);
    assert.equal(h.source.rotation, 0.3);
    assert.equal(h.source.visible, false); // coffin flight now owns presentation
    h.events.emit('shutdown');
    assert.equal(h.events.listenerCount('postupdate'), 0);
    assert.equal(h.events.listenerCount('shutdown'), 0);
    assert.equal(h.source.listenerCount('destroy'), 0);
    assert.ok(h.images.every((image) => !image.active));
    assert.equal(h.ink.active, false);
    assert.doesNotThrow(() => h.fx.destroy());
  }
});

test('an initially hidden source stays hidden, and source destruction releases the pool', () => {
  const h = harness();
  h.source.setVisible(false);
  h.fx.start(1, 0);
  h.tick(25);
  assert.ok(h.images.every((image) => !image.visible));
  h.fx.cancel();
  assert.equal(h.source.visible, false);
  h.source.destroy();
  assert.equal(h.events.listenerCount('postupdate'), 0);
  assert.equal(h.events.listenerCount('shutdown'), 0);
  assert.ok(h.images.every((image) => !image.active));
});
