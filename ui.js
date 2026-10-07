// The rest of the interface: ask(), the player picker, Stats view, controls, the Look picker, the app tour, keyboard shortcuts, What's new.
import {endTut, LESSONS, openTutMenu, startTut, tstep, tutBack, tutNext} from './lessons.js';
import {aidMode, baseRun, callLock, deal, dealFresh, lockCalls, nextShot0, openSheet, pickFrac, prepareNext, prepKey, renderModeChip, replay, setPractice, showSessIdle, startFlashMode} from './modes.js';
import {finishAnim, replayRightNow} from './anim.js';
import {applyGfx, applyStyle, BALL_SETS, draw, GLOVE_DEF, HAND_DEF, HOLO, isHex, LOOK_AT, lookOpen, pivotToggle, ST, STYLES, walkEndedAt, walkOn} from './view.js';
import {cueStroke, lvupOpen, nudgeTip, renderBadge, renderShootControls, setLook, setSpeedLevel, speedLevel, standUpOff} from './shot.js';
import {renderRun, ZONE_STEPS} from './deal.js';
import {CARBON_AT, carbonUnlocked, ctrl, enforceLocks, ensureShootLevel, FAST_FLASH_GRADE, fastFlashLocked, FLASH_AT, flashTableNow, flashUnlocked, FOCUS_AT, gradeTable, isDrill, isRun, isShooting, LADDER_PICK_AT, ladderPickOpen, ladderTable, PRACTICE_AT, practiceUnlocked, practicing, progTable, PTS_UP, RUN_AT, runUnlocked, SHOOT_TEXT, stepGrade, TABLE_AT, tableUnlocked, unlIcon, unlocksBetween} from './grades.js';
import {showStreak, uiSound} from './audio.js';
import {DEV, fpsStart} from './perf.js';
import {askPersist, curStreak, lean, look, openBackup, PL, PL_MAX, playAs, plEsc, plGrade, plKey, S, save, savePL, saveSettings, settings, SHOOT_GRADES, SHOOT_V, stats, statTask, STREAK_HOT, success, TEST, tour, tut} from './state.js';
import {GRADE_STEP, gradeOf, SH, stepOf} from './steps.js';
import {CONTACT, notesTop, SOURCE, VERSION, WHATS_NEW} from './whatsnew.js';
import {$, ALL, BOUNDS, boundsFor, CORE, curTable, kt, OB_COLORS, REFS, setBounds, setRefs, tableBox, touchMode} from './geom.js';
let plWired = false;
// the game starts at the top: no reload after a pick, so the title screen's scroll (and the phone keyboard the name field
// brought up) would carry over and open the game scrolled far down. Again once the keyboard has gone and the page has settled.
export function toTop(){
  const a = document.activeElement; if(a && a !== document.body && a.blur) a.blur();
  const top = () => { try{ window.scrollTo(0, 0); }catch(e){} [document.scrollingElement, document.documentElement, document.body, ...document.querySelectorAll('#playercover, .sumcover, .panel')].forEach(el=>{ if(el) el.scrollTop = 0; }); };
  top(); requestAnimationFrame(top); setTimeout(top, 350);
}
// ask(): a question in the app's own card, in place of the browser's. Resolves true (or the typed text, with `value`), or
// null on Cancel, Esc or a tap outside. Keys stay in the card while it's up; Tab goes round it; focus goes back after.
let askDone = null, askFrom = null;
function ask({title, text = '', ok = 'OK', danger = false, value = null, label = '', from = null, cancel = 'Cancel'}){   // cancel: null for a card with OK alone
  if(askDone) askDone(null);
  const inp = $('askinput');
  $('askno').hidden = !cancel; if(cancel) $('askno').textContent = cancel;
  $('asktitle').textContent = title; $('asktext').textContent = text; $('asktext').hidden = !text;
  $('askok').textContent = ok; $('askok').classList.toggle('danger', danger);
  inp.hidden = value == null; inp.value = value == null ? '' : value; inp.setAttribute('aria-label', label || title);
  askFrom = from || document.activeElement; $('ask').hidden = false;
  if(value != null){ inp.focus({preventScroll: true}); inp.select(); } else $('askok').focus({preventScroll: true});
  if(!ask.wired){ ask.wired = true;
    const done = v => { if(askDone) askDone(v); };
    $('askform').addEventListener('submit', e=>{ e.preventDefault(); if(inp.hidden) return done(true); const v = inp.value.trim(); if(v) done(v); else inp.focus(); });
    $('askno').addEventListener('click', ()=>done(null));
    ['click', 'pointerdown'].forEach(t=>$('ask').addEventListener(t, e=>{ e.stopPropagation(); if(t === 'click' && e.target === $('ask')) done(null); }));
    window.addEventListener('keydown', e=>{
      if($('ask').hidden) return;
      e.stopPropagation();
      if(e.key === 'Escape'){ e.preventDefault(); done(null); }
      else if(e.key === 'Tab'){
        const f = [inp, $('askno'), $('askok')].filter(b=>!b.hidden), i = f.indexOf(document.activeElement);
        e.preventDefault(); f[(i + (e.shiftKey ? f.length - 1 : 1) + f.length) % f.length].focus();
      }
    }, true);
  }
  return new Promise(go=>{ askDone = v=>{
    askDone = null; $('ask').hidden = true;
    const f = askFrom; askFrom = null;
    if(f && f.isConnected && f !== document.body && !f.closest('[hidden]')) try{ f.focus({preventScroll: true}); }catch(e){}
    go(v);
  }; });
}
async function delPlayer(id){
  const p = PL.list.find(q=>q.id === id);
  if(!p || !await ask({title: `Delete ${p.name}?`, text: 'Their grade, stats and settings go for good.', ok: 'Delete', danger: true})) return;
  ['halfball-settings', 'halfball-stats', 'halfball-view'].forEach(k=>{ try{ localStorage.removeItem(lsKey(plKey(k, id))); }catch(e){} });
  PL.list = PL.list.filter(q=>q !== p); if(PL.cur === id) delete PL.cur; savePL();
  if(id === S.meId){ try{ sessionStorage.removeItem(lsKey('halfball-player')); }catch(e){} S.meId = null; location.reload(); }
  showPlayers();
}
export function showPlayers(){
  const n = PL.list.length, full = n >= PL_MAX;
  $('plhead').textContent = n ? 'Who\'s playing?' : 'New player';
  $('plsub').textContent = !n ? 'Your name keeps your grade and settings' : full ? `${PL_MAX} players max: delete one to add another` : '';
  $('pllist').innerHTML = PL.list.map(p=>`<div class="plrow"><button class="startbtn plpick" data-id="${p.id}"><span>${plEsc(p.name)}</span><small>${plGrade(p.id)}</small></button><button class="pldel" data-del="${p.id}" aria-label="Delete ${plEsc(p.name)}" title="Delete">✕</button></div>`).join('');
  $('plnew').hidden = full; $('plback').hidden = !S.meId;
  $('plbuild').innerHTML = `${DEV_SITE ? '<b class="devtag">DEV</b> ' : ''}<a href="mailto:${CONTACT}">Contact us</a> · <a href="${SOURCE}" target="_blank" rel="noopener">build ${VERSION}</a>`;
  $('playercover').hidden = false; $('playercover').scrollTop = 0;
  if(!n && !matchMedia('(hover: none)').matches) $('plname').focus({preventScroll: true});   // not on a phone: there it would raise the keyboard and scroll the title away
  if(plWired) return; plWired = true;
  $('pllist').addEventListener('click', e=>{ const b = e.target.closest('button'); if(!b) return; if(b.dataset.del) delPlayer(b.dataset.del); else if(b.dataset.id) playAs(b.dataset.id); });
  $('plnew').addEventListener('submit', e=>{
    e.preventDefault(); const name = $('plname').value.trim();
    if(!name || PL.list.length >= PL_MAX){ $('plname').focus(); return; }
    let id; do id = 'p' + Math.random().toString(36).slice(2, 8); while(id === 'p0' || PL.list.some(p=>p.id === id)); PL.list.push({id, name: name.slice(0, 16)}); playAs(id);
  });
  $('plback').addEventListener('click', ()=>{ $('playercover').hidden = true; });
  window.addEventListener('keydown', e=>{ if(!$('playercover').hidden) e.stopPropagation(); }, true);   // the game behind doesn't take keys (typing still works)
  ['click', 'pointerdown'].forEach(t=>$('playercover').addEventListener(t, e=>e.stopPropagation()));
}
function setGradeForTesting(i){
  settings.practice = null; saveSettings(); setTimeout(renderModeChip, 0);
  if(settings.tutSeen){ if(isShooting()) for(const k in LESSONS) if(LESSONS[k].at > stepOf(i)) delete settings.tutSeen[k]; saveSettings(); }   // lessons above the picked grade play again when you reach them
  stats.shoot = {g: i, best: i, pts: 0, v: SHOOT_V}; settings.flashTable = gradeTable(stepOf(i)); if(stepOf(i) < LADDER_PICK_AT) settings.tablePick = null; saveSettings(); save(); showSessIdle(); renderBadge(true); renderProgress(); dealFresh();
}
export function renderProgress(){
  const L = ensureShootLevel(), GR = SHOOT_GRADES, TX = SHOOT_TEXT;
  const ea = t => String(t).replace(/<[^>]*>/g, '').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));   // an unlock's what/where, for its chip's description
  const g = L ? L.g : 0, best = L ? Math.max(L.best ?? 0, L.g) : 0, pts = L ? L.pts : 0;
  $('proghead').textContent = 'Progress';
  $('ladder').innerHTML = GR.map((G, i)=>{
    const pr = practicing() && i === +settings.practice;
    const cls = (i===g ? 'here' : i <= best ? 'done' : '') + (i < g ? ' pick' : '') + (pr ? ' practice' : '');
    const bar = i===g ? (i < GR.length-1
      ? `<span class="here-bar"><i style="width:${Math.min(100, Math.max(0, pts)/PTS_UP*100)}%"></i></span><small>${Math.max(0, pts)} of ${PTS_UP} to ${GR[i+1]}</small>`
      : '<span class="sr">You made it.</span>') : pr ? '<span class="sr">Practising, not scored.</span>' : '';   // no small print on the ladder: the outline on the node shows the grade you're practising
    const u = i > 0 ? unlocksBetween(GRADE_STEP[i - 1], GRADE_STEP[i]) : [], soon = i > best;   // what this grade gives you (UNLOCKS_AT): yours, or still to come
    const f = FOCUS_AT[GRADE_STEP[i]];   // what this grade trains (FOCUS_AT): its title
    const title = `<h3 class="gfocus"${f ? ` aria-description="${ea(f.what + ' ' + f.where)}"` : ''}><span class="sr">Focus: </span>${f ? unlIcon(f.icon) + f.name : TX[i]}</h3>`;
    const unl = u.length ? `<span class="unl${soon ? ' soon' : ''}"><span class="sr">${soon ? 'Unlocks at this grade:' : 'Unlocks:'} </span>${u.map(r=>`<span class="unlchip" aria-description="${ea(r.what + ' ' + r.where)}">${unlIcon(r.icon)}${r.name}</span>`).join('<span class="sr">, </span>')}</span>` : '';
    return `<li class="${cls}${DEV ? ' dev' : ''}" data-g="${i}"${pr ? ' aria-current="true"' : ''}><span class="node">${G}</span><div class="what">${title}${unl}${bar}</div></li>`;   // the focus as the title, the unlocks as chips under it
  }).reverse().join('') + (DEV ? '<li class="devnote"><span></span><small>Testing: tap a grade to jump there.</small></li>' : '');
  $('ladder').setAttribute('aria-description', DEV ? 'Testing: tap a grade to jump there.' : 'Tap a grade you\'ve passed to practise it, as long as you like. Practice shots don\'t count.');   // the hint, for screen readers only
}
export function alignLogo(){   // the logo's centre on the same vertical line as the radio's disc (and the eye under it on a phone), wherever the table sits
  const lg = $('hlogo'), d = document.querySelector('#radio .radiodisc'); if(!lg || !d || !d.getClientRects().length) return;
  const l = lg.getBoundingClientRect(), r = d.getBoundingClientRect(), now = parseFloat(getComputedStyle(lg).marginLeft) || 0;
  const x = Math.max(0, Math.min(96, Math.round(now + (r.left + r.width/2) - (l.left + l.width/2))));
  if(x !== now) lg.style.marginLeft = x + 'px';
}
export function syncStreakPill(){ if(!$('hlogo')) return; const c = curStreak(); showStreak(c >= STREAK_HOT ? c : 0, 0); }
export function renderStats(){
  if(SV.open) svRender();
}

// ---------- the Stats view: over the table and panel on a desktop, the whole screen on a phone ----------
const SV = {open: false, tab: 'overview', task: null, opener: null, pushed: false};
const svTabs = () => window.HBStats ? HBStats.TABS : [];
function svCtx(){ return {log: stats.log, sessions: stats.sessions || [], archive: stats.archive || null, task: SV.task, refs: ALL, success, lean, grades: SHOOT_GRADES, gradeStep: GRADE_STEP, spinAt: gradeOf(SH.follow), zoneAt: gradeOf(ZONE_STEPS[0]), speedAt: gradeOf(SH.speed), hot: STREAK_HOT, shoot: stats.shoot, run: stats.run}; }
function svRender(){
  if(!window.HBStats) return;
  const inArch = t => !!(stats.archive && stats.archive.modes && stats.archive.modes[t]);
  const hasFlash = SV.task === 'flash' || flashUnlocked() || stats.log.some(e=>e.t === 'flash') || inArch('flash');
  const hasPractice = SV.task === 'practice' || practiceUnlocked() || stats.log.some(e=>e.t === 'practice') || inArch('practice');
  const hasRun = SV.task === 'run' || runUnlocked() || stats.log.some(e=>e.t === 'run') || inArch('run');
  $('svmode').hidden = !hasFlash && !hasPractice && !hasRun;
  $('svmode').querySelector('[data-svt="flash"]').hidden = !hasFlash; $('svmode').querySelector('[data-svt="practice"]').hidden = !hasPractice; $('svmode-run').hidden = !hasRun;
  document.querySelectorAll('#svmode button').forEach(b=>b.setAttribute('aria-pressed', b.dataset.svt === SV.task));
  document.querySelectorAll('#svtabs [role="tab"]').forEach(b=>{ const on = b.dataset.svtab === SV.tab; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
  const body = $('svbody'); body.setAttribute('aria-labelledby', 'svtab-' + SV.tab);
  HBStats.render(body, svCtx(), SV.tab);
}
function svTab(t, focus){
  if(!svTabs().some(([k])=>k === t)) t = 'overview';
  SV.tab = t; settings.svTab = t; saveSettings();
  svRender(); $('svbody').scrollTop = 0;
  if(focus) $('svtab-' + t).focus({preventScroll: true});
}
function openStats(v, opts = {}){
  const view = $('statsview');
  if(v === SV.open){ if(v && opts.tab) svTab(opts.tab); return; }
  SV.open = v;
  const fixed = () => getComputedStyle(view).position === 'fixed';   // a phone: it covers the header too
  if(v){
    SV.opener = document.activeElement && document.activeElement !== document.body ? document.activeElement : $('statsbtn');
    SV.task = statTask();
    if(opts.tab) SV.tab = opts.tab;
    view.hidden = false;
    document.documentElement.classList.add('svopen');
    ['.tablecol', '.panel'].forEach(s=>{ const el = document.querySelector(s); if(el) el.inert = true; });
    if(fixed()) document.querySelector('header').inert = true;
    $('statsbtn').setAttribute('aria-expanded', 'true');
    $('sv-who').textContent = S.ME && S.ME.name && PL.list.length > 1 ? S.ME.name : '';
    svRender();
    $('svbody').scrollTop = 0;
    $('sv-title').focus({preventScroll: true});   // into the dialog; Tab goes on to Back, the mode and the tabs
    try{ history.pushState({hbStats: 1}, ''); SV.pushed = true; }catch(e){ SV.pushed = false; }   // the phone's back gesture closes it
  } else {
    view.hidden = true;
    document.documentElement.classList.remove('svopen');
    ['.tablecol', '.panel', 'header'].forEach(s=>{ const el = document.querySelector(s); if(el) el.inert = false; });
    $('statsbtn').setAttribute('aria-expanded', 'false');
    $('svbody').innerHTML = '';
    if(SV.pushed && !opts.fromPop){ SV.pushed = false; try{ history.back(); }catch(e){} }
    SV.pushed = false;
    const o = SV.opener; SV.opener = null;
    if(o && o.isConnected && !o.closest('[inert]')) o.focus({preventScroll: true});
  }
}
export function wireStatsView(){
  (function(){
    $('svtabs').innerHTML = svTabs().map(([k, label])=>`<button role="tab" id="svtab-${k}" data-svtab="${k}" aria-controls="svbody" aria-selected="false" tabindex="-1">${label}</button>`).join('');
    SV.tab = svTabs().some(([k])=>k === settings.svTab) ? settings.svTab : 'overview';
    $('svtabs').addEventListener('click', e=>{ const b = e.target.closest('[data-svtab]'); if(b) svTab(b.dataset.svtab); });
    $('svtabs').addEventListener('keydown', e=>{   // arrow keys move along the tabs, as tabs do
      const ks = svTabs().map(([k])=>k), i = ks.indexOf(SV.tab);
      const j = {ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: ks.length - 1}[e.key];
      if(j == null) return; e.preventDefault(); svTab(ks[(j + ks.length) % ks.length], true);
    });
    $('svmode').addEventListener('click', e=>{ const b = e.target.closest('[data-svt]'); if(!b || b.dataset.svt === SV.task) return; SV.task = b.dataset.svt; svRender(); });
    $('svclose').addEventListener('click', ()=>openStats(false));
    $('statsbtn').addEventListener('click', ()=>openStats(!SV.open));
    window.addEventListener('popstate', ()=>{ if(SV.open) openStats(false, {fromPop: true}); });
    // while it's open the game behind takes no keys; Esc closes it, and Tab stays inside it
    window.addEventListener('keydown', e=>{
      if(!SV.open || !$('bk').hidden) return;   // Back up / Restore, over the Stats view, has the keys
      e.stopPropagation();
      if(e.key === 'Escape'){ e.preventDefault(); if(menuOpen()) openMenu(false); else if(!$('prog').hidden) openProg(false); else if(!$('tutmenu').hidden) openTutMenu(false); else openStats(false); return; }
      if(e.key === 'Tab'){
        const view = $('statsview'), f = [...view.querySelectorAll('button:not([disabled]),[tabindex="0"],summary')].filter(x=>x.getClientRects().length && !x.closest('[hidden]'));
        if(!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if(!view.contains(document.activeElement)){ e.preventDefault(); first.focus(); }
        else if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
        else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
      }
    }, true);
    window.addEventListener('keyup', e=>{ if(SV.open) e.stopPropagation(); }, true);
    let rt = 0; window.addEventListener('resize', ()=>{ if(!SV.open) return; clearTimeout(rt); rt = setTimeout(svRender, 150); });
  })();
}

// ---------- controls ----------
// the little radio on the table: tap to change station (Off, Parlor, Smoke, Felt)
const STATIONS = ['off', 'parlor', 'smoke', 'felt'], STATION_NAME = {off: 'Off', parlor: 'Parlor', smoke: 'Smoke', felt: 'Felt'};
export function renderRadio(){
  const b = $('radio'); if(!b) return;
  const i = STATIONS.indexOf(settings.music);
  const name = k => (k !== 'off' && window.Music && Music.stationName && Music.stationName(k)) || STATION_NAME[k];   // the disco tunes' names while the Disco set is on
  $('radiolbl').textContent = name(settings.music) || 'Off';
  document.querySelectorAll('[data-set="music"]').forEach(x=>{ x.textContent = name(x.dataset.val); });
  b.classList.toggle('off', settings.music === 'off');
  b.dataset.station = STATIONS[Math.max(0, i)];   // off: a muted speaker; on: gold equaliser bars that move (still under reduced motion)
}
// a locked button stays hoverable (a disabled one shows no tooltip): it looks locked, and the tip says when it opens.
// The tip is our own (the browser's title tooltip is slow, easy to miss, and never shows on touch): on hover or focus, and for 1.5 s on a tap
export function lockBtn(b, lk, tip){
  b.disabled = false; b.classList.toggle('locked', lk); b.setAttribute('aria-disabled', lk ? 'true' : 'false'); b.removeAttribute('title');
  if(lk && tip){ b.dataset.tip = tip; b.setAttribute('aria-description', tip); } else { delete b.dataset.tip; b.removeAttribute('aria-description'); if(lockTip && lockTip.at === b) hideLockTip(); }
}
var lockTip = {el: null, at: null, timer: 0};   // var: syncPressed may run before this line does
function showLockTip(b, ms){
  if(!lockTip.el){ lockTip.el = document.createElement('div'); lockTip.el.className = 'locktip'; lockTip.el.setAttribute('role', 'tooltip'); lockTip.el.hidden = true; document.body.appendChild(lockTip.el); }
  const el = lockTip.el; el.textContent = b.dataset.tip; el.hidden = false; lockTip.at = b;
  const r = b.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
  const x = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width/2 - w/2)), y = r.top - h - 8 >= 8 ? r.top - h - 8 : r.bottom + 8;   // above it, or below when there's no room
  el.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
  clearTimeout(lockTip.timer); lockTip.timer = ms ? setTimeout(hideLockTip, ms) : 0;
}
export function hideLockTip(){ clearTimeout(lockTip.timer); lockTip.timer = 0; lockTip.at = null; if(lockTip.el) lockTip.el.hidden = true; }
export function wireLockTips(){
  {
    const tipBtn = t => t && t.closest ? t.closest('.locked[data-tip]') : null;
    document.addEventListener('mouseover', e=>{ const b = tipBtn(e.target); if(b && b !== lockTip.at) showLockTip(b); });
    document.addEventListener('mouseout', e=>{ const b = tipBtn(e.target); if(b && b === lockTip.at && !lockTip.timer && !b.contains(e.relatedTarget)) hideLockTip(); });
    document.addEventListener('focusin', e=>{ const b = tipBtn(e.target); if(b) showLockTip(b); });
    document.addEventListener('focusout', e=>{ if(lockTip.at && e.target === lockTip.at && !lockTip.timer) hideLockTip(); });
    document.addEventListener('click', e=>{ const b = tipBtn(e.target); if(b) showLockTip(b, 1500); }, true);   // a tap (or click) on a locked one: say when it opens; the click itself still does nothing
    document.addEventListener('pointerdown', e=>{ if(lockTip.at && !tipBtn(e.target)) hideLockTip(); }, true);
    document.addEventListener('keydown', e=>{ if(e.key === 'Escape' && lockTip.at) hideLockTip(); }, true);
    document.addEventListener('scroll', ()=>{ if(lockTip.at) hideLockTip(); }, true);
  }
}
export function syncPressed(){
  if(typeof lookPick === 'object' && lookPick) renderLookPicker();   // the Look picker and its dot follow every change (Settings, a new grade)
  tableBox.classList.toggle('walkable', walkOn());
  for(const sz of ['8', '9']){ const lk = !tableUnlocked(sz), b = document.querySelector(`[data-set="flashTable"][data-val="${sz}"]`); lockBtn(b, lk, `Unlocks at ${stepGrade(TABLE_AT[sz])}`); b.querySelector('.lock').hidden = !lk; }
  { const open = ladderPickOpen(), lt = ladderTable(); $('laddertablenote').hidden = open; $('laddertablenote').textContent = `Until ${stepGrade(LADDER_PICK_AT)}, the Ladder plays on your grade's table.`;   // before S: the grade's table, shown as the pick; the others lock
    document.querySelectorAll('[data-set="tablePick"]').forEach(b=>{ const lk = !open && b.dataset.val !== lt; lockBtn(b, lk, `Unlocks at ${stepGrade(LADDER_PICK_AT)}`); b.querySelector('.lock').hidden = !lk; }); }
  { const lk = !carbonUnlocked(), b = document.querySelector('[data-set="shaft"][data-val="carbon"]'); lockBtn(b, lk, `Unlocks at ${stepGrade(CARBON_AT)}`); $('shaftlock').hidden = !lk; }
  $('set-disco').hidden = !settings.discoGot;   // hidden until the Disco Stu player
  for(const k of ['tstyle', 'ballSet']) document.querySelectorAll(`[data-set="${k}"]`).forEach(b=>{ const lk = !lookOpen(k, b.dataset.val); lockBtn(b, lk, `Unlocks at ${stepGrade(LOOK_AT[k][b.dataset.val])}`); const s = b.querySelector('.lock'); if(s) s.hidden = !lk; });
  const lockFlash = !flashUnlocked();
  lockBtn($('task-flash'), lockFlash, `Unlocks at ${stepGrade(FLASH_AT)}`); $('flashlock').hidden = !lockFlash;
  const lockRun = !runUnlocked();
  lockBtn($('task-run'), lockRun, `Unlocks at ${stepGrade(RUN_AT)}`); $('runlock').hidden = !lockRun;
  document.querySelectorAll('[data-set]').forEach(b=>b.setAttribute('aria-pressed', settings[b.dataset.set]===b.dataset.val));
  document.querySelectorAll('[data-set="tablePick"]').forEach(b=>b.setAttribute('aria-pressed', b.dataset.val === ladderTable()));   // the table the Ladder plays on
  document.querySelectorAll('[data-set="flashTable"]').forEach(b=>b.setAttribute('aria-pressed', b.dataset.val === flashTableNow()));
  $('task-sess').setAttribute('aria-pressed', settings.task==='shoot');
  $('task-practice').setAttribute('aria-pressed', isDrill());
  const pu = practiceUnlocked(); lockBtn($('task-practice'), !pu, `Opens at ${stepGrade(PRACTICE_AT)}`); $('practicelock').hidden = pu;
  lockBtn($('flash-750'), fastFlashLocked(), `Unlocks at ${stepGrade(FAST_FLASH_GRADE)}`); $('fastlock').hidden = !fastFlashLocked();
}
export function applySetting(key, val){
  if(tut.on && key==='task') return;
  if(settings[key]===val || (key==='task' && val==='flash' && !flashUnlocked()) || (key==='task' && val==='practice' && !practiceUnlocked()) || (key==='task' && val==='run' && !runUnlocked()) || (key==='tablePick' && (!ladderPickOpen() || ladderTable()===val)) || (key==='flashTable' && (!tableUnlocked(val) || flashTableNow()===val)) || (LOOK_AT[key] && !lookOpen(key, val)) || (key==='shaft' && val === 'carbon' && !carbonUnlocked()) || (key==='ghost' && aidMode('ghost')!=='optional') || (key==='line' && aidMode('line')!=='optional') || (key==='cam' && aidMode('stance')!=='optional') || (key==='walk' && baseRun()) || (key==='flash' && val==='750' && fastFlashLocked())) return;
  settings[key] = val; saveSettings(); syncPressed();
  if(key==='task'){ setTimeout(renderModeChip, 0); setTimeout(syncStreakPill, 0); S.flashArmed = false; $('startcover').hidden = true; renderBadge(); renderStats(); renderRun(); }   // the Stats tab switches to that mode's own stats
  if(key==='streaks') syncStreakPill();
  else if(key==='gfxAA') location.reload();
  else if(key==='fps') fpsStart();
  else if(key.startsWith('gfx')){ applyGfx(); if(S.shot) draw(S.answered); }
  else if(key==='music'){ if(window.Music) val === 'off' ? Music.stop() : Music.play(val); renderRadio(); }
  else if(key==='tstyle' || key==='ballSet'){ applyStyle(); if(S.shot) draw(S.answered); }
  else if(key==='flashView'){ if(S.shot) draw(S.answered); }
  else if(key==='tablePick' || key==='flashTable'){ if(progTable() !== curTable) dealFresh(); }   // a new shot on the table you picked (when it's the mode you're in)
  else if(key.startsWith('ref') || key==='hand' || key==='bridge' || key==='shaft'){ if(S.shot) draw(S.answered); }   // same shot, new look
  else if(key==='task' || (key==='flash' && settings.task==='flash')) deal();   // a kept shot stays (deal restores it)
  renderStats();
}
export function wireModeButtons(){
  document.querySelectorAll('[data-set]').forEach(b=>b.addEventListener('click', ()=>applySetting(b.dataset.set, b.dataset.val)));
  $('task-sess').addEventListener('click', ()=>applySetting('task', 'shoot'));
  $('task-practice').addEventListener('click', ()=>{ if(!practiceUnlocked() || tut.on) return; if(!isDrill()) applySetting('task', 'practice'); openSheet('drill', true); });   // Practice: set it up as you go in
  $('task-flash').addEventListener('click', ()=>{ if(settings.task === 'flash' && !tut.on) openSheet('flashsheet', true); });   // (after the setting itself: the sheet opens over the start card)
  $('task-run').addEventListener('click', ()=>{ if(isRun() && !tut.on) openSheet('runsheet', true); });
}

export function syncRefs(){
  if($('answers').children.length) return;
  setRefs(CORE); setBounds(boundsFor(REFS));
  $('answers').innerHTML = REFS.map((r,i)=>`<button data-id="${r.id}" id="ans-${r.id}" aria-label="${r.label} ball${touchMode() ? '' : `, key ${i+1}`}" data-label-kbd="${r.label} ball, key ${i+1}" data-label-touch="${r.label} ball"><kbd class="key" aria-hidden="true">${i+1}</kbd>${r.label}<span>${r.deg.toFixed(r.deg%1?1:0)}°</span></button>`).join('');
}
export function wireAnswers(){
  syncRefs();
  // answer on press (pointerdown), not on release: a tap's click lands ~100 ms later
  $('answers').addEventListener('pointerdown', e=>{ if(e.button !== 0) return; const b=e.target.closest('button'); if(b && !b.disabled){ e.preventDefault(); pickFrac(b.dataset.id); } });
  $('answers').addEventListener('click', e=>{ const b=e.target.closest('button'); if(b && e.detail === 0) pickFrac(b.dataset.id); });   // keyboard activation (Enter/Space on a focused button)
}
// Next shot: always straight to a new shot. A running animation is simply dropped (the shot still counts).
export let jumpingAhead = false;
// Next shot: a quick blink through the dark room, not a hard cut (about 0.35 s)
let dipping = false;
function nextDeal(){
  if(lvupOpen()) return;   // the level-up card waits for Continue: no new shot behind it
  if(cueStroke && cueStroke.s === S.shot) return;   // mid-stroke the deal would wait for the shot: no fade to black and back for nothing
  if(!(nextShot0 && nextShot0.key === prepKey())) prepareNext();   // not worked out ahead: do it now, before the fade, not during it
  dip(deal);
}
function dip(fn){
  const el = $('dip');
  if(dipping) return;
  if(!el || matchMedia('(prefers-reduced-motion: reduce)').matches){ fn(); return; }
  dipping = true; el.classList.remove('out'); el.style.opacity = '1';
  setTimeout(()=>{ try{ fn(); } finally { requestAnimationFrame(()=>{ el.classList.add('out'); el.style.opacity = '0'; dipping = false; }); } }, 150);
}
function nextShot(){
  if(lvupOpen()) return;
  if(tut.on){ tutNext(); return; }
  if(!S.answered || cueStroke) return;
  if(S.anim){ jumpingAhead = true; try{ finishAnim(); } finally { jumpingAhead = false; } }
  nextDeal();
}
export function wireNext(){
  $('next').addEventListener('click', ()=>nextShot());
}
export function wireTableTap(){
  tableBox.addEventListener('click', ()=>{ if(S.anim) return; if(tut.on) return; if(performance.now() - walkEndedAt < 300) return; if(S.answered) nextDeal(); });
  $('flashstart').addEventListener('click', e=>{ e.stopPropagation(); startFlashMode(); });
}
export function wireReplay(){
  $('replay').addEventListener('click', e=>{ e.stopPropagation(); replay(); });
}
export function wireLogoAlign(){
  if(window.ResizeObserver){ const ro = new ResizeObserver(()=>requestAnimationFrame(alignLogo)); ro.observe(document.querySelector('.table-box')); ro.observe(document.querySelector('header')); }
  window.addEventListener('resize', ()=>requestAnimationFrame(alignLogo));
}
export function wireReset(){
  $('reset').addEventListener('click', async ()=>{   // all or nothing: your whole progression, Ladder and Flash together
    const warn = `You'll start again at ${SHOOT_GRADES[0]} with no record: every shot and session, Ladder, Flash, Practice and Run-outs, is cleared. Flash, Practice, Run-outs and the bigger tables lock until you earn them back, and the lessons play again as you reach them. This can't be undone.`;
    if(!await ask({title: 'Reset your progress?', text: warn, ok: 'Reset', danger: true})) return;
    stats.log = []; stats.sessions = []; delete stats.archive; delete stats.run; S.RUN = null; delete stats.level; delete stats.shoot; stats.active = null; settings.practice = null; settings.tablePick = null; settings.flashTable = '7'; settings.tstyle = 'bar'; settings.ballSet = 'standard'; delete settings.lookSeen; applyStyle();
    if(settings.tutSeen) for(const k in LESSONS) if(LESSONS[k].at > 0) delete settings.tutSeen[k];
    saveSettings(); enforceLocks(); renderBadge(true); renderProgress(); renderModeChip();
    if(!flashUnlocked() && settings.task==='flash' || !practiceUnlocked() && isDrill() || !runUnlocked() && settings.task==='run') applySetting('task','shoot');
    showSessIdle(); syncPressed(); save(); renderStats(); syncStreakPill(); if(!S.answered && !S.anim) deal(); });
}
const menuOpen = () => !$('menu').hidden;
export function openMenu(v){ $('menu').hidden = !v; if(v) $('menuclose').focus({preventScroll:true}); else $('cog').focus({preventScroll:true}); }
export function wireHeader(){
  $('help').addEventListener('click', ()=>openTutMenu(true));
  $('tutmenuclose').addEventListener('click', ()=>openTutMenu(false));
  $('tutmenu').addEventListener('click', e=>{ const b = e.target.closest('[data-lesson]'); if(b){ openTutMenu(false); startTut(b.dataset.lesson); } else if(e.target === $('tutmenu')) openTutMenu(false); });
  $('coachnext').addEventListener('click', ()=>tutNext());
  $('coachback').addEventListener('click', ()=>tutBack());
  $('coachskip').addEventListener('click', ()=>endTut());

  $('cog').addEventListener('click', ()=>openMenu(true));
  $('badge').addEventListener('click', ()=>openProg(true));
  $('badge').addEventListener('keydown', e=>{ if(!e.defaultPrevented && (e.key==='Enter' || e.key===' ')){ e.preventDefault(); e.stopPropagation(); openProg(true); } });
  $('progclose').addEventListener('click', ()=>openProg(false));
  document.addEventListener('keyup', e=>{ if(e.key===' ' && look.target){ e.preventDefault(); setLook(false); } });
  $('upbtn').addEventListener('click', e=>{ e.stopPropagation(); standUpOff(); });
  ['pointerdown'].forEach(ev=>$('upbtn').addEventListener(ev, e=>e.stopPropagation()));
  // touch on the table: a long press is never a page menu or a text selection (a held eye is looking, not asking for a menu);
  // and a no-op touch listener lets iOS show the controls' pressed (:active) states
  { let touched = 0;
    tableBox.addEventListener('pointerdown', e=>{ touched = e.pointerType === 'touch' || e.pointerType === 'pen' ? performance.now() : 0; }, {capture: true, passive: true});
    tableBox.addEventListener('contextmenu', e=>{ if(touched && performance.now() - touched < 3000) e.preventDefault(); });
    document.addEventListener('touchstart', ()=>{}, {passive: true}); }
  { const b = $('lookbtn'); b.addEventListener('pointerdown', e=>{ e.preventDefault(); e.stopPropagation(); uiSound('tap'); setLook(true); });
    ['pointerup','pointercancel','pointerleave'].forEach(t=>b.addEventListener(t, e=>{ e.stopPropagation(); if(look.target) setLook(false); })); b.addEventListener('click', e=>e.stopPropagation()); }
  { const b = $('focusbtn'); b.addEventListener('pointerdown', e=>{ e.preventDefault(); e.stopPropagation(); });   // no focus ring left behind for Enter to press again
    b.addEventListener('click', e=>{ e.stopPropagation(); pivotToggle(); }); }
  document.querySelectorAll('[data-stab]').forEach(b=>b.addEventListener('click', ()=>{
    document.querySelectorAll('[data-stab]').forEach(x=>x.setAttribute('aria-pressed', x === b));
    ['you','table','sound','gfx'].forEach(k=>{ $('set-' + k).hidden = b.dataset.stab !== k; });
  }));
  $('showright').addEventListener('click', e=>{ e.stopPropagation(); replayRightNow(); });
}
export function openProg(v){ if(v) renderProgress(); $('prog').hidden = !v; if(v){ $('progclose').focus({preventScroll:true}); const h = $('ladder').querySelector('.here'); if(h) h.scrollIntoView({block:'center'}); } else $('badge').focus({preventScroll:true}); }
// every grade open at once, quietly (no level-up cards): the Efren Reyes player (below)
function openEveryGrade(){
  const top = SHOOT_GRADES.length - 1, L = ensureShootLevel();
  L.g = L.best = top; L.pts = 0; settings.practice = null;
  settings.tutSeen = Object.fromEntries(Object.keys(LESSONS).map(k=>[k, 1]));   // lessons stay in the ? menu
  if(settings.shaftGot !== '1'){ settings.shaft = 'carbon'; settings.shaftGot = '1'; }   // as reaching S does
  saveSettings(); save(); renderBadge(true); renderProgress(); renderModeChip();
  enforceLocks(); syncPressed(); renderShootControls(); renderStats();   // every lock opens at once: Flash, tables, looks, shaft (menus included, even if open)
  if(!S.anim) dealFresh();
}
// Special players: a name (any case or spacing) in NAMED gives that player something extra. Each entry has a tag (shown
// under the table while you play as them), a card shown once, and what it does. Add a character with one more entry.
//  "Efren Reyes": every grade, mode and look open, and every first-run step skipped (stance card on defaults, the tour,
//    the lessons, the What's new card). The lessons, the tour and What's new stay under ?.
//  "Disco Stu": the hidden Disco ball set, put on the table (its light show and tunes follow from the set).
const nameKey = name => String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
const NAMED = {
  'efren reyes': {tag: 'unltag', seen: 'unlockedSeen', skips: true,
    title: 'Everything unlocked', text: 'This player has every grade, mode and look open, and skips the lessons. The lessons and the tour are still under ?.',
    label: 'everything unlocked', apply(){
      const L = ensureShootLevel(), top = SHOOT_GRADES.length - 1;
      if(!(L.g === top && L.best === top && settings.shaftGot === '1')) openEveryGrade();
      else if(!S.anim && S.shot && S.shot.bare) dealFresh();
    }},
  'disco stu': {tag: 'discotag', seen: 'discoSeen',
    title: 'Disco mode', text: 'This player has the Disco ball set, its light show and its music. You can switch sets any time with the Look button.',
    label: 'Disco mode', apply(){
      if(settings.discoGot) return;   // only the first time: after that the set is theirs to change
      settings.discoGot = 1; settings.ballSet = 'disco'; saveSettings();
      applyStyle(); syncPressed(); if(S.shot && !S.anim) draw(S.answered);
    }},
};
const namedOf = name => NAMED[nameKey(name)] || null;
const isEasterEgg = name => !!(namedOf(name) || {}).skips;
export function easterEggSkips(){   // the first-run steps marked done (before the first deal, so no lesson starts)
  if(!isEasterEgg(S.ME.name)) return false;
  settings.stanceSet = 1; settings.tourSeen = 1; settings.tut = 1;
  settings.tutSeen = Object.fromEntries(Object.keys(LESSONS).map(k=>[k, 1]));
  settings.notesSeen = Math.max(+settings.notesSeen || 0, notesTop);
  saveSettings(); return true;
}
function renderEasterEggMark(){
  const n = namedOf(S.ME.name);
  Object.values(NAMED).forEach(c=>{ const t = $(c.tag); if(t) t.hidden = c !== n; });
  if(n) $('plchip').setAttribute('aria-label', `${S.ME.name}, ${n.label}: switch player`); else $('plchip').removeAttribute('aria-label');
}
export function easterEggCheck(){
  renderEasterEggMark();
  const n = namedOf(S.ME.name);
  if(!n) return;
  if(n.skips){
    easterEggSkips();
    if(tour.on){ tour.first = false; endTour(); }   // renamed mid-way through the first run: off the tour, the stance card or a lesson
    if(!$('stancecover').hidden){ $('stancecover').hidden = true; if(S.shot) S.shot.bare = false; }
    if(callLock) lockCalls(false);
    if(tut.on) endTut();
  }
  n.apply();
  if(!settings[n.seen]){   // once: what this player is
    settings[n.seen] = 1; saveSettings();
    ask({title: n.title, text: n.text, ok: 'OK', cancel: null});
  }
}
export function wireRadio(){
  $('radio').addEventListener('click', e=>{ e.stopPropagation(); applySetting('music', STATIONS[(STATIONS.indexOf(settings.music) + 1) % STATIONS.length]); });
  ['pointerdown'].forEach(t=>$('radio').addEventListener(t, e=>e.stopPropagation()));
}
// ---------- the Look picker: the Look disc under the radio opens it. Table style and ball set (and from S the Ladder's table),
// each choice with a little preview; locked ones show the grade that opens them. A choice goes through applySetting, as the
// buttons in Settings > Table do, so the two stay in step. A gold dot on the disc marks a look you've opened but not seen here yet.
const LOOK_OPTS = {tstyle: [['bar', 'Bar'], ['club', 'Club'], ['pro', 'Pro']], ballSet: [['standard', 'Standard'], ['retro', 'Retro'], ['tv', 'TV'], ['blackout', 'Blackout'], ['disco', 'Disco']]};
const lookNew = () => Object.keys(LOOK_OPTS).flatMap(k=>LOOK_OPTS[k].filter(([v])=>LOOK_AT[k][v] > 0 && lookOpen(k, v) && !(settings.lookSeen || []).includes(k + ':' + v)).map(([v])=>k + ':' + v));
const LOOK_LOCK = '<span class="lock" aria-hidden="true"><svg viewBox="0 0 12 12"><rect x="2" y="5.2" width="8" height="5.8" rx="1.2" fill="currentColor"/><path d="M3.9 5.2V3.8a2.1 2.1 0 0 1 4.2 0v1.4" fill="none" stroke="currentColor" stroke-width="1.3"/></svg></span>';
var lookPick = {open: false, fresh: [], back: null};   // var: syncPressed may run before this line does
function lookSwatch(k, v){
  if(k === 'tstyle'){   // a little table: rails, cloth, diamonds
    const S = STYLES[v], dm = [16, 32, 48].map(x=>`<circle cx="${x}" cy="3" r=".9" fill="${S.diamond}"/><circle cx="${x}" cy="33" r=".9" fill="${S.diamond}"/>`).join('');
    return `<svg viewBox="0 0 64 36" aria-hidden="true"><rect x=".5" y=".5" width="63" height="35" rx="4" fill="${S.rail}" stroke="${S.edge}"/><rect x="6" y="6" width="52" height="24" rx="1" fill="${S.cloth}"/><rect x="6" y="6" width="52" height="24" rx="1" fill="none" stroke="${S.hi}" stroke-width=".8"/>${dm}</svg>`;
  }
  const B = BALL_SETS[v], col = n => (B.c && B.c[n]) || OB_COLORS[n - 1][0], cl = ST().cloth;   // three balls on today's cloth: two solids and a stripe
  const hh = 4*B.stripeW/.38, hw = Math.sqrt(64 - hh*hh).toFixed(2), [cx, cy, sr, op, core] = B.shine, gid = 'swsh-' + v;   // the set's stripe height and highlight
  const shine = x => (B.holo ? `<circle cx="${x}" cy="12" r="8" fill="url(#${gid}h)" style="mix-blend-mode:overlay"/>` : '') + `<circle cx="${x}" cy="12" r="8" fill="url(#${gid})"/>`;
  const ball = (x, n, stripe) => (stripe
    ? `<circle cx="${x}" cy="12" r="8" fill="${B.white}" stroke="rgba(0,0,0,.35)" stroke-width=".6"/><path d="M${x} ${12 - hh}m-${hw} 0A8 8 0 0 0 ${x - hw} ${12 + hh}L${x + +hw} ${12 + hh}A8 8 0 0 0 ${x + +hw} ${12 - hh}Z" fill="${col(n)}"/>`
    : `<circle cx="${x}" cy="12" r="8" fill="${col(n)}" stroke="rgba(0,0,0,.35)" stroke-width=".6"/>`) + shine(x);
  return `<svg viewBox="0 0 64 24" aria-hidden="true"><defs><radialGradient id="${gid}" cx="${cx}%" cy="${cy}%" r="${sr}%"><stop offset="0" stop-color="#fff" stop-opacity="${op}"/>${core ? `<stop offset="${core}" stop-color="#fff" stop-opacity="${op*.7}"/>` : ''}<stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>${B.holo ? HOLO(gid + 'h') : ''}</defs><rect x="0" y="0" width="64" height="24" rx="5" fill="${cl}"/>${ball(13, 1)}${ball(32, 3)}${ball(51, 2, true)}</svg>`;
}
function lookGroup(k, label, opts, cur, open, at){
  const id = 'stylegrp-' + k;
  return `<div class="stylegrp${k === 'tablePick' ? ' stylesize' : ''}"><b id="${id}">${label}</b><div class="styleopts" role="radiogroup" aria-labelledby="${id}" data-look="${k}" style="--n:${opts.length}">`
    + opts.map(([v, name])=>{
      const on = v === cur, ok = open(v), nw = ok && lookPick.fresh.includes(k + ':' + v);
      return `<button type="button" class="styleopt" role="radio" data-val="${v}" aria-checked="${on}" aria-disabled="${!ok}" tabindex="${on ? 0 : -1}"${ok ? '' : ` aria-description="Opens at ${stepGrade(at(v))}"`}>`
        + (nw ? '<span class="wnpill" aria-hidden="true">New</span>' : '') + (k === 'tablePick' ? '' : lookSwatch(k, v))
        + `<span class="stylename">${name}${nw ? '<span class="srsay">, new</span>' : ''}</span>` + (ok ? '' : `<small aria-hidden="true">${LOOK_LOCK}Opens at ${stepGrade(at(v))}</small>`) + '</button>';
    }).join('') + '</div></div>';
}
function renderLookPicker(){
  const fresh = lookNew().length > 0, b = $('stylebtn'); let dot = b.querySelector('.wndot');
  if(fresh && !dot) b.querySelector('.radiodisc').insertAdjacentHTML('beforeend', '<span class="wndot" aria-hidden="true"></span>'); else if(!fresh && dot) dot.remove();
  b.setAttribute('aria-label', 'Look: table style and balls' + (fresh ? ', something new to try' : ''));
  if(!lookPick.open) return;
  const a = document.activeElement, had = a && a.closest ? a.closest('#stylebody .styleopt') : null, hk = had && had.parentNode.dataset.look, hv = had && had.dataset.val;
  let h = lookGroup('tstyle', 'Table', LOOK_OPTS.tstyle, settings.tstyle, v=>lookOpen('tstyle', v), v=>LOOK_AT.tstyle[v])
    + lookGroup('ballSet', 'Balls', LOOK_OPTS.ballSet.filter(([v])=>v !== 'disco' || settings.discoGot), settings.ballSet, v=>lookOpen('ballSet', v), v=>LOOK_AT.ballSet[v]);
  if(ladderPickOpen()) h += lookGroup('tablePick', 'Ladder table', [['7', '7 ft'], ['8', '8 ft'], ['9', '9 ft']], ladderTable(), ()=>true, ()=>0);
  $('stylebody').innerHTML = h;
  if(hk){ const f = $('stylebody').querySelector(`[data-look="${hk}"] [data-val="${hv}"]`); if(f) f.focus({preventScroll: true}); }   // a redraw keeps your place
}
// open the picker (focus: 'tstyle' or 'ballSet' puts you on that row)
export function openLookPicker(focus){
  if(lookPick.open){ lookFocus(focus); return; }
  lookPick.fresh = lookNew(); lookPick.back = document.activeElement; lookPick.open = true;
  settings.lookSeen = [...new Set([...(settings.lookSeen || []), ...lookPick.fresh])]; saveSettings();   // seen now: the dot goes
  $('stylemenu').hidden = false; $('stylebtn').setAttribute('aria-expanded', 'true');
  renderLookPicker(); lookFocus(focus);
}
function lookFocus(focus){
  const g = $('stylebody').querySelector(`[data-look="${focus === 'ballSet' ? 'ballSet' : 'tstyle'}"]`), b = g && (g.querySelector('[aria-checked="true"]') || g.querySelector('[role=radio]'));
  if(b){ b.focus({preventScroll: true}); if(focus && b.scrollIntoView) b.scrollIntoView({block: 'nearest'}); }
}
function closeLookPicker(){
  if(!lookPick.open) return;
  lookPick.open = false; lookPick.fresh = []; $('stylemenu').hidden = true; $('stylebtn').setAttribute('aria-expanded', 'false');
  const r = lookPick.back && lookPick.back.isConnected && lookPick.back !== document.body ? lookPick.back : $('stylebtn'); lookPick.back = null; if(r && r.focus) r.focus({preventScroll: true});
}
function lookChoose(b){
  if(!b || b.getAttribute('aria-disabled') === 'true') return;
  applySetting(b.parentNode.dataset.look, b.dataset.val);   // the same path as Settings > Table
}
export function wireLookPicker(){
  $('stylebtn').addEventListener('click', e=>{ e.stopPropagation(); lookPick.open ? closeLookPicker() : openLookPicker(); });
  $('stylebtn').addEventListener('pointerdown', e=>e.stopPropagation());
  $('styleclose').addEventListener('click', closeLookPicker);
  $('stylemenu').addEventListener('click', e=>{ if(e.target === $('stylemenu')) closeLookPicker(); else lookChoose(e.target.closest('.styleopt')); });
  // while it's open the game behind takes no keys: Esc closes it, Tab stays inside, the arrows move along a row and choose
  window.addEventListener('keydown', e=>{
    if(!lookPick.open) return;
    e.stopPropagation();
    if(e.key === 'Escape'){ e.preventDefault(); closeLookPicker(); return; }
    if(e.key === 'Tab'){
      const f = [...$('stylemenu').querySelectorAll('button')].filter(x=>x.tabIndex >= 0), i = f.indexOf(document.activeElement);
      if(f.length){ e.preventDefault(); f[(i < 0 ? 0 : i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus(); }
      return;
    }
    const a = document.activeElement, cur = a && a.closest ? a.closest('.styleopt') : null;
    const d = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1}[e.key];
    if(cur && d){
      e.preventDefault();
      const ok = [...cur.parentNode.querySelectorAll('.styleopt')].filter(x=>x.getAttribute('aria-disabled') !== 'true');
      if(!ok.length) return;
      const nx = ok[(ok.indexOf(cur) + d + ok.length) % ok.length] || ok[0];
      nx.focus(); lookChoose(nx);
    } else if(cur && (e.key === ' ' || e.key === 'Enter')){ e.preventDefault(); lookChoose(cur); }
  }, true);
  window.addEventListener('keyup', e=>{ if(lookPick.open) e.stopPropagation(); }, true);
  window.openLookPicker = openLookPicker;   // reachable from anywhere (the level-up card's Try it)
  renderRadio();
  $('ladder').addEventListener('click', e=>{
    const li = e.target.closest('li[data-g]'); if(!li) return;
    const i = +li.dataset.g;
    if(DEV) setGradeForTesting(i);
    else if(stats.shoot && i <= stats.shoot.g){ if(isDrill()) applySetting('task', 'shoot'); setPractice(i < stats.shoot.g ? i : null); openProg(false); }
  });
  $('prog').addEventListener('click', e=>{ if(e.target === $('prog')) openProg(false); });
  $('menuclose').addEventListener('click', ()=>openMenu(false));
  $('menu').addEventListener('click', e=>{ if(e.target === $('menu')) openMenu(false); });
  // a button you clicked or tapped keeps focus, and the browser presses it again on Space or Enter: on the table those keys are
  // the game's (hold Space to look), so a button focused by a pointer lets go after the click and never takes them. A button
  // you Tab to still presses with Space and Enter, and inside a card or menu nothing changes.
  { let viaPointer = false; const byPointer = new WeakSet();
    const inCard = el => !!(el.closest && el.closest('[role="dialog"], [role="menu"], [aria-modal="true"]'));
    const typing = el => /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable;
    const stale = el => el && el !== document.body && el.nodeType === 1 && byPointer.has(el) && !typing(el) && !inCard(el);
    window.addEventListener('pointerdown', ()=>{ viaPointer = true; }, {capture: true, passive: true});
    window.addEventListener('keydown', e=>{ if(e.key === 'Tab') viaPointer = false; }, true);
    window.addEventListener('focusin', e=>{ if(viaPointer) byPointer.add(e.target); else byPointer.delete(e.target); }, true);   // a card handing focus back after a click counts as the click's
    window.addEventListener('click', e=>{
      if(!e.detail) return;   // Space, Enter or a screen reader: keep focus where it is
      const b = e.target.closest && e.target.closest('button, [role="button"]');
      if(b && !inCard(b)) setTimeout(()=>{ if(document.activeElement === b && !inCard(b)) b.blur(); }, 0);
    }, true);
    ['keydown', 'keyup'].forEach(t=>window.addEventListener(t, e=>{
      if((e.key === ' ' || (e.key === 'Enter' && t === 'keydown')) && stale(document.activeElement)){ e.preventDefault(); if(t === 'keydown') document.activeElement.blur(); }   // the game still gets the key
    }, true));
  }
  document.addEventListener('keydown', e=>{
    if(e.target.tagName==='INPUT') return;
    if((e.key==='m' || e.key==='M') && !e.metaKey && !e.ctrlKey){ const L = ['off','parlor','smoke','felt']; applySetting('music', L[(L.indexOf(settings.music) + 1) % L.length]); e.preventDefault(); return; }
    if(e.key==='?' && !e.metaKey && !e.ctrlKey){ openTutMenu(false); openKeys(true); e.preventDefault(); return; }   // the keyboard shortcuts
    if(e.key==='Escape' && !$('tutmenu').hidden){ openTutMenu(false); $('help').focus({preventScroll: true}); e.preventDefault(); return; }
    if(e.key===' ' && isShooting() && settings.view !== 'top' && $('stancecover').hidden){ e.preventDefault(); if(!e.repeat) setLook(true); return; }
    if(!$('stancecover').hidden){ if(e.key==='Enter'){ closeStance(); e.preventDefault(); } return; }
    if(tut.on && e.key==='Enter'){ tutNext(); e.preventDefault(); return; }
    if(tut.on && e.key==='Escape'){ endTut(); e.preventDefault(); return; }
    if(menuOpen()){ if(e.key==='Escape'){ openMenu(false); e.preventDefault(); } return; }
    if(e.key==='Escape' && standUpOff()){ e.preventDefault(); return; }   // off the shot, back to standing
    if(!$('prog').hidden){ if(e.key==='Escape'){ openProg(false); e.preventDefault(); } return; }
    if(S.anim){ if(e.key==='Enter'){ nextShot(); e.preventDefault(); } else if(e.key==='Shift' && !e.repeat && !$('showright').hidden){ replayRightNow(); e.preventDefault(); } return; }   // keys never touch the animation: Enter is "next shot", Shift the right shot 
    if(!$('startcover').hidden){ if(e.key==='Enter' || e.key===' '){ startFlashMode(); e.preventDefault(); } return; }
    if((e.key==='v' || e.key==='V') && !e.metaKey && !e.ctrlKey && !e.altKey){ if(!e.repeat && pivotToggle()) e.preventDefault(); return; }   // look around the object ball, or back to the cue ball
    if(e.key==='Shift' && !e.repeat && !$('cover').hidden && !$('replay').hidden){ replay(); e.preventDefault(); return; }   // Shift replays: Flash's replay,
    if(e.key==='Shift' && !e.repeat && !$('showright').hidden && !S.anim){ replayRightNow(); e.preventDefault(); return; }   // or the right shot after a miss
    if(callLock) return;   // a new player before the first lesson: keys 1–5 and Enter have nothing to call
    const k = parseInt(e.key,10);
    if(tut.on && !tstep().ask) return;   // nothing to call on this step: the fraction keys do nothing
    if(k>=1 && k<=REFS.length && !S.answered){ pickFrac(REFS[k-1].id); e.preventDefault(); }
    else if(isShooting() && !S.answered && ctrl().speed && (e.key==='ArrowUp' || e.key==='ArrowDown')){ setSpeedLevel(speedLevel() + (e.key==='ArrowUp' ? 1 : -1)); e.preventDefault(); }
    else if(isShooting() && !S.answered && /^[wasdx]$/i.test(e.key) && !e.metaKey && !e.ctrlKey){ nudgeTip(e.key.toLowerCase()); e.preventDefault(); }
    else if(e.key==='Enter'){ if(S.answered){ nextDeal(); e.preventDefault(); } }
  });
}
// players: your name (edit to rename), and back to the picker
// the player dropdown, before the grade: switch player, add one, rename
export function renderPlMenu(){
  const full = PL.list.length >= PL_MAX;
  $('plchipname').textContent = S.ME.name;
  $('plmenu').innerHTML = PL.list.map(p=>`<button role="menuitem" data-pl="${p.id}"${p.id === S.ME.id ? ' aria-current="true"' : ''}><span>${plEsc(p.name)}</span><small>${plGrade(p.id)}</small></button>`).join('')
    + '<hr>' + (full ? '' : '<button role="menuitem" data-plact="new">New player…</button>') + '<button role="menuitem" data-plact="rename">Rename…</button><button role="menuitem" data-plact="manage">Manage players…</button><button role="menuitem" data-plact="backup">Back up / Restore…</button>';
}
export const plOpen = v => { $('plmenu').hidden = !v; $('plchip').setAttribute('aria-expanded', v); if(v) renderPlMenu(); };
export function wirePlayerMenu(){
  if(!TEST){ $('plwrap').hidden = false; renderPlMenu(); }
  $('plchip').addEventListener('click', e=>{ e.stopPropagation(); plOpen($('plmenu').hidden); });
  $('plmenu').addEventListener('click', e=>{
    e.stopPropagation(); const b = e.target.closest('button'); if(!b) return; plOpen(false);
    if(b.dataset.pl){ if(b.dataset.pl !== S.ME.id) playAs(b.dataset.pl); return; }
    if(b.dataset.plact === 'backup'){ openBackup($('plchip')); return; }
    if(b.dataset.plact === 'rename') ask({title: 'Rename player', value: S.ME.name, label: 'Player name', ok: 'Rename', from: $('plchip')}).then(r=>{ const v = (r || '').slice(0, 16), p = PL.list.find(q=>q.id === S.ME.id); if(v && p){ p.name = S.ME.name = v; savePL(); renderPlMenu(); easterEggCheck(); } });
    else { showPlayers(); if(b.dataset.plact === 'new') $('plname').focus({preventScroll: true}); }
  });
  document.addEventListener('click', ()=>{ if(!$('plmenu').hidden) plOpen(false); });
  document.addEventListener('keydown', e=>{ if(e.key === 'Escape' && !$('plmenu').hidden){ plOpen(false); e.stopPropagation(); } }, true);
}
// first launch: set where you stand before anything else
function closeStance(){ settings.stanceSet = 1; saveSettings(); askPersist(); $('stancecover').hidden = true; showSessIdle(); if(!settings.tourSeen && startTour(true)) return; deal(); }
export function wireStanceCard(){
  $('stancedone').addEventListener('click', e=>{ e.stopPropagation(); closeStance(); });
}
// ---------- the app tour: how to use Halfball (not how to play pool), once for a new player after the stance card ----------
const TOUR = [
  {el: 'answers', t: 'Welcome to Halfball', p: 'Each shot, call how full you’ll hit the object ball with one of these fractions, then shoot. That’s the game.'},
  {el: '.table-box', t: 'The table', p: 'Drag on the table to look around the cue ball; the ' + kt('focus button (or <b>V</b>)', 'focus button') + ' swaps to the object ball. Hold ' + kt('<b>Space</b> or the eye button', 'the eye button') + ' to step back and see the whole table.'},
  {el: 'badge', t: 'Your grade', p: 'Call shots right to move up. Each grade adds something new: tap your grade to see the ladder.'},
  {el: 'badge', t: 'It starts simple', p: 'You start by just calling the fraction. As you climb you’ll unlock:'
    + '<ul class="tourlist"><li>Getting down on the shot</li><li>Any angle, on a bigger table</li><li>Speed and spin</li><li>English, then everything at once</li></ul>'},
  {el: 'task-flash', t: 'Opens as you climb', p: 'A 🔒 opens as you climb: Flash mode, bigger tables, table styles and ball sets. ' + kt('Hover over or click a lock', 'Tap a lock') + ' to see when.'},
  {el: 'cog', t: 'Settings', p: 'Your height and stance, shooting hand, colours, table size and look, and sound.'},
  {el: 'radio', t: 'Music', p: 'Tap the radio to change the station or turn it off. Volume is in Settings › Sound.'},
  {el: 'help', t: 'Lessons', p: 'The <b>?</b> replays any lesson you’ve reached, and this tour.'},
  {el: 'plwrap', t: 'Players', p: 'Switch players or add one here. Each player keeps their own grade and settings.'},
];
const tourEl = st => st.el[0] === '.' ? document.querySelector(st.el) : $(st.el);
const tourShown = el => !!el && !el.closest('[hidden]') && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
function startTour(first){
  if(tour.on) return true;
  tour.steps = TOUR.filter(st=>tourShown(tourEl(st)));   // only what's on screen right now (Flash isn't shown everywhere)
  if(!tour.steps.length) return false;
  if(!$('plmenu').hidden) plOpen(false);
  openTutMenu(false); openMenu(false);
  tour.on = true; tour.i = 0; tour.first = !!first;
  $('tour').hidden = false; tourStep();
  return true;
}
function endTour(){
  if(!tour.on) return;
  tour.on = false; $('tour').hidden = true;
  settings.tourSeen = 1; saveSettings();
  if(tour.first){ tour.first = false; deal(); }   // first time: on to the game (and its first lesson)
}
function tourStep(){
  const n = tour.steps.length, st = tour.steps[tour.i];
  $('tourstep').textContent = `${tour.i + 1} of ${n}`;
  $('tourtitle').textContent = st.t; $('tourtext').innerHTML = st.p;
  $('tourback').hidden = tour.i === 0;
  $('tournext').textContent = tour.i === n - 1 ? 'Let’s play' : 'Next';
  const el = tourEl(st);
  if(el && el.scrollIntoView) try{ el.scrollIntoView({block: 'nearest', inline: 'nearest'}); }catch(e){}
  tourPlace();
  $('tournext').focus({preventScroll: true});
}
function tourPlace(){
  if(!tour.on) return;
  const el = tourEl(tour.steps[tour.i]), hole = $('tourhole'), card = $('tourcard');
  const vw = window.innerWidth || document.documentElement.clientWidth, vh = window.innerHeight || document.documentElement.clientHeight, M = 12, pad = 6;
  const r = el ? el.getBoundingClientRect() : null;
  if(!r || !r.width){ hole.classList.add('none'); card.style.left = Math.max(M, (vw - card.offsetWidth)/2) + 'px'; card.style.top = Math.max(M, vh*.3) + 'px'; return; }
  hole.classList.remove('none');
  const L = Math.max(2, r.left - pad), T = Math.max(2, r.top - pad), R2 = Math.min(vw - 2, r.right + pad), B = Math.min(vh - 2, r.bottom + pad);
  Object.assign(hole.style, {left: L + 'px', top: T + 'px', width: Math.max(0, R2 - L) + 'px', height: Math.max(0, B - T) + 'px'});
  const w = card.offsetWidth, h = card.offsetHeight;
  let top;
  if(B + M + h <= vh - M) top = B + M;                 // below it
  else if(T - M - h >= M) top = T - M - h;             // above it
  else top = Math.max(M, vh - h - M);                  // a big one (the table): over its lower part
  const left = Math.min(Math.max(M, (r.left + r.right)/2 - w/2), Math.max(M, vw - w - M));
  card.style.left = left + 'px'; card.style.top = top + 'px';
}
function tourGo(d){
  if(!tour.on) return;
  const i = tour.i + d;
  if(i < 0) return;
  if(i >= tour.steps.length) return endTour();
  tour.i = i; tourStep();
}
export function wireTour(){
  $('tournext').addEventListener('click', ()=>tourGo(1));
  $('tourback').addEventListener('click', ()=>tourGo(-1));
  $('tourskip').addEventListener('click', ()=>endTour());
  ['click', 'pointerdown', 'pointerup', 'pointermove', 'touchstart', 'wheel', 'contextmenu'].forEach(t=>$('tour').addEventListener(t, e=>e.stopPropagation()));   // nothing behind it plays while the tour is up
  ['keydown', 'keyup'].forEach(t=>window.addEventListener(t, e=>{
    if(!tour.on) return;
    e.stopPropagation();
    if(e.key === 'Tab') return;
    if(t === 'keydown'){
      if(e.key === 'Enter' || e.key === 'ArrowRight') tourGo(1);
      else if(e.key === 'ArrowLeft') tourGo(-1);
      else if(e.key === 'Escape') endTour();
    }
    e.preventDefault();
  }, true));
  ['resize', 'scroll'].forEach(t=>window.addEventListener(t, ()=>{ if(tour.on) requestAnimationFrame(tourPlace); }, {passive: true}));
  $('tourreplay').addEventListener('click', e=>{ e.stopPropagation(); openTutMenu(false); startTour(false); });
  ['click', 'pointerdown'].forEach(t=>$('stancecover').addEventListener(t, e=>e.stopPropagation()));
  ['click', 'pointerdown'].forEach(t=>$('startcover').addEventListener(t, e=>e.stopPropagation()));   // a tap on the Flash card isn't a tap on the table
  $('startcover').addEventListener('click', ()=>{ if(!$('startcover').hidden) startFlashMode(); });   // ...it starts the clock, as Start does
}
// background music: off to start; it can only begin after a tap or key (browsers block sound before that)
export function wireMusic(){
  if(!['off','parlor','smoke','felt'].includes(settings.music) || (settings.musicV | 0) < 2){ settings.music = 'off'; settings.musicV = 2; }   // music off by default (once, for everyone); the radio turns it on
  renderRadio();
  if(!(+settings.musicVol >= 0 && +settings.musicVol <= 100) || (settings.musicVolV | 0) < 2){ settings.musicVol = 20; settings.musicVolV = 2; }   // 20% for everyone, once (then it's yours)
  $('musicvol').value = settings.musicVol; $('musicvolval').textContent = settings.musicVol + '%';
  if(window.Music) Music.setVolume(settings.musicVol/100);
  $('musicvol').addEventListener('input', e=>{ settings.musicVol = +e.target.value; $('musicvolval').textContent = settings.musicVol + '%'; saveSettings(); if(window.Music) Music.setVolume(settings.musicVol/100); });
  startMusic();   // straight away where the browser allows it; otherwise it waits, and the first tap or key starts it
  ['pointerdown', 'keydown'].forEach(t=>window.addEventListener(t, startMusic, {capture: true, passive: true}));   // capture: the tour and other cards stop their taps, but not this
  if(!(+settings.rigOpacity >= 50 && +settings.rigOpacity <= 100) || (settings.rigOpV || 0) < 2){ settings.rigOpacity = 100; settings.rigOpV = 2; }   // solid by default (once for everyone); see-through is a setting
  $('rigoprange').value = settings.rigOpacity; $('rigopval').textContent = settings.rigOpacity + '%';
  $('rigoprange').addEventListener('input', e=>{ settings.rigOpacity = +e.target.value; $('rigopval').textContent = settings.rigOpacity + '%'; saveSettings(); if(S.shot) draw(S.answered); });
  if(!isHex(settings.glove)) settings.glove = GLOVE_DEF;
  if(!isHex(settings.skin)) settings.skin = HAND_DEF;
  Object.entries(COLOR_INPUTS).forEach(([k, ids])=>ids.forEach(id=>{ $(id).value = settings[k]; $(id).addEventListener('input', e=>{
    settings[k] = e.target.value; ids.forEach(j=>{ if(j !== id) $(j).value = settings[k]; }); saveSettings(); if(S.shot) draw(S.answered);
  }); }));
}
const startMusic = () => { if(!window.Music || settings.music === 'off') return; if(Music.playing()) Music.resume(); else Music.play(settings.music); };
const COLOR_INPUTS = {glove: ['glovecolor', 'st-glove'], skin: ['skincolor', 'st-skin']};   // Settings and the first-launch card
// ---------- keyboard shortcuts: ? or the Help menu; keys stay in the card while it's up, Esc or ? closes it ----------
let keysFrom = null;
function openKeys(v){
  if(v === !$('keys').hidden) return;
  if(v){ keysFrom = document.activeElement; $('keys').hidden = false; $('keysbody').scrollTop = 0; $('keysok').focus({preventScroll: true}); return; }
  $('keys').hidden = true;
  const f = keysFrom && keysFrom.isConnected && keysFrom !== document.body && !keysFrom.closest('[hidden]') ? keysFrom : $('help'); keysFrom = null;
  try{ f.focus({preventScroll: true}); }catch(e){}
}
export function wireKeysCard(){
  $('keysopen').addEventListener('click', e=>{ e.stopPropagation(); openTutMenu(false); openKeys(true); keysFrom = $('help'); });
  $('keysok').addEventListener('click', e=>{ e.stopPropagation(); openKeys(false); });
  ['click', 'pointerdown'].forEach(t=>$('keys').addEventListener(t, e=>{ e.stopPropagation(); if(t === 'click' && e.target === $('keys')) openKeys(false); }));
  window.addEventListener('keydown', e=>{
    if($('keys').hidden) return;
    e.stopPropagation();
    if(e.key === 'Escape' || e.key === '?'){ e.preventDefault(); openKeys(false); }
    else if(e.key === 'Tab'){ e.preventDefault(); (document.activeElement === $('keysok') ? $('keysbody') : $('keysok')).focus(); }
  }, true);
}
// ---------- What's new (the list, WHATS_NEW, is near the top): a dot on ? while there's something unseen, the card once ----------
const wnVer = e => '1.' + e.build;   // just the build it shipped in
const wnUnseen = () => WHATS_NEW.filter(e=>e.build > settings.notesSeen);
let wnFrom;   // set in wireWhatsNew()
let wnPoll;   // set in wireWhatsNew()
let wnInput;   // set in wireWhatsNew()
export function wireWhatsNew(){
  wnFrom = null, wnPoll = 0, wnInput = performance.now();
  $('wnok').addEventListener('click', e=>{ e.stopPropagation(); closeWhatsNew(); });
  ['click', 'pointerdown'].forEach(t=>$('wn').addEventListener(t, e=>{ e.stopPropagation(); if(t === 'click' && e.target === $('wn')) closeWhatsNew(); }));
  window.addEventListener('keydown', e=>{   // while it's up, keys stay in the card: Esc closes, Tab goes round its buttons
    if($('wn').hidden) return;
    e.stopPropagation();
    if(e.key === 'Escape'){ e.preventDefault(); closeWhatsNew(); return; }
    if(e.key === 'Tab'){
      const f = [...$('wn').querySelectorAll('button')].filter(b=>!b.hidden), i = f.indexOf(document.activeElement);
      if(f.length){ e.preventDefault(); f[(i + (e.shiftKey ? f.length - 1 : 1) + f.length) % f.length].focus(); }
    }
  }, true);
  // the one-time card waits for a calm moment: a shot on the table, untouched for a moment, with nothing else up
  // (not the first-run stance card or tour, a lesson, a menu or cover, a shot rolling, or a Flash run)
  ['pointerdown', 'keydown', 'wheel'].forEach(t=>window.addEventListener(t, ()=>{ wnInput = performance.now(); }, {capture: true, passive: true}));
}
function wnEntry(e, isNew){
  return `<section class="wnentry"><div class="wnmeta"><span>${wnVer(e)}</span>${isNew ? '<span class="wnpill">New</span>' : ''}</div>`
    + `<h3>${e.title}</h3><ul>${e.items.map(t=>`<li>${t}</li>`).join('')}</ul></section>`;
}
function wnSync(){   // the dot on ? and the menu item follow what's unseen
  const n = wnUnseen().length, h = $('help');
  let dot = h.querySelector('.wndot'); if(n && !dot) h.insertAdjacentHTML('beforeend', '<span class="wndot" aria-hidden="true"></span>'); else if(!n && dot) dot.remove();
  h.setAttribute('aria-label', n ? 'Help: lessons and what’s new, with new notes' : 'Help: lessons and what’s new');
  let b = $('wnopen');
  if(!b){ $('keysopen').insertAdjacentHTML('beforebegin', '<button id="wnopen"></button>'); b = $('wnopen'); b.addEventListener('click', e=>{ e.stopPropagation(); openTutMenu(false); openWhatsNew(false); }); }
  b.innerHTML = 'What’s new' + (n ? '<span class="wnpill">New</span>' : WHATS_NEW[0] ? `<small>${wnVer(WHATS_NEW[0])}</small>` : '');
}
// sinceSeen: the one-time card, only the builds since you last looked (the three newest, the rest a tap away); otherwise all of it
function openWhatsNew(sinceSeen){
  const unseen = new Set(wnUnseen()), list = sinceSeen ? [...unseen] : WHATS_NEW, SHOW = 3;
  if(!list.length) return false;
  const head = list.slice(0, sinceSeen ? SHOW : list.length), rest = list.length - head.length;
  $('wnkick').textContent = sinceSeen ? 'Since you last played' : 'Release notes';
  $('wnbody').innerHTML = head.map(e=>wnEntry(e, !sinceSeen && unseen.has(e))).join('')
    + (rest ? `<button class="wnmore" id="wnmore">And ${rest} earlier update${rest > 1 ? 's' : ''}</button>` : '');
  if(rest) $('wnmore').addEventListener('click', e=>{ e.stopPropagation(); const at = e.currentTarget; at.insertAdjacentHTML('beforebegin', list.slice(SHOW).map(x=>wnEntry(x, false)).join('')); at.remove(); $('wnok').focus({preventScroll: true}); });
  wnFrom = document.activeElement;
  $('wn').hidden = false; $('wnbody').scrollTop = 0;
  $('wnok').focus({preventScroll: true});
  clearInterval(wnPoll); wnPoll = 0;
  return true;
}
function closeWhatsNew(){
  if($('wn').hidden) return;
  $('wn').hidden = true;
  settings.notesSeen = Math.max(settings.notesSeen, notesTop); saveSettings(); wnSync();
  const f = wnFrom && wnFrom.isConnected && wnFrom !== document.body ? wnFrom : $('help'); wnFrom = null;
  try{ f.focus({preventScroll: true}); }catch(e){}
}
const wnCalm = () => !document.hidden && !tour.on && !tut.on && !callLock && !S.anim && !cueStroke && S.shot && !S.answered && !S.shot.bare
  && settings.task !== 'flash' && performance.now() - wnInput > 1500 && performance.now() - (S.shot.t0 || 0) > 1200
  && ['playercover', 'stancecover', 'menu', 'stylemenu', 'bk', 'tutmenu', 'prog', 'lvup', 'drill', 'flashsheet', 'runsheet', 'plmenu', 'cover', 'startcover', 'ask', 'keys'].every(id=>!$(id) || $(id).hidden);
export function startWhatsNew(){
  if(!TEST){
    wnSync();
    if(wnUnseen().length) wnPoll = setInterval(()=>{ if(wnCalm()) openWhatsNew(true); }, 1000);
  }
}
