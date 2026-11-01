import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function boot() {
  const events = new EventEmitter();
  const messages = [];
  const alerts = [];
  let constructions = 0;
  const source = readFileSync(new URL('../src/game/main.ts', import.meta.url), 'utf8')
    .replace('import.meta.env.DEV', 'false');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const dependencies = {
    phaser: { Game: class {
      constructor(config) {
        constructions++;
        assert.equal(config.audio, undefined, 'use the normal Phaser audio unlock');
        this.events = events;
        config.callbacks.preBoot(this);
      }
    } },
    '@vercel/analytics': {}, '@vercel/speed-insights': {},
    './config': { gameConfig: {} },
    './fullscreen': { installFullscreenButton() {} },
    './orientation': { installOrientationGate() {} },
    './vampireCursor': { installVampireCursor() {} },
    '../data/gameSettings': { gameSettings: { install() {} } },
  };
  runInNewContext(outputText, {
    exports: {}, require: name => dependencies[name],
    location: { hostname: 'localhost' },
    window: { parent: { postMessage: (...args) => messages.push(args) } },
    document: {
      createElement: () => ({ setAttribute() {} }),
      getElementById: () => ({ append: message => alerts.push(message) }),
    },
  });
  return { events, messages, alerts, constructions };
}

test('boot is immediate but iframe ready waits for the original menu, once', () => {
  const game = boot();
  assert.equal(game.constructions, 1);
  assert.deepEqual(game.messages, []);
  game.events.emit('menu-ready');
  game.events.emit('menu-ready');
  assert.deepEqual(game.messages, [['count-dawn:ready', '*']]);
});

test('critical preload failure shows recovery text without falsely marking the iframe ready', () => {
  const game = boot();
  game.events.emit('boot-load-error');
  game.events.emit('boot-load-error');
  assert.deepEqual(game.messages, []);
  assert.equal(game.alerts.length, 1);
  assert.match(game.alerts[0].textContent, /could not load.*Reload/);
});
