'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const BF = require('../lib.js');

const sq = (x, y, d) => [[x, y], [x + d, y], [x + d, y + d], [x, y + d], [x, y]];

test('landOf: Bundesland aus der ersten Stelle der GKZ', () => {
  assert.equal(BF.landOf('31502').name, 'Niederösterreich');
  assert.equal(BF.landOf('90001').wh, 'wien');
  assert.equal(BF.landOf('60101').name, 'Steiermark');
  assert.equal(BF.landOf('123'), null);
  assert.equal(BF.landOf(''), null);
});

test('bezOf: NÖ-Bezirke und Wien', () => {
  assert.equal(BF.bezOf('31502').name, 'Melk');
  assert.equal(BF.bezOf('31502').wh, 'niederoesterreich/melk');
  assert.equal(BF.bezOf('90001').wien, true);
  assert.equal(BF.bezOf('60101'), null);
});

test('wienBezGkz: Bezirk aus der Wiener Postleitzahl', () => {
  assert.equal(BF.wienBezGkz('1010'), '90101');
  assert.equal(BF.wienBezGkz('1120'), '91201');
  assert.equal(BF.wienBezGkz('1230'), '92301');
  assert.equal(BF.wienBezGkz('1300'), null);
  assert.equal(BF.wienBezGkz('3100'), null);
  assert.equal(BF.wienBezGkz(''), null);
  assert.equal(BF.wienBezGkz(undefined), null);
});

test('wepStufe: Wertziffern 0 bis 3 und unbekannte', () => {
  assert.equal(BF.wepStufe('0'), 'keine besondere');
  assert.equal(BF.wepStufe('3'), 'hoch');
  assert.equal(BF.wepStufe('7'), 'unbekannt (7)');
});

test('noFormula: Excel-Formeln entschärfen', () => {
  for (const v of ['=SUM(A1)', '+1', '-1', '@x', '\tx', '\rx']) assert.equal(BF.noFormula(v), "'" + v);
  assert.equal(BF.noFormula('Wiese'), 'Wiese');
  assert.equal(BF.noFormula(null), '');
  assert.equal(BF.asText('01704'), '="01704"');
  assert.equal(BF.asText('a"b'), '="ab"');
  assert.equal(BF.asText(''), '');
});

test('safeUrl: nur http und https', () => {
  assert.equal(BF.safeUrl('willhaben.at/x'), 'https://willhaben.at/x');
  assert.equal(BF.safeUrl('http://a.at/'), 'http://a.at/');
  assert.equal(BF.safeUrl('javascript:alert(1)'), '');
  assert.equal(BF.safeUrl('data:text/html,x'), '');
  assert.equal(BF.safeUrl(''), '');
});

test('hav: Abstand in Metern', () => {
  const d = BF.hav([16.3725, 48.2085], [16.3725, 48.2185]);
  assert.ok(Math.abs(d - 1112) < 3, String(d));
});

test('areaCentroid: Fläche und Schwerpunkt, Loch wird abgezogen', () => {
  const p = { type: 'Polygon', coordinates: [sq(16, 48, 0.001)] };
  const a = BF.areaCentroid(p);
  assert.ok(Math.abs(a.c[0] - 16.0005) < 1e-5 && Math.abs(a.c[1] - 48.0005) < 1e-5);
  assert.ok(Math.abs(a.area - 8300) < 100, String(a.area));
  const holed = BF.areaCentroid({ type: 'Polygon', coordinates: [sq(16, 48, 0.001), sq(16.00025, 48.00025, 0.0005)] });
  assert.ok(Math.abs(holed.area - a.area * 0.75) < 10, String(holed.area));
  assert.equal(BF.areaCentroid({ type: 'Point', coordinates: [16, 48] }), null);
});

test('inPoly: innen, außen und im Loch', () => {
  const g = { type: 'Polygon', coordinates: [sq(0, 0, 10), sq(4, 4, 2)] };
  assert.equal(BF.inPoly([1, 1], g), true);
  assert.equal(BF.inPoly([11, 1], g), false);
  assert.equal(BF.inPoly([5, 5], g), false);
  assert.equal(BF.inPoly([1, 1], { type: 'MultiPolygon', coordinates: [[sq(5, 5, 1)], [sq(0, 0, 2)]] }), true);
});

test('gBox und gPoint: auch leer und GeometryCollection', () => {
  assert.deepEqual(BF.gBox({ type: 'LineString', coordinates: [[1, 2], [3, 0]] }), [1, 0, 3, 2]);
  const empty = BF.gBox({ type: 'Polygon', coordinates: [] });
  assert.ok(empty[0] > empty[2], 'leere Box liegt nie im Ausschnitt');
  assert.deepEqual(BF.gBox({ type: 'GeometryCollection', geometries: [{ type: 'Point', coordinates: [1, 1] }, { type: 'Point', coordinates: [2, 3] }] }), [1, 1, 2, 3]);
  assert.deepEqual(BF.gPoint({ type: 'Point', coordinates: [1, 2] }), [1, 2]);
  assert.deepEqual(BF.gPoint({ type: 'Polygon', coordinates: [sq(0, 0, 2)] }), [1, 1]);
  assert.deepEqual(BF.gPoint({ type: 'GeometryCollection', geometries: [{ type: 'Point', coordinates: [] }, { type: 'Point', coordinates: [5, 6] }] }), [5, 6]);
  assert.equal(BF.gPoint({ type: 'Polygon', coordinates: [] }), null);
  assert.equal(BF.gPoint(null), null);
  // U-Form: Mitte der Box liegt außerhalb, dann der erste Punkt
  const u = { type: 'Polygon', coordinates: [[[0, 0], [3, 0], [3, 3], [2, 3], [2, 1], [1, 1], [1, 3], [0, 3], [0, 0]]] };
  assert.deepEqual(BF.gPoint(u), [0, 0]);
});

test('merc: Web-Mercator', () => {
  const m = BF.merc(0, 0);
  assert.ok(Math.abs(m[0]) < 1e-6 && Math.abs(m[1]) < 1e-6);
  assert.ok(Math.abs(BF.merc(180, 0)[0] - 20037508.34) < 1e-3);
});
