// Solmar Bay final screenshot capture.
// Renders each ?shot= scene at 1280x800, high quality (shadows on), and
// writes the four deliverable JPEGs into screenshots/. Slow on this VM
// (software rendering) — allow ~60s per shot.
const puppeteer = require('/home/hatch/workspace/house-studio/node_modules/puppeteer');
const fs = require('fs');

const BASE = 'http://localhost:8080';
const OUT = '/home/hatch/workspace/makefun/gta6-01/screenshots';
const CHROME = '/home/hatch/.cache/puppeteer/chrome/linux-156.0.8078.47/chrome-linux64/chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const shots = [
    ['chase', '1-chase.jpg'],
    ['mission', '2-mission.jpg'],
    ['drive', '3-drive.jpg'],
    ['start', '4-start.jpg'],
  ];
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,800', '--autoplay-policy=no-user-gesture-required'],
  });
  for (const [shot, name] of shots) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    const errors = [];
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
    await page.goto(`${BASE}/?shot=${shot}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__solmar !== undefined, { timeout: 60000 }).catch(() => {});
    // let the scene settle: camera placed, traffic/peds moving, HUD live
    await sleep(4000);
    const s = await page.evaluate(() => window.__solmar?.state());
    console.log(shot, JSON.stringify(s), 'errors:', errors.length ? errors.join(' | ') : 'none');
    await page.screenshot({ path: `${OUT}/${name}`, type: 'jpeg', quality: 88 });
    const sz = fs.statSync(`${OUT}/${name}`).size;
    console.log('  saved', name, (sz / 1024).toFixed(1) + ' KiB', sz <= 262144 ? '(under 256 KiB)' : 'OVER 256 KiB!');
    await page.close();
  }
  await browser.close();
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
