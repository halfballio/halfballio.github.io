// Dealing a shot: the dealer, the shot library (shots.bin), the extra balls at S, and Run-outs.
import {deal, forceDeg, forceFrac, pendCard, pocketInView, rcardHTML, renderModeChip, shotIdle, tutDist, updateControls, viewBoxFor} from './main.js';
import {aimFor, COARSE, cueStroke, cutForDir, diamondsFromSpeed, idealDir, MPH, outcome, playAim, rebuildShot, shotStroke, snapTip, storedTip, strikeOf, STROKE_MPH, tipPolar} from './shot.js';
import {adaptiveOn, anyOn, ctrl, drillPicks, GEN, gradeTable, isDrill, isLadder, isRun, isShoot, ladderBest, leanK, longShare, progTable, shaftSq, shootLevel, SHOT_SPEED, tableUnlocked, throwNow} from './grades.js';
import {look, S, save, sessTask, settings, stats, success, taskOf, tut} from './state.js';
import {GRADE_STEP, SH, stepOf} from './steps.js';
import {$, add, BOUNDS, CORE, curTable, dot, engineTable, f2, H, IS_PHONE, len, matVec, mul, norm, OB_COLORS, PE, PHONE_MAX_D, pick, PK, pocketR, POCKETS, R, RAD, REFS, rnd, rot, segDist, sub, tableBox, TABLES, TIP_STEP, W} from './geom.js';
// ---------- physics ----------
// Throw comes out of the engine's ball-ball contact (friction while the balls slide against each other). This asks it how
// many degrees a hit at cut phi throws, for a cue ball arriving at vc in/s with spin ratio spin (1 rolling, 0 stun).
function throwAtContact(vc, phi, spin){
  if(phi <= 0) return 0;
  const n = [Math.sin(phi*RAD), Math.cos(phi*RAD)], r = PE.collide([0,1], vc, spin, n);
  return Math.acos(Math.min(1, dot(r.obDir, n)))/RAD;
}
const MU_G = 108;                                     // sliding friction μ·g, in/s² (μ ≈ 0.28: a medium cloth, not a fast one)
const A_ROLL = 6;                                     // rolling resistance, in/s²
const POCKET_ARRIVE = 14;                             // pocket speed: how fast the object ball is still going as it drops, in/s
const CHEAT_SHARE = 0.4;   // any-angle shots aimed at one side of the pocket instead of the middle

export function nearestRef(theta){
  const f = 1 - Math.sin(theta*RAD);
  let best = REFS[0];
  for(const r of REFS) if(Math.abs(r.f-f) < Math.abs(best.f-f)) best = r;
  return best;
}

// no ⅛ at the follow, stun and draw grades: with barely any contact, the spin hardly changes where the cue ball goes
export const NO_EIGHTH = () => [SH.follow, SH.stun, SH.draw];
function bucketWeights(step = isShoot() ? zoneStep(shootLevel()) : null){   // step: the zone step being dealt (at S, the one this shot drew)
  if(forceFrac) return REFS.map(r=>r.id===forceFrac ? 1 : 0);
  if(isDrill() && GEN.g == null && !tut.on){ const fr = drillPicks().fr; return REFS.map(r=>fr.includes(r.id) ? 1 : 0); }   // Practice: only the fractions you picked
  const w = REFS.map(()=>1);   // full-ball shots come up as often as each cut
  if(isShoot() && NO_EIGHTH().includes(step)) w[REFS.findIndex(r=>r.id === '18')] = 0;
  return w;
}
function weightedIndex(w){
  let t = Math.random()*w.reduce((a,b)=>a+b,0);
  for(let i=0;i<w.length;i++){ t-=w[i]; if(t<=0) return i; }
  return w.length-1;
}
function chooseAim(i){
  if(forceDeg != null) return forceDeg;   // the tutorial asks for an exact cut
  const r = REFS[i];
  if(anyOn()){ const [lo, hi] = BOUNDS[i]; return rnd(lo > 0 ? lo + 1 : 0, hi - 1); }   // any angle, but never within 1° of a boundary: every answer is clear
  return r.id==='full' ? rnd(0,1) : r.deg + rnd(-1,1);
}

export function pocketTol(P, u){
  // margin scales with how much wider the mouth is than the ball (baseline: 4.5" corner, 5" side)
  if(P.side){ const b = Math.acos(Math.min(1,dot(u, mul(P.n,-1))))/RAD; return 1.5*((PK[1]-2.25)/2.75)*(1-0.6*b/40); }
  const bis = norm([Math.sign(P.c[0]-W/2), Math.sign(P.c[1]-H/2)]);
  const a = Math.acos(Math.min(1,dot(u,bis)))/RAD;
  return 1.3*((PK[0]-2.25)/2.25)*(1-0.35*a/45);
}

// Where the number sits on the object ball: fixed on the ball (it doesn't turn to face you), roughly toward
// where you first stand so it starts out readable, tilted up a little.
function spotToward(toEye){
  const h = rot(norm(toEye), rnd(-40, 40)*RAD), el = rnd(20, 55)*RAD;
  return [h[0]*Math.cos(el), h[1]*Math.cos(el), Math.sin(el)];
}
// The cue ball has six red dots, one on each face of a cube (like the TV-style training cue balls), fixed on the ball.
export const CB_DOTS = (()=>{ const t = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]], q = [.35, .6, .72];   // tilted so none sits dead on top
  return t.map(v=>rotAxis(rotAxis(v, [1,0,0], q[0]), [0,1,0], q[1])); })();
export function cbSpin(v, sp){ return sp && sp.M ? matVec(sp.M, v) : v; }   // turn a dot by everything the cue ball has turned so far
export function rotAxis(v, k, a){   // rotate v about unit axis k by angle a (Rodrigues)
  const kl = Math.hypot(k[0],k[1],k[2]); if(kl < 1e-9) return v; k = [k[0]/kl, k[1]/kl, k[2]/kl];
  const c = Math.cos(a), sn = Math.sin(a), kd = k[0]*v[0]+k[1]*v[1]+k[2]*v[2];
  const kx = [k[1]*v[2]-k[2]*v[1], k[2]*v[0]-k[0]*v[2], k[0]*v[1]-k[1]*v[0]];
  return [0,1,2].map(i=>v[i]*c + kx[i]*sn + k[i]*kd*(1-c));
}
// How far the object ball runs to the pocket, by the cut: thin cuts come up near the pocket, as they do in a game. How far off
// the object ball goes for a given miss of the contact point grows as 1/cos of the cut, and players leave themselves fuller
// angles for long shots, so a thin cut across the table into a far pocket hardly ever happens. The run is capped at
// OB_RUN·cos²θ: straight in 72", ¾ 68", ½ 54", ¼ 32", ⅛ 17". A ball on the rail cut down it into the corner (centre within
// RAIL_BALL of a cushion that ends at that pocket) is the common exception: it may run OB_RUN·cosθ (¼ 48", ⅛ 35").
// Checked as shots are dealt, live and from the library (the shipped shots were made before it).
const OB_RUN = 72, RAIL_BALL = 6;
export function obRunMax(theta, ob, P){
  const c = Math.cos(Math.min(89, Math.max(0, theta))*RAD);
  const rail = ob && P && !P.side && (Math.abs(ob[0] - P.c[0]) <= RAIL_BALL || Math.abs(ob[1] - P.c[1]) <= RAIL_BALL);
  return OB_RUN*(rail ? c : c*c);
}
export const obRunOk = s => s.L <= obRunMax(s.theta, s.ob, s.P) + 1e-6;
let DRILL_GEN = null;   // Practice, dealing live: the distance ('short' / 'long') and side ('L' / 'R') it has to be
export function generate(bucket){   // bucket: which fraction to deal (picked once per deal, so fractions that are harder to place aren't dealt less)
  const w = bucketWeights();
  const throwOn = throwNow(), speed = SHOT_SPEED, wantFlip = throwOn && !tut.on && Math.random() < 1/3;
  const lenCls = DRILL_GEN && DRILL_GEN.len ? DRILL_GEN.len : tut.on && GEN.g == null ? 'short' : Math.random() < longShare() ? 'long' : 'short';   // the grade sets the mix of short and long shots (Practice: your pick)
  const k = H/100;
  const RANGE = lenCls==='long' ? {p:[28*k,80*k], d:[30*k, IS_PHONE ? PHONE_MAX_D - 2*R - 1 : 70*k]} : {p:[7,34], d:[7,26]};   // phones: never over 3½ ft
  let fallback = null, far = null;
  for(let i=0;i<6000;i++){
    const phi = chooseAim(bucket ?? weightedIndex(w));
    const P = pick(POCKETS);
    const ob = [rnd(3,W-3), rnd(3,H-3)];
    // any angle: some shots cheat the pocket, aimed at one side of it instead of the middle (well inside what still drops)
    const uC = norm(sub(P.t, ob)), tolC = pocketTol(P, uC), cheat = anyOn() && Math.random() < CHEAT_SHARE ? rnd(-1, 1)*0.7*tolC : 0;
    const T = add(P.t, mul([-uC[1], uC[0]], cheat));
    const toP = sub(T, ob), dist = len(toP);
    if(dist < Math.min(RANGE.p[0], obRunMax(phi)/2) || dist > RANGE.p[1]) continue;   // a long thin cut is long from the cue ball: its object ball stays near the pocket
    if(dist > obRunMax(phi, ob, P)) continue;
    const u = norm(toP);
    if(P.side){ if(dot(u, mul(P.n,-1)) < Math.cos(38*RAD)) continue; }
    else { const bis = norm([Math.sign(P.c[0]-W/2), Math.sign(P.c[1]-H/2)]); if(dot(u,bis) < Math.cos(44*RAD)) continue; }
    // with speed & throw, the dealt angle is the cut as it looks (the ghost-ball geometry); the hit it needs is thinner
    // with throw, the spread is around the hit the shot needs (so thick and thin both come up); the angle it looks is thicker by the throw
    // throw is real on every shot (the engine's ball-ball friction): small when rolling, most on soft stun (A- up)
    const stroke = throwOn ? 'stun' : 'roll', vc0 = pocketSpeedFor(Math.max(1, dist))/(Math.max(.2, Math.cos(phi*RAD))*(1 + PE.C.eBall)/2);
    const cut = phi, tp = Math.max(0, cut - throwAtContact(vc0, cut, stroke === 'stun' ? 0 : 1));
    const sign = Math.random()<.5?-1:1;
    const v = rot(u, sign*tp*RAD);                      // cue direction
    if(DRILL_GEN && DRILL_GEN.side && cut > 2 && (dot(u, [-v[1], v[0]]) > 0 ? 'R' : 'L') !== DRILL_GEN.side) continue;   // Practice: the side you picked (a near-straight shot has none)
    const n = rot(v, -sign*cut*RAD);                    // line of centres at contact
    const gb = sub(ob, mul(n, 2*R));
    if(gb[0]<R||gb[0]>W-R||gb[1]<R||gb[1]>H-R) continue;
    const d = tutDist ? rnd(tutDist[0], tutDist[1]) : rnd(RANGE.d[0], RANGE.d[1]);   // a lesson can ask how far the cue ball travels
    const cb = sub(gb, mul(v, d));
    if(cb[0]<2||cb[0]>W-2||cb[1]<2||cb[1]>H-2) continue;
    if(segDist(cb, ob, T) < 2*R+0.4) continue;
    if(len(sub(cb,ob)) < 4*R) continue;
    const right = [-v[1], v[0]];
    const cand = {any: anyOn(), speed, len:lenCls, theta:cut, pathDeg:tp, throwOn, sign, P, ob, cb, gb, u, v, n,
      L: dist, tol: tolC, T, uC, cheat, side: dot(u,right)>0?'R':'L',
      color: pick(OB_COLORS), answer: nearestRef(cut), pick:null, spot: spotToward(sub(cb, ob)),
      stroke, spinR: throwOn ? 0 : 1, throwDeg: cut - tp, gbLook: throwOn ? sub(ob, mul(u, 2*R)) : null};   // gbLook: the ghost ball as the shot looks (the pocket line), before throw   // the call is the hit it needs; with throw that can be a thinner fraction than it looks
    if(throwOn && (nearestRef(tp).id !== cand.answer.id) !== wantFlip) continue;   // about one throw shot in three is one where throw changes the fraction
    const near = inReach(cand);   // a cue ball out of reach from the rail behind it: only if nothing else turns up
    if(!near && far) continue;
    const play = outcome(cand, cut);
    if(!play.made || play.scratch) continue;              // the right call has to drop, without the cue ball following it into a pocket
    if(!near){ far = cand; continue; }
    if(!fallback) fallback = cand;
    if(Math.abs(u[0]) > 0.85 && dist > W*0.55) continue;   // no long runs across the table along an end rail: that layout only ever came up as a thin cut, so it gave the answer away
    if(pocketInView(cand)) return cand;
  }
  return fallback || far;
}

// ---------- dealing ----------
export const STOP_R = 4;   // a stop shot: the cue ball ends within 4" of where it hit the object ball
const STEP_STROKES = {   // the kind of stroke a step's zones are made from (the player can use any stroke they have)
  // rails: how many cushions the cue ball uses on its way to the zone. Spin steps: none or one; off a cushion: two;
  // english: one or two; full-table position: three or four.
  [SH.stun]:   s => ({tip:[0,0], stun:true, rails:[0, 2], run: 45}),   // a stop shot (no rail, the cue ball stays where it hit) or one or two rails, ending within 45" of contact
  [SH.follow]: s => ({tip:[0, rnd(.3,.55)], k:[1.1, 2.2], rails:[0, 1]}),
  [SH.draw]:   s => ({tip:[0, -rnd(.35,.6)], k:[1.6, 3.2], rails:[0, 1]}),
  [SH.cushion]:s => ({tip:[0, .44], k:[1.6, 3.2], rails:[2, 2]}),   // built its own way: see twoRailZone
  [SH.english]:s => ({tip:[(Math.random()<.5?-1:1)*rnd(.3,.5), rnd(-.2,.35)], k:[1.6, 3.2], rails:[1, 2]}),
  [SH.full]:   s => ({tip:[(Math.random()<.5?-1:1)*rnd(0,.45), rnd(-.25,.45)], k:[2.5, 7], rails:[3, 4]}),
};
function zoneStep(g){
  if(g < SH.follow) return null;
  if(g >= SH.all) return pick([SH.follow, SH.stun, SH.draw, SH.cushion, SH.english]);
  return g === SH.cushion ? SH.cushion : g >= SH.english ? SH.english : g;
}
// Deal a Shoot shot: any angle (the Read ladder's dealer), plus a target zone from a stroke that really gets there.
// Room behind the cue ball, along the aim, for a bridge hand on the cloth: a forearm's length to the bridge plus the hand (about 4").
// Closer to the cushion you'd be bridging on the rail, with the cue raised, and couldn't strike low on the ball.
export function railBehind(p, u){   // distance from p back along -u to the cushion
  let t = Infinity;
  for(const k of [0, 1]){ const d = -u[k], hi = k ? H : W; if(d > 1e-9) t = Math.min(t, (hi - p[k])/d); else if(d < -1e-9) t = Math.min(t, (0 - p[k])/d); }
  return t;
}
const HAND_MAX_CM = 200;   // the library is built so a bridge hand fits even at the tallest height in Settings
// Your bridge: a forearm's length (less 1¼") behind the cue ball, but when the cue ball is far out on the table you stretch and
// lengthen it, so the bridge hand stays within reach (about 0.38 of your height in from the rail's outer edge), up to 12" longer.
// The stroke stays the same length (strokeBack): only the bridge moves back.
export function bridgeLen(s, u){
  const hIn = stanceIn(), L0 = 0.146*hIn - 1.25, need = railBehind(s.cb, u) + PE.C.cushionWidth + PE.C.railWidth - 0.38*hIn;
  return Math.min(L0 + 12, Math.max(L0, need));
}
// Reach: you stand at the rail behind the cue ball (no mechanical bridge, no sitting on the rail), so the cue ball can't be
// further out than your bridge hand reaches plus the bridge. The bridge hand reaches about 0.38 of your height in from the
// rail's outer edge (as bridgeLen has it: ~20" past the cushion nose at 175 cm), the natural bridge is a forearm less 1¼"
// (~9"), and a stretch over the rail with the bridge lengthened gives about 7" more: a little over half your height from the
// cushion nose in all (36" at 175 cm, 31" at 150 cm, 41" at 200 cm). A little reach is fine; further out you'd need a
// mechanical bridge, and you'd read the shot from 6 ft away. Checked as shots are dealt (not when the library is built),
// along the aim line from the cue ball back to the cushion behind it.
const REACH_PER_HEIGHT = 0.52;
const REACH_LIB_CM = 175;   // the library stores shots in reach at the default height; dealing checks your own
export const reachMax = () => REACH_PER_HEIGHT*stanceIn();
export const reachOf = s => railBehind(s.cb, norm(sub(s.gbLook || s.gb, s.cb)));
const inReach = s => GEN.g != null || reachOf(s) <= reachMax();
export function handRoom(s){ const hIn = (GEN.g != null ? HAND_MAX_CM : stanceIn()*2.54)/2.54; return railBehind(s.cb, norm(sub(s.gbLook || s.gb, s.cb))) >= 0.146*hIn - 1.25 + 4; }
// Off two cushions: a larger zone (8") that at least two kinds of stroke, top, stun or draw, can each reach, every one
// at least 1½" inside it. Every speed is tried with a full and half tip of top, centre, and a half and full tip of draw;
// the closest pair of endpoints from two different kinds sets the zone, and any stroke that ends inside it counts as right.
const ZR_TWO = 8;
// The spin grades have to be about the spin, at the moment the cue ball reaches the object ball (spin as a fraction of
// rolling: 1 is rolling, 0 no spin, below 0 backspin):
//   follow: real topspin (rolling or more), and the zone isn't one a stun stroke reaches;
//   stun:   still sliding, almost no spin, so it leaves along the tangent line, and the zone isn't one a rolling ball reaches;
//   draw:   backspin still there (not a slow draw that's worn off), and the zone isn't one a stun or a rolling ball reaches.
const STUN_SPIN = 0.2, FOLLOW_SPIN = 0.9, DRAW_SPIN = -0.3;
const spinAtContact = (st, d1) => PE.arrive(st.V, st.tip[1] || 0, d1).spin;
const spinKindOk = (kind, sp) => kind > 0 ? sp >= FOLLOW_SPIN : kind < 0 ? sp <= DRAW_SPIN : Math.abs(sp) <= STUN_SPIN;
// does a centre-ball stroke still sliding at contact (a stun, any of your speeds) also pot and land in the zone?
function stunsIn(s, d1){
  return COARSE.some(l=>{
    const st = {V: STROKE_MPH[l]*MPH, tip: [0, 0]};
    if(Math.abs(spinAtContact(st, d1)) > STUN_SPIN) return false;
    const q = playAim(s, idealDir(s), st, false);
    if(!(q.made && !q.scratch && q.inZone)) return false;
    const r = playAim(s, aimFor(s, st), st, false); return r.made && !r.scratch && r.inZone;
  });
}
const shuffled = a => { a = [...a]; for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random()*(i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// does a centre-ball stroke that arrives with real topspin (any speed) also pot and land in the zone?
function rollsIn(s, d1){
  return COARSE.some(l=>{
    const st = {V: STROKE_MPH[l]*MPH, tip: [0, 0]};
    if(PE.arrive(st.V, 0, d1).spin <= .5) return false;
    const q = playAim(s, idealDir(s), st, false);
    if(!(q.made && !q.scratch && q.inZone)) return false;
    const r = playAim(s, aimFor(s, st), st, false); return r.made && !r.scratch && r.inZone;
  });
}
function twoRailZone(s){
  const c = ctrl(), V0 = strikeOf(s).V, ends = [];
  for(const l of COARSE){
    const V = STROKE_MPH[l]*MPH; if(V < V0) continue;
    for(const n of [2, 1, 0, -1, -2]){
      const tip = snapTip([0, n*TIP_STEP], c); if(Math.sign(tip[1]) !== Math.sign(n)) continue;
      const st = {V, tip}, d1 = len(sub(s.gb, s.cb));
      if(!spinKindOk(Math.sign(n), spinAtContact(st, d1))) continue;   // top that's rolling, stun that's sliding, draw that's still there
      const r = playAim(s, idealDir(s), st, false);   // quick look with the plain aim
      if(r.made && !r.scratch && r.hit && r.cbRails === 2) ends.push({p: r.cueEnd, l, tip, kind: Math.sign(n), st});
    }
  }
  let best = null;
  for(let i = 0; i < ends.length; i++) for(let j = i + 1; j < ends.length; j++){
    if(ends[i].kind === ends[j].kind) continue;
    const d = len(sub(ends[i].p, ends[j].p)); if(!best || d < best.d) best = {a: ends[i], b: ends[j], d};
  }
  if(!best || best.d > 2*(ZR_TWO - 1.5)) return null;
  for(const e of [best.a, best.b]){   // the pair, played exactly as your right call would play it
    const r = playAim(s, aimFor(s, e.st), e.st, false);
    if(!(r.made && !r.scratch && r.hit && r.cbRails === 2)) return null;
    e.p = r.cueEnd;
  }
  if(len(sub(best.a.p, best.b.p)) > 2*(ZR_TWO - 1.5)) return null;
  const zc = mul(add(best.a.p, best.b.p), .5);
  if(zc[0] < 3 || zc[0] > W-3 || zc[1] < 3 || zc[1] > H-3 || POCKETS.some(P=>len(sub(zc, P.c)) < 8) || len(sub(zc, s.cb)) < 6 || !zoneSpotOk(s, zc)) return null;
  const inside = ends.filter(e=>len(sub(e.p, zc)) <= ZR_TWO - 1.5);
  return {c: zc, r: ZR_TWO, step: SH.cushion, lvl: best.a.l, lvls: [...new Set(inside.map(e=>e.l))], tip: best.a.tip};
}
// the aim for a quick look at a stroke: the plain line, but with side spin the one that allows for it (side pushes the cue
// ball off line, so from 2 ft or more the plain aim never pots, and only short shots would ever get an English zone)
const quickAim = (s, st) => st.tip[0] ? aimFor(s, st) : idealDir(s);
function otherWays(s, zs, lvl){
  const c = ctrl(), alts = [];
  COARSE.filter(l=>l !== lvl).forEach(l=>alts.push({V: STROKE_MPH[l]*MPH, tip: zs.tip}));
  [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([i, j])=>{
    const t = snapTip([zs.tip[0] + i*TIP_STEP, zs.tip[1] + j*TIP_STEP], c);
    if(Math.abs(t[0] - zs.tip[0]) + Math.abs(t[1] - zs.tip[1]) > 1e-3) alts.push({V: zs.V, tip: t});
  });
  return alts.some(st=>{
    const q = playAim(s, quickAim(s, st), st, false);   // a quick look with the plain aim; only a likely one gets the full aim search
    if(!(q.made && !q.scratch && q.inZone)) return false;
    if(st.tip[0]) return true;   // (already the full aim)
    const r = playAim(s, aimFor(s, st), st, false); return r.made && !r.scratch && r.inZone;
  });
}
// ---------- the shot library ----------
// Zone shots take a lot of checking, so they're worked out ahead: a big library ships with the site (shots.bin, made by
// tools/gen-shots.js), and your device can build its own on top. A shot is stored in 13 bytes: both balls and the zone
// centre to 0.05", the aim point's offset from the pocket's centre, the pocket, the fraction, the strokes that land it
// and the tip. Each is re-checked after rounding, and can be played mirrored left-right.
// keys: step ids (SH): a zone step (B to A+), or the step itself for the grades without zones (F to B-)
export const ZONE_STEPS = [SH.follow, SH.stun, SH.draw, SH.cushion, SH.english], BASIC_STEPS = GRADE_STEP.filter(k=>k <= SH.throw);   // (shots.bin still has the retired step 5's section: nothing deals it)
export const LIB_STEPS = [...BASIC_STEPS, ...ZONE_STEPS], LIB_RULES = 10, REC = 13;
export const isZoneStep = k => ZONE_STEPS.includes(+k), LIB_PER_OF = k => isZoneStep(k) ? 1000 : 300;   // what your device builds (the shipped file has far more)
export const tableFor = k => { const g0 = GEN.g; GEN.g = +k; try{ return progTable(); } finally { GEN.g = g0; } };
const fnv = t => { let h = 0x811c9dc5; for(let i = 0; i < t.length; i++){ h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16); };
// the version: the physics, strokes and tables it was made with; a change to the zone or dealing rules bumps LIB_RULES by hand
export const libVer = () => LIB_RULES + '-' + fnv(JSON.stringify([PE.C, STROKE_MPH, ZR_TWO, TIP_STEP, TABLES]));   // physics, strokes, zone rules and the dealer itself   // your height isn't in it: room for your bridge hand is checked as each shot is dealt
const ZR_CODES = [5, 6, 8, 6.5], Q = 20;   // zone radii; coordinates in twentieths of an inch
const q12 = x => Math.max(0, Math.min(4095, Math.round((x + 2)*Q))), uq12 = v => v/Q - 2;
// a shot as a record (rounded to what's stored)
function recOf(s){
  const z = s.zone || {c: [0, 0], r: 5, lvl: COARSE[0], lvls: [], tip: [0, 0]};
  return {cb: s.cb.map(x=>uq12(q12(x))), ob: s.ob.map(x=>uq12(q12(x))), Pi: POCKETS.indexOf(s.P), cheat: Math.max(-127, Math.min(127, Math.round((s.cheat || 0)*50)))/50,
    zc: z.c.map(x=>uq12(q12(x))), zr: z.r, lvl: z.lvl, lvls: s.zone ? z.lvls || [z.lvl] : [], tip: snapTip(z.tip), frac: s.answer.id};
}
export function encodeRec(r, out, o){
  const c = [...r.cb, ...r.ob, ...r.zc].map(q12);
  for(let i = 0; i < 6; i += 2){ const a = c[i], b = c[i+1], k = o + i/2*3; out[k] = a >> 4; out[k+1] = ((a & 15) << 4) | (b >> 8); out[k+2] = b & 255; }
  out[o+9] = (Math.round(r.cheat*50) + 256) & 255;
  out[o+10] = (r.Pi & 7) | ((CORE.findIndex(x=>x.id === r.frac) & 7) << 3) | ((COARSE.indexOf(r.lvl) & 3) << 6);
  out[o+11] = r.lvls.reduce((m, l)=>m | (1 << COARSE.indexOf(l)), 0) | (Math.max(0, ZR_CODES.indexOf(r.zr)) << 4);
  const [tp, tk] = tipPolar(r.tip); out[o+12] = tp | ((tp >= 2 ? tk*2 : tk) << 2);   // pips (0–2) and the clock position: in twelfths at one pip, 24ths at two (the stored format)
}
export function decodeRec(b, o){
  const c = [];
  for(let i = 0; i < 3; i++){ const k = o + i*3; c.push((b[k] << 4) | (b[k+1] >> 4), ((b[k+1] & 15) << 8) | b[k+2]); }
  const m = b[o+11];
  return {cb: [uq12(c[0]), uq12(c[1])], ob: [uq12(c[2]), uq12(c[3])], zc: [uq12(c[4]), uq12(c[5])], cheat: ((b[o+9] << 24) >> 24)/50,
    Pi: b[o+10] & 7, frac: (CORE[(b[o+10] >> 3) & 7] || CORE[0]).id, lvl: COARSE[b[o+10] >> 6], lvls: COARSE.filter((l, i)=>m & (1 << i)),
    zr: ZR_CODES[m >> 4], tip: (b[o+12] & 3) ? storedTip(b[o+12] & 3, b[o+12] >> 2) : [0, 0]};
}
const toB64 = u8 => { let s = ''; for(let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); };
const fromB64 = t => Uint8Array.from(atob(t), ch=>ch.charCodeAt(0));
// a record as a full shot, mirrored left-right if fx
export function shotOf(r, step, fx){
  const X = x => fx ? W - x : x, P0 = POCKETS[r.Pi];
  const P = POCKETS.find(q=>Math.abs(q.c[0] - X(P0.c[0])) < .01 && Math.abs(q.c[1] - P0.c[1]) < .01) || P0;
  const cb = [X(r.cb[0]), r.cb[1]], ob = [X(r.ob[0]), r.ob[1]], cheat = fx ? -r.cheat : r.cheat;
  const u0 = norm(sub(P.t, ob)), T = add(P.t, mul([-u0[1], u0[0]], cheat));
  const uC = norm(sub(T, ob)), gb = sub(ob, mul(uC, 2*R)), v = norm(sub(gb, cb)), cr = v[0]*uC[1] - v[1]*uC[0];
  const theta = Math.acos(Math.max(-1, Math.min(1, dot(v, uC))))/RAD, right = [-v[1], v[0]];
  return {any: step >= SH.any, speed: SHOT_SPEED, len: len(sub(ob, cb)) > 30 ? 'long' : 'short', theta, pathDeg: theta, throwOn: false,
    sign: cr >= 0 ? -1 : 1, P, ob, cb, gb, u: uC, v, n: uC, L: len(sub(T, ob)), tol: pocketTol(P, u0), T, uC, cheat,
    side: dot(uC, right) > 0 ? 'R' : 'L', color: pick(OB_COLORS), answer: nearestRef(theta), pick: null, spot: spotToward(sub(cb, ob)),
    stroke: 'roll', spinR: 1, throwDeg: 0, gbLook: null, strk: null,
    zone: r.lvls.length ? {c: [X(r.zc[0]), r.zc[1]], r: r.zr, step, lvl: r.lvl, lvls: r.lvls, tip: fx ? [-r.tip[0], r.tip[1]] : r.tip} : null};
}
// is a (rounded) record still good? the stroke it was made with must still pot and land in the zone, on the right rails
export function recOk(r, step){
  const s = shotOf(r, step, false);
  if(!s.zone){   // no zone: the right call, played as the game would play it for you, has to pot
    const k = strikeOf(s), st = step === SH.throw ? throwStroke(s) : {V: k.V, tip: [0, k.b]};
    return playAim(s, aimFor(s, st), st, false).made;
  }
  const st = {V: STROKE_MPH[r.lvl]*MPH, tip: r.tip};
  const spec = STEP_STROKES[step](s), res = playAim(s, aimFor(s, st), st, false), rails = spec.rails || [0, 9];
  if(spec.run && len(sub(res.cueEnd, s.gb)) > spec.run) return false;
  if(spec.stun && res.cbRails === 0 && len(sub(res.cueEnd, s.gb)) > STOP_R) return false;
  return res.made && !res.scratch && res.inZone && res.cbRails >= (step === SH.cushion ? 2 : rails[0]) && res.cbRails <= (step === SH.cushion ? 2 : rails[1]);
}
// the shipped library: shots.bin
export let SHIPPED = null;
export function setShipped(v){ SHIPPED = v; }   // (the test hooks and syncRefs set it from outside)
export function parseShipped(buf){
  const b = new Uint8Array(buf); if(String.fromCharCode(...b.subarray(0, 4)) !== 'CTS2') return null;
  const vl = b[4] | (b[5] << 8), ver = new TextDecoder().decode(b.subarray(6, 6 + vl)); let o = 6 + vl;
  const n = b[o++], steps = {};
  for(let i = 0; i < n; i++){
    const st = b[o], table = String(b[o+1]), cnt = b[o+2] | (b[o+3] << 8) | (b[o+4] << 16) | (b[o+5] << 24); o += 6;
    const data = b.subarray(o, o + cnt*REC); o += cnt*REC;
    const byFrac = {};   // record numbers by fraction, to deal the one that's wanted
    for(let j = 0; j < cnt; j++){ const f = (CORE[(data[j*REC + 10] >> 3) & 7] || CORE[0]).id; (byFrac[f] = byFrac[f] || []).push(j); }
    steps[st] = {data, cnt, byFrac, table};
  }
  return {ver, steps};
}
export function fetchShipped(){
  if(typeof fetch === 'function') fetch('shots.bin', {cache: 'no-cache'}).then(r=>r.ok ? r.arrayBuffer() : null).then(buf=>{ if(buf) SHIPPED = parseShipped(buf); }).catch(()=>{});
}
export const shippedOk = () => !!(SHIPPED && SHIPPED.ver === libVer());
const shippedCount = k => shippedOk() && SHIPPED.steps[k] ? SHIPPED.steps[k].cnt : 0;
// your own: built on this device, kept in localStorage as the same 13-byte records
let LIB = null;
function libLoad(){
  if(LIB && LIB.ver === libVer()) return LIB;
  let saved = null; try{ saved = JSON.parse(localStorage.getItem(lsKey('halfball-shotlib')) || 'null'); }catch(e){}
  LIB = {ver: libVer(), steps: {}};
  if(saved && saved.ver === libVer() && saved.fmt === 2) for(const k in saved.steps){ const u = fromB64(saved.steps[k]); LIB.steps[k] = Array.from({length: u.length/REC}, (_, i)=>decodeRec(u, i*REC)); }
  return LIB;
}
function libSave(){
  const steps = {};
  for(const k in LIB.steps){ const u = new Uint8Array(LIB.steps[k].length*REC); LIB.steps[k].forEach((r, i)=>encodeRec(r, u, i*REC)); steps[k] = toB64(u); }
  try{ localStorage.setItem(lsKey('halfball-shotlib'), JSON.stringify({ver: LIB.ver, fmt: 2, steps})); }catch(e){}
}
const mineCount = k => (libLoad().steps[k] || []).length;
const libFull = () => LIB_STEPS.every(k=>mineCount(k) + shippedCount(k) >= LIB_PER_OF(k));
// Dealing from the library just picks: every rule (zones, rails, room for the hand at any height...) was settled when
// the shots were made. The fraction it wants comes from your adaptive mix; a shot dealt in the last 60 isn't picked again.
const RECENT = {};
// A grade's shots are made on the table that grade brings. On another size they're scaled to it (each layout shrinks or
// grows about its pocket, the cut kept exact) and each is checked again before it's dealt, as a live shot
// would be: so a table you pick deals as quickly as the grade's own.
// accept (Practice): a test each dealt shot must also pass (its distance, side...); then only the fraction wanted is dealt, never another
export function fromLibrary(step, bucket, accept){
  const want = REFS[bucket] && REFS[bucket].id, S = shippedOk() && SHIPPED.steps[step] || null, mineAll = libLoad().steps[step] || [], mineAt = tableFor(step);
  let sh = S && S.table === curTable ? S : null, mine = mineAt === curTable ? mineAll : [];
  const scaled = mine.length + (sh ? sh.cnt : 0) < 200;   // too few made on this table: use the others, scaled
  if(scaled){ sh = S; mine = mineAll; }
  if(mine.length + (sh ? sh.cnt : 0) < 200) return null;   // too few yet to avoid repeats: deal live
  const near = reachable(step, sh, mine, mineAt);   // only cue balls you can reach from the rail behind them, and object balls no further from the pocket than the cut allows (obRunOk)
  if(near.size < REACH_LIB_MIN) return null;   // too few of those to avoid repeats: deal live
  const ofFrac = (sh && sh.byFrac[want] || []).map(j=>'s' + j).concat(mine.map((r, j)=>r.frac === want ? 'm' + j : null).filter(Boolean)).filter(id=>near.has(id));
  const all = () => [...near];
  if(accept && ofFrac.length < 8) return null;   // Practice: too few of that fraction here: deal it live
  let list = ofFrac.length >= 8 ? ofFrac : all();
  const recent = RECENT[step] = RECENT[step] || [];
  const recOfId = id => id[0] === 's' ? decodeRec(sh.data, +id.slice(1)*REC) : mine[+id.slice(1)];
  const tooLong = id => {   // phones: the screen is small, so nothing over 3½ ft from cue ball to object ball (as live dealing)
    if(!IS_PHONE || scaled) return false;   // (a scaled shot is measured once scaled)
    const r = recOfId(id);
    return !!r && Math.hypot(r.cb[0] - r.ob[0], r.cb[1] - r.ob[1]) >= PHONE_MAX_D;
  };
  const t0 = performance.now();
  for(let n = 0; n < (scaled || accept ? 80 : 1); n++){
    if(n === 40 && !accept) list = all();   // the fraction wanted won't fit this table: any one rather than a slow live deal
    let id = pick(list);
    for(let t = 0; t < 40 && (recent.includes(id) || tooLong(id)); t++) id = pick(list);
    const rec = recOfId(id), fx = Math.random() < .5;
    const make = f => !rec ? null : scaled ? scaledShot(rec, id[0] === 's' ? sh.table : mineAt, step, f) : shotOf(rec, step, f);   // mirrored left-right half the time
    let s = make(fx);
    if(accept && s && !accept(s)) s = make(!fx);   // mirrored, the cut goes the other way
    if(s && inReach(s) && obRunOk(s) && (!accept || accept(s))){ recent.push(id); if(recent.length > 60) recent.shift(); return s; }
    if(performance.now() - t0 > 160) break;   // none fits yet: deal live
  }
  return null;
}
// The stored shots of a grade whose cue ball is within your reach on this table, with the object ball as near the pocket as its cut asks (scaled, if they were made on another size),
// worked out once per grade, table, height and library size. Mirroring doesn't change it. A grade with fewer than
// REACH_LIB_MIN of them deals live (which keeps to the same rule) rather than repeat the same few shots.
const REACH_LIB_MIN = 100, REACH_IDS = {};
function reachable(step, sh, mine, mineAt){
  const key = [curTable, stanceIn(), sh ? sh.table + sh.cnt : '', mineAt, mine.length].join('|');
  if(REACH_IDS[step] && REACH_IDS[step].key === key) return REACH_IDS[step].ok;
  const ok = new Set(), test = (r, from, id) => { const s = shotOf(from === curTable ? r : scaleRec(r, from), step, false); if(inReach(s) && obRunOk(s)) ok.add(id); };
  for(let j = 0; j < (sh ? sh.cnt : 0); j++) test(decodeRec(sh.data, j*REC), sh.table, 's' + j);
  mine.forEach((r, j)=>test(r, mineAt, 'm' + j));
  REACH_IDS[step] = {key, ok};
  return ok;
}
// a record made on another table, scaled to this one. The cut is kept exactly: the object ball keeps its line to the
// pocket, at the distance scaled, and the cue ball its line to the ghost ball (the pocket and the balls don't scale)
const pocketT = (Pi, w, h) => [[.9, .9], [w-.9, .9], [.9, h-.9], [w-.9, h-.9], [.4, h/2], [w-.4, h/2]][Pi];
export function scaleRec(r, from){
  const [W0, H0] = TABLES[from], k = Math.min((W - 2*R)/(W0 - 2*R), (H - 2*R)/(H0 - 2*R));
  const t0 = pocketT(r.Pi, W0, H0), t1 = pocketT(r.Pi, W, H), u0 = norm(sub(t0, r.ob)), side = [-u0[1], u0[0]];
  const uC = norm(sub(add(t0, mul(side, r.cheat)), r.ob)), gb = sub(r.ob, mul(uC, 2*R)), v = norm(sub(gb, r.cb));
  const turn = Math.atan2(uC[0]*v[1] - uC[1]*v[0], dot(uC, v));   // from the object ball's line to the cue ball's
  const ob = sub(t1, mul(u0, len(sub(t0, r.ob))*k)), uC1 = norm(sub(add(t1, mul(side, r.cheat)), ob)), gb1 = sub(ob, mul(uC1, 2*R));
  const cb = sub(gb1, mul(rot(uC1, turn), len(sub(gb, r.cb))*k));
  return {...r, cb, ob, zc: add(t1, mul(sub(r.zc, t0), k))};
}
// a stored shot on this table, scaled from the one it was made on, and checked again: the same cut (so the same call),
// the same layout rules as live dealing, the right call still pots, and on zone grades the zone is where the stored
// stroke now really sends the cue ball, by the step's rules
function scaledShot(r, from, step, fx){
  if(from === curTable) return shotOf(r, step, fx);
  const s = shotOf(scaleRec(r, from), step, fx), d1 = len(sub(s.gb, s.cb));
  if([s.cb, s.ob].some(p=>p[0] < 2 || p[0] > W-2 || p[1] < 2 || p[1] > H-2)) return null;
  if(s.gb[0] < R || s.gb[0] > W-R || s.gb[1] < R || s.gb[1] > H-R) return null;
  if(len(sub(s.cb, s.ob)) < 4*R || segDist(s.cb, s.ob, s.T) < 2*R + 0.4) return null;
  if(IS_PHONE && len(sub(s.cb, s.ob)) >= PHONE_MAX_D) return null;
  if(!handRoom(s)) return null;
  if(!s.zone){
    const k = strikeOf(s), st = step === SH.throw ? throwStroke(s) : {V: k.V, tip: [0, k.b]}, res = playAim(s, aimFor(s, st), st, false);
    return res.made && !res.scratch ? s : null;
  }
  // the stroke it was made with first, then (as live dealing does) your other strokes that reach the pocket
  const z = s.zone, spec = STEP_STROKES[step](s), V0 = strikeOf(s).V;
  const rails = step === SH.cushion ? [2, 2] : spec.rails || [0, 9];
  const kind = spec.stun ? 0 : step === SH.follow ? 1 : step === SH.draw ? -1 : null;
  s.zone = null;
  for(const lvl of [z.lvl, ...shuffled(COARSE.filter(l=>l !== z.lvl && STROKE_MPH[l]*MPH >= V0))]){
    const st = {V: STROKE_MPH[lvl]*MPH, tip: z.tip};
    if(kind != null && !spinKindOk(kind, spinAtContact(st, d1))) continue;
    s.zone = null;
    const res = playAim(s, aimFor(s, st), st, false), c = res.cueEnd;
    if(!res.made || res.scratch || !res.hit || res.cbRails < rails[0] || res.cbRails > rails[1]) continue;
    if(spec.run && len(sub(c, s.gb)) > spec.run) continue;
    const stop = spec.stun && res.cbRails === 0;
    if(stop && len(sub(c, s.gb)) > STOP_R) continue;
    if(c[0] < 3 || c[0] > W-3 || c[1] < 3 || c[1] > H-3 || POCKETS.some(P=>len(sub(c, P.c)) < 7) || len(sub(c, s.cb)) < 6) continue;
    if(!stop && !zoneSpotOk(s, c)) continue;
    s.zone = {...z, c, lvl, lvls: [lvl]};   // the stroke that lands it (the others aren't checked)
    if(kind === 0 && rollsIn(s, d1)) continue;   // a stun zone a rolling cue ball also reaches teaches nothing
    if(kind === 1 && stunsIn(s, d1)) continue;
    if(kind === -1 && (stunsIn(s, d1) || rollsIn(s, d1))) continue;
    return s;
  }
  return null;
}
// work out one more shot for a step: dealt the full way, rounded to a record, re-checked
export function makeRec(step, bucket){
  GEN.g = +step; GEN.bucket = bucket ?? null;
  let s = null; try{ s = shootDeal(); }catch(e){ s = null; } finally { GEN.g = null; GEN.bucket = null; }
  if(!s || (isZoneStep(step) ? !s.zone || s.zone.step !== +step : !!s.zone)) return null;
  if(+step >= SH.down && !handRoom(s)) return null;   // only shots with room for the bridge hand get stored
  if(reachOf(s) > REACH_PER_HEIGHT*REACH_LIB_CM/2.54) return null;   // and only shots in reach from the rail at the default height
  if(!obRunOk(s)) return null;   // (generate keeps to it already; a record is rounded, so it's checked again as dealt)
  const r = recOf(s);
  return recOk(r, step) ? r : null;
}
function libGrowOne(){
  const L = libLoad(), have = k => mineCount(k) + shippedCount(k), g = stepOf(stats.shoot ? stats.shoot.g : 0), mine = zoneStep(g) || (g <= SH.throw ? g : null);
  const open = LIB_STEPS.filter(k=>have(k) < LIB_PER_OF(k) && tableFor(k) === curTable);   // only steps played on the table that's up
  if(!open.length) return LIB_STEPS.some(k=>have(k) < LIB_PER_OF(k)) ? null : false;
  // the step you're playing fills first, then whichever is shortest
  const step = open.includes(mine) ? mine : open.sort((a, b)=>have(a)/LIB_PER_OF(a) - have(b)/LIB_PER_OF(b))[0];
  const r = makeRec(step);
  if(r){ (L.steps[step] = L.steps[step] || []).push(r); libSave(); }
  return true;
}
let libTimer = 0;
export function libIdle(){
  clearTimeout(libTimer);
  if(libFull() || shippedOk()) return;   // the shipped library is enough: building more here would hold up the page
  libTimer = setTimeout(()=>{ if(S.answered && !S.anim && !cueStroke && !look.k && !S.walkDrag && !tut.on) libGrowOne(); libIdle(); }, 600);   // only while you're looking over a played shot, so it never stutters an aim
}
// where a zone may go: at least 12" from the pocket the object ball goes in, off the object ball's starting spot, and on a
// near-straight shot (under 8°) along the line of the shot, forward or back, not off to the side
export function zoneSpotOk(s, c){
  if(len(sub(c, s.P.c)) < 12 || len(sub(c, s.ob)) < 5) return false;
  if(s.theta < 8){ const v = norm(sub(s.ob, s.cb)), q = sub(c, s.cb); if(Math.abs(v[0]*q[1] - v[1]*q[0]) > 4) return false; }
  return true;
}
// the Throw grade's stroke: stun (tip half a tip low), at pocket speed for a stun shot, as one of your four strokes
export function throwStroke(s){
  const s0 = s.stroke, k0 = s.strk; s.stroke = 'stun'; s.strk = null;
  const V = strikeOf(s).V; s.stroke = s0; s.strk = k0;
  const lvl = COARSE.find(l=>STROKE_MPH[l]*MPH >= V) || COARSE[COARSE.length - 1];
  return {V: STROKE_MPH[lvl]*MPH, tip: [0, -.35]};
}
// A zone grade always deals a zone. At S the step (follow, stun, draw, two cushions, english) is drawn once per try and the
// fraction is picked for that step. Worked out live (a table the library wasn't made for), some fractions rarely or never
// give a zone (a ⅛ cut never does: the stroke that gets it to the pocket is past the 24-diamond cap; stun at ¼ often
// fails), so a try that ends without one is dealt again with another fraction (at S, another step too).
export function shootDeal(){
  if(isDrill() && GEN.g == null && !tut.on) return drillDeal();
  const g = shootLevel(), tried = [];
  let last = null;
  for(let a = 0; a < 5; a++){
    const step = zoneStep(g);
    const bucket = GEN.bucket != null ? GEN.bucket : pickBucket(step, tried);   // the fraction, fixed for all the tries (the library builder asks for each in turn)
    const s = shootDealStep(g, step, bucket);
    if(s && (s.zone || !step || GEN.g != null)) return s;   // (the library builder takes what it gets: makeRec rejects a shot with no zone)
    last = s || last; tried.push(bucket);
  }
  return last || finishDeal(generate());
}
// Practice: a plain pot (no zone, no other balls) that fits your picks. From the stored shots when there are enough of that
// fraction (exact fractions: the Cue and hand grade's; any angle: Any angle's), checked for distance and side and mirrored to
// fit; otherwise worked out live to the same picks. Reach and the room for your bridge hand as on the Ladder; never the
// same layout twice running.
function drillPick(d){   // which fraction (REFS index) and distance ('short', 'long', or null for either)
  if(d.weak){   // the ones you miss most come up more: your weak spots by fraction, then by distance for that fraction
    const m = weakModel(), k = 2, w = REFS.map(r=>Math.pow([0, 1, 2].reduce((a, x)=>a + (m[r.id + x] || 1), 0)/3, k));
    const b = weightedIndex(w), id = REFS[b].id, sh = Math.pow(m[id + 0] || 1, k), lo = Math.pow(((m[id + 1] || 1) + (m[id + 2] || 1))/2, k);
    return {bucket: b, len: Math.random() < lo/(lo + sh) ? 'long' : 'short'};
  }
  return {bucket: weightedIndex(REFS.map(r=>d.fr.includes(r.id) ? 1 : 0)), len: d.dist === 'both' ? null : d.dist};
}
export function drillDeal(){
  const d = drillPicks(), prev = S.shot, side = d.side === 'both' ? null : d.side, t0 = performance.now();
  const same = s => !!prev && len(sub(s.cb, prev.cb)) < .5 && len(sub(s.ob, prev.ob)) < .5;
  let last = null;
  for(let a = 0; a < 6; a++){
    const p = drillPick(d), want = REFS[p.bucket].id;
    const fits = s => !!s && s.answer.id === want && (!p.len || s.len === p.len) && (!side || s.side === side || s.theta <= 2) && !same(s);
    const lib = fromLibrary(d.ang === 'any' ? SH.any : SH.down, p.bucket, fits);
    if(lib) return finishDeal(lib);
    DRILL_GEN = {len: p.len, side};
    try{
      for(let t = 0; t < 30; t++){
        const s = generate(p.bucket);
        if(!fits(s)) continue;
        last = last || s;
        if((handRoom(s) && diamondsFromSpeed(strikeOf(s).V) <= 24) || performance.now() - t0 > 400) return finishDeal(s);
      }
    } finally { DRILL_GEN = null; }
  }
  return finishDeal(last || generate());
}
function shootDealStep(g, step, bucket){
  let best = null;
  const t0 = performance.now(), late = () => GEN.g == null && performance.now() - t0 > 220;   // dealing has a budget (not when building the library): past it, the extra checks are skipped
  const TRIES = step === SH.full ? 90 : step === SH.cushion ? 80 : 40;   // two-, three- and four-rail routes take more finding
  const key = step || (g <= SH.throw ? g : null);
  if(GEN.g == null && key != null){ const L = fromLibrary(key, bucket); if(L) return finishDeal(L); }   // a stored shot, if the library has one
  if(step && GEN.g == null && REFS[bucket] && REFS[bucket].id === '18') return null;   // live, a ⅛ cut never finds a zone: another fraction (see above)
  for(let tries = 0; tries < TRIES + (step ? 40 : 0); tries++){
    const s = dealShot(bucket);   // leaning on your weak spots
    if(!s) continue;
    if(!handRoom(s) && tries < TRIES - 4) continue;   // your bridge hand has to fit on the cloth behind the cue ball (no rail bridges yet)
    best = best || s;
    if(diamondsFromSpeed(strikeOf(s).V) > 24) continue;   // no shots that need a near-break stroke just to reach the pocket
    if(g === SH.throw){
      // throw: struck soft with stun, so the object ball goes a little fuller than it looks. Any-angle shots as usual (the
      // fraction mix stays even); throw simply moves some of them to a thinner call
      if(s.L < 18) continue;
      const soft = throwStroke(s);
      s.answer = nearestRef(cutForDir(s, aimFor(s, soft)));
      return finishDeal(s);
    }
    if(!step) return finishDeal(s);
    if(step === SH.cushion && tries < TRIES - 20 && !late()){ const z = twoRailZone(s); if(!z) continue; s.zone = z; return finishDeal(s); }   // the last tries fall back to a plainer cushion zone below
    // the zone is made with a stroke you can actually play: one of your four speeds, and a tip on the pad's half-tip steps
    const spec = step === SH.cushion ? {tip:[0, rnd(-.2,.45)], k:[1.6, 3.2], rails:[1, 2]} : STEP_STROKES[step](s), V0 = strikeOf(s).V, d1 = len(sub(s.gb, s.cb));
    // every stroke that reaches the pocket, in random order, so the zones use the ¾ and full strokes as often as ½;
    // past the normal tries the rail and second-stroke rules are eased, so a zone grade is never dealt without a zone
    const relax = tries >= TRIES, railsOk = n => relax ? n <= 2 : n >= spec.rails[0] && n <= spec.rails[1];
    const lvls = shuffled(COARSE.filter(l=>STROKE_MPH[l]*MPH >= V0));
    let found = null;
    for(const lvl of lvls){
      const zs = {V: STROKE_MPH[lvl]*MPH, tip: snapTip(spec.tip)};
      // stun: centre ball, and only a stroke with the pace to still be sliding at contact (spin under a fifth of
      // rolling), so it leaves along the tangent line. Fuller hits and longer shots need the ¾ or full stroke for that.
      const kind = spec.stun ? 0 : step === SH.follow ? 1 : step === SH.draw ? -1 : null;   // never eased, even past the normal tries
      if(kind != null && !spinKindOk(kind, spinAtContact(zs, d1))) continue;
      let r = playAim(s, quickAim(s, zs), zs, false);
      if(!r.made || r.scratch || !r.hit || !railsOk(r.cbRails)) continue;
      if(!zs.tip[0]) r = playAim(s, aimFor(s, zs), zs, false);   // and played exactly as your right call would play it
      if(!r.made || r.scratch || !r.hit || !railsOk(r.cbRails)) continue;
      const c = r.cueEnd;
      if(spec.run && len(sub(c, s.gb)) > spec.run) continue;
      const stop = spec.stun && r.cbRails === 0;
      if(stop && len(sub(c, s.gb)) > STOP_R) continue;   // stun with no rail: only a stop shot, not a slide out along the tangent line
      if(c[0] < 3 || c[0] > W-3 || c[1] < 3 || c[1] > H-3) continue;
      if(POCKETS.some(P=>len(sub(c, P.c)) < 7)) continue;
      if(len(sub(c, s.cb)) < 6) continue;                 // a zone where the cue ball started is no test
      if(!relax && !stop && !zoneSpotOk(s, c)) continue;
      s.zone = {c, r: g >= SH.cushion ? 5 : 6, step, lvl, tip: zs.tip};
      if(kind === 0 && rollsIn(s, d1)){ s.zone = null; continue; }    // a stun zone a rolling cue ball also reaches teaches nothing
      if(kind === 1 && stunsIn(s, d1)){ s.zone = null; continue; }    // a follow zone a stun also reaches: the top isn't doing it
      if(kind === -1 && (stunsIn(s, d1) || rollsIn(s, d1))){ s.zone = null; continue; }   // nor for draw
      // routes with a rail: the zone should take more than one stroke you can play (a different speed, or the tip half a
      // tip another way), unless none turns up after many tries
      if(!relax && r.cbRails >= 1 && tries < TRIES*.7 && !late() && !otherWays(s, zs, lvl)){ s.zone = null; continue; }
      found = s; break;
    }
    if(!found) continue;
    return finishDeal(s);
  }
  return finishDeal(best || generate());
}
function finishDeal(s){
  s.cam = {phase: 'stand', k: 0};
  return s;
}
// ---------- S: an 8-ball table ----------
// At S the shot comes up as it would in a game of 8-ball: the 8 and a handful of solids and stripes are on the table too.
// They're added once the shot is final (never in the library) and placed clear of everything the shot uses: both balls'
// whole paths on the right call (with your stroke, and with the zone's), the ghost ball, the zone, your cue and bridge
// hand, and the pockets, with at least a ball's width of cloth to spare. They're in the engine as well (playAim), so a
// wrong call that runs into one plays out for real; the right one never reaches them.
const EXTRA_GAP = 2*R;   // cloth between an extra ball and anything the shot uses
const extrasOn = () => GEN.g == null && !tut.on && isLadder() && shootLevel() >= SH.all;
function extraKeepOut(s){   // capsules [a, b, r]: no extra ball's centre within r of the segment a–b
  const keep = [], z = s.zone, sq = shaftSq();
  const strokes = [shotStroke(s), ...(z ? [{V: STROKE_MPH[z.lvl]*MPH, tip: z.tip}] : [])];
  for(const st of strokes){
    const run = playAim(s, aimFor(s, st, sq), st, true, sq);
    for(const id of ['c', 'o']){
      let last = null;
      for(const q of run.sim.paths[id]){
        if(q.z < -R) break;   // down the pocket
        if(last && len(sub(q.p, last)) < .5) continue;
        keep.push([last || q.p, q.p, 2*R + EXTRA_GAP]); last = q.p;
      }
    }
  }
  keep.push([s.cb, s.gb, 2*R + EXTRA_GAP]);
  for(const g of [s.gb, s.gbLook]) if(g) keep.push([g, g, 2*R + EXTRA_GAP]);
  keep.push([s.ob, s.T || s.P.t, 2*R + EXTRA_GAP]);   // the line to the pocket itself
  if(z) keep.push([z.c, z.c, z.r + R + EXTRA_GAP]);
  // your cue and bridge hand: back along the aim from the cue ball, a forearm and the hand (at least 15"), and the hand's width
  const u = norm(sub(s.gbLook || s.gb, s.cb)), back = Math.max(15, bridgeLen(s, u) + 4);
  keep.push([s.cb, sub(s.cb, mul(u, back)), R + 2 + EXTRA_GAP]);
  return keep;
}
export function addExtras(s){
  if(!s || !extrasOn()) return s;
  const keep = extraKeepOut(s), T = engineTable(), placed = [];
  const capD = (p, [a, b]) => { const v = sub(b, a), l2 = dot(v, v), k = l2 > 1e-9 ? Math.max(0, Math.min(1, dot(sub(p, a), v)/l2)) : 0; return len(sub(p, add(a, mul(v, k)))); };
  const ok = p => p[0] > R + .3 && p[0] < W - R - .3 && p[1] > R + .3 && p[1] < H - R - .3
    && T.pockets.every(P=>len(sub(p, P.mouthMid)) > P.mouth/2 + R + 2)                  // not in or touching a pocket
    && placed.every(x=>len(sub(p, x.p)) > 2*R + .2)                                      // not on another ball
    && keep.every(c=>capD(p, c) > c[2]);
  const own = +s.color[1], others = shuffled([1,2,3,4,5,6,7,9,10,11,12,13,14,15].filter(n=>n !== own));
  const want = [...(own !== 8 ? [8] : []), ...others.slice(0, 2 + Math.floor(Math.random()*7))];   // the 8, and 2 to 8 more
  for(const n of want){
    for(let k = 0, tries = n === 8 ? 600 : 80; k < tries; k++){
      const p = [rnd(R, W - R), rnd(R, H - R)];
      if(!ok(p)) continue;
      placed.push({id: 'x' + n, p, color: OB_COLORS[n - 1], spot: spotToward(sub(s.cb, p))});
      break;
    }
  }
  s.extra = placed;
  return s;
}

// ---------- Run-outs: pattern play, from S ----------
// A rack of object balls, dealt so the first shot is on, and played on from wherever the cue ball stops: shape is yours to
// play, by feel, with no zone drawn. The setup (the Run-outs sheet) decides the rack: how many balls, where they're spread
// (the whole table or the foot half), who picks the shot, and the order rule.
//   Pattern: Planned: before the first shot you pick every ball and its pocket, in order (a ball, then its pocket, till the
//   rack is planned), and then shoot the plan: each shot comes up on the next ball of it, aimed at its pocket, nothing to tap.
//   The pocket can be changed on the way (the plan stands); another ball out of order is allowed but the rack is no longer a
//   planned run. Any order: the easiest ball that's makeable from where the cue ball lies is picked for you each shot (a clear
//   path to it and from it to a pocket, no thin cut, the pocket-speed shot dropping clean, the cue ball within your reach).
//   Rules: open; 8-ball last (a black 8 that has to be the last to drop, so the 8 going early ends the run); Rotation
//   (balls 1..N, the lowest on the table is always the one to hit).
// Every shot is called as on the ladder, with every stroke and spin you have. The called ball must be the first the cue ball
// touches (else a foul) and must drop in the called pocket (else a miss); anything else that drops on a legal shot stays
// down and counts. A miss, a scratch, a foul, a hook (another ball in the way of every shot on the balls allowed) or no shot left ends the run; clearing the rack is a full run. Nothing here
// moves the ladder's grade or points.
const RUN_DEF = {tb: '9', n: 3, pat: 'plan', area: 'full', order: 'any'};
const RUN_PAT = {plan: 'Planned', auto: 'Any order'}, RUN_ORDER = {any: 'Open', eight: '8-ball last', rot: 'Rotation'};
export function runPicks(){   // the saved picks, made safe
  const d = {...RUN_DEF, ...(settings.run || {})};
  if(!tableUnlocked(d.tb)) d.tb = gradeTable(ladderBest());
  d.n = Math.max(3, Math.min(9, Math.round(+d.n) || 3));
  if(d.pat === 'call') d.pat = 'plan';   // (Call each shot, dropped: those racks are planned now)
  if(!RUN_PAT[d.pat]) d.pat = 'plan'; if(!RUN_ORDER[d.order]) d.order = 'any'; if(d.area !== 'half') d.area = 'full';
  return d;
}
export const runSummary = () => { const d = runPicks(); return `${d.n} balls · ${RUN_PAT[d.pat]}${d.order !== 'any' ? ' · ' + RUN_ORDER[d.order] : ''}${d.area === 'half' ? ' · Half table' : ''}`; };   // for the pill
const runKey = () => { const d = runPicks(); return [d.n, d.pat, d.area, d.order].join('|'); };
const RUN_MAX_CUT = 80, RUN_CALL_CUT = 88, RUN_GAP = 0.4;   // the thinnest cut picked for you (an eighth-ball cut is 82°); the thinnest you can call; cloth between a path and another ball
// the rack: {id, tb, key, set, n0, potted, shots, balls: [{n, p}], cb, pick: {n, Pi} | null (the shot up now), plan: [{n, Pi}] | null (the rack as
// planned), planning: [{n, Pi}] (the plan so far), call: {mode: 'plan' | 'change', n, msg, was} | null (the picker is up), off: the ball
// at which the plan was left (out of order) | null, over, why}
// Reach in a run: the ladder stands you at the rail behind the cue ball along the aim; in a game you stand at any rail the shot
// doesn't fire into, so the cue ball is in reach when it's within reach of that rail too (its distance straight in from it)
function runReach(s){
  const u = norm(sub(s.gb, s.cb)), p = s.cb;
  let d = reachOf(s);
  for(const [x, n] of [[p[0], [1, 0]], [W - p[0], [-1, 0]], [p[1], [0, 1]], [H - p[1], [0, -1]]]) if(dot(u, n) > -0.25) d = Math.min(d, x);
  return d;
}
export const runFoul = r => { const first = r.sim.events.find(e=>e.type === 'ball' && e.ids.includes('c')); return !!first && !first.ids.includes('o'); };   // another ball before the called one
export function runShot(cb, b, P, others){   // the shot as the ladder has it: the called ball b, its pocket, the other balls in the engine too (as S's extra balls)
  const s = {cb: [...cb], ob: [...b.p], P, color: OB_COLORS[b.n - 1], any: true, speed: SHOT_SPEED, stroke: 'roll', spinR: 1, throwOn: false, pick: null, run: b.n};
  rebuildShot(s);
  s.side = -s.uC[0]*s.v[1] + s.uC[1]*s.v[0] > 0 ? 'R' : 'L';
  s.len = len(sub(s.ob, s.cb)) >= 36 ? 'long' : 'short';
  s.spot = spotToward(sub(s.cb, s.ob));
  s.extra = others.map(x=>({id: 'x' + x.n, p: [...x.p], color: OB_COLORS[x.n - 1], spot: spotToward(sub(cb, x.p))}));
  return finishDeal(s);
}
const runLowest = balls => balls.length ? Math.min(...balls.map(b=>b.n)) : null;
// the balls a shot may be on: in 8-ball last the 8 waits till it's alone; in Rotation only the lowest
export function runAllowed(balls, set){
  set = set || S.RUN.set;
  if(set.order === 'rot'){ const n = runLowest(balls); return n == null ? [] : [n]; }
  if(set.order === 'eight' && balls.length > 1) return balls.map(b=>b.n).filter(n=>n !== 8);
  return balls.map(b=>b.n);
}
const runPlanNext = () => S.RUN.plan ? S.RUN.plan.find(e=>S.RUN.balls.some(b=>b.n === e.n)) ?? null : null;   // the next of the plan still up
// the ball the rules name next (Rotation: the lowest; a planned rack: the next of the plan still up), or null: your call
export const runTarget = () => S.RUN.set.order === 'rot' ? runLowest(S.RUN.balls) : S.RUN.set.pat === 'plan' && S.RUN.plan ? (runPlanNext() || {}).n ?? null : null;
// The easiest shot on from here among the balls allowed, or null: every ball to every pocket is sized up by geometry first (cut,
// pocket angle, clear paths, reach), the plainest tried first in the engine at pocket speed, and the first that drops clean is the shot.
export function runPick(cb, balls, allowed){
  if(!cb || !balls.length) return null;
  const cands = [];
  for(const b of balls){
    if(allowed && !allowed.includes(b.n)) continue;
    const others = balls.filter(x=>x !== b);
    if(len(sub(b.p, cb)) < 2*R + 1) continue;   // frozen to the cue ball: another ball
    for(const P of POCKETS){
      const s = runShot(cb, b, P, others);
      if(s.theta > RUN_MAX_CUT) continue;
      const u = s.uC;
      const into = P.side ? dot(u, mul(P.n, -1)) : dot(u, norm([Math.sign(P.c[0] - W/2), Math.sign(P.c[1] - H/2)]));   // how square to the pocket it comes in (1 is dead on)
      if(into < Math.cos(50*RAD)) continue;   // (the engine has the last word: a steep way in that still drops is on)
      if(s.gb[0] < R || s.gb[0] > W - R || s.gb[1] < R || s.gb[1] > H - R) continue;
      if(others.some(x=>segDist(x.p, cb, s.gb) < 2*R + RUN_GAP || segDist(x.p, s.ob, s.T) < 2*R + RUN_GAP)) continue;   // the paths to the ball and to the pocket are clear
      if(runReach(s) > reachMax()) continue;
      if(strikeOf(s).V > STROKE_MPH[8]*MPH) continue;   // pocket speed past a ¾ stroke: too far or too thin to be on
      const D = len(sub(s.ob, s.cb)), hand = handRoom(s), ok = obRunOk(s);
      cands.push({s, n: b.n, Pi: POCKETS.indexOf(P), score: s.theta/45 + D/48 + s.L/48 + (1 - into)*1.5 + (hand ? 0 : .6) + (ok ? 0 : .5)});   // plainest first: full, short, square to the pocket, room for the hand
    }
  }
  cands.sort((a, b)=>a.score - b.score);
  const t0 = performance.now();
  for(const c of cands){
    const q = strikeOf(c.s), st = {V: q.V, tip: [0, q.b]}, r = playAim(c.s, aimFor(c.s, st), st, false);
    if(r.made && !r.scratch && !runFoul(r)) return {n: c.n, Pi: c.Pi, s: c.s};
    if(performance.now() - t0 > 900) break;   // past the budget what's left is the hard end of the list anyway
  }
  return null;
}
// Before every shot: is any ball the rules allow makeable from here? A ball is makeable into a pocket when the cut is one you can
// call (the same limits as the picker: not frozen, the ghost ball on the table, no thinner than RUN_CALL_CUT, the cue ball in reach)
// and both straight paths are clear: the cue ball to the ghost ball, and the ball to the pocket (the same blocker check runPick uses,
// with a little cloth to spare, RUN_GAP). Kicks and banks aren't played here. Returns null when some ball is on; else {n, by} when another ball
// (by) sits across the cue ball's path to n: hooked; else {n: null}: no shot left.
function runStuck(cb, balls){
  const allowed = runAllowed(balls); if(!cb || !allowed.length) return null;
  let hook = null;
  for(const n of allowed){
    const b = balls.find(x=>x.n === n); if(!b) continue;
    const others = balls.filter(x=>x !== b);
    if(len(sub(b.p, cb)) < 2*R + 1) continue;   // frozen to the cue ball: no hit on it
    for(const P of POCKETS){
      const s = runShot(cb, b, P, others);
      if(s.theta > RUN_CALL_CUT || s.gb[0] < R || s.gb[0] > W - R || s.gb[1] < R || s.gb[1] > H - R) continue;
      if(runReach(s) > reachMax()) continue;
      const block = others.filter(x=>segDist(x.p, cb, s.gb) < 2*R + RUN_GAP);
      if(!block.length){ if(!others.some(x=>segDist(x.p, s.ob, s.T) < 2*R + RUN_GAP)) return null; continue; }   // a clear shot: on
      if(!hook){ const by = block.reduce((m, x)=>len(sub(x.p, cb)) < len(sub(m.p, cb)) ? x : m); hook = {n, by: by.n}; }
    }
  }
  return hook || {n: null};
}
export function newRack(){
  const set = runPicks(), T = engineTable(), pad = R + 2;
  const y1 = set.area === 'half' ? H/2 - pad : H - pad;   // the foot half: the top of the table as drawn, up to the middle
  const free = (p, balls) => T.pockets.every(P=>len(sub(p, P.mouthMid)) > P.mouth/2 + R + 2) && balls.every(b=>len(sub(p, b.p)) > 2*R + 1);   // not in a pocket, not on another ball
  const spot = balls => { for(let k = 0; k < 200; k++){ const p = [rnd(pad, W - pad), rnd(pad, y1)]; if(free(p, balls)) return p; } return null; };
  const rest = shuffled([1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15]);
  const nums = set.order === 'rot' ? Array.from({length: set.n}, (_, i)=>i + 1) : set.order === 'eight' ? [8, ...rest.slice(0, set.n - 1)] : rest.slice(0, set.n);
  let best = null;
  for(let t = 0; t < 160; t++){
    const balls = [];
    for(const n of shuffled(nums)){ const p = spot(balls); if(!p) break; balls.push({n, p}); }
    if(balls.length < set.n) continue;
    const cb = spot(balls); if(!cb) continue;
    const pick = runPick(cb, balls, runAllowed(balls, set)); if(!pick) continue;   // the first shot is on (whoever picks it)
    best = best || {balls, cb, pick};
    const D = len(sub(pick.s.ob, pick.s.cb));
    if(t < 100 && pick.s.theta < 8 && D < 14) continue;   // no gimme to start: some angle or some length
    best = {balls, cb, pick}; break;
  }
  if(!best) return;   // (never: a free table always has a shot on)
  S.RUN = {id: Date.now().toString(36), tb: curTable, key: runKey(), set, n0: set.n, potted: 0, shots: 0, balls: best.balls, cb: best.cb,
    pick: set.pat === 'auto' ? {n: best.pick.n, Pi: best.pick.Pi} : null, plan: null, planning: [], call: set.pat === 'plan' ? {mode: 'plan', n: null, msg: ''} : null, off: null, over: false, why: null};
}
export function runDeal(){   // the shot on now: a fresh rack when there's no run, the last one ended, or the setup or table changed
  if(!S.RUN || S.RUN.over || S.RUN.tb !== curTable || S.RUN.key !== runKey()) newRack();
  if(!S.RUN) return finishDeal(generate());
  if(!S.RUN.pick && !S.RUN.call) runNextPlanned();   // a planned rack: the next shot of the plan (or the picker, when it isn't on from here)
  if(!S.RUN.pick) return runCallShot();   // the picker: the table from above, the balls and pockets there to tap
  const b = S.RUN.balls.find(x=>x.n === S.RUN.pick.n);
  return runShot(S.RUN.cb, b, POCKETS[S.RUN.pick.Pi], S.RUN.balls.filter(x=>x !== b));
}
function runNextPlanned(){   // the plan's next ball to its planned pocket, if that's on from where the cue ball lies; else the picker, with the reason
  const e = runPlanNext(); if(!e) return;
  const msg = runCallCheck(e.n, e.Pi);
  if(!msg){ S.RUN.pick = {n: e.n, Pi: e.Pi}; return; }
  S.RUN.call = {mode: 'change', n: null, msg: `The ${e.n} to the ${POCKET_NAME[e.Pi]} isn’t on: ${msg.charAt(0).toLowerCase() + msg.slice(1)}`, was: null};
}
// ---- the picker: the plan before the first shot (a ball, then its pocket, for every ball), or a change on the way ----
export const runStage = () => S.RUN.call ? S.RUN.call.mode : null;
export const runPicking = () => isRun() && !!S.RUN && !S.RUN.over && !!S.shot && !!S.shot.calling && !S.answered && !tut.on;
const nearestPocket = p => POCKETS.reduce((b, P, i)=>len(sub(P.c, p)) < len(sub(POCKETS[b].c, p)) ? i : b, 0);
// while planning, the ball a pocket is being picked for: the one tapped; in Rotation the lowest not yet planned; the last ball left either way
function runPlanBallNow(){
  const c = S.RUN.call, pl = S.RUN.planning, left = S.RUN.balls.map(b=>b.n).filter(n=>!pl.some(e=>e.n === n));
  if(S.RUN.set.order === 'rot') return left.length ? Math.min(...left) : null;
  if(c.n != null) return c.n;
  return left.length === 1 ? left[0] : null;
}
const runPlanDoneOk = () => !!S.RUN.call && S.RUN.call.mode === 'plan' && S.RUN.planning.length === S.RUN.balls.length;
function runCallShot(){   // the shot under the picker: the ball in question, the table seen from above (no pocket marked, nothing suggested)
  const c = S.RUN.call, n = c.n ?? runTarget() ?? runAllowed(S.RUN.balls)[0] ?? S.RUN.balls[0].n, b = S.RUN.balls.find(x=>x.n === n);
  const s = runShot(S.RUN.cb, b, POCKETS[nearestPocket(b.p)], S.RUN.balls.filter(x=>x !== b));
  s.calling = true; s.stage = c.mode; return s;
}
// a ball into a pocket from here, checked by geometry: the cut it needs, the ghost ball on the table, the cue ball in reach
export function runCallCheck(n, Pi){
  const b = S.RUN.balls.find(x=>x.n === n), s = runShot(S.RUN.cb, b, POCKETS[Pi], S.RUN.balls.filter(x=>x !== b));
  if(len(sub(b.p, S.RUN.cb)) < 2*R + 1) return 'The cue ball is frozen to it: there’s no hit on it.';
  if(s.theta > RUN_CALL_CUT || s.gb[0] < R || s.gb[0] > W - R || s.gb[1] < R || s.gb[1] > H - R) return `Too thin to cut in there from here.`;
  if(runReach(s) > reachMax()) return 'Out of reach from here: too far from any rail you can stand at.';
  return null;
}
const runBallOn = n => POCKETS.some((P, i)=>!runCallCheck(n, i));   // some pocket is callable for it
function runNotAllowed(n){ const set = S.RUN.set; return set.order === 'eight' && n === 8 ? 'The 8 goes last.' : set.order === 'rot' ? `Rotation: the ${runLowest(S.RUN.balls)} is next.` : ''; }
export function runTapBall(n){
  if(!runPicking()) return;
  const c = S.RUN.call, pl = S.RUN.planning;
  if(c.mode === 'plan'){
    const i = pl.findIndex(e=>e.n === n);
    if(S.RUN.set.order === 'rot'){ c.msg = i >= 0 ? '' : `Rotation: the ${runPlanBallNow()} is next. Pick its pocket.`; return runRefresh(); }
    if(i >= 0){ c.msg = `The ${n} is ${i + 1} in your plan. Undo to change it.`; return runRefresh(); }
    if(S.RUN.set.order === 'eight' && n === 8 && pl.length < S.RUN.balls.length - 1){ c.msg = 'The 8 goes last.'; return runRefresh(); }
    c.n = n; c.msg = ''; return runRefresh();
  }
  if(!runAllowed(S.RUN.balls).includes(n)){ c.msg = runNotAllowed(n); return runRefresh(); }
  if(!runBallOn(n)){ c.msg = `The ${n} is out of reach from here. Pick another ball.`; return runRefresh(); }
  c.n = n; c.msg = ''; runRefresh();
}
export function runTapPocket(Pi){
  if(!runPicking() || Pi == null) return;
  const c = S.RUN.call, pl = S.RUN.planning;
  if(c.mode === 'plan'){
    const n = runPlanBallNow();
    if(n == null){ c.msg = 'Pick a ball first.'; return runRefresh(); }
    if(!pl.length){ const msg = runCallCheck(n, Pi); if(msg){ c.msg = msg; return runRefresh(); } }   // the first shot has to be on from where the cue ball lies
    pl.push({n, Pi}); c.n = null; c.msg = '';
    return runRefresh();
  }
  const n = c.n ?? runTarget(); if(n == null){ c.msg = 'Pick a ball first.'; return runRefresh(); }
  const msg = runCallCheck(n, Pi); if(msg){ c.msg = msg; return runRefresh(); }
  const next = runPlanNext();
  if(next && n === next.n) next.Pi = Pi;   // the pocket changed: the plan stands
  else if(next && S.RUN.off == null) S.RUN.off = S.RUN.potted + 1;   // another ball, out of order: not a planned run any more
  S.RUN.pick = {n, Pi}; S.RUN.call = null; deal();   // the call is made: down to the ladder's routine
}
export function runUndoPlan(){   // the last tap back: the ball waiting for its pocket, else the last pair
  if(!runPicking()) return;
  const c = S.RUN.call;
  if(c.n != null && !(c.mode === 'plan' && S.RUN.set.order === 'rot')) c.n = null; else if(c.mode === 'plan') S.RUN.planning.pop();
  c.msg = ''; runRefresh();
}
export function runPlanDone(){ if(!runPicking() || !runPlanDoneOk()) return; S.RUN.plan = S.RUN.planning.map(e=>({...e})); S.RUN.call = null; deal(); }
export function runChange(){   // mid-rack: the same picker, for a pocket for the ball up now, or another ball and its pocket
  if(!isRun() || !S.RUN || S.RUN.over || !S.RUN.plan || !S.RUN.pick || !S.shot || S.shot.calling || !shotIdle() || tut.on) return;
  S.RUN.call = {mode: 'change', n: null, msg: '', was: S.RUN.pick}; S.RUN.pick = null; deal();
}
export function runChangeBack(){ if(!runPicking() || S.RUN.call.mode !== 'change' || !S.RUN.call.was) return; S.RUN.pick = S.RUN.call.was; S.RUN.call = null; deal(); }
export function runQuit(){   // no shot you'd take: the run ends here (counted once a ball has been shot at)
  if(!runPicking()) return;
  runOver('noshot'); S.answered = true; S.shot.stage = null;
  $('quick').innerHTML = rcardHTML('Run over', 'no', [], '', `${RUN_WHY.noshot} · ${S.RUN.potted} of ${S.RUN.n0} balls`);
  updateControls(); renderRun(); renderModeChip();
}
function runRefresh(){ pendCard(); renderRunPick(); }
function runOver(why){
  S.RUN.over = true; S.RUN.why = why; S.RUN.pick = null; S.RUN.call = null;
  if(!S.RUN.shots && !S.RUN.potted) return;   // a rack given up before a shot isn't a rack played
  const tally = r => { r.racks++; r.balls += S.RUN.potted; if(why === 'clear') r.full++; r.best = Math.max(r.best, S.RUN.potted); };
  const r = stats.run = stats.run || {racks: 0, balls: 0, full: 0, best: 0};
  tally(r); const by = r.by = r.by || {}; tally(by[S.RUN.key] = by[S.RUN.key] || {racks: 0, balls: 0, full: 0, best: 0});
  save();
}
// After a shot: the balls where they stopped (any that dropped are off the table), then the next shot, or the run's end.
// Returns what the log keeps of it: the rack and its setup, which ball of it, whether the plan was left, and how the run ended if it did.
export function runAfterShot(s, run, foul){
  if(!S.RUN || S.RUN.over) return {};
  const B = run.sim.balls, at = id => B.find(b=>b.id === id), gone = b => !b || b.state === 'gone' || b.state === 'falling' || !!b.pocket;
  const ball = S.RUN.potted + 1; S.RUN.shots++;
  const balls = [];
  for(const x of S.RUN.balls){ const b = at(x.n === s.run ? 'o' : 'x' + x.n); if(!gone(b)) balls.push({n: x.n, p: [...b.p]}); }
  S.RUN.balls = balls;
  const c = at('c'); S.RUN.cb = gone(c) ? null : [...c.p];
  const clean = run.made && !run.scratch && !foul;
  if(clean) S.RUN.potted = S.RUN.n0 - balls.length;   // a second ball that dropped with it is off the table too
  let why = null;
  if(!clean) why = run.scratch ? 'scratch' : foul ? 'foul' : 'miss';
  else if(S.RUN.set.order === 'eight' && balls.length && !balls.some(b=>b.n === 8)) why = 'eight';   // the 8 went down with balls still up
  else if(!balls.length) why = 'clear';
  else if((S.RUN.hook = runStuck(S.RUN.cb, balls))) why = S.RUN.hook.n != null ? 'hooked' : 'noshot';   // every pattern, every rule: nothing makeable ends it
  else if(S.RUN.set.pat === 'auto'){ const p = runPick(S.RUN.cb, balls, runAllowed(balls)); S.RUN.pick = p ? {n: p.n, Pi: p.Pi} : null; if(!p) why = 'noshot'; }
  else { S.RUN.pick = null; S.RUN.call = null; }   // the plan's next, from where the cue ball lies
  if(why) runOver(why);
  renderRun();
  return {rk: S.RUN.id, rb: ball, rn: S.RUN.n0, rp: S.RUN.set.pat[0], ro: S.RUN.set.order[0], rh: S.RUN.set.area === 'half' ? 1 : undefined, rx: S.RUN.off ? 1 : undefined, re: why || undefined};
}
const RUN_WHY = {miss: 'Missed', scratch: 'Scratch', foul: 'Foul', noshot: 'No shot left', hooked: 'Hooked', eight: 'The 8 dropped early', clear: 'Rack cleared'};
const runOffNote = () => S.RUN.off ? `Out of order at ball ${S.RUN.off}: not a planned run` : '';
export function renderRun(){   // the row under the result card: the rack so far, or the run's summary once it's over
  const el = $('runrow'); if(!el) return;
  el.hidden = !isRun() || !S.RUN || tut.on;
  if(el.hidden){ renderRunPick(); return; }
  const r = stats.run || {racks: 0, best: 0}, dots = `<span class="rundots" aria-hidden="true">${Array.from({length: S.RUN.n0}, (_, i)=>`<i class="${i < S.RUN.potted ? 'on' : S.RUN.over && i === S.RUN.potted && S.RUN.why !== 'clear' ? 'off' : ''}"></i>`).join('')}</span>`;
  const aside = `<span class="runaside"><span>Best run <b>${Math.max(r.best, S.RUN.potted)}</b></span><span>Racks <b>${r.racks}</b></span></span>`;
  if(!S.RUN.over){
    const next = S.RUN.pick ? null : runTarget(), plan = S.RUN.plan ? ` · plan ${S.RUN.plan.map(e=>S.RUN.balls.some(b=>b.n === e.n) ? e.n : `<s>${e.n}</s>`).join(' › ')}` : '';
    const change = S.RUN.plan && S.RUN.pick && S.shot && !S.shot.calling && !S.answered ? ` · <button class="link" id="runchange" aria-label="Change this shot: its pocket, or another ball">Change</button>` : '';
    el.innerHTML = `<span class="runhead">${dots}<span><b>Ball ${S.RUN.potted + 1} of ${S.RUN.n0}</b> · ${S.RUN.potted} run${next != null ? ` · the ${next} next` : ''}${plan}${S.RUN.off ? ' · ' + runOffNote().toLowerCase() : ''}${change}</span></span>${aside}`;
  } else {
    const full = S.RUN.why === 'clear';
    el.innerHTML = `<span class="runhead">${dots}<span><span class="runverd ${full ? 'ok' : 'no'}">${full ? 'Full run' : 'Run over'}</span><br><b>${S.RUN.potted} of ${S.RUN.n0}</b> balls · ${S.RUN.why === 'hooked' && S.RUN.hook ? `Hooked: the ${S.RUN.hook.by} is in the way of the ${S.RUN.hook.n}.` : RUN_WHY[S.RUN.why]}${S.RUN.off ? ' · ' + runOffNote() : ''}</span></span>${aside}`;
  }
  renderRunPick();
}
// ---- the picker over the table: a target on every ball and every pocket, drawn in the table's own coordinates ----
// An SVG laid over the table with the same viewBox as the table drawn from above, so each target sits exactly on its ball or
// pocket at any size: a hit circle (44 px or more; sizes come from the box's size at render), a quiet ring on what can be
// picked now, a gold ring on the ball a pocket is being picked for, and a numbered badge, the ball's place in the plan, with the
// same number at its pocket. Tab or the arrows go round the targets, Enter or Space picks, and each says what it is.
const POCKET_NAME = ['top-left corner', 'top-right corner', 'bottom-left corner', 'bottom-right corner', 'left side', 'right side'];
const POCKET_SHORT = ['top left', 'top right', 'bottom left', 'bottom right', 'left side', 'right side'];
export function renderRunPick(){
  const el = $('runpick'); if(!el) return;
  const on = runPicking();
  if(!on){ if(!el.hasAttribute('hidden')){ el.setAttribute('hidden', ''); el.innerHTML = ''; renderModeChip(); } return; }   // (an SVG has no .hidden property: the attribute itself)
  const vbs = viewBoxFor(S.shot), vb = vbs.split(' ').map(Number); el.setAttribute('viewBox', vbs);
  const box = tableBox.getBoundingClientRect(), k = box.width > 0 && box.height > 0 ? Math.min(box.width/vb[2], box.height/vb[3]) : 5, u = px => px/k;   // px per table inch
  const c = S.RUN.call, mode = c.mode, pl = S.RUN.planning, plan = mode === 'plan' ? pl : S.RUN.plan || [], next = mode === 'plan' ? null : runPlanNext();
  const now = mode === 'plan' ? runPlanBallNow() : (c.n ?? (next ? next.n : null));   // the ball a pocket goes with
  const hitR = Math.max(R + 1, u(22)), bR = u(9), fs = u(11), ringW = u(2), allowed = runAllowed(S.RUN.balls);
  const badge = (x, y, txt) => { const w = Math.max(2*bR, u(5) + txt.length*u(6.6)); return `<g class="pn" aria-hidden="true"><rect x="${f2(x - w/2)}" y="${f2(y - bR)}" width="${f2(w)}" height="${f2(2*bR)}" rx="${f2(bR)}" stroke-width="${f2(u(1))}"/><text x="${f2(x)}" y="${f2(y)}" font-size="${f2(fs)}">${txt}</text></g>`; };
  let o = '';
  for(const b of S.RUN.balls){
    const i = plan.findIndex(e=>e.n === b.n), planned = i >= 0, sel = b.n === now && (mode === 'plan' ? !planned : true);
    let why = '';
    if(mode === 'plan'){ if(planned) why = `${i + 1} in your plan`; else if(S.RUN.set.order === 'rot') why = sel ? '' : 'Rotation: the lowest ball goes first'; else if(S.RUN.set.order === 'eight' && b.n === 8 && pl.length < S.RUN.balls.length - 1) why = 'the 8 goes last'; }
    else if(!allowed.includes(b.n)) why = S.RUN.set.order === 'eight' ? 'the 8 goes last' : 'not next';
    else if(!runBallOn(b.n)) why = 'out of reach';
    const can = !why && !(mode === 'plan' && S.RUN.set.order === 'rot'), d = R + bR*.8, bx = b.p[0] + d*.72, by = b.p[1] - d*.72;
    const num = planned ? String(i + 1) : sel && mode === 'plan' ? String(pl.length + 1) : '';
    o += `<g class="pt pb" role="button" tabindex="0" data-ball="${b.n}" aria-pressed="${sel}" aria-disabled="${!can && !sel}" aria-label="${b.n} ball${planned ? `, ${i + 1} in your plan, ${POCKET_NAME[plan[i].Pi]}` : why ? ', ' + why : ''}">`
       + `<circle class="hit" cx="${f2(b.p[0])}" cy="${f2(b.p[1])}" r="${f2(hitR)}" stroke-width="${f2(u(1.5))}"/>`
       + (can || sel ? `<circle class="ring" cx="${f2(b.p[0])}" cy="${f2(b.p[1])}" r="${f2(R + u(3))}" stroke-width="${f2(ringW)}"/>` : '')
       + (num ? badge(bx, by, num) : '') + `</g>`;
  }
  const pocketsOn = mode === 'change' || now != null;   // pockets can be picked once there's a ball to pick one for
  POCKETS.forEach((P, i)=>{
    const nums = plan.map((e, j)=>e.Pi === i ? j + 1 : 0).filter(Boolean), pr = pocketR(P);
    const pressed = mode === 'change' && !!next && (c.n == null || c.n === next.n) && i === next.Pi;
    const inward = P.side ? [Math.sign(W/2 - P.c[0]), 0] : norm([W/2 - P.c[0], H/2 - P.c[1]]), q = add(P.c, mul(inward, pr + bR + u(3)));
    o += `<g class="pt pp" role="button" tabindex="0" data-pocket="${i}" aria-pressed="${pressed}" aria-disabled="${!pocketsOn}" aria-label="${POCKET_NAME[i]} pocket${nums.length ? ', ' + nums.join(', ') + ' in your plan' : ''}">`
       + `<circle class="hit" cx="${f2(P.c[0])}" cy="${f2(P.c[1])}" r="${f2(Math.max(pr + 1, hitR))}" stroke-width="${f2(u(1.5))}"/>`
       + (pocketsOn ? `<circle class="ring" cx="${f2(P.c[0])}" cy="${f2(P.c[1])}" r="${f2(pr + u(3))}" stroke-width="${f2(ringW)}"/>` : '')
       + (nums.length ? badge(q[0], q[1], nums.join(', ')) : '') + `</g>`;
  });
  const was = el.contains(document.activeElement) ? {...document.activeElement.dataset} : null;   // a keyboard user's place in it
  el.innerHTML = o; el.removeAttribute('hidden');
  if(was){ const f = was.ball ? el.querySelector(`[data-ball="${was.ball}"]`) : was.pocket ? el.querySelector(`[data-pocket="${was.pocket}"]`) : null; try{ (f || el.querySelector('[aria-pressed="true"]') || el.querySelector('[role="button"]')).focus({preventScroll: true}); }catch(e){} }
  document.querySelectorAll('#answers button').forEach(b=>b.disabled = true);   // the fraction comes once the shot is called
  renderModeChip();   // the pill makes way for the bottom-left pocket
}
export function runPickCard(){   // the card under the table while you pick: one line on what to pick now, the plan so far, Undo and Done
  const c = S.RUN.call, mode = c.mode, pl = S.RUN.planning, set = S.RUN.set, N = S.RUN.balls.length;
  let head, msg, btns = '', list = '';
  if(mode === 'plan'){
    head = 'Plan the rack';
    const now = runPlanBallNow(), done = pl.length === N;
    msg = done ? 'Every ball has its pocket. Done to shoot it.' : now != null ? `Pocket for the ${now}` : `Ball ${pl.length + 1}: pick a ball${set.order === 'eight' && N > 1 && pl.length < N - 1 ? ' (the 8 goes last)' : ''}`;
    if(pl.length || (c.n != null && set.order !== 'rot')) btns += `<button class="sumdone" id="runundo">Undo</button>`;
    btns += `<button class="startbtn" id="runplandone"${done ? '' : ' disabled'}>Done</button>`;
    list = pl.map((e, i)=>`<li><b>${i + 1}</b>${e.n} → ${POCKET_SHORT[e.Pi]}</li>`).join('') + (!done && now != null ? `<li class="cur"><b>${pl.length + 1}</b>${now} → …</li>` : '');
  } else {
    head = 'Change the shot';
    const next = runPlanNext();
    msg = c.n != null ? `Pocket for the ${c.n}${next && c.n !== next.n ? ' (out of order: not a planned run)' : ''}` : next ? `Pick a pocket for the ${next.n}, or another ball${S.RUN.off ? '' : ' (that ends the planned run)'}.` : 'Pick a ball, then its pocket.';
    if(c.n != null) btns += `<button class="sumdone" id="runundo">Undo</button>`;
    if(c.was) btns += `<button class="sumdone" id="runback">Keep the plan</button>`;
    btns += `<button class="link runend" id="runend">No shot · end run</button>`;
    list = (S.RUN.plan || []).map((e, i)=>`<li${S.RUN.balls.some(b=>b.n === e.n) ? '' : ' class="done"'}><b>${i + 1}</b>${e.n} → ${POCKET_SHORT[e.Pi]}</li>`).join('');
  }
  return `<div class="rcard pend runcall"><div class="rhead"><b class="rverd">${head}</b><span class="raside">Ball ${S.RUN.potted + 1} of ${S.RUN.n0}${set.order === 'rot' ? ' · Rotation' : set.order === 'eight' ? ' · 8 last' : ''}</span></div><p class="runmsg" role="status">${msg}</p>${c.msg ? `<p class="runmsg warn">${c.msg}</p>` : ''}${list ? `<ol class="planlist" aria-label="Your plan">${list}</ol>` : ''}<div class="runbtns">${btns}</div></div>`;
}
// A kind of shot is its fraction plus how far the cue ball is from the object ball (short / medium / long).
const distBin = d => d < 24 ? 0 : d < 42 ? 1 : 2;
const shotCell = s => s.answer.id + distBin(len(sub(s.ob, s.cb)));
const entryCell = e => typeof e.dc==='number' ? e.a + distBin(e.dc) : null;
// how much more often than usual you call each kind of shot wrong (1 = your average), from your recent shots
function weakModel(){
  // unaided reads only: practice shots and shots read with a forced aid don't show your real weak spots
  let L = stats.log.filter(e=>!e.gh && !e.fa && taskOf(e)===settings.task && entryCell(e));
  if(L.length < 40 && settings.task !== 'flash') L = stats.log.filter(e=>!e.gh && !e.fa && sessTask(taskOf(e)) && entryCell(e));   // Flash keeps to its own
  const view = L.filter(e=>e.v===settings.view);
  if(view.length >= 40) L = view;
  L = L.slice(-400);
  const wrong = e => taskOf(e)==='shoot' || taskOf(e)==='practice' ? e.p !== (e.ra || e.a) : !success(e);   // in Sessions a weak spot is a wrong call, whatever the stroke did
  const m = Math.max(0.04, L.filter(wrong).length / Math.max(1, L.length));
  const tally = key => { const c = {}; L.forEach(e=>{ const k = key(e), t = c[k] || (c[k] = {n:0, x:0}); t.n++; if(wrong(e)) t.x++; }); return c; };
  const shrink = (t, prior, w) => (t.x + w*prior)/(t.n + w);
  const byFrac = tally(e=>e.a), byDist = tally(e=>distBin(e.dc)), byCell = tally(entryCell);
  const ratio = {};
  CORE.forEach(r=>[0,1,2].forEach(d=>{
    // with few shots in a cell, lean on how you do with that fraction and that distance generally
    const rf = shrink(byFrac[r.id] || {n:0,x:0}, m, 8)/m, rd = shrink(byDist[d] || {n:0,x:0}, m, 8)/m;
    const prior = Math.min(0.95, m*rf*rd);
    ratio[r.id + d] = Math.max(1/3, Math.min(3, shrink(byCell[r.id + d] || {n:0,x:0}, prior, 6)/m));   // capped: at full lean a weak spot comes up at most ~9× as often as a strong one
  }));
  return ratio;
}
// Which fraction to deal: the usual mix, leaning toward the ones you call wrong. Chosen once per deal: before, a fraction
// was re-drawn on every placement attempt, so thin cuts (¼, ⅛), which are rejected more often, came up much less.
function pickBucket(step, skip = []){   // skip: fractions already tried for this shot, without a zone
  let w = bucketWeights(...(step === undefined ? [] : [step]));
  if(skip.length && w.some((x, i)=>x > 0 && !skip.includes(i))) w = w.map((x, i)=>skip.includes(i) ? 0 : x);
  if(adaptiveOn() && leanK() > 0){
    const model = weakModel(), k = leanK();
    w = w.map((x, i)=>{ const id = REFS[i].id, m = [0, 1, 2].map(d=>model[id + d] || 1); return x*Math.pow(m.reduce((a, b)=>a + b, 0)/3, k); });
  }
  return weightedIndex(w);
}
export function dealShot(bucket = pickBucket()){
  if(!adaptiveOn() || leanK()===0) return generate(bucket);
  const model = weakModel(), k = leanK();
  const cands = Array.from({length:20}, ()=>generate(bucket));
  return cands[weightedIndex(cands.map(c=>Math.pow(model[shotCell(c)]||1, k)))];
}
export const stanceIn = () => (+settings.heightCm >= 150 && +settings.heightCm <= 200 ? +settings.heightCm : 175)/2.54;
// the object-ball speed that gets it to a pocket d inches away arriving at about POCKET_ARRIVE in/s ("pocket speed")
export function pocketSpeedFor(d){
  const va = POCKET_ARRIVE, k = 24/(98*MU_G);
  const vRoll = Math.sqrt((va*va + 2*A_ROLL*d)/(25/49 + 2*A_ROLL*k));   // still sliding for the first part, rolling to the pocket
  if(vRoll*vRoll*k <= d) return vRoll;
  return Math.sqrt(va*va + 2*MU_G*d);                                    // so close it arrives still sliding
}
