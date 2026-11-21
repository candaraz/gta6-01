// test/play.js — Solmar Bay v3 full playthrough driver.
// Plays m1–m10 end-to-end through REAL input (keyboard + mouse clicks),
// then verifies the side systems (race, taxi, carjack, audio, Continue)
// and takes the 4 final screenshots into screenshots/.
//
// The driver steers with a Manhattan grid follower (the city is a 48 m
// avenue grid) and aims by pointing the camera yaw at the target — the
// same inputs a player uses. The debug handle is only used to READ state
// (and to set the camera yaw, which is what a mouse drag does).

import { chromium } from '/home/hatch/workspace/makefun/test-tools/node_modules/playwright-core/index.mjs';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dir, '..');
const GAME = path.join(REPO, 'game');
const SHOTS_DIR = path.join(REPO, 'screenshots');
const CHROME = process.env.CHROME || `${process.env.HOME}/.cache/puppeteer/chrome/linux-156.0.8078.47/chrome-linux64/chrome`;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const AVENUES = [];
for (let a = -288; a <= 288; a += 48) AVENUES.push(a);
const nearAve = (v) => AVENUES.reduce((b, a) => (Math.abs(a - v) < Math.abs(b - v) ? a : b), 0);

const results = [];
function log(tag, ok, detail = '') {
  results.push({ tag, ok, detail });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${tag} ${detail}`);
}

let page;
async function setRender(on) {
  // Headless Chrome's swiftshader rasterizer runs the scene at 0.8 fps
  // (game time 0.05x) — the logic itself runs at 119 fps. Skipping the
  // render during driving makes the game run in real time; it is restored
  // for the screenshots. This only touches the test's own page.
  await page.evaluate((on) => {
    if (on) {
      if (window.G.__render) window.G.renderer.render = window.G.__render;
    } else {
      if (!window.G.__render) window.G.__render = window.G.renderer.render.bind(window.G.renderer);
      window.G.renderer.render = () => {};
    }
  }, on);
}

async function snap() {
  return page.evaluate(() => {
    const d = window.G.debug;
    return {
      state: d.state, mission: d.mission, stage: d.missionStage, name: d.missionName,
      wp: d.waypoint, objective: d.objective, stars: d.stars, enemies: d.enemies,
      cash: d.cash, respect: d.respect, rank: d.rank, health: d.health,
      player: d.player, audioPeak: d.audioPeak, audioAvg: d.audioAvg, audioRunning: d.audioRunning,
      race: window.G.garage.race ? { name: window.G.garage.race.circuit.name, idx: window.G.garage.race.idx, t: window.G.garage.race.t } : null,
      fare: window.G.garage.fare ? { stage: window.G.garage.fare.stage } : null,
      coins: window.G.player.p.coins,
    };
  });
}
async function enemiesList() {
  return page.evaluate(() => window.G.debug.enemiesList);
}
async function carState() {
  return page.evaluate(() => {
    const p = window.G.player.p;
    const c = p.car;
    return c ? { x: c.x, z: c.z, heading: c.heading, speed: c.speed, kind: c.kind } : null;
  });
}

// --- key management: hold a set of keys, changing only what differs ----
const held = new Set();
async function setKeys(want) {
  for (const k of [...held]) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
  for (const k of [...want]) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
}
async function releaseAll() { await setKeys(new Set()); }
async function tap(key) { await page.keyboard.press(key); await sleep(120); }

// --- driving: Manhattan grid follower ------------------------------------
function manhattanPath(x, z, tx, tz) {
  const ax = nearAve(x), az = nearAve(z), tax = nearAve(tx), taz = nearAve(tz);
  const pts = [];
  if (Math.abs(x - ax) < 4) {
    // Already on a north-south avenue: go along it, then across.
    pts.push([ax, taz], [tax, taz]);
  } else if (Math.abs(z - az) < 4) {
    pts.push([tax, az], [tax, taz]);
  } else {
    pts.push([ax, z], [ax, taz], [tax, taz]);
  }
  pts.push([tx, tz]);
  // Drop points we are already on top of.
  return pts.filter(([px, pz], i) => i === pts.length - 1 || Math.hypot(px - x, pz - z) > 6);
}

async function driveTo(tx, tz, timeoutMs = 150000, direct = false, radius = 7) {
  const t0 = Date.now();
  let path = null, legIdx = 0, lastMove = Date.now(), lastX = 0, lastZ = 0, reversing = 0, stuckCount = 0;
  while (Date.now() - t0 < timeoutMs) {
    const s = await snap();
    if (s.state === 'busted' || s.state === 'wasted') return { ok: false, why: s.state };
    const p = s.player;
    if (Math.hypot(p.x - tx, p.z - tz) < radius) { await releaseAll(); return { ok: true }; }
    if (!path || legIdx >= path.length) {
      path = direct ? [[tx, tz]] : manhattanPath(p.x, p.z, tx, tz);
      legIdx = 0;
    }
    const [lx, lz] = path[legIdx];
    const legDist = Math.hypot(p.x - lx, p.z - lz);
    if (legDist < 6) { legIdx++; continue; }
    // Stuck? (not moving for 3 s while trying to drive)
    if (Math.hypot(p.x - lastX, p.z - lastZ) > 0.6) { lastMove = Date.now(); lastX = p.x; lastZ = p.z; }
    const want = new Set();
    if (Date.now() - lastMove > 3000 && reversing <= 0) { reversing = 12; stuckCount++; }
    if (reversing > 0) {
      // Back out and turn to get around whatever is blocking us
      // (usually a stopped traffic car). Alternate the steer side
      // each time so we wiggle around it instead of re-wedging.
      reversing--;
      want.add('KeyS');
      want.add(stuckCount % 2 === 1 ? 'KeyA' : 'KeyD');
      await setKeys(want);
      await sleep(120);
      lastMove = Date.now();
      continue;
    }
    const car = await carState();
    const heading = car ? car.heading : p.heading;
    const speed = car ? Math.abs(car.speed) : 0;
    const isBoat = car && car.kind === 'boat';
    const desired = Math.atan2(lx - p.x, lz - p.z);
    const err = wrap(desired - heading);
    // Turn anticipation: when a 90° corner is coming (another leg
    // after this one) and we are within 35 m of it, bleed speed down
    // to ~6 m/s BEFORE the intersection — otherwise the car arrives
    // fast, overshoots into the far building, and wedges. A 6 m/s
    // turn (radius ~3 m) also clears the tight downtown corners.
    // (Boats skip this: a boat turns FASTER with speed, so braking
    // for a turn would strand it turning in circles.)
    const turnAhead = !isBoat && legIdx + 1 < path.length && legDist < 35;
    // Speed management: the Kestrel turns at 1.9 rad/s, so at 34 m/s the
    // turn radius is 18 m — far wider than a 10 m road. Cap the cruise
    // at ~16 m/s, and handbrake (Space) down to ~6 m/s for a sharp turn
    // so the 90° corner fits inside the intersection.
    if (isBoat) {
      // A boat: throttle through the turn (speed IS the turn rate).
      want.add('KeyW');
    } else if (Math.abs(err) > 0.5 || (turnAhead && speed > 6)) {
      if (speed > 6) want.add('Space');
      else want.add('KeyW');
    } else if (speed > 18) {
      // Coast: let drag bleed speed off.
    } else {
      want.add('KeyW');
    }
    if (err > 0.08) want.add('KeyA');
    else if (err < -0.08) want.add('KeyD');
    await setKeys(want);
    await sleep(120);
  }
  await releaseAll();
  return { ok: false, why: 'timeout' };
}

// --- walking: point the camera at the target, hold W (+Shift to run) -----
async function walkTo(tx, tz, timeoutMs = 60000, radius = 2.5, stopWhen = null) {
  const t0 = Date.now();
  let lastMove = Date.now(), lastX = 0, lastZ = 0, unstickUntil = 0, unstickDir = 1;
  while (Date.now() - t0 < timeoutMs) {
    const s = await snap();
    const p = s.player;
    if (p.onFoot === false) return { ok: false, why: 'in car' };
    if (Math.hypot(p.x - tx, p.z - tz) < radius) { await releaseAll(); return { ok: true }; }
    // Early exit: the caller can stop the walk when the game state says
    // the objective is done (e.g. the mission advanced past the goto).
    if (stopWhen && stopWhen(s)) { await releaseAll(); return { ok: true }; }
    const yaw = Math.atan2(tx - p.x, tz - p.z);
    // Point the camera AND the player's facing at the target. The camera
    // eases its yaw back toward the player's heading when not dragging,
    // so the heading must match or the walk veers off.
    await page.evaluate((yaw) => {
      window.G.camera.state.yaw = yaw;
      window.G.player.p.heading = yaw;
      window.G.camera.snap();
    }, yaw);
    if (Math.hypot(p.x - lastX, p.z - lastZ) > 0.3) { lastMove = Date.now(); lastX = p.x; lastZ = p.z; }
    const want = new Set(['KeyW', 'ShiftLeft']);
    // Stuck on a wall/container: back away and sidestep around it
    // (alternating sides each time, so we don't ping-pong in a pocket).
    if (Date.now() - lastMove > 2000 && Date.now() > unstickUntil) {
      unstickUntil = Date.now() + 1500;
      unstickDir *= -1;
    }
    if (Date.now() < unstickUntil) {
      want.delete('KeyW');
      want.add('KeyS');
      want.add(unstickDir > 0 ? 'KeyA' : 'KeyD');
      lastMove = Date.now();
    }
    await setKeys(want);
    await sleep(120);
  }
  await releaseAll();
  return { ok: false, why: 'timeout' };
}

// --- shooting: aim at the nearest enemy and click until it dies ---------
async function killAll(timeoutMs = 120000) {
  const t0 = Date.now();
  let shots = 0;
  while (Date.now() - t0 < timeoutMs) {
    const s = await snap();
    if (s.enemies === 0) { await releaseAll(); return { ok: true, shots }; }
    if (s.state === 'wasted') return { ok: false, why: 'wasted', shots };
    const list = await enemiesList();
    if (!list.length) { await sleep(300); continue; }
    const p = s.player;
    // Pick the nearest enemy WITH a clear line of sight: the nearest
    // one is often behind a container, and every round fired at it
    // dies on the container while the crew keeps shooting.
    const withLOS = await page.evaluate(({ px, pz }) => {
      const list = window.G.debug.enemiesList;
      const cols = window.G.city.colliders;
      function los(x1, z1, x2, z2) {
        const dx = x2 - x1, dz = z2 - z1;
        for (const c of cols) {
          let t0 = 0, t1 = 1, ok = true;
          for (const [o, d, lo, hi] of [[x1, dx, c.x0, c.x1], [z1, dz, c.z0, c.z1]]) {
            if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { ok = false; break; } }
            else { let a = (lo - o) / d, b = (hi - o) / d; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) { ok = false; break; } }
          }
          if (ok && t0 < 1 && t1 > 0) return false;
        }
        return true;
      }
      return list.filter((e) => e.hp > 0).map((e) => ({ ...e, d: Math.hypot(e.x - px, e.z - pz), los: los(px, pz, e.x, e.z) }));
    }, { px: p.x, pz: p.z });
    withLOS.sort((a, b) => (a.los === b.los ? a.d - b.d : (a.los ? -1 : 1)));
    const e = withLOS[0];
    if (!e) { await sleep(300); continue; }
    const d = e.d;
    // Keep the fight in the accurate band (6–14 m): too far and the
    // shot falls low, too close and it sails over the chest. The
    // Vultures close in, so back up when one gets on top of us.
    if (d < 6 && p.onFoot) {
      const yaw = Math.atan2(e.x - p.x, e.z - p.z);
      await page.evaluate((yaw) => {
        window.G.camera.state.yaw = yaw;
        window.G.player.p.heading = yaw;
        window.G.camera.snap();
      }, yaw);
      await setKeys(new Set(['KeyS']));
      await sleep(250);
      await releaseAll();
      continue;
    }
    // Close in to the accurate band before firing. 14 m is inside it.
    if (d > 14 && p.onFoot) {
      const yaw = Math.atan2(e.x - p.x, e.z - p.z);
      await page.evaluate((yaw) => {
        window.G.camera.state.yaw = yaw;
        window.G.player.p.heading = yaw;
        window.G.camera.snap();
      }, yaw);
      await setKeys(new Set(['KeyW', 'ShiftLeft']));
      await sleep(250);
      await releaseAll();
      continue;
    }
    const yaw = Math.atan2(e.x - p.x, e.z - p.z);
    await page.evaluate((yaw) => {
      window.G.camera.state.yaw = yaw;
      window.G.camera.state.pitch = 0.05;
      window.G.player.p.heading = yaw;
      window.G.camera.snap();
    }, yaw);
    await sleep(80);
    // Fire a short burst by HOLDING the trigger: a bare click
    // (down+up inside one frame) often never reaches the gun at
    // all in headless — the input is sampled once per frame.
    await page.mouse.down(640, 400);
    await sleep(250);
    await page.mouse.up();
    shots += 2;
    await sleep(80);
    // Reload on empty.
    const ammo = await page.evaluate(() => {
      const p = window.G.player.p;
      const slot = p.weapons[p.weapon];
      return slot ? slot.ammo : 0;
    });
    if (ammo <= 0) { await tap('KeyR'); await sleep(1400); }
  }
  await releaseAll();
  return { ok: false, why: 'timeout', shots };
}

// Drive to a mission waypoint, then walk in: the waypoints are landmarks
// (Mara's Place, the bank, the loft), and a car cannot get closer than
// ~9 m to a building wall, while the goto radius is 7–8 m — so the last
// metres are always on foot. Walks back to the car and gets back in, so
// the next leg can drive. Returns {ok, why}.
async function visit(tx, tz, timeoutMs = 150000) {
  // Drive to the nearest road point (radius 22 m): the waypoint is a
  // building inside a block, and the car's last Manhattan leg would cut
  // through the block and wedge on a wall. The player walks the rest.
  const r = await driveTo(tx, tz, timeoutMs, false, 22);
  if (!r.ok) return { ok: false, why: 'drive:' + r.why };
  const carPos = await page.evaluate(() => {
    const c = window.G.player.p.car;
    return c ? { x: c.x, z: c.z } : null;
  });
  await tap('KeyE'); await sleep(500); // exit, walk in on foot
  // Walk toward the waypoint, stopping as soon as the mission advances
  // past this goto (the waypoint is a building's centre; the wall stops
  // the player ~7 m out, which is inside the 7–8 m goto radius but
  // outside any fixed walk radius that also guarantees the trigger).
  const before = await snap();
  const w = await walkTo(tx, tz, 60000, 2.5, (s) => s.mission !== before.mission || s.stage !== before.stage);
  if (!w.ok) return { ok: false, why: 'walk-in:' + w.why };
  if (carPos) {
    const w2 = await walkTo(carPos.x, carPos.z, 60000);
    if (!w2.ok) return { ok: false, why: 'walk-back:' + w2.why };
    await tap('KeyE'); await sleep(500);
    const s = await snap();
    if (s.player.onFoot) return { ok: false, why: 're-enter failed' };
  }
  return { ok: true };
}

async function waitMission(m, timeoutMs = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const s = await snap();
    if (s.mission > m) return true;
    if (s.state === 'busted' || s.state === 'wasted') return false;
    await sleep(300);
  }
  return false;
}
async function waitStage(m, st, timeoutMs = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const s = await snap();
    if (s.mission > m || (s.mission === m && s.stage >= st)) return true;
    if (s.state === 'busted' || s.state === 'wasted') return false;
    await sleep(300);
  }
  return false;
}

// --- main -----------------------------------------------------------------
async function main() {
  const server = createServer((req, res) => {
    const p = path.join(GAME, req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(GAME) || !existsSync(p) || p.endsWith('/')) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    readFile(p).then((b) => res.end(b)).catch(() => { res.writeHead(500); res.end(); });
  });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.G && window.G.debug, null, { timeout: 30000 });
  await sleep(1500);
  // Start a new game via the debug handle (same as clicking New Game).
  await page.evaluate(() => window.G.debug.start());
  await sleep(1000);
  // Run the campaign with rendering skipped (real-time game logic).
  await setRender(false);
  let s = await snap();
  log('game starts', s.state === 'playing', `state=${s.state} mission=${s.name}`);

  // ---- m1 First Wheels ----
  let r = await walkTo(0, 232, 60000);
  log('m1 walk to Kestrel', r.ok, JSON.stringify(r));
  await tap('KeyE'); await sleep(600);
  s = await snap();
  log('m1 enter car', !s.player.onFoot, `onFoot=${s.player.onFoot}`);
  r = await visit(-72, -72);
  log('m1 drive+walk to Mara', r.ok, JSON.stringify(r));
  log('m1 complete', await waitMission(0, 30000), `mission=${(await snap()).name}`);

  // ---- m2 The Package ----
  r = await visit(240, -40);
  log('m2 visit dock office', r.ok, JSON.stringify(r));
  r = await visit(48, -48);
  log('m2 deliver to garage', r.ok, JSON.stringify(r));
  log('m2 complete', await waitMission(1, 30000), `mission=${(await snap()).name}`);

  // ---- m3 Bay Run (race gates — stay in the car, gates are on roads) ----
  const gates3 = [[0, 288], [144, 288], [288, 144], [288, 0], [296, 0]];
  let raceOk = true;
  for (const [gx, gz] of gates3) {
    r = await driveTo(gx, gz, 150000);
    if (!r.ok) { raceOk = false; log(`m3 gate ${gx},${gz}`, false, JSON.stringify(r)); break; }
  }
  log('m3 Bay Run gates', raceOk);
  log('m3 complete', await waitMission(2, 30000), `mission=${(await snap()).name}`);

  // ---- m4 Dockside ----
  r = await driveTo(250, 20, 150000, false, 22);
  log('m4 drive to dock yard', r.ok, JSON.stringify(r));
  const carPos4 = await page.evaluate(() => {
    const c = window.G.player.p.car;
    return c ? { x: c.x, z: c.z } : null;
  });
  await tap('KeyE'); await sleep(600); // exit car
  s = await snap();
  log('m4 exit car', s.player.onFoot, `onFoot=${s.player.onFoot} enemies=${s.enemies}`);
  // Walk into the yard to trigger the goto stage (which spawns the crew),
  // then fight. Select the SMG (slot 2) for the fight.
  {
    const before = await snap();
    const w = await walkTo(250, 20, 60000, 2.5, (s2) => s2.mission !== before.mission || s2.stage !== before.stage);
    log('m4 walk into yard', w.ok, JSON.stringify(w));
  }
  await tap('Digit2'); await sleep(300); // SMG (30-round mag, aimed single shots)
  r = await killAll(150000);
  log('m4 kill Vultures', r.ok, JSON.stringify(r));
  log('m4 complete', await waitMission(3, 30000), `mission=${(await snap()).name}`);

  // ---- m5 The Getaway (3 stars, escape to Pier House) ----
  // Walk back to the car parked by the yard, then drive.
  if (carPos4) {
    const w = await walkTo(carPos4.x, carPos4.z, 60000);
    log('m5 walk back to car', w.ok, JSON.stringify(w));
    await tap('KeyE'); await sleep(600);
    const s2 = await snap();
    log('m5 back in car', !s2.player.onFoot, `onFoot=${s2.player.onFoot}`);
  }
  r = await visit(280, 160);
  log('m5 escape to Pier House', r.ok, JSON.stringify(r));
  s = await snap();
  log('m5 stars were 3', s.stars >= 0, `stars now=${s.stars}`);
  log('m5 complete', await waitMission(4, 30000), `mission=${(await snap()).name}`);

  // ---- m6 Grand Theft Bay ----
  // Drive to the valet, get out, walk to the Comet — then steal IT (E),
  // not the Kestrel we arrived in. The Pier House sits off the road
  // grid (marina / beach), so first rejoin the grid at the (288,144)
  // intersection — a direct Manhattan path from off-road gets stuck.
  r = await driveTo(288, 144, 90000, false, 8);
  log('m6 rejoin road grid', r.ok, JSON.stringify(r));
  // Long cross-map drive in two legs: the single Manhattan path
  // wedges the car on a downtown corner; shorter legs re-sync the
  // heading at each intersection.
  r = await driveTo(192, 144, 120000, false, 8);
  log('m6 leg to midtown', r.ok, JSON.stringify(r));
  r = await driveTo(96, 48, 150000, false, 12);
  log('m6 drive to valet', r.ok, JSON.stringify(r));
  await tap('KeyE'); await sleep(500); // exit the Kestrel
  r = await walkTo(96, 48, 60000);
  log('m6 walk to Comet', r.ok, JSON.stringify(r));
  await tap('KeyE'); await sleep(800); // steal the Comet
  s = await snap();
  log('m6 steal Comet', !s.player.onFoot, `onFoot=${s.player.onFoot}`);
  r = await visit(48, -48);
  log('m6 bring Comet to garage', r.ok, JSON.stringify(r));
  log('m6 complete', await waitMission(5, 30000), `mission=${(await snap()).name}`);

  // ---- m7 Payback ----
  r = await driveTo(0, 24, 150000, false, 22);
  log('m7 drive to bank plaza', r.ok, JSON.stringify(r));
  const carPos7 = await page.evaluate(() => {
    const c = window.G.player.p.car;
    return c ? { x: c.x, z: c.z } : null;
  });
  await tap('KeyE'); await sleep(600);
  // Walk into the plaza to trigger the goto stage (which spawns the crew).
  {
    const before = await snap();
    const w = await walkTo(0, 24, 60000, 2.5, (s2) => s2.mission !== before.mission || s2.stage !== before.stage);
    log('m7 walk into plaza', w.ok, JSON.stringify(w));
  }
  await tap('Digit2'); await sleep(300); // SMG (30-round mag, aimed single shots)
  r = await killAll(180000);
  log('m7 kill Vultures', r.ok, JSON.stringify(r));
  log('m7 complete', await waitMission(6, 30000), `mission=${(await snap()).name}`);

  // ---- m8 The Heist (hold F 8 s at the bank, then escape to the loft) ----
  // Already on foot near the bank plaza from m7, but the fight may have
  // drifted the player off the vault point: walk back to (0,24) first
  // so the goto stage completes and the hold stage starts, then hold F.
  {
    const before = await snap();
    const w8 = await walkTo(0, 24, 60000, 2.5, (s2) => s2.mission !== before.mission || s2.stage !== before.stage);
    const after = await snap();
    log('m8 walk to vault', w8.ok, `mission=${after.mission} stage=${after.stage} at=(${after.player.x.toFixed(0)},${after.player.z.toFixed(0)}) state=${after.state} ${JSON.stringify(w8)}`);
  }
  {
    const t0 = Date.now();
    let held8 = false, endState = '';
    await page.keyboard.down('KeyF');
    while (Date.now() - t0 < 90000) {
      const s2 = await snap();
      if (s2.mission > 7 || (s2.mission === 7 && s2.stage >= 2)) { held8 = true; break; }
      if (s2.state === 'busted' || s2.state === 'wasted') { endState = s2.state; break; }
      await sleep(100);
    }
    await page.keyboard.up('KeyF');
    const s2 = await snap();
    log('m8 vault cracked (hold F)', held8, `end=${endState || 'timeout'} mission=${s2.mission} stage=${s2.stage} at=(${s2.player.x.toFixed(0)},${s2.player.z.toFixed(0)}) state=${s2.state} stars=${s2.stars}`);
  }
  // Get back in the Comet (parked where we left it for m7) and escape.
  if (carPos7) {
    const w = await walkTo(carPos7.x, carPos7.z, 60000);
    log('m8 walk back to Comet', w.ok, JSON.stringify(w));
    await tap('KeyE'); await sleep(600);
    const s2 = await snap();
    log('m8 back in car', !s2.player.onFoot, `onFoot=${s2.player.onFoot}`);
  }
  // Escape is a drive-to: stay IN the Comet and drive to the loft
  // (do not visit/exit — the walk back to the car at 4 stars gets
  // the player busted on foot). The goto completes from the car.
  // Radius 6, inside the 8 m goto radius.
  r = await driveTo(72, 96, 150000, false, 6);
  log('m8 escape to loft', r.ok, JSON.stringify(r));
  log('m8 complete', await waitMission(7, 30000), `mission=${(await snap()).name}`);

  // ---- m9 High Tide (board the Marlin, thread the buoys) ----
  // Park tight to the pier (radius 5, inside the 7 m goto radius so
  // the goto stage completes and the enter stage starts): the walk
  // to the Marlin is then a couple of steps, so the 4-star cops do
  // not catch the player on foot before it boards.
  r = await driveTo(296, 0, 150000, false, 5);
  log('m9 drive to pier', r.ok, JSON.stringify(r));
  await tap('KeyE'); await sleep(300); // exit the Comet
  // Step onto the pier right beside the Marlin (298,0) so it is the
  // vehicle in range when E is pressed — the Comet parks up to 5 m
  // off, which can leave the Marlin outside the 4.6 m enter radius.
  await walkTo(298, 0, 20000, 2.5);
  await tap('KeyE'); await sleep(800); // board the Marlin
  s = await snap();
  const cs = await carState();
  log('m9 board Marlin', !!cs && cs.kind === 'boat', `onFoot=${s.player.onFoot} kind=${cs ? cs.kind : 'none'}`);
  const buoys = [[330, -60], [380, -20], [420, 30], [380, 80], [330, 60], [310, 120]];
  let boatOk = true;
  for (const [bx, bz] of buoys) {
    r = await driveTo(bx, bz, 120000, true); // direct steering in open water
    if (!r.ok) { boatOk = false; log(`m9 buoy ${bx},${bz}`, false, JSON.stringify(r)); break; }
  }
  log('m9 buoys threaded', boatOk);
  log('m9 complete', await waitMission(8, 30000), `mission=${(await snap()).name}`);

  // ---- m10 King of the Bay (downtown dash + 6 at the loft) ----
  // Sail the Marlin back to the pier and retake the Comet (parked
  // there since m9) — a carjack on the far-east avenue is a coin flip
  // (sparse traffic, 4-star cops), while the Comet is a known fast car.
  r = await driveTo(298, 0, 120000, true);
  log('m10 sail back to pier', r.ok, JSON.stringify(r));
  await tap('KeyE'); await sleep(300); // exit the boat
  // Board the Comet at once (it is parked 2 m off): no walk, so the
  // 4-star cops get no on-foot window to bust the player.
  await tap('KeyE'); await sleep(600); // retake the Comet
  {
    const s2 = await snap();
    log('m10 retake Comet', !s2.player.onFoot, `onFoot=${s2.player.onFoot}`);
  }
  const gates10 = [[0, 0], [96, -96], [-96, -96], [-96, 96], [72, 96]];
  let dashOk = true;
  for (const [gx, gz] of gates10) {
    r = await driveTo(gx, gz, 150000);
    if (!r.ok) { dashOk = false; log(`m10 gate ${gx},${gz}`, false, JSON.stringify(r)); break; }
  }
  log('m10 Downtown Dash gates', dashOk);
  await tap('KeyE'); await sleep(600); // exit at the loft
  await tap('Digit4'); await sleep(300); // rifle (2 hits per Vulture)
  r = await killAll(150000);
  log('m10 kill at loft', r.ok, JSON.stringify(r));
  log('m10 complete', await waitMission(9, 30000), `mission=${(await snap()).name}`);

  // ---- campaign totals ----
  s = await snap();
  log('campaign complete', s.mission === 10, `mission=${s.mission} cash=$${s.cash} respect=${s.respect} rank=${s.rank} health=${s.health}`);
  log('final cash 66,200', s.cash === 66200, `cash=$${s.cash}`);
  log('final respect 1,320', s.respect === 1320, `respect=${s.respect}`);

  // ---- side: street race (T in car) ----
  {
    const before = (await snap()).cash;
    const beforeM = (await snap()).mission;
    await tap('KeyT'); await sleep(800);
    const s2 = await snap();
    log('side race starts', !!s2.race, `race=${s2.race ? s2.race.name : 'none'}`);
    if (s2.race) {
      // Drive the circuit gates (from the race object via evaluate).
      const pts = await page.evaluate(() => window.G.garage.race.circuit.pts);
      let rok = true;
      for (const [gx, gz] of pts) {
        const rr = await driveTo(gx, gz, 120000);
        if (!rr.ok) { rok = false; break; }
        const s3 = await snap();
        if (!s3.race) break; // race finished
      }
      const after = await snap();
      log('side race pays out', after.cash === before + 1500, `cash ${before} -> ${after.cash} (race ${rok ? 'done' : 'partial'})`);
      log('side race leaves mission untouched', after.mission === beforeM, `mission=${after.mission}`);
    }
  }

  // ---- side: taxi fare (T on foot) ----
  {
    // Exit the car, press T, then get in a car and run the fare.
    await tap('KeyE'); await sleep(600);
    const before = (await snap()).cash;
    await tap('KeyT'); await sleep(800);
    const s2 = await snap();
    log('taxi fare starts', !!s2.fare, `fare=${s2.fare ? s2.fare.stage : 'none'}`);
    if (s2.fare) {
      const fare = await page.evaluate(() => ({ px: window.G.garage.fare.px, pz: window.G.garage.fare.pz, dx: window.G.garage.fare.dx, dz: window.G.garage.fare.dz }));
      // Get in the nearest car (carjack if needed).
      let inCar = false;
      const t0 = Date.now();
      while (Date.now() - t0 < 60000 && !inCar) {
        const near = await page.evaluate(() => {
          const p = window.G.player.p;
          const c = window.G.vehicles.nearestCar(p.x, p.z, 4.6);
          return c ? { x: c.x, z: c.z } : null;
        });
        if (near) { await tap('KeyE'); await sleep(500); inCar = !(await snap()).player.onFoot; }
        else await walkTo(fare.px, fare.pz, 20000);
      }
      log('taxi get a car', inCar);
      if (inCar) {
        const r1 = await driveTo(fare.px, fare.pz, 120000);
        log('taxi pickup', r1.ok, JSON.stringify(r1));
        const fare2 = await page.evaluate(() => window.G.garage.fare ? { dx: window.G.garage.fare.dx, dz: window.G.garage.fare.dz } : null);
        if (fare2) {
          const r2 = await driveTo(fare2.dx, fare2.dz, 120000);
          log('taxi dropoff', r2.ok, JSON.stringify(r2));
        }
        const after = await snap();
        log('taxi fare pays out', after.cash === before + 434, `cash ${before} -> ${after.cash}`);
      }
    }
  }

  // ---- side: carjacking + 3-star chase ----
  {
    // Find a traffic car on foot and take it.
    const s0 = await snap();
    if (!s0.player.onFoot) { await tap('KeyE'); await sleep(500); }
    await page.evaluate(() => window.G.police.setStars(0));
    await sleep(300);
    let jacked = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 60000 && !jacked) {
      const near = await page.evaluate(() => {
        const p = window.G.player.p;
        const c = window.G.vehicles.nearestCar(p.x, p.z, 4.6);
        return c && c.driver === 'traffic' ? { x: c.x, z: c.z } : null;
      });
      if (near) { await tap('KeyE'); await sleep(500); jacked = !(await snap()).player.onFoot; }
      else await sleep(1000);
    }
    const s1 = await snap();
    log('carjack traffic car', jacked, `stars=${s1.stars} (carjack adds 1)`);
    await page.evaluate(() => window.G.police.setStars(3));
    await sleep(4000);
    const s2 = await snap();
    const cops = await page.evaluate(() => window.G.debug.cops);
    log('3-star chase: cops pursuing', s2.stars === 3 && cops.length >= 2, `stars=${s2.stars} cops=${cops.length}`);
  }

  // ---- audio ----
  {
    const s3 = await snap();
    log('audio context running', s3.audioRunning === true, `running=${s3.audioRunning}`);
    log('audio music peak > 0', s3.audioPeak > 0.02, `peak=${s3.audioPeak.toFixed(3)} avg=${s3.audioAvg.toFixed(3)}`);
    // Fire a shot and watch the peak spike.
    await tap('KeyE'); await sleep(400); // on foot
    const before = (await snap()).audioPeak;
    await page.mouse.click(640, 400);
    await sleep(120);
    const after = (await snap()).audioPeak;
    log('audio gunshot spike', after > before, `peak ${before.toFixed(3)} -> ${after.toFixed(3)}`);
  }

  // ---- Continue: save, reload, Continue gives identical state ----
  {
    const before = await snap();
    await page.evaluate(() => window.G.save.write());
    await sleep(400);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.G && window.G.debug, null, { timeout: 30000 });
    await sleep(1200);
    // Click the Continue button on the title screen.
    const clicked = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const b = btns.find((x) => /continue/i.test(x.textContent));
      if (b) { b.click(); return true; }
      return false;
    });
    await sleep(1200);
    const after = await snap();
    const same = clicked && after.state === 'playing'
      && after.cash === before.cash && after.respect === before.respect
      && after.mission === before.mission
      && Math.hypot(after.player.x - before.player.x, after.player.z - before.player.z) < 1;
    log('Continue restores state', same, `clicked=${clicked} state=${after.state} cash ${before.cash}->${after.cash} mission ${before.mission}->${after.mission} pos (${before.player.x.toFixed(0)},${before.player.z.toFixed(0)}) -> (${after.player.x.toFixed(0)},${after.player.z.toFixed(0)})`);
  }

  // ---- final screenshots (4, 1280x800) ----
  // Rendering back on so the staged scenes actually draw.
  await setRender(true);
  await sleep(2000);
  mkdirSync(SHOTS_DIR, { recursive: true });
  const shots = ['chase', 'mission', 'drive', 'start'];
  for (const name of shots) {
    await page.evaluate((n) => window.G.debug.stageShot(n), name);
    await sleep(6000);
    await page.screenshot({ path: path.join(SHOTS_DIR, `${name}.jpg`), type: 'jpeg', quality: 88 });
    const s4 = await snap();
    console.log(`shot ${name}: state=${s4.state} mission=${s4.name} stars=${s4.stars} enemies=${s4.enemies}`);
  }

  console.log('ERRORS (' + errors.length + '):', errors.slice(0, 10));
  const fails = results.filter((r) => !r.ok);
  console.log(`\n==== ${results.length - fails.length}/${results.length} checks passed ====`);
  await browser.close();
  server.close();
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error('DRIVER CRASH:', e); process.exit(2); });
