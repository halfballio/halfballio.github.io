#!/usr/bin/env node
// Check shots.bin: does this version of the game accept it, and does every grade deal from it?
//   node tools/check-shots.js [--restamp]   (--restamp rewrites the file's version to the game's current one)
'use strict';
const fs = require('fs'), path = require('path'), ROOT = path.resolve(__dirname, '..');
const { JSDOM, VirtualConsole } = require('jsdom');
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, src)=>/three/.test(src) ? '' : `<script>${fs.readFileSync(path.join(ROOT, src), 'utf8')}</script>`);
const vc = new VirtualConsole(); vc.on('jsdomError', ()=>{});
const w = new JSDOM(html, {url: 'https://halfball.local/#test', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, beforeParse(w){
  w.matchMedia = () => ({matches: false, addEventListener(){}, removeEventListener(){}}); w.fetch = () => Promise.reject(new Error('offline'));
  w.HTMLCanvasElement.prototype.getContext = () => null; w.scrollTo = () => {};
  w.localStorage.setItem('halfball-settings', JSON.stringify({sv: 2, sv3: 1, sv4: 1, sv5: 1, tut: 1, stanceSet: 1, tutSeen: {}, sound: '0', task: 'shoot'}));
  w.localStorage.setItem('halfball-stats', JSON.stringify({log: [], shoot: {g: 13, best: 13, pts: 0, v: 2}, sessions: []}));
}}).window, L = w.__lib;
const file = path.join(ROOT, 'shots.bin');
let buf = fs.readFileSync(file);
if(process.argv.includes('--restamp')){
  const vl = buf[4] | (buf[5] << 8), ver = Buffer.from(L.libVer(), 'utf8');
  buf = Buffer.concat([buf.subarray(0, 4), Buffer.from([ver.length & 255, ver.length >> 8]), ver, buf.subarray(6 + vl)]);
  fs.writeFileSync(file, buf); console.log('restamped to', L.libVer());
}
const S = L.parseShipped(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
L.setShipped(S);
console.log('file version', S.ver, '· game', L.libVer(), '·', L.shippedOk() ? 'accepted' : 'REJECTED');
let bad = 0;
for(const k of L.LIB_STEPS){
  L.setTable(L.tableFor(k));
  let ok = 0, zones = 0, n = 40;
  for(let i = 0; i < n; i++){ const s = L.fromLibrary(k, Math.floor(Math.random()*5)); if(s && L.reachOf(s) <= L.reachMax() + 1e-9 && L.obRunOk(s)){ ok++; if(s.zone) zones++; } }
  const wantZone = L.isZoneStep(k);
  if(ok < n*.8 || (wantZone && zones !== ok) || (!wantZone && zones)) bad++;
  console.log(`step ${k} (${L.tableFor(k)} ft): ${S.steps[k] ? S.steps[k].cnt : 0} stored · dealt ${ok}/${n}${wantZone ? ` · with zones ${zones}` : ''}`);
}
// on the other table sizes the stored shots are scaled and checked again as they're dealt: each must still pot (and land in its zone) (and every dealt cue ball within reach of the rail behind it, every object ball as near the pocket as its cut asks)
for(const k of L.LIB_STEPS) for(const t of ['7', '8', '9']){
  if(t === L.tableFor(k)) continue;
  L.setTable(t);
  let ok = 0, n = 20;
  for(let i = 0; i < n; i++){ const s = L.fromLibrary(k, Math.floor(Math.random()*5)); if(s && L.reachOf(s) <= L.reachMax() + 1e-9 && L.obRunOk(s) && L.isZoneStep(k) === !!s.zone && L.dealtOk(s, k)) ok++; }
  if(ok < n*.9) bad++;
  console.log(`step ${k} scaled to ${t} ft: dealt and re-checked ${ok}/${n}`);
}
// thin cuts come up near the pocket (obRunOk): every fraction a grade stores must keep enough shots that pass it, on its own table
const FRAC_MIN = 40;
for(const k of L.LIB_STEPS){
  const st = S.steps[k]; if(!st) continue;
  L.setTable(st.table);
  const n = {};
  for(let j = 0; j < st.cnt; j++){ const r = L.decodeRec(st.data, j*L.REC), s = L.shotOf(r, +k, false); if(L.obRunOk(s) && L.reachOf(s) <= L.reachMax() + 1e-9) n[r.frac] = (n[r.frac] || 0) + 1; }
  const thin = Object.keys(st.byFrac).filter(f=>(n[f] || 0) < FRAC_MIN);
  if(thin.length) bad++;
  console.log(`step ${k}: dealable by fraction ${Object.keys(st.byFrac).map(f=>f + ' ' + (n[f] || 0)).join(', ')}${thin.length ? ' · TOO FEW: ' + thin.join(', ') : ''}`);
}
console.log(bad ? `${bad} step(s) look wrong` : 'all steps deal from the library, on every table size');
process.exit(bad ? 1 : 0);
