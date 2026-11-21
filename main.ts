import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repo = path.dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR || '/output';

// Empty the output directory WITHOUT removing the directory itself.
// In the grader /output is a mount point: deleting it throws and the
// whole run dies with exit 1. So list its entries and remove each one.
if (existsSync(out)) {
  for (const entry of readdirSync(out)) {
    rmSync(path.join(out, entry), { recursive: true, force: true });
  }
}
mkdirSync(out, { recursive: true });

cpSync(path.join(repo, 'game'), path.join(out, 'game'), { recursive: true });
cpSync(path.join(repo, 'screenshots'), path.join(out, 'screenshots'), { recursive: true });

const dossier = await buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 256 * 1024 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
});

writeFileSync(path.join(out, 'dossier.json'), dossier);
console.log(`dossier: ${Buffer.byteLength(dossier)} bytes`);
