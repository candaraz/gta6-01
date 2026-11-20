// police.js — the 5-star wanted system: patrol cars that chase and ram,
// roadblocks from 3 stars, a helicopter from 4, busts on foot, and wanted
// decay when the player stays hidden and quiet.
import * as THREE from 'three';
import { WANTED } from './config.js';
import { spawnPoliceCar } from './vehicles.js';
import { clamp, dist, angleDiff } from './random.js';

export class Police {
  constructor(scene, city, effects, audio) {
    this.scene = scene;
    this.city = city;
    this.effects = effects;
    this.audio = audio;
    this.stars = 0;
    this.cops = [];
    this.roadblocks = [];
    this.heli = null;
    this.quietTimer = 0;
    this.decayTimer = 0;
    this.spawnTimer = 0;
    this.blockTimer = 0;
    this.bustTimer = 0;
    this.lastCrimeAt = -100;
    this.time = 0;
  }

  addStars(n, reason) {
    const before = this.stars;
    this.stars = clamp(this.stars + n, 0, WANTED.maxStars);
    if (this.stars > before) {
      this.quietTimer = 0;
      this.lastCrimeAt = this.time;
    }
    return this.stars;
  }

  setStars(n) {
    this.stars = clamp(n, 0, WANTED.maxStars);
    this.quietTimer = 0;
    this.lastCrimeAt = this.time;
  }

  clear() {
    this.stars = 0;
    this.quietTimer = 0;
    this.decayTimer = 0;
    this.bustTimer = 0;
    for (const c of this.cops) c.remove(this.scene);
    this.cops = [];
    this._clearRoadblocks();
    this._removeHeli();
  }

  _clearRoadblocks() {
    for (const v of this.roadblocks) v.remove(this.scene);
    this.roadblocks = [];
  }

  _removeHeli() {
    if (this.heli) { this.scene.remove(this.heli.mesh); this.heli = null; }
  }

  _makeHeli() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(3, 1.4, 5), new THREE.MeshLambertMaterial({ color: 0x1a2a4a }));
    group.add(body);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(7, 0.12, 0.5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    rotor.position.y = 1;
    rotor.name = 'rotor';
    group.add(rotor);
    const light = new THREE.SpotLight(0xffffff, 80, 60, 0.4, 0.5);
    light.position.set(0, -1, 0);
    group.add(light);
    group.add(light.target);
    light.target.position.set(0, -20, 0);
    this.scene.add(group);
    this.heli = { mesh: group, rotor, angle: 0 };
  }

  _spawnCop(px, pz, playerHeading) {
    // Appear on a road 60-90 m away, roughly behind the player's view.
    const a = Math.random() * Math.PI * 2;
    const d = 60 + Math.random() * 30;
    let x = px + Math.cos(a) * d;
    let z = pz + Math.sin(a) * d;
    x = clamp(x, -300, 300);
    z = clamp(z, -300, 200);
    const v = spawnPoliceCar(this.scene, x, z, Math.atan2(px - x, pz - z));
    this.cops.push(v);
    if (this.onSpawn) this.onSpawn(v);
    return v;
  }

  _roadblockAhead(px, pz, heading) {
    const fx = Math.sin(heading), fz = Math.cos(heading);
    const cx = px + fx * 55, cz = pz + fz * 55;
    const rx = Math.cos(heading), rz = -Math.sin(heading);
    for (const off of [-6, 0, 6]) {
      const v = spawnPoliceCar(this.scene, cx + rx * off, cz + rz * off, heading + Math.PI / 2);
      v.speed = 0;
      v.driver = 'roadblock';
      this.roadblocks.push(v);
      if (this.onSpawn) this.onSpawn(v);
    }
  }

  update(dt, player, vehicles, onBusted, onCopRam) {
    this.time += dt;
    const px = player.x, pz = player.z;
    const inCar = !!player.inVehicle;
    // How many cops should be on scene.
    const want = WANTED.copsPerStar[this.stars];
    this.spawnTimer -= dt;
    if (this.cops.length < want && this.spawnTimer <= 0 && this.stars > 0) {
      this._spawnCop(px, pz, player.heading);
      this.spawnTimer = 2.5;
    }
    // Helicopter from 4 stars.
    if (this.stars >= WANTED.heliFrom && !this.heli) this._makeHeli();
    if (this.stars < WANTED.heliFrom && this.heli) this._removeHeli();
    if (this.heli) {
      const h = this.heli;
      h.angle += dt * 0.5;
      const hx = px + Math.cos(h.angle) * 18;
      const hz = pz + Math.sin(h.angle) * 18;
      h.mesh.position.set(hx, 42, hz);
      h.mesh.lookAt(px, 0, pz);
      h.rotor.rotation.y += dt * 22;
    }
    // Roadblocks from 3 stars, refreshed ahead of the player.
    this.blockTimer -= dt;
    if (this.stars >= WANTED.roadblockFrom && this.blockTimer <= 0) {
      this._clearRoadblocks();
      this._roadblockAhead(px, pz, inCar ? player.inVehicle.heading : player.heading);
      this.blockTimer = 14;
    }
    if (this.stars < WANTED.roadblockFrom && this.roadblocks.length) this._clearRoadblocks();

    // Chase AI: steer toward the player along the road grid (Manhattan
    // steering — a straight-line chase rams every building between the
    // cop and the player). The cop heads along the axis with the bigger
    // gap, so it stays on roads and turns at intersections.
    for (const c of this.cops) {
      if (c.dead) continue;
      const d = dist(c.x, c.z, px, pz);
      const dx = px - c.x, dz = pz - c.z;
      const wantHeading = Math.abs(dx) > Math.abs(dz)
        ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2)
        : (dz > 0 ? 0 : Math.PI);
      const steer = clamp(angleDiff(c.heading, wantHeading) * 1.6, -1, 1);
      const crashed = c.drive(dt, steer, 1, this.city, vehicles);
      if (crashed && d < 12 && onCopRam) onCopRam(c);
      // A cop that touches the player's car damages it; on foot it busts.
      if (d < c.radius + 1.2) {
        if (!inCar) {
          this.bustTimer += dt;
          if (this.bustTimer >= WANTED.bustSeconds && onBusted) onBusted();
        } else if (player.inVehicle) {
          player.inVehicle.damage(6 * dt * 10);
        }
      }
      // Despawn far-away cops once the heat is off.
      if (d > 260 && this.stars === 0) { c.remove(this.scene); }
    }
    this.cops = this.cops.filter((c) => !c.dead);
    // Wanted decay: quiet + unseen for a while, then one star at a time.
    const nearest = this.nearestCopDistance(px, pz);
    const seen = nearest < 45 || this.stars >= 4; // helicopter keeps you spotted
    if (this.stars > 0 && !seen && this.time - this.lastCrimeAt > WANTED.decayQuietSeconds) {
      this.quietTimer += dt;
      this.decayTimer += dt;
      if (this.decayTimer >= WANTED.decayInterval) {
        this.decayTimer = 0;
        this.stars = Math.max(0, this.stars - 1);
      }
    } else {
      this.quietTimer = 0;
      this.decayTimer = 0;
    }
    // Siren while any cop is on scene.
    this.audio.setSiren(this.cops.length > 0 && this.stars > 0);
  }

  nearestCopDistance(px, pz) {
    let best = Infinity;
    for (const c of this.cops) {
      if (c.dead) continue;
      const d = dist(c.x, c.z, px, pz);
      if (d < best) best = d;
    }
    return best;
  }

  copCount() {
    return this.cops.filter((c) => !c.dead).length;
  }
}
