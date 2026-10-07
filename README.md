# Halfball

A billiards cut-shot aim trainer. Read the shot, call the fraction (full, ¾, ½, ¼, ⅛), get down on it and shoot. Climb the ladder from F to S: speed, spin, english and position open up as you go.

- **The game:** `index.html` and `app.css`, with the game itself in ES modules (no build step): `main.js` boots it and wires everything up; `geom.js` (the table and fractions), `steps.js` (the skill steps), `state.js` (players, settings, stats, the shared state), `grades.js` (the ladder), `deal.js` (dealing, the shot library, Run-outs), `shot.js` (playing a shot), `view.js` (drawing), `anim.js` (the shot animation), `modes.js` (Flash, the round, mode setup), `lessons.js`, `ui.js`, `audio.js`, `perf.js` (#dev) and `whatsnew.js` (the build number and release notes). Classic scripts alongside: `engine.js` (physics), `table3d.js` (3D table), `music.js` (the radio) and `stats.js` (the Stats view). Up to 4 players per device; progress stays in your browser.
- **Shot library:** `shots.bin`, built with `tools/gen-shots.js` and checked with `tools/check-shots.js` (Node: `cd tools && npm install` first; both load the game's modules through `tools/load-game.js`).

Play it at https://halfball.io

It installs as an app (Chrome menu → Install app / Add to Home screen) and works offline.

## Contact

hello@halfball.io

## License

MIT © halfballio. See [LICENSE](LICENSE). Bundles three.js (MIT, © three.js authors) in `vendor/`; its licence is in [vendor/three.LICENSE](vendor/three.LICENSE).
