// main.js — Solmar Bay: boots the renderer, builds every system, and
// runs the game loop. The game object G is the one shared state every
// module reads; missions get a ctx view of it.
import * as THREE from 'three';
import { WORLD, COLOURS, VEHICLES, WEAPONS, COIN_VALUE, SAVE_KEY } from './config.js';
import { clamp, dist } from './random.js';
import { buildCity } from './city.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { Effects } from './effects.js';
import { Vehicle, spawnBoat } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Player } from './player.js';
import { CameraRig } from './camera.js';
import { Combat } from './combat.js';
import { Police } from './police.js';
import { MissionManager } from './missions.js';
import { Garage } from './garage.js';
import { HUD } from './hud.js';
import { hasSave, saveGame, loadSave, clearSave, saveSummary } from './save.js';
import { poseChase, poseMission, poseDrive, poseStart, describeShots } from './shots.js';

const root = document.getElementById('game-root');
const loading = document.getElementById('loading');

// ---- renderer / scene ----
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = false;
root.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLOURS.sky);
scene.fog = new THREE.Fog(COLOURS.fog, 180, 620);

const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 900);
camera.position.set(-245, 8, -260);

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a7a5a, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0c8, 2.0);
sun.position.set(120, 180, 60);
sun.castShadow = false;
scene.add(sun);
scene.add(sun.target);

// ---- systems ----
const city = buildCity(scene);
const input = new Input(renderer.domElement);
const audio = new AudioEngine();
const effects = new Effects(scene);
const traffic = new Traffic(scene, city);
const player = new Player(scene);
const cameraRig = new CameraRig(camera, scene);
const combat = new Combat(scene, effects, audio);
const police = new Police(scene, city, effects, audio);
const missions = new MissionManager(scene, city);
const garage = new Garage();
const hud = new HUD();

const G = {
  scene, city, traffic, player, cameraRig, combat, police, missions, garage, hud, audio, effects, input,
  vehicles: [], cash: 500, respect: 0,
  upgrades: { engine: 0, armour: 0, brakes: 0 },
  state: 'menu', // menu | playing | paused | busted | wasted
  quality: 'high',
  time: 0, bannerTimer: 0,
  coinsCollected: 0,
};

// Coin meshes: spinning gold discs at the coin spots.
const coinMeshes = [];
{
  const geo = new THREE.CylinderGeometry(0.9, 0.9, 0.18, 16);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffd24a, emissive: 0x664400 });
  for (const c of city.coins) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(c.x, 1.2, c.z);
    m.rotation.x = Math.PI / 2;
    scene.add(m);
    coinMeshes.push(m);
  }
}

traffic.spawnInitial(player.x, player.z);
G.vehicles.push(...traffic.cars);
// New traffic cars and police cars join the shared vehicle list, and
// dead ones leave it, so the player can always board a live car.
traffic.onSpawn = (v) => G.vehicles.push(v);
police.onSpawn = (v) => G.vehicles.push(v);

// The ctx the mission manager gets: live getters + callbacks.
const missionCtx = {
  get player() { return G.player; },
  get combat() { return G.combat; },
  get police() { return G.police; },
  get audio() { return G.audio; },
  get input() { return G.input; },
  get cash() { return G.cash; },
  get vehicles() { return G.vehicles; },
  addVehicle(v) { G.vehicles.push(v); },
  onMessage(t) { hud.message(t); },
  onReward(cash, respect, text) {
    G.cash += cash; G.respect += respect;
    hud.message(text);
    saveGame(G);
  },
  onSpend(amount) { G.cash -= amount; },
  onSave() { saveGame(G); },
};
G.missionCtx = missionCtx;

// Pedestrian targets for the crosshair + what happens when one is shot.
combat.onPedDown = (ped) => {
  traffic.killPed(ped);
  traffic.scarePeds(ped.x, ped.z, 25);
  police.addStars(1, 'pedestrian down');
  hud.message('A pedestrian is down — the cops noticed (+1 star).');
};

// ---- menus ----
const btnNew = document.getElementById('btn-new');
const btnContinue = document.getElementById('btn-continue');
const btnResume = document.getElementById('btn-resume');
const btnSaveQuit = document.getElementById('btn-save-quit');
const setVolume = document.getElementById('set-volume');
const setVolumeVal = document.getElementById('set-volume-val');
const setQuality = document.getElementById('set-quality');

function startPlaying() {
  audio.start();
  hud.hideStart();
  hud.hideBanner();
  G.state = 'playing';
  cameraRig.snap(player.x, player.z, 1.5);
}

function resetGame() {
  clearSave();
  G.cash = 500;
  G.respect = 0;
  G.upgrades = { engine: 0, armour: 0, brakes: 0 };
  G.coinsCollected = 0;
  if (missions.active) {
    if (missions.active.race) missions.active.race.dispose();
    missions.active = null;
  }
  if (missions.side) missions.cancelSide(missionCtx);
  missions.nextIndex = 0;
  missions.completed = 0;
  missions.objectiveText = 'Welcome to Solmar Bay';
  missions.markerPos = null;
  combat.clearEnemies();
  combat.owned = { pistol: true, smg: false, shotgun: false, rifle: false };
  combat.ammo = { pistol: Infinity, smg: 0, shotgun: 0, rifle: 0 };
  combat.mag = { pistol: 12, smg: 0, shotgun: 0, rifle: 0 };
  combat.current = 'pistol';
  police.clear();
  city.coins.forEach((c, i) => { c.taken = false; coinMeshes[i].visible = true; });
  if (player.inVehicle) player.exitVehicle();
  player.respawnAt(-245, -245);
  player.heading = Math.PI;
  for (const v of [...G.vehicles]) {
    if (v.driver !== 'traffic') v.remove(scene);
  }
  G.vehicles = G.vehicles.filter((v) => !v.dead);
  cameraRig.setYaw(Math.PI, 0.3);
  cameraRig.snap(player.x, player.z, 1.5);
  startPlaying();
}

btnNew.addEventListener('click', () => {
  resetGame();
});
btnContinue.addEventListener('click', () => {
  const s = loadSave();
  if (!s) return;
  applySave(s);
  startPlaying();
});
btnResume.addEventListener('click', () => {
  G.state = 'playing';
  hud.showPause(false);
});
btnSaveQuit.addEventListener('click', () => {
  saveGame(G);
  G.state = 'menu';
  hud.showPause(false);
  hud.showStart(true);
});
setVolume.addEventListener('input', () => {
  audio.setVolume(setVolume.value / 100);
  setVolumeVal.textContent = setVolume.value;
});
setQuality.addEventListener('change', () => {
  G.quality = setQuality.value;
  applyQuality();
});

function applyQuality() {
  if (G.quality === 'low') {
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = false;
    sun.castShadow = false;
  } else {
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
    sun.shadow.camera.far = 500;
  }
  renderer.shadowMap.needsUpdate = true;
}

function applySave(s) {
  G.cash = s.cash;
  G.respect = s.respect;
  G.missions.nextIndex = s.nextMission;
  G.missions.completed = s.completed;
  Object.assign(G.combat.owned, s.owned);
  Object.assign(G.combat.ammo, s.ammo);
  Object.assign(G.upgrades, s.upgrades);
  G.audio.setStation(s.station || 0);
  G.audio.setVolume(s.volume ?? 0.7);
  s.coinsTaken.forEach((taken, i) => {
    if (taken && city.coins[i]) { city.coins[i].taken = true; coinMeshes[i].visible = false; }
  });
  player.teleport(s.player.x, s.player.z, s.player.heading);
  player.health = s.player.health;
  if (s.player.inVehicle && s.player.vehicleCls) {
    const v = new Vehicle(scene, s.player.vehicleCls, s.player.vehicleX, s.player.vehicleZ, s.player.vehicleHeading, { driver: null, owned: true });
    G.vehicles.push(v);
    player.enterVehicle(v);
  }
  cameraRig.setYaw(player.heading + Math.PI, 0.3);
  cameraRig.snap(player.x, player.z, 1.5);
}

// ---- debug handle for the test driver (poses, teleports, state) ----
window.__solmar = {
  G,
  version: 'solmar-bay-v2-rebuild',
  teleport(x, z, heading) {
    player.teleport(x, z, heading);
    cameraRig.snap(player.x, player.z, 1.5);
  },
  setWanted(n) { police.setStars(n); },
  giveWeapon(name, ammo) { combat.giveWeapon(name, ammo || 120); },
  startMission(i) {
    if (i !== undefined) missions.nextIndex = i;
    missions.startMission(missionCtx);
  },
  poseChase() { poseChase(G); },
  poseMission() { poseMission(G); },
  poseDrive() { poseDrive(G); },
  poseStart() { poseStart(G); },
  describeShots,
  // Pixel sample of the current frame (render + downsample + stats) and
  // of the minimap canvas, for verifying renders are real and legible.
  pixels() {
    renderer.render(scene, camera);
    const src = renderer.domElement;
    const c = document.createElement('canvas');
    c.width = 160; c.height = 100;
    const ctx2d = c.getContext('2d');
    ctx2d.drawImage(src, 0, 0, 160, 100);
    const d = ctx2d.getImageData(0, 0, 160, 100).data;
    const seen = new Set();
    let sum = 0, mn = 255, mx = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      seen.add((r >> 4) + ',' + (g >> 4) + ',' + (b >> 4));
      const l = (r + g + b) / 3;
      sum += l; mn = Math.min(mn, l); mx = Math.max(mx, l);
    }
    const n = d.length / 4;
    const mc = document.getElementById('minimap');
    let mapUnique = 0;
    if (mc) {
      const md = mc.getContext('2d').getImageData(0, 0, 200, 200).data;
      const mseen = new Set();
      for (let i = 0; i < md.length; i += 16) mseen.add(md[i] + ',' + md[i + 1] + ',' + md[i + 2]);
      mapUnique = mseen.size;
    }
    return { unique: seen.size, avg: Math.round(sum / n), min: mn, max: mx, minimapUnique: mapUnique };
  },
  state() {
    return {
      state: G.state, cash: G.cash, respect: G.respect,
      mission: missions.active ? missions.active.def.id : null,
      nextMission: missions.nextIndex, completed: missions.completed,
      stars: police.stars, health: player.health,
      x: Math.round(player.x), z: Math.round(player.z),
      inVehicle: !!player.inVehicle,
      vehicle: player.inVehicle ? player.inVehicle.cls : null,
      speedKmh: player.inVehicle ? Math.round(Math.abs(player.inVehicle.speed) * 3.6) : 0,
      enemiesAlive: combat.aliveEnemies().length,
      cops: police.copCount(),
      audioRunning: audio.running(), audioLevel: audio.level(),
      objective: missions.objectiveText,
      coins: G.coinsCollected,
    };
  },
};

hud.showStart(hasSave());
if (loading) loading.remove();
applyQuality();

// ---- gameplay helpers ----
function nearestSafehouse(x, z) {
  let best = city.landmarks.safehouses[0], bd = Infinity;
  for (const s of city.landmarks.safehouses) {
    const d = dist(x, z, s.x, s.z);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

function bustPlayer() {
  if (G.state !== 'playing') return;
  const fine = Math.max(100, Math.round(G.cash * 0.1));
  G.cash = Math.max(0, G.cash - fine);
  police.clear();
  G.state = 'busted';
  G.bannerTimer = 2.5;
  hud.showBanner('BUSTED', `Solmar PD took $${fine.toLocaleString('en-US')}.`);
  audio.fail();
}

function wastePlayer() {
  if (G.state !== 'playing') return;
  G.cash = Math.max(0, G.cash - 200);
  police.clear();
  G.state = 'wasted';
  G.bannerTimer = 2.5;
  hud.showBanner('WASTED', 'The Bay King is down — $200 hospital bill.');
  audio.fail();
}

function respawn() {
  const sh = nearestSafehouse(player.x, player.z);
  player.respawnAt(sh.x + 6, sh.z + 6);
  police.clear();
  cameraRig.snap(player.x, player.z, 1.5);
  hud.hideBanner();
  G.state = 'playing';
}

const shopCtx = {
  get cash() { return G.cash; },
  get upgrades() { return G.upgrades; },
  get vehicles() { return G.vehicles; },
  get combat() { return G.combat; },
  get player() { return G.player; },
  get police() { return G.police; },
  onSpend(a) { G.cash -= a; },
  onMessage(t) { hud.message(t); },
  onSave() { saveGame(G); },
};

function handleInteract() {
  if (!input.wasHit('e')) return;
  if (garage.isOpen()) return;
  if (player.inVehicle) {
    player.exitVehicle();
    audio.setEngine(0, false);
    return;
  }
  if (missions.wantsInteract(missionCtx)) return; // mission stage takes the E
  if (missions.nearStartMarker(missionCtx)) { missions.tryStartAtMarker(missionCtx); return; }
  const v = player.nearestBoardable(G.vehicles, 4.5);
  if (v) {
    if (v.driver === 'traffic') {
      police.addStars(1, 'carjacking');
      traffic.scarePeds(v.x, v.z, 20);
      hud.message(`Stole a ${v.def.name} — wanted +1.`);
    } else if (v.cls === 'boat') {
      hud.message('Boarded the Marlin.');
    }
    player.enterVehicle(v);
    return;
  }
  const spot = garage.nearby(player, city);
  if (spot) { garage.openMenu(spot.type, shopCtx); return; }
  missions.tryStartAtMarker(missionCtx);
}

function damageFromCrash(v) {
  // Ramming a police car at speed damages it; destroy it and the heat rises.
  for (const o of G.vehicles) {
    if (o === v || o.dead) continue;
    if (dist(v.x, v.z, o.x, o.z) > v.radius + o.radius + 0.5) continue;
    const rel = Math.abs(v.speed) + Math.abs(o.speed);
    if (rel < 8) continue;
    o.damage(25);
    if (o.dead && o.driver === 'police') {
      effects.explosion(o.x, 1, o.z, true);
      audio.explosion();
      police.addStars(1, 'cop car destroyed');
      hud.message('Cop car destroyed (+1 star).');
    }
  }
  if (v.hp <= 0 && !v.dead) {
    v.dead = true;
    effects.explosion(v.x, 1, v.z, true);
    audio.explosion();
    player.exitVehicle();
    player.hurt(25);
    hud.message('Your car is wrecked!');
  }
}

function update(dt) {
  G.time += dt;
  // Pause menu.
  if (input.wasHit('Escape') || input.wasHit('p')) {
    if (garage.isOpen()) garage.close();
    else {
      G.state = 'paused';
      hud.showPause(true);
      return;
    }
  }
  // Shop menu open: world waits.
  if (garage.isOpen()) {
    if (input.wasHit('Escape')) garage.close();
    garage.closeIfFar(player, city);
    hud.update(dt, G);
    return;
  }
  // Radio / mute / weapons.
  if (input.wasHit('c')) hud.message(`Radio: ${audio.nextStation()}`);
  if (input.wasHit('m')) hud.message(audio.toggleMute() ? 'Muted' : 'Sound on');
  if (input.wasHit('1')) combat.select('pistol');
  if (input.wasHit('2')) combat.select('smg');
  if (input.wasHit('3')) combat.select('shotgun');
  if (input.wasHit('4')) combat.select('rifle');
  if (input.wasHit('q')) combat.cycle();
  if (input.wasHit('r')) combat.startReload();
  if (input.wasHit('t')) missions.trySideActivity(missionCtx);
  handleInteract();

  const fwd = cameraRig.forward();
  if (player.inVehicle) {
    const v = player.inVehicle;
    // D turns right: in this heading convention right is negative steer.
    const steer = -input.axis('a', 'd') - input.axis('ArrowLeft', 'ArrowRight');
    const throttle = input.axis('s', 'w') + input.axis('ArrowDown', 'ArrowUp');
    const crashed = v.drive(dt, clamp(steer, -1, 1), clamp(throttle, -1, 1), city, G.vehicles);
    if (crashed) {
      audio.collision(true);
      effects.sparks(v.x, 1, v.z);
      damageFromCrash(v);
    }
    audio.setEngine(Math.abs(v.speed) / v.topSpeed, true);
    player.update(dt);
  } else {
    const mv = input.moveAxis();
    const sprint = input.isDown('Shift');
    player.moveOnFoot(dt, mv.fwd, mv.strafe, fwd.x, fwd.z, sprint, city, G.vehicles);
    audio.setEngine(0, false);
    // Aim with the camera; fire with the mouse.
    player.firing = input.mouseDown && !garage.isOpen();
    if (player.firing) player.aimHeading = cameraRig.yaw;
    if (player.firing) combat.fire(camera, player, player);
    player.update(dt);
  }

  // Pedestrians the crosshair can hit (hp lives on the ped itself).
  for (const ped of traffic.peds) {
    if (ped.hp === undefined) { ped.hp = 34; ped.isPed = true; }
  }
  combat.setExtraTargets(traffic.peds.filter((p) => !p.dead && dist(p.x, p.z, player.x, player.z) < 60));
  combat.update(dt, player, (dmg) => {
    if (player.hurt(dmg)) wastePlayer();
  });
  traffic.update(dt, player.x, player.z, player.inVehicle, false);
  // Dead vehicles leave the shared list (despawned traffic, finished
  // race cars, busted cop cars), so boarding always finds a live car.
  if (G.vehicles.some((v) => v.dead)) G.vehicles = G.vehicles.filter((v) => !v.dead);
  police.update(dt, player, G.vehicles, () => bustPlayer(), null);
  missions.update(dt, missionCtx);

  // Bay Coins.
  for (let i = 0; i < city.coins.length; i++) {
    const c = city.coins[i];
    if (c.taken) continue;
    coinMeshes[i].rotation.y += dt * 2;
    coinMeshes[i].position.y = 1.2 + Math.sin(G.time * 2 + i) * 0.25;
    if (dist(player.x, player.z, c.x, c.z) < 2.5) {
      c.taken = true;
      coinMeshes[i].visible = false;
      G.cash += COIN_VALUE;
      G.respect += 5;
      G.coinsCollected++;
      audio.coin();
      effects.ring(c.x, 1.2, c.z, 0xffd24a);
      hud.message(`Bay Coin ${G.coinsCollected}/20 — +$${COIN_VALUE}.`);
    }
  }

  // Camera follows, looking ahead of the player.
  const shake = effects.shakeOffset();
  cameraRig.update(dt, player.x, player.z, 1.5,
    player.inVehicle ? player.inVehicle.heading : player.heading,
    player.inVehicle ? player.inVehicle.speed : player.speed,
    !!player.inVehicle, input.mouseDX, input.mouseDY, shake);
  // Sun shadow follows the player on high quality.
  if (G.quality === 'high') {
    sun.position.set(player.x + 120, 180, player.z + 60);
    sun.target.position.set(player.x, 0, player.z);
    sun.target.updateMatrixWorld();
  }
  if (player.wasted) wastePlayer();
  hud.update(dt, G);
}

// ---- main loop ----
let last = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;
  input.beginFrame();
  if (G.state === 'playing') update(dt);
  else if (G.state === 'paused') {
    if (input.wasHit('Escape') || input.wasHit('p')) {
      G.state = 'playing';
      hud.showPause(false);
    }
  } else if (G.state === 'busted' || G.state === 'wasted') {
    G.bannerTimer -= dt;
    if (G.bannerTimer <= 0) respawn();
  }
  effects.update(dt);
  input.endFrame();
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
