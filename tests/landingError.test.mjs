import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const handler = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function landing() {
  const listeners = new Map();
  const button = { disabled: false };
  const status = { textContent: 'Ready.' };
  const classes = new Set();
  const window = { addEventListener: (name, callback) => listeners.set(name, callback) };
  class HTMLScriptElement {
    constructor(id) { this.id = id; }
  }
  const entry = new HTMLScriptElement('game-entry');
  runInNewContext(handler, {
    window, HTMLScriptElement,
    document: {
      documentElement: { classList: { contains: name => classes.has(name) } },
      getElementById: id => id === 'start-night' ? button : status,
      querySelector: () => entry,
    },
  });
  return { button, status, classes, error: target => listeners.get('error')({ target }),
    rejection: () => listeners.get('unhandledrejection')?.(), script: id => id === 'game-entry' ? entry : new HTMLScriptElement(id), window };
}

test('optional scripts and unrelated runtime failures leave the ready Start button usable', () => {
  const page = landing();
  for (const id of ['analytics', 'speed-insights', 'third-party']) page.error(page.script(id));
  page.error(page.window);
  page.rejection();
  assert.equal(page.button.disabled, false);
  assert.equal(page.status.textContent, 'Ready.');
});

test('game entry load failure disables Start and reports the failure', () => {
  const page = landing();
  page.error(page.script('game-entry'));
  assert.equal(page.button.disabled, true);
  assert.match(page.status.textContent, /The game could not load/);
});

test('late game entry errors do not replace an active game with a landing error', () => {
  const page = landing();
  page.classes.add('game-active');
  page.error(page.script('game-entry'));
  assert.equal(page.button.disabled, false);
});
