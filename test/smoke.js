// Smoke test: loads the game, takes the 4 staged shots, pixel-checks
// each (unique colour count + file size), and reports console/page errors.
// Usage: node test/smoke.js [outdir]
import { createRequire } from 'node:module';
const require = createRequire('/tmp/gta6-test/package.json');
const { chromium } = require('playwright-core');
const { PNG } = require('pngjs');
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = process.argv[2] || join(repo, 'screenshots');
const root = join(repo, 'game');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/') p = '/index.html';
    const data = await readFile(join(root, p));
    res.writeHead(200, { 'Content-Type': types[extname(p)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/home/hatch/.cache/puppeteer/chrome/linux-156.0.8078.47/chrome-linux64/chrome',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

async function colourCount(pngPath) {
  const png = PNG.sync.read(await readFile(pngPath));
  const set = new Set();
  const d = png.data;
  for (let i = 0; i < d.length; i += 4) set.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
  return set.size;
}

const shots = [
  ['1-chase.jpg', 'chase', 1000, true], ['2-mission.jpg', 'mission', 2500, false],
  ['3-drive.jpg', 'drive', 2500, true], ['4-start.jpg', 'start', 2500, false],
];
const results = [];
for (const [file, name, wait, holdW] of shots) {
  await page.goto(`http://localhost:${port}/index.html?shot=${name}&seed=7`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.G && window.G.ready, null, { timeout: 20000 });
  // Hold W for the driving shots so the car is actually moving (with
  // police in pursuit) when the shutter falls — the staged speed bleeds
  // off to 0 within half a second of releasing the key, so the key
  // stays down THROUGH both screenshots, not just the wait.
  if (holdW) await page.keyboard.down('KeyW');
  await page.waitForTimeout(wait);
  const path = join(outDir, file);
  await page.screenshot({ path, type: 'png' });
  const colours = await colourCount(path);
  const { size } = statSync(path);
  // Re-save as JPEG for the entry (PNG is only for counting).
  const jpg = path.replace(/\.jpg$/, '.jpg');
  await page.screenshot({ path: jpg, type: 'jpeg', quality: 88 });
  if (holdW) await page.keyboard.up('KeyW');
  const jpgSize = statSync(jpg).size;
  results.push({ file, size: jpgSize, colours });
  console.log(`${file}: ${(jpgSize / 1024).toFixed(0)} KiB, ${colours.toLocaleString()} colours`);
}
console.log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close();
server.close();
const bad = results.filter((r) => r.colours < 150 || r.size > 256 * 1024);
if (bad.length || errors.length) { console.log('SMOKE FAIL'); process.exit(1); }
console.log('SMOKE PASS');
