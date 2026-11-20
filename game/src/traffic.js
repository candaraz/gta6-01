// traffic.js — ambient life: cars cruising the road grid and pedestrians
// strolling the sidewalks. Traffic cars follow road waypoints and brake
// for the car ahead; pedestrians flee from gunfire and carjackings.
import * as THREE from 'three';
import { spawnCar, randomTrafficClass } from './vehicles.js';
import { mulberry32, range, pick, dist } from './random.js';

export class Traffic {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.rng = mulberry32(777);
    this.cars = [];
    this.peds = [];
    this.maxCars = 26;
    this.maxPeds = 22;
    this._pedGeo = new THREE.CylinderGeometry(0.35, 0.45, 1.7, 8);
    this._pedHead = new THREE.SphereGeometry(0.28, 8, 8);
    this._pedColours = [0xd84a4a, 0x4a7ad8, 0x4ad87a, 0xd8c84a, 0x9a4ad8, 0xe0e0e0, 0x333333];
  }

  // A random point on a road, near the player so the streets feel alive.
  roadPointNear(px, pz, radius) {
    for (let tries = 0; tries < 20; tries++) {
      const onAvenue = this.rng() < 0.5;
      const gx = Math.round((px + range(this.rng, -radius, radius)) / 70) * 70;
      const gz = Math.round((pz + range(this.rng, -radius, radius)) / 70) * 70;
      const x = onAvenue ? gx : px + range(this.rng, -radius, radius);
      const z = onAvenue ? pz + range(this.rng, -radius, radius) : gz;
      if (Math.abs(x) > 300 || z > 210 || z < -300) continue;
      return { x, z, heading: onAvenue ? (this.rng() < 0.5 ? 0 : Math.PI) : (this.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) };
    }
    return { x: px + 20, z: pz, heading: 0 };
  }

  spawnInitial(px, pz) {
    for (let i = 0; i < 18; i++) {
      const p = this.roadPointNear(px, pz, 160);
      const v = spawnCar(this.scene, this.rng, p.x, p.z, p.heading, null, 'traffic');
      v.speed = range(this.rng, 8, 16);
      this.cars.push(v);
    }
    for (let i = 0; i < 16; i++) this.spawnPed(px + range(this.rng, -120, 120), pz + range(this.rng, -120, 120));
  }

  spawnPed(x, z) {
    const colour = pick(this.rng, this._pedColours);
    const group = new THREE.Group();
    const body = new THREE.Mesh(this._pedGeo, new THREE.MeshLambertMaterial({ color: colour }));
    body.position.y = 0.85;
    group.add(body);
    const head = new THREE.Mesh(this._pedHead, new THREE.MeshLambertMaterial({ color: 0xd8a878 }));
    head.position.y = 1.95;
    group.add(head);
    group.position.set(x, 0, z);
    this.scene.add(group);
    this.peds.push({
      mesh: group, x, z,
      heading: this.rng() * Math.PI * 2,
      speed: range(this.rng, 1.2, 2.2),
      flee: 0, dead: false, retarget: 0,
    });
  }

  nearestCar(x, z, maxD) {
    let best = null, bd = maxD * maxD;
    for (const c of this.cars) {
      if (c.dead) continue;
      const d2 = (c.x - x) ** 2 + (c.z - z) ** 2;
      if (d2 < bd) { bd = d2; best = c; }
    }
    return best;
  }

  nearestPed(x, z, maxD) {
    let best = null, bd = maxD * maxD;
    for (const p of this.peds) {
      if (p.dead) continue;
      const d2 = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d2 < bd) { bd = d2; best = p; }
    }
    return best;
  }

  scarePeds(x, z, radius) {
    for (const p of this.peds) {
      if (p.dead) continue;
      if (dist(p.x, p.z, x, z) < radius) {
        p.flee = 4;
        p.heading = Math.atan2(p.x - x, p.z - z);
      }
    }
  }

  update(dt, px, pz, playerVehicle, onGunshot) {
    // Keep the streets populated around the player.
    if (this.cars.filter((c) => !c.dead).length < this.maxCars) {
      const p = this.roadPointNear(px, pz, 220);
      const v = spawnCar(this.scene, this.rng, p.x, p.z, p.heading, null, 'traffic');
      v.speed = range(this.rng, 8, 16);
      this.cars.push(v);
      if (this.onSpawn) this.onSpawn(v);
    }
    if (this.peds.filter((p) => !p.dead).length < this.maxPeds) {
      this.spawnPed(px + range(this.rng, -140, 140), pz + range(this.rng, -140, 140));
    }
    // Traffic cars: cruise along their heading, turn at intersections,
    // brake when something is ahead, despawn far away.
    const all = this.cars;
    for (const c of this.cars) {
      if (c.dead) continue;
      // The player's car is driven by the player, not by traffic AI.
      // (It stays in the list so other cars brake for it; it rejoins
      // traffic when the player steps out and its driver clears.)
      if (c.driver === 'player') continue;
      const dPlayer = dist(c.x, c.z, px, pz);
      if (dPlayer > 320) { c.remove(this.scene); continue; }
      // Turn at intersections: snap heading to the grid now and then.
      const nearX = Math.abs(c.x - Math.round(c.x / 70) * 70) < 4;
      const nearZ = Math.abs(c.z - Math.round(c.z / 70) * 70) < 4;
      if ((nearX || nearZ) && this.rng() < dt * 0.25) {
        const dirs = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
        c.heading = dirs[Math.floor(this.rng() * 4)];
      }
      // Brake for the car ahead.
      let ahead = false;
      for (const o of all) {
        if (o === c || o.dead) continue;
        const dx = o.x - c.x, dz = o.z - c.z;
        const fwd = dx * Math.sin(c.heading) + dz * Math.cos(c.heading);
        const side = Math.abs(dx * Math.cos(c.heading) - dz * Math.sin(c.heading));
        if (fwd > 0 && fwd < 12 && side < 3) { ahead = true; break; }
      }
      const target = ahead ? 0 : 13;
      // Throttle holds the cruise speed; drive() does the rest.
      const throttle = Math.max(-1, Math.min(1, (target - c.speed) * 0.25));
      c.drive(dt, 0, throttle, this.city, all);
    }
    this.cars = this.cars.filter((c) => !c.dead);
    // Pedestrians: wander, flee from trouble.
    for (const p of this.peds) {
      if (p.dead) continue;
      p.retarget -= dt;
      if (p.retarget <= 0) {
        p.retarget = 2 + this.rng() * 3;
        if (p.flee <= 0) p.heading += range(this.rng, -1.2, 1.2);
      }
      p.flee = Math.max(0, p.flee - dt);
      const spd = p.flee > 0 ? 5.5 : p.speed;
      p.x += Math.sin(p.heading) * spd * dt;
      p.z += Math.cos(p.heading) * spd * dt;
      const pos = { x: p.x, z: p.z };
      this.city.collide(pos, 0.5);
      p.x = pos.x; p.z = pos.z;
      if (p.x > 310 || p.x < -310 || p.z > 230 || p.z < -310) p.heading += Math.PI;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      // Walk bob.
      p.mesh.position.y = Math.abs(Math.sin(performance.now() / 180 + p.x)) * 0.05;
    }
    this.peds = this.peds.filter((p) => !p.dead);
  }

  // A pedestrian shot or run over: remove them from the street.
  killPed(p) {
    if (!p || p.dead) return false;
    p.dead = true;
    this.scene.remove(p.mesh);
    return true;
  }

  countNear(x, z, radius) {
    let n = 0;
    for (const c of this.cars) if (!c.dead && dist(c.x, c.z, x, z) < radius) n++;
    for (const p of this.peds) if (!p.dead && dist(p.x, p.z, x, z) < radius) n++;
    return n;
  }
}
