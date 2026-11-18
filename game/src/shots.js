// The staged screenshot scenes behind ?shot=. Each one sets the real game
// state — a chase, a firefight, a drive, the title screen — steps the real
// simulation forward with scripted input, renders, and sets window.__shotReady.
// Nothing is edited or composited: every pixel comes from the game's code.

import { PLACES, STEP } from './config.js';
import { createVehicle } from './vehicles.js';

function driveScript(axes, extra = {}) {
  return { keys: new Set(), axes, click: false, handbrake: false, sprint: false, ...extra };
}

function runSteps(ctx, count, script) {
  for (let i = 0; i < count; i += 1) {
    ctx.step(STEP, script(i));
  }
}

function renderFrames(ctx, count) {
  for (let i = 0; i < count; i += 1) {
    ctx.renderer.render(ctx.scene, ctx.camera);
  }
  window.__shotReady = true;
}

function beginPlay(ctx) {
  ctx.S.screen = 'play';
  ctx.hud.hideStart();
  ctx.hud.setHudVisible(true);
}

// 1-cover: a three-star police chase down the main avenue — cruisers on
// both flanks and one head-on, traffic ahead, the minimap, the objective
// and the waypoint on the HUD.
function stageChase(ctx) {
  beginPlay(ctx);
  const { S, player } = ctx;
  const car = createVehicle('sports', 0xc22e2e, 0, -90, 0);
  sceneAdd(ctx, car);
  player.x = 0;
  player.z = -90;
  player.heading = 0;
  ctx.enterCar(car);
  S.money = 1250;
  S.weapons = ['fists', 'pistol'];
  S.currentWeapon = 'pistol';
  S.ammo.pistol = 36;
  ctx.police.setStars(3);
  S.debugObjective = { title: 'THE PICKUP', text: 'Drive Pearl to the marina meet' };
  S.waypoint = { x: PLACES.marinaMeet.x, z: PLACES.marinaMeet.z, label: 'Marina Meet' };
  ctx.cam.setYaw(Math.PI);
  ctx.cam.snapTo(car);
  // Traffic on the avenue, same direction and oncoming.
  ctx.traffic.spawnCarAt('sedan', -2.4, -30, 0, true, 1);
  ctx.traffic.spawnCarAt('van', 2.4, -10, Math.PI, true, -1);
  ctx.traffic.spawnCarAt('hatch', -2.4, 30, 0, true, 1);
  runSteps(ctx, 100, () => driveScript({ x: 0, z: -1 }, { keys: new Set() }));
  // Arrange the pursuit so it reads in one frame: one cruiser on each flank
  // matching speed, one head-on ahead.
  const flank = [
    { dx: -4.6, dz: 4, heading: 0 },
    { dx: 4.6, dz: 2, heading: 0 },
    { dx: 1.5, dz: 46, heading: Math.PI },
    { dx: -3, dz: 28, heading: Math.PI },
  ];
  ctx.police.cruisers.forEach((cruiser, i) => {
    const pose = flank[i % flank.length];
    cruiser.x = car.x + pose.dx;
    cruiser.z = car.z + pose.dz;
    cruiser.heading = pose.heading;
    cruiser.speed = car.speed * 0.92;
    cruiser.mesh.position.set(cruiser.x, 0, cruiser.z);
    cruiser.mesh.rotation.y = cruiser.heading;
  });
  runSteps(ctx, 22, () => driveScript({ x: 0, z: -1 }, { keys: new Set() }));
  renderFrames(ctx, 3);
}

// 2: on foot down an open avenue, mid-firefight — goons ahead, the waypoint
// beacon beyond them, dialogue, the crosshair, a fresh muzzle flash.
function stageMission(ctx) {
  beginPlay(ctx);
  const { S, player } = ctx;
  player.x = 120;
  player.z = 60;
  player.heading = 0;
  player.health = 78;
  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.rotation.y = player.heading;
  S.money = 840;
  S.weapons = ['fists', 'pistol', 'smg'];
  S.currentWeapon = 'pistol';
  S.ammo.pistol = 30;
  S.ammo.smg = 90;
  const rng = ctx.rng;
  ctx.combat.spawnGoon(118, 82, rng);
  ctx.combat.spawnGoon(124, 88, rng);
  ctx.combat.spawnGoon(120, 96, rng);
  for (const goon of ctx.combat.goons) goon.alerted = true;
  S.debugObjective = { title: 'DOCKSIDE HEAT', text: 'Clear the yards of Deke\u2019s crew (3 left)' };
  S.waypoint = { x: 120, z: 102, label: 'Deke’s Crew' };
  ctx.hud.setDialogue(['Pearl', 'His boys are all over the yards. Go loud — and come back.']);
  ctx.cam.setYaw(Math.PI);
  ctx.cam.snapTo(player);
  // Let the goons close in and trade shots, then fire one last round so the
  // muzzle flash is still lit when the frame is rendered.
  runSteps(ctx, 50, () => driveScript({ x: 0, z: 0 }, { keys: new Set() }));
  runSteps(ctx, 1, () => driveScript({ x: 0, z: 0 }, { click: true, keys: new Set() }));
  ctx.hud.setDialogue(['Pearl', 'His boys are all over the yards. Go loud — and come back.']);
  renderFrames(ctx, 3);
}

// 3: driving east along the marina road in traffic, pedestrians on the
// sidewalks, the speedometer up, Tessa's garage ahead on the waypoint.
function stageDrive(ctx) {
  beginPlay(ctx);
  const { S, player } = ctx;
  const car = createVehicle('sedan', 0x3d6e9e, -120, 120, Math.PI / 2);
  sceneAdd(ctx, car);
  player.x = -120;
  player.z = 120;
  player.heading = Math.PI / 2;
  ctx.enterCar(car);
  ctx.police.clearStars();
  S.money = 420;
  S.debugObjective = { title: 'WHEELS UP', text: "Drive to Tessa's Garage" };
  S.waypoint = { x: PLACES.tessasGarage.x, z: PLACES.tessasGarage.z, label: "Tessa's Garage" };
  ctx.cam.setYaw((Math.PI / 2) + Math.PI);
  ctx.cam.snapTo(car);
  runSteps(ctx, 130, () => driveScript({ x: 0, z: -1 }, { keys: new Set() }));
  renderFrames(ctx, 3);
}

// 4: the title screen over a high view of downtown and the bay.
function stageTitle(ctx) {
  ctx.S.screen = 'title';
  ctx.hud.showStart(false);
  ctx.hud.setHudVisible(false);
  ctx.cam.setFraming(265, 48, 40, -30, 6, -30);
  // Let the streets live a little behind the menu.
  for (let i = 0; i < 40; i += 1) {
    ctx.traffic.update(STEP, ctx.player, [ctx.player], null);
    ctx.pedestrians.update(STEP, ctx.player, ctx.S.danger, ctx.city);
  }
  renderFrames(ctx, 3);
}

function sceneAdd(ctx, car) {
  ctx.scene.add(car.mesh);
  ctx.S.looseCars.push(car);
}

export function stageShot(name, ctx) {
  if (name === 'mission') stageMission(ctx);
  else if (name === 'drive') stageDrive(ctx);
  else if (name === 'title') stageTitle(ctx);
  else stageChase(ctx);
}
