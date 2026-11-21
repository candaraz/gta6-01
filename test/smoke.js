// test/smoke.js — Solmar Bay v3: a fast smoke test.
// Loads the game, starts it, and screenshots the four staged shots,
// reporting console/page errors. Usage: node test/smoke.js
import { chromium } from '/home/hatch/workspace/makefun/test-tools/node_modules/playwright-core/index.mjs';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = dirname(dirname(fileURLToPath(import.meta.url)));
const node = process.execPath;

async function main() {
  const server = spawn(node, ['serve.ts'], { cwd: repo, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2500));
  const browser = await chromium.launch({
    executablePath: '/home/hatch/.cache/puppeteer/chrome/linux-156.0.8078.47/chrome-linux64/chrome',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--disable-gpu-sandbox', '--mute-audio'],
  });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('requestfailed', (r) => errors.push('reqfail: ' + r.url()));

    // Title screen.
    await page.goto('http://localhost:8080/index.html?seed=7', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2500);
    const hasG = await page.evaluate(() => !!window.G);
    console.log('window.G present:', hasG);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);
    const state = await page.evaluate(() => window.G.debug.state);
    console.log('state after Enter:', state);
    const pos = await page.evaluate(() => window.G.debug.player);
    console.log('player:', JSON.stringify(pos));
    await page.screenshot({ path: '/tmp/gta6-test/smoke-title.jpg', type: 'jpeg', quality: 82 });

    // The four staged shots.
    for (const shot of ['chase', 'mission', 'drive', 'start']) {
      await page.goto(`http://localhost:8080/index.html?shot=${shot}&seed=7`, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(6000);
      const st = await page.evaluate(() => ({ state: window.G.debug.state, mission: window.G.debug.missionName, stars: window.G.debug.stars, enemies: window.G.debug.enemies, cam: [Math.round(window.G.camera.camera.position.x), Math.round(window.G.camera.camera.position.y), Math.round(window.G.camera.camera.position.z)], camState: { px: Math.round(window.G.camera.state.px * 10) / 10, pz: Math.round(window.G.camera.state.pz * 10) / 10, orbit: Math.round(window.G.camera.state.orbit * 100) / 100, dist: window.G.camera.state.dist }, player: window.G.debug.player, cops: window.G.debug.cops.map((c) => [Math.round(c.x), Math.round(c.z)]) }));
      console.log(`shot ${shot}:`, JSON.stringify(st));
      await page.screenshot({ path: `/tmp/gta6-test/smoke-${shot}.jpg`, type: 'jpeg', quality: 82 });
    }
  } finally {
    await browser.close();
    server.kill();
  }
  console.log('ERRORS (' + errors.length + '):');
  for (const e of errors.slice(0, 20)) console.log('  ' + e);
  process.exit(errors.length ? 1 : 0);
}
main();
