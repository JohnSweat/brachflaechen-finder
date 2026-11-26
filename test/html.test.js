'use strict';
// index.html: Skript ist gültiges JavaScript, keine doppelten IDs, alle per $('…') genutzten IDs existieren
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('Inline-Skript lässt sich parsen', () => {
  const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(blocks.length >= 1);
  blocks.forEach((b) => new vm.Script(b));
});

test('IDs eindeutig und vollständig', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  assert.deepEqual(dup, []);
  const used = new Set([...html.matchAll(/\$\('([A-Za-z0-9_-]+)'\)/g)].map((m) => m[1]));
  const missing = [...used].filter((x) => !ids.includes(x));
  assert.deepEqual(missing, []);
});

test('lib.js wird vor dem Hauptskript geladen', () => {
  const lib = html.indexOf('<script src="lib.js">'), main = html.search(/<script>\s/);
  assert.ok(lib > 0 && lib < main);
});

test('Keine Konfliktmarker und keine rohen BOM-Zeichen', () => {
  assert.ok(!/^(<<<<<<<|=======|>>>>>>>)/m.test(html));
  assert.ok(!html.includes('﻿'));
});
