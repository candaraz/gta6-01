// Solmar Bay: boot, the fixed-step loop, and everything that wires the
// systems together — getting in and out of cars, stealing, fighting, the
// wanted level, the story hooks, saving, the menus, and the staged
// screenshot scenes behind ?shot=.
//
// ?seed=N fixes the city's random layout. ?shot=chase|mission|drive|title
// (with &seed=N) stages that scene from the real game, steps it forward with
// scripted input, and sets window.__shotReady for a screenshot.

import * as THREE from 'three';
import { WORLD, PLACES, HIDING_SPOTS, VEHICLE_CLASSES, WEAPONS, WANTED, STEP } from './config.js';
import { createRandom } from './random.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { buildCity } from './city.js';
import { createVehicle, driveVehicle, vehicleSpeedKmh } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPlayer, updatePlayer, playerPunch } from './player.js';
import { createCombat } from './combat.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createActivities } from './activities.js';
import { createEffects } from './effects.js';
import { createCamera } from './camera.js';
import { createHud } from './hud.js';
import { drawMinimap, drawBigMap } from './minimap.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const rng = createRandom(seed);
const trafficRng = createRandom((seed ^ 0x5f3a) >>> 0);

// --- Renderer and scene -------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.className = 'webgl';
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5d9);
scene.fog = new THREE.Fog(0xbfd9e8, 190, 540);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

const sun = new THREE.DirectionalLight(0xfff2d8, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -70;
sun.shadow.camera.right = 70;
sun.shadow.camera.top = 70;
sun.shadow.camera.bottom = -70;
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 320;
sun.shadow.bias = -0.0006;
scene.add(sun);
scene.add(sun.target);
scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 1.0));
scene.add(new THREE.AmbientLight(0xffffff, 0.22));

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Systems ------------------------------------------------------------
const city = buildCity(scene, rng);
const effects = createEffects(scene);
const audio = createAudio();
const input = createInput(renderer.domElement);
const hud = createHud();
const cam = createCamera(camera);
const player = createPlayer(scene, PLACES.startSpot.x, PLACES.startSpot.z);
const traffic = createTraffic(scene, city, trafficRng);
const pedestrians = createPedestrians(scene, city, trafficRng);
const combat = createCombat(scene, city, effects, audio);
const police = createPolice(scene, city, trafficRng, audio);

// --- Game state ---------------------------------------------------------
const S = {
  screen: 'title',
  money: 60,
  weapons: ['fists'],
  currentWeapon: 'fists',
  ammo: { pistol: 0, smg: 0 },
  playerCar: null,
  parkedCars: [],
  looseCars: [],
  ownedCars: [],
  markedCar: null,
  waypoint: null,
  objectiveTitle: 'SOLMAR BAY',
  objectiveText: '',
  timerValue: null,
  timerCountingUp: false,
  timerFresh: false,
  danger: { x: 0, z: 0, level: 0, timer: 0, inHidingSpot: false, rammed: false, starLost: false },
  lastDamageAt: -100,
  gameTime: 0,
  endCause: null,
  carAir: { y: 0, vy: 0, active: false },
  crashCooldown: 0,
  pedHitCooldown: 0,
  toastCooldown: 0,
  debugObjective: null,
};

function addMoney(amount) {
  S.money += amount;
  if (amount > 0) audio.cash();
}

function writeSave() {
  saveGame({
    x: player.x,
    z: player.z,
    heading: player.heading,
    money: S.money,
    health: Math.max(25, Math.round(player.health)),
    missionsDone: missions.completedCount,
    weapons: S.weapons,
    ammo: S.ammo,
    ownedCars: S.ownedCars.map((car) => car.classId),
    medallions: activities.getCollectedIndices(),
    bestTimes: activities.bestTimes,
  });
}

function applySave(data) {
  player.x = data.x;
  player.z = data.z;
  player.heading = data.heading;
  player.health = data.health;
  S.money = data.money;
  S.weapons = data.weapons && data.weapons.length ? data.weapons : ['fists'];
  S.currentWeapon = S.weapons[S.weapons.length - 1];
  S.ammo = { pistol: 0, smg: 0, ...(data.ammo || {}) };
  missions.setCompleted(data.missionsDone || 0);
  activities.setCollected(data.medallions || []);
  activities.setBestTimes(data.bestTimes || {});
  // Owned cars wait at the garage.
  for (const classId of data.ownedCars || []) {
    const spec = VEHICLE_CLASSES[classId];
    if (!spec) continue;
    const car = createVehicle(classId, spec.colors[0], PLACES.tessasGarage.x + 14, PLACES.tessasGarage.z + 6, 0);
    car.isOwned = true;
    scene.add(car.mesh);
    S.looseCars.push(car);
    S.ownedCars.push(car);
  }
  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.rotation.y = player.heading;
}

// --- Missions and activities --------------------------------------------
const missions = createMissions(scene, city, combat, trafficRng, {
  onWaypoint(x, z, label) {
    S.waypoint = x == null ? null : { x, z, label };
  },
  onObjective(text, title) {
    S.objectiveText = text;
    S.objectiveTitle = title;
  },
  onDialogue(line) {
    hud.setDialogue(line);
  },
  onToast(text) {
    hud.toast(text);
  },
  onStepDone() {
    audio.pickup();
  },
  onCheckpoint(index, total) {
    hud.toast(`Checkpoint ${index}/${total}`);
    audio.pickup();
  },
  onCrateTaken(remaining) {
    hud.toast(remaining > 0 ? `Crate recovered — ${remaining} to go` : 'All crates recovered!');
    audio.pickup();
  },
  onTimer(seconds) {
    S.timerValue = seconds;
    S.timerCountingUp = false;
    S.timerFresh = true;
  },
  onMissionStarted(mission) {
    hud.toast(mission.title, 3.5);
  },
  onMissionPassed(mission) {
    addMoney(mission.reward);
    if (mission.unlock && !S.weapons.includes(mission.unlock)) {
      S.weapons.push(mission.unlock);
      S.ammo[mission.unlock] = WEAPONS[mission.unlock].ammo;
      S.currentWeapon = mission.unlock;
      hud.toast(`${mission.title} passed! +$${mission.reward} — ${WEAPONS[mission.unlock].label} unlocked`, 4.5);
    } else {
      hud.toast(`${mission.title} passed! +$${mission.reward}`, 4);
    }
    audio.missionPass();
    if (mission.id === 'wheels-up' && S.playerCar) {
      S.playerCar.isOwned = true;
      S.ownedCars.push(S.playerCar);
    }
    if (mission.id === 'payback-lap') {
      const car = createVehicle('sports', 0xc22e2e, PLACES.tessasGarage.x + 14, PLACES.tessasGarage.z - 6, Math.PI / 2);
      car.isOwned = true;
      scene.add(car.mesh);
      S.looseCars.push(car);
      S.ownedCars.push(car);
      hud.toast('The Falcon GT is waiting at the garage', 4);
    }
    S.objectiveText = '';
    writeSave();
    if (missions.completedCount >= missions.missionList.length) {
      hud.toast('STORY COMPLETE — Solmar Bay is yours. Free roam!', 6);
    }
  },
  onMissionFailed() {
    audio.missionFail();
    S.objectiveText = '';
    hud.toast('Job failed — go see Pearl to try again', 4);
  },
  onRequestMarkedCar() {
    if (S.markedCar) return;
    const place = PLACES.hotelValet;
    const car = createVehicle('luxury', 0x1c1c22, place.x + 6, place.z + 4, Math.PI / 2);
    scene.add(car.mesh);
    S.looseCars.push(car);
    S.markedCar = car;
  },
  isDeliverCarValid() {
    return S.playerCar === S.markedCar;
  },
});

const activities = createActivities(scene, city, trafficRng, {
  onToast(text) {
    hud.toast(text);
  },
  onMoney(amount) {
    addMoney(amount);
  },
  onWaypoint(x, z, label) {
    if (!missions.active) S.waypoint = x == null ? null : { x, z, label };
  },
  onTimer(seconds, countingUp) {
    S.timerValue = seconds;
    S.timerCountingUp = countingUp;
    S.timerFresh = true;
  },
  onMedallion(found, total) {
    audio.pickup();
    addMoney(25);
    if (found >= total) {
      addMoney(500);
      hud.toast('ALL 12 SUN MEDALLIONS! +$500 bonus', 5);
    } else {
      hud.toast(`Sun medallion ${found}/${total} — +$25`);
    }
    writeSave();
  },
});

const carAir = {
  launch(vy) {
    S.carAir.vy = vy;
    S.carAir.active = true;
  },
  isAirborne() {
    return S.carAir.active;
  },
};

// --- Parked cars --------------------------------------------------------
for (const spot of city.parkingSpots.slice(0, 26)) {
  if (trafficRng.chance(0.35)) continue;
  const classId = trafficRng.pick(['sedan', 'hatch', 'pickup', 'luxury', 'van']);
  const spec = VEHICLE_CLASSES[classId];
  const car = createVehicle(classId, trafficRng.pick(spec.colors), spot.x, spot.z, spot.heading);
  scene.add(car.mesh);
  S.parkedCars.push(car);
}
traffic.spawnInitial(player);
pedestrians.spawnInitial(player);

// --- Entering, exiting and stealing cars --------------------------------
function nearestEnterableCar() {
  let best = null;
  let bestDist = 4.6;
  const consider = (car) => {
    const dx = car.x - player.x;
    const dz = car.z - player.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < bestDist) {
      bestDist = dist;
      best = car;
    }
  };
  for (const car of S.parkedCars) consider(car);
  for (const car of S.looseCars) consider(car);
  const nearTraffic = traffic.nearest(player.x, player.z, 4.6);
  if (nearTraffic && Math.abs(nearTraffic.speed) < 3) consider(nearTraffic);
  return best;
}

function enterCar(car) {
  traffic.remove(car);
  const parkedIndex = S.parkedCars.indexOf(car);
  if (parkedIndex !== -1) S.parkedCars.splice(parkedIndex, 1);
  const looseIndex = S.looseCars.indexOf(car);
  if (looseIndex !== -1) S.looseCars.splice(looseIndex, 1);
  S.playerCar = car;
  car.isPlayerCar = true;
  player.inCar = car;
  player.mesh.visible = false;
  if (car === S.markedCar) {
    police.addStars(2, 'theft');
    missions.onMarkedCarStolen();
    hud.toast('The Viceroy is yours — now lose the heat!', 4);
  } else if (!car.isOwned) {
    police.addStars(WANTED.stealCar, 'theft');
    hud.toast(`Stole a ${car.spec.label} — the heat is on`, 3);
  }
  audio.setEngineRunning(true, 0);
}

function exitCar() {
  const car = S.playerCar;
  if (!car) return;
  S.playerCar = null;
  car.isPlayerCar = false;
  player.inCar = null;
  const sideX = car.x + Math.cos(car.heading) * 2.4;
  const sideZ = car.z - Math.sin(car.heading) * 2.4;
  const resolved = city.resolveCollision(sideX, sideZ, 0.55);
  player.x = resolved.x;
  player.z = resolved.z;
  player.heading = car.heading;
  player.mesh.visible = true;
  player.mesh.position.set(player.x, 0, player.z);
  S.looseCars.push(car);
  audio.setEngineRunning(false, 0);
}

// --- Combat input -------------------------------------------------------
function playerShoot() {
  const weaponId = S.currentWeapon;
  if (weaponId === 'fists') return;
  if ((S.ammo[weaponId] || 0) <= 0) {
    if (S.toastCooldown <= 0) {
      hud.toast('No ammo — find an ammo pickup');
      S.toastCooldown = 2;
    }
    return;
  }
  const targets = [...combat.goons, ...pedestrians.peds];
  const shooter = { x: player.x, z: player.z, y: player.y, heading: player.heading };
  const fired = combat.shoot(shooter, weaponId, targets, (target, damage) => {
    if (combat.goons.includes(target)) {
      combat.damageGoon(target, damage, (goon) => {
        missions.onGoonDown(goon);
        addMoney(20);
        if (trafficRng.chance(0.35)) combat.spawnPickup(trafficRng.chance(0.5) ? 'health' : 'ammo', goon.x, goon.z);
      });
    } else {
      pedestrians.knockDown(target);
      police.addStars(WANTED.hitPedestrian, 'crime');
      S.danger.x = player.x;
      S.danger.z = player.z;
      S.danger.level = 1;
      S.danger.timer = 2.5;
    }
  });
  if (fired) {
    S.ammo[weaponId] -= 1;
    police.addStars(WANTED.shootLoud, 'noise');
    S.danger.x = player.x;
    S.danger.z = player.z;
    S.danger.level = 1;
    S.danger.timer = 2.5;
  }
}

function playerMelee() {
  if (!playerPunch(player)) return;
  const targets = [...combat.goons, ...pedestrians.peds];
  const shooter = { x: player.x, z: player.z, heading: player.heading };
  combat.melee(shooter, targets, (target, damage) => {
    if (combat.goons.includes(target)) {
      combat.damageGoon(target, damage, (goon) => {
        missions.onGoonDown(goon);
        addMoney(20);
      });
    } else {
      pedestrians.knockDown(target);
      police.addStars(WANTED.hitPedestrian, 'crime');
    }
  });
}

function damagePlayer(amount, cause) {
  if (S.screen !== 'play') return;
  player.health -= amount;
  S.lastDamageAt = S.gameTime;
  hud.flashDamage();
  cam.addShake(0.5);
  if (player.health <= 0) {
    player.health = 0;
    endGame('wasted', cause);
  }
}

function endGame(cause, detail) {
  const fee = cause === 'busted' ? 150 : 100;
  S.money = Math.max(0, S.money - fee);
  S.endCause = cause;
  if (missions.active) missions.failActive(cause === 'busted' ? 'Busted — the job is blown.' : 'Wasted — the job is blown.');
  police.clearStars();
  combat.clearGoons();
  audio.setSiren(false);
  audio.setEngineRunning(false, 0);
  audio.missionFail();
  if (S.playerCar) {
    S.looseCars.push(S.playerCar);
    S.playerCar.isPlayerCar = false;
    S.playerCar = null;
    player.inCar = null;
    player.mesh.visible = true;
  }
  S.screen = 'end';
  hud.showEnd(
    cause === 'busted' ? 'BUSTED' : 'WASTED',
    cause === 'busted'
      ? `Officer Brandt books you and keeps $${fee} for the trouble. The city moves on without you — for now.`
      : `You wake up at Solmar General, $${fee} lighter. ${detail || 'The Bay is not done with you yet.'}`,
  );
  hud.setHudVisible(false);
}

function respawn() {
  const spot = S.endCause === 'busted' ? PLACES.policeStation : PLACES.hospital;
  player.x = spot.x + 8;
  player.z = spot.z + 8;
  player.health = 100;
  player.mesh.position.set(player.x, 0, player.z);
  cam.snapTo(player);
  hud.hideEnd();
  hud.setHudVisible(true);
  hud.toast(S.endCause === 'busted' ? 'Back on the street. Stay sharp.' : 'Patched up. Back to work.');
  S.screen = 'play';
  writeSave();
}

// --- The fixed step -----------------------------------------------------
function step(dt, scripted) {
  S.gameTime += dt;
  S.crashCooldown = Math.max(0, S.crashCooldown - dt);
  S.pedHitCooldown = Math.max(0, S.pedHitCooldown - dt);
  S.toastCooldown = Math.max(0, S.toastCooldown - dt);
  S.timerFresh = false;
  const keys = scripted ? scripted.keys : null;
  const down = (name) => (keys ? keys.has(name) : input.wasPressed(name));
  const held = (name) => (keys ? keys.has(name) : false);

  // Backdrop life runs on every screen.
  traffic.update(dt, player, [
    player,
    ...(S.playerCar ? [S.playerCar] : []),
    ...police.cruisers,
  ], null);
  pedestrians.update(dt, player, S.danger, city);
  for (const cloud of city.clouds) {
    cloud.position.x += dt * 1.4;
    if (cloud.position.x > 360) cloud.position.x = -360;
  }
  if (city.waterMesh) city.waterMesh.position.y = Math.sin(S.gameTime * 0.5) * 0.12;

  if (S.screen !== 'play') {
    effects.update(dt);
    return;
  }

  // Danger decays.
  if (S.danger.timer > 0) {
    S.danger.timer -= dt;
    if (S.danger.timer <= 0) S.danger.level = 0;
  }
  // Hiding spots.
  S.danger.inHidingSpot = false;
  if (!S.playerCar && police.stars > 0) {
    for (const spot of HIDING_SPOTS) {
      const dx = player.x - spot.x;
      const dz = player.z - spot.z;
      if (dx * dx + dz * dz < spot.radius * spot.radius) S.danger.inHidingSpot = true;
    }
  }

  const axes = scripted ? scripted.axes : input.moveAxes();
  const drag = scripted ? { x: 0, y: 0 } : input.cameraDrag();
  cam.orbit(drag.x, drag.y);

  // --- Driving or on foot ---
  if (S.playerCar) {
    const car = S.playerCar;
    const throttle = (axes.z < 0 ? 1 : 0) + (axes.z > 0 ? -1 : 0);
    const steer = (axes.x < 0 ? 1 : 0) + (axes.x > 0 ? -1 : 0);
    const handbrake = scripted ? !!scripted.handbrake : input.handbrake();
    const result = driveVehicle(car, throttle, steer, handbrake, dt, city, (impact) => {
      if (S.crashCooldown <= 0) {
        audio.crash(impact / 30);
        cam.addShake(Math.min(1, impact / 30));
        effects.sparks(car.x, 0.8, car.z);
        damagePlayer(Math.min(18, impact * 0.35), 'The crash nearly finished the job.');
        S.crashCooldown = 0.6;
      }
    });
    // Stunt air time.
    if (S.carAir.active) {
      S.carAir.vy -= 14 * dt;
      S.carAir.y += S.carAir.vy * dt;
      if (S.carAir.y <= 0) {
        S.carAir.y = 0;
        S.carAir.active = false;
        effects.dust(car.x, 0, car.z);
        if (Math.abs(car.speed) > 20) audio.crash(0.4);
      }
      car.mesh.position.y = S.carAir.y;
    }
    player.x = car.x;
    player.z = car.z;
    player.heading = car.heading;
    audio.setEngineRunning(true, Math.abs(car.speed) / car.spec.topSpeed);
    if (handbrake && Math.abs(car.speed) > 12) {
      effects.dust(car.x - Math.sin(car.heading) * 2, 0, car.z - Math.cos(car.heading) * 2);
    }
    // Smoking, then burning: a wrecked car does not stay drivable.
    if (car.health < 35 && car.health > 0) {
      effects.smoke(car.x, 1.2, car.z);
    }
    if (car.health <= 0 && !car.dead) {
      car.dead = true;
      effects.explosion(car.x, 0, car.z);
      audio.explosion();
      cam.addShake(1.1);
      scene.remove(car.mesh);
      S.playerCar = null;
      player.inCar = null;
      player.mesh.visible = true;
      player.mesh.position.set(player.x, 0, player.z);
      damagePlayer(35, 'Your car went up in flames.');
      hud.toast('Your car is wrecked!');
    }
    // Running over pedestrians is a crime the city notices.
    if (S.pedHitCooldown <= 0 && Math.abs(car.speed) > 6) {
      const ped = pedestrians.nearest(car.x + Math.sin(car.heading) * 2.5, car.z + Math.cos(car.heading) * 2.5, 2.6);
      if (ped) {
        pedestrians.knockDown(ped);
        police.addStars(WANTED.hitPedestrian, 'crime');
        effects.blood(ped.x, 0, ped.z);
        audio.crash(0.5);
        cam.addShake(0.6);
        S.pedHitCooldown = 1.2;
        S.danger.x = player.x;
        S.danger.z = player.z;
        S.danger.level = 1;
        S.danger.timer = 3;
      }
    }
    // Bumping other cars.
    for (const other of [...traffic.cars, ...police.cruisers]) {
      if (other === car) continue;
      const dx = car.x - other.x;
      const dz = car.z - other.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const minDist = (car.spec.length + other.spec.length) / 2 - 0.6;
      if (dist < minDist && dist > 0.01) {
        const push = (minDist - dist) / 2;
        car.x += (dx / dist) * push;
        car.z += (dz / dist) * push;
        other.x -= (dx / dist) * push;
        other.z -= (dz / dist) * push;
        const closing = Math.abs(car.speed - other.speed);
        if (closing > 5 && S.crashCooldown <= 0) {
          car.health -= closing * 0.4;
          other.health -= closing * 0.4;
          audio.crash(closing / 30);
          cam.addShake(0.5);
          effects.sparks((car.x + other.x) / 2, 0.8, (car.z + other.z) / 2);
          if (other.isPolice) police.addStars(WANTED.hitPolice, 'crime');
          S.crashCooldown = 0.7;
        }
        car.mesh.position.set(car.x, S.carAir.y, car.z);
        other.mesh.position.set(other.x, 0, other.z);
      }
    }
    if (down('KeyH') || down('H')) audio.horn();
    cam.followCar(car, dt);
  } else {
    const aiming = S.currentWeapon !== 'fists';
    const sprint = scripted ? !!scripted.sprint : input.sprint();
    const jump = down('Space');
    updatePlayer(player, axes.x, axes.z, sprint, jump, cam.yaw, aiming, dt, city);
    if (player.speed > 5.5) {
      S.danger.x = player.x;
      S.danger.z = player.z;
    }
    // Health creeps back when the player has been safe a while.
    if (player.health < 55 && S.gameTime - S.lastDamageAt > 8) {
      player.health = Math.min(55, player.health + dt * 4);
    }
    if (down('Digit1') || down('1')) S.currentWeapon = 'fists';
    if ((down('Digit2') || down('2')) && S.weapons.includes('pistol')) S.currentWeapon = 'pistol';
    if ((down('Digit3') || down('3')) && S.weapons.includes('smg')) S.currentWeapon = 'smg';
    const heldWeapon = WEAPONS[S.currentWeapon];
    const wantShoot = scripted ? !!scripted.click : (input.wasClicked() || (heldWeapon.auto && input.mouseHeld()));
    if (wantShoot) {
      if (S.currentWeapon === 'fists') playerMelee();
      else playerShoot();
    }
    if (down('KeyF') || down('F')) playerMelee();
    cam.followOnFoot(player, dt);
  }

  // --- Interactions on E ---
  let prompt = '';
  if (!S.playerCar) {
    const nearPearl = Math.hypot(player.x - PLACES.pearlsOffice.x, player.z - PLACES.pearlsOffice.z) < 9;
    if (nearPearl && missions.canStart()) {
      prompt = `E — Talk to Pearl: ${missions.nextMission().title}`;
      if (down('KeyE') || down('E')) missions.startNext();
    } else {
      const car = nearestEnterableCar();
      if (car) {
        prompt = car.isOwned ? `E — Get in your ${car.spec.label}` : `E — Steal the ${car.spec.label}`;
        if (down('KeyE') || down('E')) enterCar(car);
      }
    }
    if (S.danger.inHidingSpot && police.stars > 0) prompt = 'Hidden — the heat is fading fast';
  } else if (S.playerCar) {
    prompt = 'E — Get out';
    // The spray shop at Tessa's.
    const inShop = Math.hypot(S.playerCar.x - PLACES.tessasGarage.x, S.playerCar.z - 112) < 9;
    const ePressed = down('KeyE') || down('E');
    if (inShop && Math.abs(S.playerCar.speed) < 2 && police.stars > 0) {
      if (S.money >= 100) {
        prompt = 'E — Spray shop: lose the heat ($100)';
        if (ePressed) {
          S.money -= 100;
          police.clearStars();
          S.playerCar.health = 100;
          hud.toast('Fresh paint. The heat is gone.');
          audio.cash();
        }
      } else {
        prompt = 'Spray shop needs $100 — E to get out';
        if (ePressed) exitCar();
      }
    } else if (ePressed) {
      exitCar();
    }
  }
  hud.setPrompt(prompt);

  // --- Systems that react to the player ---
  missions.update(dt, player, S.playerCar, police.stars);
  activities.update(dt, player, S.playerCar, carAir);
  combat.updateGoons(dt, player, trafficRng, (goon, dist) => {
    // A goon fires: a loud crack, a muzzle flash, and a chance to be hit.
    effects.muzzle(goon.x, 0, goon.z, goon.heading);
    audio.shot(false);
    const hitChance = dist < 12 ? 0.5 : dist < 20 ? 0.3 : 0.14;
    if (Math.random() < hitChance) {
      damagePlayer(9 + Math.random() * 6, "Deke's crew got the better of you.");
    } else {
      effects.dust(player.x + (Math.random() - 0.5) * 3, 0, player.z + (Math.random() - 0.5) * 3);
    }
  });
  combat.updatePickups(dt, player, (kind) => {
    if (kind === 'health') {
      player.health = Math.min(100, player.health + 35);
      hud.toast('Health +35');
    } else if (kind === 'ammo') {
      if (S.weapons.includes('pistol')) S.ammo.pistol += 24;
      if (S.weapons.includes('smg')) S.ammo.smg += 60;
      hud.toast('Ammo restocked');
    }
    audio.pickup();
  });
  const policeResult = police.update(dt, player, S.playerCar, S.danger);
  if (S.danger.rammed) {
    S.danger.rammed = false;
    cam.addShake(0.5);
    if (S.crashCooldown <= 0) {
      audio.crash(0.5);
      S.crashCooldown = 0.5;
    }
  }
  if (S.danger.starLost) {
    S.danger.starLost = false;
    hud.toast('A star fades — keep hiding');
  }
  if (policeResult.busted) {
    endGame('busted');
  }
  effects.update(dt);

  // --- HUD ---
  if (!missions.active && missions.canStart() && !S.waypoint && !S.debugObjective) {
    S.waypoint = { x: PLACES.pearlsOffice.x, z: PLACES.pearlsOffice.z, label: "Pearl's Office" };
  }
  hud.setMoney(S.money);
  hud.setStars(police.stars, police.evading);
  hud.setHealth(player.health);
  const objectiveText = S.debugObjective ? S.debugObjective.text : S.objectiveText;
  const objectiveTitle = S.debugObjective ? S.debugObjective.title : S.objectiveTitle;
  let waypointDist = null;
  if (S.waypoint) {
    waypointDist = Math.hypot(player.x - S.waypoint.x, player.z - S.waypoint.z);
  }
  if (!missions.active && !S.debugObjective) {
    hud.setObjective(
      'SOLMAR BAY',
      missions.canStart() ? 'Free roam — see Pearl (P) for the next job' : 'Story complete — free roam!',
      waypointDist,
    );
  } else {
    hud.setObjective(objectiveTitle, objectiveText, waypointDist);
  }
  if (!S.timerFresh) S.timerValue = null;
  hud.setTimer(S.timerValue, S.timerCountingUp);
  if (S.playerCar) {
    hud.setDriving(S.playerCar.spec.label, vehicleSpeedKmh(S.playerCar));
  } else {
    hud.setDriving(null, 0);
  }
  const weapon = WEAPONS[S.currentWeapon];
  hud.setWeapon(weapon.label, weapon.melee ? '∞' : `${S.ammo[S.currentWeapon] || 0} rounds`);
  hud.setCrosshair(!S.playerCar && S.currentWeapon !== 'fists');
  hud.setBustProgress(police.bustProgress);
  hud.setMedallions(activities.collectedCount, 12);
  hud.updateWaypointArrow(camera, S.waypoint);
  drawMinimap(document.getElementById('minimap'), {
    playerX: player.x,
    playerZ: player.z,
    heading: player.heading,
    waypoint: S.waypoint,
    police: police.cruisers,
    goons: combat.goons,
  });

  // The sun follows the player so shadows stay crisp.
  sun.position.set(player.x + 90, 130, player.z + 50);
  sun.target.position.set(player.x, 0, player.z);
  sun.target.updateMatrixWorld();

  if (!scripted) input.endFrame();
}

// --- Free-roam waypoint: Pearl's office until the story is done ---------
function refreshFreeRoamWaypoint() {
  if (!missions.active && missions.canStart()) {
    S.waypoint = { x: PLACES.pearlsOffice.x, z: PLACES.pearlsOffice.z, label: "Pearl's Office" };
  }
}

// --- Screens ------------------------------------------------------------
function startFresh() {
  audio.unlock();
  hud.hideStart();
  hud.setHudVisible(true);
  S.screen = 'play';
  cam.setYaw(Math.PI);
  cam.snapTo(player);
  refreshFreeRoamWaypoint();
  hud.toast('Welcome back to Solmar Bay. Go see Pearl.', 4);
}

function startContinued() {
  const data = loadGame();
  if (data) applySave(data);
  startFresh();
  hud.toast('Save loaded — welcome back.', 3.5);
}

function pauseGame() {
  if (S.screen !== 'play') return;
  S.screen = 'pause';
  audio.setEngineRunning(false, 0);
  audio.setSiren(false);
  hud.showPause(
    `Money $${S.money.toLocaleString('en-US')}  •  Jobs done ${missions.completedCount}/${missions.missionList.length}`
    + `  •  Medallions ${activities.collectedCount}/12  •  Wanted ${'★'.repeat(police.stars) || 'clean'}`,
  );
}

function resumeGame() {
  if (S.screen !== 'pause') return;
  S.screen = 'play';
  hud.hidePause();
}

hud.bindButtons({
  onStart: startFresh,
  onContinue: startContinued,
  onResume: resumeGame,
  onSave: () => {
    writeSave();
    hud.toast('Game saved');
    audio.click();
  },
  onRestart: () => {
    const data = loadGame();
    if (data) {
      if (S.playerCar) {
        S.looseCars.push(S.playerCar);
        S.playerCar.isPlayerCar = false;
        S.playerCar = null;
        player.inCar = null;
        player.mesh.visible = true;
      }
      applySave(data);
      cam.snapTo(player);
    }
    hud.hidePause();
    S.screen = 'play';
  },
  onRespawn: () => {
    audio.click();
    respawn();
  },
  onCloseMap: () => {
    hud.showBigmap(false);
    S.screen = 'play';
  },
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') {
    if (S.screen === 'play' && document.getElementById('bigmap').style.display === 'flex') {
      hud.showBigmap(false);
    } else if (S.screen === 'play') {
      pauseGame();
    } else if (S.screen === 'pause') {
      resumeGame();
    }
  }
  if ((event.key === 'm' || event.key === 'M') && (S.screen === 'play')) {
    const bigmap = document.getElementById('bigmap');
    const showing = bigmap.style.display === 'flex';
    hud.showBigmap(!showing);
    if (!showing) {
      drawBigMap(document.getElementById('bigmap-canvas'), {
        playerX: player.x,
        playerZ: player.z,
        heading: player.heading,
        waypoint: S.waypoint,
      });
    }
  }
  if (S.screen === 'title' && (event.key === 'Enter' || event.key === ' ')) startFresh();
});

// --- Title backdrop: a slow orbit over downtown --------------------------
let titleAngle = 0.6;
function titleFrame(dt) {
  titleAngle += dt * 0.03;
  const cx = Math.sin(titleAngle) * 90;
  const cz = Math.cos(titleAngle) * 90;
  cam.setFraming(cx, 42, cz, 0, 4, 0);
  sun.position.set(90, 130, 50);
  sun.target.position.set(0, 0, 0);
  sun.target.updateMatrixWorld();
}

// --- The loop ------------------------------------------------------------
let last = performance.now();
let accumulator = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const frameDt = Math.min((now - last) / 1000, 0.25);
  last = now;
  if (S.screen === 'title') {
    titleFrame(frameDt);
    traffic.update(frameDt, player, [player], null);
    pedestrians.update(frameDt, player, S.danger, city);
    for (const cloud of city.clouds) {
      cloud.position.x += frameDt * 1.4;
      if (cloud.position.x > 360) cloud.position.x = -360;
    }
    effects.update(frameDt);
  } else if (S.screen === 'play' || S.screen === 'end') {
    accumulator += frameDt;
    while (accumulator >= STEP) {
      step(STEP, null);
      accumulator -= STEP;
      if (S.screen !== 'play' && S.screen !== 'end') {
        accumulator = 0;
        break;
      }
    }
  }
  renderer.render(scene, camera);
}

// --- Boot ----------------------------------------------------------------
hud.setHudVisible(false);
hud.showStart(hasSave());
refreshFreeRoamWaypoint();
cam.setYaw(Math.PI);
cam.snapTo(player);

// The debug hook the play-tests drive the game through.
window.__game = {
  state: S,
  player,
  missions,
  police,
  combat,
  traffic,
  pedestrians,
  activities,
  step,
  cam,
  enterCar,
  exitCar,
  startFresh,
  setDebugObjective(title, text) {
    S.debugObjective = title ? { title, text } : null;
  },
  setWaypoint(x, z, label) {
    S.waypoint = x == null ? null : { x, z, label };
  },
};

if (shotName) {
  stageShot(shotName, {
    S,
    player,
    missions,
    police,
    combat,
    traffic,
    pedestrians,
    activities,
    city,
    scene,
    camera,
    renderer,
    cam,
    hud,
    audio,
    rng: trafficRng,
    step,
    enterCar,
    startFresh,
  });
} else {
  requestAnimationFrame(frame);
}
