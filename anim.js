// The shot animation, and the right shot replayed after a miss.
import {draw, featherStart, FOLLOW_THROUGH, rigAlpha, standUp} from './view.js';
import {aimFor, cueStroke, downMs, ease, obHit, outcome, playAim, renderShootControls, rigHitMs, rightStroke, shootCam, strokeThen} from './shot.js';
import {shaftSq, shootLevel} from './grades.js';
import {cutSounds, tableSounds} from './audio.js';
import {S, settings} from './state.js';
import {SH} from './steps.js';
import {$, add, len, mul, POCKETS, R, sub} from './geom.js';
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
          const x0 = rigAlpha(s).push || 0; rp.feather = false; c.downAt = null; strokeThen(s, x0, play, st.V); };
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
export function replayRightNow(){
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
  if(s.cued) s.cued = false;   // the strike already sounded, from the stroke (strokeThen)
  else plan.push([0, 'cue', Math.max(.35, Math.min(1, .3 + v0/50))]);   // the cue strikes the cue ball, firmer for a harder shot
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
export function finishAnim(){
  if(!S.anim) return;
  const a = S.anim; S.anim = null;
  cancelAnimationFrame(a.raf);
  if(performance.now() - a.t0 < a.total - 300) cutSounds(a.bus);   // skipped: sounds that haven't happened yet don't play
  if(S.shot) S.shot.anim = null;
  a.done(performance.now() - a.t0);
}
