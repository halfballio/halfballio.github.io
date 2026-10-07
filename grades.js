// The ladder: grades and skill steps, what each one opens, the adaptive lean on weak spots, and what you control at each step.
import {applySetting, openLookPicker, openMenu} from './main.js';
import {tutAid} from './lessons.js';
import {openDrill} from './modes.js';
import {LOOK_AT, LOOK_NAME} from './view.js';
import {runPicks} from './deal.js';
import {DEV} from './perf.js';
import {saveSettings, sessTask, settings, SHOOT_GRADES, SHOOT_V, stats, success, taskOf, tut} from './state.js';
import {gradeOf, SH, stepOf} from './steps.js';
import {IS_PHONE, kt, PE} from './geom.js';
// ---------- grades & adaptive dealing ----------
// Every shot on the ladder moves you toward the next grade (+1 right, -2 wrong: break-even is 2 in 3); ten up levels you up.
// The old Read ladder's grades and baseline are only read now, to bring older saves forward (see the one-time moves below).
export const GRADES = ['F','D-','D','D+','C-','C','C+','B-','B','B+','A-','A'];   // the old Read ladder (the one ladder now: SHOOT_GRADES)
const GRADE_FROM = [0,30,35,40,45,50,55,60,66,72,78,84];   // the old baseline % for each starting grade
export const SHOT_SPEED = 'medium';   // pocket speed: throw as for a medium-soft hit                                  // one speed for every shot, at every grade (slow and medium come back with a rolling cue-ball path)
export const PTS_UP = 10, PT_RIGHT = 1, PT_WRONG = -2;
export const baselines = () => (stats.sessions||[]).filter(x=>x.base);
export const hasBaseline = () => baselines().length > 0 || !!stats.level;   // a grade means you've been placed (a picked test grade counts)
export const adaptiveOn = () => sessTask(settings.task);
// One ladder (SHOOT_GRADES). Calling fractions lives on in Flash: no aids, from the ball line, any angle where the nearest fraction pots.
export const gradeFor = p => GRADE_FROM.reduce((g, t, i)=>p >= t ? i : g, 0);
export const longShare = () => IS_PHONE ? 0.2 : 0.5;export const leanK = () => isShooting() ? 0.8 + gradeOf(shootLevel())*(1.2/(SHOOT_GRADES.length - 1)) : flashLean();   // the ladder leans on your weak spots from F, harder as you climb
// Flash gets harder as you get better: the lean on your weak spots (fractions and distances you miss) grows with your last 100
// Flash calls, from gentle at 50% right to as hard as the top of the ladder at 90%
function flashLean(){
  const L = stats.log.filter(e=>taskOf(e) === 'flash' && !e.gh).slice(-100);
  if(L.length < 20) return 0.8;
  const acc = L.filter(success).length/L.length;
  return 0.8 + 1.2*Math.max(0, Math.min(1, (acc - .5)/.4));
}
// how visible an aid is right now, 0..1
export function aidAlpha(key){
  if(tut.on) return tutAid(key);
  if(isShooting()) return key === 'stance' ? 0 : shootAid(key) ? 1 : 0;
  return 0;   // Flash: no aids
}
export const stanceAim = () => aidAlpha('stance') > 0;
export const throwNow = () => tut.on && tut.lesson === 'throw';   // throw is taught in the Shoot ladder; dealt shots roll
export const anyOn = () => !tut.on && (isDrill() && GEN.g == null ? drillPicks().ang === 'any' : isShooting() ? shootLevel() >= SH.any && adaptiveOn() : adaptiveOn());   // on the ladder from its own step; Flash always
export const fastFlashLocked = () => ladderBest() < FAST_FLASH_GRADE;
export function enforceLocks(){
  if(fastFlashLocked() && settings.flash==='750'){ settings.flash = '1500'; saveSettings(); }
}
export const stepGrade = st => SHOOT_GRADES[gradeOf(st)];   // the letter that brings a step ('Unlocks at …')
// Short names for the ladder, by grade (the lessons explain each step)
export const SHOOT_TEXT = [
  'Every fraction, with aids', 'No path', 'No guide line', 'No ghost ball',
  'Cue and hand',
  'Any angle · 9 ft table', 'Speed', 'Throw',
  'Center ball: follow', 'Center ball: stun', 'Center ball: draw', 'Center ball: two rails', 'English', 'Everything'];
// the level-up notes, by step
export const SHOOT_UP = {[SH.noPath]:'No path', [SH.noLine]:'No guide line', [SH.noGhost]:'No ghost ball', [SH.down]:'Cue and hand',
  [SH.any]:'Any angle', [SH.speed]:'Speed', [SH.throw]:'Throw', [SH.follow]:'Center ball: follow', [SH.stun]:'Center ball: stun', [SH.draw]:'Center ball: draw', [SH.cushion]:'Center ball: two rails', [SH.english]:'English', [SH.all]:'Everything'};
// the table grows with you: 7 ft to start, 8 ft at D, 9 ft at C (with any angle)
// By step, like every unlock: 8 ft with no guide line, 9 ft with any angle
export const TABLE_AT = {'8': SH.noLine, '9': SH.any};
export const tableUnlocked = sz => sz === '7' || DEV || ladderBest() >= TABLE_AT[sz];
// the biggest table a step brings
export const gradeTable = g => g >= TABLE_AT['9'] ? '9' : g >= TABLE_AT['8'] ? '8' : '7';
// The Ladder plays on the table of the grade you're playing (practising a lower grade: that grade's own) until S;
// from S you pick any size for it (settings.tablePick). Flash plays on its own pick (settings.flashTable), any size
// you've opened. The shot library is made per grade on the table that grade brings, so while it's being built (GEN.g) the grade decides.
export const LADDER_PICK_AT = SH.all;
export const ladderPickOpen = () => ladderBest() >= LADDER_PICK_AT;
export const ladderTable = () => ladderPickOpen() && ['7','8','9'].includes(settings.tablePick) ? settings.tablePick : gradeTable(shootLevel());
export const flashTableNow = () => tableUnlocked(settings.flashTable) ? settings.flashTable : gradeTable(ladderBest());
export const progTable = () => GEN.g != null ? gradeTable(GEN.g) : settings.task === 'flash' ? flashTableNow() : isDrill() ? drillPicks().tb : isRun() ? runPicks().tb : ladderTable();
// a step reached for the first time that opens a bigger table (returns the size, or null): the Ladder moves to it with
// the grade, and your Flash table moves up to it too (before, to: steps)
export function tableUp(before, to){
  const sz = ['9', '8'].find(z=>to >= TABLE_AT[z] && before < TABLE_AT[z]);
  if(!sz) return null;
  if(!(+settings.flashTable >= +sz)){ settings.flashTable = sz; saveSettings(); }
  return sz;
}
export const ladderBest = () => stats.shoot ? stepOf(Math.max(stats.shoot.g, stats.shoot.best ?? 0)) : 0;   // the step of your best grade: every unlock goes by it
export const FLASH_AT = SH.any, FAST_FLASH_GRADE = SH.all;   // Flash opens at C (any angle), at 1.5 s; 0.75 s Flash at S
export const flashUnlocked = () => DEV || ladderBest() >= FLASH_AT;
// your shaft: maple to start; the low-deflection carbon shaft opens at S (and you're switched to it the first time you get there)
export const CARBON_AT = SH.all;
export const carbonUnlocked = () => DEV || ladderBest() >= CARBON_AT;
export const myShaft = () => settings.shaft === 'carbon' && carbonUnlocked() ? 'carbon' : 'maple';
export const shaftSq = () => PE.SHAFTS[myShaft()];   // your cue's squirt (per ball radius of side): your own shots and the right call play with it
// Practice: unscored, and you pick what comes up (fractions, angle, side, distance, table), played down on the shot as
// on the Ladder, with the stroke and spin your best grade has opened. Opens at B- (Throw).
export const PRACTICE_AT = SH.throw;
export const practiceUnlocked = () => DEV || ladderBest() >= PRACTICE_AT;
export const isDrill = () => settings.task === 'practice';
export const DRILL_FR = ['full', '34', '12', '14', '18'];
const DRILL_DEF = {fr: DRILL_FR, ang: 'exact', side: 'both', dist: 'both', tb: null, stroke: 'mine', spin: 'mine', weak: 0};   // stroke and spin: yours, as on the Ladder, once they're open
export function drillPicks(){   // the saved picks, made safe: at least one fraction, only a table you've opened, only the controls your best grade has
  const d = {...DRILL_DEF, ...(settings.drill || {})};
  d.fr = DRILL_FR.filter(f=>(Array.isArray(d.fr) ? d.fr : []).includes(f)); if(!d.fr.length) d.fr = [...DRILL_FR];
  if(!['exact', 'any'].includes(d.ang)) d.ang = 'exact';
  if(!['both', 'L', 'R'].includes(d.side)) d.side = 'both';
  if(!['both', 'short', 'long'].includes(d.dist)) d.dist = 'both';
  if(!['7', '8', '9'].includes(d.tb) || !tableUnlocked(d.tb)) d.tb = gradeTable(ladderBest());
  const c = ctrlAt(drillLevel());
  if(!c.speed) d.stroke = 'set';
  if(!(c.up || c.side)) d.spin = 'center';
  d.weak = d.weak ? 1 : 0;
  return d;
}
export const drillLevel = () => Math.max(PRACTICE_AT, ladderBest());   // the step whose controls you have: your best
// Run-outs: pattern play on a rack of balls, from S (every control opened, no zones)
export const RUN_AT = SH.all;
export const runUnlocked = () => DEV || ladderBest() >= RUN_AT;
export const isShoot = () => settings.task === 'shoot' || isDrill();   // played down on the shot, from the ball line (the Ladder and Practice)
export const isLadder = () => settings.task === 'shoot';
export const isRun = () => settings.task === 'run';
export const isShooting = () => isShoot() || isRun();
export const shootRoutine = () => isShoot() || isRun();   // the ladder's routine (read standing, call to get down, shoot): the Ladder, Practice and Run-outs
export function ensureShootLevel(){ if(!stats.shoot) stats.shoot = {g:0, best:0, pts:0, v:SHOOT_V}; return stats.shoot; }
// You can go back to any grade you've passed and practise it as long as you like: those shots aren't scored.
export const practicing = () => isLadder() && settings.practice != null && stats.shoot && +settings.practice < stats.shoot.g;
export const GEN = {g: null, bucket: null};   // while the shot library is being built: the step it's building for
// the step being played (not the grade index: see GRADE_STEP)
export const shootLevel = () => GEN.g != null ? GEN.g : isRun() ? SH.all : isDrill() ? drillLevel() : practicing() ? stepOf(+settings.practice) : stepOf(stats.shoot ? stats.shoot.g : 0);   // Run-outs play as S: every control
export const NO_TIMER = 1e6;   // from Any angle on, nothing hurries you: you get down when you're ready
export const standTime = g => g < SH.down ? 0 : NO_TIMER;   // no timers: from Down on the shot you call a fraction to get down on its line
// what you control at each step
export const ctrlAt = g => ({speed: g >= SH.speed, up: g >= SH.follow, down: g >= SH.draw, side: g >= SH.english});
export const ctrl = () => { const c = ctrlAt(shootLevel()); if(!isDrill() || GEN.g != null) return c;
  const d = drillPicks(), sp = d.spin === 'mine'; return {speed: c.speed && d.stroke === 'mine', up: c.up && sp, down: c.down && sp, side: c.side && sp}; };   // Practice: what you picked, of what's open
// the aids while you aim (the right ghost ball, the guide line to it, the object ball's path to the pocket)
export function shootAid(k){
  const g = shootLevel();
  return k === 'path' ? g < SH.noPath : k === 'line' ? g < SH.noLine : k === 'ghost' ? g < SH.noGhost : false;
}
// ---------- what each grade brings ----------
// Two kinds, both keyed by the skill step (SH, as every unlock goes by step):
// FOCUS_AT: what each grade trains or changes in play, exactly one per step. It is the grade's title on the Progress ladder
//   and the lead of the level-up card. Not something you get: it's what the grade is about.
// UNLOCKS_AT: what a grade gives you (tables, modes, Flash times, looks, gear). The level-up card lists the rows of each
//   step you reach for the first time, and the Progress ladder shows them as chips under their grade.
// A row: {id, icon (a key of UNL_ICON), name, what (one plain line), where (where to find it), tryIt? (unlocks only: a
// function; the row gets a "Try it" button that closes the card and calls it)}. what and where may hold a little HTML (kt).
// To add an unlock: put a row in its step's list below, or (UNLOCKS_AT[SH.throw] ||= []).push({id, icon, name, what, where}).
// Table styles and ball sets are added from LOOK_AT below, so a new look shows up here by itself.
const UNL_ICON = {
  eyeoff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A9.7 9.7 0 0 1 12 5c5 0 9 4.5 10 7-.4 1-1.2 2.3-2.4 3.5M6.2 6.3C4.2 7.6 2.7 9.6 2 12c1 2.5 5 7 10 7 1.9 0 3.6-.6 5-1.5"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  cue:    '<path d="M3 21 15.5 8.5"/><circle cx="18.5" cy="5.5" r="3"/>',
  angle:  '<path d="M4 20h16"/><path d="M4 20 16 5"/><path d="M10.5 20a6.5 6.5 0 0 0-2.3-5"/>',
  table:  '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><rect x="5.5" y="8" width="13" height="8" rx="1"/>',
  flash:  '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  timer:  '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M10 2h4"/>',
  speed:  '<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-6"/>',
  throw:  '<circle cx="8" cy="16" r="4"/><circle cx="14.5" cy="9.5" r="4"/><path d="M17.5 6.5 21 3m0 0h-3.5M21 3v3.5"/>',
  top:    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="7.5" r="2" fill="currentColor"/>',
  centre: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2" fill="currentColor"/>',
  back:   '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="16.5" r="2" fill="currentColor"/>',
  side:   '<circle cx="12" cy="12" r="9"/><circle cx="16.5" cy="12" r="2" fill="currentColor"/>',
  rails:  '<path d="M21 3H3v18"/><path d="M20 15 3.5 9.5 9.5 3.5 16 10"/>',
  star:   '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  pick:   '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  shaft:  '<path d="M4 20 15 9"/><path d="M15 9l5-5" stroke-width="3.2"/>',
  balls:  '<circle cx="8" cy="15.5" r="4.5"/><circle cx="16" cy="15.5" r="4.5"/><circle cx="12" cy="7.5" r="4.5"/>',
  style:  '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.9 1.2-1.7-.4-1 .3-2.3 1.6-2.3H17a4 4 0 0 0 4-4c0-5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1" fill="currentColor"/><circle cx="10" cy="7" r="1" fill="currentColor"/><circle cx="15" cy="7.5" r="1" fill="currentColor"/>',
};
export const unlIcon = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${UNL_ICON[k] || UNL_ICON.star}</svg>`;
const UNL_LADDER = 'Every Ladder shot', UNL_TIP = 'The tip pad' + kt(' (W, A, S, D)', '');
export const FOCUS_AT = {
  [SH.noPath]:  {id:'nopath', icon:'eyeoff', name:'No path', what:'The object ball’s path to the pocket isn’t drawn any more.', where: UNL_LADDER},
  [SH.noLine]:  {id:'noline', icon:'eyeoff', name:'No guide line', what:'The dotted line from the cue ball to the ghost ball is gone.', where: UNL_LADDER},
  [SH.noGhost]: {id:'noghost', icon:'eyeoff', name:'No ghost ball', what:'You find the contact point without the ghost ball.', where: UNL_LADDER},
  [SH.down]:    {id:'down', icon:'cue', name:'Cue and hand', what:'Read it standing on the ball line, call the fraction, then get down on its line with your cue and bridge hand.', where:'Every Ladder shot; the Cue and hand lesson shows how'},
  [SH.any]:     {id:'any', icon:'angle', name:'Any angle', what:'Cuts come at any angle, not just on a fraction: call the nearest one.', where: UNL_LADDER},
  [SH.speed]:   {id:'speed', icon:'speed', name:'Speed', what:'Four strokes, ¼, ½, ¾ and full: aim for pocket speed.', where:'The Speed bar on the table' + kt(', or ↑ ↓', '')},
  [SH.throw]:   {id:'throw', icon:'throw', name:'Throw', what:'A slow, sliding hit drags the object ball fuller: cut it a touch thinner.', where: UNL_LADDER},
  [SH.follow]:  {id:'follow', icon:'top', name:'Follow', what:'Land the cue ball in the green zone. Strike above centre to roll on through.', where: UNL_TIP},
  [SH.stun]:    {id:'stun', icon:'centre', name:'Stun', what:'Dead centre and firm: the cue ball leaves along the tangent line.', where:'The tip pad, with Speed'},
  [SH.draw]:    {id:'draw', icon:'back', name:'Draw', what:'Strike below centre to pull the cue ball back.', where: UNL_TIP},
  [SH.cushion]: {id:'rails', icon:'rails', name:'Two rails', what:'Zones the cue ball reaches off two cushions, with top, stun or draw.', where: UNL_LADDER},
  [SH.english]: {id:'english', icon:'side', name:'English', what:'Strike left or right of centre: it widens or narrows the angle off a cushion.', where: UNL_TIP},
  [SH.all]:     {id:'all', icon:'star', name:'Everything', what:'Speed, top, back and side, all yours. Each zone can be reached more than one way.', where: UNL_LADDER},
};
const UNLOCKS_AT = {
  [SH.noLine]:  [{id:'table8', icon:'table', name:'8 ft table', what:'A bigger table, so longer shots.', where:'The Ladder moves up to it, and Flash with it'}],
  [SH.any]:     [{id:'table9', icon:'table', name:'9 ft table', what:'The full-size table.', where:'The Ladder moves up to it, and Flash with it'},
                 {id:'flash', icon:'flash', name:'Flash', what:'Call the fraction against the clock: 1.5 s to read each shot.', where:'Flash, next to the Ladder at the top', tryIt: ()=>applySetting('task', 'flash')}],
  [SH.throw]:   [{id:'practice', icon:'pick', name:'Practice', what:'Drill the fractions, angle, side and distance you choose, or your weakest. Not scored.', where:'Practice, next to the Ladder at the top', tryIt: ()=>{ applySetting('task', 'practice'); openDrill(true); }},
                 // Practice joins here
                ],
  [SH.all]:     [{id:'tablepick', icon:'pick', name:'Table choice', what:'Play the Ladder on a 7, 8 or 9 ft table.', where:'Settings › Table', tryIt: ()=>openSettingsAt('table')},
                 {id:'carbon', icon:'shaft', name:'Carbon shaft', what:'Less deflection when you use english. It’s on your cue now.', where:'Settings › You'},
                 {id:'flash750', icon:'timer', name:'0.75 s Flash', what:'Half the time to read each shot.', where:'Flash, 0.75 s', tryIt: ()=>{ applySetting('task', 'flash'); applySetting('flash', '750'); }},
                 {id:'runouts', icon:'balls', name:'Run-outs', what:'A rack of three: each shot is picked from where the cue ball stops, no zones. Run as many as you can.', where:'Run-outs, next to the Ladder at the top', tryIt: ()=>applySetting('task', 'run')},
                ],
};
export function addLookUnlocks(){
  for(const [k, set] of Object.entries(LOOK_AT)) for(const [v, at] of Object.entries(set)) if(at > 0 && LOOK_NAME[v])
    (UNLOCKS_AT[at] = UNLOCKS_AT[at] || []).push({id: 'look-' + v, icon: k === 'tstyle' ? 'style' : 'balls', name: LOOK_NAME[v],
      what: k === 'tstyle' ? 'A new look for the table.' : 'A new set of balls.', where:'Settings › Table', tryIt: ()=>tryLook(k, v)});
}
// the unlocks of the steps after `from`, up to and including `to`
export const unlocksBetween = (from, to) => Object.keys(UNLOCKS_AT).map(Number).filter(s=>s > from && s <= to).sort((a, b)=>a - b).flatMap(s=>UNLOCKS_AT[s]);
// a new look: the look picker if there is one, else Settings › Table, where the looks are
function tryLook(key, val){ if(typeof openLookPicker === 'function') openLookPicker(key, val); else openSettingsAt('table'); }
function openSettingsAt(tab){ openMenu(true); const b = document.querySelector(`[data-stab="${tab}"]`); if(b) b.click(); }
