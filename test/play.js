// Full play-test: plays all 10 story missions end-to-end with a
// keyboard/mouse driver, verifies the side race, taxi, carjacking,
// audio and Continue, and reports honest per-mission results.
// Kill stages are verified with a focused aim probe (aim the camera
// at each enemy and shoot until it dies); the full driver's aim while
// the fight moves is a known flaky spot, so the probe — not the
// driver's kill count — is what proves the combat mechanics.
// Usage: node test/play.js
import { createRequire } from 'node:module';
const require = createRequire('/tmp/gta6-test/package.json');
const { chromium } = require('playwright-core');
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
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
  executablePath: '/home/hatch/.cache/puppeteer/chrome/linux-156.0.8078.47/chrome-linux64/chrome',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 300)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

// ---- game state ----
async function st() {
  return await page.evaluate(() => {
    const G = window.G;
    const m = G.missions;
    const cur = m.currentStage();
    return {
      x: G.player.x, z: G.player.z, heading: G.player.heading,
      speed: G.player.speed, health: G.player.health,
      inCar: !!G.player.vehicle, veh: G.player.vehicle ? G.player.vehicle.type : null,
      vehSpeed: G.player.vehicle ? G.player.vehicle.speed : 0,
      cash: G.cash, respect: G.respect,
      mission: m.index, stage: m.stage, stageKind: cur ? cur.kind : null,
      obj: m.objective ? { x: m.objective.x, z: m.objective.z, text: m.objective.text } : null,
      race: m.race ? { next: m.race.next, points: m.race.points, t: m.race.t, limit: m.race.limit } : null,
      wanted: G.police.wanted, cops: G.police.cops.length,
      enemies: G.combat.enemies.map((e) => ({ x: e.x, z: e.z, hp: e.hp, dead: e.dead })),
      alive: G.combat.aliveCount(),
      camYaw: G.cameraRig.yaw, camPitch: G.cameraRig.pitch,
      state: G.state,
      coins: G.activities.coins,
      sideRace: G.activities.race ? { next: G.activities.race.next, points: G.activities.race.def.points } : null,
      taxi: G.activities.taxi ? { state: G.activities.taxi.state, from: G.activities.taxi.from, to: G.activities.taxi.to } : null,
    };
  });
}
async function ev(fn, ...args) { return await page.evaluate(fn, ...args); }
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

// ---- keys ----
const held = new Set();
async function setKeys(want) {
  // want: array of key codes to hold down (e.g. ['KeyW','KeyA'])
  for (const k of [...held]) {
    if (!want.includes(k)) { await page.keyboard.up(k); held.delete(k); }
  }
  for (const k of want) {
    if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
  }
}
async function tapKey(k, ms = 120) {
  await page.keyboard.down(k); await sleep(ms); await page.keyboard.up(k);
}
async function releaseAll() { await setKeys([]); }
// Poll until pred(state) is true, or the timeout elapses. The game runs
// at ~3 FPS headless, so a state change can take a full frame to land.
async function waitState(pred, timeoutMs = 3000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const s = await st();
    if (pred(s)) return s;
    await sleep(150);
  }
  return await st();
}

// ---- navigation ----
// Drive (or walk, or sail) to a point, following the road grid:
// the straight line cuts through buildings, so the route goes via
// the nearest intersection, along one road, then along the cross
// road to the intersection nearest the target, then to the target.
function roadWaypoints(x, z, tx, tz) {
  const B = 48;
  const rx = Math.round(x / B) * B, rz = Math.round(z / B) * B;
  const rtx = Math.round(tx / B) * B, rtz = Math.round(tz / B) * B;
  const pts = [];
  if (Math.hypot(rx - x, rz - z) > 2) pts.push([rx, rz]);
  if (Math.abs(rtx - rx) > 2) pts.push([rtx, rz]);
  if (Math.abs(rtz - rz) > 2) pts.push([rtx, rtz]);
  pts.push([tx, tz]);
  return pts;
}

async function goLeg(tx, tz, radius, timeoutMs) {
  const t0 = Date.now();
  let lastDist = 1e9, lastMove = Date.now();
  let reversing = 0;
  while (Date.now() - t0 < timeoutMs) {
    const s = await st();
    const dx = tx - s.x, dz = tz - s.z;
    const d = Math.hypot(dx, dz);
    if (d < radius) { await releaseAll(); return true; }
    if (d < lastDist - 0.5) { lastMove = Date.now(); lastDist = d; }
    if (Date.now() - lastMove > 4000) {
      // Wedged: reverse out, then try again.
      await setKeys(['KeyS']); await sleep(1100);
      await setKeys(['KeyW', 'KeyA']); await sleep(600);
      lastMove = Date.now(); lastDist = 1e9;
      continue;
    }
    if (s.inCar) {
      // Car / boat: steer by heading.
      const want = Math.atan2(dz, dx);
      const diff = angDiff(want, s.heading);
      const spd = Math.abs(s.vehSpeed);
      const keys = [];
      if (reversing > 0) {
        keys.push('KeyS', diff > 0 ? 'KeyA' : 'KeyD');
        reversing -= 100;
      } else if (Math.abs(diff) > 2.4) {
        keys.push('KeyS', diff > 0 ? 'KeyA' : 'KeyD');
        reversing = 500;
      } else {
        if (Math.abs(diff) <= 0.9 || spd <= 9) keys.push('KeyW');
        if (diff > 0.12) keys.push('KeyD');
        else if (diff < -0.12) keys.push('KeyA');
        if (Math.abs(diff) > 0.9 && spd > 14) keys.push('Space');
      }
      await setKeys(keys);
    } else {
      // On foot: face the camera at the target, then walk.
      await ev(([tx2, tz2]) => {
        const G = window.G;
        G.cameraRig.yaw = Math.atan2(tx2 - G.player.x, tz2 - G.player.z);
      }, [tx, tz]);
      await setKeys(['KeyW', 'ShiftLeft']);
    }
    await sleep(100);
  }
  await releaseAll();
  return false;
}

async function goTo(tx, tz, radius = 6, timeoutMs = 90000) {
  const s0 = await st();
  // The Marlin sails open water: no roads to follow, so steer straight
  // at the target. Road waypoints would drag it onto land it cannot
  // reach (the boat is clamped to x >= 300).
  const legs = s0.veh === 'marlin' ? [[tx, tz]] : roadWaypoints(s0.x, s0.z, tx, tz);
  for (let i = 0; i < legs.length; i++) {
    const [lx, lz] = legs[i];
    const isLast = i === legs.length - 1;
    const ok = await goLeg(lx, lz, isLast ? radius : 4, Math.max(20000, timeoutMs / legs.length));
    if (!ok) return false;
  }
  return true;
}

async function aimAt(x, y, z) {
  await ev(([ex, ey, ez]) => {
    const G = window.G;
    const cx = G.player.x, cz = G.player.z;
    G.cameraRig.yaw = Math.atan2(ex - cx, ez - cz);
    G.cameraRig.pitch = 0.02;
  }, [x, y, z]);
  await sleep(350);
}

// Shoot one enemy until it dies (or the attempt budget runs out).
// Returns {killed, shots, hits}.
async function shootEnemy(idx, maxShots = 24) {
  let shots = 0, hits = 0;
  for (let i = 0; i < maxShots; i++) {
    const s = await st();
    const e = s.enemies[idx];
    if (!e || e.dead) return { killed: true, shots, hits };
    const hpBefore = e.hp;
    await aimAt(e.x, 1.2, e.z);
    await page.mouse.click(320, 200);
    shots++;
    await sleep(380);
    const s2 = await st();
    const e2 = s2.enemies[idx];
    if (e2 && e2.hp < hpBefore) hits++;
    if (e2 && e2.dead) return { killed: true, shots, hits };
    // Step closer if the shots are not landing.
    if (shots % 6 === 0) {
      const d = Math.hypot(e.x - s2.x, e.z - s2.z);
      if (d > 9) {
        const nx = e.x + (s2.x - e.x) / d * 9;
        const nz = e.z + (s2.z - e.z) / d * 9;
        await goTo(nx, nz, 2, 20000);
      }
    }
  }
  const s = await st();
  return { killed: !!(s.enemies[idx] && s.enemies[idx].dead), shots, hits };
}

// ---- boot ----
await page.goto(`http://localhost:${port}/index.html?autostart=1&seed=7&low=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.G && window.G.ready, null, { timeout: 20000 });
await sleep(1500);
let s = await st();
log(`boot: state=${s.state} mission=${s.mission} cash=$${s.cash} pos=(${s.x.toFixed(0)},${s.z.toFixed(0)})`);

// ---- audio probe ----
const peak1 = await ev(() => { window.G.audio.ensure(); return window.G.audio.peak(); });
await sleep(2000);
const peak2 = await ev(() => window.G.audio.peak());
log(`audio: music peak=${peak2.peak} avg=${peak2.avg.toFixed(1)} (ctx running: ${await ev(() => window.G.audio.ctx && window.G.audio.ctx.state)})`);
// Fire a shot for the sfx spike: sample the analyser in a tight loop
// right after the click, since the burst only lasts ~0.12 s.
await page.mouse.click(320, 200);
let shotPeak = 0;
for (let i = 0; i < 10; i++) {
  const p = await ev(() => window.G.audio.peak());
  if (p.peak > shotPeak) shotPeak = p.peak;
  await sleep(25);
}
log(`audio: after gunshot peak=${shotPeak}`);

// ---- carjacking + chase ----
// A moving traffic car outruns the player on foot, so the driver
// stands on a busy road and grabs one as it passes.
{
  // Stand on the x=0 avenue where traffic is thick.
  const ok = await goTo(0, 0, 3, 60000);
  let jacked = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 90000 && !jacked) {
    const near = await ev(() => {
      const G = window.G;
      let best = null, bd = 10;
      for (const v of G.traffic) {
        if (v.driver !== 'npc' || v.kind === 'parked') continue;
        const d = Math.hypot(v.x - G.player.x, v.z - G.player.z);
        if (d < bd) { bd = d; best = { type: v.type, d }; }
      }
      return best;
    });
    if (near) {
      // Tap E repeatedly while the car is close: at ~3 FPS a single tap
      // can land a frame late, after the car has driven past the 5.5 m
      // enter range. Repeated taps mean one lands while it is in range.
      // Each attempt waits one frame (~350 ms) for the press to land
      // before checking, so a success is never undone by a second tap.
      for (let i = 0; i < 10 && !jacked; i++) {
        await tapKey('KeyE', 80);
        const s2 = await waitState(x => x.inCar, 350);
        if (s2.inCar) { jacked = true; break; }
        await sleep(50);
      }
    }
    await sleep(80);
  }
  s = await st();
  log(`carjack: jacked=${jacked} inCar=${s.inCar} veh=${s.veh} wanted=${s.wanted} cops=${s.cops}`);
  if (jacked) {
    await setKeys(['KeyW']); await sleep(2500); await releaseAll();
    s = await st();
    log(`carjack: chase check — wanted=${s.wanted} cops=${s.cops}`);
    await tapKey('KeyE', 200); // step out
    await sleep(500);
  }
}

// ---- campaign: all 10 missions ----
const missionResults = [];
const campaignT0 = Date.now();
let lastMission = -1;
while (Date.now() - campaignT0 < 720000) {
  s = await st();
  if (s.mission >= 10) break;
  if (s.state !== 'playing') {
    log(`campaign: state=${s.state} (waiting)`);
    await sleep(2000);
    continue;
  }
  if (s.mission !== lastMission) {
    lastMission = s.mission;
    log(`--- mission ${s.mission + 1} starts (cash $${s.cash}, respect ${s.respect}) ---`);
  }
  const kind = s.stageKind;
  const obj = s.obj;
  if (!kind) { await sleep(500); continue; }
  if (kind === 'go' || kind === 'drive' || kind === 'escape') {
    const t = obj || { x: 0, z: 0 };
    const r = kind === 'escape' ? 8 : 6;
    const ok = await goTo(t.x, t.z, r, 120000);
    if (!ok) log(`  stage ${kind}: FAILED to reach (${t.x},${t.z})`);
  } else if (kind === 'enter') {
    // Exit any car, walk to the wanted vehicle, press E.
    if (s.inCar) { await tapKey('KeyE', 200); await sleep(600); }
    const v = await ev(() => {
      const G = window.G;
      const want = G.missions.wantedVehicle;
      let best = null, bd = 1e9;
      for (const veh of G.vehicles) {
        if (veh.dead) continue;
        if (want && veh.type !== want) continue;
        const d = Math.hypot(veh.x - G.player.x, veh.z - G.player.z);
        if (d < bd) { bd = d; best = { x: veh.x, z: veh.z, type: veh.type }; }
      }
      return best;
    });
    if (v) {
      const ok = await goTo(v.x, v.z, 4, 60000);
      if (ok) {
        await tapKey('KeyE', 200);
        await sleep(800);
        s = await st();
        log(`  enter: inCar=${s.inCar} veh=${s.veh}`);
      } else log('  enter: could not reach the vehicle');
    } else log('  enter: no vehicle found');
  } else if (kind === 'race' || kind === 'boat') {
    const race = s.race;
    if (!race) { await sleep(300); continue; }
    const pt = race.points[race.next];
    const ok = await goTo(pt.x, pt.z, 10, 60000);
    if (!ok) log(`  ${kind}: missed checkpoint ${race.next + 1}`);
  } else if (kind === 'kill') {
    // Aim probe: shoot each living enemy until it dies.
    if (s.inCar) { await tapKey('KeyE', 200); await sleep(600); }
    s = await st();
    let probeShots = 0, probeHits = 0, probeKills = 0;
    for (let i = 0; i < s.enemies.length; i++) {
      if (s.enemies[i].dead) continue;
      // Walk to ~10 m of this enemy first.
      const e = s.enemies[i];
      const d = Math.hypot(e.x - s.x, e.z - s.z);
      if (d > 12) {
        const nx = e.x + (s.x - e.x) / d * 10;
        const nz = e.z + (s.z - e.z) / d * 10;
        await goTo(nx, nz, 3, 30000);
      }
      const r = await shootEnemy(i, 24);
      probeShots += r.shots; probeHits += r.hits;
      if (r.killed) probeKills++;
      log(`  kill probe: enemy ${i} killed=${r.killed} shots=${r.shots} hits=${r.hits}`);
      s = await st();
      if (s.alive === 0) break;
    }
    s = await st();
    log(`  kill stage: alive=${s.alive} probe ${probeKills} kills, ${probeHits}/${probeShots} hits`);
    if (s.alive > 0) {
      // One more pass over the survivors before giving up on the stage.
      for (let i = 0; i < s.enemies.length; i++) {
        if (s.enemies[i].dead) continue;
        const r = await shootEnemy(i, 16);
        log(`  kill retry: enemy ${i} killed=${r.killed} shots=${r.shots} hits=${r.hits}`);
        s = await st();
        if (s.alive === 0) break;
      }
    }
    if (s.alive > 0) {
      log(`  kill stage: STILL ${s.alive} alive after probe — stage not completed by driver`);
      break;
    }
  } else if (kind === 'hold') {
    const t = obj || { x: 0, z: 0 };
    const ok = await goTo(t.x, t.z, 12, 60000);
    if (ok) {
      // Hold F until the stage advances (vault crack).
      await page.keyboard.down('KeyF');
      const holdT0 = Date.now();
      while (Date.now() - holdT0 < 30000) {
        s = await st();
        if (s.stageKind !== 'hold') break;
        await sleep(300);
      }
      await page.keyboard.up('KeyF');
      s = await st();
      log(`  hold: stage now ${s.stageKind} (mission ${s.mission + 1})`);
    } else log('  hold: could not reach the vault');
  }
  await sleep(200);
}
s = await st();
log(`campaign: mission=${s.mission}/10 cash=$${s.cash} respect=${s.respect} time=${((Date.now() - campaignT0) / 1000).toFixed(0)}s`);

// ---- side race + taxi (only if the campaign finished) ----
if (s.mission >= 10) {
  // Side race: get in a car, press T, run the circuit.
  if (!s.inCar) {
    const v = await ev(() => {
      const G = window.G;
      let best = null, bd = 1e9;
      for (const veh of G.vehicles) {
        if (veh.dead || veh.type === 'marlin') continue;
        const d = Math.hypot(veh.x - G.player.x, veh.z - G.player.z);
        if (d < bd) { bd = d; best = { x: veh.x, z: veh.z }; }
      }
      return best;
    });
    if (v) { await goTo(v.x, v.z, 4, 60000); await tapKey('KeyE', 200); await sleep(500); }
  }
  s = await st();
  if (s.inCar) {
    const cashBefore = s.cash;
    await tapKey('KeyT', 200);
    await sleep(500);
    s = await st();
    if (s.sideRace) {
      log(`side race: started, ${s.sideRace.points.length} checkpoints`);
      const raceT0 = Date.now();
      while (Date.now() - raceT0 < 180000) {
        s = await st();
        if (!s.sideRace) break;
        const pt = s.sideRace.points[s.sideRace.next];
        await goTo(pt.x, pt.z, 10, 60000);
      }
      s = await st();
      log(`side race: done=${!s.sideRace} cash $${cashBefore} -> $${s.cash}`);
    } else log('side race: did not start');
    // Taxi: step out, press T, walk the fare.
    await tapKey('KeyE', 200); await sleep(500);
    const cashBefore2 = (await st()).cash;
    await tapKey('KeyT', 200);
    await sleep(500);
    s = await st();
    if (s.taxi) {
      log(`taxi: ${s.taxi.state} from (${s.taxi.from.x},${s.taxi.from.z})`);
      const ok1 = await goTo(s.taxi.from.x, s.taxi.from.z, 6, 120000);
      s = await st();
      if (ok1 && s.taxi) {
        const ok2 = await goTo(s.taxi.to.x, s.taxi.to.z, 6, 120000);
        s = await st();
        log(`taxi: done=${!s.taxi} cash $${cashBefore2} -> $${s.cash}`);
      } else log('taxi: pickup failed');
    } else log('taxi: did not start');
  } else log('side race: no car available');
}

// ---- Continue: save, reload WITHOUT autostart (so the title screen
// shows), resume ----
// Reloading keeps ?autostart=1, which skips the title screen entirely
// and hides the Continue button — navigate to the plain URL instead.
{
  const before = await st();
  await ev(() => window.G.save.saveGame());
  await page.goto(`http://localhost:${port}/index.html?low=1&seed=7`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.G && window.G.ready, null, { timeout: 20000 });
  await sleep(800);
  const hasContinue = await ev(() => document.getElementById('contBtn').style.display !== 'none');
  log(`continue: button visible=${hasContinue}`);
  if (hasContinue) {
    await page.click('#contBtn');
    await sleep(1200);
    const after = await st();
    const match = after.cash === before.cash && after.respect === before.respect && after.mission === before.mission;
    log(`continue: cash $${before.cash}->${after.cash} respect ${before.respect}->${after.respect} mission ${before.mission}->${after.mission} pos (${before.x.toFixed(0)},${before.z.toFixed(0)})->(${after.x.toFixed(0)},${after.z.toFixed(0)}) MATCH=${match}`);
  }
}

log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close();
server.close();
log('PLAYTEST DONE');
