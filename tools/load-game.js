// The game in a headless page, for the Node tools: index.html is loaded in jsdom with its classic scripts inlined (no
// network there; three.js isn't needed without WebGL), then main.js and the modules it imports are run in that page's
// own realm through vm.SourceTextModule, exactly as the browser would run them. Resolves to the window once main.js has
// finished (with #test there is no player to pick, so that is at once).
//   const { loadGame, ensureVmModules } = require('./load-game'); ensureVmModules();   // first thing: it needs node's --experimental-vm-modules
//   const w = await loadGame({seed, settings, stats}); w.__lib ...
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

// vm.SourceTextModule only exists behind a flag: run the tool again with it when it's missing
function ensureVmModules(){
  if(typeof vm.SourceTextModule === 'function') return;
  const { spawnSync } = require('child_process');
  const r = spawnSync(process.execPath, ['--experimental-vm-modules', '--no-warnings', ...process.argv.slice(1)], {stdio: 'inherit'});
  process.exit(r.status == null ? 1 : r.status);
}

async function loadGame({seed = 1, hash = '#test', settings = {}, stats = {}} = {}){
  const { JSDOM, VirtualConsole } = require('jsdom');
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src)=>{
    if(/three/.test(src)) return '';
    const f = path.join(ROOT, src.split('?')[0]);
    return fs.existsSync(f) ? `<script>${fs.readFileSync(f, 'utf8')}</script>` : '';
  }).replace(/<script type="module" src="main\.js"><\/script>/, '');   // run below, in the page's realm
  const vc = new VirtualConsole();   // keep jsdom's "not implemented" noise out of the output
  vc.on('jsdomError', ()=>{});
  const dom = new JSDOM(html, {url: 'https://halfball.local/' + hash, runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w){
      w.matchMedia = () => ({matches: false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){}});
      w.fetch = () => Promise.reject(new Error('offline'));
      w.HTMLCanvasElement.prototype.getContext = () => null;
      w.scrollTo = () => {};
      let x = seed >>> 0 || 1; w.Math.random = () => ((x = (x*1664525 + 1013904223) >>> 0) / 4294967296);   // each caller its own stream
      w.localStorage.setItem('halfball-settings', JSON.stringify({sv: 2, sv3: 1, sv4: 1, sv5: 1, tut: 1, stanceSet: 1, tutSeen: {}, sound: '0', task: 'shoot', ...settings}));
      w.localStorage.setItem('halfball-stats', JSON.stringify({log: [], shoot: {g: 13, best: 13, pts: 0, v: 2}, sessions: [], ...stats}));
    }});
  const ctx = dom.getInternalVMContext(), cache = new Map();
  const load = spec => {
    const file = path.join(ROOT, spec.replace(/^\.\//, ''));
    if(!cache.has(file)) cache.set(file, new vm.SourceTextModule(fs.readFileSync(file, 'utf8'), {context: ctx, identifier: 'file://' + file}));
    return cache.get(file);
  };
  const main = load('./main.js');
  await main.link(spec => load(spec));
  await main.evaluate();
  const w = dom.window;
  if(!w.__lib) throw new Error('the game did not expose its library hooks (window.__lib)');
  return w;
}

module.exports = { loadGame, ensureVmModules };
