// Solmar Bay — the wanted level and Bay PD.
// One job: turn crimes into stars, send police cars that chase and ram, put a
// helicopter up at 3+ stars, drop roadblocks ahead of the player, and let the
// heat die when the player hides. Line of sight decides whether the chase holds.

import * as THREE from 'three';
import { WANTED } from './config.js';
import { Vehicle } from './vehicles.js';
import { makeRng, clamp, dist2D } from './random.js';

export class Police {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.rng = makeRng(4242);
    this.stars = 0;
    this.heat = 0; // 0..1, fills while committing crimes / seen, drains while hidden
    this.cars = [];
    this.heli = null;
    this.heliAngle = 0;
    this.roadblocks = []; // {x, z, heading, cars:[Vehicle]}
    this.lastSeen = { x: 0, z: 0 };
    this.loseTimer = 0;
    this.roadblockTimer = 0;
  }

  addCrime(amount, x, z) {
    this.heat = clamp(this.heat + amount, 0, 1);
    const want = this.heat < 0.15 ? 0 : this.heat < 0.3 ? 1 : this.heat < 0.45 ? 2 : this.heat < 0.65 ? 3 : this.heat < 0.85 ? 4 : 5;
    if (want > this.stars) this.stars = want;
    this.lastSeen = { x, z };
    this.loseTimer = 0;
  }
  setStars(n) { this.stars = clamp(n, 0, 5); this.heat = n / 5; }

  // Can the police see the player? True when close and not hidden behind a block.
  // The helicopter sees from above, so it keeps the chase alive at 3+ stars.
  canSee(px, pz, playerCar) {
    if (this.stars >= 3 && this.heli) return true;
    for (const c of this.cars) {
      if (dist2D(px, pz, c.x, c.z) < 55) return true;
    }
    return false;
  }

  spawnCar(px, pz) {
    const ang = this.rng.range(0, Math.PI * 2);
    const x = px + Math.sin(ang) * this.rng.range(35, 55);
    const z = pz + Math.cos(ang) * this.rng.range(35, 55);
    const v = new Vehicle(this.scene, 'sedan', x, z, ang, { police: true, driver: 'police' });
    v.def = { ...v.def, topSpeed: 40, accel: 22 };
    this.cars.push(v);
    return v;
  }

  spawnRoadblock(px, pz, heading) {
    // Two police cars parked across the road ahead of the player.
    const fx = Math.sin(heading), fz = Math.cos(heading);
    const bx = px + fx * 55, bz = pz + fz * 55;
    const rx = Math.cos(heading), rz = -Math.sin(heading);
    const pair = [];
    for (const s of [-4, 4]) {
      const v = new Vehicle(this.scene, 'sedan', bx + rx * s, bz + rz * s, heading + Math.PI / 2, { police: true, driver: 'police' });
      pair.push(v);
    }
    this.roadblocks.push({ x: bx, z: bz, heading, cars: pair });
  }

  makeHeli() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 5), new THREE.MeshLambertMaterial({ color: 0x1a2a3a }));
    body.castShadow = true; g.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4), new THREE.MeshLambertMaterial({ color: 0x1a2a3a }));
    tail.position.set(0, 0.2, -4); g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    rotor.position.y = 1.1; g.add(rotor);
    const spot = new THREE.SpotLight(0xfff2c0, 60, 90, 0.35, 0.4);
    spot.position.set(0, -1, 0);
    spot.target.position.set(0, -40, 0);
    g.add(spot); g.add(spot.target);
    g.userData.rotor = rotor;
    g.userData.spot = spot;
    this.scene.add(g);
    this.heli = g;
  }

  update(dt, player, playerCar) {
    const px = playerCar ? playerCar.x : player.x;
    const pz = playerCar ? playerCar.z : player.z;
    const cfg = WANTED[this.stars];
    // --- spawn / remove pursuit cars to match the wanted level ---
    while (this.cars.length < cfg.cars) this.spawnCar(px, pz);
    while (this.cars.length > cfg.cars) {
      const v = this.cars.pop();
      v.remove(this.scene);
    }
    // --- helicopter ---
    if (cfg.heli && !this.heli) this.makeHeli();
    if (!cfg.heli && this.heli) { this.scene.remove(this.heli); this.heli = null; }
    if (this.heli) {
      this.heliAngle += dt * 0.45;
      const hx = px + Math.sin(this.heliAngle) * 22;
      const hz = pz + Math.cos(this.heliAngle) * 22;
      this.heli.position.set(hx, 42 + Math.sin(this.heliAngle * 2) * 2, hz);
      this.heli.rotation.y = Math.atan2(px - hx, pz - hz);
      this.heli.userData.rotor.rotation.y += dt * 22;
      this.heli.userData.spot.target.position.set(px - hx, -42, pz - hz);
    }
    // --- roadblocks ---
    this.roadblockTimer -= dt;
    if (this.stars >= 2 && this.roadblockTimer <= 0 && Math.random() < cfg.roadblock) {
      const heading = playerCar ? playerCar.heading : player.heading;
      this.spawnRoadblock(px, pz, heading);
      this.roadblockTimer = 14;
    }
    // roadblock cars sit still; remove them once far behind
    for (let i = this.roadblocks.length - 1; i >= 0; i--) {
      const rb = this.roadblocks[i];
      if (dist2D(px, pz, rb.x, rb.z) > 120) {
        for (const v of rb.cars) v.remove(this.scene);
        this.roadblocks.splice(i, 1);
      }
    }
    // --- pursuit: each police car steers at the player and rams ---
    const speed = playerCar ? Math.abs(playerCar.speed) : 0;
    for (const c of this.cars) {
      const dx = px - c.x, dz = pz - c.z;
      const d = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      let diff = want - c.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      // aim slightly ahead of a moving player (intercept), ram the rear quarter
      const steer = clamp(diff * 1.4, -1, 1);
      const throttle = d > 6 ? 1 : 0.4;
      c.drive(throttle, steer, false, dt, false);
      // ram damage on contact
      if (d < 4.5) {
        if (playerCar) {
          playerCar.damage(6 * dt * 10, c.x, c.z);
          playerCar.speed *= 0.92;
          c.speed *= 0.85;
        } else {
          player.hurt(4 * dt * 10);
        }
      }
      // police cars avoid buildings
      const pos = this.city.collide(c.x, c.z, 1.4);
      c.x = pos.x; c.z = pos.z;
      c.mesh.position.set(c.x, 0, c.z);
    }
    // --- wanted decay: hidden + quiet = heat drains ---
    if (this.stars > 0) {
      const seen = this.canSee(px, pz, playerCar);
      if (seen) { this.lastSeen = { x: px, z: pz }; this.loseTimer = 0; }
      else {
        this.loseTimer += dt;
        // helicopter keeps you spotted, so decay only starts once it is gone
        if (this.loseTimer > 6) {
          this.heat = Math.max(0, this.heat - dt * 0.03);
          const want = this.heat < 0.15 ? 0 : this.heat < 0.3 ? 1 : this.heat < 0.45 ? 2 : this.heat < 0.65 ? 3 : this.heat < 0.85 ? 4 : 5;
          if (want < this.stars) this.stars = want;
        }
      }
    }
    // police cars that fall far behind respawn near the player
    for (const c of this.cars) {
      if (dist2D(px, pz, c.x, c.z) > 160) {
        const ang = this.rng.range(0, Math.PI * 2);
        c.x = px + Math.sin(ang) * 40; c.z = pz + Math.cos(ang) * 40;
        c.speed = 10;
      }
    }
  }

  clear() {
    for (const c of this.cars) c.remove(this.scene);
    this.cars = [];
    for (const rb of this.roadblocks) for (const v of rb.cars) v.remove(this.scene);
    this.roadblocks = [];
    if (this.heli) { this.scene.remove(this.heli); this.heli = null; }
    this.stars = 0; this.heat = 0;
  }
}
