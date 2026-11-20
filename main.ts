// Solmar Bay — the program that hands the game in.
// Node 22, standard library only, no network. It copies this repository's
// game/ and screenshots/ into the output directory the grader gives it
// (MAKEFUN_OUTPUT_DIR outside the grader, /output inside it) and writes
// /output/dossier.json with the kit's vendored dossier library, exactly as
// the library writes it — the gate rebuilds it and compares byte for byte.
//
// The program runs twice and both runs must write identical bytes, so it does
// nothing time- or randomness-dependent: it copies files and writes the
// dossier the library computes from them. It never removes the output
// directory itself — the grader mounts /output read-only for the program's
// second run, and deleting the directory would fail — it only clears what
// is inside it before copying.
//
// Serve the game locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Clear only the contents of the output directory, never the directory itself.
mkdirSync(out, { recursive: true });
for (const entry of readdirSync(out)) rmSync(join(out, entry), { recursive: true, force: true });

// The game: every static file under game/, served as-is by any static server.
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
// The screenshots: 3 or 4 real renders of the game, the first by name the cover.
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The dossier the judge reads: the game's source outline plus the screenshots,
// capped so the judge's view fits in 1,536 tokens. The gate's own caps are
// passed through so a build that would fail the gate fails here first.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
