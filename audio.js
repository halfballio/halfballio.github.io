// Sounds: the table, the chimes, button feedback, and the streak celebrations.
import {S, settings, STREAK_HOT, tut} from './state.js';
import {$, IS_PHONE} from './geom.js';
// ---------- sounds: the table in a small room, mallet tones in a hall, dry clicks for buttons ----------
// iPhone and iPad: the 'ambient' audio session, chosen on purpose. The game's sounds and its music follow the ring/silent
// switch like any game's would, and mix with whatever else is playing (your own music or a podcast) instead of stopping it.
// ('playback' would sound with the switch on silent, and pause your other audio.) Where navigator.audioSession isn't there,
// Safari's Web Audio already behaves this way.
export function wireAudio(){
  try{ if(navigator.audioSession) navigator.audioSession.type = 'ambient'; }catch(e){}
  // browsers only allow audio after a user gesture: wake it on every touch or key, so the first answer isn't late. If a
  // context won't wake (iOS can leave one stuck after a call or a long time in the background), a fresh one is made.
  ['pointerdown','keydown'].forEach(t=>window.addEventListener(t, ()=>{
    if(settings.sound === '0') return;
    try{
      if(actx && actxKick && actx.state !== 'running' && performance.now() - actxKick > 1500){ try{ actx.close(); }catch(e){} actx = null; }
      audioCtx(); actxRest();
    }catch(e){}
  }, {capture:true, passive:true}));
  // the page hidden: the context rests (iOS stops it anyway), and wakes on the next sound or tap
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden && actx && actx.state === 'running') try{ actx.suspend(); }catch(e){} });
}
let actx = null, actxKick = 0, actxIdle = 0;
function audioCtx(){
  if(!actx){ const AC = window.AudioContext || window.webkitAudioContext; try{ actx = new AC({latencyHint:'interactive'}); }catch(e){ actx = new AC(); } actxKick = 0; }
  if(actx.state !== 'running' && actx.state !== 'closed'){   // 'suspended', or iOS's 'interrupted' after a call, an alarm or Siri
    if(!actxKick) actxKick = performance.now();
    try{ const p = actx.resume(); if(p && p.then) p.then(()=>{ actxKick = 0; }, ()=>{}); }catch(e){}
  } else actxKick = 0;
  return actx;
}
// rest the sound context when nothing's played for a while (the next tap wakes it, before its sound is made)
function actxRest(){ clearTimeout(actxIdle); actxIdle = setTimeout(()=>{ if(actx && actx.state === 'running') try{ actx.suspend(); }catch(e){} }, 20000); }
// everything the game plays goes out through one chain: nothing below what a phone speaker can play, and a limiter, so a
// burst of clicks never clips (small speakers turn clipping into buzz and crackle). Same idea as the music's chain.
let master = null;
function masterOut(){
  if(master && master.context === actx) return master;
  const hp = actx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 60; hp.Q.value = 0.7;
  const lim = actx.createDynamicsCompressor(); lim.threshold.value = -10; lim.knee.value = 4; lim.ratio.value = 14; lim.attack.value = .001; lim.release.value = .15;
  hp.connect(lim); lim.connect(actx.destination);
  return master = hp;
}
function impulse(secs, decayPow, bright){   // a reverb made of decaying noise, darker as it fades
  const sr = actx.sampleRate, n = Math.floor(sr*secs), b = actx.createBuffer(2, n, sr);
  for(let ch = 0; ch < 2; ch++){
    const d = b.getChannelData(ch); let lp = 0;
    for(let i = 0; i < n; i++){ const x = i/n; lp += (bright*(1 - x) + 0.05)*((Math.random()*2 - 1) - lp); d[i] = lp*Math.pow(1 - x, decayPow); }
  }
  return b;
}
function reverbBus(secs, decayPow, bright, wet, level){   // a bus that plays dry and into its own reverb
  const m = masterOut(), cv = actx.createConvolver(), w = actx.createGain(), bus = actx.createGain();
  cv.buffer = impulse(secs, decayPow, bright); w.gain.value = wet; bus.gain.value = level;
  cv.connect(w); w.connect(m); bus.connect(m); bus.connect(cv);
  return bus;
}
// each context's noise and buses, made once; each reverb only when first needed (a convolver costs a phone some work)
let fxKit = null;
function sfx(){
  audioCtx(); actxRest();
  if(!fxKit || fxKit.ctx !== actx){
    const noise = actx.createBuffer(1, actx.sampleRate, actx.sampleRate), d = noise.getChannelData(0);
    for(let i = 0; i < d.length; i++) d[i] = Math.random()*2 - 1;
    fxKit = {ctx: actx, noise, room: null, hall: null, ui: null};
  }
  return fxKit;
}
const roomBus = ()=>{ const F = sfx(); return F.room || (F.room = reverbBus(0.4, 4, 0.7, 0.22, 1)); };      // the table: a small room, short and dry
const hallBus = ()=>{ const F = sfx(); return F.hall || (F.hall = reverbBus(2.2, 2.8, 0.45, 0.38, 0.9)); }; // the feedback: a gentle hall
// building blocks: times are absolute
function nz(out, t, dur, type, freq, q, gain, att){   // a filtered noise burst
  const s = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
  s.buffer = fxKit.noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + (att || 0.0008)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random()*0.8); s.stop(t + dur + 0.02);
}
function ping(out, t, f0, dur, gain, f1, type){   // a damped partial
  const o = actx.createOscillator(), g = actx.createGain(); o.type = type || 'sine';
  o.frequency.setValueAtTime(f0, t); if(f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.0008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
}
const jit = (f, amt)=>f*(1 + (Math.random() - 0.5)*amt);
const semis = (f, n)=>f*Math.pow(2, n/12);
let streakTimer = null, toastTimer = null;
function say(text){ const s = $('streaksr'); if(s) s.textContent = text; }   // the one polite status for screen readers
function toast(html, dim){   // a brief note in the header, away from the table's pockets: fades in, then out
  const el = $('hdtoast'); if(!el) return; clearTimeout(toastTimer);
  el.firstChild.innerHTML = html; el.classList.toggle('dim', !!dim); el.classList.remove('show');
  el.hidden = false; void el.offsetWidth; el.classList.add('show'); say(el.textContent);
  toastTimer = setTimeout(()=>{ el.classList.remove('show'); toastTimer = setTimeout(()=>{ el.hidden = true; }, 300); }, 3000);
}
function notice(text){ toast(String(text).replace(/[&<>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))); }   // e.g. an aid locking or unlocking
export function showStreak(cur, endedAt){   // the logo holds the count: the balls fade out and the number fades in on a gold disc; it pops as it grows
  const el = $('hlogo'); if(!el) return; clearTimeout(streakTimer);
  const num = el.querySelector('.lnum'), off = tut.on || settings.streaks === '0';   // lessons, or streaks switched off: just the logo
  const was = el.classList.contains('hot') ? +el.dataset.n || 0 : 0;
  num.classList.remove('pop');
  const clear = ()=>{ el.classList.remove('hot','over'); el.dataset.n = 0; };
  if(off){ clear(); return; }
  if(cur >= STREAK_HOT){
    num.textContent = cur; el.dataset.n = cur; el.classList.toggle('n3', cur > 99);
    el.classList.remove('over'); el.classList.add('hot');
    if(cur !== was){
      if(was >= STREAK_HOT){ void num.offsetWidth; num.classList.add('pop'); }
      say(was < STREAK_HOT && cur === STREAK_HOT ? `On a streak: ${cur} in a row` : `Streak ${cur}`);   // no toast: the count in the logo and the chime say it
    }
  } else if(endedAt){
    num.textContent = endedAt; el.dataset.n = 0; el.classList.toggle('n3', endedAt > 99);
    el.classList.remove('hot'); el.classList.add('over');
    say(`Streak over at ${endedAt}`);
    streakTimer = setTimeout(()=>el.classList.remove('over'), 1500);   // the final count rests on the navy disc, then the balls come back
  } else clear();
}
// A streak shot called right: a little gold burst where the eye is (the pocket, as the ball drops), and a few sparks
// that fly up to the logo, so the eye follows them to the count; the table's edge glows once. About a second, then gone:
// the canvas is made for it and removed after, so the page goes back to idle. Reduced motion: just the glows, no sparks.
export let cheerQ = null, cheerFx = null;
export function cheer(n, first){   // at the call, with the streak's chime: the sparks, the glow and the confetti all at once
  if(tut.on || settings.streaks === '0') return;
  if(cheerQ) clearTimeout(cheerQ.at);
  cheerQ = {n, first, s: S.shot};
  cheerGo();
}
// a small handful of confetti out of the streak in the logo: it bursts, drifts down the screen a little and fades (about 2 s)
export function confetti(el, n, first){
  if(!el) return; const r = el.getBoundingClientRect(); if(!r.width) return;
  const x0 = r.left + r.width/2, y0 = r.top + r.height/2, tier = (n >= 10) + (n >= 15) + (n >= 20);
  const count = Math.round(Math.min(36, (first ? 30 : 20) + 4*tier)*(IS_PHONE ? .8 : 1));
  const cv = document.createElement('canvas'), dpr = Math.min(2, window.devicePixelRatio || 1), W = innerWidth, H = innerHeight;
  cv.className = 'cheerfx'; cv.style.zIndex = 46; cv.width = W*dpr; cv.height = H*dpr; document.body.appendChild(cv);
  const g = cv.getContext && cv.getContext('2d'); if(!g){ cv.remove(); return; } g.scale(dpr, dpr);
  const COLS = ['#f0bf34', '#f6cd55', '#c9971c', '#f2ead8', '#ffffff'];
  const bits = Array.from({length: count}, ()=>{ const a = -Math.PI/2 + (Math.random() - .5)*Math.PI*1.5, v = 140 + Math.random()*170;
    return {x: x0, y: y0, vx: Math.cos(a)*v + (x0 < W/2 ? 50 : -50), vy: Math.sin(a)*v, w: 4 + Math.random()*4, h: 2 + Math.random()*2.5,
      rot: Math.random()*Math.PI, vr: (Math.random() - .5)*14, sway: Math.random()*Math.PI*2, life: 1.5 + Math.random()*.6, c: COLS[Math.floor(Math.random()*COLS.length)]}; });
  const t0 = performance.now(); let last = t0;
  const frame = now => {
    const t = (now - t0)/1000, dt = Math.min(.05, (now - last)/1000); last = now; g.clearRect(0, 0, W, H); let alive = 0;
    for(const b of bits){
      if(t > b.life) continue; alive++;
      const f = Math.exp(-1.8*dt); b.vx *= f; b.vy = b.vy*f + 380*dt; b.vy = Math.min(b.vy, 170);   // falls, but flutters rather than drops
      b.x += (b.vx + Math.sin(t*6 + b.sway)*22)*dt; b.y += b.vy*dt; b.rot += b.vr*dt;
      g.globalAlpha = Math.min(1, (b.life - t)/(b.life*.4)); g.fillStyle = b.c;
      g.save(); g.translate(b.x, b.y); g.rotate(b.rot); g.scale(1, Math.abs(Math.cos(t*5 + b.sway)) + .25); g.fillRect(-b.w/2, -b.h/2, b.w, b.h); g.restore();
    }
    if(alive) requestAnimationFrame(frame); else cv.remove();
  };
  requestAnimationFrame(frame);
}
function cheerKick(el, cls, ms){ if(!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(()=>el.classList.remove(cls), ms); }
function cheerStop(){ if(cheerFx){ cancelAnimationFrame(cheerFx.raf); cheerFx.cv.remove(); cheerFx = null; } }
export function cheerGo(){   // at the call: the table's edge glows, the logo pulses and confetti bursts out of the count
  const q = cheerQ; cheerQ = null; if(!q) return;
  clearTimeout(q.at); cheerStop();
  if(tut.on || settings.streaks === '0') return;
  const logo = $('hlogo'), box = document.querySelector('.table-box');
  const calm = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  cheerKick(box, 'cheer', 950); cheerKick(logo, 'cheer', 950);
  if(!calm) confetti(logo, q.n, q.first);
}
// calling the shot: soft mallet tones in a hall
function mallet(o, t, f, g, dur, damp){   // partials near 1:4:10, each fading at its own rate, a slow tremolo
  const tr = actx.createGain(), lfo = actx.createOscillator(), lg = actx.createGain(), end = t + dur;
  lfo.frequency.value = 5.4; lg.gain.value = damp ? 0.05 : 0.14; tr.gain.value = 1 - lg.gain.value; lfo.connect(lg); lg.connect(tr.gain);
  [[1, 1, dur], [3.98, 0.3, dur*0.3], [9.86, 0.09, dur*0.11]].forEach(([r, a, d])=>{
    const os = actx.createOscillator(), ga = actx.createGain(); os.frequency.value = f*r;
    ga.gain.setValueAtTime(0.0001, t); ga.gain.exponentialRampToValueAtTime(g*a, t + 0.003); ga.gain.exponentialRampToValueAtTime(0.0001, t + d);
    os.connect(ga); ga.connect(tr); os.start(t); os.stop(t + d + 0.05);
  });
  nz(tr, t, 0.006, 'lowpass', 2500, 0.7, g*0.12);   // the mallet's felt
  tr.connect(o); lfo.start(t); lfo.stop(end + 0.05);
}
function padSwell(o, t, freqs, dur, g){   // warm detuned pad, low-passed, swelling in
  const lp = actx.createBiquadFilter(), a = actx.createGain(), end = t + dur;
  lp.type = 'lowpass'; lp.Q.value = 0.5; lp.frequency.setValueAtTime(380, t); lp.frequency.exponentialRampToValueAtTime(1500, t + dur*0.4); lp.frequency.exponentialRampToValueAtTime(500, end);
  a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(g, t + 0.7); a.gain.setValueAtTime(g, t + dur*0.45); a.gain.linearRampToValueAtTime(0, end);
  freqs.forEach(f=>[-9, 0, 8].forEach(cents=>{
    const os = actx.createOscillator(); os.type = 'sawtooth'; os.frequency.value = f; os.detune.value = cents;
    os.connect(lp); os.start(t); os.stop(end + 0.05);
  }));
  lp.connect(a); a.connect(o);
}
function fbOut(level){ const g = actx.createGain(); g.gain.value = level; g.connect(hallBus()); return g; }
export function playSound(kind, streak){
  if(settings.sound === '0') return;
  if(settings.streaks === '0' && (kind === 'streak' || kind === 'streakEnd')) return;   // nor its chimes
  try{
    sfx(); const t0 = actx.currentTime + 0.01;
    if(kind === 'made'){ const o = fbOut(0.5); mallet(o, t0, 587.33, 0.42, 1.1); mallet(o, t0 + 0.085, 880, 0.38, 1.4); }
    else if(kind === 'miss'){   // neutral: one soft, open fifth, damped, no fall
      const o = fbOut(0.5); mallet(o, t0, 392, 0.6, 0.6, true); mallet(o, t0 + 0.012, 587.33, 0.36, 0.45, true);
    }
    else if(kind === 'streak'){   // a rising arpeggio, a whole step higher for each shot of the streak, up to three
      const o = fbOut(0.45), r = semis(587.33, 2*Math.max(0, Math.min(3, (streak || 6) - 6)));
      [0, 4, 7, 12].forEach((n, i)=>mallet(o, t0 + i*0.07, semis(r, n), i === 3 ? 0.38 : 0.3, i === 3 ? 1.5 : 0.7));
    }
    else if(kind === 'streakEnd'){   // a damped falling triad
      const o = fbOut(0.45);
      [[0, 7], [0.11, 4], [0.22, 0]].forEach(([dt, n], i)=>mallet(o, t0 + dt, semis(440, n), 0.3, i === 2 ? 1.1 : 0.6, true));
    }
    else if(kind === 'levelup'){   // a rising run that rings, over a pad swelling in (about 3 s)
      const o = fbOut(0.45), C = 523.25;
      [[0, 0], [0.11, 4], [0.22, 7], [0.33, 11], [0.44, 14]].forEach(([dt, n], i)=>mallet(o, t0 + dt, semis(C, n), 0.3, i === 4 ? 2.2 : 0.9));
      mallet(o, t0 + 0.44, semis(C, 7), 0.22, 2.2);
      padSwell(o, t0 + 0.2, [130.81, 196, 329.63, 493.88, 587.33], 3.2, 0.05);
    }
  }catch(e){}
}
// ---------- button feedback: a quiet, dry click on a press, and a tiny tap where the phone can vibrate ----------
// tap: a button; toggle/toggleOff: a setting switched on/off (or to a choice); tick: a slider, tip or speed step;
// nope: a locked button; open/close: a menu; back: the lesson's Back. Dry (no reverb), quieter than the game's own sounds.
let uiTickAt = 0;
const UI_BUZZ = {tap: 8, back: 8, toggle: 10, toggleOff: 10, tick: 4, nope: [12, 50, 12], open: 10, close: 8};
const UI_LEVEL = {tap: 4, back: 5, toggle: 1.3, toggleOff: 1.3, tick: 8, nope: 1, open: 2, close: 2};
function uiClick(o, t, f, q, g, dur, body){   // a band of noise, with a whisper of body under it
  nz(o, t, dur, 'bandpass', f, q, g, 0.0004);
  if(body) ping(o, t, body, 0.018, g*0.18);
}
function knock(o, t, g){ nz(o, t, 0.035, 'lowpass', 700, 0.8, g, 0.001); ping(o, t, 190, 0.045, g*0.6, 160); }
function swish(o, t, f0, f1, g){   // noise swept through a band: a menu sliding open or shut
  const s = actx.createBufferSource(), f = actx.createBiquadFilter(), a = actx.createGain(), d = 0.16;
  s.buffer = fxKit.noise; f.type = 'bandpass'; f.Q.value = 1.3;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + d);
  a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(g, t + d*0.55); a.gain.exponentialRampToValueAtTime(0.0001, t + d);
  s.connect(f); f.connect(a); a.connect(o); s.start(t, Math.random()*0.5); s.stop(t + d + 0.02);
}
export function uiSound(kind, pitch){   // pitch: 0..1, for ticks (a slider's position)
  const now = performance.now();
  if(kind === 'tick'){ if(now - uiTickAt < 60) return; uiTickAt = now; }   // drags: at most a tick every 60 ms
  if(settings.haptic !== '0' && navigator.vibrate) try{ navigator.vibrate(UI_BUZZ[kind] || 8); }catch(e){}
  if(settings.sound === '0' || settings.uiSound === '0') return;
  try{
    const F = sfx();
    if(!F.ui){ F.ui = actx.createGain(); F.ui.gain.value = 0.42; F.ui.connect(masterOut()); }
    const o = actx.createGain(), t = actx.currentTime + 0.005; o.gain.value = UI_LEVEL[kind] || 1; o.connect(F.ui);
    if(kind === 'tap') uiClick(o, t, 3100, 1.8, 0.32, 0.012, 760);
    else if(kind === 'back') uiClick(o, t, 2300, 1.8, 0.3, 0.012, 560);
    else if(kind === 'toggle'){ uiClick(o, t, 2400, 2.2, 0.26, 0.01, 620); uiClick(o, t + 0.045, 3400, 2.2, 0.26, 0.01, 820); }
    else if(kind === 'toggleOff'){ uiClick(o, t, 3400, 2.2, 0.26, 0.01, 820); uiClick(o, t + 0.045, 2400, 2.2, 0.26, 0.01, 620); }
    else if(kind === 'tick') uiClick(o, t, 1800 + 2600*(pitch ?? 0.5), 3, 0.17, 0.006);
    else if(kind === 'nope'){ knock(o, t, 0.3); knock(o, t + 0.085, 0.24); }
    else if(kind === 'open') swish(o, t, 700, 3200, 0.1);
    else if(kind === 'close') swish(o, t, 3200, 700, 0.1);
  }catch(e){}
}
// one listener for every button press (capture, so a handler that stops the click can't hide it). It plays after the
// click's own work, so it hears the new state: a menu now open or shut, the Sound setting just switched.
const UI_SILENT = '#answers, #lookbtn, #speedbar, #tippad';   // the answers have their own sounds; the pad, bar and eye sound on press
const UI_OPEN = {cog: 1, help: 1, badge: 1}, UI_CLOSE = {menuclose: 1, tutmenuclose: 1, progclose: 1, coachskip: 1, styleclose: 1};
export function wireButtonSounds(){
  document.addEventListener('click', e=>{
    const t = e.target instanceof Element ? e.target : null; if(!t) return;
    if(t.matches('input[type=color]')){ uiSound('open'); return; }
    if(t.classList.contains('menu')){ setTimeout(()=>uiSound('close'), 0); return; }   // a tap on a menu's backdrop shuts it
    const b = t.closest('button, [role=button]'); if(!b || b.disabled || b.closest(UI_SILENT)) return;
    if(b.classList.contains('locked') || b.getAttribute('aria-disabled') === 'true'){ uiSound('nope'); return; }
    const id = b.id, set = b.dataset.set;
    setTimeout(()=>{
      if(UI_OPEN[id]) uiSound('open');
      else if(UI_CLOSE[id]) uiSound('close');
      else if(id === 'plchip') uiSound($('plmenu').hidden ? 'close' : 'open');
      else if(id === 'stylebtn') uiSound($('stylemenu').hidden ? 'close' : 'open');
      else if(b.classList.contains('styleopt')) uiSound('toggle');
      else if(id === 'coachback') uiSound('back');
      else if(set) uiSound(['0', 'off'].includes(b.dataset.val) ? 'toggleOff' : 'toggle');
      else if(b.dataset.stab || b.dataset.sub || b.dataset.tab || b.dataset.fv || /^task-|^track-/.test(id)) uiSound('toggle');
      else uiSound('tap');
    }, 0);
  }, true);
  // sliders tick as they move, a little higher toward the top of their range; a colour picked taps
  document.addEventListener('input', e=>{ const t = e.target; if(t && t.type === 'range'){ const lo = +t.min || 0, hi = +t.max || 100; uiSound('tick', (t.value - lo)/((hi - lo) || 1)); } }, true);
  document.addEventListener('change', e=>{ const t = e.target; if(t && t.type === 'color') uiSound('tap'); }, true);
}
// ---------- table sounds: cue strike, ball contact, the drop, the rail (synthesized, no files) ----------
// v: 0.7 slow, 1 medium, 1.25 firm. Harder is louder and brighter.
const SFX = {
  click(o, t, v){   // ball on ball: the original's ringing smack (a pitched knock and its overtones), with a crisp snap on top
    const b = Math.max(0, Math.min(1, (v - 0.6)/0.65)), L = Math.pow(v, 1.3);
    ping(o, t, jit(1175, 0.02), 0.12, 0.5*L);
    ping(o, t, jit(1760, 0.02), 0.08, 0.27*L);
    ping(o, t, jit(2349, 0.02), 0.03, 0.11*L, 0, 'triangle');
    ping(o, t, jit(3150, 0.03), 0.02, (0.04 + 0.08*b)*L);   // harder is brighter
    nz(o, t, 0.004, 'highpass', 2500, 0.7, 0.15*L);
  },
  cue(o, t, v){   // the leather tip: a soft, dull "tok"
    const L = Math.pow(v, 1.3);
    nz(o, t, 0.02, 'lowpass', 1500 + 700*(v - 0.7), 0.7, 0.4*L, 0.0015);
    ping(o, t, 560, 0.05, 0.22*L, 470);
    ping(o, t, 1150, 0.02, 0.05*L);
    ping(o, t, 200, 0.035, 0.14*L, 150);
  },
  drop(o, t, v){   // a thud into the pocket, then the ball settling
    const L = Math.min(1.2, v);
    nz(o, t, 0.01, 'bandpass', 2400, 1.4, 0.1*L);                 // grazing the leather
    ping(o, t, 125, 0.17, 0.5*L, 72); nz(o, t, 0.08, 'lowpass', 480, 0.8, 0.32*L, 0.002);
    [[0.13, 270, 0.2], [0.22, 320, 0.11], [0.28, 250, 0.055]].forEach(([dt, f, a])=>{
      ping(o, t + dt, jit(f, 0.05), 0.05, a*L, f*0.85); nz(o, t + dt, 0.02, 'bandpass', 950, 2, a*0.45*L);
    });
  },
  rail(o, t, v){   // the rubber cushion, with a little of the wooden rail
    const L = Math.min(1.25, v);
    ping(o, t, 150, 0.11, 0.45*L, 95); nz(o, t, 0.06, 'lowpass', 650, 0.8, 0.32*L, 0.002);
    nz(o, t, 0.025, 'bandpass', 1100, 4, 0.12*L); ping(o, t, 640, 0.035, 0.05*L);
  },
  jaw(o, t, v){   // rattling between the points: knocks that die away
    const L = Math.min(1.25, v);
    [[0, 1, 430], [0.07, 0.55, 365], [0.125, 0.3, 470]].forEach(([dt, a, f])=>{
      ping(o, t + dt, jit(f, 0.04), 0.06, 0.4*a*L, f*0.8);
      nz(o, t + dt, 0.03, 'bandpass', 1300, 2.5, 0.28*a*L);
      ping(o, t + dt, jit(1950, 0.05), 0.014, 0.05*a*L);
    });
  },
};
const SFX_LEVEL = {click: 1, cue: 5.5, drop: 1.6, rail: 4, jaw: 2};   // each sound's level, balanced by ear and meter
// schedule a shot's sounds on one bus (times in seconds from now), so they can be cut if the shot is skipped
export function tableSounds(plan, vol){
  if(settings.sound === '0' || vol === 0) return null;   // a streak chime plays alone
  try{
    sfx();
    const bus = actx.createGain(); bus.gain.value = 0.85*(vol ?? 1); bus.connect(roomBus());
    const lead = (actx.outputLatency || actx.baseLatency || 0) + 0.015;   // what the speaker adds, taken off so sound lands with the picture
    plan.forEach(([t, kind, v])=>{
      const g = actx.createGain(); g.gain.value = SFX_LEVEL[kind]; g.connect(bus);
      SFX[kind](g, actx.currentTime + Math.max(0, t - lead), v ?? 1);
    });
    return bus;
  }catch(e){ return null; }
}
export function cutSounds(bus){ if(!bus || !actx) return; try{ bus.gain.setTargetAtTime(0, actx.currentTime, 0.01); setTimeout(()=>{ try{ bus.disconnect(); }catch(e){} }, 250); }catch(e){} }
const SPEED_VOL = {slow:.7, medium:1, firm:1.25};
// the sounds of a shot: two only, the contact and then what the object ball does (pocket, jaw or rail)
export function shotPlan(s, oc, T1, tOb, tCb, cbRail, jawHit){
  const v = SPEED_VOL[s.speed] || 1;
  return [[T1, 'click', v], [T1 + tOb, oc.made ? 'drop' : jawHit ? 'jaw' : 'rail', v]];
}
