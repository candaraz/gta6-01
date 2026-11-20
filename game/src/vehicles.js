// Solmar Bay — vehicles.
// One job: build a car/bike/boat mesh for a class, drive it with arcade physics,
// and let the player steal one (carjacking). Distinct handling per class.

import * as THREE from 'three';
import { VEHICLES } from './config.js';
import { clamp, angleDiff } from './random.js';

export function makeVehicleMesh(cls, colour) {
  const def = VEHICLES[cls];
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: colour ?? def.colour });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a1a20 });
  const glass = new THREE.MeshPhongMaterial({ color: 0x9fd4e8, shininess: 90 });
  if (cls === 'moto') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 2.2), paint);
    body.position.y = 0.7; body.castShadow = true; g.add(body);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.9), dark);
    seat.position.set(0, 1.0, -0.3); g.add(seat);
    const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.18, 10);
    wheelGeo.rotateZ(Math.PI / 2);
    for (const z of [-0.85, 0.85]) {
      const w = new THREE.Mesh(wheelGeo, dark);
      w.position.set(0, 0.34, z); w.castShadow = true; g.add(w);
    }
    g.userData.wheels = [];
    return g;
  }
  if (cls === 'boat') {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 6), paint);
    hull.position.y = 0.6; hull.castShadow = true; g.add(hull);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 3), glass);
    deck.position.set(0, 1.2, -0.5); g.add(deck);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.2, 0.3), dark);
    tower.position.set(0, 1.6, 1.2); g.add(tower);
    g.userData.wheels = [];
    return g;
  }
  const long = cls === 'truck' || cls === 'van' ? 5.6 : cls === 'suv' ? 4.6 : 4.2;
  const wide = cls === 'truck' ? 2.4 : 2.0;
  const bodyH = cls === 'truck' ? 1.3 : 0.75;
  const body = new THREE.Mesh(new THREE.BoxGeometry(wide, bodyH, long), paint);
  body.position.y = 0.65; body.castShadow = true; g.add(body);
  const cabinH = cls === 'van' ? 0.9 : 0.62;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(wide * 0.86, cabinH, long * (cls === 'sports' ? 0.42 : 0.55)), glass);
  cabin.position.set(0, bodyH + 0.35 + cabinH / 2 - 0.1, cls === 'sports' ? -0.3 : 0.1);
  cabin.castShadow = true; g.add(cabin);
  if (cls === 'sports') {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(wide * 0.9, 0.08, 0.5), dark);
    spoiler.position.set(0, 1.25, -long / 2 + 0.25); g.add(spoiler);
  }
  if (cls === 'truck') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(wide * 0.9, 0.5, 1.6), dark);
    bed.position.set(0, 1.25, -1.2); g.add(bed);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [wx, wz] of [[-wide / 2, long / 2 - 0.9], [wide / 2, long / 2 - 0.9], [-wide / 2, -long / 2 + 0.9], [wide / 2, -long / 2 + 0.9]]) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.position.set(wx, 0.38, wz);
    w.castShadow = true;
    g.add(w); wheels.push(w);
  }
  g.userData.wheels = wheels;
  g.userData.length = long;
  g.userData.width = wide;
  return g;
}

export class Vehicle {
  constructor(scene, cls, x, z, heading, opts = {}) {
    this.cls = cls;
    this.def = VEHICLES[cls];
    this.mesh = makeVehicleMesh(cls, opts.colour);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    this.x = x; this.z = z; this.heading = heading;
    this.speed = 0; // m/s along heading
    this.steer = 0;
    this.hp = this.def.hp * (opts.hpMul ?? 1);
    this.maxHp = this.hp;
    this.burning = false;
    this.dead = false;
    this.driver = opts.driver ?? null; // 'player' | 'traffic' | 'police' | null
    this.isPolice = !!opts.police;
    this.nitro = opts.nitro ?? 0; // seconds of nitro left
    this.onWater = cls === 'boat';
    if (this.isPolice) this.paintPolice();
  }

  paintPolice() {
    // Bay PD livery: white body, black doors, light bar.
    this.mesh.traverse((m) => {
      if (m.isMesh && m.material && m.material.color) {
        if (m.material.color.getHex() === this.def.colour) m.material = new THREE.MeshLambertMaterial({ color: 0xf0f0ea });
      }
    });
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.18, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff2020 }),
    );
    bar.position.set(0, 1.55, 0.1);
    this.mesh.add(bar);
    this.lightBar = bar;
    this.lightPhase = 0;
  }

  // Arcade drive step. throttle -1..1, steerInput -1..1, dt seconds.
  drive(throttle, steerInput, handbrake, dt, nitroActive) {
    const def = this.def;
    const top = def.topSpeed * (nitroActive && this.nitro > 0 ? 1.35 : 1);
    const accel = def.accel * (throttle > 0 ? 1 : 0.7);
    this.speed += throttle * accel * dt;
    // drag + rolling resistance
    this.speed -= this.speed * 0.35 * dt;
    if (handbrake) this.speed -= this.speed * 2.2 * dt;
    this.speed = clamp(this.speed, -top * 0.4, top);
    if (this.nitro > 0 && nitroActive) this.nitro = Math.max(0, this.nitro - dt);
    // steering: less at speed, more grip = tighter
    const steerTarget = steerInput * def.turn * (this.speed >= 0 ? 1 : -1);
    this.steer += (steerTarget - this.steer) * Math.min(1, 8 * dt);
    const turnRate = this.steer * clamp(Math.abs(this.speed) / 12, 0, 1) * (handbrake ? 1.6 : 1);
    this.heading += turnRate * dt * Math.sign(this.speed || 1) * (this.speed < 0 ? -1 : 1) * 0.9;
    // integrate
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z += Math.cos(this.heading) * this.speed * dt;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    // lean into turns + wheel spin
    this.mesh.rotation.z = -this.steer * 0.06 * clamp(Math.abs(this.speed) / 20, 0, 1);
    for (const w of this.mesh.userData.wheels ?? []) w.rotation.x += this.speed * dt / 0.38;
    if (this.isPolice) {
      this.lightPhase += dt * 6;
      this.lightBar.material.color.setHex(Math.sin(this.lightPhase) > 0 ? 0xff2020 : 0x2040ff);
    }
  }

  damage(amount, fromX, fromZ) {
    if (this.dead) return;
    this.hp -= amount;
    if (this.hp <= this.def.hp * 0.25 && !this.burning) {
      this.burning = true; // smoke + fire starts; a burning car explodes soon
      this.burnTimer = 4;
    }
    if (this.hp <= 0) this.dead = true;
  }

  update(dt) {
    if (this.burning && !this.dead) {
      this.burnTimer -= dt;
      if (this.burnTimer <= 0) this.dead = true;
    }
  }

  remove(scene) { scene.remove(this.mesh); }
}
