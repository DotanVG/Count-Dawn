import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const html = read('index.html');

test('game boots directly without an HTML entry gate or deferred engine import', () => {
  assert.match(html, /src="\/src\/game\/main.ts"/);
  assert.match(html, /id="boot-loader">Waking the Count/);
  assert.doesNotMatch(html, /landing-shell|id="landing"|start-night|game-active/);
  const main = read('src/game/main.ts');
  assert.match(main, /new Phaser.Game\(/);
  assert.doesNotMatch(main, /import\(|AudioContext|landing/);
  assert.doesNotMatch(read('src/scenes/GameScene.ts'), /prepareLandingStart|enterGameShell/);
  for (const path of ['src/game/entry.ts', 'src/game/landing.ts']) {
    assert.equal(existsSync(new URL(`../${path}`, import.meta.url)), false);
  }
});

test('semantic game content is clipped before scripts run and never captures focus or pointers', () => {
  const section = html.match(/<section id="game-description"[\s\S]*?<\/section>/)[0];
  assert.match(section, /class="visually-hidden"/);
  assert.match(section, /<h1>Count Dawn<\/h1>/);
  assert.match(section, /WASD/);
  assert.match(section, /joystick/);
  for (const anchor of section.matchAll(/<a\b[^>]*>/g)) assert.match(anchor[0], /tabindex="-1"/);
  assert.doesNotMatch(section, /<button|<input|<details/);
  const css = html.match(/\.visually-hidden\s*{([^}]+)}/)[1];
  for (const rule of ['position: absolute', 'width: 1px', 'height: 1px', 'clip-path: inset(50%)', 'pointer-events: none']) {
    assert.ok(css.includes(rule), rule);
  }
  assert.doesNotMatch(html + read('src/game/main.ts'), /navigator.userAgent|Googlebot|bingbot/i);
  assert.match(html, /<noscript>[\s\S]*?WASD[\s\S]*?https:\/\/dotanv.itch.io\/count-dawn[\s\S]*?<\/noscript>/);
  const noscript = html.match(/<noscript>([\s\S]*?)<\/noscript>/)[1];
  assert.match(noscript, /#game-root, #fullscreen-btn, #rotate-overlay, #vampire-cursor { display: none !important; }/);
  assert.match(noscript, /color: #e8ddff/);
  assert.match(noscript, /position: static/);
});

test('SEO metadata, free game schema and crawler URLs describe production consistently', () => {
  const production = 'https://count-dawn.vercel.app/';
  assert.match(html, /<title>Count Dawn - Vampire Survival Browser Game<\/title>/);
  for (const tag of ['description', 'og:type', 'og:url', 'og:title', 'og:description', 'og:image', 'og:image:alt', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'twitter:image:alt']) {
    assert.match(html, new RegExp(`(?:name|property)="${tag}"\\s+content="[^"&][^"]+"`));
  }
  assert.ok(html.includes(`<link rel="canonical" href="${production}"`));
  const schema = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(schema['@type'], ['VideoGame', 'WebApplication']);
  assert.equal(schema.url, production);
  assert.equal(schema.offers.url, production);
  assert.equal(schema.offers.price, 0);
  assert.equal(schema.offers.priceCurrency, 'USD');
  assert.equal(schema.offers.availability, 'https://schema.org/InStock');
  for (const image of [schema.image, schema.screenshot]) {
    assert.equal(new URL(image).origin, new URL(production).origin);
    assert.ok(existsSync(new URL(`../public${new URL(image).pathname}`, import.meta.url)));
  }
  assert.match(read('public/sitemap.xml'), /<loc>https:\/\/count-dawn.vercel.app\/<\/loc>/);
  assert.equal(read('public/robots.txt').trim().replaceAll('\r', ''), `User-agent: *\nAllow: /\n\nSitemap: ${production}sitemap.xml`);
});
