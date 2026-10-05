// Halfball: the Stats view. Pure rendering from a player's stats log: the page hands it the log and the game's own rules
// (what counts as right, which way a miss leans), and it draws every tab as plain HTML and inline SVG, so it works offline.
// One pass over the log per mode, cached until the log changes; only the open tab is drawn.
window.HBStats = (function(){
'use strict';
const TABS = [['overview', 'Overview'], ['fractions', 'Fractions'], ['shots', 'Shots'], ['history', 'History'], ['sessions', 'Sessions']];
const ZONE_NAME = {9: 'Follow', 10: 'Stun', 11: 'Draw', 12: 'Two rails', 13: 'English'};
const STROKE_NAME = {3: '¼ stroke', 5: '½ stroke', 8: '¾ stroke', 10: 'Full stroke'};
const SESSION_GAP = 30;   // minutes: a longer break starts a new session
const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c=>({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);
const pct = (a, b) => b ? Math.round(100*a/b) : 0;
const num = n => Number(n).toLocaleString();
const plural = (n, one, many) => `${num(n)} ${n === 1 ? one : (many || one + 's')}`;

// ---------- the digest: everything the tabs show, from one pass ----------
let memo = {key: null, d: null};
function digest(ctx){
  const log = ctx.log || [], last = log[log.length - 1];
  const key = [ctx.task, log.length, last && (last.ts || ''), last && last.p, (ctx.sessions || []).length, ctx.shoot && ctx.shoot.g].join('|');
  if(memo.key === key && memo.ctx === ctx.log) return memo.d;
  const shoot = ctx.task === 'shoot', idx = {}, refs = ctx.refs;
  refs.forEach((r, i)=>{ idx[r.id] = i; });
  const L = [];
  for(const e of log) if((e.t || 'call') === ctx.task && !e.gh) L.push(e);
  const real = e => shoot ? (e.ra || e.a) : e.a;
  const called = e => shoot ? e.p : (e.aa && e.p === e.aa && e.pm === e.aam ? e.a : e.p);
  const ok = e => ctx.success(e);
  const callOk = e => called(e) === real(e);
  // which way a miss leans: +1 too thin, -1 too full, 0 right (the game's own rule, except on the Ladder, where the right call is the one this stroke needs)
  const leanOf = e => {
    if(!shoot) return ctx.lean(e);
    if(callOk(e)) return 0;
    const d = (idx[e.p] ?? 0) - (idx[real(e)] ?? 0); return d > 0 ? 1 : d < 0 ? -1 : 0;
  };
  const n = L.length;
  let right = 0, calls = 0, made = 0, scr = 0;
  const okA = new Uint8Array(n), leanA = new Int8Array(n);
  for(let i = 0; i < n; i++){
    const e = L[i]; okA[i] = ok(e) ? 1 : 0; right += okA[i];
    if(callOk(e)) calls++;
    if(e.m) made++;
    if(e.sc) scr++;
    leanA[i] = okA[i] && !shoot ? 0 : leanOf(e);
  }
  // streaks: as in the game, a streak lives inside one run (session id)
  const streaks = []; let cur = 0, sid, start = 0, best = 0;
  for(let i = 0; i < n; i++){
    const e = L[i];
    if(e.sid !== sid){ if(cur >= 2) streaks.push({len: cur, at: start}); cur = 0; sid = e.sid; }
    if(okA[i]){ if(!cur) start = i; cur++; best = Math.max(best, cur); }
    else { if(cur >= 2) streaks.push({len: cur, at: start}); cur = 0; }
  }
  const curStreak = cur, curOpen = cur >= 2 ? {len: cur, at: start, open: true} : null;
  if(curOpen) streaks.push(curOpen);
  // the best 25-shot stretch
  let win = 0, bestWin = -1, bestWinAt = 0;
  for(let i = 0; i < n; i++){ win += okA[i]; if(i >= 25) win -= okA[i - 25]; if(i >= 24 && win > bestWin){ bestWin = win; bestWinAt = i - 24; } }
  // fractions: by the real one, and the confusion matrix
  const shown = refs.filter(r=>r.core || L.some(e=>real(e) === r.id || called(e) === r.id));
  const si = {}; shown.forEach((r, i)=>{ si[r.id] = i; });
  const M = shown.map(()=>shown.map(()=>0)), byRef = shown.map(()=>({n: 0, ok: 0, call: 0}));
  for(let i = 0; i < n; i++){
    const e = L[i], a = si[real(e)], b = si[called(e)];
    if(a == null) continue;
    byRef[a].n++; byRef[a].ok += okA[i]; if(b === a) byRef[a].call++;
    if(b != null) M[a][b]++;
  }
  const d = {ctx, shoot, L, n, right, calls, made, scr, okA, leanA, streaks, best, curStreak, bestWin, bestWinAt, shown, M, byRef, idx, real, called, callOk};
  memo = {key, ctx: ctx.log, d};
  return d;
}
// a group's numbers: shots, full marks, and its misses split thin / full
function group(d, fn){
  let n = 0, ok = 0, thin = 0, full = 0, made = 0, sc = 0;
  for(let i = 0; i < d.n; i++){ const e = d.L[i]; if(!fn(e)) continue; n++; ok += d.okA[i]; if(d.leanA[i] > 0) thin++; else if(d.leanA[i] < 0) full++; if(e.m) made++; if(e.sc) sc++; }
  return {n, ok, thin, full, made, sc, p: pct(ok, n)};
}

// ---------- pieces ----------
const card = (title, sub, body, cls = '') => `<section class="svcard ${cls}"><div class="svch"><h3>${title}</h3>${sub ? `<p>${sub}</p>` : ''}</div>${body}</section>`;
const empty = (msg, sub) => `<div class="svempty"><b>${msg}</b>${sub ? `<span>${sub}</span>` : ''}</div>`;
const kpi = (v, label, sub, tone) => `<div class="svkpi${tone ? ' ' + tone : ''}"><b>${v}</b><span>${label}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
// one bar per row: label, the bar (a percentage), and the number with its sample size; thin samples are hatched and say so
function bars(rows, opts = {}){
  const min = opts.min ?? 5;
  return `<ul class="svbars" role="list">` + rows.map(r=>{
    const few = r.n > 0 && r.n < min, p = r.n ? pct(r.ok, r.n) : 0;
    const val = r.n ? `${p}%` : '–', note = r.n ? `${num(r.ok)}/${num(r.n)}` : 'no shots';
    const aria = r.n ? `${r.label}: ${p} percent, ${r.ok} of ${r.n}${few ? ', few shots' : ''}` : `${r.label}: no shots yet`;
    return `<li class="svbar${few ? ' few' : ''}${r.n ? '' : ' none'}" aria-label="${esc(aria)}"><span class="svbl${opts.big ? ' big' : ''}" aria-hidden="true">${r.label}</span>`
      + `<span class="svbt" aria-hidden="true"><i style="width:${p}%"></i></span><span class="svbv" aria-hidden="true"><b>${val}</b><small>${few ? 'few · ' : ''}${note}</small></span></li>`;
  }).join('') + `</ul>`;
}
// a small table of several numbers per row (tabular figures, right-aligned)
function table(head, rows, caption){
  return `<div class="svtw"><table class="svt">${caption ? `<caption class="sr">${caption}</caption>` : ''}<thead><tr>${head.map((h, i)=>`<th scope="col"${i ? '' : ' class="l"'}>${h}</th>`).join('')}</tr></thead><tbody>`
    + rows.map(r=>`<tr>${r.map((c, i)=>i ? `<td>${c}</td>` : `<th scope="row" class="l">${c}</th>`).join('')}</tr>`).join('') + `</tbody></table></div>`;
}
const pc = (a, b) => b ? `${pct(a, b)}%` : '–';

// a line chart of accuracy (0–100%) over points {x label, y %, sub}: gridlines at quarters, the mean dashed, a focusable readout
let charts = [], chartSeq = 0;
function lineChart(pts, o){
  const id = 'svc' + (++chartSeq), W = Math.max(280, Math.round(o.w)), H = o.h || 200, l = 40, r = 12, t = 12, b = 26;
  const iw = W - l - r, ih = H - t - b, X = i => l + (pts.length < 2 ? iw/2 : i*iw/(pts.length - 1)), Y = v => t + ih*(1 - v/100);
  let s = `<svg class="svline" id="${id}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(o.aria)}" tabindex="0">`;
  for(const v of [0, 25, 50, 75, 100]) s += `<line class="g${v ? '' : ' base'}" x1="${l}" x2="${W - r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="yl" x="${l - 6}" y="${Y(v) + 4}">${v}%</text>`;
  if(o.mean != null) s += `<line class="mean" x1="${l}" x2="${W - r}" y1="${Y(o.mean)}" y2="${Y(o.mean)}"/>`;
  const path = pts.map((p, i)=>`${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
  s += `<path class="area" d="${path}L${X(pts.length - 1).toFixed(1)},${Y(0)}L${X(0).toFixed(1)},${Y(0)}Z"/><path class="ln" d="${path}"/>`;
  const step = Math.max(1, Math.ceil(pts.length/((iw)/14)));
  pts.forEach((p, i)=>{ if(i % step === 0 || i === pts.length - 1) s += `<circle class="pt" cx="${X(i).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3"/>`; });
  const xl = [0, pts.length - 1]; if(pts.length > 4) xl.splice(1, 0, Math.round((pts.length - 1)/2));
  xl.forEach((i, k)=>{ s += `<text class="xl" x="${X(i).toFixed(1)}" y="${H - 6}" text-anchor="${k === 0 ? 'start' : k === xl.length - 1 ? 'end' : 'middle'}">${esc(pts[i].x)}</text>`; });
  s += `<line class="hair" x1="0" x2="0" y1="${t}" y2="${t + ih}" visibility="hidden"/><circle class="hot" r="5.5" cx="0" cy="0" visibility="hidden"/></svg>`;
  charts.push({id, pts, X, Y, read: o.read});
  const leg = `<div class="svlegend" aria-hidden="true"><span><i class="sw ln"></i>${esc(o.unit || 'Each point')}</span>${o.mean != null ? `<span><i class="sw mean"></i>Average ${o.mean}%</span>` : ''}</div>`;
  return `<div class="svchart"><p class="svread" aria-live="polite" id="${id}r">${esc(o.read(pts.length - 1))}</p>${s}${leg}</div>`;
}
// grade over the same blocks: a step line with the grade letters where it changes
function gradeChart(gs, o){
  const W = Math.max(280, Math.round(o.w)), H = 92, l = 40, r = 12, t = 16, b = 10, iw = W - l - r, ih = H - t - b;
  const lo = Math.min(...gs), hi = Math.max(...gs), span = Math.max(1, hi - lo);
  const X = i => l + (gs.length < 2 ? iw/2 : i*iw/(gs.length - 1)), Y = g => t + ih*(1 - (g - lo)/span);
  let s = `<svg class="svgrade" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(o.aria)}">`;
  s += `<line class="g base" x1="${l}" x2="${W - r}" y1="${Y(lo)}" y2="${Y(lo)}"/>`;
  s += `<text class="yl" x="${l - 6}" y="${Y(lo) + 4}">${esc(o.names[lo])}</text>`;
  if(hi > lo) s += `<line class="g" x1="${l}" x2="${W - r}" y1="${Y(hi)}" y2="${Y(hi)}"/><text class="yl" x="${l - 6}" y="${Y(hi) + 4}">${esc(o.names[hi])}</text>`;
  let d = '', lastX = -99;
  gs.forEach((g, i)=>{ d += i ? `H${X(i).toFixed(1)}V${Y(g).toFixed(1)}` : `M${X(0).toFixed(1)},${Y(g).toFixed(1)}`; });
  s += `<path class="step" d="${d}"/>`;
  gs.forEach((g, i)=>{ if((i === 0 || g !== gs[i - 1]) && X(i) - lastX > 26){ lastX = X(i); s += `<text class="gl" x="${X(i).toFixed(1)}" y="${(Y(g) - 5).toFixed(1)}">${esc(o.names[g])}</text>`; } });
  return s + `</svg>`;
}
// column chart of streaks, oldest left; hot ones (6+) solid, the rest outlined; records marked with their length
function streakChart(list, o){
  const W = Math.max(280, Math.round(o.w)), H = 170, l = 30, r = 8, t = 18, b = 22, iw = W - l - r, ih = H - t - b;
  const max = Math.max(o.hot + 1, ...list.map(s=>s.len)), Y = v => t + ih*(1 - v/max), cw = iw/list.length, bw = Math.max(2, Math.min(22, cw*.7));
  let s = `<svg class="svstreak" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(o.aria)}">`;
  s += `<line class="g base" x1="${l}" x2="${W - r}" y1="${Y(0)}" y2="${Y(0)}"/><text class="yl" x="${l - 6}" y="${Y(0) + 4}">0</text>`;
  s += `<line class="hotl" x1="${l}" x2="${W - r}" y1="${Y(o.hot)}" y2="${Y(o.hot)}"/><text class="yl" x="${l - 6}" y="${Y(o.hot) + 4}">${o.hot}</text>`;
  s += `<text class="yl" x="${l - 6}" y="${Y(max) + 4}">${max}</text>`;
  const top = Math.max(...list.map(s=>s.len)); let topDone = false;
  list.forEach((k, i)=>{
    const x = l + i*cw + (cw - bw)/2, isRec = cw >= 18 || (k.len === top && !topDone); if(k.len === top) topDone = true;
    s += `<rect class="${k.len >= o.hot ? 'hotb' : 'cold'}${k.open ? ' open' : ''}" x="${x.toFixed(1)}" y="${Y(k.len).toFixed(1)}" width="${bw.toFixed(1)}" height="${(Y(0) - Y(k.len)).toFixed(1)}" rx="2"/>`;
    if(isRec) s += `<text class="vl" x="${(x + bw/2).toFixed(1)}" y="${(Y(k.len) - 4).toFixed(1)}">${k.len}</text>`;
  });
  s += `<text class="xl" x="${l}" y="${H - 6}">${esc(o.from)}</text><text class="xl" x="${W - r}" y="${H - 6}" text-anchor="end">${esc(o.to)}</text>`;
  return s + `</svg>`;
}
// the last shots as a strip: a filled square right, half-filled a partial (right call, missed the zone or speed), hollow a miss
function formStrip(d, k){
  const from = Math.max(0, d.n - k), cells = [];
  for(let i = from; i < d.n; i++){ const e = d.L[i]; cells.push(d.okA[i] ? 'r' : e.ok === .5 ? 'h' : 'm'); }
  const r = cells.filter(c=>c === 'r').length;
  return `<div class="svform" role="img" aria-label="Last ${cells.length} shots: ${r} right, oldest first">` + cells.map(c=>`<i class="${c}"></i>`).join('') + `</div>`
    + `<div class="svlegend" aria-hidden="true"><span><i class="sw r"></i>Right</span>${d.shoot ? '<span><i class="sw h"></i>Right call, short of full marks</span>' : ''}<span><i class="sw m"></i>Miss</span></div>`;
}

// ---------- blocks over time ----------
function blocks(d){
  const B = d.n <= 200 ? 10 : d.n <= 600 ? 20 : d.n <= 1500 ? 50 : 100, out = [];
  for(let i = 0; i < d.n; i += B){
    const m = Math.min(B, d.n - i); if(m < B/2 && out.length) break;
    let ok = 0, g = null; for(let j = i; j < i + m; j++){ ok += d.okA[j]; if(d.L[j].sg != null) g = d.L[j].sg; }
    out.push({from: i + 1, to: i + m, y: pct(ok, m), g});
  }
  return {B, out};
}
// sessions: shots with a time, split where there was a long break; finished sessions from older versions too
function sessions(d){
  const S = []; let s = null, untimed = 0;
  for(let i = 0; i < d.n; i++){
    const e = d.L[i];
    if(!e.ts){ untimed++; continue; }
    if(!s || e.ts - s.end > SESSION_GAP){ s = {start: e.ts, end: e.ts, n: 0, ok: 0, calls: 0, made: 0, g0: e.sg, g1: e.sg, best: 0, run: 0}; S.push(s); }
    s.end = e.ts; s.n++; s.ok += d.okA[i]; if(d.callOk(e)) s.calls++; if(e.m) s.made++;
    if(e.sg != null){ if(s.g0 == null) s.g0 = e.sg; s.g1 = e.sg; }
    s.run = d.okA[i] ? s.run + 1 : 0; s.best = Math.max(s.best, s.run);
  }
  const old = (d.ctx.sessions || []).filter(x=>x.task === d.ctx.task && !x.dev && x.end && x.n).map(x=>({start: Math.round(x.start/60000), end: Math.round(x.end/60000), n: x.n, ok: x.right, calls: x.right, made: x.made, best: null, legacy: 1}));
  return {list: old.concat(S).sort((a, b)=>a.start - b.start), untimed};
}
const when = m => new Date(m*60000);
const fmtDay = m => when(m).toLocaleDateString(undefined, {weekday: 'short', month: 'short', day: 'numeric'});
const fmtTime = m => when(m).toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'});

// ---------- the tabs ----------
function modeName(d){ return d.shoot ? 'Ladder' : 'Flash'; }

function tabOverview(d, w){
  const c = d.ctx, G = c.grades, out = [];
  const last20 = (()=>{ const k = Math.min(20, d.n); let ok = 0; for(let i = d.n - k; i < d.n; i++) ok += d.okA[i]; return k ? `${pct(ok, k)}%` : '–'; })();
  const k = [];
  if(d.shoot){
    const g = c.shoot ? c.shoot.g : 0, best = c.shoot ? Math.max(c.shoot.g, c.shoot.best ?? 0) : 0;
    k.push(kpi(G[g] || '–', 'Grade', best > g ? `best ${G[best]}` : 'Ladder', 'grade lead'));
    k.push(kpi(d.n ? `${pct(d.right, d.n)}%` : '–', 'Full marks', d.n ? `${num(d.right)} of ${num(d.n)}` : ''));
    k.push(kpi(d.n ? `${pct(d.calls, d.n)}%` : '–', 'Right call', 'the fraction'));
    k.push(kpi(d.n ? `${pct(d.made, d.n)}%` : '–', 'Pocketed', d.scr ? `${pct(d.scr, d.n)}% scratched` : ''));
  } else {
    k.push(kpi(d.n ? `${pct(d.right, d.n)}%` : '–', 'Called right', d.n ? `${num(d.right)} of ${num(d.n)}` : '', 'lead'));
  }
  k.push(kpi(last20, 'Last 20', ''));
  k.push(kpi(num(d.curStreak), 'Streak', d.shoot ? `best ${num(d.best)}` : '', d.shoot ? 'lead' : ''));
  if(!d.shoot) k.push(kpi(num(d.best), 'Best streak', ''));
  k.push(kpi(num(d.n), 'Shots', ''));
  out.push(`<div class="svkpis" role="list" aria-label="Key numbers">${k.map(x=>x.replace('<div class="svkpi', '<div role="listitem" class="svkpi')).join('')}</div>`);
  const grid = [], bl = blocks(d);
  grid.push(card('Accuracy over time', `${d.shoot ? 'Full marks' : 'Called right'} per ${bl.B} shots · History has the grade and streaks`, bl.out.length >= 2
    ? lineChart(bl.out.map(b=>({...b, x: `shot ${num(b.from)}`})), {w: w.full, h: 190, unit: `Each point: ${bl.B} shots`, mean: pct(d.right, d.n), aria: `Accuracy per ${bl.B} shots, ${bl.out.length} blocks, last ${bl.out[bl.out.length - 1].y} percent`,
        read: i=>{ const b = bl.out[i]; return `Shots ${num(b.from)}–${num(b.to)}: ${b.y}%${b.g != null ? ` · grade ${G[b.g]}` : ''}`; }})
    : empty(`Play ${bl.B*2} shots to see your trend`, `${plural(d.n, 'shot')} so far.`), 'wide'));
  grid.push(card('Recent form', `Last ${Math.min(50, d.n) || 50} shots, oldest first`, d.n ? formStrip(d, 50) : empty(`No ${modeName(d)} shots yet`, 'Each shot shows here as right or a miss.')));
  grid.push(card('Patterns', 'What the numbers say so far', d.n >= 10 ? patterns(d) : empty('Play 10 shots to see your patterns', `${plural(d.n, 'shot')} so far.`)));
  out.push(`<div class="svgrid">${grid.join('')}</div>`);
  return out.join('');
}
function patterns(d){
  const rows = [], all = group(d, ()=>true), wrong = all.thin + all.full, dash = ['–', 'none'];
  rows.push(['Misses lean', ...(wrong < 4 ? (all.n && !wrong ? ['No misses', 'up'] : dash)
    : all.thin/wrong >= .65 ? [`Too thin <small>${all.thin} of ${wrong}</small>`, '']
    : all.full/wrong >= .65 ? [`Too full <small>${all.full} of ${wrong}</small>`, '']
    : [`Even <small>${all.thin} thin · ${all.full} full</small>`, ''])]);
  let top = null;
  d.M.forEach((row, i)=>row.forEach((c, j)=>{ if(i !== j && c >= 3 && (!top || c > top.c)) top = {i, j, c}; }));
  rows.push(['Common mix-up', ...(top ? [`${d.shown[top.j].label} when it’s ${d.shown[top.i].label} <small>${top.c}×</small>`, ''] : dash)]);
  const fr = d.shown.map((r, i)=>({label: r.label, ...d.byRef[i]})).filter(r=>r.n >= 5);
  if(fr.length >= 2){
    const P = r=>pct(r.ok, r.n), worst = fr.reduce((a, b)=>P(b) < P(a) ? b : a), best = fr.reduce((a, b)=>P(b) > P(a) ? b : a);
    if(P(best) > P(worst)){ rows.push(['Weakest cut', `${worst.label} <small>${P(worst)}%</small>`, 'down']); rows.push(['Strongest cut', `${best.label} <small>${P(best)}%</small>`, 'up']); }
  }
  const Lg = group(d, e=>e.s === 'L'), Rg = group(d, e=>e.s === 'R');
  rows.push(['Left vs. right cuts', ...(Lg.n >= 6 && Rg.n >= 6
    ? (Math.abs(Lg.p - Rg.p) >= 12 ? [`Weaker on ${Lg.p < Rg.p ? 'left' : 'right'} <small>${Math.min(Lg.p, Rg.p)}% vs ${Math.max(Lg.p, Rg.p)}%</small>`, 'down'] : [`Even <small>${Lg.p}% · ${Rg.p}%</small>`, ''])
    : dash)]);
  const near = group(d, e=>typeof e.dc === 'number' && e.dc < 24), far = group(d, e=>typeof e.dc === 'number' && e.dc >= 42);
  if(near.n >= 6 && far.n >= 6){ const x = near.p - far.p; rows.push(['Distance', x >= 12 ? `Drops when long <small>${near.p}% → ${far.p}%</small>` : x <= -12 ? `Better when long <small>${near.p}% → ${far.p}%</small>` : `Steady <small>${near.p}% short · ${far.p}% long</small>`, x >= 12 ? 'down' : x <= -12 ? 'up' : '']); }
  if(d.n >= 40){
    const a = d.okA.slice(0, Math.min(d.n - 20, d.n >> 1)), z = d.okA.slice(-20), pa = pct(a.reduce((s, v)=>s + v, 0), a.length), pz = pct(z.reduce((s, v)=>s + v, 0), 20), x = pz - pa;
    rows.push(['Trend', x >= 10 ? `Improving <small>${pa}% → ${pz}% last 20</small>` : x <= -10 ? `Slipping <small>${pa}% → ${pz}% last 20</small>` : `Steady <small>${pa}% → ${pz}% last 20</small>`, x >= 10 ? 'up' : x <= -10 ? 'down' : '']);
  }
  return `<dl class="svins">` + rows.map(([k, v, t])=>`<div><dt>${k}</dt><dd class="${t}">${v}</dd></div>`).join('') + `</dl>`;
}

function tabFractions(d, w){
  const grid = [], word = d.shoot ? 'Full marks' : 'Called right';
  grid.push(card('By real fraction', `${word}, fullest to thinnest`, d.n < 10 ? empty('Play 10 shots to see accuracy by fraction', `${plural(d.n, 'shot')} so far.`)
    : bars(d.shown.map((r, i)=>({label: r.label, n: d.byRef[i].n, ok: d.byRef[i].ok})), {big: true})));
  grid.push(card('Real fraction vs. your call', 'Each row is the real fraction; shade is the share of that row’s shots you called each way', d.n < 20 ? empty('Play 20 shots to see which fractions you mix up', `${plural(d.n, 'shot')} so far.`) : heatmap(d)));
  grid.push(card('Where your misses lean', 'Of the misses in each group: called too full (left) or too thin (right)', leans(d)));
  grid.push(card('By shot', `${word} by side, distance, pocket and view`, d.n >= 10 ? wheres(d) : empty('Play 10 shots to see where you do best', `${plural(d.n, 'shot')} so far.`)));
  return `<div class="svgrid">${grid.join('')}</div>`;
}
function heatmap(d){
  const S = d.shown;
  let t = `<div class="svtw"><table class="svheat"><caption class="sr">Rows: the real fraction. Columns: your call. Each cell: shots and the share of the row.</caption>`
    + `<thead><tr><th scope="col" class="corner"><span>Real</span><span>Call</span></th>${S.map(r=>`<th scope="col">${r.label}</th>`).join('')}<th scope="col" class="tot">Shots</th></tr></thead><tbody>`;
  S.forEach((r, i)=>{
    const tot = d.M[i].reduce((a, b)=>a + b, 0);
    t += `<tr><th scope="row">${r.label}</th>` + d.M[i].map((c, j)=>{
      const sh = tot ? c/tot : 0, style = c ? `--s:${sh.toFixed(2)}` : '';   // shade: the share of the row (kept light enough for dark-on-light text in either theme)
      const lab = `Real ${r.label}, called ${S[j].label}: ${c} shot${c === 1 ? '' : 's'}${tot ? `, ${Math.round(sh*100)} percent of the row` : ''}${i === j ? ', the right call' : ''}`;
      return `<td class="${i === j ? 'diag' : ''}${c ? ' c' : ''}" style="${style}" aria-label="${esc(lab)}"><b>${c || '·'}</b>${c && tot ? `<small>${Math.round(sh*100)}%</small>` : ''}</td>`;
    }).join('') + `<td class="tot">${num(tot)}</td></tr>`;
  });
  t += `</tbody></table></div>`;
  t += `<div class="svlegend" aria-hidden="true"><span><i class="sw ramp"></i>0% → 100% of the row</span><span><i class="sw diag"></i>Outlined: the right call</span></div>`;
  return t;
}
function leans(d){
  const G = [
    ['All shots', ()=>true],
    ['Left cuts', e=>e.s === 'L'], ['Right cuts', e=>e.s === 'R'],
    ['Short (under 2 ft)', e=>typeof e.dc === 'number' && e.dc < 24], ['Medium', e=>e.dc >= 24 && e.dc < 42], ['Long (3½ ft+)', e=>e.dc >= 42],
    ['Standing', e=>e.v === 'stand'], ['Down on the ball', e=>e.v === 'down'],
  ];
  const rows = G.map(([name, fn])=>({name, ...group(d, fn)})).filter((g, i)=>!i || g.thin + g.full >= 3);
  const all = rows[0]; if(all.thin + all.full < 5) return empty('Lean shows after 5 misses', `${plural(all.thin + all.full, 'miss', 'misses')} so far.`);
  return `<div class="svlean" role="list">` + `<div class="svleanh" aria-hidden="true"><span></span><span class="mid"><span>← too full</span><span>too thin →</span></span><span></span></div>` + rows.map(g=>{
    const m = g.thin + g.full, f = pct(g.full, m), th = 100 - f;
    return `<div class="svleanr" role="listitem" aria-label="${esc(`${g.name}: ${m} misses, ${g.full} too full, ${g.thin} too thin`)}"><span class="lab" aria-hidden="true">${g.name}</span>`
      + `<span class="trk" aria-hidden="true"><i class="full" style="width:${f/2}%"></i><i class="thin" style="width:${th/2}%"></i></span>`
      + `<span class="val" aria-hidden="true"><b>${f}% · ${th}%</b><small>${m} misses</small></span></div>`;
  }).join('') + `</div>`;
}
function wheres(d){
  const sec = (title, rows) => `<h4>${title}</h4>` + bars(rows.map(([label, fn])=>{ const g = group(d, fn); return {label, n: g.n, ok: g.ok}; }));
  return sec('Side', [['Left cuts', e=>e.s === 'L'], ['Right cuts', e=>e.s === 'R']])
    + sec('Distance, cue ball to object ball', [['Short', e=>typeof e.dc === 'number' && e.dc < 24], ['Medium', e=>e.dc >= 24 && e.dc < 42], ['Long', e=>e.dc >= 42]])
    + sec('Pocket', [['Corner', e=>e.pt === 'c'], ['Side', e=>e.pt === 's']])
    + sec('View', [['Standing', e=>e.v === 'stand'], ['Down', e=>e.v === 'down'], ['Walked', e=>e.wk === 1], ['Didn’t walk', e=>e.wk === 0]]);
}

function tabShots(d){
  const G = d.ctx.grades;
  if(!d.shoot) return empty('Zone, speed and spin results come from the Ladder', 'Switch to Ladder at the top to see them.');
  const zk = e => e.zk || (e.sg >= 9 && e.sg <= 13 ? e.sg : e.z != null ? 0 : null);
  const Z = d.L.filter(e=>e.z != null), grid = [];
  // zones by shot type
  if(Z.length){
    const types = [9, 10, 11, 12, 13, 0].map(k=>{ const x = Z.filter(e=>zk(e) === k); return {k, label: k ? ZONE_NAME[k] : 'Mixed (S)', n: x.length, ok: x.filter(e=>e.z === 1).length, made: x.filter(e=>e.m).length, sc: x.filter(e=>e.sc).length}; }).filter(t=>t.n);
    const zin = Z.filter(e=>e.z === 1).length;
    grid.push(card('Position: zone hit rate', `Shots with a target zone: cue ball pocketed the object ball and stopped in the zone · ${pct(zin, Z.length)}% of ${num(Z.length)}`,
      bars(types, {big: false}) + table(['Shot type', 'Shots', 'Pocketed', 'Scratch'], types.map(t=>[t.label, num(t.n), pc(t.made, t.n), pc(t.sc, t.n)]), 'Zone shots by type: pocketed and scratched')));
  } else grid.push(card('Position: zone hit rate', 'Shots with a target zone', empty(`Zones start at ${G[9]} (follow)`, 'Each zone shot shows here by type: follow, stun, draw, two rails, english.')));
  // speed
  const SV = d.L.filter(e=>typeof e.sv === 'number');
  if(SV.length){
    const B = [['Under 1×', 0, 1], ['1–1.5×', 1, 1.5], ['1.5–2.5×', 1.5, 2.5], ['2.5–4×', 2.5, 4], ['4× or more', 4, 1e9]];
    const rows = B.map(([label, lo, hi])=>{ const x = SV.filter(e=>e.sv >= lo && e.sv < hi); return {label, n: x.length, made: x.filter(e=>e.m).length, ok: x.filter(e=>e.m).length, z: x.filter(e=>e.z != null), sc: x.filter(e=>e.sc).length}; });
    let body = `<h4>Pocketed, by how hard you hit it</h4>` + bars(rows)
      + table(['Speed', 'Shots', 'In zone', 'Scratch'], rows.filter(r=>r.n).map(r=>[r.label, `${num(r.n)} <small>${pc(r.n, SV.length)}</small>`, r.z.length ? pc(r.z.filter(e=>e.z === 1).length, r.z.length) : '–', pc(r.sc, r.n)]), 'Speed against zone and scratch');
    const S2 = d.L.filter(e=>e.sl);
    if(S2.length){
      const st = [3, 5, 8, 10].map(l=>{ const x = S2.filter(e=>e.sl === l); return {label: STROKE_NAME[l], n: x.length, ok: x.filter(e=>e.m).length}; });
      body += `<h4>Your stroke choice</h4>` + bars(st);
      const W2 = S2.filter(e=>e.wl && e.z != null), mt = W2.filter(e=>e.sl === e.wl), mm = W2.filter(e=>e.sl !== e.wl);
      if(W2.length) body += table(['Zone shots', 'Shots', 'In zone'], [['The stroke it wanted', num(mt.length), pc(mt.filter(e=>e.z === 1).length, mt.length)], ['Another stroke', num(mm.length), pc(mm.filter(e=>e.z === 1).length, mm.length)]], 'Matching the zone stroke');
    }
    grid.push(card('Speed', 'How hard you hit it, against the softest speed that pockets the ball (1×)', body));
  } else grid.push(card('Speed', 'Your speed against outcomes', empty(`Speed is yours from ${G[7]}`, 'Each shot’s speed and result shows here.')));
  // scratches
  const scr = d.L.filter(e=>e.sc).length, P = d.L.filter(e=>e.sv != null || e.z != null || e.sc != null);
  grid.push(card('Scratches', 'Cue ball in a pocket', P.length ? `<div class="svkpis mini">${kpi(`${pct(scr, P.length)}%`, 'Scratch rate', `${num(scr)} of ${num(P.length)}`)}${kpi(num(d.L.slice(-100).filter(e=>e.sc).length), 'Scratches', 'last 100 shots')}</div>`
    + (scr ? `<h4>Scratch rate by shot type</h4>` + bars(Object.entries({'Follow': 9, 'Stun': 10, 'Draw': 11, 'Two rails': 12, 'English': 13}).map(([label, k])=>{ const x = Z.filter(e=>zk(e) === k); return {label, n: x.length, ok: x.filter(e=>e.sc).length}; }).filter(r=>r.n), {min: 5}).replace(/<ul class="svbars"/, '<ul class="svbars bad"') : '<p class="svnote">No scratches.</p>')
    : empty('No shot results yet', 'Scratches show once you play Ladder shots.')));
  // spin
  const TP = d.L.filter(e=>Array.isArray(e.tp));
  if(TP.length){
    const where = e => { const [x, y] = e.tp; return Math.abs(x) > .05 ? (x < 0 ? 'Left english' : 'Right english') : y > .05 ? 'Top (follow)' : y < -.05 ? 'Bottom (draw)' : 'Centre'; };
    const R = ['Top (follow)', 'Centre', 'Bottom (draw)', 'Left english', 'Right english'].map(label=>{ const x = TP.filter(e=>where(e) === label), zz = x.filter(e=>e.z != null); return {label, n: x.length, made: x.filter(e=>e.m).length, zn: zz.length, zok: zz.filter(e=>e.z === 1).length}; }).filter(r=>r.n);
    grid.push(card('Spin', 'Where you struck the cue ball, and what happened', tipMap(TP) + table(['Tip', 'Shots', 'Pocketed', 'In zone'], R.map(r=>[r.label, num(r.n), pc(r.made, r.n), r.zn ? pc(r.zok, r.zn) : '–']), 'Tip position against outcome')));
  } else grid.push(card('Spin', 'Where you struck the cue ball', empty('No spin results yet', `You set the spin from grade ${G[9]} on.`)));
  return `<div class="svgrid">${grid.join('')}</div>`;
}
// the cue ball face with a dot per tip position used: size by how often, fill by the zone rate there
function tipMap(TP){
  const m = {};
  TP.forEach(e=>{ const k = e.tp.map(v=>Math.round(v*20)/20).join(','); const o = m[k] || (m[k] = {x: +k.split(',')[0], y: +k.split(',')[1], n: 0, z: 0, zn: 0}); o.n++; if(e.z != null){ o.zn++; if(e.z === 1) o.z++; } });
  const pts = Object.values(m), max = Math.max(...pts.map(p=>p.n));
  let s = `<svg class="svtip" viewBox="-1.25 -1.25 2.5 2.5" width="150" height="150" role="img" aria-label="Tip positions used: ${pts.length}. The most used: ${pts.sort((a, b)=>b.n - a.n).slice(0, 3).map(p=>`${p.n} shots`).join(', ')}">`;
  s += `<circle r="1" class="face"/><line x1="-1" x2="1" y1="0" y2="0" class="cross"/><line y1="-1" y2="1" x1="0" x2="0" class="cross"/><circle r=".5" class="lim"/>`;
  pts.forEach(p=>{ const r = .035 + .075*Math.sqrt(p.n/max); s += `<circle cx="${p.x}" cy="${-p.y}" r="${r.toFixed(3)}" class="tipd" style="fill-opacity:${p.zn ? (.25 + .75*p.z/p.zn).toFixed(2) : .25}"/>`; });
  return `<div class="svtipw">${s}</svg><p class="svnote">Bigger dot: used more. Darker: more zones hit from there. Inner ring: half the ball’s radius.</p></div>`;
}

function tabHistory(d, w){
  const G = d.ctx.grades, bl = blocks(d), grid = [], hot = d.ctx.hot || 6;
  let trend;
  if(bl.out.length >= 2){
    trend = lineChart(bl.out.map(b=>({...b, x: `shot ${num(b.from)}`})), {w: w.full, h: 220, unit: `Each point: ${bl.B} shots`, mean: pct(d.right, d.n), aria: `${d.shoot ? 'Full marks' : 'Called right'} per ${bl.B} shots over ${num(d.n)} shots`,
      read: i=>{ const b = bl.out[i]; return `Shots ${num(b.from)}–${num(b.to)}: ${b.y}%${b.g != null ? ` · grade ${G[b.g]}` : ''}`; }});
    const gs = bl.out.map(b=>b.g);
    if(d.shoot && gs.some(g=>g != null)){
      let last = gs.find(g=>g != null); const fill = gs.map(g=>g != null ? (last = g) : last);
      trend += `<h4>Grade</h4>` + gradeChart(fill, {w: w.full, names: G, aria: `Grade from ${G[fill[0]]} to ${G[fill[fill.length - 1]]}`});
    }
    trend += `<details class="svdet"><summary>Show as a table</summary>` + table(['Shots', d.shoot ? 'Full marks' : 'Called right', ...(d.shoot ? ['Grade'] : [])], bl.out.slice().reverse().map(b=>[`${num(b.from)}–${num(b.to)}`, `${b.y}%`, ...(d.shoot ? [b.g != null ? G[b.g] : '–'] : [])]), 'Accuracy per block') + `</details>`;
  } else trend = empty(`Play ${bl.B*2} shots to see your trend`, `${plural(d.n, 'shot')} so far.`);
  grid.push(card('Accuracy over time', `${d.shoot ? 'Full marks' : 'Called right'} per ${bl.B} shots; tap or use the arrow keys for each block`, trend, 'wide'));
  // streaks
  const hots = d.streaks.filter(s=>s.len >= hot).length, last100 = (()=>{ let b = 0, c = 0; for(let i = Math.max(0, d.n - 100); i < d.n; i++){ c = d.okA[i] ? c + 1 : 0; b = Math.max(b, c); } return b; })();
  let sb = `<div class="svkpis mini">${kpi(num(d.best), 'Best streak', '')}${kpi(num(d.curStreak), 'Current', '')}${kpi(num(last100), 'Best, last 100', '')}${kpi(num(hots), `Streaks of ${hot}+`, '')}`
    + `${d.bestWin >= 0 ? kpi(`${pct(d.bestWin, 25)}%`, 'Best 25 shots', `from shot ${num(d.bestWinAt + 1)}`) : ''}</div>`;
  const S3 = d.streaks.filter(s=>s.len >= 3), list = S3.slice(-60);
  sb += list.length ? streakChart(list, {w: w.full, hot, best: d.best, aria: `${S3.length} streaks of 3 or more; best ${d.best}`, from: `shot ${num(list[0].at + 1)}`, to: list[list.length - 1].open ? 'now' : `shot ${num(list[list.length - 1].at + 1)}`})
    + `<div class="svlegend" aria-hidden="true"><span><i class="sw hotb"></i>${hot} or more</span><span><i class="sw cold"></i>3 to ${hot - 1}</span><span><i class="sw hotl"></i>Hot line</span></div>`
    : empty('No streaks of 3 or more yet', '');
  grid.push(card('Streaks', `Each streak of 3 or more, oldest left${S3.length > 60 ? ' (the last 60)' : ''}; the longest shown is labelled`, sb, 'wide'));
  return `<div class="svgrid">${grid.join('')}</div>`;
}

function tabSessions(d, w){
  const G = d.ctx.grades, S = sessions(d), list = S.list, grid = [];
  if(!list.length){
    return empty('No sessions yet', `Each time you play shows up here as a session. A break of ${SESSION_GAP} minutes or more starts a new one.`);
  }
  const shots = list.reduce((a, s)=>a + s.n, 0);
  grid.push(`<div class="svkpis mini wide">${kpi(num(list.length), 'Sessions', '')}${kpi(num(Math.round(shots/list.length)), 'Shots a session', 'average')}${kpi(`${pct(list.reduce((a, s)=>a + s.ok, 0), shots)}%`, d.shoot ? 'Full marks' : 'Called right', 'across sessions')}</div>`);
  const pts = list.filter(s=>s.n >= 5).map(s=>({x: fmtDay(s.start).replace(/^\w+,? /, ''), y: pct(s.ok, s.n), s}));
  grid.push(card('By session', `${d.shoot ? 'Full marks' : 'Called right'} per session of 5 shots or more`, pts.length >= 2
    ? lineChart(pts, {w: w.full, h: 190, unit: 'Each point: a session', aria: `Accuracy over ${pts.length} sessions`, read: i=>{ const s = pts[i].s; return `${fmtDay(s.start)}, ${fmtTime(s.start)}: ${pct(s.ok, s.n)}% of ${plural(s.n, 'shot')}${s.g0 != null ? ` · ${G[s.g0]}${s.g1 !== s.g0 ? ' → ' + G[s.g1] : ''}` : ''}`; }})
    : empty('Two sessions of 5 shots or more make a chart', ''), 'wide'));
  const rows = list.slice().reverse().slice(0, 60).map(s=>{
    const p = pct(s.ok, s.n), g = s.g0 != null ? (s.g1 !== s.g0 ? `${G[s.g0]} → ${G[s.g1]}` : G[s.g0]) : '';
    return `<li class="svsess"><div class="when"><b>${fmtDay(s.start)}</b><small>${s.legacy ? 'finished session' : fmtTime(s.start)}</small></div>`
      + `<div class="what"><span class="svbt" aria-hidden="true"><i style="width:${p}%"></i></span><small>${plural(s.n, 'shot')}${s.best ? ` · best streak ${s.best}` : ''}${g ? ` · ${g}` : ''}</small></div><b class="pct">${p}%</b></li>`;
  }).join('');
  grid.push(card('All sessions', `Newest first${list.length > 60 ? ' (the last 60)' : ''}`, `<ul class="svsessl" role="list">${rows}</ul>`, 'wide'));
  return `<div class="svgrid">${grid.join('')}</div>`;
}

// ---------- render + interaction ----------
function render(body, ctx, tab){
  charts = [];
  const d = digest(ctx), cw = body.clientWidth || 900, wide = cw >= 760;
  const inner = Math.min(cw, 1180) - (wide ? 48 : 24) - 34;   // a card's inner width
  const w = {full: inner, half: wide ? (inner - 16)/2 : inner};
  const fn = {overview: tabOverview, fractions: tabFractions, shots: tabShots, history: tabHistory, sessions: tabSessions}[tab] || tabOverview;
  body.innerHTML = `<div class="svin">${fn(d, w)}</div>`;
  wire(body);
}
function wire(body){
  charts.forEach(c=>{
    const svg = body.querySelector('#' + c.id); if(!svg) return;
    const read = body.querySelector('#' + c.id + 'r'), hair = svg.querySelector('.hair'), hot = svg.querySelector('.hot');
    let at = c.pts.length - 1;
    const show = i => {
      at = Math.max(0, Math.min(c.pts.length - 1, i));
      const x = c.X(at), y = c.Y(c.pts[at].y);
      hair.setAttribute('x1', x); hair.setAttribute('x2', x); hair.setAttribute('visibility', 'visible');
      hot.setAttribute('cx', x); hot.setAttribute('cy', y); hot.setAttribute('visibility', 'visible');
      if(read) read.textContent = c.read(at);
    };
    svg.addEventListener('pointermove', ev=>{
      const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, fx = (ev.clientX - r.left)/r.width*vb.width;
      let best = 0; c.pts.forEach((p, i)=>{ if(Math.abs(c.X(i) - fx) < Math.abs(c.X(best) - fx)) best = i; });
      show(best);
    });
    svg.addEventListener('pointerdown', ev=>{ svg.dispatchEvent(new PointerEvent('pointermove', ev)); });
    svg.addEventListener('keydown', ev=>{
      const k = {ArrowLeft: -1, ArrowRight: 1, Home: -1e9, End: 1e9}[ev.key];
      if(k == null) return; ev.preventDefault(); ev.stopPropagation(); show(at + k);
    });
    svg.addEventListener('focus', ()=>show(at));
  });
}
return {render, TABS, digest};
})();
