// Entry point: loads the player, then wires everything up in the order the game always ran it.
import {$, curTable, initTable, POCKETS, R, setTable, wireInputMode} from './geom.js';
import {SH} from './steps.js';
import {afterPick, askPersist, bk, bkFocus, bkRender, bkShots, initNotesSeen, loadPicked, loadProfiles, loadSettings, loadStats, look, openBackup, pct, S, save, saveSettings, settings, SHOOT_GRADES, stats, statsGrade, TEST, wireBackup} from './state.js';
import {DEV, fpsStart, wireDevTools} from './perf.js';
import {cheer, cheerFx, cheerGo, cheerQ, confetti, wireAudio, wireButtonSounds} from './audio.js';
import {addLookUnlocks, baselines, enforceLocks, ensureShootLevel, fastFlashLocked, flashUnlocked, GEN, gradeFor, GRADES, gradeTable, hasBaseline, ladderBest, ladderPickOpen, practiceUnlocked, progTable, runUnlocked, tableUnlocked} from './grades.js';
import {addExtras, dealShot, decodeRec, drillDeal, encodeRec, fetchShipped, fromLibrary, handRoom, isZoneStep, LIB_STEPS, libIdle, libVer, makeRec, newRack, NO_EIGHTH, obRunMax, obRunOk, parseShipped, reachMax, reachOf, REC, recOk, runAfterShot, runAllowed, runCallCheck, runChange, runChangeBack, runFoul, runPick, runPicks, runPlanDone, runQuit, runShot, runStage, runTapBall, runTapPocket, runTarget, runUndoPlan, scaleRec, setShipped, SHIPPED, shippedOk, shootDeal, shotOf, tableFor, throwStroke, ZONE_STEPS, zoneSpotOk} from './deal.js';
import {aimFor, bridgeAim, bridgeGeom, cueStroke, MPH, overviewCam, playAim, renderBadge, rightIdFor, shootCam, shotStroke, strikeOf, STROKE_MPH, takeShot, wireLevelUp, wireShootControls} from './shot.js';
import {applyGfx, applyStyle, BALL_SETS, bestLook, cueRig, draw, initTable3d, keyBallSets, LOOK_AT, lookOpen, setVH, sizeTable, VH, wireArrowWake, wireResize, wireResizeDraw, wireStance, wireWalk} from './view.js';
import {finishAnim} from './anim.js';
import {deal, lockCalls, RUN_SIZE, setRun, showSessIdle, wireSheets} from './modes.js';
import {alignLogo, applySetting, easterEggCheck, easterEggSkips, renderStats, showPlayers, startWhatsNew, syncPressed, syncStreakPill, toTop, wireAnswers, wireHeader, wireKeysCard, wireLockTips, wireLogoAlign, wireLookPicker, wireModeButtons, wireMusic, wireNext, wirePlayerMenu, wireRadio, wireReplay, wireReset, wireStanceCard, wireStatsView, wireTableTap, wireTour, wireWhatsNew} from './ui.js';

initTable();
wireInputMode();
loadProfiles();
loadPicked();
if(!S.ME){ S.ME = await new Promise(go=>{ S.plPick = go; showPlayers(); }); $('playercover').hidden = true; toTop(); }   // nobody picked yet: the game waits behind the picker, then starts
afterPick();
loadSettings();
initNotesSeen();
loadStats();
wireDevTools();
fetchShipped();
wireLevelUp();
keyBallSets();
addLookUnlocks();
wireArrowWake();
initTable3d();
wireAudio();
wireButtonSounds();
wireStatsView();
wireLockTips();
wireModeButtons();
wireAnswers();
wireNext();
wireWalk();
wireTableTap();
wireReplay();
wireResize();
wireLogoAlign();
wireResizeDraw();
wireReset();
wireHeader();
wireRadio();
wireLookPicker();

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
wirePlayerMenu();
wireBackup();
wireStanceCard();
wireTour();
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
wireSheets();
wireMusic();
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
wireKeysCard();
wireWhatsNew();
if(!TEST) easterEggCheck();   // a special player (a new one, or one renamed on an earlier visit)
startWhatsNew();
if(settings.stanceSet || stats.log.length) askPersist();   // already playing: ask now (once)
if(!TEST){ let r = null; try{ r = sessionStorage.getItem(lsKey('halfball-restored')); sessionStorage.removeItem(lsKey('halfball-restored')); }catch(e){}
  if(r){ openBackup(null); bk.view = 'done'; bk.msg = `Restored from your backup. ${S.ME.name}: ${statsGrade(stats)} · ${bkShots(stats).toLocaleString()} shots.`; bk.tone = 'ok'; bkRender(); bkFocus(); } }
