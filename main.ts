// main.ts — Solmar Bay's entry program (Node 22 standard library only).
// Copies game/ and screenshots/ from this repository into the output
// directory and writes /output/dossier.json with buildDossier from
// vendor/makefun-game.ts. Runs twice byte-identical: files are copied in
// sorted order and the dossier is built from the same inputs.
// Never removes the output directory itself — only its contents.
import { readdir, rm, mkdir, copyFile, writeFile, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const REPO_ROOT = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR || '/output';
const DOSSIER_TEXT_MAX_BYTES = 163840;

async function clearContents(dir) {
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    await mkdir(dir, { recursive: true });
    return;
  }
  for (const entry of entries.sort()) {
    await rm(join(dir, entry), { recursive: true, force: true });
  }
}

async function copyTree(src, dest) {
  await mkdir(dest, { recursive: true });
  const entries = (await readdir(src, { withFileTypes: true })).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
  for (const entry of entries) {
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyTree(from, to);
    } else if (entry.isFile()) {
      await copyFile(from, to);
    }
  }
}

async function main() {
  // Fail loudly if the game is missing instead of writing an empty output.
  try {
    await stat(join(REPO_ROOT, 'game', 'index.html'));
  } catch {
    throw new Error('game/index.html not found under ' + REPO_ROOT);
  }
  await mkdir(OUT_DIR, { recursive: true });
  await clearContents(OUT_DIR);
  await copyTree(join(REPO_ROOT, 'game'), join(OUT_DIR, 'game'));
  const shotsDir = join(REPO_ROOT, 'screenshots');
  try {
    await stat(shotsDir);
    await copyTree(shotsDir, join(OUT_DIR, 'screenshots'));
  } catch {
    // No screenshots yet: the dossier still builds from game/ alone.
  }
  const dossier = buildDossier(REPO_ROOT, { text_max_bytes: DOSSIER_TEXT_MAX_BYTES });
  await writeFile(join(OUT_DIR, 'dossier.json'), dossier);
}

await main();
