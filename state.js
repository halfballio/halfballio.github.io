// Players and their saved settings and stats, the shared mutable state (S), the shot log helpers, and Back up / Restore.
import {plOpen, renderPlMenu, renderStats} from './main.js';
import {isDrill} from './grades.js';
import {notesTop} from './whatsnew.js';
import {$, ALL, idx} from './geom.js';

// Shared mutable state: the top-level lets that more than one module reassigns live here as fields (an imported binding
// can be read live but not assigned from the importing side), so every module sees and sets the same value.
export const S = {
  shot: null,   // the shot on the table
  answered: false,   // called (or played) already
  anim: null,   // the shot animation running, if any
  RUN: null,   // the Run-outs rack
  walk: null,   // walking round the cue ball: {ang, el, blend}
  walkDrag: null,   // the drag that walks
  ME: null,   // the player (set in loadPicked)
  meId: null,   // their id
  plPick: null,   // set while the title screen waits for a pick
  ctlGlideMs: 0,   // set before paintCtl: the tip dot and speed fill glide there
  flashArmed: false,   // Flash: Start has been pressed
};
// ---------- players: up to 4, each with their own settings and stats ----------
// The list is in 'halfball-profiles'. A player's keys end '@id', except p0: whoever played before players came in keeps the old keys.
// Picking a player reloads the page; the pick lasts the browser session, so coming back with 2+ players asks again.
export const SHOOT_GRADES = ['F','D-','D','D+','C-','C','C+','B-','B','B+','A-','A','A+','S'];   // one grade per skill step (GRADE_STEP, below); S is the top
// Saved grades were once on a 15-grade ladder whose C (your aim line) repeated C-. stats.shoot.v 2: on this ladder. Moving a
// grade over keeps its skill step: the old C becomes the next step (any angle, the new C), everything above moves down one
export const SHOOT_V = 2, oldShootG = g => g >= 6 ? g - 1 : g;
export const PL_MAX = 4, TEST = location.hash === '#test';   // the library tools run on the old keys, no picker
export const plKey = (k, id) => id === 'p0' ? k : k + '@' + id;
const lsGet = k => { try{ return localStorage.getItem(lsKey(k)); }catch(e){ return null; } };
export let PL = null;
export function loadProfiles(){
  try{ PL = JSON.parse(lsGet('halfball-profiles')); }catch(e){}
  if(!PL || !Array.isArray(PL.list)) PL = {list: []};
  if(!TEST && !PL.list.length && (lsGet('halfball-settings') || lsGet('halfball-stats'))){ PL.list.push({id: 'p0', name: 'Player 1'}); savePL(); }   // played before players: all of it becomes Player 1, nothing moves
}
export const savePL = () => { try{ localStorage.setItem(lsKey('halfball-profiles'), JSON.stringify(PL)); }catch(e){} };
export const plEsc = t => String(t).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
export function plGrade(id){   // their Shoot grade, for the picker
  let s = null; try{ s = JSON.parse(lsGet(plKey('halfball-stats', id))); }catch(e){}
  return statsGrade(s);
}
export function statsGrade(s){
  if(!s || (!s.shoot && !(s.log || []).length)) return 'New';
  const g = s.shoot ? ((s.shoot.v | 0) < SHOOT_V ? oldShootG(s.shoot.g | 0) : s.shoot.g | 0) : 0;   // not moved over yet: they haven't played since
  return SHOOT_GRADES[Math.min(Math.max(0, g), SHOOT_GRADES.length - 1)];
}
export function playAs(id){
  if(S.plPick){   // the tap that picks also wakes the music: browsers only allow sound after a tap, and a reload would lose it
    const p = PL.list.find(q=>q.id === id), go = S.plPick; if(!p) return; S.plPick = null;
    if(window.Music && Music.unlock) Music.unlock();
    go(p); return;
  }
  PL.cur = id; PL.at = Date.now(); savePL(); try{ sessionStorage.setItem(lsKey('halfball-go'), id); }catch(e){} location.reload(); }   // a pick lasts this one load: coming back to the site always starts at the title screen
let picked = null;
export function loadPicked(){
  try{ picked = sessionStorage.getItem(lsKey('halfball-go')); sessionStorage.removeItem(lsKey('halfball-go')); }catch(e){}
  if(!picked && PL.at && Date.now() - PL.at < 15000) picked = PL.cur;   // just picked, where there's no sessionStorage
  S.ME = TEST ? {id: 'p0', name: 'Test'} : PL.list.find(p=>p.id === picked) || (PL.list.length === 1 ? PL.list[0] : null);   // just one player: straight in (the picker is still in the player menu)
}
export function afterPick(){
  S.meId = S.ME.id;
  if(!TEST){ PL.cur = S.ME.id; delete PL.at; savePL(); try{ sessionStorage.setItem(lsKey('halfball-player'), S.ME.id); }catch(e){} }
}
const KEY = k => plKey(k, S.ME.id);

// ---------- settings & stats ----------
export const settings = {line:'0', walk:'1', view:'stand', mode:'ref', flash:'0', throw:'0', full:'1', cam:'line', task:'sess', len:'both', table:'9', pockets:'std'};
export function loadSettings(){
  try{ Object.assign(settings, JSON.parse(localStorage.getItem(lsKey(KEY('halfball-settings')))) || {}); }catch(e){}
  // standing back used to be inches from the cue ball (24–48, with a lean-in rule mid-table); now it's inches behind the rail (0–24):
  // the old setting maps onto the same place mid-table, where it mattered most
  if(settings.railBack == null && settings.standBack != null){ settings.railBack = Math.max(0, Math.min(24, Math.round(+settings.standBack - 28) || 0)); delete settings.standBack; }
  // the default is now 20 (it was 2): anyone still on the old default (or who never set it) moves to the new one, once
  if(!settings.rb20){ if(settings.railBack == null || +settings.railBack === 2) settings.railBack = 20; settings.rb20 = 1; }
  try{ const v = localStorage.getItem(lsKey(KEY('halfball-view'))); if(v && !localStorage.getItem(lsKey(KEY('halfball-settings')))) settings.view = v; }catch(e){}
}
export function saveSettings(){ if(restoring) return; try{ localStorage.setItem(lsKey(KEY('halfball-settings')), JSON.stringify(settings)); }catch(e){} }
export function initNotesSeen(){
  if(!(settings.notesSeen >= 0)) settings.notesSeen = lsGet(KEY('halfball-settings')) ? 0 : notesTop;   // no settings yet: a new player, nothing to catch up on; a returning one sees it all
}

const blankStats = () => ({n:0,c:0,made:0,streak:0,best:0,log:[]});
function load(){
  try{ const s = JSON.parse(localStorage.getItem(lsKey(KEY('halfball-stats')))); if(s && Array.isArray(s.log)) return s; }catch(e){}
  return blankStats();
}
let restoring = false;   // set while a backup is being written in: nothing in memory may save over it
export function save(){ if(restoring) return; try{ localStorage.setItem(lsKey(KEY('halfball-stats')), JSON.stringify(stats)); askPersist(); }catch(e){} }
// The log keeps the last LOG_MAX shots. What falls off isn't lost: it is added to per-mode running totals
// (stats.archive, see stats.js), so lifetime numbers in Stats stay whole.
const LOG_MAX = 3000;
const statArchive = () => stats.archive || (stats.archive = {v: 1, modes: {}});
export function trimLog(){
  const cut = stats.log.length - LOG_MAX; if(cut <= 0) return;
  if(window.HBStats && HBStats.fold) HBStats.fold(statArchive(), stats.log.slice(0, cut), {refs: ALL, success, lean, hot: STREAK_HOT});
  stats.log = stats.log.slice(cut);
}
// Ask the browser, once, to keep this site's storage instead of evicting it under pressure: after the first save
// (a player who has started), not on a bare visit. Some browsers ask the player; others decide quietly.
let persistAsked = false;
export function askPersist(){
  if(persistAsked || TEST) return; persistAsked = true;
  try{
    if(lsGet('halfball-persist') || !(navigator.storage && navigator.storage.persist)) return;
    localStorage.setItem(lsKey('halfball-persist'), '1');
    (navigator.storage.persisted ? navigator.storage.persisted() : Promise.resolve(false)).then(p=>p || navigator.storage.persist()).catch(()=>{});
  }catch(e){}
}
export let stats;   // set in loadStats()
export function loadStats(){
  stats = load();
  // once per player: grades (and the grades in the log, and a practice pick) onto the 14-grade ladder (see SHOOT_V)
  if(stats.shoot && (stats.shoot.v | 0) < SHOOT_V){
    const s = stats.shoot, top = SHOOT_GRADES.length - 1, mv = g => Math.min(oldShootG(g | 0), top);
    s.g = mv(s.g); if(s.best != null) s.best = mv(s.best); if(s.bestBefore != null) s.bestBefore = mv(s.bestBefore);
    for(const e of stats.log) if(e){ if(e.sg != null) e.sg = mv(e.sg); if(e.pr != null) e.pr = mv(e.pr); }   // sg, pr: only Ladder shots carry them
    if(settings.practice != null){ settings.practice = mv(+settings.practice); saveSettings(); }
    s.v = SHOOT_V; save();
  }
}
// Step back (hold Space, or the eye button): up high behind the shot, the whole table in view. Down on the shot you stay
// in your stance: let go and you're back on it as you were. Only Esc (or the stand-up button) takes you off the shot.
export const look = {k: 0, target: 0, raf: 0};


// ---------- modes ----------
export const taskOf = e => e.t || 'call';
export const sessTask = t => t==='sess' || t==='flash' || t==='shoot';   // the ladders and Flash ('sess': the old Read ladder's shots, still in older logs)
const viaAlt = e => !!e.aa && e.p===e.aa && e.pm===e.aam;
export function success(e){ return taskOf(e)==='shoot' || taskOf(e)==='practice' || taskOf(e)==='run' ? e.ok===1 : taskOf(e)==='place' ? !!e.m : (e.p===e.a && (!e.am || e.pm===e.am)) || viaAlt(e); }
export function lean(e){          // +1 too thin (overcut), -1 too full (undercut), 0 right
  if(taskOf(e)==='place') return e.m ? 0 : (e.e>0 ? 1 : -1);
  if(success(e)) return 0;
  const d = idx(e.p)-idx(e.a); if(d) return d>0 ? 1 : -1;
  if(e.am && e.pm && e.pm!==e.am){ const o = {thick:-1, center:0, thin:1}; return o[e.pm] > o[e.am] ? 1 : -1; }
  return 0;
}
function modeLog(){ return stats.log.filter(e=>taskOf(e)===settings.task && !e.gh); }   // shots taken with the ghost-ball aid aren't scored
export const statTask = () => settings.task==='flash' ? 'flash' : isDrill() ? 'practice' : settings.task==='run' ? 'run' : 'shoot';   // the Stats tab shows the mode you're in: Flash, Practice, Run-outs and the Ladder keep separate stats

let laterT = 0;
export function laterSave(){ clearTimeout(laterT); laterT = setTimeout(()=>{ save(); renderStats(); }, 30); }   // after the answer has painted
export const STREAK_HOT = 6;   // "on a streak" means more than 5 right in a row


// ---------- stats & patterns ----------
export function pct(a,b){ return b ? Math.round(100*a/b) : 0; }
// Streaks live inside one session: a new session always starts from zero.
function runs(L){
  let cur = 0, best = 0, sid;
  for(const e of L){
    if(e.sid !== sid){ cur = 0; sid = e.sid; }
    if(success(e)){ cur++; best = Math.max(best,cur); } else cur = 0;
  }
  return {cur, best};
}
export function curStreak(){   // the streak you're on right now, in the session being played
  const L = modeLog(), last = L[L.length-1];
  const a = stats.active && stats.active.task===settings.task ? stats.active : null;
  if(!last || !a || last.sid !== a.id) return 0;
  return runs(L).cur;
}

// ---------- tutorial: played on the real table, step by step ----------
export const tut = {on:false, i:0, zb:0, zt:0, zRaf:0};   // zb: how far the camera is into the close-up (0..1), eased toward zt
// ---------- Back up / Restore: a player's progress (or every player's) to a .json file, and back ----------
// The file: {format, schema, saved, players: [{id, name, settings, stats, view}]}. Only JSON is read from it, checked strictly
// (shape, types, size) and copied value by value; nothing in it is ever run. A restore replaces you, or adds a new player.
const BK_FORMAT = 'halfball-backup', BK_SCHEMA = 1, BK_MAX = 16 * 1024 * 1024, BK_KEYS = ['halfball-settings', 'halfball-stats', 'halfball-view'];
export const bk = {view: 'main', file: null, pick: 0, how: 'add', from: null, msg: '', tone: '', addedId: null, addedName: ''};
function bkRead(id){   // one player as it is saved now
  const j = k => { try{ return JSON.parse(lsGet(plKey(k, id))); }catch(e){ return null; } };
  const p = PL.list.find(q=>q.id === id) || S.ME, v = lsGet(plKey('halfball-view', id));
  return {id, name: p.name, settings: j('halfball-settings') || {}, stats: j('halfball-stats') || blankStats(), view: v || null};
}
export function bkShots(st){   // every scored shot, the archive's included
  let n = (st && Array.isArray(st.log) ? st.log : []).filter(e=>e && !e.gh).length;
  const m = st && st.archive && st.archive.modes; if(m && typeof m === 'object') for(const k in m) if(m[k] && typeof m[k].n === 'number') n += m[k].n;
  return n;
}
const bkSlug = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'player';
function bkExport(all){
  save(); saveSettings();   // what's in play now goes in too
  const ids = all ? PL.list.map(p=>p.id) : [S.ME.id];
  const data = {format: BK_FORMAT, schema: BK_SCHEMA, saved: new Date().toISOString(), players: ids.map(bkRead)};
  const name = `halfball-${all ? 'all-players' : bkSlug(S.ME.name)}-${new Date().toISOString().slice(0, 10)}.json`;
  try{
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], {type: 'application/json'}));
    const a = document.createElement('a'); a.href = url; a.download = name; a.hidden = true; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 30000);
    bkSay(`Saved ${name}. Keep it somewhere safe, away from this browser.`, 'ok');
  }catch(e){ bkSay('Couldn’t save the file. Try again.', 'bad'); }
}
// copy a parsed value, keeping only plain JSON, within limits; anything else throws
function bkClean(v, depth){
  if(v === null || typeof v === 'boolean') return v;
  if(typeof v === 'number'){ if(!Number.isFinite(v)) throw 0; return v; }
  if(typeof v === 'string'){ if(v.length > 4000) throw 0; return v; }
  if(depth > 8 || typeof v !== 'object') throw 0;
  if(Array.isArray(v)){ if(v.length > 100000) throw 0; return v.map(x=>bkClean(x, depth + 1)); }
  const o = {};
  for(const k of Object.keys(v)){ if(k === '__proto__' || k === 'constructor' || k === 'prototype' || k.length > 64) continue; o[k] = bkClean(v[k], depth + 1); }
  return o;
}
const bkObj = v => v != null && typeof v === 'object' && !Array.isArray(v);
const bkNum = v => v === undefined || typeof v === 'number';
const BK_NOT = 'That file isn’t a Halfball backup.', BK_BAD = 'That backup is damaged, so nothing was changed.';
// a file's text to its players, or a reason it can't be used (shown to the player as is)
function bkParse(text){
  let raw; try{ raw = JSON.parse(text); }catch(e){ throw BK_NOT; }
  if(!bkObj(raw) || raw.format !== BK_FORMAT) throw BK_NOT;
  if(!Number.isInteger(raw.schema) || raw.schema < 1 || raw.schema > BK_SCHEMA) throw 'This backup can’t be read here.';
  let d; try{ d = bkClean(raw, 0); }catch(e){ throw BK_BAD; }
  if(!Array.isArray(d.players) || !d.players.length || d.players.length > PL_MAX) throw BK_BAD;
  const players = d.players.map(p=>{
    if(!bkObj(p) || typeof p.name !== 'string' || !p.name.trim() || !bkObj(p.settings) || !bkObj(p.stats)) throw BK_BAD;
    const st = p.stats;
    if(!Array.isArray(st.log) || st.log.length > 20000 || !st.log.every(e=>bkObj(e) && bkNum(e.ts) && (e.t === undefined || typeof e.t === 'string'))) throw BK_BAD;
    if(st.sessions !== undefined && !(Array.isArray(st.sessions) && st.sessions.length <= 5000 && st.sessions.every(bkObj))) throw BK_BAD;
    if(!['n', 'c', 'made', 'streak', 'best'].every(k=>bkNum(st[k]))) throw BK_BAD;
    if(st.shoot !== undefined && !(bkObj(st.shoot) && typeof st.shoot.g === 'number')) throw BK_BAD;
    for(const k of ['level', 'active']) if(st[k] != null && !bkObj(st[k])) throw BK_BAD;
    if(st.archive !== undefined && !(bkObj(st.archive) && (st.archive.modes === undefined || (bkObj(st.archive.modes) && Object.values(st.archive.modes).every(m=>bkObj(m) && typeof m.n === 'number'))))) throw BK_BAD;
    if(p.view != null && (typeof p.view !== 'string' || p.view.length > 20)) throw BK_BAD;
    return {name: p.name.trim().slice(0, 16), settings: p.settings, stats: st, view: p.view || null};
  });
  return {saved: typeof d.saved === 'string' && !isNaN(Date.parse(d.saved)) ? new Date(d.saved) : null, players};
}
// write one player's keys; if any write fails (storage full), every key goes back as it was
function bkWrite(id, p){
  const was = BK_KEYS.map(k=>lsGet(plKey(k, id)));
  try{
    localStorage.setItem(lsKey(plKey('halfball-settings', id)), JSON.stringify(p.settings));
    localStorage.setItem(lsKey(plKey('halfball-stats', id)), JSON.stringify(p.stats));
    if(p.view) localStorage.setItem(lsKey(plKey('halfball-view', id)), p.view); else localStorage.removeItem(lsKey(plKey('halfball-view', id)));
    return true;
  }catch(e){
    BK_KEYS.forEach((k, i)=>{ try{ if(was[i] == null) localStorage.removeItem(lsKey(plKey(k, id))); else localStorage.setItem(lsKey(plKey(k, id)), was[i]); }catch(x){} });
    return false;
  }
}
const bkTaken = name => PL.list.find(p=>p.name.toLowerCase() === name.toLowerCase());
function bkFreeName(name){
  if(!bkTaken(name)) return name;
  for(let i = 2; i < 100; i++){ const t = `${name.slice(0, 16 - String(i).length - 1)} ${i}`; if(!bkTaken(t)) return t; }
  return name;
}
function bkSay(msg, tone){
  bk.msg = msg; bk.tone = tone || '';
  const m = $('bkmsg'); if(!m) return;
  m.setAttribute('role', tone === 'bad' ? 'alert' : 'status'); m.className = 'bkmsg' + (tone ? ' ' + tone : ''); m.textContent = msg;
}
const bkSummary = st => { const n = bkShots(st); return `${statsGrade(st)} · ${n.toLocaleString()} shot${n === 1 ? '' : 's'}`; };
export function bkRender(){
  const full = PL.list.length >= PL_MAX, many = PL.list.length > 1, body = $('bkbody'), foot = $('bkfoot');
  if(bk.view === 'main'){
    $('bkkick').textContent = S.ME.name;
    body.innerHTML = `<p>Your progress is kept in this browser only. Save a backup now and then, and keep the file somewhere safe.</p>`
      + `<h3>Back up</h3><div class="bkrow"><button class="sumdone" data-bk="me">${many ? `Save ${plEsc(S.ME.name)}` : 'Save a backup'}</button>${many ? `<button class="sumdone" data-bk="all">Save all ${PL.list.length} players</button>` : ''}</div>`
      + `<p class="bknote">Grade, stats and settings, as a .json file.</p>`
      + `<h3>Restore</h3><div class="bkrow"><button class="sumdone" data-bk="pick">Choose a backup file…</button></div>`
      + `<p class="bknote">You choose what to do with it before anything changes.</p>`
      + `<p class="bkmsg" id="bkmsg"></p>`;
    foot.innerHTML = `<button class="startbtn" data-bk="close">Done</button>`;
  } else if(bk.view === 'confirm'){
    const F = bk.file, P = F.players[bk.pick];
    $('bkkick').textContent = 'Restore' + (F.saved ? ` · saved ${F.saved.toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}` : '');
    if(bk.how === 'add' && full) bk.how = 'replace';
    let h = '';
    if(F.players.length > 1) h += `<fieldset class="bkgroup"><legend>Which player</legend>` + F.players.map((p, i)=>`<label class="bkopt${i === bk.pick ? ' on' : ''}"><input type="radio" name="bkwho" value="${i}"${i === bk.pick ? ' checked' : ''}><span>${plEsc(p.name)}<small>${bkSummary(p.stats)}</small></span></label>`).join('') + `</fieldset>`;
    else h += `<p><b>${plEsc(P.name)}</b> · ${bkSummary(P.stats)}</p>`;
    h += `<fieldset class="bkgroup"><legend>What to do</legend>`
      + `<label class="bkopt${bk.how === 'add' ? ' on' : ''}${full ? ' off' : ''}"><input type="radio" name="bkhow" value="add"${bk.how === 'add' ? ' checked' : ''}${full ? ' disabled' : ''}><span>Add as a new player<small>${full ? `${PL_MAX} players max: delete one to add another` : 'Everyone here keeps their progress'}</small></span></label>`
      + `<label class="bkopt${bk.how === 'replace' ? ' on' : ''}"><input type="radio" name="bkhow" value="replace"${bk.how === 'replace' ? ' checked' : ''}><span>Replace ${plEsc(S.ME.name)}<small>${plEsc(S.ME.name)} now: ${bkSummary(stats)}</small></span></label></fieldset>`;
    if(bk.how === 'add') h += `<label class="bkname">Name<input id="bkname" maxlength="16" autocomplete="off" aria-describedby="bkerr" value="${plEsc(bkFreeName(P.name))}"></label><p class="bkerr" id="bkerr"></p>`;
    else h += `<p class="bkwarn">${plEsc(S.ME.name)}’s grade, stats and settings here are replaced by the backup’s. This can’t be undone.</p>`;
    h += `<p class="bkmsg" id="bkmsg"></p>`;
    body.innerHTML = h;
    foot.innerHTML = `<button class="sumdone" data-bk="back">Cancel</button><button class="startbtn" data-bk="go">${bk.how === 'add' ? 'Add player' : 'Replace'}</button>`;
  } else {   // done: what was restored
    $('bkkick').textContent = 'Restore';
    body.innerHTML = `<p class="bkmsg" id="bkmsg"></p>`;
    foot.innerHTML = bk.addedId ? `<button class="sumdone" data-bk="close">Close</button><button class="startbtn" data-bk="playnew">Play as ${plEsc(bk.addedName)}</button>` : `<button class="startbtn" data-bk="close">Done</button>`;
  }
  if(bk.msg) bkSay(bk.msg, bk.tone);
}
export function bkFocus(){ const f = $('bk').querySelector('.bkbody button') || $('bk').querySelector('.bkfoot .startbtn'); if(f) f.focus({preventScroll: true}); }
export function openBackup(from){
  plOpen(false);
  bk.from = from || document.activeElement; bk.view = 'main'; bk.file = null; bk.msg = ''; bk.addedId = null;
  bkRender(); $('bk').hidden = false; $('bkbody').scrollTop = 0;
  bkFocus();
}
function closeBackup(){
  if($('bk').hidden) return;
  $('bk').hidden = true; bk.file = null;
  const f = bk.from && bk.from.isConnected && bk.from !== document.body ? bk.from : null; bk.from = null;
  if(f) try{ f.focus({preventScroll: true}); }catch(e){}
}
function bkMain(){ bk.view = 'main'; bk.file = null; bk.msg = ''; bkRender(); bkFocus(); }
async function bkLoad(file){
  bk.msg = '';
  if(!file) return;
  if(file.size > BK_MAX){ bkSay('That file is too big to be a Halfball backup.', 'bad'); return; }
  let text; try{ text = await file.text(); }catch(e){ bkSay('Couldn’t read that file.', 'bad'); return; }
  try{ bk.file = bkParse(text); }catch(e){ bkSay(typeof e === 'string' ? e : BK_BAD, 'bad'); return; }
  bk.pick = 0; bk.how = PL.list.length >= PL_MAX ? 'replace' : 'add'; bk.view = 'confirm'; bk.msg = '';
  bkRender(); $('bkbody').scrollTop = 0;
  const r = $('bk').querySelector('input[name="bkwho"]:checked') || $('bk').querySelector('input[name="bkhow"]:checked'); if(r) r.focus({preventScroll: true});
}
function bkGo(){
  const P = bk.file && bk.file.players[bk.pick]; if(!P) return;
  if(bk.how === 'add'){
    const inp = $('bkname'), name = inp.value.trim().slice(0, 16), err = $('bkerr');
    const bad = !name ? 'Give the player a name.' : bkTaken(name) ? `There’s already a ${bkTaken(name).name} here. Try ${bkFreeName(name)}.` : PL.list.length >= PL_MAX ? `${PL_MAX} players max: delete one to add another.` : '';
    if(bad){ err.textContent = bad; inp.setAttribute('aria-invalid', 'true'); inp.focus(); return; }
    let id; do id = 'p' + Math.random().toString(36).slice(2, 8); while(id === 'p0' || PL.list.some(p=>p.id === id));
    if(!bkWrite(id, P)){ BK_KEYS.forEach(k=>{ try{ localStorage.removeItem(lsKey(plKey(k, id))); }catch(e){} }); bkSay('Couldn’t add the player: this browser’s storage is full. Nothing was changed.', 'bad'); return; }
    PL.list.push({id, name}); savePL(); renderPlMenu();
    bk.view = 'done'; bk.addedId = id; bk.addedName = name; bk.msg = `Added ${name}: ${bkSummary(P.stats)}. Switch to them here, or any time from the player menu.`; bk.tone = 'ok';
    bkRender(); bkFocus(); return;
  }
  restoring = true; clearTimeout(laterT);   // nothing in play may save over the backup now
  if(!bkWrite(S.ME.id, P)){ restoring = false; bkSay('Couldn’t restore: this browser’s storage is full. Nothing was changed.', 'bad'); return; }
  try{ sessionStorage.setItem(lsKey('halfball-restored'), '1'); }catch(e){}
  playAs(S.ME.id);   // starts again as you, from the backup
}
export function wireBackup(){
  $('bkopen').addEventListener('click', e=>{ e.stopPropagation(); openBackup(e.currentTarget); });
  $('bkfile').addEventListener('change', e=>{ const f = e.target.files && e.target.files[0]; bkLoad(f); e.target.value = ''; });
  $('bk').addEventListener('change', e=>{
    const t = e.target;
    if(t.name === 'bkwho'){ bk.pick = +t.value; bkRender(); $('bk').querySelector(`input[name="bkwho"][value="${bk.pick}"]`).focus({preventScroll: true}); }
    if(t.name === 'bkhow'){ bk.how = t.value; bkRender(); $('bk').querySelector(`input[name="bkhow"][value="${bk.how}"]`).focus({preventScroll: true}); }
  });
  $('bk').addEventListener('input', e=>{ if(e.target.id === 'bkname'){ $('bkerr').textContent = ''; e.target.removeAttribute('aria-invalid'); } });
  ['click', 'pointerdown'].forEach(t=>$('bk').addEventListener(t, e=>{
    e.stopPropagation();
    if(t !== 'click') return;
    if(e.target === $('bk')){ closeBackup(); return; }
    const b = e.target.closest('[data-bk]'); if(!b) return;
    const a = b.dataset.bk;
    if(a === 'me' || a === 'all') bkExport(a === 'all');
    else if(a === 'pick') $('bkfile').click();
    else if(a === 'close') closeBackup();
    else if(a === 'back') bkMain();
    else if(a === 'go') bkGo();
    else if(a === 'playnew'){ const id = bk.addedId; closeBackup(); playAs(id); }
  }));
  window.addEventListener('keydown', e=>{   // while it's up, keys stay in the card: Esc steps back or closes, Tab goes round it, Enter in the name adds
    if($('bk').hidden) return;
    e.stopPropagation();
    if(e.key === 'Escape'){ e.preventDefault(); if(bk.view === 'confirm') bkMain(); else closeBackup(); return; }
    if(e.key === 'Enter' && e.target && e.target.id === 'bkname'){ e.preventDefault(); bkGo(); return; }
    if(e.key === 'Tab'){
      const f = [...$('bk').querySelectorAll('button, input:not([type=file]):not([disabled])')].filter(b=>!b.hidden && (b.type !== 'radio' || b.checked)), i = f.indexOf(document.activeElement);
      if(f.length){ e.preventDefault(); f[(i + (e.shiftKey ? f.length - 1 : 1) + f.length) % f.length].focus(); }
    }
  }, true);
}
export const tour = {on: false, i: 0, steps: [], first: false};
