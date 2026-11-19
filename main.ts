// Vice City Cover Maker — the entry program.
//
// This program hands the cover-maker app in: it copies the app/ folder
// (the offline editor: index.html, style.css, src/cover.js, src/main.js,
// src/shots.js, the Anton display font and the two sample photos) and the
// screenshots/ folder from beside this file into the output directory, then
// writes /output/dossier.json with buildDossier from vendor/makefun-app.ts,
// under this bounty's caps: 160 KiB of source text, at most 4 screenshots of
// 256 KiB each, app/ at most 993 files and 48 MiB with paths of at most
// 1000 bytes. Standard library only; it runs twice and writes the same
// bytes both times.

import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoDir = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000
};

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(join(repoDir, 'app'), join(outDir, 'app'), { recursive: true });
cpSync(join(repoDir, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, caps);
writeFileSync(join(outDir, 'dossier.json'), dossier);
