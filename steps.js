// The skill steps (SH) and the grade-to-step map: constants the other modules build their tables from at load, so they live in a module that imports nothing.
// ==================== the Shoot half ====================
// Halfball: the Shoot half. You aim and strike the cue ball yourself; the engine plays it out.

// ---------- the Shoot ladder ----------
// The skill steps. Their ids key the shot library (shots.bin's sections, LIB_STEPS) and every 'from this step on' check, so
// they never change: id 5 (once 'your aim line') is retired and no grade plays it. Grades map onto steps through GRADE_STEP.
export const SH = {noPath:1, noLine:2, noGhost:3, down:4, any:6, speed:7, throw:8, follow:9, stun:10, draw:11, cushion:12, english:13, all:14, full:15};
// grade index (SHOOT_GRADES, stats.shoot.g) → the step it plays
export const GRADE_STEP = [0, SH.noPath, SH.noLine, SH.noGhost, SH.down, SH.any, SH.speed, SH.throw, SH.follow, SH.stun, SH.draw, SH.cushion, SH.english, SH.all];
export const stepOf = g => GRADE_STEP[Math.min(Math.max(0, g | 0), GRADE_STEP.length - 1)];
export const gradeOf = st => { const i = GRADE_STEP.findIndex(x=>x >= st); return i < 0 ? GRADE_STEP.length - 1 : i; };   // the first grade at or past a step
