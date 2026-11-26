// Reine Rechenfunktionen des Brachflächen-Finders: ohne DOM und ohne Netz, damit sie mit `node --test` prüfbar sind.
// Im Browser stehen sie unter window.BF, in Node über require('./lib.js').
(function (root) {
  'use strict';
  // Bezirke Niederösterreichs nach den ersten drei Stellen der Gemeindekennziffer:
  // [Name, Pfad bei willhaben, Sitz der zuständigen Grundverkehrsbehörde laut Land NÖ]
  var NOE_BEZ = {
    301: ['Krems an der Donau (Stadt)', 'krems-an-der-donau', 'Waidhofen an der Thaya'], 302: ['St. Pölten (Stadt)', 'sankt-poelten', 'Lilienfeld'],
    303: ['Waidhofen an der Ybbs (Stadt)', 'waidhofen-an-der-ybbs', 'Melk'], 304: ['Wiener Neustadt (Stadt)', 'wiener-neustadt', 'Bruck an der Leitha'],
    305: ['Amstetten', 'amstetten', 'Melk'], 306: ['Baden', 'baden', 'Bruck an der Leitha'], 307: ['Bruck an der Leitha', 'bruck-an-der-leitha', 'Bruck an der Leitha'],
    308: ['Gänserndorf', 'gaenserndorf', 'Hollabrunn'], 309: ['Gmünd', 'gmuend', 'Waidhofen an der Thaya'], 310: ['Hollabrunn', 'hollabrunn', 'Hollabrunn'],
    311: ['Horn', 'horn', 'Waidhofen an der Thaya'], 312: ['Korneuburg', 'korneuburg', 'Hollabrunn'], 313: ['Krems-Land', 'krems-land', 'Waidhofen an der Thaya'],
    314: ['Lilienfeld', 'lilienfeld', 'Lilienfeld'], 315: ['Melk', 'melk', 'Melk'], 316: ['Mistelbach', 'mistelbach', 'Hollabrunn'],
    317: ['Mödling', 'moedling', 'Bruck an der Leitha'], 318: ['Neunkirchen', 'neunkirchen', 'Bruck an der Leitha'], 319: ['St. Pölten-Land', 'sankt-poelten-land', 'Lilienfeld'],
    320: ['Scheibbs', 'scheibbs', 'Melk'], 321: ['Tulln', 'tulln', 'Lilienfeld'], 322: ['Waidhofen an der Thaya', 'waidhofen-an-der-thaya', 'Waidhofen an der Thaya'],
    323: ['Wiener Neustadt-Land', 'wiener-neustadt-land', 'Bruck an der Leitha'], 325: ['Zwettl', 'zwettl', 'Waidhofen an der Thaya']
  };
  // Bundesland nach der ersten Stelle der Gemeindekennziffer: [Name, Pfad bei willhaben, Landes-GIS für die Widmung]
  var BUNDESLAND = {
    1: ['Burgenland', 'burgenland', 'GeoDaten Burgenland', 'https://geodaten.bgld.gv.at/'], 2: ['Kärnten', 'kaernten', 'KAGIS', 'https://kagis.ktn.gv.at/'],
    3: ['Niederösterreich', 'niederoesterreich', 'NÖ Atlas', 'https://atlas.noe.gv.at/'], 4: ['Oberösterreich', 'oberoesterreich', 'DORIS', 'https://www.doris.at/'],
    5: ['Salzburg', 'salzburg', 'SAGIS', 'https://www.salzburg.gv.at/sagis'], 6: ['Steiermark', 'steiermark', 'GIS-Steiermark', 'https://gis.stmk.gv.at/'],
    7: ['Tirol', 'tirol', 'tiris', 'https://maps.tirol.gv.at/'], 8: ['Vorarlberg', 'vorarlberg', 'VoGIS', 'https://vogis.cnv.at/atlas/'],
    9: ['Wien', 'wien', 'Flächenwidmung Wien', 'https://www.wien.gv.at/flaechenwidmung/public/']
  };
  function landOf(gkz) { var d = String(gkz || '').replace(/\D/g, '').charAt(0), l = String(gkz || '').replace(/\D/g, '').length === 5 && BUNDESLAND[d]; return l ? { code: Number(d), name: l[0], wh: l[1], gis: l[2], gisUrl: l[3] } : null; }
  function bezOf(gkz) { var c = Math.floor(Number(gkz) / 100); return NOE_BEZ[c] ? { code: c, name: NOE_BEZ[c][0], wh: 'niederoesterreich/' + NOE_BEZ[c][1], gv: NOE_BEZ[c][2] } : c >= 900 && c < 1000 ? { code: c, name: 'Wien', wh: 'wien', wien: true } : null; }

  // Leere Koordinaten und GeometryCollection abfangen: Eine leere Box liegt nie im Ausschnitt
  function gBox(g) {
    var b = [180, 90, -180, -90];
    (function walk(x) {
      if (!x) return;
      if (x.type === 'GeometryCollection') { (x.geometries || []).forEach(walk); return; }
      (function w(c) { if (!Array.isArray(c) || !c.length) return; if (typeof c[0] === 'number') { b[0] = Math.min(b[0], c[0]); b[1] = Math.min(b[1], c[1]); b[2] = Math.max(b[2], c[0]); b[3] = Math.max(b[3], c[1]); } else c.forEach(w); })(x.coordinates);
    })(g);
    return b;
  }
  function gFirst(c) { while (Array.isArray(c) && Array.isArray(c[0])) c = c[0]; return Array.isArray(c) && typeof c[0] === 'number' ? c : null; }
  function gPoint(g) {
    if (!g) return null;
    if (g.type === 'GeometryCollection') { var gs = g.geometries || []; for (var i = 0; i < gs.length; i++) { var p = gPoint(gs[i]); if (p) return p; } return null; }
    var c0 = g.coordinates; if (!Array.isArray(c0) || !c0.length) return null;
    if (g.type === 'Point') return c0;
    if (g.type === 'LineString') return c0[Math.floor(c0.length / 2)];
    if (g.type === 'MultiLineString') { var l = c0[0] || []; return l[Math.floor(l.length / 2)] || gFirst(c0); }
    var b = gBox(g), c = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
    return inPoly(c, g) ? c : gFirst(c0);
  }

  var R_EARTH = 6371008.8, RAD = Math.PI / 180;
  function hav(a, b) {
    var s = Math.sin((b[1] - a[1]) * RAD / 2), t = Math.sin((b[0] - a[0]) * RAD / 2);
    return 2 * R_EARTH * Math.asin(Math.sqrt(s * s + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * t * t));
  }
  function polys(geom) { return geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : []; }
  // Fläche in m² und Schwerpunkt eines Polygons in Längen-/Breitengraden
  function areaCentroid(geom) {
    var A = 0, cx = 0, cy = 0;
    polys(geom).forEach(function (poly) {
      poly.forEach(function (ring, ri) {
        var a = 0, x = 0, y = 0;
        for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          var f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
          a += f; x += (ring[j][0] + ring[i][0]) * f; y += (ring[j][1] + ring[i][1]) * f;
        }
        a /= 2; if (!a) return;
        var s = Math.abs(a) * (ri === 0 ? 1 : -1);
        A += s; cx += x / (6 * a) * s; cy += y / (6 * a) * s;
      });
    });
    if (A <= 0) return null;
    var lat = cy / A;
    return { area: A * RAD * RAD * R_EARTH * R_EARTH * Math.cos(lat * RAD), c: [cx / A, lat] };
  }
  function inPoly(pt, geom) {
    return polys(geom).some(function (poly) {
      var inside = false;
      poly.forEach(function (ring, ri) {
        var c = false;
        for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          if ((ring[i][1] > pt[1]) !== (ring[j][1] > pt[1]) &&
              pt[0] < (ring[j][0] - ring[i][0]) * (pt[1] - ring[i][1]) / (ring[j][1] - ring[i][1]) + ring[i][0]) c = !c;
        }
        if (ri === 0) inside = c; else if (c) inside = false;
      });
      return inside;
    });
  }
  function merc(lng, lat) { return [lng * 20037508.34 / 180, Math.log(Math.tan((90 + lat) * Math.PI / 360)) / RAD * 20037508.34 / 180]; }

  var WEP_STUFE = { 0: 'keine besondere', 1: 'gering', 2: 'mittel', 3: 'hoch' };
  function wepStufe(d) { return WEP_STUFE[d] || 'unbekannt (' + d + ')'; }

  function safeUrl(u) { u = String(u || '').trim(); if (!u) return ''; if (!/^https?:\/\//i.test(u)) u = 'https://' + u; try { var x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch (e) { return ''; } }

  // Text, der mit = + - @ oder Tab beginnt, würde Excel als Formel ausführen: mit Apostroph als Text markieren
  function noFormula(v) { var s = v == null ? '' : String(v); return /^[=+\-@\t\r]/.test(s) ? "'" + s : s; }
  function asText(v) { return v ? '="' + String(v).replace(/"/g, '') + '"' : ''; }

  // Wien: Bezirks-Gemeindekennziffer aus der Postleitzahl (1120 -> 91201); sonst null
  function wienBezGkz(plz) { var m = /^1(0[1-9]|1\d|2[0-3])0$/.exec(String(plz || '').trim()); return m ? '9' + m[1] + '01' : null; }

  var BF = { NOE_BEZ: NOE_BEZ, BUNDESLAND: BUNDESLAND, landOf: landOf, bezOf: bezOf, R_EARTH: R_EARTH, RAD: RAD, hav: hav, polys: polys,
    areaCentroid: areaCentroid, inPoly: inPoly, merc: merc, gBox: gBox, gFirst: gFirst, gPoint: gPoint, WEP_STUFE: WEP_STUFE, wepStufe: wepStufe,
    safeUrl: safeUrl, noFormula: noFormula, asText: asText, wienBezGkz: wienBezGkz };
  if (typeof module === 'object' && module.exports) module.exports = BF; else root.BF = BF;
})(typeof window !== 'undefined' ? window : this);
