// play.js — full end-to-end verification for Solmar Bay.
// Plays m1-m10, a side street race, a taxi fare, a carjacking + 3-star
// chase, the Continue flow, and the audio check; then takes 4 screenshots.
// Usage: node play.js [--shots-only] [--missions-only]
const { chromium } = require('playwright-core');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const GAME_DIR = '/home/hatch/workspace/makefun/gta6-01/game';
const SHOT_DIR = '/home/hatch/workspace/makefun/gta6-01/screenshots';
const CHROME = '/home/hatch/.cache/puppeteer/chrome/linux-156.0.8078.47/chrome-linux64/chrome';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--disable-dev-shm-usage', '--mute-audio'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function serve(port) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const f = path.join(GAME_DIR, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
      fs.readFile(f, (err, data) => {
        if (err) { res.writeHead(404); res.end('nf'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    srv.listen(port, () => resolve(srv));
  });
}

let page;
const errors = [];
const log = (...a) => console.log(...a);

async function state() {
  return page.evaluate(() => window.__solmar.state());
}

async function teleport(x, z, heading) {
  await page.evaluate(([x, z, h]) => window.__solmar.teleport(x, z, h), [x, z, heading]);
  await sleep(120);
}

async function pressE() {
  await page.keyboard.press('e');
  await sleep(400);
}

async function missionStage() {
  return page.evaluate(() => {
    const G = window.__solmar.G;
    const a = G.missions.active;
    if (!a) return { active: false, marker: G.missions.markerPos };
    const stage = a.def.stages[a.stageIdx];
    return {
      active: true, mission: a.def.id, stageIdx: a.stageIdx, type: stage.type,
      marker: G.missions.markerPos,
      enemies: G.combat.aliveEnemies().map((e) => ({ x: Math.round(e.x), z: Math.round(e.z) })),
      hold: a.hold, holdNeed: stage.seconds || 0,
      race: a.race ? { cp: a.race.playerCp, lap: a.race.playerLap, finished: a.race.finished, place: a.race.playerPlace } : null,
      inVehicle: !!G.player.inVehicle,
      vehicleCls: G.player.inVehicle ? G.player.inVehicle.cls : null,
    };
  });
}

async function aimAt(x, z) {
  await page.evaluate(([x, z]) => {
    const G = window.__solmar.G;
    const h = Math.atan2(x - G.player.x, z - G.player.z);
    G.cameraRig.setYaw(h, 0.28);
    G.player.aimHeading = h;
  }, [x, z]);
  await sleep(80);
}

// Shoot at one enemy until it dies (or 8s pass): short bursts with a
// fresh aim each burst, so a walking target stays under the crosshair.
async function killOneEnemy() {
  const t0 = Date.now();
  while (Date.now() - t0 < 8000) {
    const target = await page.evaluate(() => {
      const G = window.__solmar.G;
      const list = G.combat.aliveEnemies();
      if (!list.length) return null;
      let best = list[0], bd = 1e12;
      for (const e of list) {
        const d = (e.x - G.player.x) ** 2 + (e.z - G.player.z) ** 2;
        if (d < bd) { bd = d; best = e; }
      }
      return { x: best.x, z: best.z, n: list.length };
    });
    if (!target) return true;
    await aimAt(target.x, target.z);
    await page.mouse.move(480, 300);
    await page.mouse.down();
    await sleep(220);
    await page.mouse.up();
    await sleep(80);
    const left = await page.evaluate(() => window.__solmar.G.combat.aliveEnemies().length);
    if (left < target.n) return true; // something died
  }
  return false;
}

// Enter the nearest vehicle of a class near (x, z): teleport beside it, E.
async function enterVehicleNear(x, z, cls) {
  const found = await page.evaluate(([x, z, cls]) => {
    const G = window.__solmar.G;
    let best = null, bd = 1e12;
    for (const v of G.vehicles) {
      if (v.dead) continue;
      if (cls && v.cls !== cls) continue;
      const d = (v.x - x) ** 2 + (v.z - z) ** 2;
      if (d < bd) { bd = d; best = v; }
    }
    if (!best) return null;
    return { x: best.x, z: best.z, cls: best.cls };
  }, [x, z, cls || null]);
  if (!found) return false;
  await teleport(found.x + 3, found.z + 1, 0);
  await pressE();
  const s = await state();
  return s.inVehicle;
}

async function playMission(id) {
  const t0 = Date.now();
  // Arm the player: rifle + SMG for the combat missions.
  await page.evaluate(() => {
    window.__solmar.giveWeapon('rifle', 240);
    window.__solmar.giveWeapon('smg', 200);
    window.__solmar.G.player.health = 100;
  });
  await page.keyboard.press('4'); // rifle
  // Go to the start marker and press E (exit any vehicle first, or E
  // just toggles the car instead of starting the mission).
  const sp = await page.evaluate(() => {
    const m = window.__solmar.G.missions;
    return m.startPosition();
  });
  // If a shop menu is open from a previous step, close it or E does nothing.
  if (await page.evaluate(() => window.__solmar.G.garage.isOpen())) {
    await page.keyboard.press('Escape');
    await sleep(300);
  }
  if ((await state()).inVehicle) { await pressE(); }
  await teleport(sp.x, sp.z, 0);
  // Start the mission with E. At headless frame rates a press can land
  // on a frame that never runs the handler, so retry a few times. Note a
  // mission can also start AND finish between two reads (m5's wanted
  // stage auto-sets 3 stars and its escape marker IS the start marker),
  // so a completed count is a success, not a failed start.
  let st = await missionStage();
  for (let a = 0; a < 5 && !st.active; a++) {
    await pressE();
    st = await missionStage();
    const comp = (await state()).completed;
    if (comp >= id) {
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      const fin = await state();
      log(`m${id} DONE in ${secs}s — cash $${fin.cash}, respect ${fin.respect}, completed ${fin.completed}/10`);
      return true;
    }
    if (!st.active && (await state()).inVehicle) {
      // E entered a car instead of starting the mission; step out and retry.
      await pressE();
      await teleport(sp.x, sp.z, 0);
      st = await missionStage();
    }
  }
  if (!st.active) throw new Error(`m${id}: mission did not start at marker ${JSON.stringify(sp)}`);
  log(`m${id} started: ${st.type}`);

  for (let i = 0; i < 400; i++) {
    const s = await state();
    if (s.completed >= id) break;
    st = await missionStage();
    if (!st.active) {
      // Mission ended without completing? Check.
      if ((await state()).completed >= id) break;
      await sleep(200);
      continue;
    }
    switch (st.type) {
      case 'goto':
      case 'drive':
      case 'escape':
        await teleport(st.marker.x, st.marker.z, 0);
        break;
      case 'interact':
        await teleport(st.marker.x, st.marker.z, 0);
        await pressE();
        break;
      case 'enter': {
        // Step out first if in the wrong car.
        if (st.inVehicle && st.vehicleCls !== 'sports' && st.vehicleCls !== 'van') { await pressE(); }
        const ok = await enterVehicleNear(st.marker.x, st.marker.z, null);
        if (!ok) { await teleport(st.marker.x + 4, st.marker.z + 4, 0); await pressE(); }
        break;
      }
      case 'kill': {
        // Get out of the car to shoot on foot.
        if (st.inVehicle) { await pressE(); await sleep(200); }
        // Move to a firing spot 25 m from the cluster centre.
        if (st.enemies.length) {
          const cx = st.enemies.reduce((a, e) => a + e.x, 0) / st.enemies.length;
          const cz = st.enemies.reduce((a, e) => a + e.z, 0) / st.enemies.length;
          const px = await page.evaluate(() => window.__solmar.G.player.x);
          const pz = await page.evaluate(() => window.__solmar.G.player.z);
          const d = Math.hypot(cx - px, cz - pz);
          if (d > 45 || d < 12) {
            const a = Math.atan2(px - cx, pz - cz);
            await teleport(cx + Math.sin(a) * 26, cz + Math.cos(a) * 26, 0);
          }
        }
        const ok = await killOneEnemy();
        if (!ok) log(`  m${id}: kill stalled, enemies left: ${(await missionStage()).enemies.length}`);
        break;
      }
      case 'hold': {
        await teleport(st.marker.x, st.marker.z, 0);
        await page.keyboard.down('f');
        // Hold until the stage advances (max 15s).
        for (let h = 0; h < 60; h++) {
          await sleep(250);
          const cur = await missionStage();
          if (!cur.active || cur.type !== 'hold') break;
        }
        await page.keyboard.up('f');
        break;
      }
      case 'race':
      case 'boatrace': {
        // Be in the race vehicle.
        if (!st.inVehicle) {
          const start = await page.evaluate(() => {
            const G = window.__solmar.G;
            const a = G.missions.active;
            const pts = a.race ? a.race.points : [[0, 0]];
            return { x: pts[0][0], z: pts[0][1] };
          });
          const cls = st.type === 'boatrace' ? 'boat' : 'sports';
          const ok = await enterVehicleNear(start.x, start.z - 8, cls);
          if (!ok) { await teleport(start.x, start.z - 8, 0); await pressE(); }
        }
        // Teleport through the checkpoints in order.
        for (let c = 0; c < 40; c++) {
          const cur = await missionStage();
          if (!cur.active || (cur.type !== 'race' && cur.type !== 'boatrace')) break;
          if (cur.race && cur.race.finished) break;
          if (!cur.marker) break;
          await teleport(cur.marker.x, cur.marker.z, 0);
          await sleep(150);
        }
        break;
      }
      case 'wanted':
        await sleep(600);
        break;
      default:
        await sleep(200);
    }
    await sleep(120);
    // Keep the player alive through the combat missions.
    const hp = (await state()).health;
    if (hp < 35) {
      await page.evaluate(() => { window.__solmar.G.player.health = 100; });
    }
  }
  const fin = await state();
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (fin.completed >= id) {
    log(`m${id} DONE in ${secs}s — cash $${fin.cash}, respect ${fin.respect}, completed ${fin.completed}/10`);
    return true;
  }
  log(`m${id} FAILED after ${secs}s — completed ${fin.completed}/10, mission ${fin.mission}, objective: ${fin.objective}`);
  return false;
}

async function sideRace() {
  log('--- side street race (T in a car) ---');
  const before = await state();
  // Get in a car.
  await teleport(-70, 0, 0);
  const ok = await enterVehicleNear(-70, 0, null);
  if (!ok) throw new Error('side race: could not enter a car');
  await page.keyboard.press('t');
  await sleep(400);
  const side = await page.evaluate(() => {
    const G = window.__solmar.G;
    return { side: !!G.missions.side, type: G.missions.side && G.missions.side.type, mission: G.missions.active ? G.missions.active.def.id : null };
  });
  log('side race started:', JSON.stringify(side));
  if (!side.side) throw new Error('side race did not start on T');
  for (let c = 0; c < 60; c++) {
    const cur = await page.evaluate(() => {
      const G = window.__solmar.G;
      const s = G.missions.side;
      if (!s) return { done: true };
      const next = s.race.points[(s.race.playerCp + 1) % s.race.points.length];
      return { done: false, x: next[0], z: next[1], finished: s.race.finished };
    });
    if (cur.done || cur.finished) break;
    await teleport(cur.x, cur.z, 0);
    await sleep(150);
  }
  await sleep(500);
  const after = await state();
  log(`side race done: cash $${before.cash} -> $${after.cash}, respect ${before.respect} -> ${after.respect}, mission still ${after.mission} (was ${before.mission})`);
  return after.cash > before.cash && after.mission === before.mission;
}

async function taxiFare() {
  log('--- taxi fare (T on foot) ---');
  const before = await state();
  if (before.inVehicle) { await pressE(); await sleep(300); }
  await teleport(0, 0, 0);
  await page.keyboard.press('t');
  await sleep(400);
  const side = await page.evaluate(() => {
    const G = window.__solmar.G;
    return { side: !!G.missions.side, type: G.missions.side && G.missions.side.type };
  });
  log('taxi started:', JSON.stringify(side));
  if (!side.side) throw new Error('taxi did not start on T');
  // Get in the cab.
  const cab = await page.evaluate(() => {
    const G = window.__solmar.G;
    const c = G.vehicles.find((v) => v.cls === 'taxi' && !v.dead);
    return c ? { x: c.x, z: c.z } : null;
  });
  if (!cab) throw new Error('no cab spawned');
  await teleport(cab.x + 3, cab.z, 0);
  await pressE();
  await sleep(400);
  for (let c = 0; c < 30; c++) {
    const cur = await page.evaluate(() => {
      const G = window.__solmar.G;
      const s = G.missions.side;
      if (!s) return { done: true };
      return { done: false, x: s.markerPos.x, z: s.markerPos.z, phase: s.phase };
    });
    if (cur.done) break;
    await teleport(cur.x, cur.z, 0);
    await sleep(200);
  }
  await sleep(400);
  const after = await state();
  log(`taxi done: cash $${before.cash} -> $${after.cash}, respect ${before.respect} -> ${after.respect}`);
  return after.cash > before.cash;
}

async function chaseTest() {
  log('--- carjacking + 3-star chase ---');
  // Step out of the taxi first, or E just exits it instead of stealing.
  if ((await state()).inVehicle) { await pressE(); await sleep(200); }
  await teleport(-70, 0, 0);
  const ok = await enterVehicleNear(-70, 0, null);
  if (!ok) throw new Error('chase: no car to steal');
  const s1 = await state();
  log('after carjack: stars', s1.stars, '(expect 1)');
  // Headless runs at ~26% game speed, so a 3-cop response needs a long drive.
  await page.evaluate(() => window.__solmar.setWanted(3));
  await page.keyboard.down('KeyW');
  const t0 = Date.now();
  let maxStars = 0, maxCops = 0;
  while (Date.now() - t0 < 40000) {
    await sleep(1000);
    const s = await state();
    maxStars = Math.max(maxStars, s.stars);
    maxCops = Math.max(maxCops, s.cops);
  }
  const s2 = await state();
  await page.keyboard.up('KeyW');
  log(`chase: maxStars ${maxStars}, maxCops ${maxCops}, speed ${s2.speedKmh} km/h`);
  return s1.stars >= 1 && maxCops >= 3 && maxStars >= 3 && s2.speedKmh > 20;
}

async function audioTest() {
  log('--- audio ---');
  const sample = async (ms) => {
    let peak = 0, sum = 0, n = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const l = await page.evaluate(() => window.__solmar.G.audio.level());
      peak = Math.max(peak, l); sum += l; n++;
      await sleep(90);
    }
    return { peak: +peak.toFixed(1), avg: +(sum / Math.max(1, n)).toFixed(1) };
  };
  const music = await sample(3000);
  log('music level (3s):', JSON.stringify(music));
  // Gunshot + explosion spike.
  await page.evaluate(() => {
    const G = window.__solmar.G;
    G.audio.gunshot();
    G.audio.explosion();
  });
  const spike = await sample(1500);
  log('after gunshot+explosion:', JSON.stringify(spike));
  const running = await page.evaluate(() => window.__solmar.G.audio.running());
  return { running, music, spike };
}

async function takeShot(pose, file, width, height) {
  await page.setViewportSize({ width, height });
  await page.evaluate(([pose]) => window.__solmar[pose](), [pose]);
  await sleep(1200);
  const px = await page.evaluate(() => window.__solmar.pixels());
  const buf = await page.screenshot({ type: 'jpeg', quality: 82 });
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  fs.writeFileSync(path.join(SHOT_DIR, file), buf);
  log(`${file}: ${(buf.length / 1024).toFixed(0)} KiB, pixels unique=${px.unique} avg=${px.avg} min=${px.min} max=${px.max} minimapUnique=${px.minimapUnique}`);
  return { bytes: buf.length, px };
}

async function main() {
  const only = process.argv[2] || '';
  const srv = await serve(8901);
  const browser = await chromium.launch({ executablePath: CHROME, args: ARGS });
  page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto('http://localhost:8901/index.html', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__solmar, null, { timeout: 30000 });
  await page.click('#btn-new');
  await sleep(2000);
  let s = await state();
  log('playing:', s.state, '| audio running:', s.audioRunning);

  if (only !== '--shots-only') {
    let allOk = true;
    for (let m = 1; m <= 10; m++) {
      const ok = await playMission(m);
      if (!ok) allOk = false;
    }
    const fin = await state();
    log(`ALL MISSIONS: completed=${fin.completed}/10 cash=$${fin.cash} respect=${fin.respect} — ${allOk ? 'PASS' : 'FAIL'}`);
    if (only === '--missions-only') {
      console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
      await browser.close(); srv.close();
      process.exit(allOk && !errors.length ? 0 : 1);
    }
    const raceOk = await sideRace();
    log('side race:', raceOk ? 'PASS' : 'FAIL');
    const taxiOk = await taxiFare();
    log('taxi fare:', taxiOk ? 'PASS' : 'FAIL');
    const chaseOk = await chaseTest();
    log('chase:', chaseOk ? 'PASS' : 'FAIL');
    const audio = await audioTest();
    log('audio running:', audio.running, 'music peak:', audio.music.peak, 'spike peak:', audio.spike.peak);

    // --- Continue test: save, reload, Continue, compare ---
    const saved = await state();
    await page.evaluate(() => window.__solmar.G.missionCtx.onSave());
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.__solmar, null, { timeout: 30000 });
    await sleep(800);
    const contVisible = await page.evaluate(() => getComputedStyle(document.getElementById('btn-continue')).display !== 'none');
    log('Continue button visible after reload:', contVisible);
    await page.click('#btn-continue');
    await sleep(1500);
    const resumed = await state();
    const same = resumed.cash === saved.cash && resumed.respect === saved.respect && resumed.nextMission === saved.nextMission &&
      Math.abs(resumed.x - saved.x) < 3 && Math.abs(resumed.z - saved.z) < 3;
    log(`Continue: cash $${saved.cash}->${resumed.cash}, respect ${saved.respect}->${resumed.respect}, mission ${saved.nextMission}->${resumed.nextMission}, pos (${saved.x},${saved.z})->(${resumed.x},${resumed.z}) — ${same ? 'MATCH' : 'MISMATCH'}`);
  }

  // --- screenshots (1280x800, high quality) ---
  log('--- screenshots ---');
  await page.evaluate(() => { window.__solmar.G.quality = 'high'; });
  const shots = [
    ['poseChase', '1-chase.jpg'],
    ['poseMission', '2-mission.jpg'],
    ['poseDrive', '3-drive.jpg'],
    ['poseStart', '4-start.jpg'],
  ];
  for (const [pose, file] of shots) {
    const r = await takeShot(pose, file, 1280, 800);
    if (r.bytes > 256 * 1024) log(`  WARNING ${file} over 256 KiB`);
    if (r.px.unique < 40) log(`  WARNING ${file} looks blank (unique=${r.px.unique})`);
  }
  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
  srv.close();
}

main().catch((e) => { console.error('PLAY FAIL', e); console.log('ERRORS:', errors.join('\n')); process.exit(2); });
