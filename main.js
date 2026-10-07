// Entry point: loads the player, then wires everything up in the order the game always ran it.
import {$, add, ALL, BOUNDS, boundsFor, CORE, curTable, dot, engineTable, f2, H, initTable, IS_PHONE, kt, len, matVec, MISS, mul, NEAR_MISS_OK, norm, OB_COLORS, PE, pick, PK, pocketEdge, pocketR, POCKETS, R, RAD, rayToCushion, REFS, rot, setBounds, setRefs, setTable, sub, tableBox, TIP_STEP, touchMode, W, wireInputMode} from './geom.js';
import {CONTACT, notesTop, SOURCE, VERSION, WHATS_NEW} from './whatsnew.js';
import {GRADE_STEP, gradeOf, SH, stepOf} from './steps.js';
import {afterPick, askPersist, bk, bkFocus, bkRender, bkShots, curStreak, initNotesSeen, laterSave, lean, loadPicked, loadProfiles, loadSettings, loadStats, look, openBackup, pct, PL, PL_MAX, playAs, plEsc, plGrade, plKey, S, save, savePL, saveSettings, sessTask, settings, SHOOT_GRADES, SHOOT_V, stats, statsGrade, statTask, STREAK_HOT, success, TEST, tour, trimLog, tut, wireBackup} from './state.js';
import {DEV, fpsStart, PERF, wireDevTools} from './perf.js';
import {cheer, cheerFx, cheerGo, cheerQ, confetti, cutSounds, playSound, shotPlan, showStreak, tableSounds, uiSound, wireAudio, wireButtonSounds} from './audio.js';
import {addLookUnlocks, aidAlpha, baselines, CARBON_AT, carbonUnlocked, ctrl, ctrlAt, DRILL_FR, drillLevel, drillPicks, enforceLocks, ensureShootLevel, FAST_FLASH_GRADE, fastFlashLocked, FLASH_AT, flashTableNow, flashUnlocked, FOCUS_AT, GEN, gradeFor, GRADES, gradeTable, hasBaseline, isDrill, isLadder, isRun, isShoot, isShooting, LADDER_PICK_AT, ladderBest, ladderPickOpen, ladderTable, myShaft, NO_TIMER, PRACTICE_AT, practiceUnlocked, practicing, progTable, PT_RIGHT, PT_WRONG, PTS_UP, RUN_AT, runUnlocked, shaftSq, SHOOT_TEXT, SHOOT_UP, shootAid, shootLevel, shootRoutine, stanceAim, standTime, stepGrade, TABLE_AT, tableUnlocked, tableUp, unlIcon, unlocksBetween} from './grades.js';
import {addExtras, bridgeLen, CB_DOTS, cbSpin, dealShot, decodeRec, drillDeal, encodeRec, fetchShipped, fromLibrary, generate, handRoom, isZoneStep, LIB_STEPS, libIdle, libVer, makeRec, nearestRef, newRack, NO_EIGHTH, obRunMax, obRunOk, parseShipped, pocketSpeedFor, pocketTol, railBehind, reachMax, reachOf, REC, recOk, renderRun, renderRunPick, rotAxis, runAfterShot, runAllowed, runCallCheck, runChange, runChangeBack, runDeal, runFoul, runPick, runPickCard, runPicking, runPicks, runPlanDone, runQuit, runShot, runStage, runSummary, runTapBall, runTapPocket, runTarget, runUndoPlan, scaleRec, setShipped, SHIPPED, shippedOk, shootDeal, shotOf, stanceIn, STOP_R, tableFor, throwStroke, ZONE_STEPS, zoneSpotOk} from './deal.js';

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

// ---------- speed ----------
// Diamonds: how far a rolling cue ball struck that hard would roll (a diamond is an eighth of the table's length).
const diamond = () => Math.max(W, H)/8;
export const diamondsFromSpeed = V => V*V/(2*PE.C.rollDecel*diamond());
const speedLevel = () => { const n = +settings.speedLevel, v = n >= 1 && n <= 10 ? Math.round(n) : 5; return nearestCoarse(v); };
// The four strokes as cue ball speeds, from typical published speeds: ¼ a touch shot (1.5 mph, under a table length),
// ½ a lag (3.5 mph, about 2 lengths), ¾ medium (7 mph, about 3 lengths), the full stroke a power shot (20 mph, about 5 lengths;
// eased to 15 mph, about 4 lengths, for now).
export const MPH = 17.6, STROKE_MPH = {3:1.5, 5:3.5, 8:7, 10:15};   // full stroke eased from a 20 mph power shot to 15 for now
const levelForSpeed = V => COARSE.reduce((b, c)=>Math.abs(Math.log(STROKE_MPH[c]*MPH/V)) < Math.abs(Math.log(STROKE_MPH[b]*MPH/V)) ? c : b, COARSE[0]);

const TIP_STEPS = 2;
const TIP_MAX = .5 + 1e-6;
const clockSteps = pips => 12;   // positions round the clock: the hours, at one pip and at two (no half hours)
const tipXY = (pips, k) => { const n = clockSteps(pips), a = k/n*2*Math.PI; return [+(pips*TIP_STEP*Math.sin(a)).toFixed(4), +(pips*TIP_STEP*Math.cos(a)).toFixed(4)]; };
// a stored tip: one pip in twelfths of the clock, two pips in 24ths (older shots can sit on a half hour)
export const storedTip = (pips, k) => { const a = k/(pips >= 2 ? 24 : 12)*2*Math.PI; return [+(pips*TIP_STEP*Math.sin(a)).toFixed(4), +(pips*TIP_STEP*Math.cos(a)).toFixed(4)]; };
export function tipPolar(t){   // [pips, clock index] nearest to a tip
  const pips = Math.max(0, Math.min(TIP_STEPS, Math.round(Math.hypot(t[0] || 0, t[1] || 0)/TIP_STEP)));
  if(!pips) return [0, 0];
  const n = clockSteps(pips), a = Math.atan2(t[0] || 0, t[1] || 0);
  return [pips, ((Math.round(a/(2*Math.PI)*n) % n) + n) % n];
}
function tipAllowed(pips, k, c){
  if(!pips) return true;
  const n = clockSteps(pips);
  if(c.side) return true;
  return (k === 0 && c.up) || (k === n/2 && c.down);   // 12 o'clock, 6 o'clock
}
export function snapTip(t, c = {up:true, down:true, side:true}){
  const [p, k] = tipPolar(t);
  if(tipAllowed(p, k, c)) return p ? tipXY(p, k) : [0, 0];
  // the nearest allowed point
  let best = [0, 0], bd = Infinity;
  for(const q of tipPoints(c)){ const d = Math.hypot(q[0] - (t[0] || 0), q[1] - (t[1] || 0)); if(d < bd){ bd = d; best = q; } }
  return best;
}
function tipPoints(c){   // every point you can strike, centre first
  const out = [[0, 0]];
  for(let p = 1; p <= TIP_STEPS; p++) for(let k = 0; k < clockSteps(p); k++) if(tipAllowed(p, k, c)) out.push(tipXY(p, k));
  return out;
}
// "Center", "1 pip at 12", "2 pips at 1:30"
function tipName(t){   // in tips, as players say it: a pip is half a 12.5 mm tip ("½ tip of top", "1 tip right", "½ tip at 2 o'clock")
  const [p, k] = tipPolar(t); if(!p) return 'Center';
  const n = clockSteps(p), hrs = k*12/n, h = Math.round(hrs) % 12 || 12, half = Math.abs(hrs - Math.round(hrs)) > .25, amt = p === 1 ? '½ tip' : `${p/2} tip${p > 2 ? 's' : ''}`;
  if(half) return `${amt} at ${Math.floor(hrs) || 12}:30`;   // older stored shots
  return h === 12 ? `${amt} of top` : h === 6 ? `${amt} of draw` : h === 3 ? `${amt} right` : h === 9 ? `${amt} left` : `${amt} at ${h} o'clock`;
}
function nudgeTip(k){   // W up, S down, A left, D right, on the pad as you see it, to the nearest point you can strike that way; X centre
  const c = ctrl(); if(!(c.up || c.side)) return;
  const cur = snapTip(settings.shotTip || [0, 0], c);
  let best = null;
  if(k === 'x') best = [0, 0];
  else {
    const d = {w: [0, 1], s: [0, -1], a: [-1, 0], d: [1, 0]}[k]; if(!d) return;
    let bs = Infinity;
    for(const q of tipPoints(c)){
      const dx = q[0] - cur[0], dy = q[1] - cur[1], along = dx*d[0] + dy*d[1], perp = Math.abs(dx*d[1] - dy*d[0]);
      if(along < .02 || perp > along*1.2) continue;   // that way (within about 50°), not sideways
      const sc = Math.hypot(dx, dy) + 1.5*perp; if(sc < bs){ bs = sc; best = q; }
    }
  }
  if(!best) return;
  settings.shotTip = best; saveSettings(); renderShootControls(); uiSound('tick', (best[1] + 1)/2);
}
// Speed is four strokes: ¼, ½, ¾ and the full stroke.
export const COARSE = [3, 5, 8, 10], COARSE_F = {3:.25, 5:.5, 8:.75, 10:1}, COARSE_LBL = {3:'¼', 5:'½', 8:'¾', 10:'Full'};
const nearestCoarse = n => COARSE.reduce((b, c)=>Math.abs(c - n) < Math.abs(b - n) ? c : b, COARSE[0]);
const strokeFrac = n => COARSE_F[nearestCoarse(n)];   // how much of your full stroke a speed uses
function setSpeedLevel(n){
  const cur = nearestCoarse(speedLevel());   // a one-step nudge moves to the next stroke that way; anything else snaps to the nearest
  n = Math.abs(n - speedLevel()) === 1 ? (n > speedLevel() ? COARSE.find(c=>c > cur) ?? cur : [...COARSE].reverse().find(c=>c < cur) ?? cur) : nearestCoarse(n);
  const was = speedLevel();
  settings.speedLevel = Math.max(1, Math.min(10, n)); saveSettings(); renderShootControls();
  if(speedLevel() !== was) uiSound('tick', speedLevel()/10);   // a tick per step: drag, the ↑ ↓ keys and buttons
}

// ---------- the stroke ----------
// Before speed is yours it's the shot's ideal pocket speed; before spin is yours the tip is set for you.
export function shotStroke(s){
  if(settings.task === 'flash' && !tut.on){ const i = strikeOf(s); return {V: i.V, tip: [0, i.b]}; }   // Flash: the shot's own stroke, pocket speed
  const c = ctrl(), g = shootLevel(), ideal = strikeOf(s);
  const V = c.speed ? STROKE_MPH[speedLevel()]*MPH : ideal.V;
  let tip = g === SH.throw && !isDrill() ? [0, -.35] : [0, ideal.b];   // the throw step plays soft stun for you: that's where throw shows most
  if(c.up || c.side) tip = snapTip(settings.shotTip || [0, 0], c);
  if(GEN.g == null && s.gb){ const f = bridgeGeom(s, bridgeAim(s)).tyMin; if(f > -1) tip = tipFloor(tip, c, f); }   // a rail bridge: the cue can't reach low on the ball
  return {V, tip};
}
// Play the shot from the cue ball along dir with a stroke: the engine runs it. Deflection (from side spin) is in the engine's strike.
// sq: the cue's squirt (your shaft for your own shots: shaftSq()); left out, the engine's default (the dealer and the shot library)
// the moment the object ball is first struck (with other balls on the table, the cue ball may touch one of them first)
const obHit = ev => ev.find(e=>e.type==='ball' && e.ids.includes('o')) || null;
export function playAim(s, dir, stroke, record, sq){
  const cue = {id:'c', p:[...s.cb]}; PE.strike(cue, dir, stroke.V, stroke.tip, sq);
  const extra = (s.extra || []).map(x=>({id:x.id, p:[...x.p]}));   // S: the other balls on the table are in the engine too
  const sim = PE.simulate(engineTable(), [cue, {id:'o', p:[...s.ob]}, ...extra], record ? {record: 3, orient: true, tMax: 16} : {tMax: 16});
  const into = id => sim.events.find(e=>e.type==='pocket' && e.ids[0]===id) || null;
  const obIn = into('o'), cbIn = into('c'), made = !!obIn && obIn.pocket === POCKETS.indexOf(s.P);
  const hit = sim.events.find(e=>e.type==='ball' && e.ids.includes('c') && e.ids.includes('o'));   // the cue ball on the object ball
  const cEnd = sim.balls.find(b=>b.id==='c'), oEnd = sim.balls.find(b=>b.id==='o');
  const zoneMiss = s.zone && !cbIn ? Math.max(0, len(sub(cEnd.p, s.zone.c)) - s.zone.r) : null;
  return {sim, made, scratch: !!cbIn, obIn, cbIn, hit: !!hit, cueEnd: cEnd.p, obEnd: oEnd.p, inZone: zoneMiss === 0, zoneMiss,
    cushionAfter: !!hit && sim.events.some(e=>e.ids[0]==='c' && (e.type==='cushion' || e.type==='jaw') && e.t > hit.t),
    cbRails: hit ? sim.events.filter(e=>e.ids[0]==='c' && (e.type==='cushion' || e.type==='jaw') && e.t > hit.t).length : 0};
}
// the aim straight at the right contact (no allowance for throw or deflection): the dealer's reference
export const idealDir = s => norm(sub(s.gb, s.cb));
// the aim that pots it with this stroke (allowing for its throw and deflection): searched outward from the ideal line, 2° each
// way for throw, plus the most side spin can push the cue ball off line with this cue (a whippy shaft with english needs more)
export function aimFor(s, stroke, sq){
  const d0 = idealDir(s), side = Math.abs((stroke.tip || [0, 0])[0]) * (sq == null ? PE.SQUIRT : sq);
  for(let k=0, K = 40 + 2*Math.ceil(side/(0.1*RAD)); k<=K; k++){
    const off = (k % 2 ? 1 : -1)*Math.ceil(k/2)*0.1*RAD, d = rot(d0, off);
    if(playAim(s, d, stroke, false, sq).made) return d;
  }
  return d0;
}
fetchShipped();

// ---------- the routine: read from the ball line, step behind your aim line, get down on it ----------
let routineRaf = 0;
function startRoutine(){
  cancelAnimationFrame(routineRaf);
  const s = S.shot, T = standTime(shootLevel());
  if(!s || !shootRoutine() || tut.on || !T){ if(s) s.cam = {phase:'stand', k:0}; renderRoutineChip(); return; }
  s.cam = {phase:'stand', k:0, t0: performance.now(), T, ready: T >= NO_TIMER};
  s.aimId = null; s.aimDir = null;
  const tick = now => {
    if(S.shot !== s || S.answered || !shootRoutine() || tut.on){ renderRoutineChip(); return; }
    const c = s.cam, el = (now - c.t0)/1000;
    // You read the shot from the ball line; at C- and C for a set time before you can call it. Calling a fraction
    // takes you behind that fraction's aim line and down on it (callAim); nothing happens on its own.
    if(c.phase !== 'stand') return;
    c.left = Math.max(0, T - el); c.ready = T >= NO_TIMER || c.left <= 0;   // no timer: ready at once
    renderRoutineChip();
    if(!c.ready) routineRaf = requestAnimationFrame(tick);
  };
  routineRaf = requestAnimationFrame(tick);
}
const ease = u => u < .5 ? 2*u*u : 1 - Math.pow(-2*u + 2, 2)/2;
function renderRoutineChip(){
  const el = $('routinechip'); if(!el) return;
  const c = S.shot && S.shot.cam;
  const standing = c && (c.phase === 'stand' || (c.up && c.phase === 'down' && c.k < 1)) && !c.moving;
  if(!shootRoutine() || tut.on || S.answered || !c || !c.T || !standing || look.k > 0){ el.hidden = true; return; }
  el.hidden = true;   // no chip: calling a fraction is how you get down (the lesson says so)
}
// The aim line a call plays: the right call's is the one that pots with your stroke (throw and deflection allowed for),
// any other call's is that fraction's contact.
function rightIdFor(s){ return nearestRef(cutForDir(s, aimFor(s, shotStroke(s), shaftSq()))).id; }
function aimDirFor(s, id){
  const stroke = shotStroke(s), need = aimFor(s, stroke, shaftSq()), right = nearestRef(cutForDir(s, need));
  const picked = ALL.find(r=>r.id === id);
  return !picked || picked.id === right.id ? need : dirForCut(s, picked.deg);
}
// Stand up off the shot (Esc or the ⤒ button, on the ladder): back up, step back to the ball line, and read it again
function canStandUp(){ const c = S.shot && S.shot.cam; return shootRoutine() && !tut.on && !S.answered && !S.anim && !!c && c.T && c.phase !== 'stand' && !c.moving && !look.target; }
function standUpOff(){
  if(!canStandUp()) return false;
  const s = S.shot, c = s.cam; featherOff(s);
  const back = () => camStep(s, 'step', c.phase === 'step' ? c.k : 1, 0, 500, ()=>{ c.phase = 'stand'; c.k = 0; c.up = false; c.fHold = 0; s.aimId = null; s.aimDir = null; markAim(s); draw(false); });
  if(c.phase === 'down' && c.k > 0) camStep(s, 'down', c.k, 0, 450, back); else back();
  return true;
}
function syncUpBtn(){ const el = $('upwrap'); if(el) el.hidden = !canStandUp(); }
function camStep(s, phase, k0, k1, ms, done){   // move the routine's camera through one phase
  const c = s.cam, t0 = performance.now(), tw = c.tw = (c.tw || 0) + 1; c.phase = phase; c.moving = true; renderRoutineChip();   // the newest move owns the camera
  const tick = now => {
    if(c.tw !== tw) return;
    if(S.shot !== s || S.answered){ c.moving = false; return; }
    const u = Math.min(1, (now - t0)/ms); c.k = k0 + (k1 - k0)*ease(u);
    if(!look.k) draw(false);
    if(u < 1) requestAnimationFrame(tick); else { c.moving = false; done && done(); }
  };
  requestAnimationFrame(tick);
}
// Calling a fraction: standing, you step behind its aim line and get down on it; call the same one again and it goes.
// Call another while down and you get back up, step over to its line, and get down again: then call it to shoot.
function markAim(s){ document.querySelectorAll('#answers button').forEach(b=>b.classList.toggle('aimed', b.dataset.id === s.aimId)); }   // the line you're on
// getting down takes longer the further you have to come in: 0.6 s from a normal stance, up to about 1.4 s from right back
function downMs(s){
  const dir = s.aimDir || norm(sub(s.ob, s.cb)), a = camAlong(s, dir, VIEWS.stand).E, b = camAlong(s, dir, VIEWS.down).E;
  return 600*Math.min(2.4, Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])/20));
}
function callAim(id){
  const s = S.shot, c = s && s.cam;
  if(!c || c.moving || S.answered) return;
  const settled = () => { c.up = false; featherStart(c); renderRoutineChip(); featherLoop(s); };
  const goDownOn = () => camStep(s, 'down', 0, 1, downMs(s), settled);
  const own = true;   // you always get down on the line of the fraction you called, and that's the line you shoot
  if(c.phase === 'stand'){
    if(!c.ready) return;   // still reading the shot
    s.aimId = id; s.aimDir = own ? aimDirFor(s, id) : aimDirFor(s, rightIdFor(s)); if(own) markAim(s);
    camStep(s, 'step', 0, 1, 600, goDownOn);
    return;
  }
  if(c.phase === 'down' && c.k >= 1 && (id === s.aimId || !own)) return takeShot(id);
  if(!own){ if(c.phase === 'down' && c.k < 1){ featherOff(s); camStep(s, 'down', c.k, 1, 450, settled); } return; }   // C-: back down on the same line after a look
  // a different line (or back down after stepping back): up, across, down
  featherOff(s);
  const across = () => {
    c.fHold = 0;   // all the way up: the cue's off the table, and back down it starts again at the ball
    if(id === s.aimId) return goDownOn();
    c.fromAim = s.aimDir; s.aimId = id; s.aimDir = aimDirFor(s, id); markAim(s);
    camStep(s, 'shift', 0, 1, 500, ()=>{ c.phase = 'down'; c.k = 0; goDownOn(); });
  };
  if(c.phase === 'down' && c.k > 0) camStep(s, 'down', c.k, 0, 450, across); else across();
}
// The Shoot camera: standing on the ball line, standing behind your aim line, or down on your aim line, blended by the routine.
function shootCam(s, view){
  const d = norm(sub(s.ob, s.cb)), aim = s.aimDir || d;   // ball line, then behind the aim line you called, then down on it
  const stand = camAlong(s, d, VIEWS.stand), standAim = camAlong(s, aim, VIEWS.stand), down = camAlong(s, aim, VIEWS.down);
  const c = s.cam || {phase:'stand', k:0};
  const mix = (A, B, k) => camFrom(A.E.map((x, i)=>x + (B.E[i]-x)*k), norm3(A.f.map((x, i)=>x + (B.f[i]-x)*k)), A.hfov + (B.hfov - A.hfov)*k);
  const base = c.phase === 'step' ? standOut(mix(stand, standAim, c.k)) : c.phase === 'shift' ? (c.fromCam ? mix(c.fromCam, standAim, c.k) : standOut(mix(camAlong(s, c.fromAim || d, VIEWS.stand), standAim, c.k))) : c.phase === 'down' ? bendCam(standAim, down, c.k, aim) : view === 'down' && !c.T ? camAlong(s, d, VIEWS.down) : stand;
  return look.k > 0 ? mix(base, overviewCam(s), ease(look.k)) : base;
}
function overviewCam(s){
  // Phones: the whole table on a small screen leaves the balls a few pixels wide, so there you step back over the shot
  // itself (the cue ball, the object ball, its pocket and the zone) rather than the whole table.
  const d = norm(sub(s.ob, s.cb)), pts = [[s.cb[0],s.cb[1],R], [s.ob[0],s.ob[1],R]];
  if(s.zone) pts.push([s.zone.c[0], s.zone.c[1], 0]);
  if(IS_PHONE) pts.push([s.P.c[0], s.P.c[1], 0]); else pts.push([0,0,0],[W,0,0],[W,H,0],[0,H,0]);
  const xs = pts.map(p=>p[0]), ys = pts.map(p=>p[1]), m = 14;
  const T = IS_PHONE ? [(Math.min(...xs) + Math.max(...xs))/2, (Math.min(...ys) + Math.max(...ys))/2, 0] : [W/2, H/2, 0];
  let cam = null;
  for(let dist = 40; dist <= 260; dist += 8){
    const E = [T[0] - d[0]*dist*.55, T[1] - d[1]*dist*.55, 18 + dist*.85];
    cam = camFrom(E, norm3([T[0]-E[0], T[1]-E[1], T[2]-E[2]]), 64);
    if(pts.every(P=>{ const q = cam.toCam(P); if(q[2] <= NEAR) return false; const [x, y] = cam.proj(q); return x >= m && x <= VW-m && y >= m && y <= VH-m; })) break;
  }
  return cam;
}
function setLook(on){
  if(!S.shot || !isShooting() || settings.view === 'top' || (tut.on && tut.zb > 0)) return;
  look.target = on ? 1 : 0;   // the camera blends over the stance (shootCam), so the stance, cue and strokes are left as they are
  cancelAnimationFrame(look.raf);
  let last = performance.now();
  const tick = now => {
    const dt = now - last; last = now;
    look.k = look.target ? Math.min(1, look.k + dt/350) : Math.max(0, look.k - dt/350);
    if(!S.anim) draw(S.answered);   // while a shot runs, its own frames redraw (with the shot's path drawn only as far as it's got)
    renderRoutineChip();
    if(look.k !== look.target) look.raf = requestAnimationFrame(tick);
  };
  look.raf = requestAnimationFrame(tick);
}
// a camera behind the cue ball looking along dir, tilted to keep the cue ball (and, standing, the pocket) in frame
// You stand outside the table: standing to read a shot, your feet are on the floor behind the rail and your eyes are over them,
// never in over the rail. Down on the shot you bend over from the hips, so the eye swings forward and down in an arc
// instead of sliding through the table.
function edgeDist(p, d, w = W, h = H){   // from p along d to the playing area's edge (the cushion nose), or to the edge of a w×h box
  let t = Infinity;
  for(const i of [0, 1]){ const lim = i ? h : w; if(d[i] > 1e-9) t = Math.min(t, (lim - p[i])/d[i]); else if(d[i] < -1e-9) t = Math.min(t, -p[i]/d[i]); }
  return Math.max(0, t);
}
// the closest your eyes can be: where the line back from p (against dir) crosses the rail's outer edge. Measured along the line
// to the outline itself, not the cushion nose plus a rail's width: at a shallow angle to a rail those few inches along the line
// barely move you off the cushion, and the eye ended up over the table.
const railOut = () => PE.C.cushionWidth + PE.C.railWidth;
const outerDist = (p, d) => { const o = railOut(); return edgeDist([p[0] + o, p[1] + o], d, W + 2*o, H + 2*o); };
const standMin = (s, dir, p = s.cb) => outerDist(p, [-dir[0], -dir[1]]);
// Reading a shot you look along it, not straight down: with the cue ball near the rail you stand back far enough to have it
// no more than about 60° below your eyes (a foot and a half or so, more for a tall player), instead of having it under your chin.
const standRead = () => (VIEWS.stand.h - R)*0.58;
// The slider (`back`) is how far behind that closest spot you stand: 0 is right at the rail's outer edge, every inch steps you
// back, wherever the cue ball is. Your eyes are never inside the rail's outline.
const standBackFor = (s, dir, back) => Math.max(standRead(), standMin(s, dir)) + back;
// A standing eye blended between two lines (stepping over to your aim line) can cut across a corner of the rail: push it
// back out along the way you're looking, to the rail's outer edge.
function standOut(cam){
  const E = cam.E, o = railOut(), f = [cam.f[0], cam.f[1]], fl = len(f);
  if(!(E[0] > -o && E[0] < W + o && E[1] > -o && E[1] < H + o) || fl < 1e-6) return cam;
  const t = outerDist(E, [-f[0]/fl, -f[1]/fl]);
  return camFrom([E[0] - f[0]/fl*t, E[1] - f[1]/fl*t, E[2]], cam.f, cam.hfov);
}
function bendCam(A, B, k, dir){   // from standing (A) to down (B) on the same line: the eye pivots about your hips
  const hc = +settings.heightCm >= 150 && +settings.heightCm <= 200 ? +settings.heightCm : 175;
  const hip = [A.E[0] - dir[0]*3, A.E[1] - dir[1]*3, hc/2.54*0.53 - 29.5];   // hips a little behind your eyes, at about half your height
  const pol = E => { const q = [E[0] - hip[0], E[1] - hip[1]], fw = q[0]*dir[0] + q[1]*dir[1], z = E[2] - hip[2]; return [Math.hypot(fw, z), Math.atan2(z, fw), q[1]*dir[0] - q[0]*dir[1]]; };
  const a = pol(A.E), b = pol(B.E), r = a[0] + (b[0] - a[0])*k, an = a[1] + (b[1] - a[1])*k, lat = a[2] + (b[2] - a[2])*k;
  const E = [hip[0] + dir[0]*r*Math.cos(an) - dir[1]*lat, hip[1] + dir[1]*r*Math.cos(an) + dir[0]*lat, hip[2] + r*Math.sin(an)];
  return camFrom(E, norm3(A.f.map((x, i)=>x + (B.f[i]-x)*k)), A.hfov + (B.hfov - A.hfov)*k);
}
// ---------- the bridge: on the cloth, on the rail, or over a ball ----------
// The ladder deals every shot with room on the cloth for the bridge hand (handRoom). A run plays on from wherever the cue ball
// stops, so there the hand may not fit: within about a hand of the cushion the bridge goes on the rail (the cue rests on the
// rail top, a few degrees up, more the closer the ball is to the cushion, and the tip can't strike low on the ball, since the
// cue has to clear the cushion nose), and with a ball under the bridge the hand goes up on it with the cue over it. The cue,
// the hand, the camera down on the shot and the stroke's tip all read the shot the same way, from here. The engine plays
// every shot level: the elevation is in the picture, not in the physics.
const RAIL_TOP = 1.6;   // the rail's top above the cloth, as the table is drawn
function bridgeGeom(s, u, ty = 0){
  const L0 = 0.146*stanceIn() - 1.25, t0 = railBehind(s.cb, u), tipZ = R + ty*R, built = GEN.g != null;   // (the library is built with the hand on the cloth)
  const g = {rail: false, over: false, t0, tipZ, Lb: bridgeLen(s, u), zf: 0, tyMin: -1, EL: 0, Bz: 0};
  if(!built && t0 < L0 + 4){   // the hand can't fit on the cloth: a rail bridge, the V a little way onto the rail
    g.rail = true; g.Lb = Math.max(L0, t0 + PE.C.cushionWidth + 1.5); g.zf = RAIL_TOP;
    g.Bz = RAIL_TOP + 1.2;   // the cue's axis where it rests on the hand on the rail
    g.EL = Math.atan2(g.Bz - tipZ, g.Lb);
    // the cue has to clear the cushion nose: the lowest the tip can strike (a little draw further out, above centre when frozen)
    const EL0 = Math.atan2(g.Bz - R, g.Lb), need = PE.C.noseHeight + .35 - t0*Math.tan(EL0);
    g.tyMin = Math.max(-1, Math.min(.6, (need - R)/R)); if(g.tyMin <= -.99) g.tyMin = -1;
  } else {   // on the cloth: a touch more with top, a touch less with draw, and as steep as it has to be for the butt to pass over the rail
    const rAt = d => .255 + (d/58)*(.6 - .255), clear = Math.atan2(RAIL_TOP + .15 + rAt(t0) - tipZ, t0);
    g.EL = Math.max((4 + 2*ty)*RAD, clear); g.Bz = tipZ + g.Lb*Math.tan(g.EL);
  }
  if(!built && !g.rail && s.extra && s.extra.length){   // a ball under the bridge: the hand goes up on it, the cue over it
    const n = [-u[1], u[0]];
    if(s.extra.some(x=>{ const q = sub(x.p, s.cb), back = -dot(q, u), side = Math.abs(dot(q, n)); return back > R && back < g.Lb + 3.2 && side < 2*R + .4; })){
      g.over = true; g.zf = 2*R*.55; g.Bz = Math.max(g.Bz, 2*R + 1.2); g.EL = Math.atan2(g.Bz - tipZ, g.Lb);
    }
  }
  return g;
}
const bridgeAim = s => s.aimDir || norm(sub(s.gbLook || s.gb, s.cb));
function tipFloor(tip, c, tyMin){   // the nearest point of the pad at or above the floor
  if(tyMin <= -1 || tip[1] >= tyMin - 1e-9) return tip;
  let best = null, bd = Infinity;
  for(const q of tipPoints(c)){ if(q[1] < tyMin - 1e-9) continue; const d = Math.hypot(q[0] - tip[0], q[1] - tyMin); if(d < bd){ bd = d; best = q; } }
  return best || [0, Math.max(0, tyMin)];
}
function camAlong(s, dir, c){
  const bg = c === VIEWS.down ? bridgeGeom(s, dir, shotStroke(s).tip[1]) : null, raised = !!bg && (bg.rail || bg.over);   // down: your eyes behind the bridge, wherever it is
  const back = c === VIEWS.stand ? standBackFor(s, dir, c.back) : c === VIEWS.down ? c.back + bg.Lb - (0.146*stanceIn() - 1.25) : c.back;
  // bridging on the rail (or over a ball) the cue comes up, and so do your eyes: over the rail, looking down at the cue ball
  const eye = sub(s.cb, mul(dir, back)), E = [eye[0], eye[1], raised ? Math.max(c.h, bg.tipZ + back*Math.tan(bg.EL) + 4.5, bg.rail ? 11 : 0) : c.h];
  const hd = P=>Math.max(0.1, (P[0]-E[0])*dir[0] + (P[1]-E[1])*dir[1]);
  const aCB = Math.atan2(R - E[2], hd(s.cb)), aP = Math.atan2(1.6 - E[2], hd(s.P.c));
  const at = hfov => {
    const vHalf = Math.atan((VH/2)/((VW/2)/Math.tan(hfov/2*RAD))), mg = 5*RAD;
    let pr = c.pitch*RAD;
    if(c === VIEWS.stand && aP > pr + vHalf - mg) pr = aP - vHalf + mg;
    if(aCB < pr - vHalf + mg) pr = aCB + vHalf - mg;
    if(raised) pr = Math.min(pr, aCB + vHalf*.6);   // the cue ball well up the frame, the rail mostly out of it
    return camFrom(E, norm3([dir[0]*Math.cos(pr), dir[1]*Math.cos(pr), Math.sin(pr)]), hfov);
  };
  if(c === VIEWS.stand && IS_PHONE) for(const hf of PHONE_STAND_FOVS){ const cam = at(hf); if(shotInFrame(cam, s)) return cam; }
  return at(c.hfov);
}
// Phones: the screen is small, so standing you look through a narrower lens when the shot still fits (the cue ball, the
// ghost ball, the object ball and its pocket in frame): the balls are drawn up to 1.6× as wide. Otherwise the usual 72°.
const PHONE_STAND_FOVS = [48, 54, 60, 66];
function shotInFrame(cam, s, m = 24){
  return [[s.cb[0], s.cb[1], R], [s.gb[0], s.gb[1], R], [s.ob[0], s.ob[1], R], [s.P.c[0], s.P.c[1], 0]].every(P=>{
    const q = cam.toCam(P); if(q[2] <= NEAR) return false;
    const [x, y] = cam.proj(q); return x >= m && x <= VW - m && y >= m && y <= VH - m;
  });
}

// ---------- controls: speed bar and tip pad ----------
function renderShootControls(){
  const box = $('shootctl'); if(!box) return;
  if(S.shot && !S.answered && $('quick').querySelector('.rcard.pend')) pendCard();   // stroke or spin changed: the card shows it
  const tl = tut.on && isShooting() ? (tstep().ui || []) : null;   // in a lesson: just the controls the step is about, lit up
  const on = isShooting() && (!tut.on || tl.length > 0), c0 = tl ? ctrlAt(LESSONS[tut.lesson].at) : null, c = tl ? {speed: tl.includes('speed'), up: tl.includes('tip'), down: tl.includes('tip') && c0.down, side: tl.includes('tip') && c0.side} : ctrl();   // a lesson's tip pad offers what its grade does
  box.hidden = !on; $('lookwrap').hidden = !(isShooting() && settings.view !== 'top');   // the eye stays in lessons, so a shot that runs off the view can still be followed
  syncFocusBtn();
  $('speedbar').classList.toggle('tuthl', !!tl && tl.includes('speed')); $('tippad').classList.toggle('tuthl', !!tl && tl.includes('tip'));
  // the right shot being replayed: the controls show its stroke and its fraction (only shown: your own settings and call stay as they are)
  const rp = !tl && on && S.answered && S.shot && S.shot.replay && S.shot.replay.ctl ? S.shot.replay : null;
  $('ctlrow').classList.toggle('replaying', !!rp && !!(c.speed || c.up || c.side));
  let lit = false;
  document.querySelectorAll('#answers button').forEach(b=>{ const on1 = !!rp && b.dataset.id === rp.id; b.classList.toggle('playing', on1); lit = lit || on1; });
  $('answers').classList.toggle('replaying', lit);
  if(!on){ $('tippad').hidden = true; $('speedbar').hidden = true; return; }
  $('speedbar').hidden = !c.speed;
  $('tippad').hidden = !(c.up || c.side);
  const n = rp ? levelForSpeed(rp.V) : tl && tut.ctl ? tut.ctl.lvl : speedLevel();
  const t = (rp ? rp.tip : tl ? (tut.ctl ? tut.ctl.tip : [0, 0]) : S.shot ? shotStroke(S.shot).tip : [0, 0]) || [0, 0];   // a lesson can open before its first shot is dealt
  paintCtl(t, n/10);
  if(c.speed) $('speedval').textContent = COARSE_LBL[n];
  if(c.up || c.side){
    $('tiplimit').setAttribute('d', tipLimitPath(c));
    { const fl = S.shot && GEN.g == null && S.shot.gb ? bridgeGeom(S.shot, bridgeAim(S.shot)).tyMin : -1, tf = $('tipfloor');   // a rail bridge: the low part of the ball is out of reach
      tf.hidden = fl <= -1; if(fl > -1){ const cy = -fl, x0 = Math.sqrt(Math.max(0, 1 - cy*cy)); tf.setAttribute('d', `M${(-x0).toFixed(3)} ${cy.toFixed(3)}A1 1 0 ${cy < 0 ? 1 : 0} 0 ${x0.toFixed(3)} ${cy.toFixed(3)}Z`); }
      $('tiplabel').textContent = fl > -1 ? 'Tip · rail bridge' : 'Tip'; }
    $('tipkeys').innerHTML = [c.up && 'W', c.side && 'A', c.down && 'S', c.side && 'D', 'X'].filter(Boolean).map(k=>`<kbd${k === 'X' ? ' title="Centre"' : ''}>${k}</kbd>`).join('');   // X: back to centre
  }
}
// The tip dot and the speed fill. Usually they jump to where you put them; set ctlGlideMs first and they glide there
// instead (into the right shot's stroke as its replay begins, and back to yours after).
let ctlNow = null, ctlTo = null, ctlRaf = 0;
function paintCtl(tip, f){
  const to = {tip: [tip[0], tip[1]], f}, ms = S.ctlGlideMs; S.ctlGlideMs = 0;
  const same = (a, b) => !!a && !!b && a.f === b.f && a.tip[0] === b.tip[0] && a.tip[1] === b.tip[1];
  if(ctlRaf && same(to, ctlTo)) return;   // already on its way there
  cancelAnimationFrame(ctlRaf); ctlRaf = 0; ctlTo = to;
  const put = v => { ctlNow = v;
    $('tipdot').setAttribute('cx', v.tip[0].toFixed(3)); $('tipdot').setAttribute('cy', (-v.tip[1]).toFixed(3));
    $('speedfill').style.height = (v.f*100).toFixed(1) + '%'; };
  const calm = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  if(!ms || !ctlNow || calm || same(to, ctlNow)) return put(to);
  const from = ctlNow, t0 = performance.now(), mix = (a, b, e) => a + (b - a)*e;
  const step = now => { const u = Math.min(1, (now - t0)/ms), e = ease(u);
    put({tip: [mix(from.tip[0], to.tip[0], e), mix(from.tip[1], to.tip[1], e)], f: mix(from.f, to.f, e)});
    ctlRaf = u < 1 ? requestAnimationFrame(step) : 0; };
  ctlRaf = requestAnimationFrame(step);
}
function tipLimitPath(c){   // a dot at every point you can strike: the centre, then rings round the clock
  return tipPoints(c).map(([x, y])=>`M${(x - .035).toFixed(3)} ${(-y).toFixed(3)}a.035 .035 0 1 0 .07 0a.035 .035 0 1 0 -.07 0`).join('');
}
function wireShootControls(){
  const bar = $('speedbar'), pad = $('tippad');
  ['click', 'pointerdown'].forEach(ev=>pad.addEventListener(ev, e=>e.stopPropagation()));   // on the table: a tap on the pad isn't a tap on the table
  const setSpeedFrom = ev => {
    const r = $('speedtrack').getBoundingClientRect(), f = Math.max(0, Math.min(1, (r.bottom - ev.clientY)/r.height));
    setSpeedLevel(Math.max(1, Math.ceil(f*10)));
  };
  // a finger covers what it drags: on a touch screen the bar shows its level above the finger, and the pad a bigger copy of itself
  const fingerish = ev => ev.pointerType === 'touch' || ev.pointerType === 'pen';
  const bubble = document.createElement('span'); bubble.className = 'ctlbubble'; bubble.setAttribute('aria-hidden', 'true'); bar.appendChild(bubble);
  const loupe = document.createElement('div'); loupe.className = 'tiploupe'; loupe.setAttribute('aria-hidden', 'true'); pad.appendChild(loupe);
  const showBubble = () => { if(bar.classList.contains('held')) bubble.textContent = $('speedval').textContent; };
  const showLoupe = () => { if(pad.classList.contains('held')) loupe.innerHTML = $('tipsvg').outerHTML.replace(/\s(id|aria-label)="[^"]*"/g, ''); };
  let sDrag = false;
  bar.addEventListener('pointerdown', ev=>{ if(S.answered || (tut.on && tut.ctl)) return;
    const stepBtn = ev.target.closest('[data-step]');
    if(stepBtn){ ev.preventDefault(); ev.stopPropagation(); setSpeedLevel(speedLevel() + +stepBtn.dataset.step); return; }   // the ↑ ↓ under the bar work as buttons too
    sDrag = true; try{ bar.setPointerCapture(ev.pointerId); }catch(e){} bar.classList.toggle('held', fingerish(ev)); setSpeedFrom(ev); showBubble(); ev.preventDefault(); ev.stopPropagation(); });
  bar.addEventListener('pointermove', ev=>{ if(sDrag){ setSpeedFrom(ev); showBubble(); } });
  ['pointerup','pointercancel','lostpointercapture'].forEach(t=>bar.addEventListener(t, ()=>{ sDrag = false; bar.classList.remove('held'); }));
  const setTipFrom = ev => {
    const svg = $('tipsvg'), pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
    const q = pt.matrixTransform(svg.getScreenCTM().inverse()), c = ctrl();
    const was = String(settings.shotTip), tip = snapTip([c.side ? q.x : 0, -q.y], c);
    settings.shotTip = tip; saveSettings(); renderShootControls();
    if(String(tip) !== was) uiSound('tick', (tip[1] + 1)/2);   // a tick each time the tip moves to a new point
  };
  let tDrag = false;
  pad.addEventListener('pointerdown', ev=>{ if(S.answered || (tut.on && tut.ctl)) return; tDrag = true; try{ pad.setPointerCapture(ev.pointerId); }catch(e){} pad.classList.toggle('held', fingerish(ev)); setTipFrom(ev); showLoupe(); ev.preventDefault(); ev.stopPropagation(); });
  pad.addEventListener('pointermove', ev=>{ if(tDrag){ setTipFrom(ev); showLoupe(); } });
  ['pointerup','pointercancel','lostpointercapture'].forEach(t=>pad.addEventListener(t, ()=>{ tDrag = false; pad.classList.remove('held'); }));
}

// ---------- taking the shot ----------
// The direction from the cue ball that makes contact at cut phi (on the shot's side)
function dirForCut(s, phi){
  const D = len(sub(s.ob, s.cb)), w = norm(sub(s.ob, s.cb));
  return rot(w, s.sign*Math.asin(Math.min(1, 2*R*Math.sin(phi*RAD)/D)));
}
// the cut a direction makes contact at
export function cutForDir(s, dir){
  const q = sub(s.ob, s.cb), b = dot(q, dir), c = dot(q, q) - 4*R*R, disc = b*b - c;
  if(disc < 0) return 90;
  const g = add(s.cb, mul(dir, b - Math.sqrt(disc))), n = norm(sub(s.ob, g));
  return Math.acos(Math.max(-1, Math.min(1, dot(dir, n))))/RAD;
}
// Take the shot with the fraction you called: the right call plays the hit this stroke needs (throw and deflection allowed for),
// any other call plays that fraction's contact exactly
// when (ms) a ball would first reach where your cue and bridge hand are, so you're up and out of the way before it gets there:
// the cue from its follow-through back past the bridge (where it's still low enough to be hit), and the hand round the bridge
function rigHitMs(s, run, dir){
  const P = run.sim.paths; if(!P) return Infinity;
  const Lb = bridgeLen(s, dir), tip = add(s.cb, mul(dir, FOLLOW_THROUGH)), back = sub(s.cb, mul(dir, Lb + 12)), br = sub(s.cb, mul(dir, Lb));
  const segD = q => { const v = sub(back, tip), u = Math.max(0, Math.min(1, dot(sub(q, tip), v)/dot(v, v))); return len(sub(q, add(tip, mul(v, u)))); };
  const hitT = (run.sim.events.find(e=>e.type === 'ball' && e.ids.includes('c')) || {}).t ?? Infinity;
  let first = Infinity;
  for(const [id, from] of [['c', hitT], ['o', 0], ...(s.extra || []).map(x=>[x.id, 0])]){
    for(const pt of P[id] || []){
      if(pt.t <= from || pt.z < 0) continue;
      if(segD(pt.p) < R + .6 || len(sub(pt.p, br)) < R + 4.5){ first = Math.min(first, pt.t); break; }
    }
  }
  return isFinite(first) ? Math.max(0, first*1000 - 350) : Infinity;
}
// pocket speed: the softest of your four strokes that gets the object ball to the pocket
const pocketLevel = s => COARSE.find(l=>STROKE_MPH[l]*MPH >= strikeOf(s).V) || COARSE[COARSE.length - 1];
// The right stroke for a shot, the one the result card names and "Replay the right shot" plays, with the right call's aim.
// Yours, if the right call with it drops clean (and lands in the zone, with the zone's tip); otherwise the zone's own stroke,
// or with no zone the softest from pocket speed up that drops clean. If none does, pocket speed or harder stands (yours if it's
// that hard). {st: {V, tip}, lvl, mineOk, id}; lvl is null when speed isn't yours yet. id: the right call for that stroke and tip,
// the one fraction the card names as right and the replay lights up: the right shot is one shot.
function rightStroke(s, sq){
  const r = rightStroke0(s, sq);
  r.id = nearestRef(cutForDir(s, aimFor(s, r.st, sq))).id;
  return r;
}
function rightStroke0(s, sq){
  const z = s.zone, c = ctrl(), tip = z ? z.tip : shotStroke(s).tip;
  if(!c.speed){ const st = z ? {V: STROKE_MPH[z.lvl]*MPH, tip} : shotStroke(s); return {st, lvl: null, mineOk: true}; }
  const mine = nearestCoarse(speedLevel()), pl = pocketLevel(s), at = l => ({V: STROKE_MPH[l]*MPH, tip});
  const clean = l => { const st = at(l), r = playAim(s, aimFor(s, st, sq), st, false, sq); return r.made && !r.scratch && (!z || r.inZone); };
  const cands = z ? [...(z.lvls || []).includes(mine) ? [mine] : [], z.lvl] : [...mine >= pl ? [mine] : [], ...COARSE.filter(l=>l >= pl && l !== mine)];
  let lvl = cands.find(clean);
  if(lvl == null) lvl = z ? z.lvl : Math.max(mine, pl);
  return {st: at(lvl), lvl, mineOk: lvl === mine};
}
// what the balls did, and how it went for the ball alone (whatever the call): pocketed clean (and in the zone, if there is one)
// is a success, pocketed clean but off the zone is half of one, anything else a miss. The Ball row and a lesson's note use it.
// the right shot in a line, the card's caption: "RIGHT SHOT ¼ · ¾ stroke · ½ tip of top"
function rightShotLine(s, rs, ideal){
  const c = ctrl(), t = tipName(snapTip(rs.st.tip || [0, 0]));
  return '<small>Right shot</small> ' + [fracName(ideal), c.speed && rs.lvl != null && strokeName(rs.lvl) + ' stroke', s.zone && (c.up || c.side) && (t === 'Center' ? 'center ball' : t)].filter(Boolean).join(' · ');
}
function ballVerdict(run, zone, foul){
  if(run.scratch) return {v: 'Scratch: the cue ball went in', good: false};
  if(foul) return {v: 'Foul: another ball first', good: false};
  if(!run.hit) return {v: 'Missed the object ball', good: false};
  if(!run.made) return {v: run.obIn ? 'Wrong pocket' : 'Missed the pocket', good: false};
  if(!zone) return {v: 'Pocketed', good: true};
  return run.inZone ? {v: 'Pocketed, in the zone', good: true} : {v: `Pocketed, missed the zone by ${run.zoneMiss.toFixed(1)}″`, good: 'also'};
}
function takeShot(id){
  if(S.answered || !S.shot || S.shot.calling || !isShooting() || S.anim) return;
  const s = S.shot, stroke = shotStroke(s), rig0 = rigAlpha(s), withCue = rig0.a > .01, feather0 = rig0.push || 0;   // where the practice stroke is right now, read before anything changes
  const sq = shaftSq(), needDir = aimFor(s, stroke, sq), need = cutForDir(s, needDir), right = nearestRef(need);
  const picked = ALL.find(r=>r.id===id) || right, ok = picked.id === right.id;
  const dir = ok ? needDir : dirForCut(s, picked.deg);
  s.tip = stroke.tip; s.need = need; s.rightId = right.id;
  S.answered = true; cancelAnimationFrame(routineRaf); renderRoutineChip();
  if(stats.active && stats.active.pending) delete stats.active.pending;   // shot taken: the next deal is a new one
  const run = playAim(s, dir, stroke, true, sq);
  const g = shootLevel(), idealV = strikeOf(s).V, ratio = stroke.V/idealV;
  const foul = isRun() && runFoul(run);   // in a run the cue ball has to hit the called ball first
  // full marks: the right call, it drops clean, and in the zone if there is one. Harder than pocket speed is fine if it drops clean.
  // The right call that misses the zone is a partial: no points either way.
  const clean = run.made && !run.scratch && !foul;
  const pocketLvl = pocketLevel(s);   // pocket speed: the softest stroke that gets it there
  const speedOk = !ctrl().speed || !!s.zone || nearestCoarse(speedLevel()) >= pocketLvl;   // pocket speed or harder
  const rs = s.rightStroke = rightStroke(s, sq);   // the shot the card names and the replay plays (call, stroke, tip): one answer for all
  const ideal = ALL.find(r=>r.id === rs.id) || right, isIdeal = picked.id === ideal.id;   // your call against the right shot's; ok: against your own stroke and spin's
  const zoneWin = !!s.zone && clean && run.inZone;   // potted and in the zone: a success, whatever fraction or stroke got it there
  const full = zoneWin || (ok && clean && !s.zone && speedOk);
  const partial = ok && clean && !full;
  const q = sub(s.ob, s.cb), qb = dot(q, dir), disc = qb*qb - dot(q, q) + 4*R*R;   // where the cue ball meets the object ball on your call
  s.pick = {made: run.made, far: !ok, g2: disc >= 0 ? add(s.cb, mul(dir, qb - Math.sqrt(disc))) : s.gb, id};
  document.querySelectorAll('#answers button').forEach(x=>{ x.disabled = true; x.className = x.dataset.id===id ? (isIdeal && run.made ? 'right' : run.made ? 'also' : 'wrong') : x.dataset.id===ideal.id ? 'right' : ''; });   // your call is marked straight away: the right fraction played too soft or too hard is still a miss
  cancelAnimationFrame(featherRaf);
  const play = () => {
  if(isDrill()){   // Practice: kept in its own stats; no grade, points or streak
    logEntry({t:'practice', p:id, ra: right.id, m: run.made ? 1 : 0, ok: full ? 1 : partial ? .5 : 0, sc: run.scratch ? 1 : undefined, sv: +ratio.toFixed(2),
      sl: ctrl().speed ? nearestCoarse(speedLevel()) : undefined, tp: ctrl().up || ctrl().side ? stroke.tip.map(v=>+(+v).toFixed(2)) : undefined, wd: drillPicks().weak || undefined});
  } else if(isShoot() && practicing()){   // practice: logged as practice, nothing scored
    logEntry({t:'shoot', p:id, ra: right.id, m: run.made ? 1 : 0, ok: full ? 1 : partial ? .5 : 0, gh: 1, pr: gradeOf(g)});
  } else if(isRun()){   // a run: logged as its own mode (the ladder's grade and points never move), then the rack moves on from where the balls stopped
    const at = runAfterShot(s, run, foul);
    logEntry({t:'run', p:id, ra: right.id, m: run.made ? 1 : 0, ok: full ? 1 : partial ? .5 : 0, sc: run.scratch ? 1 : undefined, fl: foul ? 1 : undefined, sv: +ratio.toFixed(2),
      sl: nearestCoarse(speedLevel()), tp: stroke.tip.map(v=>+(+v).toFixed(2)), ...at});
  } else if(isLadder()){
    const prevStreak = curStreak();
    logEntry({t:'shoot', p:id, ra: right.id, m: run.made ? 1 : 0, ok: full ? 1 : partial ? .5 : 0, z: s.zone ? (run.inZone ? 1 : 0) : undefined, sc: run.scratch ? 1 : undefined, sv: +ratio.toFixed(2), sg: gradeOf(g),
      zk: s.zone ? s.zone.step : undefined, wl: s.zone ? s.zone.lvl : undefined, sl: ctrl().speed ? nearestCoarse(speedLevel()) : undefined, tp: ctrl().up || ctrl().side ? stroke.tip.map(v=>+(+v).toFixed(2)) : undefined});   // for the Stats view: the zone's shot type, the stroke it wanted and yours, the tip
    if(!partial){
      const from = shootLevel(); stats.shoot.bestBefore = Math.max(stats.shoot.best ?? 0, stats.shoot.g);
      const d = levelPoint(full);
      if(d) setTimeout(()=>showLevel(from), 350); else renderBadge();
    } else renderBadge();
    const st = curStreak();
    if(full && st >= STREAK_HOT) playSound('streak', st); else if(!full && prevStreak >= STREAK_HOT) playSound('streakEnd');
    showStreak(st, !full && prevStreak >= STREAK_HOT ? prevStreak : 0);
    if(full && st >= STREAK_HOT) cheer(st, prevStreak < STREAK_HOT);
  }
  // the verdict as a small table: your call and the right one, your stroke and the one it wanted, and what the balls did
  const spd = strokeName, want = rs.lvl, mine = speedLevel(), strokeOk = rs.mineOk;   // yours is right if the right call with it drops clean (and in the zone)
  const ball = ballVerdict(run, s.zone, foul), spinRow = shootRows(s).some(r=>r.k === 'Spin');
  // the same rows the card showed before the call (shootRows), filled in: a miss shows the right answer beside yours
  const rows = shootRows(s).map(r=>{
    // the call against the right shot's: ✓ if it's the same; a call that was right for your own stroke and spin isn't marked wrong,
    // it's said so, with the right shot's call beside it
    if(r.k === 'Call') return isIdeal ? {...r, v: fracName(picked), good: true}
      : ok ? {...r, v: fracName(picked), good: 'also', wide: true, note: `fits your ${spinRow ? 'stroke and spin' : 'stroke'} · right shot <span class="rrv">${fracName(ideal)}</span>`}
      : {...r, v: fracName(picked), good: zoneWin ? 'also' : false, right: fracName(ideal)};
    if(r.k === 'Stroke') return {...r, v: spd(mine), good: strokeOk || zoneWin, right: strokeOk || zoneWin ? '' : spd(want)};
    if(r.k === 'Spin'){   // your tip against the one that makes the zone (in half-tip steps: "½ tip of top", "1 tip of draw", "½ tip left"...)
      const mineTip = snapTip(stroke.tip || [0, 0]);
      if(!s.zone) return {...r, v: tipName(mineTip)};   // a run shot: your spin, shown, not judged (shape is yours to play)
      const zoneTip = s.zone.tip || [0, 0], same = tipName(mineTip) === tipName(zoneTip);
      return {...r, v: tipName(mineTip), good: same || zoneWin, right: same || zoneWin ? '' : tipName(zoneTip)};
    }
    return {...r, v: ball.v, good: ball.good};
  });
  const head = foul ? 'Foul' : full ? 'Good shot' : partial ? 'Pocketed' : ok ? 'Missed' : run.made ? (isIdeal ? 'Pocketed' : 'Wrong call, but it drops') : 'Missed';
  // the right column is one shot, the one Replay the right shot plays: named above the rows once there's a stroke or spin to it
  const rightShot = !full && rows.some(r=>r.k === 'Stroke' || r.k === 'Spin') ? rightShotLine(s, rs, ideal) : '';
  $('quick').innerHTML = rcardHTML(head, full ? 'ok' : partial || (run.made && !ok) ? 'also' : 'no', rows, '', rightShot);
  $('showright').hidden = full;   // under Next shot: play it the right way
  const hitT = (obHit(run.sim.events) || {}).t ?? 0;
  const obT = run.sim.events.find(e=>e.ids && e.ids[0]==='o' && e.t > hitT && (e.type==='cushion' || e.type==='jaw' || e.type==='pocket'));
  const upAt = Math.min(obT ? obT.t*1000 + 120 : Infinity, rigHitMs(s, run, dir));   // you come up as the object ball gets there, not when everything stops,
  if(isFinite(upAt)) setTimeout(()=>{ if(S.shot === s && !s.replay) standUp(s); }, upAt);           // and sooner if a ball is coming back at your cue or hand
  animateShot({made: run.made}, ms=>{   // the shot counts once it's played out (or skipped), so the last one of a session is watched too
    if(isLadder() && stats.active && stats.active.task===settings.task) stats.active.pause = (stats.active.pause||0) + (ms||0);
    if(!jumpingAhead){ draw(true); standUp(s); setTimeout(()=>{ if(S.shot === s && S.answered && !S.anim) prepareNext(); }, 400); }
    if(isLadder() && !practicing()) sessionTick(full, run.made);
  }, ok ? '#ffd34d' : MISS, run, ok ? null : playAim(s, needDir, stroke, true, sq));   // a wrong call: the right one rolls see-through alongside
  finishRound();
  };
  if(!withCue){ s.follow = 0; return play(); }
  // The stroke: the bridge stays put and speed comes from how much of your stroke you use, from a tenth (speed 1)
  // up to the full stroke (speed 10: the tip comes back to just short of the bridge hand). Same tempo every time,
  // so a longer stroke is a faster one, and the same follow-through whatever the speed.
  strokeThen(s, feather0, play);
}
// the final stroke, then play: the call doesn't cut the practice stroke short: it finishes, the cue rests at the ball for a beat
// (as long as the pause at the back), then the backswing. x0: where the practice stroke was when you called
function strokeThen(s, x0, play){
  s.follow = FOLLOW_THROUGH;
  const now0 = performance.now(), TP = 180, rc = rigCam(s), fb = Math.max(.1, (rc && rc.fBack) || strokeBack(s));
  const ft = x0 < -.05 ? Math.max(120, 520*Math.abs(x0)/fb) : 0;   // the practice stroke comes forward to the ball from where it is
  const st = cueStroke = {s, x0, t1: now0, ft, t0: now0 + ft + TP, from: 0, back: strokeBack(s), tb: 420, tp: TP, tf: 220};
  const tick = now => {
    if(S.shot !== s){ cueStroke = null; return; }
    if(now - st.t0 >= st.tb + st.tp + st.tf){ cueStroke = null; play(); return; }
    draw(false); requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
// rebuild everything a shot derives from where the balls are and which pocket it's going to
export function rebuildShot(s){
  const P = s.P, uC = norm(sub(P.t, s.ob));
  s.T = P.t; s.uC = uC; s.u = uC; s.L = len(sub(P.t, s.ob)); s.cheat = 0;
  s.gb = sub(s.ob, mul(uC, 2*R));
  const v = norm(sub(s.gb, s.cb)); s.v = v; s.n = uC;
  const cr = v[0]*uC[1] - v[1]*uC[0];
  s.sign = cr >= 0 ? -1 : 1;
  s.theta = Math.acos(Math.max(-1, Math.min(1, dot(v, uC))))/RAD; s.pathDeg = s.theta;
  s.answer = nearestRef(s.theta); s.tol = pocketTol(P, uC); s.strk = null; s.zone = null;
}

// the ladder you're climbing
const trk = () => ensureShootLevel();
const trkGrades = () => SHOOT_GRADES;
function levelPoint(ok){   // returns 1 when the grade goes up
  const L = trk(), G = trkGrades();
  L.pts += ok ? PT_RIGHT : PT_WRONG;
  if(L.pts >= PTS_UP && L.g < G.length-1){ L.g++; L.pts = 0; L.best = Math.max(L.best ?? 0, L.g); return 1; }
  L.pts = Math.max(0, Math.min(PTS_UP, L.pts));   // grades only go up: a miss costs progress toward the next one, never the grade
  return 0;
}
function renderBadge(pop){
  const L = ensureShootLevel(), G = SHOOT_GRADES, el = $('badge');
  el.hidden = !L; if(!L) return;
  const g = L.g, pts = L.pts;
  $('badgeg').textContent = G[g];
  const f = $('badgefill'); f.style.width = (Math.min(1, Math.abs(pts)/PTS_UP)*100) + '%'; f.classList.toggle('neg', pts < 0);
  el.title = `Grade ${G[g]}` + (g < G.length-1 ? ` · ${Math.max(0,pts)} of ${PTS_UP} to ${G[g+1]}` : '');
  if(pop){ el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
}
let lvlTimer = 0;
function showLevel(from){
  const L = trk(), to = stepOf(L.g), was = L.bestBefore != null ? stepOf(L.bestBefore) : from, notes = [];   // from, to, was: steps
  tableUp(was, to);   // a bigger table: you move up to it (Flash too)
  if(to >= CARBON_AT && settings.shaftGot !== '1'){ settings.shaft = 'carbon'; settings.shaftGot = '1'; saveSettings(); }   // the first time at S: the carbon shaft is yours, and in your hands
  enforceLocks(); syncPressed(); renderBadge(true);
  const first = to > was, news = first ? unlocksBetween(was, to) : [], focus = first ? FOCUS_AT[to] : null;   // a grade reached for the first time: its focus and what it gives you, on a card that waits for you
  if(focus || news.length){ clearTimeout(lvlTimer); $('lvlcard').hidden = true; openLevelUp(trkGrades()[L.g], focus, news); playSound('levelup'); return; }
  if(SHOOT_UP[to]) notes.push(SHOOT_UP[to]);   // back up to a grade you'd had: just its name
  $('lvlhead').textContent = 'Level up';
  $('lvlgrade').textContent = trkGrades()[L.g];
  $('lvlnote').textContent = notes.join(' · ');
  const c = $('lvlcard'); c.hidden = false; c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
  clearTimeout(lvlTimer); lvlTimer = setTimeout(()=>{ c.hidden = true; }, 2800);
  playSound('levelup');
}
// The level-up card for a grade reached for the first time: its focus (FOCUS_AT) as the lead, then one row per unlock
// (UNLOCKS_AT; with none, no list), and it stays until Continue.
// While it's up nothing is dealt and keys stay in the card. A quick tap or Enter right as it opens (meant for the next shot)
// doesn't close it.
const lvup = {from: null, at: 0, rows: []};
const lvupOpen = () => !$('lvup').hidden;
function openLevelUp(grade, focus, rows){
  const esc = t => String(t).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const plain = r => esc((r.what + ' ' + r.where).replace(/<[^>]*>/g, ''));
  lvup.rows = rows;
  $('lvupgrade').textContent = grade;
  const sub = $('lvupsub');
  sub.innerHTML = focus ? `${unlIcon(focus.icon)}<span>Focus: <strong>${esc(focus.name)}</strong></span>` : '';
  sub.hidden = !focus;
  if(focus) sub.setAttribute('aria-description', plain(focus)); else sub.removeAttribute('aria-description');
  $('lvuplabel').hidden = $('lvuplist').hidden = !rows.length;
  $('lvuplist').innerHTML = rows.map((r, i)=>`<li aria-description="${plain(r)}"><span class="unlico">${unlIcon(r.icon)}</span><h3>${esc(r.name)}</h3>`
    + (r.tryIt ? `<button class="lvuptry" data-try="${i}" aria-label="Try ${esc(r.name)}">Try it</button>` : '') + '</li>').join('');
  if(lvupOpen()) return;   // already up (two grades at once): just the new list
  lvup.from = document.activeElement; lvup.at = performance.now();
  $('lvup').hidden = false; $('lvuplist').scrollTop = 0;
  $('lvupok').focus({preventScroll: true});
}
function closeLevelUp(then){
  if(!lvupOpen() || performance.now() - lvup.at < 500) return;
  $('lvup').hidden = true;
  const f = lvup.from && lvup.from.isConnected && lvup.from !== document.body ? lvup.from : null; lvup.from = null;
  if(f) try{ f.focus({preventScroll: true}); }catch(e){}
  if(then) then();
}
$('lvupok').addEventListener('click', e=>{ e.stopPropagation(); closeLevelUp(); });
$('lvuplist').addEventListener('click', e=>{ const b = e.target.closest('[data-try]'); if(!b) return; e.stopPropagation(); const r = lvup.rows[+b.dataset.try]; closeLevelUp(r && r.tryIt); });
['click', 'pointerdown'].forEach(t=>$('lvup').addEventListener(t, e=>e.stopPropagation()));   // the table behind doesn't take it (a tap outside the card doesn't close it)
window.addEventListener('keydown', e=>{   // while it's up, keys stay in the card: Enter or Esc continues, Tab goes round its buttons
  if(!lvupOpen()) return;
  e.stopPropagation();
  if(e.key === 'Escape' || (e.key === 'Enter' && !(document.activeElement && $('lvup').contains(document.activeElement) && document.activeElement.tagName === 'BUTTON'))){ e.preventDefault(); closeLevelUp(); return; }
  if(e.key === 'Enter' && performance.now() - lvup.at < 500){ e.preventDefault(); return; }   // an Enter meant for the next shot
  if(e.key === 'Tab'){
    const f = [...$('lvup').querySelectorAll('button')], i = f.indexOf(document.activeElement);
    if(f.length){ e.preventDefault(); f[(i + (e.shiftKey ? f.length - 1 : 1) + f.length) % f.length].focus(); }
  }
}, true);
// how the shot is struck: every call uses the same stroke (speed and tip height); only the aim changes
export function strikeOf(s){
  if(s.strk) return s.strk;
  const d1 = len(sub(s.gb, s.cb)), spin = s.stroke === 'stun' ? 0 : 1;
  let vc = contactSpeed(s), st = PE.strikeFor(vc, spin, d1);
  for(let k=0; spin < 1 && st.b < -0.6 && k < 40; k++){ vc *= 1.08; st = PE.strikeFor(vc, spin, d1); }   // too soft to stun from this far: it takes more pace
  s.tip = [0, st.b];
  return s.strk = {V: st.V, b: st.b, vc};
}
// Play the shot with the cue ball aimed for a contact at cut phiC (on the shot's side), and see what happens.
// record: keep both balls' paths (and how they turn) for the animation.
export function outcome(s, phiC, record){
  const D = len(sub(s.ob,s.cb)), w = norm(sub(s.ob,s.cb));
  const al = Math.asin(Math.min(1, 2*R*Math.sin(phiC*RAD)/D));
  const v2 = rot(w, s.sign*al);
  const t = D*Math.cos(al) - 2*R*Math.cos(phiC*RAD);
  const g2 = add(s.cb, mul(v2,t));
  const st = strikeOf(s);
  // where the object ball heads off, for the result text: the one contact, as the engine plays it
  const arr = PE.arrive(st.V, st.b, t), u2 = PE.collide(v2, arr.v, arr.spin, norm(sub(s.ob, g2))).obDir;
  const err = Math.atan2(s.u[0]*u2[1]-s.u[1]*u2[0], dot(s.u,u2));
  const lat = s.L*Math.sin(err);   // off the shot's line (which may cheat the pocket)
  const uC = s.uC || s.u, errC = Math.atan2(uC[0]*u2[1]-uC[1]*u2[0], dot(uC,u2)), latC = s.L*Math.sin(errC);
  const cue = {id:'c', p:[...s.cb]}; PE.strike(cue, v2, st.V, [0, st.b]);
  const sim = PE.simulate(engineTable(), [cue, {id:'o', p:[...s.ob]}], record ? {record: 3, orient: true, tMax: 14} : {tMax: 14});
  const into = id => sim.events.find(e=>e.type==='pocket' && e.ids[0]===id) || null;
  const obIn = into('o'), cbIn = into('c'), made = !!obIn && obIn.pocket === POCKETS.indexOf(s.P);
  const short = !made && !obIn && !sim.events.some(e=>e.ids[0]==='o' && e.type!=='ball') && Math.abs(latC) <= s.tol;
  return {phiC, v2, g2, u2, lat, latC, sim, made, short, scratch: !!cbIn, obIn, cbIn};
}
// the cue ball's speed at contact for a pocket-speed shot: the right hit gets the object ball to the pocket, arriving slowly
function contactSpeed(s){ return pocketSpeedFor(Math.max(1, s.L))/(Math.max(0.2, Math.cos(s.theta*RAD))*(1 + PE.C.eBall)/2); }

export function viewBoxFor(s){
  if(s.calling){ const h = H + 14, w = h*0.8; return [W/2 - w/2, -7, w, h].map(n=>n.toFixed(2)).join(' '); }   // a call: the whole table
  const pts = [s.cb, s.ob, s.P.c];
  const x0=Math.min(...pts.map(p=>p[0]))-7, x1=Math.max(...pts.map(p=>p[0]))+7;
  const y0=Math.min(...pts.map(p=>p[1]))-7, y1=Math.max(...pts.map(p=>p[1]))+7;
  let w=Math.max(x1-x0, 30), h=Math.max(y1-y0, 30/0.8);
  if(w/h > 0.8) h = w/0.8; else w = h*0.8;
  const minX=-6, maxX=W+6, minY=-6, maxY=H+6;
  if(h >= 0.72*(maxY-minY)){ h = maxY-minY+2; w = h*0.8; return [(minX+maxX)/2-w/2, minY-1, w, h].map(n=>n.toFixed(2)).join(' '); }
  const cx=(x0+x1)/2, cy=(y0+y1)/2;
  let vx = cx-w/2, vy = cy-h/2;
  vx = w <= maxX-minX ? Math.max(minX, Math.min(vx, maxX-w)) : (minX+maxX)/2 - w/2;
  vy = h <= maxY-minY ? Math.max(minY, Math.min(vy, maxY-h)) : (minY+maxY)/2 - h/2;
  return [vx,vy,w,h].map(n=>n.toFixed(2)).join(' ');
}

// Table style (Settings > Table): Bar, Club or Pro. Colours only; the cue ball, the zone and the yellow aids never change.
const STYLES = {
  pro:  {cloth:'#24609c', hi:'#2b76b4', lo:'#1b5286', cushion:'#2569a8', top:'#1d5a8f', nose:'#1a4f80', noseD:'#16446d', shelf:'#1f5689', shelfD:'#1a4f7e',
         rail:'#4b4f55', edge:'#33363b', line:'#3e4247', diamond:'#eadcbf', balls: 1.15},   // pro blue, grey rails, bright TV balls
  club: {cloth:'#1f6e3d', hi:'#27824a', lo:'#185a31', cushion:'#21753f', top:'#1a6436', nose:'#175a32', noseD:'#134c2a', shelf:'#1b6237', shelfD:'#175530',
         rail:'#6b4528', edge:'#4a2f1b', line:'#553a26', diamond:'#f1e9d6', balls: 1},      // green cloth, walnut rails
  bar:  {cloth:'#7c1f2a', hi:'#8f2733', lo:'#661823', cushion:'#82222e', top:'#6f1c27', nose:'#651a24', noseD:'#55151e', shelf:'#6c1b25', shelfD:'#5e1720',
         rail:'#2b211b', edge:'#1c1511', line:'#3a2d24', diamond:'#d9d2c3', balls: .8},     // burgundy cloth, dark laminate rails, well-used balls
};
const ST = () => STYLES[settings.tstyle] || STYLES.pro;
// the object ball's colour in this style: brighter and richer for Pro, a little faded in a bar
// Ball sets (Settings > Table): the colours of 1–7 (9–15 match), and what the stripes are painted on
// Each set also has its own finish and markings: rough/clear (the 3D surface: roughness, and a clear coat on top), shine (the 2D
// highlight: centre x/y %, radius %, strength, and how far out it stays at full strength), numFont/numWeight/numScale (the
// number), spot (the white circle's size), ring (a thin dark ring inside the circle) and stripeW (the band's height, of the ball)
const NUM_SANS = '"IBM Plex Sans", Arial, sans-serif', NUM_COND = '"Barlow Condensed", "Arial Narrow", sans-serif';
const BALL_SETS = {
  standard: {white:'#f4efe0', rough:.18, clear:0, shine:[35, 32, 45, .55, 0], numFont:NUM_SANS, numWeight:600, numScale:.92, spot:1, ring:0, stripeW:.38},   // modern gloss, crisp sans numbers
  tv:       {white:'#f4efe0', c:{1:'#f6c400', 2:'#2a6fd6', 3:'#e8322f', 4:'#e8559a', 5:'#ff7f1f', 6:'#22a65c', 7:'#8b3a2a'},   // the TV set: a pink 4, brighter colours
             rough:.07, clear:1, shine:[34, 29, 34, .9, .3], numFont:NUM_SANS, numWeight:600, numScale:1.08, spot:1.1, ring:0, stripeW:.38},   // clear-coated: a small, bright highlight and bigger numbers
  retro:    {white:'#ece0c4', c:{1:'#d9a92a', 2:'#2b4a8a', 3:'#b03a2e', 4:'#5a3a7a', 5:'#cf6f2a', 6:'#2f6b45', 7:'#6e2a24'},   // older, softer colours on ivory
             rough:.46, clear:0, shine:[38, 36, 66, .3, 0], numFont:'Georgia, "Times New Roman", serif', numWeight:700, numScale:.9, spot:1, ring:1, stripeW:.44},   // satin: a soft, broad sheen; serif numbers in a thin ring; wider stripes
  disco:    {white:'#f4efe0', rough:.06, clear:1, holo:1, shine:[34, 29, 34, .9, .3], numFont:NUM_SANS, numWeight:600, numScale:1, spot:1.06, ring:0, stripeW:.38},   // hidden (the Disco Stu easter egg): the Standard colours under a rainbow sheen that shifts as you move
  blackout: {white:'#24262a', rough:.18, clear:0, shine:[35, 32, 45, .55, 0], numFont:NUM_COND, numWeight:700, numScale:1, spot:1, ring:0, stripeW:.38},   // a very dark grey, not pure black, so the shading still reads as a ball; stripes on black instead of white
};
for(const k in BALL_SETS) BALL_SETS[k].key = k;
// the 2D balls' highlight, in this set's finish
const SHINE = () => { const [cx, cy, r, op, core] = ballSet().shine;
  return `<radialGradient id="shine" cx="${cx}%" cy="${cy}%" r="${r}%"><stop offset="0" stop-color="#fff" stop-opacity="${op}"/>${core ? `<stop offset="${core}" stop-color="#fff" stop-opacity="${op*.7}"/>` : ''}<stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` + (ballSet().holo ? HOLO('holo') : ''); };
// Disco's holographic foil in 2D: repeating diagonal rainbow bands laid over the ball (overlay keeps the white circle and the number as they are)
const HOLO = id => `<linearGradient id="${id}" x1="0" y1="0" x2=".3" y2=".3" spreadMethod="repeat">${['#ff2bd6', '#ff8a1f', '#ffe81f', '#2bff8a', '#1fc8ff', '#7a3bff', '#ff2bd6'].map((c, i)=>`<stop offset="${(i/6).toFixed(3)}" stop-color="${c}" stop-opacity=".95"/>`).join('')}</linearGradient>`;
const SHEEN = (cx, cy, r) => (ballSet().holo ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#holo)" style="mix-blend-mode:overlay"/>` : '') + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#shine)"/>`;
const ballSet = () => BALL_SETS[settings.ballSet] || BALL_SETS.standard;
// table styles and ball sets open up as you climb: Bar and Standard to start, Pro and Blackout at the top (S)
export const LOOK_AT = {tstyle: {bar: 0, club: SH.throw, pro: SH.all}, ballSet: {standard: 0, retro: SH.any, tv: SH.draw, blackout: SH.all, disco: 0}};
export const LOOK_NAME = {club: 'Club table', pro: 'Pro table', retro: 'Retro balls', tv: 'TV balls', blackout: 'Blackout balls'};
const lookOpen = (key, val) => key === 'ballSet' && val === 'disco' ? !!settings.discoGot : DEV || ladderBest() >= (LOOK_AT[key][val] ?? 99);
const bestLook = key => Object.keys(LOOK_AT[key]).filter(v=>v !== 'disco' && lookOpen(key, v)).pop();   // the last one you've opened
addLookUnlocks();
function ballCol(s){
  const num = +s.color[1], set = ballSet().c, c = set && num !== 8 ? set[num > 8 ? num - 8 : num] || s.color[0] : s.color[0], k = ST().balls; if(k === 1) return c;
  const v = [1, 3, 5].map(i=>parseInt(c.slice(i, i + 2), 16)), g = (v[0] + v[1] + v[2])/3;
  return '#' + v.map(x=>Math.max(0, Math.min(255, Math.round((g + (x - g)*k)*(k < 1 ? .9 : 1))))).map(x=>x.toString(16).padStart(2, '0')).join('');
}
function applyStyle(){
  const S = ST(), n = h => parseInt(h.slice(1), 16);
  if(G3) G3.setColors({cloth: n(S.cloth), shelf: n(S.shelf), cushion: n(S.cushion), nose: n(S.nose), rail: n(S.rail), railEdge: n(S.edge), diamond: n(S.diamond)});
  pcache.key = null;
  if(window.Music && Music.setStyle) Music.setStyle(settings.ballSet === 'disco' ? 'disco' : 'normal');   // the Disco balls bring the disco tunes
  renderRadio();   // and their names
}
function tableSVG(s, reveal){
  let o = `<defs>
    <radialGradient id="feltg" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="${ST().hi}"/><stop offset="1" stop-color="${ST().lo}"/></radialGradient>
    <radialGradient id="cbg" cx="38%" cy="35%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#efe9d8"/><stop offset="1" stop-color="#cfc6ae"/></radialGradient>
    ${SHINE()}
  </defs>`;
  o += `<rect x="-6" y="-6" width="${W+12}" height="${H+12}" rx="2.5" fill="${ST().rail}"/>`;
  o += `<rect x="-5.2" y="-5.2" width="${W+10.4}" height="${H+10.4}" rx="2" fill="none" stroke="${ST().line}" stroke-width=".35"/>`;
  o += `<rect x="-1.6" y="-1.6" width="${W+3.2}" height="${H+3.2}" fill="${ST().shelfD}"/>`;
  o += `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#feltg)"/>`;
  const dm = [];
  for(const x of [1,2,3].map(i=>i*W/4)){ dm.push([x,-3.6],[x,H+3.6]); }
  for(const y of [1,2,3,5,6,7].map(i=>i*H/8)){ dm.push([-3.6,y],[W+3.6,y]); }
  for(const [x,y] of dm) o += `<path d="M${x} ${y-.55}L${x+.35} ${y}L${x} ${y+.55}L${x-.35} ${y}Z" fill="${ST().diamond}"/>`;
  o += `<line x1="0" y1="${H*.75}" x2="${W}" y2="${H*.75}" stroke="#ffffff" stroke-opacity=".12" stroke-width=".18"/>`;
  o += `<circle cx="${W/2}" cy="${H/4}" r=".4" fill="#111" fill-opacity=".85"/><circle cx="${W/2}" cy="${H/4}" r=".12" fill="#fff"/>`;
  for(const p of POCKETS){ o += `<circle cx="${p.c[0]}" cy="${p.c[1]}" r="${pocketR(p)}" fill="#080808"/>`; }
  const P = s.P;
  if(!s.calling) o += `<circle cx="${P.c[0]}" cy="${P.c[1]}" r="${pocketR(P)+1}" fill="none" stroke="#ffd34d" stroke-width=".45"/>`;   // (under the Run-outs picker nothing is marked: the pockets are yours to pick)

  if(reveal){
    const {cb,ob,gb,u,v,n,theta} = s;
    const cueEnd = add(gb, mul(v, 7));
    const pe = pocketEdge(ob, P, s.T);
    o += `<line x1="${f2(ob[0])}" y1="${f2(ob[1])}" x2="${f2(pe[0])}" y2="${f2(pe[1])}" stroke="#ffd34d" stroke-width=".3" stroke-dasharray="1 .7"/>`;
    if(s.pick && s.pick.far && !s.noHit){
      const pk = s.pick, col = pk.made ? NEAR_MISS_OK : MISS, end = add(ob, mul(pk.u2, s.L+3));
      o += `<line x1="${f2(ob[0])}" y1="${f2(ob[1])}" x2="${f2(end[0])}" y2="${f2(end[1])}" stroke="${col}" stroke-width=".3" stroke-dasharray="1 .7"/>`;
      o += `<circle cx="${f2(pk.g2[0])}" cy="${f2(pk.g2[1])}" r="${R}" fill="none" stroke="${col}" stroke-width=".2" stroke-dasharray=".5 .35"/>`;
    }
    o += `<line x1="${f2(cb[0])}" y1="${f2(cb[1])}" x2="${f2(cueEnd[0])}" y2="${f2(cueEnd[1])}" stroke="#ffffff" stroke-opacity=".8" stroke-width=".25"/>`;
    o += `<circle cx="${f2(gb[0])}" cy="${f2(gb[1])}" r="${R}" fill="#ffffff" fill-opacity=".12" stroke="#ffffff" stroke-width=".22" stroke-dasharray=".5 .35"/>`;
    if(theta > 2){
      const r = 5.2, a = add(gb, mul(v,r)), b = add(gb, mul(n,r));
      const cross = v[0]*n[1]-v[1]*n[0];
      o += `<path d="M${f2(a[0])} ${f2(a[1])}A${r} ${r} 0 0 ${cross>0?1:0} ${f2(b[0])} ${f2(b[1])}" fill="none" stroke="#ffd34d" stroke-width=".28"/>`;
      const lp = add(gb, mul(norm(add(n,v)), r+3));
      o += `<g font-family="IBM Plex Mono, monospace" font-size="2.1" font-weight="500" text-anchor="middle" dominant-baseline="middle"><rect x="${f2(lp[0]-3.6)}" y="${f2(lp[1]-1.6)}" width="7.2" height="3.2" rx=".8" fill="#0b1a26" fill-opacity=".85"/><text x="${f2(lp[0])}" y="${f2(lp[1]+.1)}" fill="#ffd34d">${theta.toFixed(1)}°</text></g>`;
    }
  }
  const ball = (p, fill, num) => {
    let b = `<circle cx="${f2(p[0]+.25)}" cy="${f2(p[1]+.3)}" r="${R}" fill="#000" fill-opacity=".28"/>`;
    b += `<circle cx="${f2(p[0])}" cy="${f2(p[1])}" r="${R}" fill="${fill}"/>`;
    if(num){ const B = ballSet(), rs = .5*B.spot;
      b += `<circle cx="${f2(p[0])}" cy="${f2(p[1])}" r="${f2(rs)}" fill="#fff"/>` + (B.ring ? `<circle cx="${f2(p[0])}" cy="${f2(p[1])}" r="${f2(rs*.86)}" fill="none" stroke="#111" stroke-width=".035"/>` : '')
        + `<text x="${f2(p[0])}" y="${f2(p[1]+.04)}" font-size="${f2(.65*B.numScale)}" font-family='${B.numFont}' font-weight="${B.numWeight}" text-anchor="middle" dominant-baseline="middle" fill="#111">${num}</text>`; }
    b += SHEEN(f2(p[0]), f2(p[1]), R);
    return b;
  };
  for(const x of s.extra || []) o += ball(x.p, ballCol(x), x.color[1]);   // S: the other balls on the table
  o += ball(s.ob, ballCol(s), s.color[1]);
  o += ball(s.cb, 'url(#cbg)');
  return o;
}

const VIEWS = {
  stand:{back:20, h:38, pitch:-30, hfov:72, yawMix:.45},   // looking out along the shot, not down at your feet: the cue ball is kept in frame below
  down: {back:14, h:7.5, pitch:-15, hfov:82, yawMix:.4},
};
const cross3=(a,b)=>[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const dot3=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const norm3=a=>{const l=Math.hypot(a[0],a[1],a[2]);return [a[0]/l,a[1]/l,a[2]/l];};
const VW=600, NEAR=0.6;
let VH=400;   // grows with the table box on desktop

// Build a camera from an eye position, a look direction and a horizontal field of view.
function camFrom(E, f, hfov){
  const right = norm3(cross3([0,0,1], f)), up = cross3(f, right);
  const focal = (VW/2)/Math.tan(hfov/2*RAD);
  const toCam = P=>{const q=[P[0]-E[0],P[1]-E[1],P[2]-E[2]];return [dot3(q,right),dot3(q,up),dot3(q,f)];};
  const proj = c=>[VW/2 + focal*c[0]/c[2], VH/2 - focal*c[1]/c[2]];
  const unproject = (px, py, z)=>{
    const x=(px-VW/2)/focal, y=-(py-VH/2)/focal;
    const dir=[right[0]*x+up[0]*y+f[0], right[1]*x+up[1]*y+f[1], right[2]*x+up[2]*y+f[2]];
    if(Math.abs(dir[2])<1e-6) return null;
    const t=(z-E[2])/dir[2];
    return t>0 ? [E[0]+dir[0]*t, E[1]+dir[1]*t] : null;
  };
  return {E, f, hfov, toCam, proj, focal, unproject};
}
// ---------- walk around the cue ball (Normal mode) ----------
// Dragging swings the eye around a vertical axis through the cue ball, as you do at the table: the cue ball stays put under your bridge.
// The pivot: the focus button (or V) swaps the drag between swinging round the cue ball and round the object ball. It's
// only for reading the shot: a new shot, and anything the shot does (calling, stepping in, getting down, the stroke, the
// shot, standing up, a replay), puts it back on the cue ball, and the button's face with it.
const pivot = {id: 'c', s: null, from: null, t0: 0, raf: 0};
const calmNow = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
function pivotBall(s, id){   // where that ball is drawn now (after the shot, where it stopped)
  if(id === 'c') return s.cb;
  return S.answered && s.final ? s.final.ob : s.ob;
}
function pivotPt(s){
  if(s !== S.shot) return s.cb;
  if(pivot.s !== s){ pivot.s = s; pivot.id = 'c'; pivot.from = null; }   // each shot starts on the cue ball
  const P = pivotBall(s, pivot.id) || s.cb;
  if(!pivot.from) return P;
  const u = Math.min(1, (performance.now() - pivot.t0)/250);
  if(u >= 1){ pivot.from = null; return P; }
  return add(pivot.from, mul(sub(P, pivot.from), ease(u)));
}
function pivotBusy(s){ const c = s && s.cam; return !s || !!(S.anim || cueStroke || s.replay || look.k > 0 || (tut.on && tut.zb > 0) || s.swapA != null || (c && (c.moving || c.k > 0))); }   // stepping in, down on it, coming up (back up, k is 0 again)
const pivotOk = () => walkOn() && !!S.shot && settings.view !== 'top' && !pivotBusy(S.shot) && $('startcover').hidden;
function setPivot(id){
  const s = S.shot; if(!s) return;
  const from = pivotPt(s);
  if(id !== pivot.id){ pivot.from = calmNow() ? null : from; pivot.t0 = performance.now(); pivot.id = id; }
  cancelAnimationFrame(pivot.raf);
  const step = () => {   // the glide, then one last frame without it
    const on = pivot.from && performance.now() - pivot.t0 < 250;
    if(S.shot === s && !S.anim) draw(S.answered);
    pivot.raf = on ? requestAnimationFrame(step) : 0;
  };
  pivot.raf = requestAnimationFrame(step);
  syncFocusBtn();
}
function pivotToggle(){
  if(!pivotOk() || !pivotBall(S.shot, 'o')) return false;
  pivotPt(S.shot); setPivot(pivot.id === 'c' ? 'o' : 'c'); tutLook('swap', pivot.id); return true;
}
// The focus button, next to the eye: a ring like the eye's, with the cue ball's red dot while the view turns round the
// cue ball and without it while it turns round the object ball.
// It's there when the drag is, and greyed out while the shot has the view (stepping in, down, the stroke, a replay).
function syncFocusBtn(){
  const w = $('focuswrap'), b = $('focusbtn'); if(!w || !b) return;
  const on = walkOn() && isShooting() && settings.view !== 'top' && !!S.shot;
  if(w.hidden === on) w.hidden = !on;
  if(!on) return;
  const s = S.shot; if(pivot.s !== s) pivotPt(s);
  const o = pivot.id === 'o', dis = !pivotOk();
  if(b.disabled !== dis) b.disabled = dis;
  if(b.getAttribute('aria-pressed') === String(o)) return;
  b.setAttribute('aria-pressed', o ? 'true' : 'false');
  b.setAttribute('aria-label', o ? 'Look around the cue ball' : 'Look around the object ball');
}
function walkCam(s, view){
  const base = makeCam(s, view), a = S.walk.ang * S.walk.blend, P = pivotPt(s);
  // up/down: swing the eye over the pivot ball in the vertical plane, tilting the view to match
  const r0 = [base.E[0]-P[0], base.E[1]-P[1]], hd = len(r0), dz = base.E[2] - R;
  const el0 = Math.atan2(dz, hd), dist = Math.hypot(hd, dz);
  const el = Math.max(3*RAD, Math.min(80*RAD, el0 + (S.walk.el||0) * S.walk.blend));
  let rel = rot(mul(r0, dist*Math.cos(el)/hd), a);
  if(!(s.cam && s.cam.phase === 'down' && s.cam.k > .5)){   // walking around, you stay outside the table
    const hr = len(rel), need = standMin(s, mul(rel, -1/hr), P);
    if(hr < need) rel = mul(rel, need/hr);
  }
  const E = [P[0] + rel[0], P[1] + rel[1], R + dist*Math.sin(el)];
  const fh = rot([base.f[0], base.f[1]], a), p0 = Math.asin(base.f[2]), p1 = p0 - (el - el0), c1 = Math.cos(p1)/Math.hypot(fh[0], fh[1]);
  return camFrom(E, norm3([fh[0]*c1, fh[1]*c1, Math.sin(p1)]), base.hfov);
}
// in a lesson the eye works too: stepping back blends the lesson's camera with the whole-table view
function makeCam(s, view){
  const c = makeCam0(s, view);
  if(!(tut.on && look.k > 0 && view !== 'top')) return c;
  const o = overviewCam(s), k = ease(look.k), mix = (a, b) => a.map((x, i)=>x + (b[i]-x)*k);
  return camFrom(mix(c.E, o.E), norm3(mix(c.f, o.f)), c.hfov + (o.hfov - c.hfov)*k);
}
function makeCam0(s, view){
  if(settings.task === 'flash' && view !== 'top') view = settings.flashView === 'down' ? 'down' : 'stand';   // Flash: standing or down, picked before you start
  if(isShooting() && view !== 'top' && (!tut.on || (s.cam && s.cam.tutDown))) return shootCam(s, view);
  const c0 = VIEWS[view];
  if(tut.on && tut.zb > 0){   // tutorial close-up, blended with the game view while the camera moves
    // eye low on the cue ball's path, a little short of the ghost ball, so the overlap reads side by side
    const E = [s.gb[0] - s.v[0]*16, s.gb[1] - s.v[1]*16, R*2.2], T = [(s.ob[0]+s.gb[0])/2, (s.ob[1]+s.gb[1])/2, R];
    const d = Math.hypot(T[0]-E[0], T[1]-E[1], T[2]-E[2]);
    const zf = norm3([T[0]-E[0], T[1]-E[1], T[2]-E[2]]), zh = 2*Math.atan(5*R/d)/RAD;
    if(tut.zb >= 1) return camFrom(E, zf, zh);
    const g = makeCamBase(s, view), k = tut.zb, mix = (a, b) => a.map((x, i)=>x + (b[i]-x)*k);
    return camFrom(mix(g.E, E), norm3(mix(g.f, zf)), g.hfov + (zh - g.hfov)*k);
  }
  return makeCamBase(s, view);
}
function makeCamBase(s, view){
  const c = VIEWS[view];
  const d = norm(sub(s.ob, s.cb));
  let eye, look;
  if(stanceAim() || settings.task === 'flash'){ eye = sub(s.cb, mul(s.v, view === 'stand' ? standBackFor(s, s.v, c.back) : c.back)); look = s.v; }      // on the correct shot line (Flash always: the aim line)
  else { eye = sub(s.cb, mul(d, view === 'stand' ? standBackFor(s, d, c.back) : c.back)); look = d; }
  const E = [eye[0], eye[1], c.h];
  // Tilt just enough to keep both the cue ball and the target pocket in frame (like lifting your eyes).
  const hd = P=>Math.max(0.1, (P[0]-E[0])*look[0] + (P[1]-E[1])*look[1]);
  const aCB = Math.atan2(R - c.h, hd(s.cb)), aP = Math.atan2(1.6 - c.h, hd(s.P.c));
  const at = hfov => {
    const vHalf = Math.atan((VH/2)/((VW/2)/Math.tan(hfov/2*RAD))), mg = 5*RAD;
    let pr = c.pitch*RAD;
    if(aP > pr + vHalf - mg) pr = aP - vHalf + mg;
    if(aCB < pr - vHalf + mg) pr = aCB + vHalf - mg;
    return camFrom(E, norm3([look[0]*Math.cos(pr), look[1]*Math.cos(pr), Math.sin(pr)]), hfov);
  };
  if(view === 'stand' && IS_PHONE) for(const hf of PHONE_STAND_FOVS){ const cam = at(hf); if(shotInFrame(cam, s)) return cam; }   // phones: as camAlong
  return at(c.hfov);
}
function clipNear(pts){
  const out=[];
  for(let i=0;i<pts.length;i++){
    const a=pts[i], b=pts[(i+1)%pts.length], ia=a[2]>=NEAR, ib=b[2]>=NEAR;
    if(ia) out.push(a);
    if(ia!==ib){const t=(NEAR-a[2])/(b[2]-a[2]); out.push([a[0]+t*(b[0]-a[0]), a[1]+t*(b[1]-a[1]), NEAR]);}
  }
  return out;
}
function polyD(cam, pts3){
  const c = clipNear(pts3.map(cam.toCam));
  if(c.length<3) return '';
  return 'M'+c.map(p=>cam.proj(p).map(n=>n.toFixed(1)).join(' ')).join('L')+'Z';
}
function segD(cam, A, B){
  let a=cam.toCam(A), b=cam.toCam(B);
  if(a[2]<NEAR && b[2]<NEAR) return '';
  if(a[2]<NEAR){const t=(NEAR-a[2])/(b[2]-a[2]); a=[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1]),NEAR];}
  if(b[2]<NEAR){const t=(NEAR-b[2])/(a[2]-b[2]); b=[b[0]+t*(a[0]-b[0]),b[1]+t*(a[1]-b[1]),NEAR];}
  const p=cam.proj(a), q=cam.proj(b);
  return `M${p[0].toFixed(1)} ${p[1].toFixed(1)}L${q[0].toFixed(1)} ${q[1].toFixed(1)}`;
}
const rect3=(m,z)=>[[-m,-m,z],[W+m,-m,z],[W+m,H+m,z],[-m,H+m,z]];
const circ3=(c,r,z,n=28)=>Array.from({length:n},(_,i)=>[c[0]+r*Math.cos(i/n*2*Math.PI), c[1]+r*Math.sin(i/n*2*Math.PI), z]);

let lastCam = null;
// The target pocket must be on screen, with a margin, from where you stand for this shot.
export function pocketInView(s){
  const cam = makeCam(s, settings.view);
  const m = 24;
  return ringArc3(s.P).every(pt=>{
    const c = cam.toCam(pt); if(c[2] <= NEAR) return false;
    const [x,y] = cam.proj(c); return x>=m && x<=VW-m && y>=m && y<=VH-m;
  });
}
// The part of a pocket's circle that lies outside the playing surface (the cut in cushion and rail).
// closed=true adds the corner point / chord so it can be filled.
function pocketArc(p, r, z, closed){
  const inward = p.side ? p.n : norm(sub([W/2,H/2], p.c));
  const a0 = Math.atan2(inward[1], inward[0]);
  const out = [];
  for(let k=1;k<48;k++){
    const a = a0 + k/48*2*Math.PI, x = p.c[0]+r*Math.cos(a), y = p.c[1]+r*Math.sin(a);
    if(x<0 || x>W || y<0 || y>H) out.push([x,y,z]);
  }
  if(closed && !p.side) out.push([p.c[0], p.c[1], z]);
  return out;
}
function convexHull(P){
  const pts = P.slice().sort((a,b)=>a[0]-b[0] || a[1]-b[1]);
  if(pts.length<3) return pts;
  const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const lo=[], up=[];
  for(const q of pts){ while(lo.length>=2 && cr(lo[lo.length-2],lo[lo.length-1],q)<=0) lo.pop(); lo.push(q); }
  for(const q of pts.slice().reverse()){ while(up.length>=2 && cr(up[up.length-2],up[up.length-1],q)<=0) up.pop(); up.push(q); }
  return lo.slice(0,-1).concat(up.slice(0,-1));
}
// The perspective drawing is split into layers so a frame only rebuilds what moves: the table behind the balls and
// the near rails in front of them are kept until the camera, the shot or the window changes.
let pcache = {key: null}, shotSeq = 0;
function tableSegs(){
  const e = PK[0]/Math.SQRT2, sd = PK[1]/2;
  return [
    [[e,0],[W-e,0],[0,1]], [[W-e,H],[e,H],[0,-1]],
    [[0,H/2-sd],[0,e],[1,0]], [[0,H-e],[0,H/2+sd],[1,0]],
    [[W,e],[W,H/2-sd],[-1,0]], [[W,H/2+sd],[W,H-e],[-1,0]],
  ];
}
function perspSVG(s, reveal, view){
  if(s === S.shot && pivot.s === s && pivot.id !== 'c' && pivotBusy(s)) setPivot('c');   // the shot is seen from the cue ball
  if(s === S.shot) syncFocusBtn();
  const cam = (S.walk && S.walk.blend > 0) ? walkCam(s, view) : makeCam(s, view); lastCam = cam;
  if(!s.seq) s.seq = ++shotSeq;
  const f = [cam.toCam([0,0,0]), cam.toCam([W,H,1.6]), cam.toCam([W,0,0])].flat().map(x=>x.toFixed(3)).join(',');
  const key = [VW, VH, curTable, settings.tstyle, reveal ? 1 : 0, s.seq, f].join('|');
  if(key !== pcache.key){
    const segs = tableSegs();
    const ringArc = ringArc3(s.P).map(cam.toCam).filter(c=>c[2]>NEAR).map(cam.proj);
    const ring = !G3 && ringArc.length>1 ? 'M'+ringArc.map(q=>q[0].toFixed(1)+' '+q[1].toFixed(1)).join('L') : '';   // with the 3D table, a floating arrow marks the pocket instead
    pcache = {key, back: G3 ? '' : perspBack(cam, s, reveal, segs, ring), front: G3 ? '' : perspFront(cam, s, reveal, segs, ring),
      fx: ring && !reveal ? `<path d="${ring}" fill="none" stroke="#ffd34d" stroke-width="1.65"/>` : ''};
  }
  return {fx: s.bare ? '' : pcache.fx, back: pcache.back, dyn: perspDyn(cam, s, reveal), front: pcache.front, top: perspTop(cam, s, reveal)};
}
// the jaws: the cushion carried round from each point into the pocket, face and top, in cushion blue
function jawsSVG(cam, onlySide){
  let o = '';
  for(const g of engineTable().segs) if(g.jaw && (!onlySide || (g.n[0] === onlySide[0] && g.n[1] === onlySide[1]))){
    const f = norm(sub(g.b, g.a)), depth = Math.min(len(sub(g.b, g.a)), 1.6/Math.max(.1, dot(f, g.out))), b = add(g.a, mul(f, depth));
    const fn = [-f[1], f[0]], face = dot(fn, g.away) < 0 ? fn : mul(fn, -1), mid = mul(add(g.a, b), .5);
    if(face[0]*(cam.E[0]-mid[0]) + face[1]*(cam.E[1]-mid[1]) > 0)   // the face looks into the pocket: drawn when it faces you
      o += `<path d="${polyD(cam,[[g.a[0],g.a[1],0],[b[0],b[1],0],[b[0],b[1],1.5],[g.a[0],g.a[1],1.5]])}" fill="${ST().noseD}"/>`;
    const r = add(g.a, mul(g.out, 1.6));
    o += `<path d="${polyD(cam,[[g.a[0],g.a[1],1.5],[b[0],b[1],1.5],[r[0],r[1],1.5]])}" fill="${ST().top}"/>`;
  }
  return o;
}
function perspBack(cam, s, reveal, segs, ring){
  let o = `<defs>
    <linearGradient id="pfelt" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox"><stop offset="0" stop-color="${ST().lo}"/><stop offset="1" stop-color="${ST().hi}"/></linearGradient>
    <radialGradient id="cbg" cx="38%" cy="35%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#efe9d8"/><stop offset="1" stop-color="#cfc6ae"/></radialGradient>
    ${SHINE()}
    <linearGradient id="room" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c0a09"/><stop offset="1" stop-color="#231a14"/></linearGradient>
  </defs><rect width="${VW}" height="${VH}" fill="url(#room)"/>`;
  o += `<path d="${polyD(cam, rect3(0,0))}" fill="url(#pfelt)"/>`;
  // head string
  o += `<path d="${segD(cam,[0,H*.75,0.01],[W,H*.75,0.01])}" stroke="#fff" stroke-opacity=".12" stroke-width="0.75"/>`;
  o += `<path d="${polyD(cam, circ3([W/2, H*.25], .4, .012, 16))}" fill="#111" fill-opacity=".85"/><path d="${polyD(cam, circ3([W/2, H*.25], .12, .014, 12))}" fill="#fff"/>`;   // the foot spot: black disc, white centre
  // Pockets are holes cut through the cushion and rail: the dark walls go down to the slate,
  // the cushions stop at the jaws, and the rail is cut away only outside the playing surface.
  for(const p of POCKETS){
    const pts = [...pocketArc(p, pocketR(p), 1.6, true), ...pocketArc(p, pocketR(p), -0.4, true)]
      .map(cam.toCam).filter(c=>c[2]>NEAR).map(cam.proj);
    const hull = convexHull(pts);
    if(hull.length>2){
      // depth: black at the bottom, the far inner wall catching a little light
      const top = cam.toCam([p.c[0], p.c[1], 1.6]);
      const gid = 'pk' + POCKETS.indexOf(p), ys = hull.map(q=>q[1]), yTop = Math.min(...ys), yBot = Math.max(...ys);
      o += `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="0" y1="${yTop.toFixed(1)}" x2="0" y2="${yBot.toFixed(1)}"><stop offset="0" stop-color="#121110"/><stop offset=".5" stop-color="#070707"/><stop offset="1" stop-color="#020202"/></linearGradient>`;
      o += `<path d="M${hull.map(q=>q[0].toFixed(1)+' '+q[1].toFixed(1)).join('L')}Z" fill="url(#${gid})"/>`;
    }
  }
  for(const [a,b,n] of segs){                       // cushion noses facing the eye
    const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];
    if(n[0]*(cam.E[0]-mid[0]) + n[1]*(cam.E[1]-mid[1]) <= 0) continue;
    o += `<path d="${polyD(cam,[[a[0],a[1],0],[b[0],b[1],0],[b[0],b[1],1.5],[a[0],a[1],1.5]])}" fill="${ST().noseD}"/>`;
  }
  for(const [a,b,n] of segs){                       // cushion tops, nose to rail
    o += `<path d="${polyD(cam,[[a[0],a[1],1.5],[b[0],b[1],1.5],[b[0]-n[0]*1.6,b[1]-n[1]*1.6,1.5],[a[0]-n[0]*1.6,a[1]-n[1]*1.6,1.5]])}" fill="${ST().top}"/>`;
  }
  o += `<path d="${polyD(cam,rect3(6,1.6))}${polyD(cam,rect3(1.6,1.6))}" fill="${ST().rail}" fill-rule="evenodd"/>`;
  o += `<path d="${polyD(cam,rect3(6,1.6))}" fill="none" stroke="${ST().line}" stroke-width="0.75"/>`;
  for(const p of POCKETS){
    o += `<path d="${polyD(cam, pocketArc(p, pocketR(p), 1.61, true))}" fill="#080808"/>`;
  }
  o += jawsSVG(cam);
  for(const x of [1,2,3].map(i=>i*W/4)) for(const y of [-3.6,H+3.6]) o += `<path d="${polyD(cam,circ3([x,y],.4,1.62,8))}" fill="${ST().diamond}"/>`;
  for(const y of [1,2,3,5,6,7].map(i=>i*H/8)) for(const x of [-3.6,W+3.6]) o += `<path d="${polyD(cam,circ3([x,y],.4,1.62,8))}" fill="${ST().diamond}"/>`;
  o += ring && reveal ? `<path d="${ring}" fill="none" stroke="#ffd34d" stroke-width="1.65"/>` : '';   // before the call it sits in #tablefx

  return o;
}
// the after-shot references, each its own switch in Settings (Table)
const refOn = k => settings[k] !== '0';
// with other balls on the table (S), a soft white ring on the cloth marks the object ball until the shot is played
// (it fades out over half a second once you've called the shot, rather than vanishing)
const OB_MARK_FADE = 500;
function obMarkA(){
  const s = S.shot; if(!s || s.bare || !s.extra || !s.extra.length) return 0;
  if(!S.answered){ s.markOff = null; return 1; }
  if(s.markOff == null) s.markOff = performance.now();
  return Math.max(0, 1 - (performance.now() - s.markOff)/OB_MARK_FADE);
}
function perspDyn(cam, s, reveal){
  let o = '';
  // Shoot: the target zone for the cue ball, and (early steps) the object ball's path to the pocket
  { const ma = obMarkA(); if(!G3 && ma > 0) o += `<path d="${polyD(cam, circ3(s.ob, R*1.45, .02, 40))}${polyD(cam, circ3(s.ob, R*1.18, .02, 40))}" fill="#f4f1ea" fill-opacity="${(.9*ma).toFixed(3)}" fill-rule="evenodd"/>`; }   // the object ball's ring
  if(s.zone && !G3) o += `<path d="${polyD(cam, circ3(s.zone.c, s.zone.r, .03, 48))}" fill="#5be0c8" fill-opacity=".16" stroke="#5be0c8" stroke-opacity=".9" stroke-width="1.2" stroke-dasharray="4 3"/>`;
  if(isShooting() && !reveal && !s.anim && !replayBare(s) && (tut.on ? tutAid('path') : shootAid('path'))){   // in a lesson, the step says (not your grade)   // not in the close-ups, where the ghost ball is moved off this pocket's contact
    const pe = pocketEdge(s.ob, s.P, s.T);
    o += `<path d="${segD(cam,[s.ob[0],s.ob[1],.03],[pe[0],pe[1],.03])}" stroke="#ffd34d" stroke-width="${DASH_W}" stroke-linecap="round" stroke-dasharray="3 4"/>`;
  }
  // the correct path to the pocket draws itself from contact on, as if the object ball were rolling along it
  if(refOn('refPath') && !s.noHit && (reveal || (s.anim && s.anim.run > 0))){
    const pe = pocketEdge(s.ob, s.P, s.T), full = len(sub(pe, s.ob)), k = reveal && !s.anim ? 1 : Math.min(1, s.anim.run/full);   // grows at the object ball's speed, stops at the hole's edge
    const end = add(s.ob, mul(sub(pe, s.ob), k));
    if(k > 0.002) o += `<path d="${segD(cam,[s.ob[0],s.ob[1],.03],[end[0],end[1],.03])}" stroke="#ffd34d" stroke-width="${DASH_W}" stroke-linecap="round" stroke-dasharray="3 4"/>`;
  }
  if(reveal && refOn('refGhost')){
    if(s.pick && s.pick.far && !s.noHit){   // your call's line and contact: only when the cue ball really struck the object ball
      const pk = s.pick, col = pk.made ? NEAR_MISS_OK : MISS, stop = s.final && s.final.stop;
      const into = pk.u2 ? dot(sub(s.P.t, s.ob), pk.u2) : 0;   // lines end at the cushion, or in the pocket if it drops
      const pts = s.final && s.final.obPath ? s.final.obPath : stop ? [s.ob, stop] : !pk.u2 ? [s.ob] : pk.made ? [s.ob, add(s.ob, mul(pk.u2, into))] : [s.ob, rayToCushion(s.ob, pk.u2)];   // the path it really ran   // a miss: the whole path it ran, cushions and all
      o += dashedLine(cam, pts, col, 1, '3 4');
      const gc = cam.toCam([pk.g2[0],pk.g2[1],R]);
      if(gc[2] > NEAR){ const [gx,gy] = cam.proj(gc); o += `<circle cx="${gx.toFixed(1)}" cy="${gy.toFixed(1)}" r="${(cam.focal*R/gc[2]).toFixed(1)}" fill="none" stroke="${col}" stroke-width="1.125" stroke-dasharray="4 3"/>`; }
    }
    const e = rayToCushion(s.gb, s.v, 7);
    if(!s.final) o += `<path d="${segD(cam,[s.cb[0],s.cb[1],R],[e[0],e[1],R])}" stroke="#fff" stroke-opacity=".85" stroke-width="1.2"/>`;   // after an animation the dotted trail replaces it
  }
  // trails: where the balls have travelled (during the animation, and the cue ball's path afterwards)
  const trail = s.anim ? s.anim.trail : (reveal && s.final ? s.final.trail : null);
  if(trail && refOn('refTrail')){
    o += dashedLine(cam, trail.cb, '#f4efe0', .6, '2 4');
    const moved = P => P && P.length > 1 && len(sub(P[P.length-1], P[0])) > 0.05;
    if(trail.ob && (s.noHit ? moved(trail.ob) : trail.obCol !== '#ffd34d')) o += dashedLine(cam, trail.ob, s.noHit ? '#f4efe0' : trail.obCol, .9, '3 4');   // on a right call the yellow line already grows along it (not when the cue ball never struck it)
    if(s.noHit && trail.x) for(const P of trail.x) if(moved(P)) o += dashedLine(cam, P, '#f4efe0', .6, '3 4');   // the cue ball hit another ball first: what really moved
  }

  // the aim-line aid: a line on the cloth from the cue ball along the shot line to the ghost ball (may be fading away)
  const lA = reveal || s.anim || replayBare(s) ? 0 : aidAlpha('line');
  if(lA > 0){ const a3 = [s.cb[0], s.cb[1], .03], b3 = [(s.gbLook || s.gb)[0], (s.gbLook || s.gb)[1], .03]; o += `<path d="${segD(cam, a3, b3)}" stroke="#fff" stroke-opacity="${(.9*lA).toFixed(3)}" stroke-width="${DASH_W}" stroke-linecap="round" stroke-dasharray="3 4"/>`; }
  // balls, far to near
  const A = s.anim, F = reveal && !A ? s.final : null;
  const cbP = A ? A.cb : F ? F.cb : s.cb;   // null once the cue ball has dropped into a pocket
  const items = s.bare || tut.on && tut.zb > 0.5 || !cbP ? [] : [{p: cbP, kind:'cb', z: A && A.cbZ != null ? Math.min(R, A.cbZ) : R, shadow: A && A.cbShadow != null ? A.cbShadow : 1, pocket: A && A.cbPocket}];   // the tutorial close-up looks from in front of the cue ball
  if(!s.bare && (A ? A.ob : F ? F.ob : true)) items.push({p: A ? A.ob : F ? F.ob : s.ob, kind:'ob', scale: A && A.obZ < R ? 1 : A ? A.obScale : 1, z: A ? A.obZ : R, shadow: A ? A.obShadow : 1, pocket: A && A.obPocket, M: A ? A.obM : F ? F.obM : null});
  // S: the other balls on the table (where the engine has them while it plays, and where they stopped)
  const xb = A && A.extra ? A.extra : F && F.extra ? F.extra : (s.extra || []).map(x=>({x, p: x.p, z: R, shadow: 1, M: null}));
  if(!s.bare && !(tut.on && tut.zb > 0.5)) for(const b of xb) if(b.p) items.push({p: b.p, kind:'xb', x: b.x, z: b.z ?? R, shadow: b.shadow ?? 1, pocket: b.pocket, M: b.M});
  const contact = A && A.trail.ob;   // the balls have met and are diverging
  // once the balls meet: a faint mark where the object ball started, so the lines out of it start from something
  // (always yellow, like the line to the pocket: a ball's own colour can vanish on the cloth)
  const obNow = A ? A.ob : F ? F.ob : null;
  const refA = A ? Math.max(0, Math.min(1, (A.tHit ?? 0)/REF_FADE)) : 1;   // the reference balls fade in just after the hit
  if(refOn('refStart') && (contact || F) && !(obNow && len(sub(obNow, s.ob)) < 2*R)) items.push({p: s.ob, kind:'obmark', a: refA});
  // where the cue ball started, once it has left: shown as you stand back up (down on the shot it would only be under your cue)
  const cbNow = A ? A.cb : F ? F.cb : null, sc = s.cam, upK = sc && sc.T && sc.phase === 'down' ? 1 - sc.k : 1;
  if(refOn('refStart') && isShooting() && (contact || F) && upK > .01 && !(cbNow && len(sub(cbNow, s.cb)) < 2*R)) items.push({p: s.cb, kind:'refcb', a: refA*upK});
  // on a miss, a see-through object ball rolls the path the right call would have sent it on, into the pocket
  if(refOn('refMiss') && A && A.obGhost) items.push({p: A.obGhost.p, kind:'ob', ghost: true, z: A.obGhost.z, shadow: A.obGhost.shadow, pocket: s.P});
  const gA = replayBare(s) ? 0 : aidAlpha('ghost');   // the ghost-ball aid, before you answer (it may be fading away)
  // once the balls meet, the ghost ball shows where your call actually made contact (on a miss that's not the ideal spot)
  const hit = !s.noHit && ((A && contact) || (reveal && !A)), yours = hit && s.pick && s.pick.far;   // (no contact with it: no contact point drawn)
  if(refOn('refGhost') && !s.noHit ? (A ? (contact || gA > 0) : (reveal || gA > 0)) : (!A && !reveal && gA > 0)) items.push({p: yours ? s.pick.g2 : hit ? s.gb : (s.gbLook || s.gb), kind:'ghost', a: hit ? Math.max(refA, yours ? 0 : gA) : gA});
  items.forEach(it=>{it.c = cam.toCam([it.p[0],it.p[1],it.z ?? R]);});
  items.sort((a,b)=>b.c[2]-a.c[2]);
  G3BALLS = [];
  for(const it of items){
    if(G3 && it.kind === 'xb'){ G3BALLS.push({id: it.x.id, kind:'ob', p:it.p, z:it.z, M:it.M, base:spotBase(it.x.spot), color:ballCol(it.x), number:it.x.color[1], white: ballSet().white, opacity: 1}); continue; }
    if(G3 && (it.kind === 'cb' || it.kind === 'ob')){   // the balls are drawn in 3D
      G3BALLS.push(it.kind === 'cb' ? {id:'cb', kind:'cb', p:it.p, z:it.z ?? R, M:(A ? A.spin.M : F ? F.spin.M : null), dots:CB_DOTS}
        : {id: it.ghost ? 'obg' : 'ob', kind:'ob', p:it.p, z:it.z ?? R, M:it.M, base:spotBase(s.spot), color:ballCol(s), number:s.color[1], white: ballSet().white, opacity: it.ghost ? .5 : 1});
      continue;
    }
    if(it.c[2] < NEAR) continue;
    const [x,y] = cam.proj(it.c), r = cam.focal*R/it.c[2]*(it.scale ?? 1);
    if(r < 0.3) continue;
    if(it.kind==='refcb'){ const ra = it.a ?? 1; o += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="#f4efe0" fill-opacity="${(.22*ra).toFixed(3)}" stroke="#f4efe0" stroke-opacity="${(.8*ra).toFixed(3)}" stroke-width=".75" stroke-dasharray="3.5 2.5"/>`; continue; }
    if(it.kind==='refob'){ o += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${ballCol(s)}" fill-opacity=".32" stroke="${ballCol(s)}" stroke-opacity=".85" stroke-width="1"/>`; continue; }
    if(it.kind==='callghost'){ o += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="${s.pick.made ? NEAR_MISS_OK : MISS}" stroke-width=".75" stroke-dasharray="3.5 2.5"/>`; continue; }
    if(it.kind==='obmark'){ o += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="#ffd34d" fill-opacity="${(.14*it.a).toFixed(3)}" stroke="#ffd34d" stroke-opacity="${(.9*it.a).toFixed(3)}" stroke-width=".75" stroke-dasharray="3.5 2.5"/>`; continue; }
    if(it.kind==='ghost'){ o += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="#fff" fill-opacity="${(.22*(it.a ?? 1)).toFixed(3)}" stroke="#fff" stroke-opacity="${(it.a ?? 1).toFixed(3)}" stroke-width=".75" stroke-dasharray="3.5 2.5"/>`; continue; }
    const itemStart = o.length, uid = items.indexOf(it);   // uid keeps clip ids apart when two balls need them
    if((it.shadow ?? 1) > 0.01) o += `<path d="${polyD(cam, circ3([it.p[0]+.2,it.p[1]+.2], R*.95*(it.scale ?? 1), .02, 20))}" fill="#000" fill-opacity="${(.35*(it.shadow ?? 1)).toFixed(3)}"/>`;
    const ballStart = o.length;
    const bs = it.kind === 'xb' ? it.x : s;   // whose colour, number and spot: the object ball's, or an extra ball's
    o += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${it.kind==='cb'?'url(#cbg)':ballCol(bs)}"/>`;
    if(it.kind==='cb'){
      // red dots on the cue ball: they turn with its spin, so you can see the stun
      const sp = A ? A.spin : F ? F.spin : null;
      const C = [it.p[0], it.p[1], it.z ?? R], toE = norm3([cam.E[0]-C[0], cam.E[1]-C[1], cam.E[2]-C[2]]);
      let dots = '';
      for(const d0 of CB_DOTS){
        const d = cbSpin(d0, sp), facing = d[0]*toE[0] + d[1]*toE[1] + d[2]*toE[2];
        if(facing <= 0.05) continue;
        const Sc = cam.toCam([C[0]+d[0]*R, C[1]+d[1]*R, C[2]+d[2]*R]); if(Sc[2] <= NEAR) continue;
        const [sx, sy] = cam.proj(Sc), rd = r*.2, a = Math.atan2(sy - y, sx - x)/RAD;
        dots += `<g transform="translate(${sx.toFixed(1)} ${sy.toFixed(1)}) rotate(${a.toFixed(1)}) scale(${facing.toFixed(3)} 1)"><circle r="${rd.toFixed(2)}" fill="#c8102e"/></g>`;
      }
      if(dots) o += `<clipPath id="cbclip${uid}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}"/></clipPath><g clip-path="url(#cbclip${uid})">${dots}</g>`;
    }
    if(it.kind==='ob' || it.kind==='xb'){
      // the number spot is painted on the ball: it rolls with it, and turns away as you walk around
      const moved = sub(it.p, it.kind==='xb' ? it.x.p : s.ob), dl = len(moved);
      let sp = bs.spot || [0,0,1];
      if(it.M) sp = matVec(it.M, sp);                                   // turned exactly as the engine rolled it
      else if(dl > 0.01) sp = rotAxis(sp, [-moved[1], moved[0], 0], dl/R);
      const C = [it.p[0], it.p[1], it.z ?? R], toE = norm3([cam.E[0]-C[0], cam.E[1]-C[1], cam.E[2]-C[2]]);
      const facing = sp[0]*toE[0] + sp[1]*toE[1] + sp[2]*toE[2];
      if(facing > 0.04){
        const Sc = cam.toCam([C[0]+sp[0]*R, C[1]+sp[1]*R, C[2]+sp[2]*R]);
        if(Sc[2] > NEAR){
          const [sx, sy] = cam.proj(Sc), rs = r*.44, BS = ballSet(), a = Math.atan2(sy - y, sx - x)/RAD;
          const tf = `translate(${sx.toFixed(1)} ${sy.toFixed(1)}) rotate(${a.toFixed(1)}) scale(${facing.toFixed(3)} 1) rotate(${(-a).toFixed(1)})`;
          o += `<clipPath id="obclip${uid}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}"/></clipPath><g clip-path="url(#obclip${uid})"><g transform="${tf}"><circle r="${(rs*BS.spot).toFixed(1)}" fill="#fff"/>${BS.ring ? `<circle r="${(rs*BS.spot*.86).toFixed(2)}" fill="none" stroke="#111" stroke-width="${(r*.03).toFixed(2)}"/>` : ''}<text y="${(r*.03).toFixed(1)}" font-size="${(r*.56*BS.numScale).toFixed(1)}" font-family='${BS.numFont}' font-weight="${BS.numWeight}" text-anchor="middle" dominant-baseline="middle" fill="#111">${bs.color[1]}</text></g></g>`;
        }
      }
    }
    o += SHEEN(x.toFixed(1), y.toFixed(1), r.toFixed(1));
    if((it.z ?? R) < R - 0.01){
      // dropping into the pocket: only what's inside the hole's opening shows, and it darkens as it goes down
      const P = it.pocket || s.P, rr = pocketR(P), ring = z => Array.from({length:28}, (_, k)=>{ const a = k/28*2*Math.PI; return [P.c[0]+rr*Math.cos(a), P.c[1]+rr*Math.sin(a), z]; });
      const hull = convexHull([...ring(0), ...ring(1.6)].map(cam.toCam).filter(c=>c[2]>NEAR).map(cam.proj));
      const dark = Math.min(.9, (R - it.z)/(3*R));
      const ball = o.slice(ballStart);
      o = o.slice(0, ballStart) + (hull.length > 2 ? `<clipPath id="holeclip${uid}"><path d="M${hull.map(q=>q[0].toFixed(1)+' '+q[1].toFixed(1)).join('L')}Z"/></clipPath><g clip-path="url(#holeclip${uid})">` : '<g>')
        + ball + `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="#000" fill-opacity="${dark.toFixed(3)}"/></g>`;
    }
    if(it.ghost) o = o.slice(0, itemStart) + `<g opacity=".5">${o.slice(itemStart)}</g>`;
  }
  if(s.swapA != null){   // the right shot coming up: what's on the table fades out, and back in where the balls started
    const a = Math.max(0, Math.min(1, s.swapA));
    o = `<g opacity="${a.toFixed(3)}">${o}</g>`;
    G3BALLS.forEach(b=>{ b.opacity = (b.opacity ?? 1)*a; });
  }
  o += cueRig(cam, s);   // your cue and bridge hand, in front of everything
  return o;
}

// ---------- your cue and bridge hand, down on the shot ----------
// Low-poly shapes in table space, drawn see-through over the table, so the cut is read around them as it is at a real table.
// Faint from Down on the shot (C-), more solid at the top of the ladder. An open bridge for now.
const rigOpacity = () => Math.max(.5, Math.min(1, (+settings.rigOpacity || 100)/100));
// Flash from Down on the shot: the same cue and hand, kept on the shot itself (s.rig), not on a Shoot camera
const flashDown = () => settings.task === 'flash' && settings.flashView === 'down' && !tut.on;
const rigCam = s => flashDown() ? s.rig : s.cam;
function rigAlpha(s){
  const td = !!(tut.on && s && s.cam && s.cam.tutDown);   // a lesson's coach down on the shot: cue and hand too
  const fl = flashDown();
  if((!shootRoutine() && !fl) || (tut.on && !td) || settings.view === 'top' || !s || s.bare) return {a:0};
  const g = shootLevel(), c = rigCam(s);
  if(!td && ((!fl && g < SH.down) || !c || !c.T)) return {a:0};
  const base = rigOpacity(),   // your setting, 50–100%
    down = c.phase === 'down' ? c.k : 0, now = performance.now();
  if(!S.answered || (s.replay && s.replay.feather)){   // settled down: slow practice strokes, 1.6" back and forth (also when the right shot is shown)
    // each practice stroke keeps the length it started with; a new speed shows from the next one, so nothing jumps
    // off the shot (standing up, stepping back) the cue stays where the stroke was as it fades: c.fHold, no clock running
    const on = c.downAt != null, cyc = on ? Math.floor((now - c.downAt)/1600) : 0;
    if(on && c.fCycle !== cyc){ c.fCycle = cyc; c.fBack = strokeBack(s); }
    const fe = on ? featherAt(now - c.downAt, c.fBack) : (c.fHold || 0);
    return {a: base*down, ac: base*down, push: fe};
  }
  if(cueStroke && cueStroke.s === s) return {a: base, ac: base, push: strokeAt(cueStroke, now)};
  if(!s.follow) return {a:0};
  if(!S.anim) return {a: base*down, ac: base*down, push: s.follow};   // the shot's played: cue and hand stay until you stand up
  const t = now - S.anim.t0, k = Math.min(1, t/150);   // contact made: follow through, and hold it there
  return {a: base*down, ac: base*down, push: s.follow*(1 - (1 - k)*(1 - k))};
}
// Practice strokes: as long as the stroke you're about to play, a brief hold at the back, then forward; 1.6 s a cycle.
const strokeBack = s => (0.146*stanceIn() - 1.25 - 1.5)*strokeFrac(levelForSpeed(tut.on && tut.plan ? tut.plan.V : s.replay ? s.replay.V : shotStroke(s).V));   // a lesson: the coach's stroke
function featherAt(t, back){
  const p = (t % 1600)/1600, ease = k => (1 - Math.cos(Math.PI*k))/2;
  return p < .4 ? -back*ease(p/.4) : p < .5 ? -back : -back*(1 - ease((p - .5)/.5));
}
// The final stroke: back (further for a harder shot), a pause, then forward, faster into the ball.
export let cueStroke = null, featherRaf = 0;
const FOLLOW_THROUGH = 4;   // inches past the cue ball, every stroke
function strokeAt(st, now){
  if(now < st.t0 - st.tp){ const k = Math.min(1, (now - st.t1)/Math.max(1, st.ft)); return st.x0*(1 + Math.cos(Math.PI*k))/2; }   // the practice stroke you were in comes forward to the ball
  if(now < st.t0) return 0;                                                          // a beat at the ball
  const t = now - st.t0;
  if(t < st.tb){ const k = t/st.tb; return st.from + (-st.back - st.from)*(1 - Math.cos(Math.PI*k))/2; }
  if(t < st.tb + st.tp) return -st.back;
  const k = Math.min(1, (t - st.tb - st.tp)/st.tf);
  return -st.back*(1 - k*k);
}
// Once the balls have stopped, made or missed, you stand back up (behind the aim line) and the hand comes off the table.
function standUp(s){
  const c = rigCam(s);
  if(!c || !c.T || c.phase !== 'down' || !(shootRoutine() || flashDown())) return;
  const t0 = performance.now(), k0 = c.k, tw = c.tw = (c.tw || 0) + 1;   // the newest move owns the camera
  const tick = now => {
    if(S.shot !== s || c.tw !== tw) return;
    c.k = k0*(1 - ease(Math.min(1, (now - t0)/600)));
    if(!S.anim) draw(true);   // while the balls still run, their animation redraws
    if(c.k > 0) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
// Getting off the shot: the practice strokes stop where they are (the clock's dropped, so an old one can't come back)
function featherOff(s){
  cancelAnimationFrame(featherRaf); featherRaf = 0;
  const c = rigCam(s); if(!c) return;
  if(c.downAt != null){ c.fHold = rigAlpha(s).push || 0; c.downAt = null; }
}
// Settled down: the strokes start from the cue at the ball, or, back down before the cue left the table,
// carry on forward from where it stopped, so it never jumps
function featherStart(c){
  const now = performance.now(), h = c.fHold || 0, b = c.fBack || 0;
  c.fHold = 0;
  if(h < -.01 && b > .01){ const e = Math.max(0, Math.min(1, 1 + h/b)); c.downAt = now - 800*(1 + Math.acos(1 - 2*e)/Math.PI); c.fCycle = 0; }   // featherAt's forward half, at h
  else { c.downAt = now; c.fCycle = null; }
}
function featherLoop(s){   // keeps the practice strokes moving while you're down and haven't called
  cancelAnimationFrame(featherRaf);
  const tick = ()=>{ if(S.shot !== s || S.answered || !(shootRoutine() || flashDown()) || (tut.on && !(s.cam && s.cam.tutDown)) || rigAlpha(s).a < .01) return; draw(false); featherRaf = requestAnimationFrame(tick); };
  featherRaf = requestAnimationFrame(tick);
}
// Glove and hand colours (Settings, any colour): a black glove and a grey hand to start.
const isHex = c => /^#[0-9a-f]{6}$/i.test(c || '');
const GLOVE_DEF = '#1a1a1a', HAND_DEF = '#8a8f96';
const strapOf = c => { const l = [1, 3, 5].reduce((t, i)=>t + parseInt(c.slice(i, i + 2), 16), 0)/3; return l < 70 ? shadeHex(c, 1, 60) : shadeHex(c, .8); };   // a little lighter on a dark glove, darker on a light one
const LIGHT = norm3([-.25, .35, .9]);
const shadeHex = (hex, k, add = 0) => '#' + [1, 3, 5].map(i=>Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16)*k + add)).toString(16).padStart(2, '0')).join('');
function cueRig(cam, s){
  const {a, ac, push} = rigAlpha(s);
  if(a < .01) return '';
  const u = s.aimDir || norm(sub(s.gbLook || s.gb, s.cb)), n = [-u[1], u[0]];   // forward along the aim line you called
  const sd = settings.hand === 'L' ? n : mul(n, -1);                        // the bridge hand's side: on screen left of the cue for a right-handed player (n points to screen right)
  const tip = (s.replay ? s.replay.tip : tut.on && tut.plan ? tut.plan.tip : shotStroke(s).tip) || [0, 0], tx = tip[0], ty = tip[1], dz = Math.sqrt(Math.max(0, 1 - tx*tx - ty*ty));   // a lesson: the coach's (or the try's) tip
  const Cp = [s.cb[0] - u[0]*dz*R + n[0]*tx*R, s.cb[1] - u[1]*dz*R + n[1]*tx*R, R + ty*R];   // where the tip meets the cue ball (side: n is screen right, as in the engine)
  const C0 = [s.cb[0] - u[0]*R, s.cb[1] - u[1]*R];   // the back of the ball, straight on: the bridge lines up behind it whatever the side
  // How steep the cue is: a touch more with top, a touch less with draw (you keep it level to hit low), and as steep as it
  // has to be to clear the cushion behind the cue ball (the butt has to pass over the rail).
  const bg = bridgeGeom(s, u, ty), EL = bg.EL, zf = bg.zf;   // on the cloth, on the rail, or over a ball (bridgeGeom)
  // the bridge: where the cue rests. With side the whole cue moves over, parallel to your line (as the engine strikes it), so the
  // only angle you see between cue and cue ball is the real squirt of your shaft (about 2.5° maple, 1.8° or less LD, near the limit)
  const Lb = bg.Lb, Bq = [C0[0] - u[0]*Lb + n[0]*tx*R, C0[1] - u[1]*Lb + n[1]*tx*R, Cp[2] + Lb*Math.tan(EL)];
  const f3 = norm3([Cp[0] - Bq[0], Cp[1] - Bq[1], Cp[2] - Bq[2]]);   // the cue runs from the bridge to the tip
  const at = (P, d) => [P[0] - f3[0]*d, P[1] - f3[1]*d, P[2] - f3[2]*d];   // d inches back along the cue from P
  const faces = [];   // [pts3, fill]
  // the cue: a tapered band facing the eye, 58" long, tip 13 mm, butt 1.2"
  const T0 = at(Cp, 0.4 - push), LEN = 58, cueR = t => .255 + t*(.6 - .255);
  const st = [0, 1, 6, 16, 29, 36, 44, 54, 58];
  for(let i = 0; i < st.length - 1 && ac >= .01; i++){
    const A = at(T0, st[i]), B = at(T0, st[i+1]);
    const side = P => { const v = norm3([cam.E[0]-P[0], cam.E[1]-P[1], cam.E[2]-P[2]]), w = cross3(f3, v), l = Math.hypot(...w) || 1; return [w[0]/l, w[1]/l, w[2]/l]; };
    const sa = side(A), sb = side(B), ra = cueR(st[i]/LEN), rb = cueR(st[i+1]/LEN);
    const col = i === 0 ? '#f2efe8' : st[i] >= 29 ? '#3b2a20' : myShaft() === 'carbon' ? '#2b2d31' : '#d8b57a', NS = 6;   // a carbon shaft is dark
    for(let j = 0; j < NS; j++){   // strips across the cue, shaded like a cylinder: lit along the top, darker at the edges
      const t0 = Math.sin(-Math.PI/2 + Math.PI*j/NS), t1 = Math.sin(-Math.PI/2 + Math.PI*(j + 1)/NS), lit = Math.cos(-Math.PI/2 + Math.PI*(j + .5)/NS);
      const P = (C, sv, rr, k) => [C[0] + sv[0]*rr*k, C[1] + sv[1]*rr*k, C[2] + sv[2]*rr*k];
      faces.push([[P(A, sa, ra, t0), P(B, sb, rb, t0), P(B, sb, rb, t1), P(A, sa, ra, t1)], shadeHex(col, .55 + .45*lit), true]);
    }
  }
  // the hand: an open bridge a forearm's length (less 1¼") behind the cue ball, the cue resting in the V of thumb and index knuckle
  const Bp = [Bq[0], Bq[1]];
  const zv = Math.max(.9 + zf, Bq[2] - .3);                // the V: just under the cue (zf: the hand's floor, the cloth, the rail top, or a ball)
  const L = (x, y, z) => [Bp[0] + u[0]*x + sd[0]*y, Bp[1] + u[1]*x + sd[1]*y, z];
  const V = (x, y, z) => [u[0]*x + sd[0]*y, u[1]*x + sd[1]*y, z];
  const box = (c, ax, ay, az, col, front) => {   // centre and half-axes (world): the faces that face the eye
    const corner = (i, j, k) => [0,1,2].map(m=>c[m] + i*ax[m] + j*ay[m] + k*az[m]);
    for(const [ax2, sgn] of [[0,1],[0,-1],[1,1],[1,-1],[2,1],[2,-1]]){
      const nrm = [ax, ay, az][ax2].map(v=>v*sgn), fc = c.map((v, m)=>v + nrm[m]);
      if((cam.E[0]-fc[0])*nrm[0] + (cam.E[1]-fc[1])*nrm[1] + (cam.E[2]-fc[2])*nrm[2] <= 0) continue;
      const q = ax2 === 0 ? [corner(sgn,-1,-1), corner(sgn,1,-1), corner(sgn,1,1), corner(sgn,-1,1)]
              : ax2 === 1 ? [corner(-1,sgn,-1), corner(1,sgn,-1), corner(1,sgn,1), corner(-1,sgn,1)]
              :             [corner(-1,-1,sgn), corner(1,-1,sgn), corner(1,1,sgn), corner(-1,1,sgn)];
      const nn = norm3(nrm), lit = Math.max(0, nn[0]*LIGHT[0] + nn[1]*LIGHT[1] + nn[2]*LIGHT[2]);
      faces.push([q, shadeHex(col, .62 + .38*lit, 26*lit), false, front]);   // lit from above: tops lighter, sides darker
    }
  };
  const limb = (P, Q, w, h, col, front) => {   // a box from P to Q (local), w wide, h thick
    const a = L(...P), b = L(...Q), c = a.map((v, m)=>(v + b[m])/2), ax = a.map((v, m)=>(b[m] - v)/2);
    const hz = [0, 0, 1], wy = norm3(cross3(hz, ax)), up = norm3(cross3(ax, wy));
    box(c, ax, wy.map(v=>v*w/2), up.map(v=>v*h/2), col, front);
  };
  // the Halfball logo on the back of the glove: small (about 1½" across on a 3" palm), the site's double-ring mark
  const logo = (P, Q, h) => {
    const a = L(...P), b = L(...Q), c = a.map((v, m)=>(v + b[m])/2), f = norm3(a.map((v, m)=>b[m] - v));
    const wy = norm3(cross3([0, 0, 1], f)), up = norm3(cross3(f, wy)), T = c.map((v, m)=>v + up[m]*(h/2 + .02));
    if((cam.E[0]-T[0])*up[0] + (cam.E[1]-T[1])*up[1] + (cam.E[2]-T[2])*up[2] <= 0) return;   // the back of the hand faces away
    const zT = cam.toCam(T)[2] - .4;   // all of it drawn just over the back of the glove, in this order
    const disc = (x, y, r, col, k) => faces.push([Array.from({length: 28}, (_, i)=>{ const t2 = i/28*2*Math.PI, u = x + r*Math.cos(t2), v = y + r*Math.sin(t2);
      return T.map((q, m)=>q + f[m]*u + wy[m]*v); }), col, false, false, 0, zT - k*.01]);
    // the site's mark (favicon geometry, 32-unit grid): navy disc, gold ring, the object ball behind and up-right, half covered by the cue ball
    const S = .75/16, d2 = 2.5*S;   // 1½" across; ball centres 2.5 units off the middle on the diagonal (+f is up the screen, +wy to the right)
    disc(0, 0, 16*S, '#0f2233', 0);
    disc(0, 0, 14.4*S, '#f0bf34', 1);                  // the gold ring
    disc(0, 0, 12.6*S, '#132b40', 2);
    disc(d2, d2, 7*S, '#f5bf1e', 3);                   // the object ball (yellow)
    disc(-d2, -d2, 7.45*S, '#0f2233', 4);              // the cue ball's dark edge
    disc(-d2, -d2, 7*S, '#f7f1e3', 5);                 // the cue ball
    disc(-d2, -d2, 1.6*S, '#d8352a', 6);               // its red dot
  };
  // a pool glove: palm, thumb, index and middle fingers covered, ring and little finger bare, a strap at the wrist
  const gc = isHex(settings.glove) ? settings.glove : GLOVE_DEF, sk = isHex(settings.skin) ? settings.skin : HAND_DEF;
  if(settings.bridge === 'closed'){
    // closed bridge: the cue runs through a loop of the index finger, resting on the thumb and middle finger; the other fingers spread on the cloth
    const zc = zv + .3;   // the cue's axis here
    limb([-3.6, 1.4, zf + .55], [-.2, 1.1, zc - .95], 3.0, 1.0, gc);         // palm, a little flatter, beside and below the cue
    logo([-3.6, 1.4, zf + .55], [-.2, 1.1, zc - .95], 1.0);
    [[.6, .2], [1.4, .7], [2.1, 1.1]].forEach(([y, fan], i)=>limb([-.2, y, zc - .95], [2.4 - i*.25, y + fan, zf + .3], .62, .55, i < 1 ? gc : sk));   // middle, ring, little finger
    limb([-1.6, -.6, zc - .9], [.6, -.5, zc - .55], .6, .5, gc);             // thumb, below the cue on its far side
    limb([-.2, .7, zc - .3], [.1, .5, zc + .55], .45, .45, gc);               // index finger, up the near side,
    limb([.1, .5, zc + .55], [.25, -.5, zc + .5], .45, .4, gc, true);         // over the top of the cue (drawn over it),
    limb([.25, -.5, zc + .5], [.35, -.6, zc - .45], .4, .4, gc, true);        // and down the far side to meet the thumb
  } else {
    limb([-3.6, 1.6, zf + .55], [-.1, 1.5, zv - .35], 3.2, 1.0, gc);           // palm: heel down, knuckles up by the V
    logo([-3.6, 1.6, zf + .55], [-.1, 1.5, zv - .35], 1.0);
    [[.4, .25], [1.2, .7], [2.0, 1.15], [2.7, 1.55]].forEach(([y, fan], i)=>limb([-.1, y, zv - .55], [2.6 - i*.25, y + fan, zf + .3], .62, .55, i < 2 ? gc : sk));   // fingers spread
    limb([-1.7, -.5, zv - .85], [.8, -.45, zv - .3], .6, .55, gc);            // thumb, up beside the cue: the V it rests in
  }
  limb([-3.6, 1.6, zf + .7], [-5, 1.9, zf + 1.6], 2.6, 1.1, gc);            // wrist, under the glove's strap
  limb([-4.1, 1.7, zf + .85], [-4.7, 1.8, zf + 1.3], 2.85, 1.35, strapOf(gc));   // the strap
  limb([-5, 1.9, zf + 1.6], [-14.5, 5.8, zf + 3.9], 2.9, 2.3, sk);          // forearm, back toward the elbow, rising gently (about 13°)
  // far to near, see-through
  return faces.map(([q, col, cue, front, dz, zAt])=>({q, col, cue, front: front ? 1 : 0, z: zAt ?? q.reduce((t, P)=>t + cam.toCam(P)[2], 0)/q.length + (dz || 0)})).sort((x, y)=>(x.front - y.front) || ((x.cue ? 1 : 0) - (y.cue ? 1 : 0)) || (y.z - x.z))
    .map(({q, col, cue})=>{ const d = polyD(cam, q); return !d ? '' : cue ? `<path d="${d}" fill="${col}" fill-opacity="${ac.toFixed(3)}"/>`
      : `<path d="${d}" fill="${col}" fill-opacity="${a.toFixed(3)}"/>`; }).join('');
}
function perspFront(cam, s, reveal, segs, ring){
  let o = '';
  // Rails between the eye and the balls hide the bottom of anything behind them: redraw the near side on top.
  const sides = [
    {n:[0,1],  mid:[W/2,0], rail:[[-6,-6],[W+6,-6],[W+6,-1.6],[-6,-1.6]]},
    {n:[0,-1], mid:[W/2,H], rail:[[-6,H+1.6],[W+6,H+1.6],[W+6,H+6],[-6,H+6]]},
    {n:[1,0],  mid:[0,H/2], rail:[[-6,-6],[-1.6,-6],[-1.6,H+6],[-6,H+6]]},
    {n:[-1,0], mid:[W,H/2], rail:[[W+1.6,-6],[W+6,-6],[W+6,H+6],[W+1.6,H+6]]},
  ];
  const near = sides.filter(sd=>sd.n[0]*(cam.E[0]-sd.mid[0]) + sd.n[1]*(cam.E[1]-sd.mid[1]) <= 0);
  if(near.length){
    // the table's outer side (apron) below the rail, seen when the eye is beyond that rail
    const aprons = [
      {ok: cam.E[1] < -6,   q:[[-6,-6],[W+6,-6]]}, {ok: cam.E[1] > H+6, q:[[W+6,H+6],[-6,H+6]]},
      {ok: cam.E[0] < -6,   q:[[-6,H+6],[-6,-6]]}, {ok: cam.E[0] > W+6, q:[[W+6,-6],[W+6,H+6]]},
    ];
    for(const ap of aprons) if(ap.ok){ const [a,b] = ap.q; o += `<path d="${polyD(cam,[[a[0],a[1],1.6],[b[0],b[1],1.6],[b[0],b[1],-14],[a[0],a[1],-14]])}" fill="${ST().edge}"/>`; }
    for(const sd of near){
      for(const [a,b,n] of segs) if(n[0]===sd.n[0] && n[1]===sd.n[1])
        o += `<path d="${polyD(cam,[[a[0],a[1],1.5],[b[0],b[1],1.5],[b[0]-n[0]*1.6,b[1]-n[1]*1.6,1.5],[a[0]-n[0]*1.6,a[1]-n[1]*1.6,1.5]])}" fill="${ST().top}"/>`;
      o += `<path d="${polyD(cam, sd.rail.map(q=>[q[0],q[1],1.6]))}" fill="${ST().rail}"/>`;
    }
    for(const p of POCKETS) o += `<path d="${polyD(cam, pocketArc(p, pocketR(p), 1.61, true))}" fill="#080808"/>`;
    for(const sd of near) o += jawsSVG(cam, sd.n);
    for(const x of [1,2,3].map(i=>i*W/4)) for(const y of [-3.6,H+3.6]) o += `<path d="${polyD(cam,circ3([x,y],.4,1.62,8))}" fill="${ST().diamond}"/>`;
    for(const y of [1,2,3,5,6,7].map(i=>i*H/8)) for(const x of [-3.6,W+3.6]) o += `<path d="${polyD(cam,circ3([x,y],.4,1.62,8))}" fill="${ST().diamond}"/>`;
    o += ring && reveal ? `<path d="${ring}" fill="none" stroke="#ffd34d" stroke-width="1.65"/>` : '';
  }
  return o;
}
function perspTop(cam, s, reveal){
  let o = '';
  // pocket pointer: only when no part of the pocket ring is on screen
  const ringPts = ringArc3(s.P).map(cam.toCam).filter(c=>c[2]>NEAR).map(cam.proj);
  const ringVisible = ringPts.some(([x,y])=>x>=0 && x<=VW && y>=0 && y<=VH);
  o += tutLayer(cam, s, reveal);
  if(!ringVisible && !(S.walk && S.walk.blend > 0) && !(tut.on && tut.zb > 0) && !noPocket()){
    const pc = cam.toCam([s.P.c[0], s.P.c[1], 1.6]);
    let dx = pc[0], dy = -pc[1];
    if(pc[2] <= NEAR){ dy = Math.abs(dy)+1; }
    const k = Math.min((VW/2-30)/Math.abs(dx||1e-6), (VH/2-30)/Math.abs(dy||1e-6));
    const ax = VW/2+dx*k, ay = VH/2+dy*k, ang = Math.atan2(dy,dx)/RAD;
    o += `<g transform="translate(${ax.toFixed(1)} ${ay.toFixed(1)})"><g transform="rotate(${ang.toFixed(1)})"><path d="M10 0L-6 -8L-6 8Z" fill="#ffd34d"/></g>
      <text y="${ay > VH/2 ? -14 : 22}" text-anchor="middle" font-size="13" font-family="IBM Plex Sans, sans-serif" fill="#ffd34d">pocket</text></g>`;
  }
  // the cue ball's zone, when none of it is on screen: a pointer at the edge, the same way
  if(!G3 && s.zone && !S.answered && !(tut.on && tut.zb > 0) && !look.k){
    // shown whenever most of it is off screen (a sliver at the edge is easy to miss)
    const inV = ([x, y])=>x>=0 && x<=VW && y>=0 && y<=VH, ring = circ3(s.zone.c, s.zone.r, .03, 16).map(cam.toCam);
    const seen = ring.filter(c=>c[2]>NEAR && inV(cam.proj(c))).length, zc0 = cam.toCam([s.zone.c[0], s.zone.c[1], .03]);
    if(seen < ring.length/2 || zc0[2] <= NEAR || !inV(cam.proj(zc0))){
      const zc = cam.toCam([s.zone.c[0], s.zone.c[1], .03]);
      let dx = zc[0], dy = -zc[1];
      if(zc[2] <= NEAR){ dy = Math.abs(dy)+1; }
      const k = Math.min((VW/2-30)/Math.abs(dx||1e-6), (VH/2-30)/Math.abs(dy||1e-6));
      const ax = VW/2+dx*k, ay = VH/2+dy*k, ang = Math.atan2(dy,dx)/RAD;
      o += `<g transform="translate(${ax.toFixed(1)} ${ay.toFixed(1)})"><g transform="rotate(${ang.toFixed(1)})"><path d="M10 0L-6 -8L-6 8Z" fill="#5be0c8"/></g>
        <text y="${ay > VH/2 ? -14 : 22}" text-anchor="middle" font-size="13" font-family="IBM Plex Sans, sans-serif" fill="#5be0c8">zone</text></g>`;
    }
  }
  return o;
}

// a dashed path on the cloth, as one continuous line so the dashes run evenly round curves and corners
// (split into pieces only when part of it is behind the eye)
const DASH_W = 1.3;
const REF_FADE = 0.3;   // seconds for the ghost ball and the object ball's start mark to fade in after the hit
function dashedLine(cam, pts, col, op, dash){
  const attrs = `fill="none" stroke="${col}" stroke-opacity="${op}" stroke-width="${DASH_W}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${dash}"`;
  const cs = pts.map(q=>cam.toCam([q[0], q[1], .03]));
  if(cs.every(c=>c[2] > NEAR)) return `<path d="${cs.map((c,i)=>{ const [x,y] = cam.proj(c); return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); }).join('')}" ${attrs}/>`;
  let o = '';
  for(let k=0;k<pts.length-1;k++){ const a = pts[k], b = pts[k+1]; if(len(sub(b,a)) > 0.05) o += `<path d="${segD(cam,[a[0],a[1],.03],[b[0],b[1],.03])}" ${attrs}/>`; }
  return o;
}
const replayBare = s => !!(s && (s.bare || (s.replay && s.replay.bare)));   // (bare: a new player's empty table, before the first lesson)
function draw(reveal){ const t0 = performance.now(); drawInner(reveal); syncUpBtn(); PERF.drawMs += performance.now() - t0; PERF.draws++; }
function drawInner(reveal){
  if(replayBare(S.shot)) reveal = false;   // the right shot coming up: a bare table, as before any shot
  const box = document.querySelector('.table-box'), svg = $('table'), v = S.shot && S.shot.calling ? 'top' : settings.view;   // a Run-outs call: the whole table from above
  document.querySelector('.main').classList.toggle('persp', v!=='top');
  box.classList.toggle('persp', v!=='top');
  if(v==='top'){ svg.setAttribute('viewBox', viewBoxFor(S.shot)); svg.innerHTML = tableSVG(S.shot, reveal); $('tablefx').innerHTML = ''; layerHTML.fx = ''; $('table3d').style.display = 'none'; }
  else {
    if(vbDirty) fitViewBox();
    const vb = `0 0 ${VW} ${VH}`; if(svg.getAttribute('viewBox') !== vb) svg.setAttribute('viewBox', vb);
    const L = perspSVG(S.shot, reveal, v);
    if(!svg.querySelector(':scope > #lyD')){ svg.innerHTML = '<g id="lyB"></g><g id="lyD"></g><g id="lyF"></g><g id="lyT"></g>'; layerHTML = {}; }
    for(const [id, html] of [['lyB', L.back], ['lyD', L.dyn], ['lyF', L.front], ['lyT', L.top]])
      if(layerHTML[id] !== html){ svg.querySelector('#' + id).innerHTML = html; layerHTML[id] = html; }   // only the layers that changed
    const fx = $('tablefx');
    if(fx.getAttribute('viewBox') !== vb) fx.setAttribute('viewBox', vb);
    if(layerHTML.fx !== L.fx){ fx.innerHTML = L.fx; layerHTML.fx = L.fx; }
    if(G3){ arrowLast = arrowWake = performance.now(); $('table3d').style.display = ''; G3.build(engineTable()); G3.setBalls(G3BALLS, R, ballSet()); G3.setDisco(ballSet().holo ? (calmNow() ? 1 : 2) : 0); { const ma = obMarkA(); G3.setMarker(ma > 0 ? {p: S.shot.ob, R, a: ma} : null); } G3.setZone(S.shot && S.shot.zone && settings.view !== 'top' ? S.shot.zone : null); setArrows(); glRender(); arrowLoop(); }
  }
}
// The arrow over the target pocket: it floats gently up and down (only the 3D canvas redraws for that, about 30 times a second).
function arrowAt(){
  if(!S.shot || !S.shot.P || settings.view === 'top' || (tut.on && tut.zb > .5) || noPocket()) return null;
  const E = engineTable().pockets[POCKETS.indexOf(S.shot.P)], t = performance.now()/1000;
  const mv = settings.gfxBob !== '0';   // Still: the arrows hold still
  const {T, d} = pocketArrowPose(E.hole), bob = mv ? .7*Math.sin(t*2*Math.PI/1.6) : 0;
  return {p: [T[0] - d[0]*bob, T[1] - d[1]*bob], z: T[2] - d[2]*bob, dir: d, spin: mv ? t*.6 : 0};
}
// A pocket at the very top of the view (a far corner, above all on a phone's narrower lens) has no room above it: the
// arrow floating straight up over it would be cut off by the top of the table. Then it leans over toward the middle of
// the view, just as far as it must to stay in the picture, down to lying on its side next to the pocket, pointing at it.
const arrowLean = {side: 1};
function pocketArrowPose(hole){
  const up = {T: [hole[0], hole[1], 4.2], d: [0, 0, -1]}, cam = lastCam;   // T: the tip (bob at rest), d: the way it points
  if(!cam) return up;
  const q = cam.toCam([hole[0], hole[1], 0]); if(q[2] <= NEAR) return up;
  const x = cam.proj(q)[0], r = norm3(cross3([0, 0, 1], cam.f));
  if(Math.abs(x - VW/2) > VW*.06) arrowLean.side = x < VW/2 ? 1 : -1;   // its tail goes toward the middle (kept as it is near the middle, so it never flips back and forth)
  const h = [r[0]*arrowLean.side, r[1]*arrowLean.side];
  const pose = a => { const s = Math.sin(a), c = Math.cos(a); return {T: [hole[0] + h[0]*4.2*s, hole[1] + h[1]*4.2*s, Math.max(3.4, 4.2*c)], d: [-h[0]*s, -h[1]*s, -c]}; };
  const fits = P => {   // the head's rim and the end of the shaft, at the top of the bob, stay a little inside the top of the view
    for(const [k, w] of [[1.8, 1.1], [4, .42]]){
      const c = cam.toCam([P.T[0] - P.d[0]*(k + .7), P.T[1] - P.d[1]*(k + .7), P.T[2] - P.d[2]*(k + .7) + w]);
      if(c[2] <= NEAR || cam.proj(c)[1] < 10) return false;
    }
    return true;
  };
  if(fits(up)) return up;
  const MAX = 110*Math.PI/180;   // past level, a little: the tail dips, still clear of the rail
  let lo = 0, hi = MAX;
  for(let a = Math.PI/36; a <= MAX + 1e-9; a += Math.PI/36){ if(fits(pose(a))){ hi = a; break; } lo = a; }
  if(lo >= MAX) return pose(MAX);
  for(let i = 0; i < 6; i++){ const m = (lo + hi)/2; if(fits(pose(m))) hi = m; else lo = m; }   // just as far as it must
  return pose(hi);
}
// the same arrow, in the zone's colour, over the middle of the cue ball's zone (until the shot's played)
function zoneArrowAt(){
  if(!S.shot || !S.shot.zone || S.answered || settings.view === 'top' || (tut.on && tut.zb > .5)) return null;
  const c = S.shot.cam; if(c && c.phase === 'down' && c.k > .5) return null;   // down on the shot it's gone: nothing in the way of the shot
  const t = performance.now()/1000;
  const mv = settings.gfxBob !== '0';
  return {p: S.shot.zone.c, z: 4.2 + (mv ? .7*Math.sin(t*2*Math.PI/1.6 + 1.3) : 0), spin: mv ? t*.6 : 0};
}
// When an arrow's target is off screen, the same arrow comes in to the edge of the view and tilts to point at it;
// turn toward the target and it glides back to float over it.
const arrowPose = {pocket: {k: 0, t: 0, edge: null}, zone: {k: 0, t: 0, edge: null}};
function edgePose(cam, T){
  const q = cam.toCam(T), m = 50;
  if(q[2] > NEAR){
    const [x, y] = cam.proj(q);
    if(x >= m && x <= VW - m && y >= m && y <= VH - m){
      // the zone's on screen: fine, unless it's so far off that the arrow floating over it is above the top of the view
      const top = cam.toCam([T[0], T[1], T[2] + 7.5]);
      if(top[2] > NEAR && cam.proj(top)[1] >= 8) return null;
      const right = norm3(cross3([0, 0, 1], cam.f)), up = cross3(cam.f, right), fx = (x - VW/2)/cam.focal, fy = -(Math.max(40, y - 60) - VH/2)/cam.focal;
      const ray = norm3([0, 1, 2].map(i=>right[i]*fx + up[i]*fy + cam.f[i])), dist = Math.min(60, Math.hypot(...q)*.8);
      const P = [0, 1, 2].map(i=>cam.E[i] + ray[i]*dist);
      return {p: P, dir: norm3([T[0]-P[0], T[1]-P[1], T[2]-P[2]])};   // just above it, on screen, pointing down at it
    }
  }
  let dx = q[0], dy = -q[1];
  if(q[2] <= NEAR) dy = Math.abs(dy) + 1;
  const k = Math.min((VW/2 - 40)/Math.abs(dx || 1e-6), (VH/2 - 40)/Math.abs(dy || 1e-6));
  const ax = VW/2 + dx*k, ay = VH/2 + dy*k, fx = (ax - VW/2)/cam.focal, fy = -(ay - VH/2)/cam.focal;
  const right = norm3(cross3([0, 0, 1], cam.f)), up = cross3(cam.f, right);
  const ray = norm3([0, 1, 2].map(i=>right[i]*fx + up[i]*fy + cam.f[i]));
  let dist = 60;   // 60" out, right at the edge of the view: small, out of the way...
  if(ray[2] < 0) dist = Math.min(dist, (cam.E[2] - 4)/-ray[2]);   // ...but never down through the table: it stays 4" above the cloth
  if(dist < 6) return null;
  const P = [0, 1, 2].map(i=>cam.E[i] + ray[i]*dist);
  return {p: P, dir: norm3([T[0]-P[0], T[1]-P[1], T[2]-P[2]])};
}
function placeArrow(which, F, T){
  const st = arrowPose[which], now = performance.now(), dt = st.t ? Math.min(100, now - st.t) : 0; st.t = now;
  if(!F){ st.k = 0; return null; }
  const c = S.shot && S.shot.cam, down = c && c.phase === 'down' && c.k > .05;   // down on the shot it stays out of your view
  const e = lastCam && !look.k && !down ? edgePose(lastCam, T) : null;
  if(e) st.edge = e;
  st.k = e ? Math.min(1, st.k + dt/300) : Math.max(0, st.k - dt/300);
  if(!st.k || !st.edge) return F;
  const k = ease(st.k), P = [F.p[0], F.p[1], F.z], E = st.edge;
  const bob = settings.gfxBob === '0' ? 0 : .5*Math.sin(now/1000*2*Math.PI/1.6 + (which === 'zone' ? 1.3 : 0))*k;   // at the edge it still nudges, toward what it points at
  const Q = [0, 1, 2].map(i=>E.p[i] + E.dir[i]*bob);
  return {p: [P[0] + (Q[0]-P[0])*k, P[1] + (Q[1]-P[1])*k], z: P[2] + (Q[2]-P[2])*k, dir: norm3([0, 1, 2].map(i=>(i === 2 ? -1 : 0)*(1 - k) + E.dir[i]*k)), spin: F.spin};
}
function setArrows(){   // true while the arrows are moving (bobbing, or gliding to or from the edge of the view)
  const A = arrowAt(), Z = zoneArrowAt();
  G3.setArrow(A);   // the pocket's arrow floats over the pocket (or leans in beside it, at the top of the view)
  const zp = placeArrow('zone', Z, Z && [Z.p[0], Z.p[1], .03]), k = arrowPose.zone.k;
  G3.setArrow(zp, 'zone');
  return !!((A || zp) && settings.gfxBob !== '0') || (k > 0 && k < 1);
}
let arrowRaf = 0, arrowLast = 0, arrowWake = 0;
// graphics settings (#dev): resolution, shadows, antialiasing, and how often the arrows' bob redraws
const GFX = {ratio: ['1','1.5','2'], shadows: ['soft','hard','off'], aa: ['1','0'], bob: ['30','60','0']};
function applyGfx(){
  if(!settings.gfxV){ if(IS_PHONE){ settings.gfxRatio = '1'; settings.gfxShadows = 'hard'; } settings.gfxV = 1; }   // once: phones move to the lighter defaults
  if(!GFX.ratio.includes(settings.gfxRatio)) settings.gfxRatio = IS_PHONE ? '1' : '1.5';   // phones start lighter
  if(!GFX.shadows.includes(settings.gfxShadows)) settings.gfxShadows = IS_PHONE ? 'hard' : 'soft';
  if(!GFX.aa.includes(settings.gfxAA)) settings.gfxAA = IS_PHONE ? '0' : '1';   // phones: off (as the renderer was made)
  if(!GFX.bob.includes(settings.gfxBob)) settings.gfxBob = '30';
  if(!settings.gfxBobV){ try{ if(matchMedia('(prefers-reduced-motion: reduce)').matches) settings.gfxBob = '0'; }catch(e){} settings.gfxBobV = 1; }   // once: reduced motion starts with the arrows Still (Settings can still set them moving)
  if(G3 && G3.setQuality) G3.setQuality({ratio: +settings.gfxRatio, shadows: settings.gfxShadows, shadowSize: IS_PHONE ? 1024 : 2048});   // a phone's small screen doesn't need the 2048 map: a quarter of the work when balls move
}
const bobGap = () => settings.gfxBob === '60' ? 0 : settings.gfxBob === '0' ? Infinity : 33;
function glRender(){ const t0 = performance.now(); G3.render(lastCam, VW, VH, boxPx[0], boxPx[1]); PERF.glMs += performance.now() - t0; PERF.gls++; }
// The loop only runs while an arrow moves: with no arrow showing, or the arrows set to Still, the table isn't redrawn at all.
// And after ARROW_IDLE ms with no touch, key or redraw they come to rest (at the bottom of a bob, so they don't stop mid-air)
// until the next touch: a phone left on the table can rest its GPU.
const ARROW_IDLE = 30000;
// Disco's light spots keep the loop going even when the arrows rest, but only redraw at a low rate (lower on a phone).
const DISCO_GAP = IS_PHONE ? 160 : 80;
let arrowRun = false, discoLast = 0;
function arrowLoop(){
  if(!G3) return;
  arrowRun = true;
  if(arrowRaf) return;
  const tick = now => {
    arrowRaf = 0;
    if(!G3 || !lastCam || settings.view === 'top' || document.hidden) return;
    const disco = G3.discoMoving();
    if(arrowRun && (now - arrowLast >= bobGap() || settings.gfxBob === '0')){   // Still: only the glide to or from the edge needs frames
      arrowLast = discoLast = now; arrowRun = setArrows(); glRender();
      if(arrowRun && now - arrowWake > ARROW_IDLE && Math.abs(Math.sin(now/1000*2*Math.PI/1.6)) < .12) arrowRun = false;
    } else if(disco && now - discoLast >= DISCO_GAP){ discoLast = now; glRender(); }
    if(arrowRun || disco) arrowRaf = requestAnimationFrame(tick);
  };
  arrowRaf = requestAnimationFrame(tick);
}
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden && S.shot) arrowLoop(); });
['pointerdown', 'keydown', 'wheel'].forEach(t=>window.addEventListener(t, ()=>{ arrowWake = performance.now(); if(S.shot && settings.view !== 'top') arrowLoop(); }, {capture: true, passive: true}));
// the gold ring round the target pocket: round the engine's hole, the part that's outside the playing surface
function ringArc3(P){
  const E = engineTable().pockets[POCKETS.indexOf(P)], r = E.holeR + 0.6, out = [];
  for(let k=0;k<=72;k++){ const a = k/72*Math.PI*2, x = E.hole[0] + r*Math.cos(a), y = E.hole[1] + r*Math.sin(a); if(x < 0 || x > W || y < 0 || y > H) out.push([x, y, 1.63]); }
  // start the arc at a gap, so it draws as one stroke
  const gap = out.findIndex((q, i)=>i && Math.hypot(q[0]-out[i-1][0], q[1]-out[i-1][1]) > r*0.2);
  return gap > 0 ? [...out.slice(gap), ...out.slice(0, gap)] : out;
}
// the table in 3D (table3d.js); without WebGL everything is drawn in the SVG as before
let G3 = null, G3BALLS = [], boxPx = [600, 400];
if((settings.gfxAAV | 0) < 1){ if(IS_PHONE) settings.gfxAA = '0'; settings.gfxAAV = 1; }   // once: phones start with antialiasing off (turn it back on in Settings and it stays on)
if(!['1','0'].includes(settings.gfxAA)) settings.gfxAA = IS_PHONE ? '0' : '1';   // set before the renderer is made: antialiasing can't change after
try{ G3 = window.Table3D ? Table3D.make(document.getElementById('table3d'), {lite: IS_PHONE, aa: settings.gfxAA !== '0', redraw: ()=>{ if(S.shot && !S.anim) draw(S.answered); }}) : null; }catch(e){ G3 = null; }
if(!G3) document.getElementById('table3d').style.display = 'none';
// the ball's own frame for its texture: the number spot is painted at local +x, so turn +x onto where the spot starts
function spotBase(sp){
  sp = sp || [0,0,1];
  const k = [0, -sp[2], sp[1]], kl = Math.hypot(k[1], k[2]), c = Math.max(-1, Math.min(1, sp[0]));
  if(kl < 1e-9) return c > 0 ? [[1,0,0],[0,1,0],[0,0,1]] : [[-1,0,0],[0,-1,0],[0,0,1]];
  return PE.matRot(PE.I3, [0, k[1]/kl, k[2]/kl], Math.acos(c));
}
let layerHTML = {}, vbDirty = true;

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
const fracName = r => r.id === 'full' ? 'Full' : r.label;
const strokeName = n => COARSE_LBL[nearestCoarse(n)];
// a called shot's rows: the call, your stroke once speed is yours, your spin once there's a zone and spin is yours, and the ball
function shootRows(s){
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
function prepareNext(){
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
function logEntry(extra){   // ts: the minute it was played (minutes since 1970), so the Stats view can group sittings
  const act = stats.active && stats.active.task===settings.task ? stats.active.id : undefined;
  stats.log.push({sid:act, t:settings.task, a:S.shot.answer.id, s:S.shot.side, v:settings.view,
    c: settings.view==='top' ? '-' : stanceAim() ? 'aim' : 'line',
    md:S.shot.any ? 'any' : 'ref', th:settings.throw, ln:S.shot.len, ts: Math.round(Date.now()/60000), rp:S.shot.replays||0, wk: S.shot.walked ? 1 : 0, dc:Math.round(len(sub(S.shot.ob,S.shot.cb))), dp:Math.round(S.shot.L), ag:+S.shot.theta.toFixed(1), pt:S.shot.P.side?'s':'c', gh: practiceAid() ? 1 : 0, fa: ['ghost','line','stance'].filter(k=>['on','fade'].includes(aidMode(k))).join('') || undefined, tb:settings.table, pk:settings.pockets, ...extra});
  trimLog();
  laterSave();
}
function finishRound(){
  tableBox.classList.add('tappable');
  updateControls();
  $('next').focus({preventScroll:true});
}
wireAudio();
wireButtonSounds();

// ---------- the mode's open-ended run: shots and right calls ----------
function sessionTick(ok, made){
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
function animateShot(oc, done, obCol, pre, rightPre){   // rightPre: the right call played out (a wrong call on the ladder), for the see-through ball
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


const svgEl = $('table');
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
function renderRadio(){
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
function syncPressed(){
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
let jumpingAhead = false;
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
let walkRaf = 0, walkEndedAt = 0;
function walkOn(){ return ['shoot','practice','run'].includes(settings.task); }
function walkRedraw(){ if(walkRaf || S.anim) return; walkRaf = requestAnimationFrame(()=>{ walkRaf = 0; if(S.shot) draw(S.answered); }); }   // while a shot runs, its own frames redraw
svgEl.addEventListener('pointerdown', ev=>{
  if(!walkOn() || !S.shot || runPicking() || !$('startcover').hidden) return;
  // a drag across the full width of the table swings you half way round the cue ball
  document.body.classList.add('dragging'); try{ getSelection().removeAllRanges(); }catch(e){}
  S.walkDrag = {x: ev.clientX, y: ev.clientY, moved:false, id: ev.pointerId, k: Math.PI / Math.max(300, svgEl.clientWidth), kv: (12*RAD) / Math.max(150, svgEl.clientHeight*0.45)};
});
svgEl.addEventListener('pointermove', ev=>{
  if(!S.walkDrag || ev.pointerId !== S.walkDrag.id) return;
  const dx = ev.clientX - S.walkDrag.x, dy = ev.clientY - S.walkDrag.y;
  if(!S.walkDrag.moved && Math.hypot(dx, dy) < 6) return;
  if(!S.walkDrag.moved){ S.walkDrag.moved = true; try{ svgEl.setPointerCapture(ev.pointerId); }catch(e){} if(!S.answered) S.shot.walked = true; }
  const EL = 12*RAD;   // up/down is kept slight: at most 12° higher or lower
  S.walk = {ang: dx*S.walkDrag.k, el: Math.max(-EL, Math.min(EL, dy*S.walkDrag.kv)), blend: 1};
  walkRedraw();
});
function walkRelease(){
  if(!S.walkDrag) return;
  const moved = S.walkDrag.moved; S.walkDrag = null; document.body.classList.remove('dragging');
  if(!moved || !S.walk) return;
  walkEndedAt = performance.now(); tutLook('drag');
  const from = S.walk.blend, start = performance.now(), dur = 320;
  const step = now=>{
    if(!S.walk) return;
    const u = Math.min(1, (now-start)/dur), ease = 1-Math.pow(1-u,3);
    S.walk.blend = from*(1-ease);
    if(S.shot && !S.anim) draw(S.answered);
    if(u < 1) requestAnimationFrame(step); else { S.walk = null; if(S.shot && !S.anim) draw(S.answered); }
  };
  requestAnimationFrame(step);
}
svgEl.addEventListener('pointerup', walkRelease);
svgEl.addEventListener('pointercancel', walkRelease);
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
// Desktop: the table fills the column down to the bottom of the window; the drawing matches the box shape.
const mqDesk = matchMedia('(min-width: 900px)');
function sizeTable(){ if(S.shot && !S.anim){ draw(S.answered); if(runPicking()) renderRunPick(); } }   // (the Run-outs picker sizes its targets to the box)
function fitViewBox(){   // reading the box's size forces a layout, so it's only done when the box may have changed size
  vbDirty = false;
  const box = document.querySelector('.table-box');
  const w = box.clientWidth, h = box.clientHeight;
  VH = (w && h) ? Math.round(VW*h/w) : 400;
  boxPx = [w || 600, h || 400];
}
if(window.ResizeObserver) new ResizeObserver(()=>{ vbDirty = true; if(S.shot && !S.anim) sizeTable(); }).observe(document.querySelector('.table-box'));
let rsz = null;
window.addEventListener('resize', ()=>{ vbDirty = true; });
if(window.ResizeObserver){ const ro = new ResizeObserver(()=>requestAnimationFrame(alignLogo)); ro.observe(document.querySelector('.table-box')); ro.observe(document.querySelector('header')); }
window.addEventListener('resize', ()=>requestAnimationFrame(alignLogo));
window.addEventListener('resize', ()=>{ clearTimeout(rsz); rsz = setTimeout(sizeTable, 60); });
if(mqDesk.addEventListener) mqDesk.addEventListener('change', sizeTable);
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
const LESSONS = {
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
const tstep = () => tsteps()[tut.i];
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
const noPocket = () => (tut.on && !!tstep().noPocket) || !!(S.shot && S.shot.bare);
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
function tutLook(kind, id){
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
function tutLayer(cam, s, reveal){
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
// where you stand: your eyes over the table from your height, and how far behind the rail's outer edge (default: 175 cm, 20" back)
const BED = 29.5;   // the cloth's height above the floor, inches
function applyStance(){
  const hc = +settings.heightCm >= 150 && +settings.heightCm <= 200 ? +settings.heightCm : 175;
  const back = Math.max(0, Math.min(24, settings.railBack == null || isNaN(+settings.railBack) ? 20 : +settings.railBack));
  // reading a shot you lean in a little: eyes about 0.86 of your height off the floor
  VIEWS.stand.h = Math.max(14, hc/2.54*0.86 - BED); VIEWS.stand.back = back;
  // down on the shot, a pool stance (not snooker's chin on the cue): chin 1–2" over the cue, eyes straight over it.
  // The bridge sits a forearm minus 1¼" from the cue ball; the eyes are about a fifth of your height behind the bridge.
  const H = hc/2.54, CUE_Z = 2.5, CHIN_GAP = 1.5;
  VIEWS.down.h = CUE_Z + CHIN_GAP + 0.065*H;          // chin to eyes is about 6.5% of your height: ~9" up at 175 cm
  VIEWS.down.back = (0.146*H - 1.25) + 0.2*H;          // ~23" back at 175 cm
  const ft = Math.floor(hc/2.54/12), inch = Math.round(hc/2.54 - ft*12);
  $('heightval').textContent = $('st-heightval').textContent = `${ft}′${inch}″ · ${hc} cm`; const bw = back <= 7 ? 'Close' : back <= 16 ? 'Medium' : 'Far'; $('backval').textContent = $('st-backval').textContent = bw;
  ['backrange', 'st-back'].forEach(id=>$(id).setAttribute('aria-valuetext', bw));
  $('heightrange').value = $('st-height').value = hc; $('backrange').value = $('st-back').value = back;
}
applyStance();
const setStance = (k, v) => { settings[k] = v; saveSettings(); applyStance(); pcache.key = null; if(S.shot) draw(S.answered); };
['heightrange', 'st-height'].forEach(id=>$(id).addEventListener('input', e=>setStance('heightCm', +e.target.value)));
['backrange', 'st-back'].forEach(id=>$(id).addEventListener('input', e=>setStance('railBack', +e.target.value)));
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
  camPx: (s, view)=>{ s.cam = {phase: 'stand', k: 0}; const c = view === 'look' ? overviewCam(s) : shootCam(s, view); return [s.cb, s.ob].map(p=>{ const q = c.toCam([p[0], p[1], R]); return q[2] > 0 ? 2*R*c.focal/q[2] : 0; }); }, setVH: h=>{ VH = h; }, cheer: (n, first)=>{ cheer(n, first); }, cheerNow: ()=>cheerGo(), confetti: (n, f)=>confetti($('hlogo'), n, f), cheerLive: ()=>!!cheerFx || !!cheerQ};
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
