// The lessons, played on the real table step by step.
import {syncStreakPill} from './ui.js';
import {deal, endFlash, rcls, RICON, showSessIdle, updateControls} from './modes.js';
import {animateShot} from './anim.js';
import {draw, featherLoop, featherRaf, featherStart, NEAR, pivot, rigAlpha, VH, VW} from './view.js';
import {aimDirFor, aimFor, ballVerdict, COARSE, cutForDir, dirForCut, downMs, ease, markAim, MPH, obHit, outcome, playAim, renderRoutineChip, renderShootControls, rigHitMs, routineRaf, strikeOf, STROKE_MPH, strokeThen} from './shot.js';
import {generate, nearestRef, STOP_R} from './deal.js';
import {ladderBest, NO_TIMER, shaftSq, stepGrade} from './grades.js';
import {shotPlan, tableSounds} from './audio.js';
import {S, saveSettings, settings, tut} from './state.js';
import {SH} from './steps.js';
import {$, add, ALL, dot, H, kt, len, MISS, mul, norm, OB_COLORS, PE, pick, R, RAD, rot, sub, tableBox, TIP_STEP, W} from './geom.js';
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
export function openTutMenu(v){
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
    }, pl.V);
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
export function startTut(lesson){
  $('hlogo').classList.remove('hot','over');
  endFlash(); $('startcover').hidden = true;
  tut.on = true; tut.i = 0; tut.shots = []; tut.started = tut.started0 = false; tut.lesson = LESSONS[lesson] ? lesson : 'shoot';
  cancelAnimationFrame(routineRaf); renderRoutineChip(); renderShootControls();
  $('coach').hidden = false;
  showSessIdle(); runStep();
  $('coach').scrollIntoView({block:'nearest'});
}
export function endTut(){
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
export function tutNext(){
  const st = tstep();
  if(st.ask && $('coachnext').hidden) return;   // a call to make, or the right shot still to see
  if(st.finish) return endTut();
  tut.i++; runStep();
}
export function tutBack(){
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
  }, stroke.V);
}
export function tutAnswer(id){
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
