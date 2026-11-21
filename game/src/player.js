// The player: Milo Kade, on foot and behind the wheel.
// On foot the camera is level at chest height and movement follows the
// camera yaw (read live, never a stale copy). E enters the nearest car
// (mission vehicle preferred); stealing from a driver adds heat.
import * as THREE from 'three';
import { CFG } from './config.js';
import { clamp, dist } from './random.js';
import { nearestVehicle, stepVehicle, headingTo } from './vehicles.js';

export function createPlayer(G) {
  const g = new THREE.Group();
  const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.95, 0.45),
    new THREE.MeshLambertMaterial({ color: 0x2e7d6b }));
  shirt.position.y = 1.05; shirt.castShadow = true;
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.75, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x1a1a22 }));
  legs.position.y = 0.38;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xe8b88a }));
  head.position.y = 1.8;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.12, 10),
    new THREE.MeshLambertMaterial({ color: 0xd32f2f }));
  cap.position.y = 2.02;
  g.add(shirt, legs, head, cap);
  g.position.set(0, 0, 48);
  G.scene.add(g);
  const P = {
    mesh: g, x: 0, z: 48, heading: 0, speed: 0,
    health: 100, vehicle: null, walkPhase: 0,
    bustGrace: 0, exitGrace: 0, vaultGrace: 0,
    onFootSpeed: 6, sprintSpeed: 9.5,
  };
  G.player = P;
  return P;
}

export function stepPlayer(G, dt) {
  const P = G.player, I = G.input;
  P.bustGrace = Math.max(0, P.bustGrace - dt);
  P.exitGrace = Math.max(0, P.exitGrace - dt);
  P.vaultGrace = Math.max(0, P.vaultGrace - dt);
  if (G.state !== 'playing') return;

  // Entering / exiting vehicles.
  if (I.consume('enter')) {
    if (P.vehicle) {
      exitVehicle(G);
    } else {
      // Mission vehicle first (the Marlin at the pier, the Comet, the Kestrel).
      let v = null;
      const want = G.missions && G.missions.wantedVehicle;
      if (want) v = nearestVehicle(G, P.x, P.z, 14, want);
      if (!v) v = nearestVehicle(G, P.x, P.z, 5.5);
      if (v) enterVehicle(G, v);
    }
  }

  if (P.vehicle) {
    const v = P.vehicle;
    const input = {
      up: I.isDown('up'), down: I.isDown('down'),
      left: I.isDown('left'), right: I.isDown('right'),
      handbrake: I.isDown('handbrake'),
    };
    stepVehicle(G, v, dt, input);
    P.x = v.x; P.z = v.z; P.heading = v.heading; P.speed = v.speed;
    P.mesh.visible = false;
    if (I.consume('horn')) G.audio.horn();
    G.audio.setEngine(Math.abs(v.speed) / v.def.top, true);
  } else {
    // On foot, camera-relative movement.
    const camYaw = G.cameraRig.yaw;
    let fx = 0, fz = 0;
    if (I.isDown('up')) { fx += Math.sin(camYaw); fz += Math.cos(camYaw); }
    if (I.isDown('down')) { fx -= Math.sin(camYaw); fz -= Math.cos(camYaw); }
    if (I.isDown('left')) { fx += Math.sin(camYaw + Math.PI / 2); fz += Math.cos(camYaw + Math.PI / 2); }
    if (I.isDown('right')) { fx += Math.sin(camYaw - Math.PI / 2); fz += Math.cos(camYaw - Math.PI / 2); }
    const len = Math.hypot(fx, fz);
    const sprint = I.isDown('sprint');
    const spd = sprint ? P.sprintSpeed : P.onFootSpeed;
    if (len > 0.01) {
      fx /= len; fz /= len;
      P.heading = Math.atan2(fz, fx);
      let nx = P.x + fx * spd * dt;
      let nz = P.z + fz * spd * dt;
      const hit = G.city.blocked(nx, nz, 0.6);
      if (!hit) { P.x = nx; P.z = nz; }
      else {
        // Slide along the wall.
        if (!G.city.blocked(P.x + fx * spd * dt, P.z, 0.6)) P.x += fx * spd * dt;
        else if (!G.city.blocked(P.x, P.z + fz * spd * dt, 0.6)) P.z += fz * spd * dt;
      }
      P.walkPhase += dt * spd;
    }
    // The pier runs east into the sea at z=96 and the Marlin is moored
    // at x=300, past the 290 world edge. Let the player walk the pier
    // out to the boat (and step off it to board) instead of stopping at
    // the edge; off the pier the east edge stays 290, so the player
    // cannot wade far out into open water.
    const edgeE = (P.z > 86 && P.z < 108) ? 306 : CFG.worldEdge;
    P.x = clamp(P.x, -CFG.worldEdge, edgeE);
    P.z = clamp(P.z, -CFG.worldEdge, CFG.worldEdge);
    P.speed = len > 0.01 ? spd : 0;
    P.mesh.visible = true;
    P.mesh.position.set(P.x, Math.abs(Math.sin(P.walkPhase * 1.6)) * 0.05, P.z);
    P.mesh.rotation.y = -P.heading;
    G.audio.setEngine(0, false);
  }
}

function enterVehicle(G, v) {
  const P = G.player;
  if (v.driver === 'npc') {
    // Carjacking: pull the driver out, add heat.
    v.driver = null;
    G.police.addWanted(1);
    G.hud.toast('Carjacked! The heat is on');
    G.audio.crash();
  }
  if (v.kind === 'parked') v.kind = 'traffic';
  v.driver = 'player';
  P.vehicle = v;
  G.cameraRig.snapBehind(v.heading);
  G.hud.toast(v.def.name);
}

function exitVehicle(G) {
  const P = G.player;
  const v = P.vehicle;
  v.driver = null;
  P.vehicle = null;
  P.exitGrace = 4;
  // Step out to the side of the car.
  const sx = v.x + Math.cos(v.heading + Math.PI / 2) * 2.5;
  const sz = v.z + Math.sin(v.heading + Math.PI / 2) * 2.5;
  const fixed = G.city.resolveCollision(sx, sz, 0.6);
  P.x = fixed.x; P.z = fixed.z;
  P.mesh.position.set(P.x, 0, P.z);
  G.cameraRig.snapBehind(P.heading);
}

export function damagePlayer(G, dmg) {
  const P = G.player;
  if (G.state !== 'playing' || P.health <= 0) return;
  P.health = Math.max(0, P.health - dmg);
  if (P.health <= 0) {
    G.state = 'wasted';
    G.audio.busted();
    G.hud.showBanner('WASTED');
    setTimeout(() => G.hud.respawn(), 1800);
  }
}

export function respawnPlayer(G) {
  const P = G.player;
  P.health = 100;
  if (P.vehicle) { P.vehicle.driver = null; P.vehicle = null; }
  // Nearest safehouse.
  let best = null, bd = 1e9;
  for (const s of G.safehouses) {
    const d = dist(P.x, P.z, s.x, s.z);
    if (d < bd) { bd = d; best = s; }
  }
  P.x = best.x; P.z = best.z;
  G.police.setWanted(0);
  G.state = 'playing';
  G.hud.hideBanner();
  G.hud.toast('You woke up at ' + best.name);
}
