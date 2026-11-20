// vehicles.js — the 9 drivable classes plus police and taxi.
// Arcade physics: speed along a heading, steering that scales with
// speed, simple circle-vs-circle and building collisions. Boats float
// on the bay and never sink; motorcycles lean into turns.
import * as THREE from 'three';
import { VEHICLES, WORLD } from './config.js';
import { angleDiff, clamp, dist } from './random.js';

let meshCounter = 0;

function buildBody(scene, cls, colour) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: colour });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a1d22 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x9fc8e0 });
  const isBoat = cls === 'boat';
  const isBike = cls === 'motorcycle';

  if (isBoat) {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 6.4), bodyMat);
    hull.position.y = 0.55;
    group.add(hull);
    const bow = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.2, 4), bodyMat);
    bow.rotation.x = Math.PI / 2; bow.rotation.y = Math.PI / 4;
    bow.position.set(0, 0.55, 4.2);
    group.add(bow);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 2.4), glassMat);
    cabin.position.set(0, 1.4, -0.6);
    group.add(cabin);
  } else if (isBike) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 2.4), bodyMat);
    frame.position.y = 0.8;
    group.add(frame);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.9), darkMat);
    seat.position.set(0, 1.1, -0.5);
    group.add(seat);
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.22, 12);
    for (const z of [0.85, -0.85]) {
      const w = new THREE.Mesh(wheelGeo, darkMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(0, 0.42, z);
      group.add(w);
    }
  } else {
    const long = cls === 'van' || cls === 'truck';
    const len = long ? 5.6 : cls === 'sports' ? 4.4 : 4.6;
    const wid = cls === 'truck' ? 2.4 : 2.0;
    const body = new THREE.Mesh(new THREE.BoxGeometry(wid, 0.75, len), bodyMat);
    body.position.y = 0.75;
    group.add(body);
    const cabH = long ? 1.1 : 0.62;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.88, cabH, long ? 2.4 : 2.2), cls === 'truck' ? bodyMat : glassMat);
    cab.position.set(0, 0.75 + 0.37 + cabH / 2, long ? -0.6 : -0.2);
    group.add(cab);
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12);
    for (const [wx, wz] of [[-wid / 2, len / 2 - 0.9], [wid / 2, len / 2 - 0.9], [-wid / 2, -len / 2 + 0.9], [wid / 2, -len / 2 + 0.9]]) {
      const w = new THREE.Mesh(wheelGeo, darkMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, 0.42, wz);
      group.add(w);
    }
    if (cls === 'police') {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.4), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
      bar.position.set(0, 1.75, -0.2);
      bar.name = 'lightbar';
      group.add(bar);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(wid + 0.02, 0.3, len * 0.6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      stripe.position.set(0, 0.75, 0);
      group.add(stripe);
    }
    if (cls === 'taxi') {
      const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0x111111 }));
      sign.position.set(0, 1.7, -0.2);
      group.add(sign);
    }
  }
  group.name = `veh-${meshCounter++}`;
  scene.add(group);
  return group;
}

export class Vehicle {
  constructor(scene, cls, x, z, heading, opts = {}) {
    this.cls = cls;
    this.def = VEHICLES[cls];
    this.x = x; this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.hp = this.def.hp + (opts.hpBonus || 0);
    this.maxHp = this.hp;
    this.driver = opts.driver || null; // 'player' | 'traffic' | 'police' | 'racer' | null
    this.owned = !!opts.owned;
    this.isBoat = cls === 'boat';
    this.isBike = cls === 'motorcycle';
    this.mesh = buildBody(scene, cls, opts.colour || this.def.colour);
    this.mesh.position.set(x, this.isBoat ? 0.15 : 0, z);
    this.mesh.rotation.y = heading;
    this.radius = cls === 'boat' ? 3.2 : cls === 'van' || cls === 'truck' ? 3.0 : 2.2;
    this.dead = false;
    this.stuckTimer = 0;
    this.reverseTimer = 0;
    this.upgrades = opts.upgrades || { engine: 0, armour: 0, brakes: 0 };
    this.topSpeed = this.def.speed * (1 + [0, 0.12, 0.25][this.upgrades.engine]);
    this.brakePower = this.def.brake * (1 + [0, 0.2, 0.45][this.upgrades.brakes]);
    this.smokeTimer = 0;
  }

  // Arcade drive step. steer in -1..1, throttle in -1..1.
  drive(dt, steer, throttle, city, others) {
    const def = this.def;
    // AI unstuck: a car pinned against a wall (a cop chasing through a
    // block, a traffic car that turned into a building) reverses out
    // instead of grinding there forever. The player never auto-reverses.
    if (this.driver !== 'player') {
      if (this.reverseTimer > 0) {
        this.reverseTimer -= dt;
        throttle = -1;
        steer = -steer;
      } else if (Math.abs(this.speed) < 1.5 && throttle > 0.3) {
        this.stuckTimer += dt;
        if (this.stuckTimer > 1.5) { this.stuckTimer = 0; this.reverseTimer = 1.2; }
      } else {
        this.stuckTimer = 0;
      }
    }
    if (throttle > 0) this.speed += def.accel * throttle * dt;
    else if (throttle < 0) this.speed += this.brakePower * throttle * dt; // brake/reverse
    else this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 6 * dt);
    this.speed = clamp(this.speed, this.isBoat ? -8 : -10, this.topSpeed);
    const spd01 = Math.abs(this.speed) / this.topSpeed;
    this.heading += steer * def.turn * dt * (0.35 + 0.65 * spd01) * Math.sign(this.speed || 1);
    const nx = this.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.z + Math.cos(this.heading) * this.speed * dt;
    // Boats live on water; land vehicles stay out of it.
    const p = { x: nx, z: nz };
    let blocked = false;
    if (Math.abs(nx) > WORLD.half || nz < -WORLD.half || nz > WORLD.half) blocked = true;
    if (this.isBoat) {
      if (!city.isWater(nz) && nz < WORLD.bayZ - 2) blocked = true;
    } else {
      if (city.isWater(nz)) blocked = true;
    }
    if (!blocked && city.collide(p, this.radius)) blocked = p.x !== nx || p.z !== nz;
    if (!blocked) {
      this.x = p.x; this.z = p.z;
    } else {
      if (Math.abs(this.speed) > 8) this.crashed = true;
      this.speed *= 0.4;
    }
    // Soft push from other vehicles.
    for (const o of others) {
      if (o === this || o.dead) continue;
      const d = dist(this.x, this.z, o.x, o.z);
      const min = this.radius + o.radius;
      if (d < min && d > 0.01) {
        const push = (min - d) / 2;
        const ux = (this.x - o.x) / d, uz = (this.z - o.z) / d;
        this.x += ux * push; this.z += uz * push;
        if (Math.abs(this.speed) > 6 || Math.abs(o.speed) > 6) { this.crashed = true; o.crashed = true; }
      }
    }
    const crashedNow = this.crashed;
    this.crashed = false;
    this.mesh.position.set(this.x, this.isBoat ? 0.15 + Math.sin(performance.now() / 500) * 0.06 : 0, this.z);
    this.mesh.rotation.y = this.heading;
    if (this.isBike) this.mesh.rotation.z = -steer * Math.min(0.5, spd01 * 0.6);
    else this.mesh.rotation.z = 0;
    return crashedNow;
  }

  damage(amount) {
    this.hp -= amount;
    if (this.hp <= 0 && !this.dead) {
      this.dead = true;
      return true;
    }
    return false;
  }

  remove(scene) {
    scene.remove(this.mesh);
    this.dead = true;
  }
}

const TRAFFIC_CLASSES = ['compact', 'sedan', 'suv', 'van', 'muscle', 'truck'];

export function randomTrafficClass(rng) {
  return TRAFFIC_CLASSES[Math.floor(rng() * TRAFFIC_CLASSES.length)];
}

// Spawn a car on a road near (x, z).
export function spawnCar(scene, rng, x, z, heading, cls, driver) {
  return new Vehicle(scene, cls || randomTrafficClass(rng), x, z, heading, { driver: driver || 'traffic' });
}

// A boat floating in the bay, driverless, ready to board.
export function spawnBoat(scene, x, z, heading) {
  return new Vehicle(scene, 'boat', x, z, heading || 0, { driver: null });
}

// A police interceptor near the player, already moving.
export function spawnPoliceCar(scene, x, z, heading) {
  const v = new Vehicle(scene, 'police', x, z, heading, { driver: 'police' });
  v.speed = 12;
  return v;
}
