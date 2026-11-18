// Solmar Bay's hand-in program (Node 22, standard library only). The game
// itself is the static game/ folder beside this file — index.html plus its
// ES modules and the vendored three.js build — and screenshots/ holds the
// four renders. This program stages both into the output directory and
// writes the dossier the judge reads, using make.fun's own vendored
// dossier builder so the summary always matches what the scorer computes.
//
// Run it the way the grader does (inside its container /output is the
// destination); anywhere else, MAKEFUN_OUTPUT_DIR stands in:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the game locally with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The repository root: the folder this file lives in.
const root = fileURLToPath(new URL('.', import.meta.url));
// The grader's container hands in /output; local runs override it.
const destination = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's own caps, from the kit's reference/gate.json. Only the text cap
// shapes the dossier's bytes; the rest make this program refuse exactly
// where the scorer would refuse, so a bad entry fails here, loudly.
const GATE_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function stageFolder(name: string): void {
  const from = join(root, name);
  if (!existsSync(from)) return;
  cpSync(from, join(destination, name), { recursive: true });
}

mkdirSync(destination, { recursive: true });
stageFolder('game');
stageFolder('screenshots');

writeFileSync(join(destination, 'dossier.json'), buildDossier(destination, GATE_CAPS));
