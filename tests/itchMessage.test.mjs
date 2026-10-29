import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../itch/index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function page() {
  const listeners = new Map();
  const classes = new Set(['is-shown']);
  const element = { addEventListener() {}, classList: {
    remove: name => classes.delete(name), add: name => classes.add(name),
  } };
  const context = {
    window: { addEventListener: (event, callback) => listeners.set(event, callback) },
    document: { getElementById: () => element },
  };
  runInNewContext(script, context);
  return { context, classes, message: event => listeners.get('message')(event) };
}

test('itch ignores ready messages from untrusted, opaque, and lookalike origins', () => {
  for (const origin of ['https://evil.example', 'null', '',
    'http://count-dawn.vercel.app', 'https://count-dawn.vercel.app.evil.example']) {
    const frame = page();
    frame.message({ origin, data: 'count-dawn:ready' });
    assert.equal(frame.context.ready, false, origin);
    assert.equal(frame.classes.has('is-shown'), true, origin);
  }
});

test('itch only accepts the ready payload from the exact game origin', () => {
  const frame = page();
  const origin = 'https://count-dawn.vercel.app';
  frame.message({ origin, data: 'unrelated-message' });
  assert.equal(frame.context.ready, false);
  frame.message({ origin, data: 'count-dawn:ready' });
  assert.equal(frame.context.ready, true);
  assert.equal(frame.classes.has('is-shown'), false);
});
