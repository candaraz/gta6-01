// SOLMAR BAY — main loop and wiring.
// Boots the renderer, builds the city, the player, traffic, police,
// missions and HUD, then steps them all. The game state the driver
// (and the pause menu) reads lives on window.G.
import * as THREE from 'three';
import { CFG } from './config.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { buildCity } from './city.js';
import { createPlayer, stepPlayer } from './player.js';
import { createCamera } from './camera.js';
import { createCombat } from './combat.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createActivities } from './garage.js';
import { initTraffic, stepTraffic } from './traffic.js';
import { initPedestrians, stepPedestrians } from './pedestrians.js';
import { createEffects } from './effects.js';
import { createHud } from './hud.js';
import { createMinimap } from './minimap.js';
import { createSave } from './save.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || String(CFG.seedDefault), 10) || CFG.seedDefault;
const shotName = params.get('shot') || null;
const autostart = params.get('autostart') === '1';
// ?low=1 drops shadows/antialiasing for a fast frame rate on weak
// renderers (headless software GL). The shipped default is full quality.
const lowQuality = params.get('low') === '1';

const G = {
  seed, time: 0, state: 'title',
  cash: 1250, respect: 0,
  vehicles: [],
  renderer: null, scene: null,
};
window.G = G;

function boot() {
  const canvas = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowQuality });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(lowQuality ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = !lowQuality;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  G.renderer = renderer;
  G.scene = new THREE.Scene();

  G.input = createInput();
  G.audio = createAudio();
  G.city = buildCity(G);
  G.cameraRig = createCamera(G);
  createPlayer(G);
  createCombat(G);
  createPolice(G);
  createMissions(G);
  createActivities(G);
  createEffects(G);
  createHud(G);
  createMinimap(G);
  createSave(G);
  initTraffic(G);
  initPedestrians(G);
  G.missions.spawnMissionVehicles();

  // Title screen buttons.
  document.getElementById('playBtn').addEventListener('click', () => startGame(false));
  document.getElementById('contBtn').addEventListener('click', () => startGame(true));
  document.getElementById('resumeBtn').addEventListener('click', () => {
    G.state = 'playing'; G.hud.showScreen(null);
  });
  document.getElementById('quitBtn').addEventListener('click', () => {
    G.save.saveGame(); G.state = 'title'; G.hud.showScreen('title');
  });

  if (shotName) {
    startGame(false, true);
    applyShot(G, shotName);
  } else if (autostart) {
    startGame(false);
  } else {
    G.hud.showScreen('title');
    G.hud.update();
  }
  G.ready = true;
  requestAnimationFrame(loop);
}

function startGame(continueSave, staged) {
  G.audio.ensure();
  if (continueSave && G.save.loadGame()) {
    G.state = 'playing';
  } else {
    G.cash = 1250; G.respect = 0;
    G.player.health = 100;
    G.player.x = 0; G.player.z = 48; G.player.heading = -Math.PI / 2;
    G.player.mesh.position.set(0, 0, 48);
    G.cameraRig.snapBehind(-Math.PI / 2);
    G.missions.startMission(0);
    G.state = 'playing';
  }
  G.hud.showScreen(null);
  G.hud.update();
  if (staged) G.state = 'playing';
}

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  // Real elapsed time, capped at 1 s after a long stall. The world is
  // stepped in fixed 0.05 s slices so the game keeps real time even when
  // the renderer is slow (headless SwiftShader runs ~1 FPS; a single
  // clamped dt would put the whole game in slow motion and no driver
  // timeout would ever be long enough). Physics stays stable because
  // each slice is the same size the game was tuned for.
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 1) dt = 1;
  if (dt <= 0) dt = 0.001;
  G.time += dt;

  const I = G.input;
  // Pause.
  if (I.consume('pause') && G.state === 'playing') { G.state = 'paused'; G.hud.showScreen('pause'); }
  else if (I.consume('pause') && G.state === 'paused') { G.state = 'playing'; G.hud.showScreen(null); }

  if (G.state === 'playing') {
    // Weapon keys / fire / punch — consumed once per frame.
    if (I.consume('w1')) G.combat.select('w1');
    if (I.consume('w2')) G.combat.select('w2');
    if (I.consume('w3')) G.combat.select('w3');
    if (I.consume('w4')) G.combat.select('w4');
    if (I.consume('w5')) G.combat.select('w5');
    if (I.consume('cycle')) G.combat.cycle();
    if (I.consume('reload')) G.combat.reload();
    if (I.mouseClicked || (I.mouseDown && G.combat.weaponDef().auto)) G.combat.fire();
    if (I.consume('punch') && !G.player.vehicle) G.combat.punch();

    const steps = Math.max(1, Math.ceil(dt / 0.05));
    const sdt = dt / steps;
    for (let i = 0; i < steps; i++) {
      stepPlayer(G, sdt);
      stepTraffic(G, sdt);
      stepPedestrians(G, sdt);
      G.combat.step(sdt);
      G.police.step(sdt);
      G.missions.step(sdt);
      G.activities.step(sdt);
      G.effects.step(sdt);
      // Clouds drift.
      for (const c of G.city.clouds) {
        c.position.x += sdt * 1.5;
        if (c.position.x > 360) c.position.x = -360;
      }
      // Sea shimmer.
      if (G.city.sea) G.city.sea.position.y = 0.05 + Math.sin(G.time * 0.8) * 0.05;
      // Periodic autosave every 30 s.
      G._saveT = (G._saveT || 0) + sdt;
      if (G._saveT > 30) { G._saveT = 0; G.save.saveGame(); }
    }
  }

  G.cameraRig.step(dt);
  G.hud.update();
  G.minimap.draw();
  G.renderer.render(G.scene, G.cameraRig.cam);
  I.endFrame();
}

boot();
