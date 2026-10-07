// Drawing the table: the cameras, walking round the cue ball, the cue and bridge hand, the 3D table and its arrows.
import {renderRadio} from './main.js';
import {noPocket, tutAid, tutLayer, tutLook} from './lessons.js';
import {bridgeGeom, cueStroke, ease, levelForSpeed, overviewCam, PHONE_STAND_FOVS, shootCam, shotInFrame, shotStroke, standBackFor, standMin, strokeFrac, syncUpBtn} from './shot.js';
import {CB_DOTS, cbSpin, renderRunPick, rotAxis, runPicking, stanceIn} from './deal.js';
import {aidAlpha, isShooting, ladderBest, myShaft, shootAid, shootLevel, shootRoutine, stanceAim} from './grades.js';
import {DEV, PERF} from './perf.js';
import {look, S, saveSettings, settings, tut} from './state.js';
import {SH} from './steps.js';
import {$, add, curTable, dot, engineTable, f2, H, IS_PHONE, len, matVec, MISS, mul, NEAR_MISS_OK, norm, PE, PK, pocketEdge, pocketR, POCKETS, R, RAD, rayToCushion, rot, sub, W} from './geom.js';
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
export const STYLES = {
  pro:  {cloth:'#24609c', hi:'#2b76b4', lo:'#1b5286', cushion:'#2569a8', top:'#1d5a8f', nose:'#1a4f80', noseD:'#16446d', shelf:'#1f5689', shelfD:'#1a4f7e',
         rail:'#4b4f55', edge:'#33363b', line:'#3e4247', diamond:'#eadcbf', balls: 1.15},   // pro blue, grey rails, bright TV balls
  club: {cloth:'#1f6e3d', hi:'#27824a', lo:'#185a31', cushion:'#21753f', top:'#1a6436', nose:'#175a32', noseD:'#134c2a', shelf:'#1b6237', shelfD:'#175530',
         rail:'#6b4528', edge:'#4a2f1b', line:'#553a26', diamond:'#f1e9d6', balls: 1},      // green cloth, walnut rails
  bar:  {cloth:'#7c1f2a', hi:'#8f2733', lo:'#661823', cushion:'#82222e', top:'#6f1c27', nose:'#651a24', noseD:'#55151e', shelf:'#6c1b25', shelfD:'#5e1720',
         rail:'#2b211b', edge:'#1c1511', line:'#3a2d24', diamond:'#d9d2c3', balls: .8},     // burgundy cloth, dark laminate rails, well-used balls
};
export const ST = () => STYLES[settings.tstyle] || STYLES.pro;
// the object ball's colour in this style: brighter and richer for Pro, a little faded in a bar
// Ball sets (Settings > Table): the colours of 1–7 (9–15 match), and what the stripes are painted on
// Each set also has its own finish and markings: rough/clear (the 3D surface: roughness, and a clear coat on top), shine (the 2D
// highlight: centre x/y %, radius %, strength, and how far out it stays at full strength), numFont/numWeight/numScale (the
// number), spot (the white circle's size), ring (a thin dark ring inside the circle) and stripeW (the band's height, of the ball)
const NUM_SANS = '"IBM Plex Sans", Arial, sans-serif', NUM_COND = '"Barlow Condensed", "Arial Narrow", sans-serif';
export const BALL_SETS = {
  standard: {white:'#f4efe0', rough:.18, clear:0, shine:[35, 32, 45, .55, 0], numFont:NUM_SANS, numWeight:600, numScale:.92, spot:1, ring:0, stripeW:.38},   // modern gloss, crisp sans numbers
  tv:       {white:'#f4efe0', c:{1:'#f6c400', 2:'#2a6fd6', 3:'#e8322f', 4:'#e8559a', 5:'#ff7f1f', 6:'#22a65c', 7:'#8b3a2a'},   // the TV set: a pink 4, brighter colours
             rough:.07, clear:1, shine:[34, 29, 34, .9, .3], numFont:NUM_SANS, numWeight:600, numScale:1.08, spot:1.1, ring:0, stripeW:.38},   // clear-coated: a small, bright highlight and bigger numbers
  retro:    {white:'#ece0c4', c:{1:'#d9a92a', 2:'#2b4a8a', 3:'#b03a2e', 4:'#5a3a7a', 5:'#cf6f2a', 6:'#2f6b45', 7:'#6e2a24'},   // older, softer colours on ivory
             rough:.46, clear:0, shine:[38, 36, 66, .3, 0], numFont:'Georgia, "Times New Roman", serif', numWeight:700, numScale:.9, spot:1, ring:1, stripeW:.44},   // satin: a soft, broad sheen; serif numbers in a thin ring; wider stripes
  disco:    {white:'#f4efe0', rough:.06, clear:1, holo:1, shine:[34, 29, 34, .9, .3], numFont:NUM_SANS, numWeight:600, numScale:1, spot:1.06, ring:0, stripeW:.38},   // hidden (the Disco Stu easter egg): the Standard colours under a rainbow sheen that shifts as you move
  blackout: {white:'#24262a', rough:.18, clear:0, shine:[35, 32, 45, .55, 0], numFont:NUM_COND, numWeight:700, numScale:1, spot:1, ring:0, stripeW:.38},   // a very dark grey, not pure black, so the shading still reads as a ball; stripes on black instead of white
};
export function keyBallSets(){
  for(const k in BALL_SETS) BALL_SETS[k].key = k;
}
// the 2D balls' highlight, in this set's finish
const SHINE = () => { const [cx, cy, r, op, core] = ballSet().shine;
  return `<radialGradient id="shine" cx="${cx}%" cy="${cy}%" r="${r}%"><stop offset="0" stop-color="#fff" stop-opacity="${op}"/>${core ? `<stop offset="${core}" stop-color="#fff" stop-opacity="${op*.7}"/>` : ''}<stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` + (ballSet().holo ? HOLO('holo') : ''); };
// Disco's holographic foil in 2D: repeating diagonal rainbow bands laid over the ball (overlay keeps the white circle and the number as they are)
export const HOLO = id => `<linearGradient id="${id}" x1="0" y1="0" x2=".3" y2=".3" spreadMethod="repeat">${['#ff2bd6', '#ff8a1f', '#ffe81f', '#2bff8a', '#1fc8ff', '#7a3bff', '#ff2bd6'].map((c, i)=>`<stop offset="${(i/6).toFixed(3)}" stop-color="${c}" stop-opacity=".95"/>`).join('')}</linearGradient>`;
const SHEEN = (cx, cy, r) => (ballSet().holo ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#holo)" style="mix-blend-mode:overlay"/>` : '') + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#shine)"/>`;
const ballSet = () => BALL_SETS[settings.ballSet] || BALL_SETS.standard;
// table styles and ball sets open up as you climb: Bar and Standard to start, Pro and Blackout at the top (S)
export const LOOK_AT = {tstyle: {bar: 0, club: SH.throw, pro: SH.all}, ballSet: {standard: 0, retro: SH.any, tv: SH.draw, blackout: SH.all, disco: 0}};
export const LOOK_NAME = {club: 'Club table', pro: 'Pro table', retro: 'Retro balls', tv: 'TV balls', blackout: 'Blackout balls'};
export const lookOpen = (key, val) => key === 'ballSet' && val === 'disco' ? !!settings.discoGot : DEV || ladderBest() >= (LOOK_AT[key][val] ?? 99);
export const bestLook = key => Object.keys(LOOK_AT[key]).filter(v=>v !== 'disco' && lookOpen(key, v)).pop();   // the last one you've opened
function ballCol(s){
  const num = +s.color[1], set = ballSet().c, c = set && num !== 8 ? set[num > 8 ? num - 8 : num] || s.color[0] : s.color[0], k = ST().balls; if(k === 1) return c;
  const v = [1, 3, 5].map(i=>parseInt(c.slice(i, i + 2), 16)), g = (v[0] + v[1] + v[2])/3;
  return '#' + v.map(x=>Math.max(0, Math.min(255, Math.round((g + (x - g)*k)*(k < 1 ? .9 : 1))))).map(x=>x.toString(16).padStart(2, '0')).join('');
}
export function applyStyle(){
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

export const VIEWS = {
  stand:{back:20, h:38, pitch:-30, hfov:72, yawMix:.45},   // looking out along the shot, not down at your feet: the cue ball is kept in frame below
  down: {back:14, h:7.5, pitch:-15, hfov:82, yawMix:.4},
};
const cross3=(a,b)=>[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const dot3=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const norm3=a=>{const l=Math.hypot(a[0],a[1],a[2]);return [a[0]/l,a[1]/l,a[2]/l];};
export const VW=600, NEAR=0.6;
export let VH=400;   // grows with the table box on desktop
export function setVH(v){ VH = v; }   // (the test hooks and syncRefs set it from outside)

// Build a camera from an eye position, a look direction and a horizontal field of view.
export function camFrom(E, f, hfov){
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
export const pivot = {id: 'c', s: null, from: null, t0: 0, raf: 0};
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
export function pivotToggle(){
  if(!pivotOk() || !pivotBall(S.shot, 'o')) return false;
  pivotPt(S.shot); setPivot(pivot.id === 'c' ? 'o' : 'c'); tutLook('swap', pivot.id); return true;
}
// The focus button, next to the eye: a ring like the eye's, with the cue ball's red dot while the view turns round the
// cue ball and without it while it turns round the object ball.
// It's there when the drag is, and greyed out while the shot has the view (stepping in, down, the stroke, a replay).
export function syncFocusBtn(){
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
export const flashDown = () => settings.task === 'flash' && settings.flashView === 'down' && !tut.on;
export const rigCam = s => flashDown() ? s.rig : s.cam;
export function rigAlpha(s){
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
export const strokeBack = s => (0.146*stanceIn() - 1.25 - 1.5)*strokeFrac(levelForSpeed(tut.on && tut.plan ? tut.plan.V : s.replay ? s.replay.V : shotStroke(s).V));   // a lesson: the coach's stroke
function featherAt(t, back){
  const p = (t % 1600)/1600, ease = k => (1 - Math.cos(Math.PI*k))/2;
  return p < .4 ? -back*ease(p/.4) : p < .5 ? -back : -back*(1 - ease((p - .5)/.5));
}

export let featherRaf = 0;
export const FOLLOW_THROUGH = 4;   // inches past the cue ball, every stroke
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
export function standUp(s){
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
export function featherOff(s){
  cancelAnimationFrame(featherRaf); featherRaf = 0;
  const c = rigCam(s); if(!c) return;
  if(c.downAt != null){ c.fHold = rigAlpha(s).push || 0; c.downAt = null; }
}
// Settled down: the strokes start from the cue at the ball, or, back down before the cue left the table,
// carry on forward from where it stopped, so it never jumps
export function featherStart(c){
  const now = performance.now(), h = c.fHold || 0, b = c.fBack || 0;
  c.fHold = 0;
  if(h < -.01 && b > .01){ const e = Math.max(0, Math.min(1, 1 + h/b)); c.downAt = now - 800*(1 + Math.acos(1 - 2*e)/Math.PI); c.fCycle = 0; }   // featherAt's forward half, at h
  else { c.downAt = now; c.fCycle = null; }
}
export function featherLoop(s){   // keeps the practice strokes moving while you're down and haven't called
  cancelAnimationFrame(featherRaf);
  const tick = ()=>{ if(S.shot !== s || S.answered || !(shootRoutine() || flashDown()) || (tut.on && !(s.cam && s.cam.tutDown)) || rigAlpha(s).a < .01) return; draw(false); featherRaf = requestAnimationFrame(tick); };
  featherRaf = requestAnimationFrame(tick);
}
// Glove and hand colours (Settings, any colour): a black glove and a grey hand to start.
export const isHex = c => /^#[0-9a-f]{6}$/i.test(c || '');
export const GLOVE_DEF = '#1a1a1a', HAND_DEF = '#8a8f96';
const strapOf = c => { const l = [1, 3, 5].reduce((t, i)=>t + parseInt(c.slice(i, i + 2), 16), 0)/3; return l < 70 ? shadeHex(c, 1, 60) : shadeHex(c, .8); };   // a little lighter on a dark glove, darker on a light one
const LIGHT = norm3([-.25, .35, .9]);
const shadeHex = (hex, k, add = 0) => '#' + [1, 3, 5].map(i=>Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16)*k + add)).toString(16).padStart(2, '0')).join('');
export function cueRig(cam, s){
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
export function draw(reveal){ const t0 = performance.now(); drawInner(reveal); syncUpBtn(); PERF.drawMs += performance.now() - t0; PERF.draws++; }
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
export function applyGfx(){
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
export function wireArrowWake(){
  document.addEventListener('visibilitychange', ()=>{ if(!document.hidden && S.shot) arrowLoop(); });
  ['pointerdown', 'keydown', 'wheel'].forEach(t=>window.addEventListener(t, ()=>{ arrowWake = performance.now(); if(S.shot && settings.view !== 'top') arrowLoop(); }, {capture: true, passive: true}));
}
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
export function initTable3d(){
  if((settings.gfxAAV | 0) < 1){ if(IS_PHONE) settings.gfxAA = '0'; settings.gfxAAV = 1; }   // once: phones start with antialiasing off (turn it back on in Settings and it stays on)
  if(!['1','0'].includes(settings.gfxAA)) settings.gfxAA = IS_PHONE ? '0' : '1';   // set before the renderer is made: antialiasing can't change after
  try{ G3 = window.Table3D ? Table3D.make(document.getElementById('table3d'), {lite: IS_PHONE, aa: settings.gfxAA !== '0', redraw: ()=>{ if(S.shot && !S.anim) draw(S.answered); }}) : null; }catch(e){ G3 = null; }
  if(!G3) document.getElementById('table3d').style.display = 'none';
}
// the ball's own frame for its texture: the number spot is painted at local +x, so turn +x onto where the spot starts
function spotBase(sp){
  sp = sp || [0,0,1];
  const k = [0, -sp[2], sp[1]], kl = Math.hypot(k[1], k[2]), c = Math.max(-1, Math.min(1, sp[0]));
  if(kl < 1e-9) return c > 0 ? [[1,0,0],[0,1,0],[0,0,1]] : [[-1,0,0],[0,-1,0],[0,0,1]];
  return PE.matRot(PE.I3, [0, k[1]/kl, k[2]/kl], Math.acos(c));
}
let layerHTML = {}, vbDirty = true;


const svgEl = $('table');
export let walkRaf = 0, walkEndedAt = 0;
export function walkOn(){ return ['shoot','practice','run'].includes(settings.task); }
function walkRedraw(){ if(walkRaf || S.anim) return; walkRaf = requestAnimationFrame(()=>{ walkRaf = 0; if(S.shot) draw(S.answered); }); }   // while a shot runs, its own frames redraw
export function wireWalk(){
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
  svgEl.addEventListener('pointerup', walkRelease);
  svgEl.addEventListener('pointercancel', walkRelease);
}
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
// Desktop: the table fills the column down to the bottom of the window; the drawing matches the box shape.
const mqDesk = matchMedia('(min-width: 900px)');
export function sizeTable(){ if(S.shot && !S.anim){ draw(S.answered); if(runPicking()) renderRunPick(); } }   // (the Run-outs picker sizes its targets to the box)
function fitViewBox(){   // reading the box's size forces a layout, so it's only done when the box may have changed size
  vbDirty = false;
  const box = document.querySelector('.table-box');
  const w = box.clientWidth, h = box.clientHeight;
  VH = (w && h) ? Math.round(VW*h/w) : 400;
  boxPx = [w || 600, h || 400];
}
export function wireResize(){
  if(window.ResizeObserver) new ResizeObserver(()=>{ vbDirty = true; if(S.shot && !S.anim) sizeTable(); }).observe(document.querySelector('.table-box'));
  window.addEventListener('resize', ()=>{ vbDirty = true; });
}
let rsz = null;
export function wireResizeDraw(){
  window.addEventListener('resize', ()=>{ clearTimeout(rsz); rsz = setTimeout(sizeTable, 60); });
  if(mqDesk.addEventListener) mqDesk.addEventListener('change', sizeTable);
}
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
export function wireStance(){
  applyStance();
  ['heightrange', 'st-height'].forEach(id=>$(id).addEventListener('input', e=>setStance('heightCm', +e.target.value)));
  ['backrange', 'st-back'].forEach(id=>$(id).addEventListener('input', e=>setStance('railBack', +e.target.value)));
}
const setStance = (k, v) => { settings[k] = v; saveSettings(); applyStance(); pcache.key = null; if(S.shot) draw(S.answered); };
