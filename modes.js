// The modes: Flash, the round (deal, result card, log), the open-ended run, and the mode setup sheets.
import {hideLockTip, jumpingAhead, lockBtn, openProg, renderProgress, syncPressed, syncRefs} from './ui.js';
import {LESSONS, startTut, tstep, tutAnswer} from './lessons.js';
import {animateShot} from './anim.js';
import {draw, featherLoop, flashDown, rigAlpha, standUp} from './view.js';
import {callAim, COARSE_LBL, cueStroke, nearestCoarse, obHit, outcome, renderRoutineChip, renderShootControls, rigHitMs, routineRaf, shotStroke, snapTip, speedLevel, startRoutine, strokeThen, takeShot, tipName} from './shot.js';
import {addExtras, dealShot, renderRun, runChange, runChangeBack, runDeal, runPickCard, runPicking, runPicks, runPlanDone, runQuit, runSummary, runTapBall, runTapPocket, runUndoPlan, shootDeal} from './deal.js';
import {ctrl, ctrlAt, DRILL_FR, drillLevel, drillPicks, ensureShootLevel, flashTableNow, GEN, isDrill, isRun, isShooting, practicing, progTable, shootLevel, shootRoutine, stanceAim, stepGrade, TABLE_AT, tableUnlocked} from './grades.js';
import {cheer, playSound, shotPlan, showStreak, tableSounds} from './audio.js';
import {PERF} from './perf.js';
import {curStreak, laterSave, S, save, saveSettings, sessTask, settings, SHOOT_GRADES, stats, STREAK_HOT, tour, trimLog, tut} from './state.js';
import {SH, stepOf} from './steps.js';
import {$, ALL, curTable, H, len, MISS, POCKETS, RAD, setTable, sub, tableBox, W} from './geom.js';
export function setPractice(i){
  const g = stats.shoot ? stats.shoot.g : 0;
  settings.practice = i != null && i < g ? i : null; saveSettings();
  renderModeChip(); renderProgress(); dealFresh();
}
// a new grade gets a new shot: not the one waiting from before, and not the one just played
export function dealFresh(){
  if(stats.active && stats.active.pending){ delete stats.active.pending; save(); }
  if(!(cueStroke && cueStroke.s === S.shot)) deal();
}
// The pill at the foot of the table: what the mode you're in is set to, and the way back into its setup. Flash, Practice and
// Run-outs each have a setup sheet; practising a passed grade goes back to the ladder to pick a grade. The Ladder itself has none.
function modeChip(){   // {text, act, label} or null
  if(settings.task === 'flash'){ const t = `${(+settings.flash || 1500)/1000} s`, tb = `${flashTableNow()} ft`; return {text: `Flash · ${t} · ${tb}`, act: '', label: `Flash setup: each shot shows for ${t}, ${tb} table. Open it to change the setup.`}; }
  if(isDrill()){
    const d = drillPicks(), what = d.weak ? 'Your weakest' : d.fr.length === DRILL_FR.length ? 'Every fraction' : d.fr.map(f=>f === 'full' ? 'Full' : ALL.find(r=>r.id === f).label).join(' ');
    return {text: `Practice · ${what}`, act: '', label: `Practice setup: ${d.weak ? 'your weakest shots' : what}, not scored. Open it to change what comes up.`};
  }
  if(isRun()) return {text: `Run-outs · ${runSummary()}`, act: '', label: `Run-outs setup: ${runSummary()}, not scored. Open it to change the setup.`};
  if(practicing()) return {text: 'Practising · not scored', act: '', label: `Practising a passed grade (${SHOOT_GRADES[+settings.practice]}), not scored. Open grades to change or stop`};
  return null;
}
export function renderModeChip(){
  const el = $('modechip'); if(!el) return;
  const m = tut.on || runPicking() ? null : modeChip();   // (while you call a run shot the pill makes way for the bottom-left pocket)
  el.hidden = !m; if(!m) return;
  el.innerHTML = m.act ? `${m.text} <b>${m.act}</b>` : m.text; el.setAttribute('aria-label', m.label);
}
function modeChipTap(){ if(settings.task === 'flash') openSheet('flashsheet', true); else if(isDrill()) openSheet('drill', true); else if(isRun()) openSheet('runsheet', true); else if(practicing()) openProg(true); }

// ---------- flash ----------
let flashTimer = null;
function startFlash(){
  clearTimeout(flashTimer);
  const cov = $('cover'), bar = $('flashbar');
  cov.hidden = true; bar.hidden = true;
  if(settings.task!=='flash') return;
  const ms = +settings.flash || 1500;
  bar.style.setProperty('--dur', ms+'ms');
  bar.style.animation = 'none'; bar.hidden = false; void bar.offsetWidth; bar.style.animation = '';
  flashTimer = setTimeout(()=>{ bar.hidden = true; if(!S.answered){ syncReplay(); cov.hidden = false; } }, ms);
  if(flashDown() && S.shot && !S.answered){ S.shot.rig = {phase: 'down', k: 1, T: 1, downAt: performance.now()}; S.shot.follow = 0; featherLoop(S.shot); }   // down on it: cue and hand, practice strokes till you call
}
export function endFlash(){ clearTimeout(flashTimer); $('cover').hidden = true; $('flashbar').hidden = true; }

// ---------- round ----------
// The result card. Before the call it shows the rows this shot will report: what you've already set (stroke, spin) and a
// dash for the rest, so on the call the values land where the dashes were and nothing below moves.
// rows: {k: label, v: value (null: pending), good: true | false | 'also' | undefined (not judged), right: the right value when yours differs, note: words beside it instead, wide: across both columns on a phone}
// cap: a line between the verdict and the rows (the right shot, when the right column is one)
export const RICON = {
  ok: '<svg class="ricon" viewBox="0 0 12 12" role="img" aria-label="right"><path d="M2 6.4 4.8 9.2 10 3.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  no: '<svg class="ricon" viewBox="0 0 12 12" role="img" aria-label="wrong"><path d="M3 3l6 6M9 3 3 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  also: '<svg class="ricon" viewBox="0 0 12 12" role="img" aria-label="drops, not ideal"><circle cx="6" cy="6" r="3.6" fill="none" stroke="currentColor" stroke-width="2"/></svg>'};
export const rcls = g => g === 'also' ? 'also' : g === true ? 'ok' : g === false ? 'no' : '';
export function rcardHTML(head, cls, rows, aside, cap){
  const pend = head == null;
  const val = r => r.v == null ? '<span class="rdash" aria-label="pending"></span>'
    : `<span class="rv ${pend ? '' : rcls(r.good)}">${pend ? '' : RICON[rcls(r.good)] || ''}${r.v}</span>${!pend && r.right ? `<span class="rr"><span aria-hidden="true">→</span><small>right</small><span class="rrv">${r.right}</span></span>` : ''}${!pend && r.note ? `<span class="rr rnote">${r.note}</span>` : ''}`;
  return `<div class="rcard${pend ? ' pend' : ''}"><div class="rhead"><b class="rverd ${pend ? '' : cls}">${pend ? 'Call the hit' : (RICON[cls] || '') + head}</b><span class="raside">${aside || ''}</span></div>${cap ? `<div class="rcap">${cap}</div>` : ''}`
    + `<div class="rrows">${rows.map(r=>`<div class="rrow${r.wide ? ' wide' : ''}"><span class="rk">${r.k}</span><span class="rval">${val(r)}</span></div>`).join('')}</div></div>`;
}
export const fracName = r => r.id === 'full' ? 'Full' : r.label;
export const strokeName = n => COARSE_LBL[nearestCoarse(n)];
// a called shot's rows: the call, your stroke once speed is yours, your spin once there's a zone and spin is yours, and the ball
export function shootRows(s){
  const c = ctrl(), rows = [{k: 'Call', v: null}];
  if(c.speed) rows.push({k: 'Stroke', v: strokeName(speedLevel())});
  if((s.zone || isRun()) && (c.up || c.side)) rows.push({k: 'Spin', v: tipName(snapTip(shotStroke(s).tip || [0, 0])), wide: true});   // a run shot shows your spin too (shape is yours: it isn't judged)
  rows.push({k: 'Ball', v: null, wide: true});
  return rows;
}
// a read shot's rows (the Ladder's reading shots and Flash): the call, the cut, and what the ball did
const readRows = () => [{k: 'Call', v: null}, {k: 'Cut', v: null}, {k: 'Ball', v: null, wide: true}];
export function pendCard(){   // the card before the call
  if(!S.shot || S.answered || tut.on) return;
  if(S.shot.calling && isRun() && S.RUN) return void ($('quick').innerHTML = runPickCard());   // Run-outs: the ball and pocket first
  $('quick').innerHTML = isShooting() ? rcardHTML(null, '', shootRows(S.shot)) : rcardHTML(null, '', readRows());
}

function packShot(s){
  const o = {...s, P: POCKETS.indexOf(s.P), answer: s.answer.id, tb: curTable, seenAt: Date.now()};
  delete o.pick; delete o.anim; delete o.final; delete o.t0; delete o.rig;
  return o;
}
function unpackShot(o){
  if(curTable !== o.tb) setTable(o.tb, settings.pockets);
  const s = {...o, P: POCKETS[o.P], answer: ALL.find(r=>r.id===o.answer), pick: null};
  delete s.tb; delete s.seenAt;
  return s;
}
// The next shot is worked out ahead, once the current one has played out, so Next is instant.
export let nextShot0 = null;
export const prepKey = () => [settings.task, isShooting() ? shootLevel() : 0, progTable(), settings.tablePick, settings.flashTable, settings.table, curTable, settings.practice ?? '', isDrill() ? JSON.stringify(drillPicks()) : '', W, H].join('|');
export function prepareNext(){
  if(tut.on || !isShooting() || isRun()) return;   // a run's next shot is the rack as the balls lie: nothing to work out ahead
  const t0 = performance.now(), key = prepKey(), keep = S.shot;
  try{ nextShot0 = {key, s: addExtras(shootDeal())}; } catch(e){ nextShot0 = null; }
  S.shot = keep; PERF.prepMs = performance.now() - t0;
}
export function deal(){ const t0 = performance.now(); try{ return dealInner(); } finally { PERF.dealMs = performance.now() - t0; } }
function dealInner(){
  if(callLock){ if(!$('stancecover').hidden || tour.on) return; lockCalls(false); }   // a new player: nothing dealt until the stance card and the tour are done
  if(cueStroke && cueStroke.s === S.shot) return;   // mid-stroke: the shot goes first
  if(S.anim){ cancelAnimationFrame(S.anim.raf); S.anim = null; }
  // a new element is explained the first time you reach the grade that brings it in
  if(!tut.on && GEN.g == null && location.hash !== '#test' && $('stancecover').hidden && settings.task === 'shoot'){   // (never while the library tools run: a lesson left open made every stored shot a short one)
    const g = stepOf(ensureShootLevel().g);   // lessons are at a step
    const k = Object.keys(LESSONS).find(k=>LESSONS[k].at <= g && !(settings.tutSeen || {})[k]);
    if(k) return startTut(k);
  }
  S.walk = null; S.walkDrag = null; document.body.classList.remove('dragging');
  showSessIdle();   // the mode's run starts with its first shot
  renderModeChip();
  syncRefs();
  // A session keeps its unanswered shot: reloading, or changing a setting, brings back the same shot instead of a new one.
  const act = stats.active && stats.active.task===settings.task ? stats.active : null;
  const kept = act && act.pending ? unpackShot(act.pending) : null;
  if(kept){ S.shot = kept; settings.table = curTable; S.shot.t0 = performance.now() - Math.max(0, Date.now() - act.pending.seenAt); }
  else {
    settings.table = progTable();
    if(curTable !== settings.table) setTable(settings.table, settings.pockets);
    const pre = nextShot0 && nextShot0.key === prepKey() ? nextShot0.s : null; nextShot0 = null;   // dealt ahead, while the last shot played
    S.shot = pre || (isRun() ? runDeal() : isShooting() ? addExtras(shootDeal()) : dealShot()); S.shot.t0 = performance.now();
    if(act){ act.pending = packShot(S.shot); save(); }
  }
  S.answered = false;
  draw(false);
  if(shootRoutine() && !S.shot.calling) startRoutine(); else { cancelAnimationFrame(routineRaf); renderRoutineChip(); }
  renderRun();
  document.querySelectorAll('#answers button').forEach(b=>{b.disabled=false;b.className='';});
  if(tut.on) $('quick').innerHTML = ''; else pendCard();
  $('showright').hidden = true;
  tableBox.classList.remove('tappable');
  updateControls();
  if(settings.task==='flash' && stats.active && stats.active.task==='flash'){   // the flash timer only runs inside a session
    if(!S.flashArmed) showStart();   // first, the start screen: standing or down on the shot, then Start
    else if(kept){   // you've already seen this one: it plays again (a replay)
      if(replaysLeft() > 0){ stats.active.replays = (stats.active.replays||0) + 1; S.shot.replays = (S.shot.replays||0) + 1; save(); startFlash(); }
      else { endFlash(); $('cover').hidden = false; syncReplay(); }
    } else startFlash();
  } else endFlash();
  showSessIdle();
}
// No sessions: you just play. Each mode runs as one open-ended run behind the scenes (it keeps the shot you're on, the streak and the Flash timer).
export const RUN_SIZE = 1e9;
export function showSessIdle(){
  const t = settings.task;
  if(!tut.on && sessTask(t) && !(stats.active && stats.active.task===t)){
    stats.active = {id: Date.now().toString(36), task: t, size: RUN_SIZE, n:0, right:0, made:0, start: Date.now()};
    save();
  }
}
function showStart(){   // Flash, ready: the table covered and one Start (a tap anywhere on it starts too); the picks are in the sheet, behind the pill
  endFlash();
  $('startcover').hidden = false; renderModeChip();
  document.querySelectorAll('#answers button').forEach(b=>b.disabled=true);
}
export function startFlashMode(){
  S.flashArmed = true;
  $('startcover').hidden = true;
  document.querySelectorAll('#answers button').forEach(b=>b.disabled=false);
  startFlash();
  if(S.shot) draw(S.answered);   // the shot under the card was drawn from the view picked last time: redraw it from the one just picked
}
export function updateControls(){
  const nb = $('next');
  renderShootControls();
  $('answers').hidden = false;
  nb.innerHTML = `${isRun() && S.RUN && S.RUN.over ? 'Next rack' : 'Next shot'} <kbd class="key" aria-hidden="true">Enter</kbd>`; nb.disabled = !S.answered;
  if(S.shot && S.shot.calling && !S.answered) document.querySelectorAll('#answers button').forEach(b=>b.disabled = true);   // Run-outs: the fraction comes once the shot is called
}
// Kept for the shot log and settings checks: the aids are always off now (no ladder grade brings them back), no shot is ever
// 'practice' by aid, and a baseline run only exists in old saves.
export function aidMode(key){ return 'off'; }
function practiceAid(){ return false; }
export function baseRun(){ return !!(stats.active && stats.active.base && stats.active.task === settings.task); }
export function logEntry(extra){   // ts: the minute it was played (minutes since 1970), so the Stats view can group sittings
  const act = stats.active && stats.active.task===settings.task ? stats.active.id : undefined;
  stats.log.push({sid:act, t:settings.task, a:S.shot.answer.id, s:S.shot.side, v:settings.view,
    c: settings.view==='top' ? '-' : stanceAim() ? 'aim' : 'line',
    md:S.shot.any ? 'any' : 'ref', th:settings.throw, ln:S.shot.len, ts: Math.round(Date.now()/60000), rp:S.shot.replays||0, wk: S.shot.walked ? 1 : 0, dc:Math.round(len(sub(S.shot.ob,S.shot.cb))), dp:Math.round(S.shot.L), ag:+S.shot.theta.toFixed(1), pt:S.shot.P.side?'s':'c', gh: practiceAid() ? 1 : 0, fa: ['ghost','line','stance'].filter(k=>['on','fade'].includes(aidMode(k))).join('') || undefined, tb:settings.table, pk:settings.pockets, ...extra});
  trimLog();
  laterSave();
}
export function finishRound(){
  tableBox.classList.add('tappable');
  updateControls();
  $('next').focus({preventScroll:true});
}

// ---------- the mode's open-ended run: shots and right calls ----------
export function sessionTick(ok, made){
  const a = stats.active; if(!a || a.task !== settings.task) return;
  a.n++; if(ok) a.right++; if(made) a.made++;
  save();
}
export let callLock = false;   // a brand-new player: no shot and no calls until the first lesson (or skipping the tour) deals one
export function lockCalls(v){
  callLock = v; $('answers').classList.toggle('locked', v);
  document.querySelectorAll('#answers button').forEach(b=>{ b.disabled = v; });
}
const canCall = () => !callLock && !S.answered && S.shot && !S.shot.calling && !S.anim;
export function pickFrac(id){
  if(tut.on && !tstep().ask) return;   // a lesson step with nothing to call: a call does nothing
  if(!canCall()) return;
  if(tut.on) return tutAnswer(id);   // in a lesson a call is the lesson's, not a scored shot
  const c = S.shot.cam;
  if(shootRoutine() && c && c.T){ callAim(id); return; }   // from Down on the shot: no shooting standing, a call gets you down first
  if(isShooting()) return takeShot(id);   // the call is the aim: the shot goes off with the stroke you've set
  return answer(id);
}
function answer(id){
  if(tut.on) return tutAnswer(id);
  if(!canCall()) return;
  const s0 = S.shot, rig0 = rigAlpha(s0);   // Flash, down on it: where the practice stroke is, read before anything changes
  S.answered = true;
  endFlash();
  const picked = ALL.find(r=>r.id===id);
  const ok = id === S.shot.answer.id;
  const contact = ok ? S.shot.theta : picked.deg;   // the right call plays the hit the shot needs, so it drops (call the nearest fraction)
  const oc = outcome(S.shot, contact);
  const tip = ok && !oc.made && S.shot.any;       // right bucket, but the pure reference needs adjusting
  const counted = oc.made || ok;                             // a right call never counts against your pocket rate
  S.shot.pick = {...oc, id, far: Math.abs(contact - S.shot.theta) > 0.3 && (!ok || tip)};
  const prevStreak = curStreak();
  const newStreak = ok ? prevStreak + 1 : 0;
  // sound first: nothing else runs before it
  S.shot.duck = 1;
  if(ok && newStreak >= STREAK_HOT){ playSound('streak', newStreak); S.shot.duck = .25; }   // on a streak the table sounds play quietly under the chime
  else if(!ok && prevStreak >= STREAK_HOT){ playSound('streakEnd'); S.shot.duck = 0; }
  if(settings.animate === '0') tableSounds(shotPlan(S.shot, ok ? outcome(S.shot, S.shot.theta) : oc, .12, .3, 0, false, false), S.shot.duck);
  logEntry({p:id, m:counted?1:0});
  if(stats.active && stats.active.pending) delete stats.active.pending;
  document.querySelectorAll('#answers button').forEach(b=>{ b.disabled = true; });
  const reveal = (animMs)=>{
    if(stats.active && stats.active.task===settings.task) stats.active.pause = (stats.active.pause||0) + (animMs||0);
    if(jumpingAhead){ sessionTick(ok, counted); return; }   // going straight to the next shot: just count it, draw nothing
    draw(true);
    $('quick').innerHTML = cardHTML('<span class="touch-only">Tap the table for the next shot</span>');
    finishRound();
    sessionTick(ok, counted);
  };

  const f = 1 - Math.sin(S.shot.theta*RAD);
  const over = contact > S.shot.theta;
  const rightCall = fracName(S.shot.answer);
  const rows = readRows().map(r=>
      r.k === 'Call' ? {...r, v: fracName(picked), good: ok ? true : oc.made ? 'also' : false, right: ok ? '' : rightCall}
    : r.k === 'Cut' ? {...r, v: `${S.shot.theta.toFixed(1)}° · ${f.toFixed(2)} ball`}
    : {...r, v: ok ? 'Pocketed' : counted ? `Also drops, a bit ${over?'thin':'full'}` : oc.short ? `Right line, but it dies short` : `${over?'Too thin':'Too full'}, by ${Math.abs(oc.lat).toFixed(1)}″`, good: ok ? true : counted ? 'also' : false});
  const cardHTML = aside => rcardHTML(counted ? 'Pocketed' : 'Missed', ok ? 'ok' : counted ? 'also' : 'no', rows, aside);   // a wrong call that drops: blue, like its rows   // the same rows the card showed before the call
  $('quick').innerHTML = cardHTML('');
  document.querySelectorAll('#answers button').forEach(b=>{
    if(b.dataset.id===S.shot.answer.id) b.className='right';
    else if(b.dataset.id===id) b.className = oc.made ? 'also' : 'wrong';   // blue: it still drops, just not the ideal call
    else b.className='';
  });
  showStreak(newStreak, !ok && prevStreak >= STREAK_HOT ? prevStreak : 0);
  if(ok && newStreak >= STREAK_HOT) cheer(newStreak, prevStreak < STREAK_HOT);
  if(settings.animate !== '0'){
    const play = ()=>animateShot(oc, ms=>{ standUp(s0); reveal(ms); }, ok ? '#ffd34d' : MISS);
    if(rig0.a > .01){   // Flash, down on it: the cue comes through on the line it's played on (your call's), then the balls roll
      s0.aimDir = oc.v2;
      const run = outcome(s0, contact, true), hitT = (obHit(run.sim.events) || {}).t ?? 0;
      const obT = run.sim.events.find(e=>e.ids && e.ids[0]==='o' && e.t > hitT && (e.type==='cushion' || e.type==='jaw' || e.type==='pocket'));
      const upAt = Math.min(obT ? obT.t*1000 + 120 : Infinity, rigHitMs(s0, run, oc.v2));   // the hand comes off as on the ladder
      strokeThen(s0, rig0.push || 0, ()=>{ if(isFinite(upAt)) setTimeout(()=>{ if(S.shot === s0) standUp(s0); }, upAt); play(); });
    } else { s0.follow = 0; play(); }
    updateControls();   // Next shot works straight away
  }
  else reveal(0);
}
// Flash replays: as many as you like (each is still counted on the shot, so the stats can show it)
function replaysLeft(){ const a = stats.active; return a && a.task === 'flash' ? Infinity : 0; }
function syncReplay(){ $('replay').hidden = replaysLeft() <= 0; $('replaytext').textContent = 'Replay'; $('replay').setAttribute('aria-label', 'Replay the shot'); }
export function replay(){
  if(!S.shot || S.answered || settings.task!=='flash' || replaysLeft() <= 0) return;
  S.shot.replays = (S.shot.replays||0)+1; stats.active.replays = (stats.active.replays||0) + 1; save();
  syncReplay(); startFlash();
}
// ---------- mode setup: one sheet for Flash, Practice and Run-outs ----------
// Opened from the mode's button and from the pill at the foot of the table. Every pick is saved as it's made; what changed
// is applied when the sheet closes (a shot you've already played keeps its result, and the next one follows the new picks).
const SHEETS = {};   // id -> {render, snap, changed, open, back}
let sheetFrom = null, sheetWas = '';
const sheetOpen = () => Object.keys(SHEETS).find(id=>!$(id).hidden) || null;
export function openSheet(id, v){
  const el = $(id), d = SHEETS[id];
  if(v){
    if(!el.hidden) return;
    const other = sheetOpen(); if(other) openSheet(other, false);
    sheetFrom = document.activeElement; sheetWas = d.snap ? d.snap() : '';
    if(d.open) d.open();
    if(d.render) d.render(); el.hidden = false; el.querySelector('.menuclose').focus({preventScroll: true});
    return;
  }
  if(el.hidden) return;
  el.hidden = true; hideLockTip();
  try{ (sheetFrom && sheetFrom.isConnected && sheetFrom !== document.body ? sheetFrom : d.back()).focus({preventScroll: true}); }catch(e){}
  sheetFrom = null;
  if(d.changed) d.changed(!d.snap || d.snap() !== sheetWas);
}
function wireSheet(id, d){
  SHEETS[id] = d;
  $(id).addEventListener('click', e=>{ if(e.target === $(id)) openSheet(id, false); });
  $(id).querySelectorAll('.menuclose, .modedone').forEach(b=>b.addEventListener('click', ()=>openSheet(id, false)));
}
export function wireSheets(){
  window.addEventListener('keydown', e=>{   // while a sheet is up, keys stay in it: Esc closes, Tab goes round it
    const id = sheetOpen(); if(!id) return;
    e.stopPropagation();
    if(e.key === 'Escape'){ e.preventDefault(); openSheet(id, false); return; }
    if(e.key === 'Tab'){
      const f = [...$(id).querySelectorAll('button')].filter(b=>!b.disabled && b.getClientRects().length), i = f.indexOf(document.activeElement);
      if(f.length){ e.preventDefault(); f[(i + (e.shiftKey ? f.length - 1 : 1) + f.length) % f.length].focus(); }
    }
  }, true);
  wireSheet('drill', {render: renderDrill, snap: ()=>JSON.stringify(drillPicks()), back: ()=>$('task-practice'),
    changed: ch=>{ if(ch && isDrill()){ nextShot0 = null; if(shotIdle()) deal(); } }});   // a new shot to the new picks
  $('drillweak').addEventListener('click', ()=>setDrill('weak'));
  $('drill-fr').addEventListener('click', e=>{ const b = e.target.closest('[data-fr]'); if(b) setDrill('fr', b.dataset.fr); });
  document.querySelectorAll('#drill [data-drill]').forEach(g=>g.addEventListener('click', e=>{ const b = e.target.closest('button[data-v]'); if(b && !b.classList.contains('locked')) setDrill(g.dataset.drill, b.dataset.v); }));
  // Flash: its picks are settings (data-set buttons), applied as they're tapped; opening the sheet mid-shot stops the clock,
  // and closing it leaves the table covered with one Start, ready to go
  wireSheet('flashsheet', {render: syncPressed, back: ()=>$('task-flash'),
    open: ()=>{ if(settings.task === 'flash' && stats.active && stats.active.task === 'flash' && !S.answered){ S.flashArmed = false; showStart(); } },
    changed: ()=>{ if(settings.task === 'flash' && !$('startcover').hidden) showStart(); renderModeChip(); }});
  wireSheet('runsheet', {render: renderRunSheet, snap: ()=>JSON.stringify(runPicks()), back: ()=>$('task-run'),
    changed: ch=>{ if(ch && isRun()){ S.RUN = null; if(shotIdle()) deal(); } }});   // a new rack to the new picks
  document.querySelectorAll('#runsheet [data-run]').forEach(g=>g.addEventListener('click', e=>{ const b = e.target.closest('button[data-v]'); if(b && !b.classList.contains('locked')) setRun(g.dataset.run, b.dataset.v); }));
  $('modechip').addEventListener('click', e=>{ e.stopPropagation(); modeChipTap(); });
  renderModeChip();
  $('runpick').addEventListener('click', e=>{
    e.stopPropagation();
    let b = e.target.closest('[role="button"]'); if(!b) return;
    if(e.detail && (e.clientX || e.clientY)){ let best = null, bd = 26; for(const x of $('runpick').querySelectorAll('[role="button"]')){ const h = x.querySelector('.hit') || x, r = h.getBoundingClientRect(), d = Math.hypot(e.clientX - (r.left + r.width/2), e.clientY - (r.top + r.height/2)); if(d < bd){ bd = d; best = x; } } if(best) b = best; }
    runPickTap(b);
  });
  ['pointerdown', 'pointerup'].forEach(t=>$('runpick').addEventListener(t, e=>e.stopPropagation()));   // not a look around the table
  $('runpick').addEventListener('keydown', e=>{
    const f = [...$('runpick').querySelectorAll('[role="button"]')], i = f.indexOf(document.activeElement); if(!f.length) return;
    if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); e.stopPropagation(); if(i >= 0) runPickTap(f[i]); return; }
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0; if(!d) return;
    e.preventDefault(); e.stopPropagation(); f[(i + d + f.length) % f.length].focus();
  });
  $('quick').addEventListener('click', e=>{ const b = e.target.closest('button'); if(!b || !runPicking()) return; e.stopPropagation();
    if(b.id === 'runplandone') runPlanDone(); else if(b.id === 'runback') runChangeBack(); else if(b.id === 'runend') runQuit(); else if(b.id === 'runundo') runUndoPlan(); });
  $('runrow').addEventListener('click', e=>{ if(e.target.closest('#runchange')){ e.stopPropagation(); runChange(); } });   // mid-rack: the picker again, for this shot
}
export const shotIdle = () => !S.answered && !S.anim && !(cueStroke && cueStroke.s === S.shot);   // a shot waiting to be called: a change deals it again
// Practice
function setDrill(k, v){
  const d = drillPicks();
  if(k === 'fr'){ const on = d.fr.includes(v); if(on && d.fr.length === 1) return renderDrill(true); d.fr = on ? d.fr.filter(f=>f !== v) : DRILL_FR.filter(f=>f === v || d.fr.includes(f)); }
  else if(k === 'weak') d.weak = d.weak ? 0 : 1;
  else d[k] = v;
  settings.drill = d; saveSettings(); renderDrill(); renderModeChip();
}
function renderDrill(last){
  const d = drillPicks(), c = ctrlAt(drillLevel());
  $('drillweak').setAttribute('aria-checked', d.weak ? 'true' : 'false');
  $('drill-fr-box').disabled = !!d.weak; $('drill-dist-box').disabled = !!d.weak;
  $('drill-fr-hint').textContent = d.weak ? 'set by your weak spots' : last ? 'keep at least one' : 'pick one or more';
  document.querySelectorAll('#drill-fr [data-fr]').forEach(b=>b.setAttribute('aria-pressed', !d.weak && d.fr.includes(b.dataset.fr)));
  document.querySelectorAll('#drill [data-drill]').forEach(g=>{
    const k = g.dataset.drill;
    g.querySelectorAll('button').forEach(b=>{
      const v = b.dataset.v, lk = k === 'tb' ? !tableUnlocked(v) : k === 'stroke' ? v === 'mine' && !c.speed : k === 'spin' ? v === 'mine' && !(c.up || c.side) : false;
      const at = k === 'tb' ? TABLE_AT[v] : k === 'stroke' ? SH.speed : SH.follow;
      lockBtn(b, lk, `Opens at ${stepGrade(at)}`); const L = b.querySelector('.lock'); if(L) L.hidden = !lk;
      b.setAttribute('aria-pressed', !(k === 'dist' && d.weak) && String(d[k]) === v);
    });
  });
  $('drill-spin-hint').textContent = c.side ? 'yours: follow, draw and english' : c.down ? 'yours: follow and draw' : c.up ? 'yours: follow' : '';
}
export const openDrill = v => openSheet('drill', v);
// Run-outs
export function setRun(k, v){ const d = runPicks(); d[k] = v; settings.run = d; saveSettings(); renderRunSheet(); renderModeChip(); }
function renderRunSheet(){
  const d = runPicks(), rot = d.order === 'rot';
  document.querySelectorAll('#runsheet [data-run]').forEach(g=>{
    const k = g.dataset.run;
    g.querySelectorAll('button').forEach(b=>{
      const v = b.dataset.v, lk = k === 'tb' && !tableUnlocked(v);
      if(k === 'tb'){ lockBtn(b, lk, `Opens at ${stepGrade(TABLE_AT[v])}`); const L = b.querySelector('.lock'); if(L) L.hidden = !lk; }
      b.setAttribute('aria-pressed', String(d[k]) === v);
    });
  });
  $('run-pat-hint').textContent = d.pat === 'plan' ? (rot ? 'pick a pocket for each ball, lowest first, before the first shot' : 'pick each ball and its pocket, in order, before the first shot') : 'the easiest ball and pocket are picked for you each shot';
}
// Run-outs, the call: taps on the targets over the table (where two overlap, the one whose centre is nearest), the arrows round them
function runPickTap(b){ if(!b) return; if(b.dataset.ball) runTapBall(+b.dataset.ball); else if(b.dataset.pocket) runTapPocket(+b.dataset.pocket); }
