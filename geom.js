// The table: sizes, pockets, the fractions and their cut angles, the engine handle, vector helpers, and the keys-or-touch mode.
export const R = 1.125;               // ball radius, inches (2.25" ball)
// Playing surfaces (inches), portrait. Pocket mouths: corner / side, jaw to jaw.
export const TABLES = {'7':[39,78], '8':[44,88], '9':[50,100]};
const POCKET_SIZES = {bar:[5,5.5], std:[4.5,5], tight:[4.25,4.75], pro:[4,4.5]};
export let W = 50, H = 100, PK = POCKET_SIZES.std;
export const RAD = Math.PI/180;
// Every fraction, fullest first. You call the five core ones; the eighths only remain so older stats still show.
export const ALL = [
  {id:'full', label:'Full', f:1, core:1},
  {id:'78', label:'⅞', f:.875},
  {id:'34', label:'¾', f:.75, core:1},
  {id:'58', label:'⅝', f:.625},
  {id:'12', label:'½', f:.5, core:1},
  {id:'38', label:'⅜', f:.375},
  {id:'14', label:'¼', f:.25, core:1},
  {id:'18', label:'⅛', f:.125, core:1},
].map(r => ({...r, deg: Math.asin(1-r.f)/RAD}));
export const CORE = ALL.filter(r=>r.core);
export let REFS = CORE, BOUNDS = [];
export function setRefs(v){ REFS = v; }   // (the test hooks and syncRefs set it from outside)
export function setBounds(v){ BOUNDS = v; }   // (the test hooks and syncRefs set it from outside)
// cut-angle range in which each fraction is the nearest one (tops out at 66°)
export function boundsFor(refs){
  const fs = [1, ...refs.slice(1).map((r,i)=>(refs[i].f + r.f)/2), 1-Math.sin(66*RAD)];
  return refs.map((r,i)=>[Math.asin(1-fs[i])/RAD, Math.asin(1-fs[i+1])/RAD]);
}
export function initTable(){
  BOUNDS = boundsFor(REFS);
  setTable('9','std');
}
export const OB_COLORS = [['#f2b705','1'],['#1f4fbf','2'],['#d22b2b','3'],['#6b2fa0','4'],['#f07a12','5'],['#1d8a4a','6'],['#8a1f24','7'],['#151515','8'],
  ['#f2b705','9'],['#1f4fbf','10'],['#d22b2b','11'],['#6b2fa0','12'],['#f07a12','13'],['#1d8a4a','14'],['#8a1f24','15']];   // the whole rack: 9–15 are stripes
export let POCKETS = [];
export let curTable = null;
export function setTable(size, pockets){
  curTable = TABLES[size] ? size : '9';
  [W, H] = TABLES[size] || TABLES['9'];
  PK = POCKET_SIZES[pockets] || POCKET_SIZES.std;
  POCKETS = [
    {c:[0,0], t:[0.9,0.9], side:false},{c:[W,0], t:[W-0.9,0.9], side:false},
    {c:[0,H], t:[0.9,H-0.9], side:false},{c:[W,H], t:[W-0.9,H-0.9], side:false},
    {c:[-0.6,H/2], t:[0.4,H/2], side:true, n:[1,0]},{c:[W+0.6,H/2], t:[W-0.4,H/2], side:true, n:[-1,0]},
  ];
}
export const pocketR = p => p.side ? PK[1]*0.48 : PK[0]*0.58;   // drawn hole radius
export function pocketEdge(ob, P, T){   // where the line from the object ball to the pocket (aimed at T) reaches the edge of the hole
  T = T || P.t;
  const d = len(sub(T, ob)), u = norm(sub(T, ob)), q = sub(ob, P.c), b = dot(q, u), c = dot(q, q) - pocketR(P)**2, disc = b*b - c;
  return disc > 0 ? add(ob, mul(u, Math.max(0, Math.min(d, -b - Math.sqrt(disc))))) : T;
}
export const MISS = '#d9c2ff', NEAR_MISS_OK = '#d9c2ff';   // your call's path: informational, not a verdict

export const $ = id => document.getElementById(id);
// ---------- keys or touch: the words and keycaps follow how you're playing ----------
// <html> gets .touch or .kbd. It starts from the device (a coarse pointer or no hover: touch) and then follows you:
// a finger on the screen switches to touch, a key or the mouse back to keys. CSS shows .kbd-only / .touch-only spans
// and keycaps to match; kt() writes both phrasings into a text, so nothing re-renders when it switches.
export const kt = (kbd, touch) => `<span class="kbd-only">${kbd}</span><span class="touch-only">${touch}</span>`;
export const touchMode = () => document.documentElement.classList.contains('touch');
function setInputMode(touch){
  const h = document.documentElement;
  if(h.classList.contains('touch') === touch && h.classList.contains('kbd') === !touch) return;
  h.classList.toggle('touch', touch); h.classList.toggle('kbd', !touch);
  document.querySelectorAll('[data-label-touch],[data-title-touch]').forEach(syncInputAttrs);
}
function syncInputAttrs(el){   // aria-labels and titles: data-label-kbd / data-label-touch, data-title-kbd / data-title-touch
  const t = touchMode() ? 'Touch' : 'Kbd', L = el.dataset['label' + t], T = el.dataset['title' + t];
  if(L != null) el.setAttribute('aria-label', L);
  if(T != null){ if(T) el.setAttribute('title', T); else el.removeAttribute('title'); }
}
export function wireInputMode(){
  setInputMode((()=>{ try{ return matchMedia('(pointer: coarse)').matches || matchMedia('(hover: none)').matches; }catch(e){ return false; } })());
  window.addEventListener('pointerdown', e=>{ if(e.pointerType === 'touch' || e.pointerType === 'pen') setInputMode(true); else if(e.pointerType === 'mouse') setInputMode(false); }, {capture: true, passive: true});
  window.addEventListener('keydown', e=>{ if(!['Unidentified', 'Process'].includes(e.key) && !(e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName))) setInputMode(false); }, true);   // not typing a name: an on-screen keyboard isn't a keyboard
}
export const rnd = (a,b) => a + Math.random()*(b-a);
export const pick = a => a[Math.floor(Math.random()*a.length)];
export const sub = (a,b)=>[a[0]-b[0],a[1]-b[1]], add=(a,b)=>[a[0]+b[0],a[1]+b[1]], mul=(a,k)=>[a[0]*k,a[1]*k];
export const len = a=>Math.hypot(a[0],a[1]), norm=a=>mul(a,1/len(a)), dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
export const rot = (v,t)=>[v[0]*Math.cos(t)-v[1]*Math.sin(t), v[0]*Math.sin(t)+v[1]*Math.cos(t)];
export const idx = id => ALL.findIndex(r=>r.id===id);
export function segDist(p,a,b){const ab=sub(b,a);const t=Math.max(0,Math.min(1,dot(sub(p,a),ab)/dot(ab,ab)));return len(sub(p,add(a,mul(ab,t))));}
export function f2(n){return n.toFixed(2);}
// Phones: a small touch screen. They get mostly shorter shots (balls easier to see) and lighter graphics by default.
export const IS_PHONE = (()=>{ try{ return matchMedia('(hover: none) and (pointer: coarse)').matches && Math.min(screen.width, screen.height) < 600; }catch(e){ return false; } })();

export const PHONE_MAX_D = 42;   // short and long evenly: long shots aren't harder here (no cueing), so distance only comes in as a weak spot

// ---------- physics: the engine (engine.js) plays every shot ----------
export const PE = window.PoolEngine;
let TBL = null;
export function engineTable(){   // the engine's table, matching the current size and pockets (its pockets are in the same order as POCKETS)
  const key = [W, H, PK[0], PK[1]].join();
  if(!TBL || TBL.key !== key){ TBL = PE.makeTable(W, H, PK); TBL.key = key; }
  return TBL;
}
export const tableBox = document.querySelector('.table-box');
export function rayToCushion(p, dir, maxLen){
  let t = Infinity;
  const lo = [R, R], hi = [W-R, H-R];
  for(const k of [0,1]){
    if(dir[k] > 1e-9) t = Math.min(t, (hi[k]-p[k])/dir[k]);
    else if(dir[k] < -1e-9) t = Math.min(t, (lo[k]-p[k])/dir[k]);
  }
  t = Math.max(0, Math.min(t, maxLen ?? Infinity));
  return add(p, mul(dir, t));
}
export const matVec = (M, v) => M.map(row=>row[0]*v[0] + row[1]*v[1] + row[2]*v[2]);
