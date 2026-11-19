# Vice City Cover Maker

[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/vinstech62/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/vinstech62/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

An offline web app that turns your photos and a caption into GTA 6-style multi-panel cover art: five panels, a Vice City sunset caption band with palm silhouettes, five colour grades, and PNG export in the common post sizes 1080x1080, 1080x1350 and 1920x1080. Load up to three photos, pick a panel to crop and position it, choose a layout and a grade, and export.

Built for the [make.fun bounty gta6-cover-art-01](https://make.fun/bounty/gta6-cover-art-01).

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome.

## How it works

- `app/index.html` — the editor page: photo inputs, caption fields, size, layout and grade controls, and the preview canvas.
- `app/style.css` — the dark editor theme and the cover-only view.
- `app/src/cover.js` — the painter: three layouts, per-panel crop and zoom, soft-light grades, vignette, deterministic film grain, and the sunset caption band with sun, palms and halftone dots.
- `app/src/main.js` — the wiring: photo loading, panel picking, drag to move, scroll to zoom, export to PNG.
- `app/src/shots.js` — screenshot mode from the page query, for the entry's screenshots.

No network is needed: every script, font and sample photo is a file under `app/`, and your photos never leave your machine.

Made for make.fun.
