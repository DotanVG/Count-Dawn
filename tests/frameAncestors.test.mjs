import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const required = [
  "'self'", 'https://*.itch.io', 'https://itch.io', 'https://html-classic.itch.zone',
  'https://html.itch.zone', 'https://*.itch.zone', 'https://*.hwcdn.net',
  'https://kamario.games', 'https://*.kamario.games',
];

test('frame-ancestors allows itch.io and kamario.games only (CSP and report-only)', () => {
  const headers = config.headers.flatMap(rule => rule.headers);
  for (const key of ['content-security-policy', 'content-security-policy-report-only']) {
    const header = headers.find(h => h.key.toLowerCase() === key);
    assert.ok(header, key);
    const ancestors = header.value.split(';').map(d => d.trim().split(/\s+/)).find(([name]) => name === 'frame-ancestors');
    assert.ok(ancestors, key);
    assert.deepEqual(ancestors.slice(1).sort(), [...required].sort(), key);
  }
  assert.ok(!headers.some(h => h.key.toLowerCase() === 'x-frame-options'));
});