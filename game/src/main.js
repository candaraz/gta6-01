// main.js — Solmar Bay v3: the game loop and the wiring.
// One job: build the world, own the state machine (title / playing /
// paused / busted / wasted), and run the frame. Everything else is a
// module with one clear job; this file only connects them.
//
// Debug handle for the play-test driver: window.G exposes the state the
// driver reads (player, mission, waypoint, enemies, audio peaks) and the
// staging entry points. It is not a cheat: the driver still plays with
// the keyboard and mouse.

import * as THREE from 'three';
import { buildCity } from './city.js';
import { createVehicles } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPlayer } from './player.js';
import { createCamera } from './camera.js';
import { createCombat } from './combat.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createGarage } from './garage.js';
import { createHud } from './hud.js';
import { createMinimap } from './minimap.js';
import { createAudio } from './audio.js';
import { createEffects } from './effects.js';
import { createInput } from './input.js';
import { createSave } from './save.js';
import { createShots } from './shots.js';

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '7', 10);
const shotName = params.get('shot') || '';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(1280, 800);
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fc4e8);

// The shared game object. Modules read each other through it, lazily,
// so the build order below never creates a cycle.
const G = {
  scene, renderer, time: 0, state: 'title',
  seed, shotName,
};

G.city = buildCity(scene, seed);
G.effects = createEffects(scene);
G.audio = createAudio();
G.input = createInput(canvas);
G.vehicles = createVehicles(scene, G.city, G.effects, G.audio);
G.traffic = createTraffic(G.vehicles, G.city, null);
G.peds = createPedestrians(scene, G.city);
G.camera = createCamera(G);
G.player = createPlayer(G);
G.combat = createCombat(G);
G.police = createPolice(G);
G.missions = createMissions(G);
G.garage = createGarage(G);
G.hud = createHud(G);
G.minimap = createMinimap(G);
G.save = createSave(G);
G.shots = createShots(G);

function setState(s) {
  G.state = s;
  if (s === 'title') {
    const save = G.save.read();
    G.hud.showTitle(!!save, startNewGame, continueGame);
  } else if (s === 'paused') {
    G.hud.showPause(resumeGame, saveAndQuit, quitToTitle);
  } else if (s === 'busted') {
    G.hud.showBusted(respawnAfterBust);
  } else if (s === 'wasted') {
    G.hud.showWasted(respawnAfterWaste);
  } else {
    G.hud.hideOverlays();
  }
}
G.setState = setState;

function startNewGame() {
  G.save.clear();
  G.player.p.cash = 500; G.player.p.respect = 0; G.player.p.health = 100;
  G.player.p.x = 0; G.player.p.z = 200; G.player.p.heading = Math.PI;
  G.missions.startMission(0);
  G.audio.ensure(); G.audio.startMusic();
  setState('playing');
}
function continueGame() {
  const d = G.save.read();
  if (d) G.save.apply(d);
  G.audio.ensure(); G.audio.startMusic();
  setState('playing');
}
function resumeGame() { setState('playing'); }
function saveAndQuit() { G.save.write(); quitToTitle(); }
function quitToTitle() { setState('title'); }
function respawnAfterBust() {
  const p = G.player.p;
  p.cash = Math.max(0, p.cash - 150);
  p.health = 100; p.dead = false;
  G.police.setStars(0);
  p.x = -72; p.z = -72; p.heading = Math.PI;
  if (p.car) { G.vehicles.despawnCar(p.car); p.car = null; p.boat = null; p.onFoot = true; }
  setState('playing');
}
function respawnAfterWaste() {
  const p = G.player.p;
  p.cash = Math.max(0, p.cash - 100);
  p.health = 100; p.dead = false;
  G.police.setStars(0);
  p.x = -72; p.z = -72; p.heading = Math.PI;
  if (p.car) { G.vehicles.despawnCar(p.car); p.car = null; p.boat = null; p.onFoot = true; }
  setState('playing');
}

// World population: parked cars to steal, traffic, walkers.
G.vehicles.spawnParked(Math.random, 14);
for (let i = 0; i < 20; i++) G.traffic.spawnOne();

// The mission the player starts on.
G.missions.startMission(0);
// A parked Kestrel near the start avenue for the first mission.
if (!G.vehicles.nearestCar(0, 232, 8)) G.vehicles.spawnCar('kestrel', 0, 232, Math.PI, 'parked');

let lastMission = 0;
let lastTime = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
  lastTime = now;
  const input = G.input;

  // State transitions from the keyboard.
  if (G.state === 'title' && (input.takePressed('Enter') || input.takePressed('NumpadEnter'))) {
    if (G.save.read()) continueGame(); else startNewGame();
  } else if (G.state === 'playing' && (input.takePressed('KeyP') || input.takePressed('Escape'))) {
    setState('paused');
  } else if (G.state === 'paused' && (input.takePressed('KeyP') || input.takePressed('Escape'))) {
    setState('playing');
  } else if ((G.state === 'busted' || G.state === 'wasted') && input.takePressed('Enter')) {
    if (G.state === 'busted') respawnAfterBust(); else respawnAfterWaste();
  }
  // Clicking the canvas also unlocks audio.
  if (input.mouse.clicked) G.audio.ensure();

  if (G.state === 'playing') {
    G.time += dt;
    G.player.update(dt, input);
    G.camera.update(dt, input);
    G.combat.update(dt, input);
    G.police.update(dt);
    G.missions.update(dt, input);
    G.garage.update(dt, input);
    G.vehicles.update(dt, G.time);
    G.traffic.update(dt, G.time, G.player.p.x, G.player.p.z);
    G.peds.update(dt, G.time, G.player.p.x, G.player.p.z);
    G.city.update(dt, G.player.p);
    G.effects.update(dt);
    // Engine note follows the car; music + sirens tick in audio.
    const car = G.player.p.car;
    G.audio.setEngine(car ? Math.min(1, Math.abs(car.speed) / 40) : 0, !!car);
    // Autosave when a mission is completed.
    if (G.missions.current > lastMission) { lastMission = G.missions.current; G.save.write(); }
    G.minimap.draw();
    G.hud.update();
  }
  renderer.render(scene, G.camera.camera);
  input.endFrame();
}

// Shot staging (?shot=...): skip the title, go straight into the scene.
if (shotName) {
  G.audio.ensure();
  G.audio.startMusic();
  setState('playing');
  G.shots.stage(shotName);
  lastMission = G.missions.current;
} else {
  setState('title');
}

requestAnimationFrame(frame);

// Driver handle: the play-test reads state and stages shots through this.
window.G = G;
window.G.debug = {
  get state() { return G.state; },
  get time() { return G.time; },
  get mission() { return G.missions.current; },
  get missionStage() { return G.missions.stage; },
  get missionName() { return G.missions.name(); },
  get waypoint() { return G.missions.waypoint(); },
  get objective() { return G.missions.objective(); },
  get stars() { return G.police.stars; },
  get enemies() { return G.combat.aliveCount(); },
  get cash() { return G.player.p.cash; },
  get respect() { return G.player.p.respect; },
  get rank() { return G.player.rank(); },
  get health() { return G.player.p.health; },
  get player() { return { x: G.player.p.x, z: G.player.p.z, y: G.player.p.y, heading: G.player.p.heading, onFoot: G.player.p.onFoot, car: !!G.player.p.car }; },
  get audioPeak() { return G.audio.peak(); },
  get audioAvg() { return G.audio.avg(); },
  get audioRunning() { return G.audio.running; },
  get enemiesList() { return G.combat.enemies.map((e) => ({ x: e.x, z: e.z, hp: e.hp })); },
  get cops() { return G.police.cops.map((c) => ({ x: c.car.x, z: c.car.z })); },
  screenOf(x, y, z) { return G.camera.toScreen(x, y, z, 1280, 800); },
  start() { startNewGame(); },
  stageShot(name) { G.shots.stage(name); },
  setMission(i) { G.missions.setCurrent(i); },
  setStars(n) { G.police.setStars(n); },
};
