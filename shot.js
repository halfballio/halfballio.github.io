// Playing a shot: speed and tip, the stroke, the routine (read, step in, get down), the bridge, the controls, and taking the shot.
import {jumpingAhead, syncPressed} from './main.js';
import {LESSONS, tstep} from './lessons.js';
import {finishRound, fracName, logEntry, pendCard, prepareNext, rcardHTML, sessionTick, shootRows, strokeName} from './modes.js';
import {animateShot} from './anim.js';
import {camFrom, draw, featherLoop, featherOff, featherRaf, featherStart, FOLLOW_THROUGH, NEAR, norm3, rigAlpha, rigCam, standUp, strokeBack, syncFocusBtn, VH, VIEWS, VW} from './view.js';
import {bridgeLen, nearestRef, pocketSpeedFor, pocketTol, railBehind, runAfterShot, runFoul, stanceIn} from './deal.js';
import {CARBON_AT, ctrl, ctrlAt, drillPicks, enforceLocks, ensureShootLevel, FOCUS_AT, GEN, isDrill, isLadder, isRun, isShoot, isShooting, NO_TIMER, practicing, PT_RIGHT, PT_WRONG, PTS_UP, shaftSq, SHOOT_UP, shootLevel, shootRoutine, standTime, tableUp, unlIcon, unlocksBetween} from './grades.js';
import {cheer, playSound, showStreak, uiSound} from './audio.js';
import {curStreak, look, S, saveSettings, settings, SHOOT_GRADES, stats, STREAK_HOT, tut} from './state.js';
import {gradeOf, SH, stepOf} from './steps.js';
import {$, add, ALL, dot, engineTable, H, IS_PHONE, len, MISS, mul, norm, PE, POCKETS, R, RAD, rot, sub, TIP_STEP, W} from './geom.js';
// ---------- speed ----------
// Diamonds: how far a rolling cue ball struck that hard would roll (a diamond is an eighth of the table's length).
const diamond = () => Math.max(W, H)/8;
export const diamondsFromSpeed = V => V*V/(2*PE.C.rollDecel*diamond());
export const speedLevel = () => { const n = +settings.speedLevel, v = n >= 1 && n <= 10 ? Math.round(n) : 5; return nearestCoarse(v); };
// The four strokes as cue ball speeds, from typical published speeds: ¼ a touch shot (1.5 mph, under a table length),
// ½ a lag (3.5 mph, about 2 lengths), ¾ medium (7 mph, about 3 lengths), the full stroke a power shot (20 mph, about 5 lengths;
// eased to 15 mph, about 4 lengths, for now).
export const MPH = 17.6, STROKE_MPH = {3:1.5, 5:3.5, 8:7, 10:15};   // full stroke eased from a 20 mph power shot to 15 for now
export const levelForSpeed = V => COARSE.reduce((b, c)=>Math.abs(Math.log(STROKE_MPH[c]*MPH/V)) < Math.abs(Math.log(STROKE_MPH[b]*MPH/V)) ? c : b, COARSE[0]);

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
export function tipName(t){   // in tips, as players say it: a pip is half a 12.5 mm tip ("½ tip of top", "1 tip right", "½ tip at 2 o'clock")
  const [p, k] = tipPolar(t); if(!p) return 'Center';
  const n = clockSteps(p), hrs = k*12/n, h = Math.round(hrs) % 12 || 12, half = Math.abs(hrs - Math.round(hrs)) > .25, amt = p === 1 ? '½ tip' : `${p/2} tip${p > 2 ? 's' : ''}`;
  if(half) return `${amt} at ${Math.floor(hrs) || 12}:30`;   // older stored shots
  return h === 12 ? `${amt} of top` : h === 6 ? `${amt} of draw` : h === 3 ? `${amt} right` : h === 9 ? `${amt} left` : `${amt} at ${h} o'clock`;
}
export function nudgeTip(k){   // W up, S down, A left, D right, on the pad as you see it, to the nearest point you can strike that way; X centre
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
export const nearestCoarse = n => COARSE.reduce((b, c)=>Math.abs(c - n) < Math.abs(b - n) ? c : b, COARSE[0]);
export const strokeFrac = n => COARSE_F[nearestCoarse(n)];   // how much of your full stroke a speed uses
export function setSpeedLevel(n){
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
export const obHit = ev => ev.find(e=>e.type==='ball' && e.ids.includes('o')) || null;
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

// ---------- the routine: read from the ball line, step behind your aim line, get down on it ----------
export let routineRaf = 0;
export function startRoutine(){
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
export const ease = u => u < .5 ? 2*u*u : 1 - Math.pow(-2*u + 2, 2)/2;
export function renderRoutineChip(){
  const el = $('routinechip'); if(!el) return;
  const c = S.shot && S.shot.cam;
  const standing = c && (c.phase === 'stand' || (c.up && c.phase === 'down' && c.k < 1)) && !c.moving;
  if(!shootRoutine() || tut.on || S.answered || !c || !c.T || !standing || look.k > 0){ el.hidden = true; return; }
  el.hidden = true;   // no chip: calling a fraction is how you get down (the lesson says so)
}
// The aim line a call plays: the right call's is the one that pots with your stroke (throw and deflection allowed for),
// any other call's is that fraction's contact.
export function rightIdFor(s){ return nearestRef(cutForDir(s, aimFor(s, shotStroke(s), shaftSq()))).id; }
export function aimDirFor(s, id){
  const stroke = shotStroke(s), need = aimFor(s, stroke, shaftSq()), right = nearestRef(cutForDir(s, need));
  const picked = ALL.find(r=>r.id === id);
  return !picked || picked.id === right.id ? need : dirForCut(s, picked.deg);
}
// Stand up off the shot (Esc or the ⤒ button, on the ladder): back up, step back to the ball line, and read it again
function canStandUp(){ const c = S.shot && S.shot.cam; return shootRoutine() && !tut.on && !S.answered && !S.anim && !!c && c.T && c.phase !== 'stand' && !c.moving && !look.target; }
export function standUpOff(){
  if(!canStandUp()) return false;
  const s = S.shot, c = s.cam; featherOff(s);
  const back = () => camStep(s, 'step', c.phase === 'step' ? c.k : 1, 0, 500, ()=>{ c.phase = 'stand'; c.k = 0; c.up = false; c.fHold = 0; s.aimId = null; s.aimDir = null; markAim(s); draw(false); });
  if(c.phase === 'down' && c.k > 0) camStep(s, 'down', c.k, 0, 450, back); else back();
  return true;
}
export function syncUpBtn(){ const el = $('upwrap'); if(el) el.hidden = !canStandUp(); }
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
export function markAim(s){ document.querySelectorAll('#answers button').forEach(b=>b.classList.toggle('aimed', b.dataset.id === s.aimId)); }   // the line you're on
// getting down takes longer the further you have to come in: 0.6 s from a normal stance, up to about 1.4 s from right back
export function downMs(s){
  const dir = s.aimDir || norm(sub(s.ob, s.cb)), a = camAlong(s, dir, VIEWS.stand).E, b = camAlong(s, dir, VIEWS.down).E;
  return 600*Math.min(2.4, Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])/20));
}
export function callAim(id){
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
export function shootCam(s, view){
  const d = norm(sub(s.ob, s.cb)), aim = s.aimDir || d;   // ball line, then behind the aim line you called, then down on it
  const stand = camAlong(s, d, VIEWS.stand), standAim = camAlong(s, aim, VIEWS.stand), down = camAlong(s, aim, VIEWS.down);
  const c = s.cam || {phase:'stand', k:0};
  const mix = (A, B, k) => camFrom(A.E.map((x, i)=>x + (B.E[i]-x)*k), norm3(A.f.map((x, i)=>x + (B.f[i]-x)*k)), A.hfov + (B.hfov - A.hfov)*k);
  const base = c.phase === 'step' ? standOut(mix(stand, standAim, c.k)) : c.phase === 'shift' ? (c.fromCam ? mix(c.fromCam, standAim, c.k) : standOut(mix(camAlong(s, c.fromAim || d, VIEWS.stand), standAim, c.k))) : c.phase === 'down' ? bendCam(standAim, down, c.k, aim) : view === 'down' && !c.T ? camAlong(s, d, VIEWS.down) : stand;
  return look.k > 0 ? mix(base, overviewCam(s), ease(look.k)) : base;
}
export function overviewCam(s){
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
export function setLook(on){
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
export const standMin = (s, dir, p = s.cb) => outerDist(p, [-dir[0], -dir[1]]);
// Reading a shot you look along it, not straight down: with the cue ball near the rail you stand back far enough to have it
// no more than about 60° below your eyes (a foot and a half or so, more for a tall player), instead of having it under your chin.
const standRead = () => (VIEWS.stand.h - R)*0.58;
// The slider (`back`) is how far behind that closest spot you stand: 0 is right at the rail's outer edge, every inch steps you
// back, wherever the cue ball is. Your eyes are never inside the rail's outline.
export const standBackFor = (s, dir, back) => Math.max(standRead(), standMin(s, dir)) + back;
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
export function bridgeGeom(s, u, ty = 0){
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
export const bridgeAim = s => s.aimDir || norm(sub(s.gbLook || s.gb, s.cb));
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
export const PHONE_STAND_FOVS = [48, 54, 60, 66];
export function shotInFrame(cam, s, m = 24){
  return [[s.cb[0], s.cb[1], R], [s.gb[0], s.gb[1], R], [s.ob[0], s.ob[1], R], [s.P.c[0], s.P.c[1], 0]].every(P=>{
    const q = cam.toCam(P); if(q[2] <= NEAR) return false;
    const [x, y] = cam.proj(q); return x >= m && x <= VW - m && y >= m && y <= VH - m;
  });
}

// ---------- controls: speed bar and tip pad ----------
export function renderShootControls(){
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
export function wireShootControls(){
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
export function dirForCut(s, phi){
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
export function rigHitMs(s, run, dir){
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
export function rightStroke(s, sq){
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
export function ballVerdict(run, zone, foul){
  if(run.scratch) return {v: 'Scratch: the cue ball went in', good: false};
  if(foul) return {v: 'Foul: another ball first', good: false};
  if(!run.hit) return {v: 'Missed the object ball', good: false};
  if(!run.made) return {v: run.obIn ? 'Wrong pocket' : 'Missed the pocket', good: false};
  if(!zone) return {v: 'Pocketed', good: true};
  return run.inZone ? {v: 'Pocketed, in the zone', good: true} : {v: `Pocketed, missed the zone by ${run.zoneMiss.toFixed(1)}″`, good: 'also'};
}
export function takeShot(id){
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
export function strokeThen(s, x0, play){
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
export function renderBadge(pop){
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
export const lvupOpen = () => !$('lvup').hidden;
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
export function wireLevelUp(){
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
}
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
// The final stroke: back (further for a harder shot), a pause, then forward, faster into the ball.
export let cueStroke = null;