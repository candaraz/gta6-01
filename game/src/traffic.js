// Solmar Bay — traffic and pedestrians.
// One job: make the city feel alive. Cars drive the road grid in loops and stop
// for trouble ahead; pedestrians walk the sidewalks, cross at corners, and run
// from gunfire, fast cars and explosions.

import * as THREE from 'three';
import { VEHICLE_CLASSES } from './config.js';
import { makeVehicleMesh } from './vehicles.js';
import { makeRng, clamp, dist2D } from './random.js';
import { onRoad, roadCentre } from './city.js';

const TRAFFIC_COUNT = 22;
const PED_COUNT = 30;

function makePedMesh(colour) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: colour });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2a33 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc89878 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.85, 8), shirt);
  body.position.y = 0.95; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), skin);
  head.position.y = 1.6; g.add(head);
  for (const sx of [-0.12, 0.12]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.55, 6), pants);
    leg.position.set(sx, 0.28, 0); g.add(leg);
  }
  g.userData.legs = g.children.filter((c, i) => i >= 2);
  return g;
}

export class Traffic {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.rng = makeRng(777);
    this.cars = [];
    this.peds = [];
    this.spawnCars();
    this.spawnPeds();
  }

  spawnCars() {
    for (let i = 0; i < TRAFFIC_COUNT; i++) {
      const cls = this.rng.pick(VEHICLE_CLASSES.filter((c) => c !== 'boat' && c !== 'moto'));
      const node = this.rng.pick(this.city.roadGraph);
      const mesh = makeVehicleMesh(cls);
      mesh.position.set(node.x, 0, node.z);
      this.scene.add(mesh);
      this.cars.push({
        mesh, cls,
        x: node.x, z: node.z,
        heading: this.rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]),
        speed: 0, targetSpeed: this.rng.range(8, 13),
        // a loop: pick a random intersection, drive to it, pick another
        target: this.rng.pick(this.city.roadGraph),
        wait: 0,
      });
    }
  }

  spawnPeds() {
    const colours = [0xd8622b, 0x3a6fd8, 0x2f6b4f, 0xe8e2d0, 0x7a1f2b, 0xf2c200, 0x9a6fd8];
    for (let i = 0; i < PED_COUNT; i++) {
      const node = this.rng.pick(this.city.roadGraph);
      const mesh = makePedMesh(this.rng.pick(colours));
      const x = node.x + this.rng.range(-6, 6);
      const z = node.z + this.rng.range(-6, 6);
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      this.peds.push({
        mesh, x, z,
        heading: this.rng.range(0, Math.PI * 2),
        speed: this.rng.range(1.2, 2.2),
        target: null, wait: this.rng.range(0, 3),
        fleeing: false, phase: this.rng.range(0, 6),
        dead: false,
      });
    }
  }

  // Nearest drivable car to (x,z) within radius, for carjacking / entering.
  nearestCar(x, z, radius) {
    let best = null, bd = radius;
    for (const c of this.cars) {
      const d = dist2D(x, z, c.x, c.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  nearestPed(x, z, radius) {
    let best = null, bd = radius;
    for (const p of this.peds) {
      if (p.dead) continue;
      const d = dist2D(x, z, p.x, p.z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  scare(x, z, radius) {
    for (const p of this.peds) {
      if (p.dead) continue;
      if (dist2D(x, z, p.x, p.z) < radius) p.fleeing = true;
    }
  }

  update(dt, player, playerCar) {
    // --- traffic cars: drive toward their target intersection ---
    for (const c of this.cars) {
      if (c.wait > 0) { c.wait -= dt; continue; }
      const dx = c.target.x - c.x, dz = c.target.z - c.z;
      const d = Math.hypot(dx, dz);
      if (d < 4) {
        c.target = this.rng.pick(this.city.roadGraph);
        if (this.rng.chance(0.15)) c.wait = this.rng.range(1, 3);
        continue;
      }
      const want = Math.atan2(dx, dz);
      let diff = want - c.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      c.heading += clamp(diff, -1.4 * dt, 1.4 * dt);
      // slow down for a car ahead (player or traffic) or a nearby ped
      let slow = false;
      const aheadX = c.x + Math.sin(c.heading) * 8, aheadZ = c.z + Math.cos(c.heading) * 8;
      if (playerCar && dist2D(aheadX, aheadZ, playerCar.x, playerCar.z) < 6) slow = true;
      if (player && !player.inVehicle && dist2D(aheadX, aheadZ, player.x, player.z) < 5) slow = true;
      for (const o of this.cars) {
        if (o !== c && dist2D(aheadX, aheadZ, o.x, o.z) < 5) { slow = true; break; }
      }
      const target = slow ? 0 : c.targetSpeed;
      c.speed += clamp(target - c.speed, -14 * dt, 8 * dt);
      c.x += Math.sin(c.heading) * c.speed * dt;
      c.z += Math.cos(c.heading) * c.speed * dt;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
    }
    // --- pedestrians: stroll the sidewalks, flee from danger ---
    for (const p of this.peds) {
      if (p.dead) continue;
      if (p.wait > 0) { p.wait -= dt; continue; }
      if (!p.target || dist2D(p.x, p.z, p.target.x, p.target.z) < 3) {
        const node = this.rng.pick(this.city.roadGraph);
        p.target = { x: node.x + this.rng.range(-8, 8), z: node.z + this.rng.range(-8, 8) };
        if (this.rng.chance(0.2)) p.wait = this.rng.range(1, 4);
      }
      let tx = p.target.x, tz = p.target.z;
      let sp = p.speed;
      if (p.fleeing) {
        // run away from the player
        const dx = p.x - player.x, dz = p.z - player.z;
        const d = Math.hypot(dx, dz) || 1;
        tx = p.x + (dx / d) * 30; tz = p.z + (dz / d) * 30;
        sp = 5.5;
        if (d > 45) p.fleeing = false;
      }
      const dx = tx - p.x, dz = tz - p.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.1) {
        p.heading = Math.atan2(dx, dz);
        p.x += (dx / d) * sp * dt;
        p.z += (dz / d) * sp * dt;
      }
      const pos = this.city.collide(p.x, p.z, 0.4);
      p.x = pos.x; p.z = pos.z;
      p.phase += dt * sp * 2.4;
      p.mesh.position.set(p.x, Math.abs(Math.sin(p.phase)) * 0.04, p.z);
      p.mesh.rotation.y = p.heading;
      for (let i = 0; i < p.mesh.userData.legs.length; i++) {
        p.mesh.userData.legs[i].rotation.x = Math.sin(p.phase + i * Math.PI) * 0.5;
      }
    }
  }
}
