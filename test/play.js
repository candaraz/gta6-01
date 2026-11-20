// Solmar Bay headless play-test harness.
// Serves game/ (assumes `node serve.ts` is already running on :8080),
// opens the page in headless Chrome, and drives the game through
// window.__solmar + synthetic key events. Usage:
//   node test/play.js <mode> [arg]
// Modes: smoke, shot <start|drive|chase|mission>, mission <n 0-9>,
//        race, chase, continue, audio, drive
const puppeteer = require('/home/hatch/workspace/house-studio/node_modules/puppeteer');

const BASE = 'http://localhost:8080';
const OUT = '/home/hatch/workspace/makefun/gta6-01/test';
const CHROME = '/home/hatch/.cache/puppeteer/chrome/linux-156.0.8078.47/chrome-linux64/chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch(url) {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--window-size=960,600', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 600 });
  // headless software rendering is slow: force low quality (no shadows) and
  // a capped pixel ratio before the game reads its settings.
  await page.evaluateOnNewDocument(() => {
    try { localStorage.setItem('solmarbay.settings.v2', JSON.stringify({ master: 0.8, music: 0.55, sfx: 0.9, quality: 'low', sens: 1 })); } catch {}
  });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('requestfailed', (r) => errors.push('REQFAIL: ' + r.url()));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // wait for the game to boot (WebGL via SwiftShader is slow on this VM)
  await page.waitForFunction(() => window.__solmar !== undefined, { timeout: 60000 }).catch(() => {});
  await sleep(1500);
  return { browser, page, errors };
}
async function state(page) { return page.evaluate(() => window.__solmar?.state()); }
async function newGame(page) {
  await page.click('#btn-new');
  await sleep(1500);
}

async function main() {
  const mode = process.argv[2] || 'smoke';
  const arg = process.argv[3];
  let browser, page, errors;
  try {
    if (mode === 'shot') {
      const shot = arg || 'start';
      ({ browser, page, errors } = await launch(`${BASE}/?shot=${shot}`));
      await sleep(3000);
      console.log('SHOT', shot, JSON.stringify(await state(page)));
      const name = { start: '4-start', drive: '3-drive', chase: '1-chase', mission: '2-mission' }[shot] || shot;
      await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 88 });
      console.log('saved', name + '.jpg');
      console.log('errors:', errors.length ? errors.join('\n') : 'none');
    } else if (mode === 'smoke') {
      ({ browser, page, errors } = await launch(BASE + '/'));
      await newGame(page);
      console.log('after new game:', JSON.stringify(await state(page)));
      await page.keyboard.down('KeyW');
      await sleep(1500);
      await page.keyboard.up('KeyW');
      console.log('after walk:', JSON.stringify(await state(page)));
      await page.screenshot({ path: `${OUT}/smoke-play.jpg`, type: 'jpeg', quality: 85 });
      console.log('errors:', errors.length ? errors.join('\n') : 'none');
    } else if (mode === 'mission') {
      const n = parseInt(arg || '0', 10);
      ({ browser, page, errors } = await launch(BASE + '/'));
      await newGame(page);
      const res = await page.evaluate(async (n) => {
        const g = window.__solmar.game;
        const log = [];
        const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
        const st = () => window.__solmar.state();
        const ids = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10'];
        const press = (code) => {
          window.dispatchEvent(new KeyboardEvent('keydown', { code }));
          window.dispatchEvent(new KeyboardEvent('keyup', { code }));
        };
        const hold = async (code, ms) => {
          window.dispatchEvent(new KeyboardEvent('keydown', { code }));
          await sleep2(ms);
          window.dispatchEvent(new KeyboardEvent('keyup', { code }));
        };
        const stealNearest = async (cls) => {
          const cars = g.traffic.cars.filter((c) => !cls || c.cls === cls);
          if (!cars.length) return false;
          const px = g.player.x, pz = g.player.z;
          const c = cars.reduce((a, b) => Math.hypot(a.x - px, a.z - pz) < Math.hypot(b.x - px, b.z - pz) ? a : b);
          g.player.x = c.x; g.player.z = c.z;
          await sleep2(150);
          press('KeyE');
          await sleep2(300);
          return !!g.playerCar;
        };
        g.missions.index = n;
        g.missions.startStory();
        log.push('started: ' + JSON.stringify(st()));
        const t0 = Date.now();
        let lastStage = -1;
        let lastLog = 0;
        while (Date.now() - t0 < 100000) {
          const s = st();
          if (s.mission === null) { log.push('ALL MISSIONS DONE — cash $' + s.cash + ' respect ' + s.respect); break; }
          const cur = g.missions.currentMission();
          if (cur && cur.id !== ids[n]) { log.push('advanced past ' + ids[n] + ' to ' + cur.id + ' — mission complete'); break; }
          if (g.missions.stage !== lastStage) {
            lastStage = g.missions.stage;
            log.push(`stage ${lastStage}: ${g.missions.objectiveText()}`);
          }
          const stage = g.missions.currentStage();
          const mp = g.missions.markerPos;
          if (!stage) { await sleep2(100); continue; }
          if (stage.type === 'steal') {
            await stealNearest(null);
          } else if (stage.type === 'stealNamed') {
            await stealNearest(stage.vehicle);
          } else if (stage.type === 'boat') {
            const boat = g.vehicles.find((v) => v.cls === 'boat' && !v.dead);
            if (boat) {
              g.player.x = boat.x; g.player.z = boat.z;
              await sleep2(150);
              press('KeyE');
              await sleep2(300);
            }
          } else if (stage.type === 'kill') {
            const es = g.combat.enemies.filter((e) => !e.dead);
            if (es.length) {
              // the real flow grants the SMG after m3; use it here, and keep
              // ~18 m from the target (enemy hit chance falls with distance)
              if (!g.combat.hasWeapon('smg')) g.combat.giveWeapon('smg', 96);
              g.combat.select('smg');
              const e = es[0];
              const ang = Math.atan2(e.x - g.player.x, e.z - g.player.z);
              g.player.x = e.x - Math.sin(ang) * 18;
              g.player.z = e.z - Math.cos(ang) * 18;
              // face the enemy: the camera's view direction is
              // (sin yaw, cos yaw), so yaw = atan2(dx, dz) toward it
              const yaw = Math.atan2(e.x - g.player.x, e.z - g.player.z);
              g.player.heading = yaw;
              g.player.mesh.rotation.y = yaw;
              g.cameraRig.yaw = yaw;
              g.cameraRig.pitch = 0.05;
              await sleep2(200); // let the camera re-orient before firing
              // re-aim at the (moving) target before every shot
              for (let i = 0; i < 80 && g.combat.enemiesAlive() > 0; i++) {
                const t = g.combat.enemies.find((x) => !x.dead);
                if (!t) break;
                const y2 = Math.atan2(t.x - g.player.x, t.z - g.player.z);
                g.player.heading = y2;
                g.player.mesh.rotation.y = y2;
                g.cameraRig.yaw = y2;
                g.combat.shoot(g.camera, g.player, null, () => {});
                await sleep2(100);
              }
            }
          } else if (stage.type === 'talk' || stage.type === 'collect') {
            if (mp) {
              if (g.playerCar) { g.playerCar.x = mp.x; g.playerCar.z = mp.z; }
              else { g.player.x = mp.x; g.player.z = mp.z; }
              await sleep2(200);
              if (stage.hold) await hold('KeyF', 12000);
              else { press('KeyF'); await sleep2(300); }
            }
          } else if (mp) {
            // goto / deliver / survive / race: teleport to the marker
            // (the race marker is the next waypoint; the car goes with the player)
            const dist = Math.hypot((g.playerCar ? g.playerCar.x : g.player.x) - mp.x, (g.playerCar ? g.playerCar.z : g.player.z) - mp.z);
            if (dist > 6) {
              if (g.playerCar) { g.playerCar.x = mp.x; g.playerCar.z = mp.z; }
              else { g.player.x = mp.x; g.player.z = mp.z; }
            }
          }
          if (Date.now() - lastLog > 15000) {
            lastLog = Date.now();
            log.push('... still on ' + (cur ? cur.id : '?') + ' stage ' + g.missions.stage + ' — ' + JSON.stringify(st()));
          }
          await sleep2(100);
        }
        log.push('end: ' + JSON.stringify(st()));
        return log;
      }, n);
      console.log(res.join('\n'));
      await page.screenshot({ path: `${OUT}/mission-${n + 1}.jpg`, type: 'jpeg', quality: 85 });
      console.log('errors:', errors.length ? errors.join('\n') : 'none');
    } else if (mode === 'race') {
      ({ browser, page, errors } = await launch(BASE + '/'));
      await newGame(page);
      const res = await page.evaluate(async () => {
        const g = window.__solmar.game;
        const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
        g.missions.startSideRace('harbour');
        const log = ['race started: ' + g.missions.objectiveText()];
        const t0 = Date.now();
        while (Date.now() - t0 < 90000) {
          const r = g.missions.raceState;
          if (!r) { log.push('race over'); break; }
          const wp = r.waypoints[r.wp];
          if (wp && g.playerCar) {
            g.playerCar.x = wp.x; g.playerCar.z = wp.z;
          }
          await sleep2(100);
        }
        log.push('end: ' + JSON.stringify(window.__solmar.state()));
        return log;
      });
      console.log(res.join('\n'));
      console.log('errors:', errors.length ? errors.join('\n') : 'none');
    } else if (mode === 'chase') {
      ({ browser, page, errors } = await launch(BASE + '/'));
      await newGame(page);
      await page.evaluate(() => {
        const g = window.__solmar.game;
        const c = g.traffic.cars[0];
        g.player.x = c.x; g.player.z = c.z;
      });
      await page.keyboard.press('KeyE');
      await sleep(500);
      console.log('after carjack:', JSON.stringify(await state(page)));
      await page.evaluate(() => { window.__solmar.setWanted(3); });
      await sleep(3000);
      console.log('after 3 stars:', JSON.stringify(await state(page)));
      const policeCount = await page.evaluate(() => window.__solmar.game.police.cars.length);
      console.log('police cars on scene:', policeCount);
      await page.keyboard.down('KeyW');
      await sleep(4000);
      await page.keyboard.up('KeyW');
      console.log('after driving:', JSON.stringify(await state(page)));
      await page.screenshot({ path: `${OUT}/chase-test.jpg`, type: 'jpeg', quality: 85 });
      console.log('errors:', errors.length ? errors.join('\n') : 'none');
    } else if (mode === 'drive') {
      ({ browser, page, errors } = await launch(BASE + '/'));
      await newGame(page);
      await page.evaluate(() => {
        const g = window.__solmar.game;
        const c = g.traffic.cars[0];
        g.player.x = c.x; g.player.z = c.z;
      });
      await page.keyboard.press('KeyE');
      await sleep(300);
      const before = await state(page);
      await page.keyboard.down('KeyW');
      await sleep(5000);
      await page.keyboard.up('KeyW');
      const after = await state(page);
      console.log('before:', JSON.stringify(before));
      console.log('after 5s W:', JSON.stringify(after));
      console.log('moved:', Math.hypot(after.x - before.x, after.z - before.z).toFixed(1), 'm, speed', after.speed.toFixed(1));
      await page.screenshot({ path: `${OUT}/drive-test.jpg`, type: 'jpeg', quality: 85 });
      console.log('errors:', errors.length ? errors.join('\n') : 'none');
    } else if (mode === 'continue') {
      ({ browser, page, errors } = await launch(BASE + '/'));
      await newGame(page);
      await page.evaluate(async () => {
        const g = window.__solmar.game;
        const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
        g.missions.index = 0;
        g.missions.startStory();
        for (let i = 0; i < 20; i++) {
          const mp = g.missions.markerPos;
          if (mp) { g.player.x = mp.x; g.player.z = mp.z; }
          await sleep2(200);
          if (g.missions.stage > 0) break;
        }
        g.addCash(1234);
        g.addRespect(150);
        g.saveNow();
      });
      const saved = await state(page);
      console.log('saved state:', JSON.stringify(saved));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await sleep(1000);
      const contVisible = await page.evaluate(() => {
        const b = document.getElementById('btn-continue');
        return b && b.style.display !== 'none';
      });
      console.log('Continue button visible after reload:', contVisible);
      await page.click('#btn-continue');
      await sleep(1500);
      const resumed = await state(page);
      console.log('resumed state:', JSON.stringify(resumed));
      console.log('cash matches (1734 = 500+1234):', resumed.cash === 1734, '| respect 150:', resumed.respect === 150, '| mission m1:', resumed.mission === 'm1');
      console.log('errors:', errors.length ? errors.join('\n') : 'none');
    } else if (mode === 'audio') {
      ({ browser, page, errors } = await launch(BASE + '/'));
      await newGame(page);
      await sleep(1000);
      const audio = await page.evaluate(async () => {
        const g = window.__solmar.game;
        g.audio.ensure();
        await new Promise((r) => setTimeout(r, 800));
        const ctx = g.audio.ctx;
        return { running: g.audio.running, state: ctx ? ctx.state : 'no ctx', station: g.audio.stationName, level: g.audio.level() };
      });
      console.log('audio:', JSON.stringify(audio));
      await page.evaluate(() => { const g = window.__solmar.game; g.audio.gunshot(); g.audio.explosion(); });
      await sleep(300);
      const audio2 = await page.evaluate(() => window.__solmar.game.audio.level());
      console.log('after sfx:', JSON.stringify(audio2));
      console.log('errors:', errors.length ? errors.join('\n') : 'none');
    }
  } catch (e) {
    console.error('TEST FAILED:', e.message);
    if (page) {
      try { console.log('last state:', JSON.stringify(await state(page))); } catch {}
      try { await page.screenshot({ path: `${OUT}/fail-${mode}.jpg`, type: 'jpeg', quality: 85 }); } catch {}
    }
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
  }
}
main();
