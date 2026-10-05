# Halfball

A billiards cut-shot aim trainer. Read the shot, call the fraction (full, ¾, ½, ¼, ⅛), get down on it and shoot. Climb the ladder from F to S: speed, spin, english and position open up as you go.

- **The game:** `index.html`, with `engine.js` (physics), `table3d.js` (3D table) and `music.js` (the radio). Up to 4 players per device; progress stays in your browser.
- **Shot library:** `shots.bin`, built with `tools/gen-shots.js` and checked with `tools/check-shots.js` (Node: `cd tools && npm install` first).

Play it at https://halfball.io

It installs as an app (Chrome menu → Install app / Add to Home screen) and works offline.

## Contact

hello@halfball.io

## License

MIT © halfballio. See [LICENSE](LICENSE). Bundles three.js (MIT, © three.js authors) in `vendor/`; its licence is in [vendor/three.LICENSE](vendor/three.LICENSE).
