# Vice City Cover Maker

[![Vice City Cover Maker on make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![Rank](https://make.fun/badge/gta6-cover-art-01/vinstech62/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![Reward](https://make.fun/badge/gta6-cover-art-01/vinstech62/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

Vice City Cover Maker is an offline web app that turns your photos and a caption into GTA-style multi-panel cover art. Drop in up to three photos, arrange them across five panels, pick one of three layouts and one of five colour grades, and finish with the signature sunset caption band — a low sun, halftone dots, palm silhouettes and big display lettering. Export a share-ready PNG in the common post sizes: 1080x1080, 1080x1350 and 1920x1080.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no install, no network: the app is plain static files.

## How it works

- `app/index.html` — the editor page: preview canvas, photo pickers, caption fields, size/layout/grade controls, panel sliders and the export button.
- `app/style.css` — the dark editor theme, the Anton `@font-face`, and the chrome-free cover mode used for screenshots.
- `app/src/cover.js` — the painter. Computes the three panel layouts, cover-fits each photo around its focus point and zoom, blends the colour grade in soft light, adds a vignette and deterministic film grain, then paints the sunset caption band (sun and glow, halftone dots, two palm silhouettes, auto-fit Anton caption and a letter-spaced sub-caption).
- `app/src/main.js` — the wiring. Holds the app state, loads the sample photo and user photos, handles click-to-select, drag-to-move and scroll-to-zoom panel editing, and renders the offscreen PNG export.
- `app/src/shots.js` — screenshot mode. Reads `?shot=&photo=&caption=&size=&layout=&grade=` from the URL, arranges the scene, and sets `window.__ready` when a capture can be taken.
- `app/fonts/` — the Anton display font (SIL Open Font License, see `OFL.txt`), used for the caption lettering.
- `app/samples/` — two sample photos (a pier and a boulevard at sunset) so the app works the moment it opens.
- `screenshots/` — captures of the exported covers and the editor, described by `shots.json`.
- `main.ts` — the hand-in program: copies `app/` and `screenshots/` into the output directory and writes `dossier.json` with the vendored `buildDossier`.
- `vendor/makefun-app.ts` — the kit's dossier builder, used by `main.ts`.

Everything the app needs is a local file under `app/` — the font, the samples, every script and style. Your photos are read on your own machine and never uploaded anywhere.
