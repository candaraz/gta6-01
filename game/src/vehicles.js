// Vehicles: box-built cars, a bike and a boat, with arcade physics.
// Each vehicle is a THREE.Group with a body, cabin, wheels and lights.
import * as THREE from 'three';
import { VEHICLES } from './config.js';
import { clamp, angDiff } from './random.js';

export function buildVehicleMesh(cls, color) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a1d24 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x9fd8e8 });
  const isBike = cls === 'bike';
  const isBoat = cls === 'boat';
  const body = new THREE.Mesh(new THREE.BoxGeometry(isBoat ? 5.2 : 4.4, isBike ? 0.5 : 1.0, isBoat ? 2.2 : 2.0), bodyMat);
  body.position.y = isBoat ? 0.9 : 0.75;
  body.castShadow = true;
  g.add(body);
  if (!isBike && !isBoat) {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 1.8), glassMat);
    cabin.position.set(-0.2, 1.55, 0);
    cabin.castShadow = true;
    g.add(cabin);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 1.7), bodyMat);
    roof.position.set(-0.2, 2.0, 0);
    g.add(roof);
  }
  if (isBike) {
    const rider = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.5), darkMat);
    rider.position.set(0, 1.0, 0);
    g.add(rider);
  }
  if (isBoat) {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.8), new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }));
    cab.position.set(-0.6, 1.9, 0);
    g.add(cab);
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  if (!isBoat) {
    for (const [wx, wz] of [[1.5, 0.95], [1.5, -0.95], [-1.5, 0.95], [-1.5, -0.95]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.x = Math.PI / 2;
      w.position.set(wx, 0.42, wz);
      g.add(w); wheels.push(w);
    }
  }
  // Headlights + taillights.
  const hl = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, 1.7),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  hl.position.set(isBoat ? 2.6 : 2.25, 0.9, 0);
  g.add(hl);
  const tl = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, 1.7),
    new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
  tl.position.set(isBoat ? -2.6 : -2.25, 0.9, 0);
  g.add(tl);
  // Police light bar.
  let lightBar = null;
  if (cls === 'police') {
    lightBar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 1.6),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    lightBar.position.set(-0.2, 2.15, 0);
    g.add(lightBar);
  }
  g.userData.wheels = wheels;
  g.userData.lightBar = lightBar;
  return g;
}

// A vehicle record. `kind`: 'player' | 'traffic' | 'police' | 'parked' | 'mission'.
export function makeVehicle(G, type, x, z, heading, kind) {
  const def = VEHICLES[type];
  const mesh = buildVehicleMesh(def.cls, def.color);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = -heading;
  G.scene.add(mesh);
  const v = {
    type, def, mesh, kind: kind || 'traffic',
    x, z, heading, speed: 0, steer: 0,
    driver: null, // 'player' | 'npc' | null (parked)
    hp: 100, dead: false, stuck: 0,
    targetHeading: heading, brake: false,
  };
  G.vehicles.push(v);
  return v;
}

export function stepVehicle(G, v, dt, input) {
  const def = v.def;
  if (v.kind === 'boat' || def.cls === 'boat') {
    // Boats: turn faster with speed, no handbrake slide.
    const throttle = input ? (input.up ? 1 : input.down ? -0.5 : 0) : 0;
    const steer = input ? (input.left ? -1 : input.right ? 1 : 0) : 0;
    v.speed += throttle * def.accel * dt;
    v.speed *= Math.pow(0.4, dt);
    v.speed = clamp(v.speed, -8, def.top);
    const turnRate = (0.5 + Math.min(1, Math.abs(v.speed) / 20)) * def.turn * 0.5;
    v.heading += steer * turnRate * dt * Math.sign(v.speed || 1);
    v.x += Math.cos(v.heading) * v.speed * dt;
    v.z += Math.sin(v.heading) * v.speed * dt;
    v.x = clamp(v.x, 300, 440); v.z = clamp(v.z, -280, 280);
  } else {
    const throttle = input ? (input.up ? 1 : input.down ? -0.6 : 0) : 0;
    const steer = input ? (input.left ? -1 : input.right ? 1 : 0) : 0;
    const handbrake = input ? !!input.handbrake : false;
    if (handbrake) v.speed *= Math.pow(0.05, dt);
    v.speed += throttle * def.accel * dt;
    v.speed *= Math.pow(0.35, dt);
    v.speed = clamp(v.speed, -10, def.top);
    const grip = handbrake ? 1.6 : 1;
    v.heading += steer * def.turn * grip * dt * (v.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(v.speed) / 8 + 0.25);
    let nx = v.x + Math.cos(v.heading) * v.speed * dt;
    let nz = v.z + Math.sin(v.heading) * v.speed * dt;
    // Building collision: stop and slide along.
    const hit = G.city.blocked(nx, nz, 1.6);
    if (hit) {
      const px = v.x + Math.cos(v.heading) * v.speed * dt, pz = v.z;
      if (!G.city.blocked(px, pz, 1.6)) { nx = px; nz = pz; }
      else {
        const qx = v.x, qz = v.z + Math.sin(v.heading) * v.speed * dt;
        if (!G.city.blocked(qx, qz, 1.6)) { nx = qx; nz = qz; }
        else { v.speed *= 0.4; nx = v.x; nz = v.z; v.stuck += dt; }
      }
    } else v.stuck = 0;
    // World edge.
    nx = clamp(nx, -CFG_EDGE, CFG_EDGE); nz = clamp(nz, -CFG_EDGE, CFG_EDGE);
    v.x = nx; v.z = nz;
  }
  v.mesh.position.set(v.x, v.def.cls === 'boat' ? Math.sin(G.time * 1.5 + v.x * 0.05) * 0.15 : 0, v.z);
  v.mesh.rotation.y = -v.heading;
  // Wheel spin + police light bar flash.
  const spin = v.speed * dt * 2;
  for (const w of v.mesh.userData.wheels) w.rotation.z += spin;
  const lb = v.mesh.userData.lightBar;
  if (lb) lb.material.color.setHex(Math.floor(G.time * 4) % 2 === 0 ? 0xff2222 : 0x2266ff);
}

const CFG_EDGE = 285;

export function removeVehicle(G, v) {
  G.scene.remove(v.mesh);
  const i = G.vehicles.indexOf(v);
  if (i >= 0) G.vehicles.splice(i, 1);
}

// Nearest vehicle to a point, optionally of a class and within a range.
export function nearestVehicle(G, x, z, maxD, type) {
  let best = null, bestD = maxD;
  for (const v of G.vehicles) {
    if (v.dead) continue;
    if (type && v.type !== type) continue;
    const d = Math.hypot(v.x - x, v.z - z);
    if (d < bestD) { bestD = d; best = v; }
  }
  return best;
}
export function headingTo(x1, z1, x2, z2) { return Math.atan2(z2 - z1, x2 - x1); }
export function steerToward(v, tx, tz, dt, maxTurn) {
  const want = headingTo(v.x, v.z, tx, tz);
  const d = angDiff(want, v.heading);
  const turn = clamp(d * 2.2, -maxTurn, maxTurn);
  v.heading += turn * dt;
  return Math.abs(d);
}
