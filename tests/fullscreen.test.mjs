import assert from 'node:assert/strict';
import test from 'node:test';
import { createFullscreenController } from '../src/game/fullscreenController.ts';

function fixture(prefixed = false) {
  const doc = new EventTarget();
  const target = {};
  const calls = [];
  const stateKey = prefixed ? 'webkitFullscreenElement' : 'fullscreenElement';
  const enterKey = prefixed ? 'webkitRequestFullscreen' : 'requestFullscreen';
  const exitKey = prefixed ? 'webkitExitFullscreen' : 'exitFullscreen';
  const event = prefixed ? 'webkitfullscreenchange' : 'fullscreenchange';
  doc[prefixed ? 'webkitFullscreenEnabled' : 'fullscreenEnabled'] = true;
  doc[stateKey] = null;
  target[enterKey] = function () {
    assert.equal(this, target);
    calls.push('enter');
    doc[stateKey] = target;
    doc.dispatchEvent(new Event(event));
  };
  doc[exitKey] = function () {
    assert.equal(this, doc);
    calls.push('exit');
    doc[stateKey] = null;
    doc.dispatchEvent(new Event(event));
  };
  const updates = [];
  const controller = createFullscreenController(doc, target, (supported, fullscreen) => updates.push({ supported, fullscreen }));
  return { doc, target, calls, updates, controller, stateKey, enterKey, exitKey, event };
}

for (const prefixed of [false, true]) {
  const api = prefixed ? 'WebKit' : 'standard';
  test(`${api}: enters and exits the actual fullscreen element, with the correct receiver`, async () => {
    const f = fixture(prefixed);
    await f.controller.toggle();
    assert.equal(f.doc[f.stateKey], f.target);
    assert.deepEqual(f.updates.at(-1), { supported: true, fullscreen: true });
    f.doc[f.stateKey] = {}; // Another element can have entered fullscreen.
    await f.controller.toggle();
    assert.equal(f.doc[f.stateKey], null);
    assert.deepEqual(f.calls, ['enter', 'exit']);
  });

  test(`${api}: external exits and fullscreen errors resync actual state`, () => {
    const f = fixture(prefixed);
    f.doc[f.stateKey] = f.target;
    f.doc.dispatchEvent(new Event(f.event));
    assert.equal(f.updates.at(-1).fullscreen, true);
    f.doc[f.stateKey] = null;
    f.doc.dispatchEvent(new Event(f.event));
    assert.equal(f.updates.at(-1).fullscreen, false);
    f.doc[f.stateKey] = f.target;
    f.doc.dispatchEvent(new Event(prefixed ? 'webkitfullscreenerror' : 'fullscreenerror'));
    assert.equal(f.updates.at(-1).fullscreen, true);
  });

  for (const action of ['enter', 'exit']) {
    test(`${api}: ${action} rejection and synchronous throw are handled; retry remains usable`, async () => {
      for (const synchronous of [false, true]) {
        const f = fixture(prefixed);
        if (action === 'exit') f.doc[f.stateKey] = f.target;
        const owner = action === 'exit' ? f.doc : f.target;
        const key = action === 'exit' ? f.exitKey : f.enterKey;
        const original = owner[key];
        owner[key] = () => {
          if (synchronous) throw new Error('denied');
          return Promise.reject(new Error('denied'));
        };
        await assert.doesNotReject(f.controller.toggle());
        assert.equal(f.updates.at(-1).fullscreen, action === 'exit');
        owner[key] = original;
        await f.controller.toggle();
        assert.deepEqual(f.calls, [action]);
        assert.equal(f.updates.at(-1).fullscreen, action === 'enter');
      }
    });
  }
}

test('WebKit state selects WebKit exit even when the standard exit method exists', async () => {
  const f = fixture(true);
  f.doc.fullscreenEnabled = false;
  f.doc.exitFullscreen = () => assert.fail('inactive standard API called');
  f.doc.webkitFullscreenElement = f.target;
  await f.controller.toggle();
  assert.deepEqual(f.calls, ['exit']);
});

test('void-returning standard methods never fall through to WebKit', async () => {
  const f = fixture();
  f.target.webkitRequestFullscreen = () => assert.fail('double enter');
  f.doc.webkitExitFullscreen = () => assert.fail('double exit');
  await f.controller.toggle();
  await f.controller.toggle();
  assert.deepEqual(f.calls, ['enter', 'exit']);
});

test('rapid repeated clicks perform one transition at a time and allow the next gesture', async () => {
  const f = fixture();
  let finish;
  f.target.requestFullscreen = () => {
    f.calls.push('enter');
    return new Promise(resolve => { finish = resolve; });
  };
  const first = f.controller.toggle();
  await Promise.all([f.controller.toggle(), f.controller.toggle()]);
  assert.deepEqual(f.calls, ['enter']);
  f.doc.fullscreenElement = f.target;
  finish();
  await first;
  assert.equal(f.updates.at(-1).fullscreen, true, 'settlement sync works without an event');
  let finishExit;
  f.doc.exitFullscreen = () => {
    f.calls.push('exit');
    return new Promise(resolve => { finishExit = resolve; });
  };
  const exit = f.controller.toggle();
  await f.controller.toggle();
  assert.deepEqual(f.calls, ['enter', 'exit']);
  f.doc.fullscreenElement = null;
  finishExit();
  await exit;
  assert.equal(f.updates.at(-1).fullscreen, false);
});

test('unsupported or policy-disabled APIs are no-ops and signal hidden state', async () => {
  for (const disabled of [false, true]) {
    const doc = new EventTarget();
    doc.fullscreenEnabled = false;
    const target = disabled ? { requestFullscreen: () => assert.fail('disabled API called') } : {};
    doc.exitFullscreen = () => assert.fail('unsupported exit');
    const states = [];
    const controller = createFullscreenController(doc, target, (supported, fullscreen) => states.push({ supported, fullscreen }));
    await controller.toggle();
    assert.deepEqual(states, [{ supported: false, fullscreen: false }]);
  }
});

test('button integration fullscreens the document containing sibling controls and syncs all visuals', async () => {
  const f = fixture();
  const button = new EventTarget();
  const attrs = new Map();
  button.setAttribute = (key, value) => attrs.set(key, value);
  button.dataset = {};
  f.doc.documentElement = f.target;
  f.doc.getElementById = id => id === 'fullscreen-btn' ? button : {};
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  globalThis.document = f.doc;
  globalThis.window = new EventTarget();
  let refreshes = 0;
  try {
    const { installFullscreenButton } = await import('../src/game/fullscreen.ts');
    installFullscreenButton({ scale: { refresh: () => refreshes++ } });
    assert.equal(button.hidden, false);
    assert.equal(button.title, 'Enter fullscreen');
    button.dispatchEvent(new Event('click'));
    await Promise.resolve();
    assert.equal(f.doc.fullscreenElement, f.doc.documentElement, 'button and overlay siblings must be included');
    assert.equal(attrs.get('aria-label'), 'Exit fullscreen');
    assert.equal(attrs.get('aria-pressed'), 'true');
    assert.equal(button.title, 'Exit fullscreen');
    assert.equal(button.dataset.fullscreen, 'true');
    f.doc.fullscreenElement = null;
    f.doc.dispatchEvent(new Event('fullscreenchange'));
    assert.equal(attrs.get('aria-label'), 'Enter fullscreen');
    assert.equal(button.title, 'Enter fullscreen');
    assert.equal(button.dataset.fullscreen, 'false');
    assert.equal(attrs.get('aria-pressed'), 'false');
    f.doc.fullscreenEnabled = false;
    f.doc.dispatchEvent(new Event('fullscreenerror'));
    assert.equal(button.hidden, true);
    assert.ok(refreshes >= 3);
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});
