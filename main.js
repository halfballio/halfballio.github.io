// Entry point: loads the player, then wires everything up in the order the game always ran it.
import {$, add, ALL, BOUNDS, boundsFor, CORE, curTable, dot, H, initTable, kt, len, MISS, mul, norm, OB_COLORS, PE, pick, POCKETS, R, RAD, REFS, rot, setBounds, setRefs, setTable, sub, tableBox, TIP_STEP, touchMode, W, wireInputMode} from './geom.js';
import {CONTACT, notesTop, SOURCE, VERSION, WHATS_NEW} from './whatsnew.js';
import {GRADE_STEP, gradeOf, SH, stepOf} from './steps.js';
import {afterPick, askPersist, bk, bkFocus, bkRender, bkShots, curStreak, initNotesSeen, laterSave, lean, loadPicked, loadProfiles, loadSettings, loadStats, look, openBackup, pct, PL, PL_MAX, playAs, plEsc, plGrade, plKey, S, save, savePL, saveSettings, sessTask, settings, SHOOT_GRADES, SHOOT_V, stats, statsGrade, statTask, STREAK_HOT, success, TEST, tour, trimLog, tut, wireBackup} from './state.js';
import {DEV, fpsStart, PERF, wireDevTools} from './perf.js';
import {cheer, cheerFx, cheerGo, cheerQ, confetti, cutSounds, playSound, shotPlan, showStreak, tableSounds, uiSound, wireAudio, wireButtonSounds} from './audio.js';
import {addLookUnlocks, baselines, CARBON_AT, carbonUnlocked, ctrl, ctrlAt, DRILL_FR, drillLevel, drillPicks, enforceLocks, ensureShootLevel, FAST_FLASH_GRADE, fastFlashLocked, FLASH_AT, flashTableNow, flashUnlocked, FOCUS_AT, GEN, gradeFor, GRADES, gradeTable, hasBaseline, isDrill, isRun, isShooting, LADDER_PICK_AT, ladderBest, ladderPickOpen, ladderTable, NO_TIMER, PRACTICE_AT, practiceUnlocked, practicing, progTable, PTS_UP, RUN_AT, runUnlocked, shaftSq, SHOOT_TEXT, shootLevel, shootRoutine, stanceAim, stepGrade, TABLE_AT, tableUnlocked, unlIcon, unlocksBetween} from './grades.js';
import {addExtras, dealShot, decodeRec, drillDeal, encodeRec, fetchShipped, fromLibrary, generate, handRoom, isZoneStep, LIB_STEPS, libIdle, libVer, makeRec, nearestRef, newRack, NO_EIGHTH, obRunMax, obRunOk, parseShipped, reachMax, reachOf, REC, recOk, renderRun, runAfterShot, runAllowed, runCallCheck, runChange, runChangeBack, runDeal, runFoul, runPick, runPickCard, runPicking, runPicks, runPlanDone, runQuit, runShot, runStage, runSummary, runTapBall, runTapPocket, runTarget, runUndoPlan, scaleRec, setShipped, SHIPPED, shippedOk, shootDeal, shotOf, STOP_R, tableFor, throwStroke, ZONE_STEPS, zoneSpotOk} from './deal.js';
import {aimDirFor, aimFor, ballVerdict, bridgeAim, bridgeGeom, callAim, COARSE, COARSE_LBL, cueStroke, cutForDir, dirForCut, downMs, ease, lvupOpen, markAim, MPH, nearestCoarse, nudgeTip, obHit, outcome, overviewCam, playAim, renderBadge, renderRoutineChip, renderShootControls, rigHitMs, rightIdFor, rightStroke, routineRaf, setLook, setSpeedLevel, shootCam, shotStroke, snapTip, speedLevel, standUpOff, startRoutine, strikeOf, STROKE_MPH, strokeThen, takeShot, tipName, wireLevelUp, wireShootControls} from './shot.js';
import {applyGfx, applyStyle, BALL_SETS, bestLook, cueRig, draw, featherLoop, featherRaf, featherStart, flashDown, FOLLOW_THROUGH, GLOVE_DEF, HAND_DEF, HOLO, initTable3d, isHex, keyBallSets, LOOK_AT, lookOpen, NEAR, pivot, pivotToggle, rigAlpha, setVH, sizeTable, ST, standUp, STYLES, VH, VW, walkEndedAt, walkOn, wireArrowWake, wireResize, wireResizeDraw, wireStance, wireWalk} from './view.js';

initTable();
wireInputMode();
loadProfiles();

let plWired = false;
// the game starts at the top: no reload after a pick, so the title screen's scroll (and the phone keyboard the name field
// brought up) would carry over and open the game scrolled far down. Again once the keyboard has gone and the page has settled.
function toTop(){
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
function showPlayers(){
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
loadPicked();
if(!S.ME){ S.ME = await new Promise(go=>{ S.plPick = go; showPlayers(); }); $('playercover').hidden = true; toTop(); }   // nobody picked yet: the game waits behind the picker, then starts
afterPick();
loadSettings();
initNotesSeen();
loadStats();
wireDevTools();
function setGradeForTesting(i){
  settings.practice = null; saveSettings(); setTimeout(renderModeChip, 0);
  if(settings.tutSeen){ if(isShooting()) for(const k in LESSONS) if(LESSONS[k].at > stepOf(i)) delete settings.tutSeen[k]; saveSettings(); }   // lessons above the picked grade play again when you reach them
  stats.shoot = {g: i, best: i, pts: 0, v: SHOOT_V}; settings.flashTable = gradeTable(stepOf(i)); if(stepOf(i) < LADDER_PICK_AT) settings.tablePick = null; saveSettings(); save(); showSessIdle(); renderBadge(true); renderProgress(); dealFresh();
}
function renderProgress(){
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
function setPractice(i){
  const g = stats.shoot ? stats.shoot.g : 0;
  settings.practice = i != null && i < g ? i : null; saveSettings();
  renderModeChip(); renderProgress(); dealFresh();
}
// a new grade gets a new shot: not the one waiting from before, and not the one just played
function dealFresh(){
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
fetchShipped();
wireLevelUp();
keyBallSets();
addLookUnlocks();
wireArrowWake();
initTable3d();

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
function endFlash(){ clearTimeout(flashTimer); $('cover').hidden = true; $('flashbar').hidden = true; }

// ---------- round ----------
// The result card. Before the call it shows the rows this shot will report: what you've already set (stroke, spin) and a
// dash for the rest, so on the call the values land where the dashes were and nothing below moves.
// rows: {k: label, v: value (null: pending), good: true | false | 'also' | undefined (not judged), right: the right value when yours differs, note: words beside it instead, wide: across both columns on a phone}
// cap: a line between the verdict and the rows (the right shot, when the right column is one)
const RICON = {
  ok: '<svg class="ricon" viewBox="0 0 12 12" role="img" aria-label="right"><path d="M2 6.4 4.8 9.2 10 3.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  no: '<svg class="ricon" viewBox="0 0 12 12" role="img" aria-label="wrong"><path d="M3 3l6 6M9 3 3 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  also: '<svg class="ricon" viewBox="0 0 12 12" role="img" aria-label="drops, not ideal"><circle cx="6" cy="6" r="3.6" fill="none" stroke="currentColor" stroke-width="2"/></svg>'};
const rcls = g => g === 'also' ? 'also' : g === true ? 'ok' : g === false ? 'no' : '';
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
let nextShot0 = null;
const prepKey = () => [settings.task, isShooting() ? shootLevel() : 0, progTable(), settings.tablePick, settings.flashTable, settings.table, curTable, settings.practice ?? '', isDrill() ? JSON.stringify(drillPicks()) : '', W, H].join('|');
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
const RUN_SIZE = 1e9;
function showSessIdle(){
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
function startFlashMode(){
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
function aidMode(key){ return 'off'; }
function practiceAid(){ return false; }
function baseRun(){ return !!(stats.active && stats.active.base && stats.active.task === settings.task); }
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
wireAudio();
wireButtonSounds();

// ---------- the mode's open-ended run: shots and right calls ----------
export function sessionTick(ok, made){
  const a = stats.active; if(!a || a.task !== settings.task) return;
  a.n++; if(ok) a.right++; if(made) a.made++;
  save();
}
function alignLogo(){   // the logo's centre on the same vertical line as the radio's disc (and the eye under it on a phone), wherever the table sits
  const lg = $('hlogo'), d = document.querySelector('#radio .radiodisc'); if(!lg || !d || !d.getClientRects().length) return;
  const l = lg.getBoundingClientRect(), r = d.getBoundingClientRect(), now = parseFloat(getComputedStyle(lg).marginLeft) || 0;
  const x = Math.max(0, Math.min(96, Math.round(now + (r.left + r.width/2) - (l.left + l.width/2))));
  if(x !== now) lg.style.marginLeft = x + 'px';
}
function syncStreakPill(){ if(!$('hlogo')) return; const c = curStreak(); showStreak(c >= STREAK_HOT ? c : 0, 0); }
let callLock = false;   // a brand-new player: no shot and no calls until the first lesson (or skipping the tour) deals one
function lockCalls(v){
  callLock = v; $('answers').classList.toggle('locked', v);
  document.querySelectorAll('#answers button').forEach(b=>{ b.disabled = v; });
}
const canCall = () => !callLock && !S.answered && S.shot && !S.shot.calling && !S.anim;
function pickFrac(id){
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

// ---------- shot animation: your call, played out. No spin or physics, just clean motion. ----------
function railVol(vn){ return Math.max(.2, Math.min(1, vn/40)); }
// After a miss: play the shot again the right way (the right call, with the stroke and spin that land it), from where the
// balls started. Only a picture: nothing is scored.
function showRightShot(){
  const s = S.shot; if(!s || !S.answered || S.anim || cueStroke || s.replay) return;
  const z = s.zone;
  const sq = shaftSq(), rs = s.rightStroke || rightStroke(s, sq), st = rs.st, dir = aimFor(s, st, sq), run = playAim(s, dir, st, true, sq);   // the shot the card named
  // From where you are, into the right shot: you come up off your shot (if you're still down), the balls fade out where they
  // stopped and back in where they started while you step over behind the right line, then you get down on it, a couple of
  // practice strokes, and the stroke. Played like any shot: you come up out of the way as the balls come back at your cue.
  const c = s.cam, routine = !!(c && c.T), downOn = routine && shootLevel() >= SH.down;
  const calm = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);   // reduced motion: shorter moves
  const rp = s.replay = {V: st.V, tip: st.tip, feather: false, id: rs.id};   // id: the fraction it's played at, the card's right call
  const ctlBack = () => { S.ctlGlideMs = calm ? 0 : 450; renderShootControls(); };   // the controls back to your own stroke and call
  const tw = routine ? (c.tw = (c.tw || 0) + 1) : 0;   // owns the camera: a stand-up still running stops where it is
  const live = () => { const ok = S.shot === s && s.replay === rp && (!routine || c.tw === tw);
    if(!ok){ s.swapA = null; if(S.shot === s && s.replay === rp){ s.replay = null; draw(true); ctlBack(); } }   // cut short: nothing left behind, the references come back
    return ok; };
  const tween = (ms, f, done) => { const t0 = performance.now();
    const tick = now => { if(!live()) return; const u = Math.min(1, (now - t0)/Math.max(1, ms)); f(u); draw(true); if(u < 1) requestAnimationFrame(tick); else done(); };
    requestAnimationFrame(tick); };
  const play = () => {
    const hitT = (obHit(run.sim.events) || {}).t ?? 0;
    const obT = run.sim.events.find(e=>e.ids && e.ids[0]==='o' && e.t > hitT && (e.type==='cushion' || e.type==='jaw' || e.type==='pocket'));
    const upAt = downOn ? Math.min(obT ? obT.t*1000 + 120 : Infinity, rigHitMs(s, run, dir)) : Infinity;   // as a played shot: up as the object ball gets there,
    if(isFinite(upAt)) setTimeout(()=>{ if(S.shot === s && s.replay === rp) standUp(s); }, upAt);                 // or sooner if a ball's coming back at your cue or hand
    animateShot({made: run.made}, ()=>{ if(s.replay === rp){ s.replay = null; if(S.shot === s) ctlBack(); } draw(true); standUp(s); }, '#ffd34d', run);
  };
  const swapMs = calm ? 300 : 800;
  const across = () => {
    const from = routine ? shootCam(s, settings.view) : null;   // the view right now: the move starts from exactly here
    s.follow = 0; s.aimDir = dir;
    rp.ctl = true; S.ctlGlideMs = calm ? 0 : swapMs; renderShootControls();   // the tip, speed and fraction glide to the right shot's as the balls go back
    if(routine){ c.fromCam = from; c.phase = 'shift'; c.k = 0; c.fHold = 0; c.downAt = null; }
    let swapped = false;
    tween(swapMs, u => {
      if(routine) c.k = ease(u);
      if(u >= .5 && !swapped){   // out of sight: the balls go back to where they started, the references to the right shot
        swapped = true; s.final = null; s.anim = null; s.tip = st.tip; rp.bare = true;   // and the references go with them, until the shot's played
        s.pick = {made: run.made, far: false, g2: s.gb};
      }
      s.swapA = u < .5 ? 1 - ease(u*2) : ease(u*2 - 1);
    }, ()=>{
      s.swapA = null;
      if(routine){ c.fromCam = null; c.phase = 'down'; c.k = 0; }
      if(!downOn){ s.follow = FOLLOW_THROUGH; draw(true); return play(); }   // before you get down on shots: just the shot
      // down on the right line, a couple of practice strokes, then the stroke
      rp.feather = true;   // getting down: the cue and hand fade in as on any shot (no practice strokes yet: c.downAt is off)
      tween(calm ? Math.min(400, downMs(s)) : downMs(s), u => { c.k = ease(u); }, ()=>{
        featherStart(c); const t0 = performance.now();
        const loop = now => { if(!live()) return; draw(true);
          if(now - t0 < 2000) return requestAnimationFrame(loop);   // about a stroke and a bit
          const x0 = rigAlpha(s).push || 0; rp.feather = false; c.downAt = null; strokeThen(s, x0, play); };
        requestAnimationFrame(loop);
      });
    });
  };
  // still down on your own shot: come up off it first (the cue and hand come off the table as you do)
  if(routine && c.phase === 'down' && c.k > .01){ const k0 = c.k; tween((calm ? 200 : 450)*k0, u => { c.k = k0*(1 - ease(u)); }, across); }
  else across();
}
// Shift or the button: the right shot now. Your own shot still running is finished where it is, as Enter would (the
// sounds still to come are cut, it's counted), then straight into the replay. A replay already under way carries on.
function replayRightNow(){
  const s = S.shot; if(!s || !S.answered || cueStroke || s.replay || $('showright').hidden) return;
  if(S.anim){ finishAnim(); if(S.shot !== s || S.anim) return; }
  showRightShot();
}
export function animateShot(oc, done, obCol, pre, rightPre){   // rightPre: the right call played out (a wrong call on the ladder), for the see-through ball
  const s = S.shot, cb0 = s.cb;
  // the shot, played out by the engine with both balls' paths kept: what you see is exactly what was judged
  const run = pre || outcome(s, oc.phiC ?? s.theta, true), sim = run.sim, Pc = sim.paths.c, Po = sim.paths.o;
  const hit = obHit(sim.events), T1 = hit ? hit.t : Pc[Pc.length-1].t;
  const firstC = sim.events.find(e=>e.type === 'ball' && e.ids.includes('c'));
  s.noHit = !(firstC && firstC.ids.includes('o'));   // the cue ball hit another ball first, or nothing: nothing as if the object ball were struck is drawn
  // the right call played out: the yellow line grows along it, and on a miss a see-through object ball rolls it
  const isRight = rightPre ? false : !!pre || Math.abs((oc.phiC ?? s.theta) - s.theta) < 1e-9;
  const right = rightPre || (isRight ? run : outcome(s, s.theta, true)), Pr = right.sim.paths.o;
  const rHit = obHit(right.sim.events), rT1 = rHit ? rHit.t : T1;
  const lastT = P => P[P.length-1].t;
  const total = Math.max(lastT(Pc), lastT(Po), isRight ? 0 : lastT(Pr), ...(s.extra || []).map(x=>sim.paths[x.id] ? lastT(sim.paths[x.id]) : 0))*1000 + 280;   // short hold so you see where the balls stopped
  // sounds, from the engine's events: the hit, cushions and jaws (softer the gentler; a rattle's rapid touches count once), pockets
  const plan = [], lastAt = {};
  const v0 = Pc.length > 1 ? len(sub(Pc[1].p, Pc[0].p))/Math.max(1e-6, Pc[1].t - Pc[0].t) : 20;
  plan.push([0, 'cue', Math.max(.35, Math.min(1, .3 + v0/50))]);   // the cue strikes the cue ball, firmer for a harder shot
  for(const e of sim.events){
    const kind = e.type === 'ball' ? 'click' : e.type === 'pocket' ? 'drop' : e.type === 'jaw' ? 'jaw' : 'rail';
    if(kind !== 'drop' && e.speed < 3) continue;
    const key = e.type + e.ids.join();
    if(kind !== 'drop' && lastAt[key] != null && e.t - lastAt[key] < 0.06) continue;
    lastAt[key] = e.t;
    const vol = kind === 'click' ? (e === hit ? 1 : .6*railVol(e.speed)) : kind === 'drop' ? 1 : (e.ids[0] === 'c' ? .8 : 1)*railVol(e.speed);
    plan.push([e.t + (kind === 'drop' ? 0.12 : 0), kind, vol]);
  }
  const bus = tableSounds(plan, s.duck);
  const at = (P, t) => {   // position, height and turn at time t along a recorded path
    let lo = 0, hi = P.length - 1;
    if(t >= P[hi].t) return P[hi];
    if(t <= P[0].t) return P[0];
    while(hi - lo > 1){ const m = (lo+hi) >> 1; if(P[m].t <= t) lo = m; else hi = m; }
    const a = P[lo], b = P[hi], k = b.t > a.t ? (t - a.t)/(b.t - a.t) : 0;
    return {p: add(a.p, mul(sub(b.p, a.p), k)), z: a.z + (b.z - a.z)*k, M: a.M};
  };
  // how far the right path's object ball has run by time t (for the yellow line)
  const rCum = [0]; for(let i=1;i<Pr.length;i++) rCum.push(rCum[i-1] + len(sub(Pr[i].p, Pr[i-1].p)));
  const runAt = t => { if(t <= rT1) return 0; let lo = 0, hi = Pr.length - 1; if(t >= Pr[hi].t) return rCum[hi]; while(hi - lo > 1){ const m = (lo+hi) >> 1; if(Pr[m].t <= t) lo = m; else hi = m; } return rCum[lo]; };
  const thin = P => P.filter((q, i)=>i % 3 === 0 || i === P.length-1);
  const cTrail = thin(Pc), oTrail = thin(Po.filter(q=>q.t >= T1 - 1e-9));
  const pocketOf = e => e ? POCKETS[e.pocket] : null;
  const ballAt = (P, t, inE) => {   // a ball's drawing state; once it has dropped below the cloth it's clipped to its pocket's hole
    const q = at(P, t), down = q.z < R - 0.02;
    return {p: q.z > -3*R ? q.p : null, z: q.z, shadow: down ? 0 : 1, M: q.M, pocket: down ? pocketOf(inE) : null};
  };
  const t0 = performance.now();
  const frame = now => {
    if(!S.anim) return;
    const t = (now - t0) / 1000;
    const c = ballAt(Pc, t, run.cbIn), o = ballAt(Po, t, run.obIn);
    const extra = xs.map(([x, P, inE])=>({x, ...(P ? ballAt(P, t, inE) : {p: x.p, z: R, shadow: 1, M: null, pocket: null})}));   // S: the other balls, as the engine rolled them
    let obGhost = null;
    if(!isRight && !s.noHit && t >= rT1){ const g = ballAt(Pr, t, right.obIn); if(g.p) obGhost = {p: g.p, z: g.z, shadow: g.shadow}; }
    s.anim = {tHit: Math.max(0, t - T1), obGhost, extra, cb: c.p, cbZ: c.z, cbShadow: c.shadow, cbPocket: c.pocket, spin: {M: c.M},
      ob: o.p, obScale: 1, obZ: o.z, obShadow: o.shadow, obPocket: o.pocket, obM: o.M, run: runAt(t),
      trail: {cb: [...cTrail.filter(q=>q.t <= t).map(q=>q.p), ...(c.p ? [c.p] : [])], ob: t < T1 ? null : [...oTrail.filter(q=>q.t <= t).map(q=>q.p), ...(o.p ? [o.p] : [])], obCol,
        x: xTrails.map(P=>P.filter(q=>q.t <= t).map(q=>q.p))}};
    draw(false);
    if(now - t0 < total) S.anim.raf = requestAnimationFrame(frame); else finishAnim();
  };
  const cEnd = Pc[Pc.length-1], oEnd = Po[Po.length-1];
  const xs = (s.extra || []).map(x=>[x, sim.paths[x.id], sim.events.find(e=>e.type==='pocket' && e.ids[0]===x.id)]);
  const xTrails = xs.filter(([x, P])=>P && len(sub(P[P.length-1].p, P[0].p)) > 0.05).map(([x, P])=>thin(P));   // the other balls that moved
  const xEnd = xs.map(([x, P, inE])=>({x, p: inE ? null : P ? P[P.length-1].p : x.p, z: R, shadow: 1, M: P ? P[P.length-1].M : null}));
  s.final = {obPath: oTrail.map(q=>q.p), cb: run.cbIn ? null : cEnd.p, spin: {M: cEnd.M}, ob: run.obIn ? null : oEnd.p, obM: oEnd.M, stop: null,
    trail: {cb: cTrail.map(q=>q.p), ob: s.noHit && oTrail.length > 1 && len(sub(oTrail[oTrail.length-1].p, oTrail[0].p)) > 0.05 ? oTrail.map(q=>q.p) : null, obCol, x: xTrails.map(P=>P.map(q=>q.p))}, extra: xEnd};
  S.anim = {done, t0, total, bus, raf: requestAnimationFrame(frame)};
}
function finishAnim(){
  if(!S.anim) return;
  const a = S.anim; S.anim = null;
  cancelAnimationFrame(a.raf);
  if(performance.now() - a.t0 < a.total - 300) cutSounds(a.bus);   // skipped: sounds that haven't happened yet don't play
  if(S.shot) S.shot.anim = null;
  a.done(performance.now() - a.t0);
}
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
function lockBtn(b, lk, tip){
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
function hideLockTip(){ clearTimeout(lockTip.timer); lockTip.timer = 0; lockTip.at = null; if(lockTip.el) lockTip.el.hidden = true; }
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
document.querySelectorAll('[data-set]').forEach(b=>b.addEventListener('click', ()=>applySetting(b.dataset.set, b.dataset.val)));
$('task-sess').addEventListener('click', ()=>applySetting('task', 'shoot'));
$('task-practice').addEventListener('click', ()=>{ if(!practiceUnlocked() || tut.on) return; if(!isDrill()) applySetting('task', 'practice'); openSheet('drill', true); });   // Practice: set it up as you go in
$('task-flash').addEventListener('click', ()=>{ if(settings.task === 'flash' && !tut.on) openSheet('flashsheet', true); });   // (after the setting itself: the sheet opens over the start card)
$('task-run').addEventListener('click', ()=>{ if(isRun() && !tut.on) openSheet('runsheet', true); });

function syncRefs(){
  if($('answers').children.length) return;
  setRefs(CORE); setBounds(boundsFor(REFS));
  $('answers').innerHTML = REFS.map((r,i)=>`<button data-id="${r.id}" id="ans-${r.id}" aria-label="${r.label} ball${touchMode() ? '' : `, key ${i+1}`}" data-label-kbd="${r.label} ball, key ${i+1}" data-label-touch="${r.label} ball"><kbd class="key" aria-hidden="true">${i+1}</kbd>${r.label}<span>${r.deg.toFixed(r.deg%1?1:0)}°</span></button>`).join('');
}
syncRefs();
// answer on press (pointerdown), not on release: a tap's click lands ~100 ms later
$('answers').addEventListener('pointerdown', e=>{ if(e.button !== 0) return; const b=e.target.closest('button'); if(b && !b.disabled){ e.preventDefault(); pickFrac(b.dataset.id); } });
$('answers').addEventListener('click', e=>{ const b=e.target.closest('button'); if(b && e.detail === 0) pickFrac(b.dataset.id); });   // keyboard activation (Enter/Space on a focused button)
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
$('next').addEventListener('click', ()=>nextShot());
wireWalk();
tableBox.addEventListener('click', ()=>{ if(S.anim) return; if(tut.on) return; if(performance.now() - walkEndedAt < 300) return; if(S.answered) nextDeal(); });
$('flashstart').addEventListener('click', e=>{ e.stopPropagation(); startFlashMode(); });
// Flash replays: as many as you like (each is still counted on the shot, so the stats can show it)
function replaysLeft(){ const a = stats.active; return a && a.task === 'flash' ? Infinity : 0; }
function syncReplay(){ $('replay').hidden = replaysLeft() <= 0; $('replaytext').textContent = 'Replay'; $('replay').setAttribute('aria-label', 'Replay the shot'); }
function replay(){
  if(!S.shot || S.answered || settings.task!=='flash' || replaysLeft() <= 0) return;
  S.shot.replays = (S.shot.replays||0)+1; stats.active.replays = (stats.active.replays||0) + 1; save();
  syncReplay(); startFlash();
}
$('replay').addEventListener('click', e=>{ e.stopPropagation(); replay(); });
wireResize();
if(window.ResizeObserver){ const ro = new ResizeObserver(()=>requestAnimationFrame(alignLogo)); ro.observe(document.querySelector('.table-box')); ro.observe(document.querySelector('header')); }
window.addEventListener('resize', ()=>requestAnimationFrame(alignLogo));
wireResizeDraw();
$('reset').addEventListener('click', async ()=>{   // all or nothing: your whole progression, Ladder and Flash together
  const warn = `You'll start again at ${SHOOT_GRADES[0]} with no record: every shot and session, Ladder, Flash, Practice and Run-outs, is cleared. Flash, Practice, Run-outs and the bigger tables lock until you earn them back, and the lessons play again as you reach them. This can't be undone.`;
  if(!await ask({title: 'Reset your progress?', text: warn, ok: 'Reset', danger: true})) return;
  stats.log = []; stats.sessions = []; delete stats.archive; delete stats.run; S.RUN = null; delete stats.level; delete stats.shoot; stats.active = null; settings.practice = null; settings.tablePick = null; settings.flashTable = '7'; settings.tstyle = 'bar'; settings.ballSet = 'standard'; delete settings.lookSeen; applyStyle();
  if(settings.tutSeen) for(const k in LESSONS) if(LESSONS[k].at > 0) delete settings.tutSeen[k];
  saveSettings(); enforceLocks(); renderBadge(true); renderProgress(); renderModeChip();
  if(!flashUnlocked() && settings.task==='flash' || !practiceUnlocked() && isDrill() || !runUnlocked() && settings.task==='run') applySetting('task','shoot');
  showSessIdle(); syncPressed(); save(); renderStats(); syncStreakPill(); if(!S.answered && !S.anim) deal(); });
const menuOpen = () => !$('menu').hidden;
export function openMenu(v){ $('menu').hidden = !v; if(v) $('menuclose').focus({preventScroll:true}); else $('cog').focus({preventScroll:true}); }
// B-: throw
const TSTEPS_THROW = [
  {deg:30, mustMiss:'look', aids:{stance:1, ghost:1, line:1}, next:true,
   text:'Here the cue ball is struck <b>soft, with stun</b>: a little below centre, so it arrives sliding, with no spin.'},
  {aids:{stance:1, ghost:1}, zoom:true, overlap:true, next:true,
   text:'As the balls touch, friction drags the object ball a little along the cue ball’s path. That’s <b>throw</b>: the object ball goes <b>fuller</b> than the ghost ball says.'},
  {aids:{stance:1, ghost:1}, demo:'look', next:true,
   text:'Hit it exactly as it looks, and throw carries it fuller. Watch it miss.'},
  {aids:{stance:1, ghost:1}, demo:'right', next:true,
   text:'A touch thinner, allowing for the throw, and it drops.'},
  {finish:true, aids:{},
   text:'On a cut, the cue ball drags the object ball along with it a little, so it goes off at a smaller angle than the line says. That\'s <b>throw</b>. It\'s biggest on a <b>soft stun</b> shot at around a <b>half-ball</b> hit; follow, draw and more pace make it much smaller. On this grade every shot is played soft with stun for you, so throw decides some of them: a cut that looks ¾ can need ½.'},
];
// ---------- Shoot lessons ----------
const SL_SHOOT = [
  {rail:true, noPocket:true, aids:{}, labels:['cb','ob','drag'], next:true, look:'drag',
   text:'The <b>cue ball</b> is the one you strike; it hits the <b>object ball</b>. The question is always the same: <b>how full</b> do you hit it? ' + kt('Click and drag on the table to look around the cue ball.', 'Drag on the table to look around the cue ball.')},
  {noPocket:true, aids:{}, labels:['ob','drag'], next:true, look:'ob',
   text:kt('Press the <b>focus button</b> (or <b>V</b>) to look around the object ball instead, then click and drag.', 'Tap the <b>focus button</b> to look around the object ball instead, then drag.')},
  {noPocket:true, aids:{}, labels:['cb'], next:true, look:'cb', keepPivot:true,
   text:kt('Press the <b>focus button</b> (or <b>V</b>) again to come back to the cue ball.', 'Tap the <b>focus button</b> again to come back to the cue ball.') + ' Calling a shot always brings you back to the cue ball.'},
  {noPocket:true, aids:{ghost:1, line:1}, labels:['ghost','line'], next:true,
   text:'The <b>ghost ball</b> shows where the cue ball must be when it hits the object ball. The dotted <b>guide line</b> is the cue ball’s path.'},
  {noPocket:true, ghostAt:'full', aids:{ghost:1}, zoom:true, overlap:true, next:true,
   text:'From behind the cue ball, the ghost ball <b>overlaps</b> the object ball. <b>How much it covers is the fraction</b>, and that’s what you call. Here it covers all of it: a <b>full</b> hit, right through the middle.'},
  {noPocket:true, ghostAt:'34', aids:{ghost:1}, zoom:true, overlap:true, next:true,
   text:'Move the ghost ball over a little and it covers three quarters: a <b>¾-ball</b> hit, a gentle cut.'},
  {noPocket:true, ghostAt:'12', aids:{ghost:1}, zoom:true, overlap:true, next:true,
   text:'Half covered: a <b>½-ball</b> hit.'},
  {noPocket:true, ghostAt:'14', aids:{ghost:1}, zoom:true, overlap:true, next:true,
   text:'A quarter covered: a <b>¼-ball</b> hit. The cut is getting thin.'},
  {noPocket:true, ghostAt:'18', aids:{ghost:1}, zoom:true, overlap:true, next:true,
   text:'Just an eighth, barely touching: a <b>⅛-ball</b> hit, the thinnest you’ll call.'},
  {shot:'34', aids:{ghost:1, line:1, path:1}, labels:['pocket'], ask:'34',
   text:'Now with a <b>pocket</b>, marked in gold; the yellow line is the object ball’s path into it. <b>Your call takes the shot</b>: the cue ball is sent to that fraction’s contact, so the right call drops. ' + kt('Call this one with the buttons, or keys <b>1</b>–<b>5</b>.', 'Tap a fraction to call this one.')},
  {shot:'12', aids:{ghost:1, line:1, path:1}, ask:'12',
   text:'One more. Call this one.'},
  {finish:true, aids:{},
   text:'That’s the whole game: picture the ghost ball, read how much it covers, call it. To watch this lesson again, tap the <b>?</b> button at the top.'},
];
const SL_DOWN = [
  {deg:30, aids:{}, next:true,
   text:'From here every shot is a routine. You start <b>standing on the ball line</b>, cue ball to object ball, to read the layout.'},
  {aids:{}, next:true,
   text:'<b>Call the fraction</b> and you <b>step behind the aim line</b> and <b>get down on it</b>, your <b>cue</b> and <b>bridge hand</b> in the picture as at a real table (you can make them see-through in Settings).'},
  {finish:true, aids:{},
   text:'You get down on the line of the fraction <b>you call</b>. A wrong line should look wrong once you’re down: if it does, call another and you get back up and move to its line. <b>Call the same one again</b> to shoot.'},
];
const SL_SPEED = [
  {deg:30, aids:{}, ui:['speed'], next:true,
   text:'<b>Speed</b> is yours now: four strokes, <b>¼</b>, <b>½</b>, <b>¾</b> and <b>full</b>. ' + kt('<b>↑ ↓</b>, or the bar on the right of the table.', 'Drag the <b>Speed</b> bar on the table, or tap its arrows.') + ' Set it before you call.'},
  {aids:{}, ui:['speed'], next:true,
   text:'Rolling, a <b>¼</b> stroke (a touch shot) goes under a table length, <b>½</b> (a lag) about two, <b>¾</b> about three, and the <b>full</b> stroke (a power shot) about four, rails included.'},
  {aids:{}, ui:['speed'], next:true,
   text:'Your <b>bridge</b> stays put: how much of your <b>stroke</b> you use sets the speed. The full stroke brings the tip back to your bridge; ½ goes half as far. Same tempo, same <b>follow-through</b> every time.'},
  {aids:{}, play:{k:.45, tip:[0,.4]}, expect:'short', ui:['speed'], next:true, text:'Too soft and it dies short. Watch.'},
  {aids:{}, play:{k:1, tip:[0,.4]}, ui:['speed'], next:true, text:'<b>Pocket speed</b>: just enough, and it drops.'},
  {aids:{}, play:{k:3.2, tip:[0,.4]}, ui:['speed'], next:true, text:'Much harder still goes, but the pocket gets less forgiving and the cue ball runs wild.'},
  {aids:{}, ui:['speed'], next:true,
   text:'How full you hit it decides how much speed the cue ball keeps. With no spin on it, the cue ball loses as much of its speed as the hit covers: a <b>full</b> hit stops it dead, a <b>½</b>-ball hit takes half its speed, a <b>¼</b>-ball hit a quarter. What it keeps carries it on after contact.'},
  {finish:true, aids:{}, ui:['speed'], text:'From this grade on, the stroke is yours. Aim for <b>pocket speed</b>: the softest of your four strokes that gets the ball to the pocket. Softer makes the pocket play bigger, but harder still scores as long as the cue ball stays out of the pocket. Your stroke stays where you left it.'},
];
const SL_ANY = [
  {deg:35, aids:{stance:1, ghost:1, line:1}, next:true,
   text:'From here cuts come at <b>any angle</b>, not just on a fraction. Here’s one.'},
  {aids:{stance:1, ghost:1}, zoom:true, overlap:true, next:true,
   text:'Up close: the ghost ball covers <b>a bit less than half</b> of the object ball. It’s nearest to <b>½</b>.'},
  {aids:{stance:1, ghost:1}, demo:'right', next:true,
   text:'Call the <b>nearest fraction</b>, ½ here, and the shot takes the touch less ball it needs. It drops.'},
  {finish:true, aids:{},
   text:'Always call the nearest fraction. No cut sits right between two: look again and it’s nearer one of them. And the table is a full <b>9 ft</b> from here.'},
];
const SL_STUN = [
  {deg:30, aids:{}, check:{k:2.6, tip:[0,0], stun:true}, ui:['tip','speed'], next:true,
   text:'<b>Stun</b>: hit dead centre (' + kt('<b>X</b>', 'the middle of the <b>tip pad</b>') + '), firmly enough that the cue ball is still sliding when it arrives. With no spin it leaves along the <b>tangent line</b>, at right angles to the object ball.'},
  {aids:{}, play:{k:2.6, tip:[0,0], stun:true}, ui:['tip','speed'], next:true, text:'Watch it leave along the tangent line.'},
  {deg:0, aids:{}, play:{k:2.6, tip:[0,0], stun:true}, shows:'stop', ui:['tip','speed'], next:true, text:'Straight in, the same stroke is a <b>stop shot</b>: the cue ball stays where it hit.'},
  {deg:30, aids:{}, try:{k:2.6, tip:[0, 0]}, ui:['tip'], ask:'try',
   text:'Your turn, dead centre on the tip pad. Call the fraction to get down on its line, then call it again to shoot. Land it in the zone.'},
  {deg:45, aids:{}, try:{k:2.6, tip:[0, 0]}, ui:['tip'], ask:'try',
   text:'Once more, a thinner cut: with no spin it still leaves along the tangent line.'},
  {finish:true, aids:{}, text:'The farther the cue ball travels, the lower or harder you have to hit it for the backspin to last.'},
];
const SL_FOLLOW = [
  {deg:30, aids:{}, check:{k:1.2, tip:[0,0]}, ui:['tip'], next:true,
   text:'Now the cue ball has somewhere to be: land it in the <b>green zone</b>.'},
  {aids:{}, play:{k:1.2, tip:[0,0]}, ui:['tip'], next:true, text:'Watch: a centre-ball hit goes about here.'},
  {aids:{}, play:{k:1.6, tip:[0,.5]}, ui:['tip'], next:true,
   text:'<b>Follow</b>: strike above centre with the <b>tip pad</b>' + kt(' (or <b>W</b>)', '') + '. The topspin bends the cue ball forward off the tangent line after contact.'},
  {deg:0, aids:{}, play:{k:1.6, tip:[0,.5]}, shows:'through', ui:['tip'], next:true, text:'Straight in, it rolls on through after the object ball.'},
  {deg:30, aids:{}, try:{k:1.6, tip:[0, TIP_STEP]}, ui:['tip'], ask:'try',
   text:'Your turn, with <b>half a tip</b> of follow set on the tip pad. Call the fraction to get down on its line, then call it again to shoot. Land it in the zone.'},
  {deg:25, aids:{}, try:{k:1.6, tip:[0, 2*TIP_STEP]}, ui:['tip'], ask:'try',
   text:'Now a <b>full tip</b> of follow: the cue ball carries further forward.'},
  {finish:true, aids:{}, text:'More top, or more pace, carries it further forward. Pot it and stop in the zone for full points; potting it but missing the zone scores nothing either way.'},
];
const SL_DRAW = [
  {deg:30, aids:{}, check:{k:2.8, tip:[0,-.55]}, ui:['tip','speed'], next:true,
   text:'<b>Draw</b>: strike below centre' + kt(' (<b>S</b>)', ' on the <b>tip pad</b>') + '. The backspin pulls the cue ball back off the tangent line after contact.'},
  {aids:{}, play:{k:2.8, tip:[0,-.55]}, ui:['tip','speed'], next:true, text:'Watch it pull back off the tangent line.'},
  {deg:0, aids:{}, play:{k:2.8, tip:[0,-.55]}, shows:'back', ui:['tip','speed'], next:true, text:'Straight in, it comes back toward you.'},
  {deg:30, aids:{}, try:{k:2.8, tip:[0, -TIP_STEP]}, ui:['tip'], ask:'try',
   text:'Your turn, with <b>half a tip</b> of draw set on the tip pad. Call the fraction to get down on its line, then call it again to shoot. Land it in the zone.'},
  {deg:25, aids:{}, try:{k:2.8, tip:[0, -2*TIP_STEP]}, ui:['tip'], ask:'try',
   text:'Now a <b>full tip</b> of draw: it comes back further.'},
  {finish:true, aids:{}, text:'Draw needs pace: the backspin wears off on the way, so a soft or long draw shot just stuns.'},
];
const SL_CUSHION = [
  {deg:35, aids:{}, check:{k:2.6, tip:[0,.2]}, shows:'rail', ui:['tip','speed'], next:true,
   text:'Off a cushion: the cue ball comes off at about the angle it went in, a little wider when it’s rolling. Picture that line to find where it ends up.'},
  {aids:{}, play:{k:2.6, tip:[0,.2]}, shows:'rail', ui:['tip','speed'], next:true, text:'Watch it come off the cushion.'},
  {finish:true, aids:{}, text:'These zones need the cue ball to use <b>two cushions</b>. Each can be reached more than one way, with top, stun or draw: pick one, and the speed that goes with it.'},
];
// English: side pushes the cue ball off the aim line (squirt: the engine's, for a maple shaft, the same at any pace, in a
// straight line), so a call has to allow for it. Every shot is a ½-ball cut as it looks, dealt so that the plain ½ misses
// and the aim that pots it with the step's stroke is nearest the fraction the step names (need).
const EN = {shaft:'maple', noZone:true, mid:true}, EN_R = [TIP_STEP, 0], EN_L = [-TIP_STEP, 0], EN_2FT = [22, 26], EN_1FT = [12.5, 14];
const SL_ENGLISH = [
  {...EN, deg:35, aids:{}, play:{k:2.6, tip:[.45,0]}, shows:'rail', ui:['tip'], next:true,
   text:'<b>English</b> is side spin: you strike the cue ball to the left or right of its centre. Off a cushion, it changes the angle at which the cue ball rebounds, and it can take speed off or add it. This shot uses right english.'},
  {...EN, deg:30, dist:EN_2FT, group:true, need:'34', aids:{}, check:{k:1.6, tip:EN_R}, ui:['tip'], next:true,
   text:'Side spin also pushes the cue ball slightly off the line you aim along. This is called <b>deflection</b>. Because of it, a cut that looks like a ½-ball hit may need to be played thinner or fuller, depending on which side you use.'},
  {...EN, aids:{ghost:1, line:1}, play:{k:1.6, tip:EN_R, aim:'plain'}, expect:'miss', need:'34', ui:['tip'], next:true,
   text:'This shot uses right english and is aimed as a plain ½-ball hit. Deflection makes it miss.'},
  {...EN, aids:{ghost:1, line:1}, play:{k:1.6, tip:EN_R}, need:'34', ui:['tip'], next:true,
   text:'Here is the same shot aimed at <b>¾</b>. This time it drops.'},
  {...EN, deg:30, dist:EN_1FT, aids:{}, try:{k:1.6, tip:[-2*TIP_STEP, 0]}, need:'34', ui:['tip'], ask:'try',
   text:'Your turn. This cut looks like a ½-ball hit, and the tip is set to a full tip of left english. Call the fraction that pots it.'},
  {...EN, deg:30, dist:EN_2FT, aids:{}, try:{k:1.6, tip:EN_R}, need:'14', ui:['tip'], ask:'try',
   text:'Try one more. This time the tip is set to half a tip of right english.'},
  {finish:true, aids:{}, text:'Whenever you use side spin, allow for deflection by playing the cut a little thinner or fuller.'},
];
const SL_ALL = [
  {deg:30, aids:{}, finish:true, text:'Everything is yours: speed, top, back and side. Each zone can be reached more than one way: pick the stroke, then aim for what it does.'},
];
export const LESSONS = {
  shoot:   {name:'Calling the fraction', at:0, steps:SL_SHOOT},
  down:    {name:'Cue and hand', at:SH.down, steps:SL_DOWN},
  any:     {name:'Any angle', at:SH.any, steps:SL_ANY},
  speed:   {name:'Speed', at:SH.speed, steps:SL_SPEED},
  throw:   {name:'Throw', at:SH.throw, steps:TSTEPS_THROW},
  follow:  {name:'Center ball: follow', at:SH.follow, steps:SL_FOLLOW},
  stun:    {name:'Center ball: stun', at:SH.stun, steps:SL_STUN},
  draw:    {name:'Center ball: draw', at:SH.draw, steps:SL_DRAW},
  cushion: {name:'Center ball: two cushions', at:SH.cushion, steps:SL_CUSHION},
  english: {name:'English', at:SH.english, steps:SL_ENGLISH},
  all:     {name:'Everything', at:SH.all, steps:SL_ALL},
};
const tsteps = () => LESSONS[tut.lesson || 'shoot'].steps;
export const tstep = () => tsteps()[tut.i];
const lessonsOpen = () => Object.entries(LESSONS).filter(([, L])=>L.at <= ladderBest());
function openTutMenu(v){
  $('tutmenu').hidden = !v;
  if(v) $('tutlist').innerHTML = lessonsOpen().map(([k, L])=>`<button data-lesson="${k}">${L.name}<small>${L.at ? stepGrade(L.at) : 'Start'}</small></button>`).join('');
}
export function tutAid(key){
  const v = (tstep().aids || {})[key];
  return v === 1 ? 1 : 0;
}
export let forceFrac = null, forceDeg = null, tutDist = null;   // tutDist: [min, max] inches from the cue ball to the contact
function tutShot(id){
  if(S.anim){ cancelAnimationFrame(S.anim.raf); S.anim = null; }
  forceFrac = id;
  let s1 = null;
  for(let k=0; k<200; k++){ const c = generate(); if(c.answer.id !== id) continue; s1 = c; if(c.L >= 16 && len(sub(c.ob, c.cb)) >= 14) break; }   // keep the balls apart and off the pocket, so the labels read
  forceFrac = null;
  S.shot = s1; S.shot.t0 = performance.now();
  S.shot.color = pick([OB_COLORS[1], OB_COLORS[2], OB_COLORS[3], OB_COLORS[5]]);   // never yellow: the lit-up overlap is yellow
}
function tutShotDeg(deg, mustMiss, dist){   // a shot at an exact cut; mustMiss: a plain hit at that cut has to miss; dist: how far the cue ball travels
  if(S.anim){ cancelAnimationFrame(S.anim.raf); S.anim = null; }
  forceDeg = deg; tutDist = dist || null;
  let s1 = null;
  for(let k=0; k<400; k++){ const c = generate(); s1 = s1 || c; if(mustMiss != null && outcome(c, mustMiss === 'look' ? c.pathDeg : mustMiss).made) continue; s1 = c; if(c.L >= 16 && len(sub(c.ob, c.cb)) >= 14) break; }
  forceDeg = null; tutDist = null;
  S.shot = s1; S.shot.t0 = performance.now();
  S.shot.color = pick([OB_COLORS[1], OB_COLORS[2], OB_COLORS[3], OB_COLORS[5]]);   // never yellow: the lit-up overlap is yellow
}
// the lesson's opening layout: no pocket in play, the object ball straight out from the cue ball toward the far short rail
function tutRailShot(){
  tutShot('full');
  const s = S.shot, cb = [W/2, H*.3], ob = [W/2, H*.56], w = norm(sub(ob, cb));
  Object.assign(s, {cb, ob, gb: sub(ob, mul(w, 2*R)), v: w, u: w, uC: w, n: w, sign: 1, theta: 0, pathDeg: 0, gbLook: null, strk: null, seq: null});
}
export const noPocket = () => (tut.on && !!tstep().noPocket) || !!(S.shot && S.shot.bare);
function freshCall(){   // same shot, ready to be called again
  if(S.anim){ cancelAnimationFrame(S.anim.raf); S.anim = null; }
  S.answered = false; S.shot.pick = null; S.shot.final = null; S.shot.anim = null; S.shot.t0 = performance.now();
  document.querySelectorAll('#answers button').forEach(b=>{ b.disabled = false; b.className = ''; });
  $('quick').innerHTML = ''; $('showright').hidden = true;
  tableBox.classList.remove('tappable');
}
function zoomTo(target){
  tut.zt = target; cancelAnimationFrame(tut.zRaf);
  const from = tut.zb, t0 = performance.now(), dur = 700;
  if(from === target) return;
  const step = now=>{
    const u = Math.min(1, (now - t0)/dur), e = u < .5 ? 2*u*u : 1 - Math.pow(-2*u + 2, 2)/2;   // ease in and out
    tut.zb = from + (target - from)*e; draw(S.answered);
    if(u < 1) tut.zRaf = requestAnimationFrame(step);
  };
  tut.zRaf = requestAnimationFrame(step);
}
// a lesson step that brings a new shot fades the table to black and back, as a new shot would
function runStep(back){
  const st = tstep(), want = back ? tut.shots[tut.i] : null;
  const fresh = tut.started && (back ? want && want !== S.shot : st.shot || st.rail || st.deg != null);
  clearTimeout(tut.fadeT);
  if(!fresh){ $('tutfade').classList.remove('on'); return runStepNow(back); }
  $('tutfade').classList.add('on');
  tut.fadeT = setTimeout(()=>{ if(tut.on){ cancelAnimationFrame(tut.zRaf); tut.zb = tut.zt = tstep().zoom ? 1 : 0; runStepNow(back); } $('tutfade').classList.remove('on'); }, 260);   // the new shot comes in already at its step's view
}
// the close-ups: one cue ball and object ball, the ghost ball moved round to each fraction's contact
function ghostFor(s, phi){
  const D = len(sub(s.ob, s.cb)), w = norm(sub(s.ob, s.cb)), al = Math.asin(Math.min(1, 2*R*Math.sin(phi*RAD)/D));
  const v = rot(w, s.sign*al), t = D*Math.cos(al) - 2*R*Math.cos(phi*RAD);
  return {gb: add(s.cb, mul(v, t)), v};
}
function setGhost(s, phi){ const g = ghostFor(s, phi); s.gb = g.gb; s.v = g.v; s.tphi = phi; }
function glideGhost(s, to){
  cancelAnimationFrame(tut.gRaf);
  const from = s.tphi ?? s.theta, t0 = performance.now(), dur = 650;
  if(Math.abs(from - to) < 1e-6){ setGhost(s, to); return; }
  const step = now=>{
    if(!tut.on || S.shot !== s) return;
    const u = Math.min(1, (now - t0)/dur), e = u < .5 ? 2*u*u : 1 - Math.pow(-2*u + 2, 2)/2;
    setGhost(s, from + (to - from)*e); draw(S.answered);
    if(u < 1) tut.gRaf = requestAnimationFrame(step);
  };
  tut.gRaf = requestAnimationFrame(step);
}
// the aim the right call plays on a lesson step marked mid: the middle of the aims that pot it with this stroke (aimFor finds
// the edge nearest the plain line, and with side that edge often rattles in off a jaw), so the coach's shot and your right
// call drop clean. Other steps play aimFor's, as the game does.
function tutAim(st, s, stroke, sq){
  const a = aimFor(s, stroke, sq), ok = t => playAim(s, rot(a, t*RAD), stroke, false, sq).made;
  if(!st.mid || !ok(0)) return a;
  let lo = 0, hi = 0;
  while(hi < 3 && ok(hi + .1)) hi += .1;
  while(lo > -3 && ok(lo - .1)) lo -= .1;
  return rot(a, (lo + hi)/2*RAD);
}
// the cue a lesson step plays with: a step can name its shaft (English always shows the maple one), else your own
const tutSq = st => st.shaft ? PE.SHAFTS[st.shaft] : shaftSq();
// a lesson step's stroke on this shot, worked out without touching the table: the speed and tip, the aim that pots it with
// them (need), and the aim the step plays (dir): that one, or (aim: 'plain') the plain hit at the cut as it looks, with no
// allowance for the side; aimK: aimed as for another pace (the same side), to show what speed changes
function tutPlanOf(st){
  const p = st.play || st.try || st.check, ideal = strikeOf(S.shot), d1 = len(sub(S.shot.gb, S.shot.cb)), sq = tutSq(st);
  let V = ideal.V*p.k;
  if(p.stun){ const ug = PE.C.muSlide*PE.G; V = Math.max(V, Math.sqrt(d1*49*ug/12)*1.15); }
  const tip = p.stun ? [0, Math.min(0, PE.strikeFor(Math.sqrt(Math.max(1, V*V - 2*PE.C.muSlide*PE.G*d1)), 0, d1).b)] : p.tip;
  const need = tutAim(st, S.shot, {V: p.aimK ? ideal.V*p.aimK : V, tip}, sq);
  const dir = p.aim === 'plain' ? dirForCut(S.shot, S.shot.theta) : need, run = playAim(S.shot, dir, {V, tip}, true, sq);
  return {V, tip, dir, run, sq, need};
}
// a lesson step the coach plays: the stroke (aimed at the right contact, at a share of pocket speed), worked out up front so the
// tip pad and speed bar can show it and, from Follow on, the zone can sit where it lands
function tutPlan(st){
  const pl = tutPlanOf(st), {V, tip, dir, run} = pl;
  const lvl = COARSE.reduce((b, l)=>Math.abs(Math.log(STROKE_MPH[l]*MPH/V)) < Math.abs(Math.log(STROKE_MPH[b]*MPH/V)) ? l : b, COARSE[0]);
  tut.plan = pl; tut.ctl = {tip, lvl};
  if(st.play){ S.shot.aimDir = dir; S.shot.aimId = S.shot.answer && S.shot.answer.id; }   // a try: you pick the line
  if((LESSONS[tut.lesson].at || 0) >= SH.follow && !st.noZone && !run.cbIn) S.shot.zone = {c: run.cueEnd, r: 6, tip};   // where this stroke lands
}
// where the cue ball really was when it met the object ball (the ghost ball a miss leaves behind)
function tutContactAt(run){ const e = obHit(run.sim.events); return e && e.pa ? (e.ids[0] === 'c' ? e.pa : e.pb) : null; }
// the cut the cue ball really made contact at (side spin pushes it off the aim line), from the engine's hit
function tutContactCut(run){
  const e = obHit(run.sim.events); if(!e || !e.pa || !e.pb) return null;
  const [pc, po] = e.ids[0] === 'c' ? [e.pa, e.pb] : [e.pb, e.pa], path = run.sim.paths && run.sim.paths.c;
  const p0 = path && path.length > 1 ? path[0].p : S.shot.cb, dv = norm(sub(pc, p0));   // the line it really travelled (straight: no swerve)
  return Math.acos(Math.max(-1, Math.min(1, dot(dv, norm(sub(po, pc))))))/RAD;
}
// does this stroke show the lesson? Nothing off a pocket's jaw (it doesn't come off the way a cushion sends it), no scratch,
// the object ball in (or, for a too-soft demo, stopping short of the pocket; for a miss, reaching a cushion or a jaw), and
// whatever the step is about. need: the aim that pots it with this stroke is nearest that fraction, and the plain call at the
// cut as it looks misses (English: the side pushes the cue ball a fraction off).
function tutShows(st, pl){
  const run = pl.run, ev = run.sim.events, hitT = (obHit(ev) || {}).t ?? Infinity, d = norm(sub(S.shot.gb, S.shot.cb));
  const cbAfter = ev.filter(e=>e.ids[0] === 'c' && e.t > hitT && (e.type === 'cushion' || e.type === 'jaw' || e.type === 'pocket'));
  if(!run.hit || run.scratch || cbAfter.some(e=>e.type === 'jaw')) return false;
  if(st.expect === 'miss'){ if(run.made || !ev.some(e=>e.ids[0] === 'o' && e.type !== 'ball')) return false; }   // a real miss, not one that dies short
  else {
    if(ev.some(e=>e.ids[0] === 'o' && e.type === 'jaw')) return false;
    if(st.expect === 'short' ? run.obIn || run.made : !run.made) return false;
  }
  if(st.need){
    const p = st.play || st.try || st.check, stroke = {V: pl.V, tip: pl.tip};
    if(nearestRef(cutForDir(S.shot, pl.need)).id !== st.need || S.shot.answer.id === st.need) return false;
    const right = pl.dir === pl.need ? run : playAim(S.shot, pl.need, stroke, false, pl.sq);
    if(!right.made || right.scratch) return false;
    const plain = p.aim === 'plain' ? run : playAim(S.shot, dirForCut(S.shot, S.shot.theta), stroke, true, pl.sq);
    if(plain.made) return false;
    // and it misses the way the side pushes it: thinner than it looks when the fix is fuller, fuller when it's thinner
    const c = tutContactCut(plain), fuller = ALL.find(r=>r.id === st.need).deg < S.shot.theta;
    if(c == null || (fuller ? c <= S.shot.theta : c >= S.shot.theta)) return false;
  }
  const end = sub(run.cueEnd, S.shot.gb);
  switch(st.shows){
    case 'rail': return cbAfter.length > 0 && cbAfter[0].type === 'cushion';                // off a cushion, cleanly
    case 'stop': return len(end) < STOP_R;                                                  // stays where it hit
    case 'through': return dot(end, d) > 6;                                                 // rolls on after the object ball
    case 'back': return dot(end, d) < -6;                                                   // comes back toward you
    default: return true;
  }
}
// the steps after this one that keep its shot (until one deals a new one): with group, the shot dealt here has to work for them too
function tutGroup(st){
  const all = tsteps(), i = all.indexOf(st), out = [st];
  if(!st.group || i < 0) return out;
  for(let j = i + 1; j < all.length && !(all[j].shot || all[j].rail || all[j].deg != null); j++) if(all[j].play || all[j].try || all[j].check) out.push(all[j]);
  return out;
}
// The coach's stroke has to show what the step teaches, and on a try your right call with the lesson's stroke has to work:
// pocketed, no scratch, in the zone. Until this layout does, deal another at the same cut (then a degree or two either side;
// a step that asks for a fraction (need) or keeps its shot for the steps after it stays at its exact cut).
// Returns how many layouts it took (0: none worked).
function tutDealFor(st){
  const deg = st.deg ?? Math.round(S.shot.theta), steps = tutGroup(st), exact = st.group || st.need;
  for(let k = 0; k < 400; k++){
    if(steps.every(x=>tutShows(x, tutPlanOf(x)))) return k + 1;   // (the step's plan is made as it starts)
    const off = k < 60 || exact ? 0 : (1 + (k >> 1) % 5)*(k % 2 ? 1 : -1);
    tutShotDeg(Math.max(0, deg + off), undefined, st.dist);
  }
  return 0;
}
// down on the shot in a lesson: practice strokes until the shot
// the coach plays the step's stroke (tut.plan): steps behind the line, gets down, a practice stroke or so, then the stroke.
// live: still wanted, checked before the stroke; done: once it's played out
function tutCoachPlay(live, done){
  const s = S.shot, pl = tut.plan; if(!s || !pl) return;
  tutBend('step', 450, ()=>tutBend('down', downMs(s) + 150, ()=>{ tutSettle(); setTimeout(()=>{
    if(!live() || S.shot !== s) return;
    const x0 = rigAlpha(s).push || 0;
    s.tip = pl.tip; cancelAnimationFrame(featherRaf);
    S.answered = true; s.pick = {made: pl.run.made, far: !pl.run.made, g2: tutContactAt(pl.run) || s.gb};
    strokeThen(s, x0, ()=>{ if(S.shot !== s || !tut.on) return;
      animateShot({made: pl.run.made}, ()=>{ draw(true); tutBend('up', 600); if(done) done(); }, pl.run.made ? '#ffd34d' : MISS, pl.run);
      const up = rigHitMs(s, pl.run, pl.dir); if(isFinite(up)) setTimeout(()=>{ if(S.shot === s && s.cam && s.cam.k > 0) tutBend('up', 450); }, up);
    });
  }, 1900); }));
}
// A lesson shot called wrong: the step stays. Your shot plays out, the note says what it was, then the right one is played
// (with the step's own stroke and spin, by the coach once you're getting down on shots), and the same shot comes back to
// call again. Next opens once you've seen it played right.
const tutLab = r => r.id === 'full' ? 'full' : r.label;
function tutFresh(s, then){   // the table fades out and back in on the same shot, as it was dealt
  clearTimeout(tut.fadeT); $('tutfade').classList.add('on');
  tut.fadeT = setTimeout(()=>{
    if(tut.on && S.shot === s){
      if(S.anim){ cancelAnimationFrame(S.anim.raf); S.anim = null; }
      cancelAnimationFrame(tut.bRaf); cancelAnimationFrame(featherRaf);
      s.final = null; s.anim = null; s.pick = null; s.cam = null; s.follow = 0; s.aimDir = null; s.aimId = null; markAim(s);
      then(); draw(S.answered);
    }
    $('tutfade').classList.remove('on');
  }, 260);
}
function tutShowRight(st, right){   // after your wrong shot has played out
  const s = S.shot, tok = tut.fix = {}, live = () => tut.on && tut.fix === tok && tstep() === st && S.shot === s;
  const again = () => setTimeout(()=>{ if(!live()) return;   // a moment to see where it went, then the shot is yours again
    tutFresh(s, ()=>{
      tut.fix = null; tut.seen = true; freshCall();
      document.querySelectorAll('#answers button').forEach(b=>{ b.disabled = false; b.setAttribute('aria-disabled', 'false'); });
      $('coachtext').innerHTML = st.text + '<br><span class="coachnote ok">Now you: call it again.</span>';
      $('coachnext').hidden = false; $('coachnext').textContent = 'Next';
    }); }, 1500);
  setTimeout(()=>{ if(!live()) return;
    tutFresh(s, ()=>{
      S.answered = false;   // standing again, as before a shot (calls wait: tut.fix)
      document.querySelectorAll('#answers button').forEach(x=>{ x.className = x.dataset.id === right.id ? 'right' : ''; });   // the right call lit while it's played
      if(tut.plan && st.try){ s.aimId = right.id; s.aimDir = tut.plan.dir; markAim(s); tutCoachPlay(live, again); return; }
      const oc = outcome(s, s.theta);
      S.answered = true; s.pick = {...oc, id: right.id, far: false};
      if(settings.animate !== '0') animateShot(oc, ()=>{ draw(true); again(); }, '#ffd34d'); else { draw(true); again(); }
    }); }, 900);
}
function tutSettle(){ const c = S.shot && S.shot.cam; if(!c) return; featherStart(c); featherLoop(S.shot); }
// the coach's routine: step behind the line, bend over onto it, and come back up after the shot
function tutBend(to, ms, done){
  const s = S.shot; if(!s) return;
  if(!s.cam) s.cam = {phase: 'stand', k: 0, T: NO_TIMER, tutDown: true};
  const c = s.cam;
  if(to === 'step'){ c.phase = 'step'; c.k = 0; }
  else if(to === 'down'){ c.phase = 'down'; c.k = 0; }
  const k0 = c.k, k1 = to === 'up' ? 0 : 1, t0 = performance.now();
  cancelAnimationFrame(tut.bRaf);
  const tick = now => {
    if(S.shot !== s || !tut.on) return;
    const u = Math.min(1, (now - t0)/ms); c.k = k0 + (k1 - k0)*ease(u);
    if(!S.anim) draw(S.answered);
    if(u < 1) tut.bRaf = requestAnimationFrame(tick); else if(done) done();
  };
  tut.bRaf = requestAnimationFrame(tick);
}
function runStepNow(back){
  tut.started = true;
  const st = tstep();
  if(back && tut.shots[tut.i]){ if(S.anim){ cancelAnimationFrame(S.anim.raf); S.anim = null; } S.shot = tut.shots[tut.i]; }   // going back: the same shot that step had
  else {
    if(st.shot) tutShot(st.shot);
    if(st.rail) tutRailShot();
    if(st.deg != null) tutShotDeg(st.deg, st.mustMiss, st.dist);
    if(st.play || st.try || st.check) tutDealFor(st);
  }
  // a step with nothing new for the table (just words, or the lesson's last) leaves it as it is: the balls where they
  // stopped, the view, the result. Only a new shot, a stroke to play or try, or a close-up sets the table again.
  const keep = tut.started0 && !(st.shot || st.rail || st.deg != null || st.play || st.try || st.check || st.demo != null || st.ghostAt || st.zoom || st.look)
    && (!back || tut.shots[tut.i] === S.shot);
  tut.started0 = true;
  tut.shots[tut.i] = S.shot;
  tut.fix = null; tut.seen = false;   // a wrong call's showing of the right shot, and whether you've seen it (then Next is open)
  if(!st.keepPivot && !keep) pivot.s = null;   // each step looks around the cue ball, unless it's the one that brings you back to it
  tut.lk = 0;
  if(!keep){
    freshCall();
    S.shot.cam = null; S.shot.aimDir = null; S.shot.zone = null; S.shot.follow = 0; tut.ctl = null; cancelAnimationFrame(tut.bRaf);   // each step starts standing
  }
  if(st.play || st.try || st.check) tutPlan(st);
  renderShootControls();
  if(!S.shot.gb0) { S.shot.gb0 = S.shot.gb; S.shot.v0 = S.shot.v; }
  cancelAnimationFrame(tut.gRaf);
  if(st.ghostAt) glideGhost(S.shot, ALL.find(r=>r.id === st.ghostAt).deg);
  else { S.shot.gb = S.shot.gb0; S.shot.v = S.shot.v0; S.shot.tphi = null; }   // back on the shot as dealt
  tut.watch = null;   // a step with a shot to watch plays it as you arrive (no lesson opens on one: there's always a slide to read first)
  if(st.play) tut.watch = ()=>{   // the coach gets down on the shot, then plays it
    if(!tut.on || tstep() !== st || S.answered || !tut.plan) return;
    tutCoachPlay(()=>tut.on && tstep() === st && !S.answered);
  };
  if(st.demo != null) tut.watch = ()=>{   // the coach plays the hit for you
    if(!tut.on || tstep() !== st || S.answered) return;
    const oc = outcome(S.shot, st.demo === 'right' ? S.shot.theta : st.demo === 'look' ? S.shot.pathDeg : st.demo);
    S.answered = true; S.shot.pick = {...oc, id: '', far: st.demo !== 'right'};
    if(settings.animate !== '0') animateShot(oc, ()=>{ draw(true); }, st.demo === 'right' ? '#ffd34d' : MISS); else draw(true);
  };
  zoomTo(st.zoom ? 1 : 0);
  $('coachstep').textContent = `${LESSONS[tut.lesson].name} · ${tut.i+1} of ${tsteps().length}`;
  $('coachtext').innerHTML = st.text;
  if(tut.watch){ const go = tut.watch; setTimeout(()=>{ if(tut.on && tstep() === st && tut.watch === go && !S.answered){ tut.watch = null; go(); } }, 700); }
  const nx = $('coachnext');
  nx.hidden = !(st.next || st.finish);
  nx.textContent = st.finish ? 'Done' : 'Next';
  $('coachback').hidden = tut.i === 0;
  document.querySelectorAll('#answers button').forEach(b=>{ b.disabled = false; b.setAttribute('aria-disabled', st.ask ? 'false' : 'true'); });   // nothing to call: dimmed, and a tap points at Next
  $('answers').classList.toggle('tutoff', !st.ask);
  draw(S.answered); updateControls();
}
function startTut(lesson){
  $('hlogo').classList.remove('hot','over');
  endFlash(); $('startcover').hidden = true;
  tut.on = true; tut.i = 0; tut.shots = []; tut.started = tut.started0 = false; tut.lesson = LESSONS[lesson] ? lesson : 'shoot';
  cancelAnimationFrame(routineRaf); renderRoutineChip(); renderShootControls();
  $('coach').hidden = false;
  showSessIdle(); runStep();
  $('coach').scrollIntoView({block:'nearest'});
}
function endTut(){
  setTimeout(syncStreakPill, 0);   // the streak comes back to the logo after the lesson
  tut.on = false; tut.fix = null; $('answers').classList.remove('tutoff'); document.querySelectorAll('#answers button').forEach(b=>b.removeAttribute('aria-disabled')); tut.zb = tut.zt = 0; tut.ctl = null; tut.plan = null; tut.watch = null; cancelAnimationFrame(tut.bRaf); cancelAnimationFrame(tut.zRaf); cancelAnimationFrame(tut.gRaf); if(S.shot && S.shot.gb0){ S.shot.gb = S.shot.gb0; S.shot.v = S.shot.v0; } clearTimeout(tut.fadeT); $('tutfade').classList.remove('on');
  if(!settings.tut){ settings.tut = 1; saveSettings(); }
  settings.tutSeen = {...(settings.tutSeen || {}), [tut.lesson]: 1}; saveSettings();
  $('coach').hidden = true;
  deal();
}
// the looking-around steps: done once you've done it (Next still skips), then on to the next step
export function tutLook(kind, id){
  if(!tut.on) return;
  const st = tstep(); if(!st || !st.look || tut.lk === 2) return;
  const done = st.look === 'drag' ? kind === 'drag' && pivot.id === 'c'
    : st.look === 'cb' ? kind === 'swap' && id === 'c'
    : kind === 'swap' ? (tut.lk = id === 'o' ? 1 : 0, false) : kind === 'drag' && tut.lk === 1 && pivot.id === 'o';
  if(!done) return;
  tut.lk = 2;
  setTimeout(()=>{ if(tut.on && tstep() === st) tutNext(); }, 700);
}
function tutNext(){
  const st = tstep();
  if(st.ask && $('coachnext').hidden) return;   // a call to make, or the right shot still to see
  if(st.finish) return endTut();
  tut.i++; runStep();
}
function tutBack(){
  if(!tut.on || tut.i === 0) return;
  tut.i--; runStep(true);
}
// a try: your shot with the lesson's stroke. Call a fraction to get down on its line, the same one again to shoot.
function tutTry(id){
  const s = S.shot, c = s.cam, pl = tut.plan;
  if(S.answered || !pl || (c && c.moving)) return;
  if(!(c && c.phase === 'down' && c.k >= 1 && s.aimId === id)){
    const go = () => { s.aimId = id; s.aimDir = aimDirFor(s, id); markAim(s); s.cam = null; c2(); };
    const c2 = () => { const cc = {phase: 'stand', k: 0, T: NO_TIMER, tutDown: true, moving: true}; s.cam = cc; tutBend('step', 450, ()=>tutBend('down', downMs(s) + 150, ()=>{ cc.moving = false; tutSettle(); })); };
    if(c && c.phase === 'down' && c.k > 0){ c.moving = true; tutBend('up', 400, go); } else go();
    return;
  }
  const stroke = {V: pl.V, tip: pl.tip}, sq = tutSq(tstep()), needDir = tutAim(tstep(), s, stroke, sq), right = nearestRef(cutForDir(s, needDir));
  const picked = ALL.find(r=>r.id === id) || right, ok = picked.id === right.id, dir = ok ? needDir : dirForCut(s, picked.deg);
  const run = playAim(s, dir, stroke, true, sq), x0 = rigAlpha(s).push || 0;
  S.answered = true; s.tip = pl.tip; cancelAnimationFrame(featherRaf);
  s.pick = {made: run.made, far: !ok, g2: (!ok && tutContactAt(run)) || s.gb, id};
  document.querySelectorAll('#answers button').forEach(x=>{ x.disabled = true; x.className = x.dataset.id === id ? (ok && run.made ? 'right' : run.made ? 'also' : 'wrong') : x.dataset.id === right.id ? 'right' : ''; });
  const good = ok && run.made && !run.scratch, st = tstep();   // the stroke and spin are the lesson's: only the call can be wrong
  const note = good ? (!s.zone ? 'Pocketed.' : run.inZone ? 'Pocketed, and <b>in the zone</b>.' : `Pocketed, ${run.zoneMiss.toFixed(1)}″ off the zone.`)
    : (ok ? (run.scratch ? 'Scratch: the cue ball went in.' : 'Missed the pocket.') : `That was <b>${tutLab(picked)}</b>; this one is <b>${tutLab(right)}</b>.`) + ' Watch it played right.';
  const nc = good ? rcls(ballVerdict(run, s.zone).good) : rcls(false);   // the note in its own colour
  $('coachtext').innerHTML = st.text + `<br><span class="coachnote ${nc}">${RICON[nc] || ''}${note}</span>`;
  if(good || tut.seen){ $('coachnext').hidden = false; $('coachnext').textContent = 'Next'; } else $('coachnext').hidden = true;
  strokeThen(s, x0, ()=>{
    if(S.shot !== s || !tut.on) return;
    animateShot({made: run.made}, ()=>{ draw(true); tutBend('up', 600); if(!good) tutShowRight(st, right); }, ok && run.made ? '#ffd34d' : MISS, run);
    const up = rigHitMs(s, run, dir); if(isFinite(up)) setTimeout(()=>{ if(S.shot === s && s.cam && s.cam.k > 0) tutBend('up', 450); }, up);   // out of a ball's way
  });
}
function tutAnswer(id){
  const st = tstep();
  if(!st.ask) return;   // nothing to call on this step
  if(tut.fix) return;   // the right shot is being shown
  if(st.try) return tutTry(id);
  if(S.answered) return;
  const right = id === S.shot.answer.id;
  S.answered = true;
  if(settings.animate === '0') tableSounds(shotPlan(S.shot, right ? outcome(S.shot, S.shot.theta) : outcome(S.shot, ALL.find(r=>r.id===id).deg), .12, .3, 0, false, false));
  document.querySelectorAll('#answers button').forEach(x=>{ x.disabled = true; x.className = x.dataset.id===S.shot.answer.id ? 'right' : x.dataset.id===id ? 'wrong' : ''; });
  const picked = ALL.find(r=>r.id===id), oc = outcome(S.shot, picked.deg);
  S.shot.pick = {...oc, id, far: !right};
  const lab = S.shot.answer.id==='full' ? 'full' : S.shot.answer.label;
  const fix = !right && st.ask !== 'any';   // a step with a shot to call right: a wrong call shows you the right one, then it's yours again
  $('coachtext').innerHTML = right ? `Right: a <b>${lab}</b>-ball hit. Watch it go.` : fix ? st.text + `<br><span class="coachnote">${RICON.no}That was <b>${tutLab(picked)}</b>; this one is <b>${lab}</b>: the ghost ball covers ${lab==='full' ? 'all' : lab} of it. Watch it played right.</span>`
    : `It was a <b>${lab}</b>-ball hit: the ghost ball covered ${lab==='full' ? 'all' : lab} of it.`;
  if(!fix || tut.seen){ $('coachnext').hidden = false; $('coachnext').textContent = 'Next'; } else $('coachnext').hidden = true;
  const after = () => { draw(true); if(fix) tutShowRight(st, S.shot.answer); };
  if(settings.animate !== '0') animateShot(right ? outcome(S.shot, S.shot.theta) : oc, after, right ? '#ffd34d' : MISS);
  else after();
}
// labels, arrows and the lit-up overlap, drawn over the table
export function tutLayer(cam, s, reveal){
  if(!tut.on || reveal || s.anim) return '';
  const st = tstep(); let o = '';
  const scr = P3 => { const c = cam.toCam(P3); return c[2] > NEAR ? [...cam.proj(c), cam.focal*R/c[2]] : null; };
  const halo = 'stroke="#000" stroke-width="3.5" paint-order="stroke" stroke-linejoin="round"';
  // labels: placed one by one around their target, never overlapping each other, a ball, or the edge of the view
  const FS = 13, targets = [], placed = [];
  const want = [];
  for(const l of st.labels || []){
    if(l==='pocket') want.push([[s.P.c[0], s.P.c[1], 1.6], 'pocket']);
    if(l==='ob') want.push([[s.ob[0], s.ob[1], R], 'object ball']);
    if(l==='cb') want.push([[s.cb[0], s.cb[1], R], 'cue ball']);
    if(l==='ghost') want.push([[(s.gbLook || s.gb)[0], (s.gbLook || s.gb)[1], R], 'ghost ball']);
    if(l==='line') want.push([[(s.cb[0]+s.gb[0])/2, (s.cb[1]+s.gb[1])/2, .03], 'guide line']);
  }
  want.forEach(([P3, t])=>{ const p = scr(P3); if(p) targets.push({x:p[0], y:p[1], r:Math.max(p[2], 6), t}); });
  const hits = (bx) => placed.some(q => bx.x0 < q.x1 + 6 && bx.x1 > q.x0 - 6 && bx.y0 < q.y1 + 4 && bx.y1 > q.y0 - 4)
    || targets.some(t => t.x > bx.x0 - t.r - 4 && t.x < bx.x1 + t.r + 4 && t.y > bx.y0 - t.r - 4 && t.y < bx.y1 + t.r + 4);
  for(const t of targets){
    const w = t.t.length*FS*0.58, h = FS*1.2;
    let best = null;
    for(const dist of [44, 64, 90]) for(const ang of [-135,-45,-160,-20,135,45,180,0,-90,90]){
      const cx = t.x + Math.cos(ang*RAD)*(t.r + dist), cy = t.y + Math.sin(ang*RAD)*(t.r + dist);
      const bx = {x0: cx - w/2, x1: cx + w/2, y0: cy - h/2, y1: cy + h/2, cx, cy};
      if(bx.x0 < 6 || bx.x1 > VW - 6 || bx.y0 < 6 || bx.y1 > VH - 6 || hits(bx)) continue;
      best = bx; break;
    }
    if(!best) continue;
    placed.push(best);
    // leader: from the label's edge to just short of the target
    const a = Math.atan2(t.y - best.cy, t.x - best.cx), k = Math.min(Math.abs((w/2+3)/(Math.cos(a)||1e-6)), Math.abs((h/2+3)/(Math.sin(a)||1e-6)));
    const sx = best.cx + Math.cos(a)*k, sy = best.cy + Math.sin(a)*k, ex = t.x - Math.cos(a)*(t.r + 4), ey = t.y - Math.sin(a)*(t.r + 4);
    o += `<line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="#fff" stroke-width="1.5"/><circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="2.5" fill="#fff"/>
      <text x="${best.cx.toFixed(1)}" y="${(best.cy + FS*0.36).toFixed(1)}" text-anchor="middle" font-size="${FS}" font-weight="700" font-family="IBM Plex Sans, sans-serif" fill="#fff" ${halo}>${t.t}</text>`;
  }
  if((st.labels || []).includes('drag')) o += `<text x="${VW/2}" y="${VH-28}" text-anchor="middle" font-size="15" font-weight="700" font-family="IBM Plex Sans, sans-serif" fill="#fff" ${halo}>⟵ drag to look around ⟶</text>`;
  if(st.overlap && tut.zb > 0.99){
    const g = scr([(s.gbLook || s.gb)[0], (s.gbLook || s.gb)[1], R]), b = scr([s.ob[0], s.ob[1], R]);
    if(g && b) o += `<clipPath id="tovl"><circle cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}" r="${b[2].toFixed(1)}"/></clipPath>
      <circle cx="${g[0].toFixed(1)}" cy="${g[1].toFixed(1)}" r="${g[2].toFixed(1)}" fill="#ffd34d" fill-opacity=".6" clip-path="url(#tovl)"/>
      <text x="${b[0].toFixed(1)}" y="${(Math.min(g[1], b[1]) - Math.max(g[2], b[2]) - 14).toFixed(1)}" text-anchor="middle" font-size="16" font-weight="700" font-family="IBM Plex Sans, sans-serif" fill="#fff" ${halo}>covered = the fraction</text>`;
  }
  return o;
}
$('help').addEventListener('click', ()=>openTutMenu(true));
$('tutmenuclose').addEventListener('click', ()=>openTutMenu(false));
$('tutmenu').addEventListener('click', e=>{ const b = e.target.closest('[data-lesson]'); if(b){ openTutMenu(false); startTut(b.dataset.lesson); } else if(e.target === $('tutmenu')) openTutMenu(false); });
$('coachnext').addEventListener('click', ()=>tutNext());
$('coachback').addEventListener('click', ()=>tutBack());
$('coachskip').addEventListener('click', ()=>endTut());

$('cog').addEventListener('click', ()=>openMenu(true));
function openProg(v){ if(v) renderProgress(); $('prog').hidden = !v; if(v){ $('progclose').focus({preventScroll:true}); const h = $('ladder').querySelector('.here'); if(h) h.scrollIntoView({block:'center'}); } else $('badge').focus({preventScroll:true}); }
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
function easterEggSkips(){   // the first-run steps marked done (before the first deal, so no lesson starts)
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
function easterEggCheck(){
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
$('radio').addEventListener('click', e=>{ e.stopPropagation(); applySetting('music', STATIONS[(STATIONS.indexOf(settings.music) + 1) % STATIONS.length]); });
['pointerdown'].forEach(t=>$('radio').addEventListener(t, e=>e.stopPropagation()));
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

if(!['stand','down'].includes(settings.view)) settings.view='stand';
if(!['stand','down'].includes(settings.flashView)) settings.flashView='stand';
settings.mode = 'ref';   // reference cuts only for now
if(!['line','aim'].includes(settings.cam)) settings.cam='line';
if(!['short','long','both'].includes(settings.len)) settings.len='both';
if(!['0','1'].includes(settings.ghost)) settings.ghost='0';
if(!['0','1'].includes(settings.line)) settings.line='0';
if(!['0','1'].includes(settings.walk)) settings.walk='1';
if(!settings.sv5){ settings.walk = '1'; settings.sv5 = 1; }   // looking around used to lock at A-: give it back
if(hasBaseline() && !stats.level){ const b = baselines()[0], g0 = gradeFor(pct(b.right, b.n)); stats.level = {g: g0, best: g0, pts: 0, v: 2}; save(); }   // baselines played before grades existed
if(!stats.level){ stats.level = {g: 0, best: 0, pts: 0, v: 2}; save(); }   // no baseline any more: everyone starts at F
if(stats.level.g > GRADES.length-1 || (stats.level.best ?? 0) > GRADES.length-1){ stats.level.g = Math.min(stats.level.g, GRADES.length-1); stats.level.best = Math.min(stats.level.best ?? 0, GRADES.length-1); save(); }   // the Read ladder now ends at A
if(stats.level && !stats.level.v){   // grades gained F at the bottom and S at the top: shift everything up one
  stats.level.g += 1; stats.level.best = stats.level.g; stats.level.v = 2;
  (stats.sessions||[]).forEach(x=>{ if(x.grade!=null) x.grade += 1; if(x.g0!=null) x.g0 += 1; });
  save();
}
enforceLocks(); renderBadge();
wireShootControls();
wireStance();
// players: your name (edit to rename), and back to the picker
// the player dropdown, before the grade: switch player, add one, rename
export function renderPlMenu(){
  const full = PL.list.length >= PL_MAX;
  $('plchipname').textContent = S.ME.name;
  $('plmenu').innerHTML = PL.list.map(p=>`<button role="menuitem" data-pl="${p.id}"${p.id === S.ME.id ? ' aria-current="true"' : ''}><span>${plEsc(p.name)}</span><small>${plGrade(p.id)}</small></button>`).join('')
    + '<hr>' + (full ? '' : '<button role="menuitem" data-plact="new">New player…</button>') + '<button role="menuitem" data-plact="rename">Rename…</button><button role="menuitem" data-plact="manage">Manage players…</button><button role="menuitem" data-plact="backup">Back up / Restore…</button>';
}
export const plOpen = v => { $('plmenu').hidden = !v; $('plchip').setAttribute('aria-expanded', v); if(v) renderPlMenu(); };
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
wireBackup();
// first launch: set where you stand before anything else
function closeStance(){ settings.stanceSet = 1; saveSettings(); askPersist(); $('stancecover').hidden = true; showSessIdle(); if(!settings.tourSeen && startTour(true)) return; deal(); }
$('stancedone').addEventListener('click', e=>{ e.stopPropagation(); closeStance(); });
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
if(!['0','1'].includes(settings.sound)) settings.sound='1';
if(!['0','1'].includes(settings.uiSound)) settings.uiSound='1';
if(!['0','1'].includes(settings.haptic)) settings.haptic='1';
$('hapticopt').hidden = !navigator.vibrate;   // only where the device can vibrate (not iOS Safari)
if(!['0','1'].includes(settings.animate)) settings.animate='1';
if(!['0','1'].includes(settings.streaks)) settings.streaks='1';
if(!['0','1'].includes(settings.fps)) settings.fps='0'; fpsStart();
['refPath','refTrail','refGhost','refMiss','refStart'].forEach(k=>{ if(!settings.sv6 || !['0','1'].includes(settings[k])) settings[k] = '1'; });   // on by default (once, for everyone: they'd been off for some)
settings.sv6 = 1;
if(!['R','L'].includes(settings.hand)) settings.hand='R';
if(!['open','closed'].includes(settings.bridge)) settings.bridge = 'open';
if(!LOOK_AT.tstyle[settings.tstyle] && settings.tstyle !== 'bar') settings.tstyle = 'bar';   // new players start on Bar
if(!('flashTable' in settings)){   // one table pick became two: your old pick is now the Flash table; the Ladder plays its grade's table until S
  settings.flashTable = settings.tablePick;
  if(!ladderPickOpen()) settings.tablePick = null;
}
if(!['7','8','9'].includes(settings.flashTable) || !tableUnlocked(settings.flashTable)) settings.flashTable = gradeTable(ladderBest());   // not opened yet: the biggest table you've reached
if(!['7','8','9'].includes(settings.tablePick)) settings.tablePick = null;   // the Ladder's own pick (from S); none: the grade's table
if(!BALL_SETS[settings.ballSet]) settings.ballSet = 'standard';
for(const k of ['tstyle', 'ballSet']) if(!lookOpen(k, settings[k])) settings[k] = bestLook(k);   // not opened yet (or reset): the best one you have
if(!['maple','carbon'].includes(settings.shaft)) settings.shaft = 'maple';
if(!['stand','down'].includes(settings.flashView)) settings.flashView = 'stand';
applyStyle();
applyGfx();
if(stats.shoot){ const top = SHOOT_GRADES.length - 1; stats.shoot.best = Math.min(stats.shoot.best ?? 0, top); stats.shoot.g = Math.min(Math.max(stats.shoot.g, stats.shoot.best), top); }   // S+ is gone: anyone there is at S
setTimeout(libIdle, 3000);   // start filling the shot library once the page has settled   // grades only go up now: back to your best
// ---------- mode setup: one sheet for Flash, Practice and Run-outs ----------
// Opened from the mode's button and from the pill at the foot of the table. Every pick is saved as it's made; what changed
// is applied when the sheet closes (a shot you've already played keeps its result, and the next one follows the new picks).
const SHEETS = {};   // id -> {render, snap, changed, open, back}
let sheetFrom = null, sheetWas = '';
const sheetOpen = () => Object.keys(SHEETS).find(id=>!$(id).hidden) || null;
function openSheet(id, v){
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
window.addEventListener('keydown', e=>{   // while a sheet is up, keys stay in it: Esc closes, Tab goes round it
  const id = sheetOpen(); if(!id) return;
  e.stopPropagation();
  if(e.key === 'Escape'){ e.preventDefault(); openSheet(id, false); return; }
  if(e.key === 'Tab'){
    const f = [...$(id).querySelectorAll('button')].filter(b=>!b.disabled && b.getClientRects().length), i = f.indexOf(document.activeElement);
    if(f.length){ e.preventDefault(); f[(i + (e.shiftKey ? f.length - 1 : 1) + f.length) % f.length].focus(); }
  }
}, true);
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
wireSheet('drill', {render: renderDrill, snap: ()=>JSON.stringify(drillPicks()), back: ()=>$('task-practice'),
  changed: ch=>{ if(ch && isDrill()){ nextShot0 = null; if(shotIdle()) deal(); } }});   // a new shot to the new picks
export const openDrill = v => openSheet('drill', v);
$('drillweak').addEventListener('click', ()=>setDrill('weak'));
$('drill-fr').addEventListener('click', e=>{ const b = e.target.closest('[data-fr]'); if(b) setDrill('fr', b.dataset.fr); });
document.querySelectorAll('#drill [data-drill]').forEach(g=>g.addEventListener('click', e=>{ const b = e.target.closest('button[data-v]'); if(b && !b.classList.contains('locked')) setDrill(g.dataset.drill, b.dataset.v); }));
// Flash: its picks are settings (data-set buttons), applied as they're tapped; opening the sheet mid-shot stops the clock,
// and closing it leaves the table covered with one Start, ready to go
wireSheet('flashsheet', {render: syncPressed, back: ()=>$('task-flash'),
  open: ()=>{ if(settings.task === 'flash' && stats.active && stats.active.task === 'flash' && !S.answered){ S.flashArmed = false; showStart(); } },
  changed: ()=>{ if(settings.task === 'flash' && !$('startcover').hidden) showStart(); renderModeChip(); }});
// Run-outs
function setRun(k, v){ const d = runPicks(); d[k] = v; settings.run = d; saveSettings(); renderRunSheet(); renderModeChip(); }
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
wireSheet('runsheet', {render: renderRunSheet, snap: ()=>JSON.stringify(runPicks()), back: ()=>$('task-run'),
  changed: ch=>{ if(ch && isRun()){ S.RUN = null; if(shotIdle()) deal(); } }});   // a new rack to the new picks
document.querySelectorAll('#runsheet [data-run]').forEach(g=>g.addEventListener('click', e=>{ const b = e.target.closest('button[data-v]'); if(b && !b.classList.contains('locked')) setRun(g.dataset.run, b.dataset.v); }));
$('modechip').addEventListener('click', e=>{ e.stopPropagation(); modeChipTap(); });
renderModeChip();
// Run-outs, the call: taps on the targets over the table (where two overlap, the one whose centre is nearest), the arrows round them
function runPickTap(b){ if(!b) return; if(b.dataset.ball) runTapBall(+b.dataset.ball); else if(b.dataset.pocket) runTapPocket(+b.dataset.pocket); }
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
// background music: off to start; it can only begin after a tap or key (browsers block sound before that)
if(!['off','parlor','smoke','felt'].includes(settings.music) || (settings.musicV | 0) < 2){ settings.music = 'off'; settings.musicV = 2; }   // music off by default (once, for everyone); the radio turns it on
renderRadio();
if(!(+settings.musicVol >= 0 && +settings.musicVol <= 100) || (settings.musicVolV | 0) < 2){ settings.musicVol = 20; settings.musicVolV = 2; }   // 20% for everyone, once (then it's yours)
$('musicvol').value = settings.musicVol; $('musicvolval').textContent = settings.musicVol + '%';
if(window.Music) Music.setVolume(settings.musicVol/100);
$('musicvol').addEventListener('input', e=>{ settings.musicVol = +e.target.value; $('musicvolval').textContent = settings.musicVol + '%'; saveSettings(); if(window.Music) Music.setVolume(settings.musicVol/100); });
const startMusic = () => { if(!window.Music || settings.music === 'off') return; if(Music.playing()) Music.resume(); else Music.play(settings.music); };
startMusic();   // straight away where the browser allows it; otherwise it waits, and the first tap or key starts it
['pointerdown', 'keydown'].forEach(t=>window.addEventListener(t, startMusic, {capture: true, passive: true}));   // capture: the tour and other cards stop their taps, but not this
if(!(+settings.rigOpacity >= 50 && +settings.rigOpacity <= 100) || (settings.rigOpV || 0) < 2){ settings.rigOpacity = 100; settings.rigOpV = 2; }   // solid by default (once for everyone); see-through is a setting
$('rigoprange').value = settings.rigOpacity; $('rigopval').textContent = settings.rigOpacity + '%';
$('rigoprange').addEventListener('input', e=>{ settings.rigOpacity = +e.target.value; $('rigopval').textContent = settings.rigOpacity + '%'; saveSettings(); if(S.shot) draw(S.answered); });
if(!isHex(settings.glove)) settings.glove = GLOVE_DEF;
if(!isHex(settings.skin)) settings.skin = HAND_DEF;
const COLOR_INPUTS = {glove: ['glovecolor', 'st-glove'], skin: ['skincolor', 'st-skin']};   // Settings and the first-launch card
Object.entries(COLOR_INPUTS).forEach(([k, ids])=>ids.forEach(id=>{ $(id).value = settings[k]; $(id).addEventListener('input', e=>{
  settings[k] = e.target.value; ids.forEach(j=>{ if(j !== id) $(j).value = settings[k]; }); saveSettings(); if(S.shot) draw(S.answered);
}); }));
settings.throw='0';   // throw option removed
settings.table = progTable();   // not a setting: the Ladder's table (grade, or tablePick from S) or the Flash table (flashTable)
if(stats.active){ stats.active.size = RUN_SIZE; delete stats.active.base; }   // a session left open from before just carries on as the run
settings.pockets = 'std';   // pockets fixed at 4.5″: with reference cuts only, pocket size never changed a result
setTable(settings.table, settings.pockets);
if(!settings.sv) settings.sv=2;
settings.full = '1';   // full-ball shots always come up (rarely): no longer a setting
settings.view = 'stand';   // the view isn't a setting any more: you start standing, and the routine takes you down
if(settings.task==='call') settings.task = 'sess';   // Freeplay and Sessions merged: Freeplay is now played in sessions
if(settings.task === 'free') settings.task = 'shoot';   // Free play was retired
if(!['flash','shoot','practice','run'].includes(settings.task) || (settings.task==='flash' && !flashUnlocked()) || (settings.task==='practice' && !practiceUnlocked()) || (settings.task==='run' && !runUnlocked())) settings.task = 'shoot';   // one ladder: Sessions are shooting
if(!settings.sv4){ stats.log.forEach(e=>{ if((e.t||'call')==='call') e.t = 'sess'; }); settings.sv4 = 1; save(); }   // old Freeplay shots join the new Freeplay
if(stats.log.some(e=>e.t==='aim' || e.t==='tt')){ stats.log = stats.log.filter(e=>e.t!=='aim' && e.t!=='tt'); save(); }   // Aim and Thick/Thin were tried and dropped
// one-time move: sessions played before Sessions became its own mode now belong to it
if(!settings.sv3){
  stats.log.forEach(e=>{ if(e.sid && (e.t||'call')==='call') e.t = 'sess'; });
  (stats.sessions||[]).forEach(x=>{ if(x.task==='call') x.task = 'sess'; });
  if(stats.active && stats.active.task==='call') stats.active.task = 'sess';
  settings.sv3 = 1; save();
}
if(!['1500','750'].includes(settings.flash) || (settings.flash === '750' && fastFlashLocked())) settings.flash = '1500';
saveSettings();
syncPressed();
renderStats();
sizeTable();
if(location.hash === '#test' || DEV) window.__lib = {NO_EIGHTH, LIB_STEPS, ZONE_STEPS, tableFor, libVer, parseShipped, fromLibrary, shippedOk, dealtOk: (s, k)=>{ if(!s.zone){ const q = strikeOf(s), st = +k === SH.throw ? throwStroke(s) : {V: q.V, tip: [0, q.b]}, r = playAim(s, aimFor(s, st), st, false); return r.made && !r.scratch; } const st = {V: STROKE_MPH[s.zone.lvl]*MPH, tip: s.zone.tip}, r = playAim(s, aimFor(s, st), st, false); return r.made && !r.scratch && r.inZone; }, setShipped: x=>{ setShipped(x); }, isZoneStep, shotOf, zoneSpotOk, handRoomMax: s=>{ const g0 = GEN.g; GEN.g = 0; try{ return handRoom(s); } finally { GEN.g = g0; } }, makeRec, encodeRec, decodeRec, recOk, REC, setTable: (t)=>{ setTable(t, settings.pockets); }, curTable: ()=>curTable, reachOf, reachMax, obRunOk, obRunMax, scaleRec, setHeight: cm=>{ settings.heightCm = cm; },
  // deal as the game would at a grade and table (task 'shoot' or 'flash'), with the reach it gives
  drillDeal: ()=>drillDeal(),   // Practice: a deal to the saved picks
  testDeal: (task, g, t)=>{ const sh = ensureShootLevel(), g0 = sh.g, t0 = settings.task; sh.g = g; settings.task = task; try{ setTable(t, settings.pockets); const s = task === 'flash' ? dealShot() : addExtras(shootDeal()); return {s, reach: reachOf(s), max: reachMax(), tb: curTable}; } finally { sh.g = g0; settings.task = t0; } },
  // Run-outs: the rack as it stands, a fresh one, and the game's own deal, call and shoot (the shot plays out at once, no animation)
  run: {state: ()=>S.RUN, newRack: ()=>{ newRack(); return S.RUN; }, pick: runPick, picks: runPicks, setRun, stage: ()=>runStage(), tapBall: runTapBall, tapPocket: runTapPocket, quit: runQuit, right: ()=>rightIdFor(S.shot), after: runAfterShot, look: ()=>({k: look.k, target: look.target}), walk: ()=>S.walk, shotAt: (cb, b, Pi, others)=>runShot(cb, b, POCKETS[Pi], others), rig: (s, view)=>{ s.cam = {phase: 'down', k: 1, T: 1, downAt: performance.now()}; const cam = shootCam(s, view || 'down'), u = bridgeAim(s), st = shotStroke(s); return {E: cam.E, f: cam.f, u, tip: st.tip, bg: bridgeGeom(s, u, st.tip[1]), svg: cueRig(cam, s)}; }, done: runPlanDone, undo: runUndoPlan, change: runChange, back: runChangeBack, check: runCallCheck, allowed: ()=>runAllowed(S.RUN.balls), target: ()=>runTarget(), shot: ()=>S.shot, answered: ()=>S.answered, deal: ()=>{ deal(); return S.shot; }, take: id=>{ takeShot(id); return S.shot; }, finish: ()=>{ if(S.anim) finishAnim(); return !cueStroke && !S.anim; }, settings, stats, applySetting, runFoul},
  // how wide the cue ball and object ball are drawn (in drawing units, VW wide) standing, or in the look view
  camPx: (s, view)=>{ s.cam = {phase: 'stand', k: 0}; const c = view === 'look' ? overviewCam(s) : shootCam(s, view); return [s.cb, s.ob].map(p=>{ const q = c.toCam([p[0], p[1], R]); return q[2] > 0 ? 2*R*c.focal/q[2] : 0; }); }, setVH: h=>{ setVH(h); }, cheer: (n, first)=>{ cheer(n, first); }, cheerNow: ()=>cheerGo(), confetti: (n, f)=>confetti($('hlogo'), n, f), cheerLive: ()=>!!cheerFx || !!cheerQ};
if(!TEST) easterEggSkips();   // the Efren Reyes easter egg: no stance card, tour, lessons or What's new card (defaults stand)
if(!settings.stanceSet && !settings.tut && !(stats.log || []).length && !baselines().length){ $('stancecover').hidden = false; showSessIdle(); }   // a new player sets their stance first
deal();
if(!$('stancecover').hidden && S.shot){ S.shot.bare = true; lockCalls(true); draw(false); }   // ...at an empty table (it still follows their stance): no balls, and nothing to call until the first lesson
syncStreakPill(); requestAnimationFrame(alignLogo);
if(!settings.tut && !(stats.log || []).length && !baselines().length){ settings.tut = 1; saveSettings(); }   // first visit: the Shooting lesson opens on the first shot
// ---------- keyboard shortcuts: ? or the Help menu; keys stay in the card while it's up, Esc or ? closes it ----------
let keysFrom = null;
function openKeys(v){
  if(v === !$('keys').hidden) return;
  if(v){ keysFrom = document.activeElement; $('keys').hidden = false; $('keysbody').scrollTop = 0; $('keysok').focus({preventScroll: true}); return; }
  $('keys').hidden = true;
  const f = keysFrom && keysFrom.isConnected && keysFrom !== document.body && !keysFrom.closest('[hidden]') ? keysFrom : $('help'); keysFrom = null;
  try{ f.focus({preventScroll: true}); }catch(e){}
}
$('keysopen').addEventListener('click', e=>{ e.stopPropagation(); openTutMenu(false); openKeys(true); keysFrom = $('help'); });
$('keysok').addEventListener('click', e=>{ e.stopPropagation(); openKeys(false); });
['click', 'pointerdown'].forEach(t=>$('keys').addEventListener(t, e=>{ e.stopPropagation(); if(t === 'click' && e.target === $('keys')) openKeys(false); }));
window.addEventListener('keydown', e=>{
  if($('keys').hidden) return;
  e.stopPropagation();
  if(e.key === 'Escape' || e.key === '?'){ e.preventDefault(); openKeys(false); }
  else if(e.key === 'Tab'){ e.preventDefault(); (document.activeElement === $('keysok') ? $('keysbody') : $('keysok')).focus(); }
}, true);
// ---------- What's new (the list, WHATS_NEW, is near the top): a dot on ? while there's something unseen, the card once ----------
const wnVer = e => '1.' + e.build;   // just the build it shipped in
const wnUnseen = () => WHATS_NEW.filter(e=>e.build > settings.notesSeen);
wnFrom = null, wnPoll = 0, wnInput = performance.now();
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
const wnCalm = () => !document.hidden && !tour.on && !tut.on && !callLock && !S.anim && !cueStroke && S.shot && !S.answered && !S.shot.bare
  && settings.task !== 'flash' && performance.now() - wnInput > 1500 && performance.now() - (S.shot.t0 || 0) > 1200
  && ['playercover', 'stancecover', 'menu', 'stylemenu', 'bk', 'tutmenu', 'prog', 'lvup', 'drill', 'flashsheet', 'runsheet', 'plmenu', 'cover', 'startcover', 'ask', 'keys'].every(id=>!$(id) || $(id).hidden);
if(!TEST) easterEggCheck();   // a special player (a new one, or one renamed on an earlier visit)
if(!TEST){
  wnSync();
  if(wnUnseen().length) wnPoll = setInterval(()=>{ if(wnCalm()) openWhatsNew(true); }, 1000);
}
if(settings.stanceSet || stats.log.length) askPersist();   // already playing: ask now (once)
if(!TEST){ let r = null; try{ r = sessionStorage.getItem(lsKey('halfball-restored')); sessionStorage.removeItem(lsKey('halfball-restored')); }catch(e){}
  if(r){ openBackup(null); bk.view = 'done'; bk.msg = `Restored from your backup. ${S.ME.name}: ${statsGrade(stats)} · ${bkShots(stats).toLocaleString()} shots.`; bk.tone = 'ok'; bkRender(); bkFocus(); } }
