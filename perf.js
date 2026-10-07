// Testing aids: #dev, the build tag under the table, and the frames-per-second meter.
import {settings} from './state.js';
import {CONTACT, SOURCE, VERSION} from './whatsnew.js';
// Testing: open the site with #dev and tap any grade in the progress ladder to jump there.
export const DEV = /#dev\b/.test(location.href);
export function wireDevTools(){
  document.querySelector('.table-box').insertAdjacentHTML('afterend', `<div class="buildtag">${DEV_SITE ? '<b class="devtag">DEV</b> ' : ''}<b class="devtag unltag" id="unltag" title="Every grade, mode and look open; the lessons are skipped" hidden>Unlocked</b><b class="devtag unltag" id="discotag" title="The Disco ball set, its light show and its music" hidden>Disco</b><a href="mailto:${CONTACT}">Contact us</a> · <a href="${SOURCE}" target="_blank" rel="noopener">build ${VERSION}</a><span id="fpsmeter"></span></div>` );   // under the table, lined up with its left edge; always shown, so you can tell which build is live
  {
    let frames = 0, worst = 0, last = performance.now(), mark = last, running = false;
    const tick = now => {
      if(!fpsOn()){ const el = document.getElementById('fpsmeter'); if(el && el.textContent) el.textContent = ''; running = false; return; }
      const dt = now - last; last = now; frames++; worst = Math.max(worst, dt);
      if(now - mark >= 500){
        const sec = (now - mark)/1000, el = document.getElementById('fpsmeter');
        if(el) el.textContent = ` · ${Math.round(frames/sec)} fps · worst ${Math.round(worst)} ms · draw ${(PERF.drawMs/Math.max(1, PERF.draws)).toFixed(1)} ms ×${Math.round(PERF.draws/sec)}/s · gl ${(PERF.glMs/Math.max(1, PERF.gls)).toFixed(1)} ms ×${Math.round(PERF.gls/sec)}/s · deal ${Math.round(PERF.dealMs)} ms (ahead ${Math.round(PERF.prepMs || 0)} ms)`;
        frames = 0; worst = 0; mark = now; PERF.drawMs = PERF.glMs = 0; PERF.draws = PERF.gls = 0;
      }
      requestAnimationFrame(tick);
    };
    fpsStart = () => { if(running || !fpsOn()) return; running = true; frames = 0; worst = 0; last = mark = performance.now(); requestAnimationFrame(tick); };
    setTimeout(fpsStart, 0);   // once the settings are read
  }
  // adding or removing #dev on an open page doesn't reload it by itself: reload so the switch takes effect
  window.addEventListener('hashchange', e=>{ if(/#dev\b/.test(e.newURL) !== /#dev\b/.test(e.oldURL)) location.reload(); });
}
// #dev: frames per second, the slowest frame, and what the drawing costs, every half second
// FPS and timings under the table: on in #dev, or with Settings > Graphics > Show FPS
const fpsOn = () => DEV || (typeof settings !== 'undefined' && settings.fps === '1');
// it only runs while it's shown: an empty loop every frame keeps a phone from ever resting
export let fpsStart = () => {};
// ---------- performance numbers (shown on #dev) ----------
export const PERF = {drawMs: 0, glMs: 0, draws: 0, gls: 0, dealMs: 0};
