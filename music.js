// Halfball: background music. Three small loops played live with Web Audio (no audio files):
// Parlor (swing jazz on brushes, vibes lead), Smoke (slow lo-fi, electric piano), Felt (bossa nova on nylon guitar).
// Each is an 8-bar head, written out, looped as 16 bars: the second time the tune rests for four bars.
// With the Disco ball set on, the same three stations play three disco tunes instead: Mirror Ball, Strut and Orbit.
(function(root){
'use strict';
let ctx = null, out = null, mix = null, send = null, noise = null, metal = null, metalIn = null, metalOsc = null, crackle = null;
let timer = 0, track = null, nextT = 0, step = 0, vol = 0.5, tok = 0, sleepTimer = 0, away = false;
let style = 'normal', wantStyle = 'normal';   // 'disco': each station plays its disco tune instead (see DISCO)
const KS = {};
const LEVEL = 0.3;
const mtof = m => 440*Math.pow(2, (m - 69)/12);
const hv = s => 0.9 + 0.1*Math.abs(Math.sin(s*12.9898)*43758.5453 % 1);   // fixed per step, so loops repeat exactly

function impulse(secs, decayPow, bright){   // a reverb: stereo decaying noise that darkens as it fades
  const sr = ctx.sampleRate, n = Math.floor(sr*secs), pre = Math.floor(sr*0.012), b = ctx.createBuffer(2, n, sr);
  for(let ch = 0; ch < 2; ch++){
    const d = b.getChannelData(ch); let lp = 0;
    for(let i = pre; i < n; i++){
      const x = (i - pre)/(n - pre), k = bright*(1 - x) + 0.04;
      lp += k*((Math.random()*2 - 1) - lp);
      d[i] = lp*Math.pow(1 - x, decayPow);
    }
  }
  return b;
}
function ensure(){
  if(ctx) return true;
  const AC = root.AudioContext || root.webkitAudioContext; if(!AC) return false;
  // 'playback': music doesn't need a fast reaction, and bigger audio buffers wake a phone's CPU less often
  try{ ctx = new AC({latencyHint: 'playback'}); }catch(e){ ctx = new AC(); }
  out = ctx.createGain(); out.gain.value = 0;
  mix = ctx.createGain(); send = ctx.createGain();
  const rev = ctx.createConvolver(); rev.buffer = impulse(2.6, 2.6, 0.5);
  const wet = ctx.createGain(); wet.gain.value = 0.32;
  send.connect(rev); rev.connect(wet); wet.connect(out); mix.connect(out);
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 60; hp.Q.value = 0.7;   // nothing a phone can't play
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -16; lim.knee.value = 6; lim.ratio.value = 14; lim.attack.value = 0.003; lim.release.value = 0.25;
  out.connect(hp); hp.connect(lim); lim.connect(ctx.destination);
  noise = ctx.createBuffer(1, ctx.sampleRate*2, ctx.sampleRate);
  const d = noise.getChannelData(0); for(let i = 0; i < d.length; i++) d[i] = Math.random()*2 - 1;
  // the ride cymbal's metal: six inharmonic square waves, high-passed, into one gate (the waves run only while a track
  // with a ride plays: see metalOn)
  metal = ctx.createGain(); metal.gain.value = 0;
  const bp = metalIn = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 8200; bp.Q.value = 0.5;
  const hp2 = ctx.createBiquadFilter(); hp2.type = 'highpass'; hp2.frequency.value = 6200;
  bp.connect(hp2); hp2.connect(metal); route(metal, 0.3);
  return true;
}
function metalOn(){
  if(metalOsc) return;
  metalOsc = [205.3, 304.4, 369.6, 522.7, 540, 800].map(f=>{
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.value = f*1.83; g.gain.value = 0.16;
    o.connect(g); g.connect(metalIn); o.start(); return o;
  });
}
function metalOff(){ if(metalOsc){ metalOsc.forEach(o=>{ try{ o.stop(); o.disconnect(); }catch(e){} }); metalOsc = null; } }
const asleep = () => ctx && ctx.state !== 'running' && ctx.state !== 'closed';   // 'suspended', or iOS's 'interrupted' (a call, an alarm, Siri)
function wake(){ if(asleep()){ try{ const p = ctx.resume(); if(p && p.catch) p.catch(()=>{}); }catch(e){} } }
function route(node, wet){
  node.connect(mix);
  if(wet){ const s = ctx.createGain(); s.gain.value = wet; node.connect(s); s.connect(send); }
}
function env(g, t, peak, att, dur){   // quick attack, exponential fall
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + att);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}
function hiss(t, dur, type, freq, q, v, att, wet){   // shaped noise: brushes, shakers, clicks
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
  env(g, t, v, att || 0.002, dur);
  s.connect(f); f.connect(g); route(g, wet || 0); s.start(t, Math.random()*1.5); s.stop(t + dur + 0.02);
}

// ---------- instruments ----------
function epiano(t, m, dur, v, wet){   // FM electric piano: a 1:1 modulator for the bark, a fast high one for the tine, tremolo
  const f = mtof(m), car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain();
  const tine = ctx.createOscillator(), tg = ctx.createGain(), amp = ctx.createGain(), tr = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
  car.frequency.value = f; mod.frequency.value = f; tine.frequency.value = f*14;
  mg.gain.setValueAtTime(f*(0.9 + 1.8*v), t); mg.gain.exponentialRampToValueAtTime(f*0.18, t + 0.6);   // the bark fades into a round tone
  tg.gain.setValueAtTime(f*0.5*v, t); tg.gain.exponentialRampToValueAtTime(f*0.005, t + 0.05);
  mod.connect(mg); mg.connect(car.frequency); tine.connect(tg); tg.connect(car.frequency);
  const end = t + dur + 0.45;
  amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(0.11*v, t + 0.004);
  amp.gain.exponentialRampToValueAtTime(0.045*v, t + Math.max(0.05, Math.min(0.7, dur)));
  amp.gain.exponentialRampToValueAtTime(0.0001, end);
  lfo.frequency.value = 4.6; lg.gain.value = 0.16; tr.gain.value = 0.84; lfo.connect(lg); lg.connect(tr.gain);
  car.connect(amp); amp.connect(tr); route(tr, wet ?? 0.25);
  [car, mod, tine, lfo].forEach(o=>{ o.start(t); o.stop(end + 0.05); });
}
function bass(t, m, dur, v){   // upright: a pluck, then a body whose filter closes
  const f = mtof(m), o = ctx.createOscillator(), s = ctx.createOscillator(), sg = ctx.createGain(), lp = ctx.createBiquadFilter(), amp = ctx.createGain();
  o.type = 'triangle'; o.frequency.value = f; s.frequency.value = f*2; sg.gain.value = 0.22;
  lp.type = 'lowpass'; lp.Q.value = 1.2; lp.frequency.setValueAtTime(1100 + 700*v, t); lp.frequency.exponentialRampToValueAtTime(380, t + 0.2);
  amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(0.5*v, t + 0.006);
  amp.gain.exponentialRampToValueAtTime(0.2*v, t + 0.14); amp.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
  o.connect(lp); s.connect(sg); sg.connect(lp); lp.connect(amp); route(amp, 0.06);
  hiss(t, 0.025, 'bandpass', 900, 1.4, 0.07*v, 0.001);   // the finger on the string
  [o, s].forEach(x=>{ x.start(t); x.stop(t + dur + 0.12); });
}
function ride(t, v){
  metal.gain.cancelScheduledValues(t); metal.gain.setValueAtTime(0.09*v, t); metal.gain.setTargetAtTime(0, t + 0.002, 0.28);
  hiss(t, 0.02, 'highpass', 7000, 0.7, 0.03*v, 0.001, 0.2);   // the stick
}
function brush(t, dur, v){ hiss(t, dur, 'bandpass', 3000, 0.6, v, dur*0.45, 0.25); }   // a swish
function slap(t, v){ hiss(t, 0.14, 'bandpass', 2400, 0.7, v, 0.004, 0.3); }            // a brush on the snare
function kick(t, v){   // soft, felt-beater kick
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(88, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.11);
  env(g, t, 0.42*v, 0.004, 0.3); o.connect(g); route(g, 0);
  o.start(t); o.stop(t + 0.32);
  hiss(t, 0.012, 'lowpass', 1300, 0.7, 0.05*v, 0.001);
}
function stick(t, v){   // a soft cross-stick for the bossa clave
  const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 1180;
  env(g, t, 0.05*v, 0.001, 0.045); o.connect(g); route(g, 0.25); o.start(t); o.stop(t + 0.06);
  hiss(t, 0.03, 'bandpass', 1900, 5, 0.12*v, 0.001, 0.25);
}
function snare(t, v){   // a dusty brushed snare
  hiss(t, 0.22, 'bandpass', 1900, 0.8, 0.07*v, 0.003, 0.3);
  const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(170, t + 0.06);
  env(g, t, 0.07*v, 0.002, 0.08); o.connect(g); route(g, 0.1); o.start(t); o.stop(t + 0.1);
}
function vib(t, m, dur, v){   // vibraphone: partials near 1:4:10 decaying at different rates, a slow motor tremolo
  const f = mtof(m), tr = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain(), end = t + Math.max(1.4, dur + 0.9);
  lfo.frequency.value = 5.2; lg.gain.value = 0.22; tr.gain.value = 0.78; lfo.connect(lg); lg.connect(tr.gain);
  [[1, 1, end - t], [3.98, 0.26, 0.5], [9.9, 0.07, 0.15]].forEach(([r, a, d])=>{
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f*r;
    env(g, t, 0.13*v*a, 0.003, d); o.connect(g); g.connect(tr); o.start(t); o.stop(t + d + 0.05);
  });
  hiss(t, 0.008, 'lowpass', 3000, 0.7, 0.02*v, 0.001, 0.4);   // the mallet
  route(tr, 0.45); lfo.start(t); lfo.stop(end + 0.05);
}
function ksNote(m){   // Karplus-Strong nylon string, computed once per note
  if(KS[m]) return KS[m];
  const sr = ctx.sampleRate, f = mtof(m), N = Math.max(2, Math.round(sr/f - 0.5)), len = Math.floor(sr*1.8);
  const b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0), rho = Math.pow(0.25, 1/(f*1.6));
  let lp = 0; for(let i = 0; i < N; i++){ lp += 0.45*((Math.random()*2 - 1) - lp); d[i] = lp; }   // a soft thumb, not a pick
  let mean = 0; for(let i = 0; i < N; i++) mean += d[i]/N; for(let i = 0; i < N; i++) d[i] -= mean;
  for(let i = N; i < len; i++) d[i] = rho*0.5*(d[i - N] + (i - N - 1 >= 0 ? d[i - N - 1] : 0));
  let pk = 0; for(let i = 0; i < len; i++) pk = Math.max(pk, Math.abs(d[i]));
  const fade = Math.floor(sr*0.05);
  for(let i = 0; i < len; i++) d[i] = d[i]/(pk || 1)*0.6*(i > len - fade ? (len - i)/fade : 1);
  return KS[m] = {buf: b, rate: f*(N + 0.5)/sr, len: len/sr};   // the loop is N + 1/2 samples long: tune it with the rate
}
function guitar(t, m, dur, v, wet){
  const k = ksNote(m), s = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = k.buf; s.playbackRate.value = k.rate;
  lp.type = 'lowpass'; lp.frequency.value = 2600 + 1200*v; lp.Q.value = 0.5;
  const stopAt = t + Math.min(k.len - 0.05, dur + 0.25);
  g.gain.setValueAtTime(0.32*v, t); g.gain.setValueAtTime(0.32*v, Math.max(t, stopAt - 0.2)); g.gain.linearRampToValueAtTime(0, stopAt);
  s.connect(lp); lp.connect(g); route(g, wet ?? 0.3); s.start(t); s.stop(stopAt + 0.02);
}
function pad(t, notes, dur, v){   // a warm detuned pad
  const lp = ctx.createBiquadFilter(), g = ctx.createGain(), end = t + dur + 1.2;
  lp.type = 'lowpass'; lp.Q.value = 0.4; lp.frequency.setValueAtTime(450, t);
  lp.frequency.linearRampToValueAtTime(1000, t + dur*0.5); lp.frequency.linearRampToValueAtTime(550, end);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.02*v, t + 0.9); g.gain.setValueAtTime(0.02*v, t + dur); g.gain.linearRampToValueAtTime(0, end);
  notes.forEach(m=>[-8, 7].forEach(c=>{
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = c;
    o.connect(lp); o.start(t); o.stop(end + 0.05);
  }));
  lp.connect(g); route(g, 0.5);
}
// disco kit: a punchier kick, an open hat, a hand clap, and a light string pad
function dkick(t, v){
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.09);
  env(g, t, 0.36*v, 0.003, 0.26); o.connect(g); route(g, 0);
  o.start(t); o.stop(t + 0.28);
  hiss(t, 0.01, 'lowpass', 2500, 0.7, 0.06*v, 0.001);
}
function ohat(t, v){ hiss(t, 0.2, 'highpass', 7500, 0.7, 0.032*v, 0.004, 0.15); }
function chat(t, v){ hiss(t, 0.03, 'highpass', 8500, 0.7, 0.012*v, 0.001, 0.05); }
function clap(t, v){   // three quick slaps and a short tail
  [0, 0.011, 0.023].forEach(o=>hiss(t + o, 0.02, 'bandpass', 1300, 1.1, 0.06*v, 0.001, 0.2));
  hiss(t + 0.03, 0.16, 'bandpass', 1500, 0.9, 0.05*v, 0.003, 0.35);
}
function strings(t, notes, dur, v){   // a light string section: detuned saws, a slow bow, a gentle swell
  const lp = ctx.createBiquadFilter(), g = ctx.createGain(), end = t + dur + 0.5;
  lp.type = 'lowpass'; lp.Q.value = 0.5; lp.frequency.setValueAtTime(1400, t); lp.frequency.linearRampToValueAtTime(2600, t + dur*0.6);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.011*v, t + 0.25); g.gain.setValueAtTime(0.011*v, t + dur); g.gain.linearRampToValueAtTime(0, end);
  notes.forEach(m=>[-9, 9].forEach(c=>{
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m + 12); o.detune.value = c;
    o.connect(lp); o.start(t); o.stop(end + 0.05);
  }));
  lp.connect(g); route(g, 0.5);
}
// more disco voices: a synth bass, a slap bass, a filtered pluck (clav, guitar chops), string stabs, two synth leads, a bell, a pad sweep
function sbass(t, m, dur, v, bright){   // a saw with a sine under it, through a filter that snaps shut
  const f = mtof(m), o = ctx.createOscillator(), sub = ctx.createOscillator(), sg = ctx.createGain(), lp = ctx.createBiquadFilter(), amp = ctx.createGain();
  o.type = 'sawtooth'; o.frequency.value = f; sub.frequency.value = f; sg.gain.value = 0.6;
  lp.type = 'lowpass'; lp.Q.value = 2.5; lp.frequency.setValueAtTime(260 + 2200*bright*v, t); lp.frequency.exponentialRampToValueAtTime(240, t + 0.12);
  amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(0.3*v, t + 0.004); amp.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
  o.connect(lp); sub.connect(sg); sg.connect(lp); lp.connect(amp); route(amp, 0.04);
  [o, sub].forEach(x=>{ x.start(t); x.stop(t + dur + 0.08); });
}
function slapb(t, m, dur, v, pop){   // a thumbed note, or a popped one: brighter, with the snap of the string
  sbass(t, m, dur, v, pop ? 1.1 : 0.55);
  hiss(t, pop ? 0.02 : 0.012, 'bandpass', pop ? 3200 : 1400, 1.2, (pop ? 0.09 : 0.05)*v, 0.001);
}
function pluck(t, m, dur, v, type, cut, q, wet){   // one oscillator through a resonant filter that closes as the note dies
  const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = type; o.frequency.value = mtof(m);
  lp.type = 'lowpass'; lp.Q.value = q; lp.frequency.setValueAtTime(cut, t); lp.frequency.exponentialRampToValueAtTime(Math.max(300, cut*0.2), t + dur);
  env(g, t, v, 0.002, dur); o.connect(lp); lp.connect(g); route(g, wet);
  o.start(t); o.stop(t + dur + 0.03);
}
function clav(t, m, dur, v){ pluck(t, m, Math.min(0.3, dur + 0.06), 0.07*v, 'square', 4200, 7, 0.15); }
function chop(t, notes, v, open){   // a muted guitar scratch; open, the chord rings through for a moment
  hiss(t, 0.03, 'bandpass', 2300, 1.6, 0.045*v, 0.001, 0.1);
  if(open) notes.forEach((m, i)=>pluck(t + i*0.006, m + 12, 0.07, 0.022*v, 'sawtooth', 3000, 3, 0.12));
}
function stab(t, notes, v){   // a short string stab: two detuned saws a note, bowed hard and let go
  const lp = ctx.createBiquadFilter(), g = ctx.createGain(); lp.type = 'lowpass'; lp.Q.value = 0.6; lp.frequency.value = 3200;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.014*v, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  notes.forEach(m=>[-10, 10].forEach(c=>{
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m + 12); o.detune.value = c;
    o.connect(lp); o.start(t); o.stop(t + 0.33);
  }));
  lp.connect(g); route(g, 0.4);
}
function synlead(t, m, dur, v, type, cut, peak, wet){   // a held synth line with a late vibrato
  const f = mtof(m), lp = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain(), end = t + dur + 0.15;
  lp.type = 'lowpass'; lp.Q.value = 1; lp.frequency.value = cut;
  lfo.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f*0.006, t + Math.min(0.5, dur));
  lfo.connect(lg);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak*v, t + 0.015); g.gain.setValueAtTime(peak*v*0.85, t + Math.max(0.02, dur*0.9));
  g.gain.linearRampToValueAtTime(0, end);
  const os = (type === 'sawtooth' ? [-7, 7] : [0]).map(c=>{
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = c;
    lg.connect(o.frequency); o.connect(lp); return o;
  });
  lp.connect(g); route(g, wet);
  os.concat(lfo).forEach(o=>{ o.start(t); o.stop(end + 0.05); });
}
function bell(t, m, v){   // a small glassy bell for the arpeggio
  const f = mtof(m);
  [[1, 1, 0.4], [3, 0.25, 0.12]].forEach(([r, a, d])=>{
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f*r;
    env(g, t, 0.035*v*a, 0.002, d); o.connect(g); route(g, 0.6); o.start(t); o.stop(t + d + 0.05);
  });
}
function sweep(t, notes, dur, v){   // a pad whose filter opens slowly across the chord, then falls back
  const lp = ctx.createBiquadFilter(), g = ctx.createGain(), end = t + dur + 0.6;
  lp.type = 'lowpass'; lp.Q.value = 3; lp.frequency.setValueAtTime(300, t);
  lp.frequency.exponentialRampToValueAtTime(2600, t + dur*0.75); lp.frequency.exponentialRampToValueAtTime(500, end);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.012*v, t + 0.4); g.gain.setValueAtTime(0.012*v, t + dur); g.gain.linearRampToValueAtTime(0, end);
  notes.forEach(m=>[-8, 8].forEach(c=>{
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = c;
    o.connect(lp); o.start(t); o.stop(end + 0.05);
  }));
  lp.connect(g); route(g, 0.55);
}
// a disco tune's chords: a bar holds one chord, or two (first half, second half)
const half = (x, e) => Array.isArray(x) ? x[e < 4 ? 0 : 1] : x;
const chordOn = (T, bar, e) => e === 0 || (Array.isArray(T.chords[bar]) && e === 4);   // a new chord starts on this step
const chordLen = (T, bar, d8) => d8*(Array.isArray(T.chords[bar]) ? 4 : 8);
function setStyle(st){
  wantStyle = st === 'disco' ? 'disco' : 'normal';
  if(!track){ style = wantStyle; if(ctx) metalFor(); }   // nothing on: take it now; a station on: at the next bar
}
function metalFor(){ if(track === 'parlor' && style !== 'disco') metalOn(); else metalOff(); }   // only Parlor's swing has a ride cymbal
function startCrackle(){   // very faint vinyl: sparse pops on a hush of noise, looped
  stopCrackle();
  const sr = ctx.sampleRate, len = sr*5, b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0);
  for(let i = 0; i < len; i++) d[i] = (Math.random()*2 - 1)*0.01;
  for(let i = 0; i < len; i++) if(Math.random() < 9/sr){ const a = (0.25 + Math.random()*0.75)*(Math.random() < 0.5 ? -1 : 1); for(let j = 0; j < 24 && i + j < len; j++) d[i + j] += a*Math.exp(-j/3); }
  const s = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = b; s.loop = true; hp.type = 'highpass'; hp.frequency.value = 1200; lp.type = 'lowpass'; lp.frequency.value = 6500; g.gain.value = 0.05;
  s.connect(hp); hp.connect(lp); lp.connect(g); g.connect(mix); s.start();
  crackle = s;
}
function stopCrackle(){ if(crackle){ try{ crackle.stop(); }catch(e){} crackle = null; } }

// ---------- the tracks ----------
// 8-bar heads written out by hand, eighth-note steps (e 0..7 per bar). The loop is 16 bars: the head, then the head again
// with the tune resting for its first four bars. Notes: [eighth, MIDI, length in eighths].
const TRACKS = {
  parlor: {name: 'Parlor', bpm: 100, swing: 0.64, roots: [38,43,36,45,38,43,36,[38,43]],
    // Dm7 | G7 | Cmaj7 | A7b9 | Dm7 | G7 | Cmaj7 | Dm7 G7
    voice: {Dm7: [53,57,60,64], G7: [53,57,59,64], C: [52,55,59,62], A7: [55,58,61,64]},
    chords: ['Dm7','G7','C','A7','Dm7','G7','C',['Dm7','G7']],
    walk: [[38,41,45,44],[43,47,50,49],[48,52,55,46],[45,49,40,39],[38,45,41,42],[43,50,47,49],[48,43,40,39],[38,41,43,39]],
    comp: [[[0,2],[3,1]], [[1,1],[4,3]], [[0,3],[6,1]], [[3,2]], [[0,2],[3,1]], [[1,1],[4,2],[7,1]], [[0,4]], [[0,2],[4,2]]],
    mel: [
      [[0,77,2],[2,81,1],[3,79,1],[4,77,2],[6,74,2]],
      [[0,77,3],[3,76,1],[4,74,2],[6,71,2]],
      [[0,72,1],[1,76,1],[2,79,2],[4,83,4]],
      [[2,79,1],[3,76,1],[4,73,2],[6,76,2]],
      [[0,74,2],[2,77,1],[3,81,1],[4,84,3],[7,81,1]],
      [[0,83,2],[2,81,1],[3,79,1],[4,77,2],[6,74,2]],
      [[0,76,4],[4,72,2]],
      [[2,69,1],[3,72,1],[4,71,2],[6,74,2]],
    ],
    lead: (t, m, d, v)=>vib(t, m, d, v),
    play(t, bar, e, d8, s){
      const T = this, ch = c=>T.voice[Array.isArray(c) ? c[e < 4 ? 0 : 1] : c];
      for(const [ce, len] of T.comp[bar]) if(ce === e){
        const v = e === 7 ? ch(T.chords[(bar + 1) % 8]) : ch(T.chords[bar]);   // a hit on the last eighth anticipates the next bar
        v.forEach((m, i)=>epiano(t + i*0.01, m, d8*len*0.9, 0.55*hv(s + i)));
      }
      if(e % 2 === 0) bass(t, T.walk[bar][e/2], d8*1.8, (e === 2 || e === 6 ? 0.8 : 0.72)*hv(s));
      const rv = [0.6, 0, 0.8, 0.42, 0.6, 0, 0.8, 0.42][e]; if(rv) ride(t, rv*hv(s));   // ding, ding-a ding, ding-a
      if(e === 2 || e === 6) slap(t, 0.05);
      if(e === 0) brush(t, d8*3.6, 0.02);
      if(e === 0 || e === 4) kick(t, 0.28);
    }},
  smoke: {name: 'Smoke', bpm: 72, swing: 0.56, crackle: true,
    // Fmaj9 | Em7 | Dm9 | Cmaj9 | Bbmaj7 | Am7 | Gm9 | C9sus
    voice: [[57,60,64,67],[55,59,62,64],[53,57,60,64],[52,55,59,62],[58,62,65,69],[57,60,64,67],[53,57,58,62],[53,58,62,67]],
    roots: [41,40,38,36,46,45,43,36], fifths: [48,47,45,43,53,52,50,43],
    mel: [
      [[0,76,3],[3,79,1],[4,81,4]],
      [[0,79,2],[2,76,2],[4,74,4]],
      [[1,72,1],[2,74,1],[3,77,1],[4,81,2],[6,76,2]],
      [[0,76,4],[4,74,2],[6,71,2]],
      [[0,74,3],[3,77,1],[4,81,4]],
      [[0,79,2],[2,76,2],[4,72,4]],
      [[0,70,2],[2,74,1],[3,77,1],[4,81,4]],
      [[0,79,3],[3,77,1],[4,72,2],[6,74,2]],
    ],
    lead: (t, m, d, v)=>epiano(t, m, d, 0.62*v, 0.4),
    play(t, bar, e, d8, s){
      const T = this, v = T.voice[bar];
      if(e === 0){ v.forEach((m, i)=>epiano(t + i*0.025, m, d8*7, 0.42*hv(s + i))); pad(t, v, d8*8, 1); }
      if(e === 0) bass(t, T.roots[bar], d8*3.4, 0.85);
      if(e === 5) bass(t, T.roots[bar], d8*0.9, 0.6);
      if(e === 6) bass(t, T.fifths[bar], d8*1.8, 0.7);
      if(e === 0 || e === 5) kick(t, e ? 0.42 : 0.55);
      if(e === 3 && bar % 2) kick(t, 0.3);
      if(e === 2 || e === 6) snare(t, 0.9*hv(s));
      hiss(t, 0.04, 'highpass', 8000, 0.7, (e % 2 ? 0.008 : 0.014)*hv(s), 0.001, 0.1);   // hats
    }},
  felt: {name: 'Felt', bpm: 116, swing: 0.5,
    // Am9 | D9 | Gmaj9 | Cmaj7 | F#m7b5 | B7 | Em9 | E7b9
    voice: [[55,60,64,71],[54,60,64,69],[54,59,62,69],[52,55,59,64],[52,57,60,66],[57,63,66,71],[55,62,66,71],[56,62,65,71]],
    roots: [45,38,43,36,42,47,40,40], fifths: [52,45,50,43,48,54,47,47],
    mel: [
      [[0,76,2],[2,72,1],[3,76,1],[4,79,4]],
      [[0,78,2],[2,76,1],[3,74,1],[4,72,4]],
      [[0,71,2],[2,74,1],[3,78,1],[4,81,4]],
      [[0,79,3],[3,76,1],[4,76,4]],
      [[0,76,2],[2,78,1],[3,81,1],[4,84,4]],
      [[0,83,2],[2,81,1],[3,78,1],[4,75,4]],
      [[0,76,3],[3,78,1],[4,79,2],[6,71,2]],
      [[0,68,2],[2,71,1],[3,74,1],[4,77,2],[6,74,2]],
    ],
    lead: (t, m, d, v)=>guitar(t, m, d, 0.95*v, 0.35),
    play(t, bar, e, d8, s){
      const T = this, r = T.roots[bar], f = T.fifths[bar];
      if(e === 0) bass(t, r, d8*2.8, 0.85);
      if(e === 3) bass(t, f, d8*0.9, 0.6);
      if(e === 4) bass(t, f, d8*2.8, 0.78);
      if(e === 7) bass(t, T.roots[(bar + 1) % 8], d8*0.9, 0.55);   // the pickup into the next bar
      const hits = bar % 2 ? [2, 5] : [0, 3, 6];
      if(hits.includes(e)) T.voice[bar].forEach((m, i)=>guitar(t + i*0.012, m, d8*1.5, (e === 0 ? 0.42 : 0.34)*hv(s + i), 0.25));
      if(bar % 2 ? [2, 4].includes(e) : [0, 3, 6].includes(e)) stick(t, 0.9);   // clave, 3-2
      hiss(t, 0.06, 'highpass', 6500, 0.7, (e % 2 ? 0.018 : 0.01)*hv(s), 0.012, 0.1);   // shaker, leaning on the off-beats
      if(e === 0 || e === 4) kick(t, 0.3);
    }},
};
// the disco tunes, one per station (Parlor's slot, Smoke's, Felt's). Chords by name, a bar of two chords as a pair.
const low = r => { while(r > 47) r -= 12; while(r < 36) r += 12; return r; };
const DISCO = {
  parlor: {name: 'Mirror Ball', bpm: 120, swing: 0.5,   // string disco: octave bass, a lush string bed, stabs, a bright lead
    // Am7 | D9 | Gmaj7 | Cmaj7 | Fmaj7 | Bm7b5 E7 | Am7 | E7sus E7
    voice: {Am7: [57,60,64,67], D9: [54,57,60,64], G: [55,59,62,66], C: [55,59,60,64], F: [53,57,60,64], Bm7b5: [57,59,62,65], E7: [56,59,62,64], E7s: [57,59,62,64]},
    chords: ['Am7','D9','G','C','F',['Bm7b5','E7'],'Am7',['E7s','E7']],
    roots: [45,38,43,36,41,[47,40],45,[40,40]],
    mel: [
      [[0,76,3],[3,79,1],[4,81,2],[6,79,1],[7,76,1]],
      [[0,78,2],[2,76,1],[3,74,1],[4,72,3],[7,74,1]],
      [[0,74,2],[2,71,2],[4,74,1],[5,78,1],[6,79,2]],
      [[0,76,6],[6,74,1],[7,72,1]],
      [[0,72,2],[2,76,1],[3,77,1],[4,81,3],[7,79,1]],
      [[0,77,2],[2,74,2],[4,80,2],[6,76,2]],
      [[0,81,2],[2,84,1],[3,83,1],[4,81,2],[6,76,2]],
      [[0,74,2],[2,76,2],[4,80,2],[6,83,2]],
    ],
    lead: (t, m, d, v)=>synlead(t, m, d, v, 'sawtooth', 3200, 0.03, 0.35),
    play(t, bar, e, d8, s){
      const T = this, v = T.voice[half(T.chords[bar], e)], r = low(half(T.roots[bar], e)), rest = (s >> 6) & 1 && bar < 4;
      if(chordOn(T, bar, e)) strings(t, v, chordLen(T, bar, d8), 1.1);
      sbass(t, e % 2 ? r + 12 : r, d8*0.7, (e % 2 ? 0.7 : 0.85)*hv(s), 0.5);   // the octave bounce
      if(e % 2 === 0){ dkick(t, 0.85); chat(t, 0.8*hv(s)); } else ohat(t, hv(s));
      if(e === 2 || e === 6) clap(t, 0.85*hv(s));
      if(rest ? [1, 3, 6].includes(e) : (bar % 2 ? [3, 6] : [7]).includes(e)) stab(t, v, (rest ? 1 : 0.8)*hv(s + 3));   // more stabs while the tune rests
    }},
  smoke: {name: 'Strut', bpm: 112, swing: 0.5,   // funky disco: slap bass, guitar chops, a clav line, claps on 2 and 4
    // Em9 | Em9 | A13 | A13 | Cmaj7 | B7 | Em9 | F#m7 B7
    voice: {Em9: [55,59,62,66], A13: [55,59,61,66], C: [55,59,60,64], B7: [57,59,63,66], Fsm7: [54,57,61,64]},
    chords: ['Em9','Em9','A13','A13','C','B7','Em9',['Fsm7','B7']],
    roots: [40,40,45,45,36,47,40,[42,47]],
    slap: [   // [eighth, semitones over the root, length in eighths, popped]
      [[0,0,1.5,0],[2,12,0.5,1],[3,0,0.5,0],[4,0,0.4,0],[5,12,0.5,1],[6,10,0.5,1],[7,7,0.5,0]],
      [[0,0,1,0],[1,0,0.4,0],[3,12,0.5,1],[4,7,1,0],[6,10,0.5,1],[7,12,0.5,1]],
    ],
    mel: [
      [[0,71,1],[1,74,1],[3,76,1],[4,74,1],[6,71,1],[7,69,1]],
      [[1,67,1],[2,69,1],[3,71,2],[6,74,1],[7,76,1]],
      [[0,78,1],[2,76,1],[3,73,1],[5,71,1],[6,69,2]],
      [[1,73,1],[2,76,1],[4,78,2],[7,76,1]],
      [[0,79,2],[3,76,1],[4,74,1],[5,71,1],[6,72,2]],
      [[0,75,2],[2,78,1],[3,81,2],[6,78,1],[7,75,1]],
      [[0,76,1],[1,74,1],[2,71,1],[4,74,1],[5,76,2],[7,79,1]],
      [[0,78,1],[1,76,1],[2,73,2],[4,75,1],[5,78,1],[6,75,2]],
    ],
    lead: (t, m, d, v)=>clav(t, m, d, v),
    play(t, bar, e, d8, s){
      const T = this, v = T.voice[half(T.chords[bar], e)], r = half(T.roots[bar], e);
      for(const [be, iv, len, pop] of T.slap[bar % 2]) if(be === e) slapb(t, r + iv, d8*len, (pop ? 0.8 : 0.9)*hv(s), pop);
      chop(t, v, (e % 2 ? 1 : 0.6)*hv(s + 7), e % 2 === 1);   // scratching on every eighth, the chord rings on the off-beats
      if(chordOn(T, bar, e) && bar % 2 === 0) v.forEach((m, i)=>epiano(t + i*0.01, m, d8*1.5, 0.4*hv(s + i), 0.2));
      if(e === 0 || e === 4 || (e === 5 && bar % 2)) dkick(t, e === 5 ? 0.55 : 0.85);
      chat(t, (e % 2 ? 0.6 : 0.9)*hv(s));
      if(e === 7) ohat(t, 0.8*hv(s));
      if(e === 2 || e === 6) clap(t, 0.95*hv(s));
    }},
  felt: {name: 'Orbit', bpm: 124, swing: 0.5,   // space disco: sequenced synth bass, a bell arpeggio, slow pad sweeps, handclaps
    // Dm9 | Bbmaj7 | Gm9 | A7sus A7 | Dm9 | Bbmaj7 | F C | Gm7 A7
    voice: {Dm9: [57,60,64,65], Bb: [57,58,62,65], Gm9: [55,58,62,65], A7s: [55,57,62,64], A7: [55,57,61,64], F: [53,57,60,64], C: [55,60,64,67], Gm7: [55,58,62,65]},
    chords: ['Dm9','Bb','Gm9',['A7s','A7'],'Dm9','Bb',['F','C'],['Gm7','A7']],
    roots: [38,46,43,[45,45],38,46,[41,48],[43,45]],
    seq: [0,0,12,0, 0,12,0,12, 0,0,12,0, 7,12,10,12],   // the bass, in sixteenths, over the root
    arp: [0,2,1,3,2,0,3,1],
    mel: [
      [[0,74,3],[3,76,1],[4,77,4]],
      [[0,81,4],[4,79,2],[6,77,2]],
      [[0,74,2],[2,77,2],[4,82,4]],
      [[0,81,4],[4,79,2],[6,76,2]],
      [[0,77,2],[2,76,1],[3,74,1],[4,69,4]],
      [[0,70,2],[2,74,2],[4,77,2],[6,81,2]],
      [[0,84,3],[3,81,1],[4,79,4]],
      [[0,77,2],[2,74,2],[4,73,4]],
    ],
    lead: (t, m, d, v)=>synlead(t, m, d, v, 'square', 1900, 0.032, 0.45),
    play(t, bar, e, d8, s){
      const T = this, v = T.voice[half(T.chords[bar], e)], r = low(half(T.roots[bar], e));
      if(chordOn(T, bar, e)) sweep(t, v, chordLen(T, bar, d8), 1);
      for(let k = 0; k < 2; k++) sbass(t + k*d8/2, r + T.seq[e*2 + k], d8*0.4, (k ? 0.7 : 0.85)*hv(s + k), 0.6);
      bell(t, v[T.arp[e]] + 12 + (e >= 4 ? 12 : 0), 0.8*hv(s + 5));
      if(e % 2 === 0){ dkick(t, 0.85); chat(t, 0.7*hv(s)); } else ohat(t, 0.9*hv(s));
      if(e === 2 || e === 6) clap(t, 0.9*hv(s));
    }},
};
const tune = id => (style === 'disco' ? DISCO : TRACKS)[id];
function warm(id){ if(id === 'felt' && style !== 'disco'){ const T = TRACKS.felt; T.voice.flat().concat(T.mel.flat().map(n=>n[1])).forEach(ksNote); } }

function schedule(){
  if(!TRACKS[track]) return;
  if(nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05;   // fell behind (a throttled timer): pick up from now, never a burst of missed notes
  while(nextT < ctx.currentTime + 0.3){
    if((step & 7) === 0 && style !== wantStyle){   // on the bar line: the other station's tune, from its top
      style = wantStyle; step = 0; metalFor(); warm(track);
      if(tune(track).crackle) startCrackle(); else stopCrackle();
    }
    const T = tune(track), s = step % 128, pass = s >> 6, bar = (s >> 3) & 7, e = s & 7;
    const beat = 60/T.bpm, d8 = beat/2, t = nextT + (e % 2 ? (T.swing - 0.5)*beat : 0);
    T.play(t, bar, e, d8, s);
    if(!(pass === 1 && bar < 4)) for(const [me, m, len] of T.mel[bar]) if(me === e) T.lead(t, m, d8*len, (pass ? 0.85 : 1)*hv(s + 50));
    nextT += d8; step++;
  }
}
function play(id){
  if(!TRACKS[id]){ stop(); return; }
  if(!ensure()) return;
  clearTimeout(sleepTimer);
  wake();
  if(track === id && timer) return;
  const now = ctx.currentTime, my = ++tok, wait = timer ? 300 : 0;
  out.gain.cancelScheduledValues(now); out.gain.setTargetAtTime(0, now, 0.08);
  clearInterval(timer); timer = 0;
  setTimeout(()=>{
    if(my !== tok) return;
    stopCrackle(); style = wantStyle; warm(id);
    track = id; metalFor(); step = 0; nextT = ctx.currentTime + 0.1;
    out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setTargetAtTime(vol*LEVEL, ctx.currentTime, 0.5);
    if(tune(id).crackle) startCrackle();
    if(!away){ timer = setInterval(schedule, 50); schedule(); }
  }, wait);
}
function stop(){
  if(!ctx) return;
  track = null; const my = ++tok; clearInterval(timer); timer = 0;
  out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
  clearTimeout(sleepTimer);
  sleepTimer = setTimeout(()=>{ if(my === tok && !track){ stopCrackle(); metalOff(); try{ ctx.suspend(); }catch(e){} } }, 2500);   // rest the cymbal bank and the context when quiet
}
function setVolume(v){ vol = Math.max(0, Math.min(1, v)); if(ctx && track) out.gain.setTargetAtTime(vol*LEVEL, ctx.currentTime, 0.1); }
// call from a tap, so the browser lets it play later; with nothing playing it goes back to sleep after a moment
function unlock(){ if(!ensure()) return; wake(); if(!track){ clearTimeout(sleepTimer); sleepTimer = setTimeout(()=>{ if(!track) try{ ctx.suspend(); }catch(e){} }, 2500); } }
// back after the page was hidden, a call or an alarm: wake the context and the scheduler (call from a tap: iOS needs one)
function resume(){
  if(!ctx || !track || away) return;
  wake();
  if(!timer){ timer = setInterval(schedule, 50); schedule(); }
}
// the page hidden (another tab, another app, the screen off): stop the scheduler and the context, so a phone isn't kept
// busy for music nobody hears; it picks up where it was on coming back (or on the next tap, where the browser needs one)
if(root.document) root.document.addEventListener('visibilitychange', ()=>{
  away = root.document.hidden;
  if(!ctx || !track) return;
  if(away){ clearInterval(timer); timer = 0; try{ ctx.suspend(); }catch(e){} }
  else resume();
});
// a station's name: the disco tune's while the Disco set is on
const stationName = id => { const T = (wantStyle === 'disco' ? DISCO : TRACKS)[id]; return T ? T.name : ''; };
root.Music = {play, stop, setVolume, setStyle, style: ()=>style, resume, unlock, stationName, tracks: Object.fromEntries(Object.entries(TRACKS).map(([k, T])=>[k, T.name])), playing: ()=>track};
})(typeof window !== 'undefined' ? window : this);
