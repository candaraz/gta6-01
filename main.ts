// main.ts — Solmar Bay v3: the entrypoint.
// One job: copy game/ and screenshots/ into the output directory and
// write dossier.json with the vendored make.fun library, byte-identical
// on every run (sorted copy order, no timestamps anywhere in the output).
//
// The output directory itself is never removed — only its contents are —
// because the grader mounts /output read-only and removing it fails.

import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)));
const outDir = process.env.MAKEFUN_OUTPUT_DIR
  ? resolve(process.env.MAKEFUN_OUTPUT_DIR)
  : '/output';

// Clear only the contents of the output directory, never the directory.
mkdirSync(outDir, { recursive: true });
for (const name of readdirSync(outDir).sort()) {
  rmSync(join(outDir, name), { recursive: true, force: true });
}

// Copy game/ then screenshots/, in sorted order, contents only.
for (const sub of ['game', 'screenshots']) {
  const src = join(repoRoot, sub);
  if (!existsSync(src)) continue;
  mkdirSync(join(outDir, sub), { recursive: true });
  for (const name of readdirSync(src).sort()) {
    cpSync(join(src, name), join(outDir, sub, name), { recursive: true });
  }
}

// The dossier is built from the repository (game/ + screenshots/).
const dossier = buildDossier(repoRoot, { text_max_bytes: 163840 });
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`solmar-bay v3: wrote ${outDir} (dossier.json ${dossier.length} bytes)`);
