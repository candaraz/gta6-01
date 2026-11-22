// shots-v5.js — serves game/, loads each ?shot= scene in desktop Chrome at
// 1280x720, waits for window.__shotReady, and saves crisp JPEGs (q88) to screenshots/.
// Usage: node test/shots-v5.js
import { createRequire } from 'node:module';
const require = createRequire('/home/hatch/workspace/house-studio/package.json');
const puppeteer = require('puppeteer');
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { statSync, mkdirSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(repo, 'game');
const outDir = join(repo, 'screenshots');
mkdirSync(outDir, { recursive: true });
const shots = JSON.parse(await readFile(join(repo, 'shots.json'), 'utf8')).shots;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/') p = '/index.html';
    const data = await readFile(join(root, p));
    res.writeHead(200, { 'Content-Type': types[extname(p)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await puppeteer.launch({
  executablePath: '/home/hatch/.cache/puppeteer/chrome/linux-156.0.8078.47/chrome-linux64/chrome',
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--window-size=1280,720'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));

for (const shot of shots) {
  const url = `http://localhost:${port}/index.html${shot.url}`;
  console.log(`shot ${shot.file} <- ${url}`);
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  try {
    await page.waitForFunction('window.__shotReady === true', { timeout: 30000 });
  } catch (e) {
    console.log(`  !! __shotReady never fired for ${shot.file} (gameReady=${await page.evaluate(() => !!window.__gameReady)})`);
  }
  await new Promise((r) => setTimeout(r, 400));
  const diag = await page.evaluate(() => {
    const d = document.getElementById('dialogue');
    const r = d.getBoundingClientRect();
    return `dialogue class="${d.className}" rect=${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)} text="${document.getElementById('dialogue-text').textContent.slice(0, 40)}"`;
  });
  console.log(`  diag: ${diag}`);
  const outPath = join(outDir, shot.file);
  await page.screenshot({ path: outPath, type: 'jpeg', quality: 88 });
  const size = statSync(outPath).size;
  console.log(`  saved ${shot.file}: ${size} bytes ${size <= 256 * 1024 ? 'OK' : 'OVER 256KiB!'}`);
}
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'NO PAGE/CONSOLE ERRORS');
await browser.close();
server.close();
