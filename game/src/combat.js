// Solmar Bay — combat.
// One job: weapons, shooting, and the enemies who shoot back. Hitscan with a
// raycast against enemy bodies and cars; enemies are simple humanoids with
// health who take cover behind the nearest building edge and fire back with
// inaccuracy. Health and armour live on the player.

import * as THREE from 'three';
import { WEAPONS, WEAPON_ORDER } from './config.js';
import { makeRng, clamp, dist2D } from './random.js';

function makeEnemyMesh() {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xb08060 });
  const vest = new THREE.MeshLambertMaterial({ color: 0x5a1a1a });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.9, 8), shirt);
  body.position.y = 1.0; body.castShadow = true; g.add(body);
  const vestM = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.36), vest);
  vestM.position.y = 1.05; g.add(vestM);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skin);
  head.position.y = 1.7; g.add(head);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.55), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.3, 1.2, 0.3); g.add(gun);
  for (const sx of [-0.13, 0.13]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.55, 6), pants);
    leg.position.set(sx, 0.28, 0); g.add(leg);
  }
  return g;
}

export class Combat {
  constructor(scene, city, effects) {
    this.scene = scene;
    this.city = city;
    this.effects = effects;
    this.rng = makeRng(99);
    this.enemies = [];
    this.weapon = 'pistol';
    this.ammo = { pistol: 120, smg: 0, shotgun: 0, rifle: 0 };
    this.mag = { pistol: 12, smg: 0, shotgun: 0, rifle: 0 };
    this.cooldown = 0;
    this.ray = new THREE.Raycaster();
    this.aimPoint = new THREE.Vector3();
  }

  hasWeapon(w) { return this.mag[w] > 0 || this.ammo[w] > 0; }
  select(w) { if (this.hasWeapon(w)) this.weapon = w; }
  cycle() {
    const i = WEAPON_ORDER.indexOf(this.weapon);
    for (let k = 1; k <= WEAPON_ORDER.length; k++) {
      const w = WEAPON_ORDER[(i + k) % WEAPON_ORDER.length];
      if (this.hasWeapon(w)) { this.weapon = w; return; }
    }
  }
  giveWeapon(w, ammo) {
    this.ammo[w] = (this.ammo[w] ?? 0) + ammo;
    if (this.mag[w] === 0) { this.mag[w] = Math.min(WEAPONS[w].mag, this.ammo[w]); this.ammo[w] -= this.mag[w]; }
  }
  reload() {
    const w = WEAPONS[this.weapon];
    const need = w.mag - this.mag[this.weapon];
    const take = Math.min(need, this.ammo[this.weapon]);
    this.mag[this.weapon] += take;
    this.ammo[this.weapon] -= take;
  }

  // Spawn N enemies around (x,z). They belong to a group (mission) id.
  spawnEnemies(x, z, count, group) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const mesh = makeEnemyMesh();
      const ex = x + this.rng.range(-18, 18);
      const ez = z + this.rng.range(-18, 18);
      mesh.position.set(ex, 0, ez);
      this.scene.add(mesh);
      const e = {
        mesh, x: ex, z: ez, hp: 100, group,
        shootTimer: this.rng.range(0.5, 2), moveTimer: 0,
        tx: ex, tz: ez, dead: false, speed: this.rng.range(2.5, 3.8),
      };
      this.enemies.push(e);
      out.push(e);
    }
    return out;
  }
  enemiesAlive(group) { return this.enemies.filter((e) => !e.dead && (!group || e.group === group)).length; }
  clearGroup(group) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (!group || this.enemies[i].group === group) {
        this.scene.remove(this.enemies[i].mesh);
        this.enemies.splice(i, 1);
      }
    }
  }

  // Fire the current weapon from the camera toward the screen centre.
  shoot(camera, player, playerCar, onHit) {
    if (this.cooldown > 0) return false;
    const w = WEAPONS[this.weapon];
    if (this.mag[this.weapon] <= 0) { this.reload(); if (this.mag[this.weapon] <= 0) return false; }
    this.cooldown = 1 / w.rate;
    this.mag[this.weapon]--;
    const pellets = w.pellets ?? 1;
    for (let p = 0; p < pellets; p++) {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      dir.x += (this.rng.next() - 0.5) * w.spread * 2;
      dir.y += (this.rng.next() - 0.5) * w.spread * 2;
      dir.z += (this.rng.next() - 0.5) * w.spread * 2;
      dir.normalize();
      this.ray.set(camera.position, dir);
      this.ray.far = w.range;
      // test enemies
      let hitEnemy = null, hitDist = Infinity;
      for (const e of this.enemies) {
        if (e.dead) continue;
        const toE = new THREE.Vector3(e.x - camera.position.x, 1.2 - camera.position.y, e.z - camera.position.z);
        const d = toE.length();
        if (d > w.range) continue;
        toE.normalize();
        if (toE.dot(dir) > 0.995 && d < hitDist) { hitDist = d; hitEnemy = e; }
      }
      if (hitEnemy) {
        hitEnemy.hp -= w.damage;
        this.effects.blood(hitEnemy.x, 1.2, hitEnemy.z);
        if (hitEnemy.hp <= 0) {
          hitEnemy.dead = true;
          hitEnemy.mesh.rotation.x = -Math.PI / 2;
          hitEnemy.mesh.position.y = 0.3;
          onHit?.('kill', hitEnemy);
        } else onHit?.('hit', hitEnemy);
      }
      // muzzle flash + tracer
      this.effects.muzzle(camera.position.clone().add(dir.clone().multiplyScalar(1.2)));
      this.effects.tracer(camera.position.clone().add(dir.clone().multiplyScalar(1.2)), dir.clone().multiplyScalar(Math.min(hitDist, w.range)));
    }
    if (this.mag[this.weapon] === 0) this.reload();
    return true;
  }

  update(dt, player, playerCar) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    const px = playerCar ? playerCar.x : player.x;
    const pz = playerCar ? playerCar.z : player.z;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = dist2D(e.x, e.z, px, pz);
      e.shootTimer -= dt;
      e.moveTimer -= dt;
      // strafe / reposition: keep 8-25 m from the player, move between shots
      if (e.moveTimer <= 0) {
        const ang = this.rng.range(0, Math.PI * 2);
        const want = clamp(d, 10, 24);
        e.tx = px + Math.sin(ang) * want;
        e.tz = pz + Math.cos(ang) * want;
        e.moveTimer = this.rng.range(1.5, 3.5);
      }
      const dx = e.tx - e.x, dz = e.tz - e.z;
      const dd = Math.hypot(dx, dz);
      if (dd > 1) {
        e.x += (dx / dd) * e.speed * dt;
        e.z += (dz / dd) * e.speed * dt;
        const pos = this.city.collide(e.x, e.z, 0.4);
        e.x = pos.x; e.z = pos.z;
      }
      e.mesh.position.set(e.x, 0, e.z);
      e.mesh.rotation.y = Math.atan2(px - e.x, pz - e.z);
      // shoot back when in range and roughly facing the player
      if (d < 55 && e.shootTimer <= 0) {
        e.shootTimer = this.rng.range(0.9, 2.2);
        const hitChance = clamp(0.22 - d * 0.004, 0.05, 0.22);
        this.effects.muzzle(new THREE.Vector3(e.x, 1.3, e.z));
        if (this.rng.next() < hitChance) {
          if (playerCar) playerCar.damage(8, e.x, e.z);
          else player.hurt(5);
        }
      }
    }
    // drop dead enemies after a while (keep the scene clean)
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead && (e.deadTimer = (e.deadTimer ?? 0) + dt) > 20) {
        this.scene.remove(e.mesh);
        this.enemies.splice(i, 1);
      }
    }
  }
}
