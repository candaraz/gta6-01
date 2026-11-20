// combat.js — weapons, hitscan shooting, and enemy gang members.
// Enemy fire is deliberately soft (damage 5, max hit chance 0.22) so a
// 12-enemy finale is winnable, not a DPS race the player loses.
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { clamp, dist } from './random.js';

const ENEMY_HIT_CHANCE = 0.22;
const ENEMY_DAMAGE = 5;
const ENEMY_RANGE = 46;
const ENEMY_SHOT_INTERVAL = 1.4;

export class Combat {
  constructor(scene, effects, audio) {
    this.scene = scene;
    this.effects = effects;
    this.audio = audio;
    this.owned = { pistol: true, smg: false, shotgun: false, rifle: false };
    this.ammo = { pistol: Infinity, smg: 0, shotgun: 0, rifle: 0 };
    this.mag = { pistol: 12, smg: 0, shotgun: 0, rifle: 0 };
    this.current = 'pistol';
    this.cooldown = 0;
    this.reloadTimer = 0;
    this.enemies = [];
    this._ray = new THREE.Raycaster();
    this._enemyGeo = new THREE.CylinderGeometry(0.36, 0.46, 1.7, 8);
    this._enemyHead = new THREE.SphereGeometry(0.28, 8, 8);
    this._tracerGeo = new THREE.BoxGeometry(0.05, 0.05, 1);
    this.tracers = [];
  }

  giveWeapon(name, ammoCount) {
    this.owned[name] = true;
    this.ammo[name] = (this.ammo[name] === Infinity ? 0 : this.ammo[name]) + (ammoCount || 60);
    if (this.mag[name] === 0) this.reloadInstant(name);
  }

  select(name) {
    if (this.owned[name]) this.current = name;
  }

  cycle() {
    const order = ['pistol', 'smg', 'shotgun', 'rifle'].filter((w) => this.owned[w]);
    const i = order.indexOf(this.current);
    this.current = order[(i + 1) % order.length];
  }

  reloadInstant(name) {
    const def = WEAPONS[name];
    const need = def.mag - this.mag[name];
    const take = Math.min(need, this.ammo[name] === Infinity ? need : this.ammo[name]);
    this.mag[name] += take;
    if (this.ammo[name] !== Infinity) this.ammo[name] -= take;
  }

  startReload() {
    if (this.reloadTimer > 0) return;
    const def = WEAPONS[this.current];
    if (this.mag[this.current] >= def.mag) return;
    if (this.ammo[this.current] === 0) return;
    this.reloadTimer = 1.1;
  }

  // Spawn N enemies around (x, z). Returns the spawned list.
  spawnEnemies(x, z, count, label) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.6;
      const r = 12 + Math.random() * 14;
      const ex = x + Math.cos(a) * r;
      const ez = z + Math.sin(a) * r;
      const group = new THREE.Group();
      const body = new THREE.Mesh(this._enemyGeo, new THREE.MeshLambertMaterial({ color: 0x8a1a1a }));
      body.position.y = 0.85;
      group.add(body);
      const head = new THREE.Mesh(this._enemyHead, new THREE.MeshLambertMaterial({ color: 0xd8a878 }));
      head.position.y = 1.95;
      group.add(head);
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.55), new THREE.MeshLambertMaterial({ color: 0x111111 }));
      gun.position.set(0.3, 1.25, 0.4);
      group.add(gun);
      group.position.set(ex, 0, ez);
      this.scene.add(group);
      const e = { mesh: group, x: ex, z: ez, hp: 100, dead: false, shootTimer: 0.8 + Math.random(), label: label || 'Vulture', fallTimer: 0 };
      this.enemies.push(e);
      out.push(e);
    }
    return out;
  }

  aliveEnemies() {
    return this.enemies.filter((e) => !e.dead);
  }

  // Hitscan shot. The crosshair's far point (60 m along the camera ray)
  // is the aim point; the bullet travels from the muzzle to it. Shooting
  // straight from the camera would make the ray dive over near enemies
  // (the camera sits metres above the player), so the ray starts at the
  // muzzle and converges on the crosshair's point instead.
  fire(camera, origin, playerPos) {
    if (this.cooldown > 0 || this.reloadTimer > 0) return null;
    const def = WEAPONS[this.current];
    if (this.mag[this.current] <= 0) { this.startReload(); return null; }
    this.mag[this.current]--;
    this.cooldown = def.rate;
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const aimPoint = new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z)
      .addScaledVector(camDir, 60);
    const mx = playerPos.x + camDir.x * 1.2, my = 1.4, mz = playerPos.z + camDir.z * 1.2;
    const shotDir = new THREE.Vector3(aimPoint.x - mx, aimPoint.y - my, aimPoint.z - mz).normalize();
    this.effects.muzzle(mx, my, mz);
    if (this.current === 'shotgun') this.audio.shotgunBlast();
    else this.audio.gunshot();
    const pellets = def.pellets || 1;
    let hits = 0;
    for (let p = 0; p < pellets; p++) {
      const dir = shotDir.clone();
      dir.x += (Math.random() - 0.5) * def.spread * 2;
      dir.y += (Math.random() - 0.5) * def.spread * 2;
      dir.z += (Math.random() - 0.5) * def.spread * 2;
      dir.normalize();
      this._ray.set(new THREE.Vector3(mx, my, mz), dir);
      this._ray.far = def.range;
      const hit = this._nearestHit(origin);
      if (hit) {
        hits++;
        hit.enemy.hp -= def.damage;
        this.effects.blood(hit.enemy.x, 1.4, hit.enemy.z);
        if (hit.enemy.hp <= 0 && !hit.enemy.dead) {
          hit.enemy.dead = true;
          if (hit.enemy.isPed) {
            if (this.onPedDown) this.onPedDown(hit.enemy.ped);
          } else {
            hit.enemy.fallTimer = 2.0;
            hit.enemy.mesh.rotation.x = Math.PI / 2;
            hit.enemy.mesh.position.y = 0.4;
          }
        }
      }
      this._spawnTracer(new THREE.Vector3(mx, my, mz), dir, hit ? hit.dist : def.range);
    }
    return { hits, weapon: this.current };
  }

  // Nearest enemy (or ped, via callback) along the current ray.
  _nearestHit(origin) {
    let best = null, bd = Infinity;
    const targets = this.enemies.concat(this.extraTargets || []);
    for (const e of targets) {
      if (e.dead) continue;
      const to = new THREE.Vector3(e.x, 1.2, e.z);
      const cam = this._ray.ray.origin;
      const d = to.clone().sub(cam);
      const along = d.dot(this._ray.ray.direction);
      if (along < 1 || along > this._ray.far) continue;
      const perp = d.clone().sub(this._ray.ray.direction.clone().multiplyScalar(along)).length();
      if (perp < 1.4 && along < bd) { bd = along; best = e; }
    }
    return best ? { enemy: best, dist: bd } : null;
  }

  // Pedestrians the crosshair may hit (refreshed by the game each frame).
  setExtraTargets(list) {
    this.extraTargets = list;
  }

  // Enemy AI: close in, shoot with a soft hit chance. onPlayerHit(dmg)
  // is called when a shot lands; onEnemyDown(e) when one dies by fire.
  update(dt, playerPos, onPlayerHit) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this.reloadInstant(this.current);
    }
    for (const t of this.tracers) t.life -= dt;
    for (const t of this.tracers.filter((t) => t.life <= 0)) this.scene.remove(t.mesh);
    this.tracers = this.tracers.filter((t) => t.life > 0);
    for (const e of this.enemies) {
      if (e.dead) {
        if (e.fallTimer > 0) {
          e.fallTimer -= dt;
          if (e.fallTimer <= 0) this.scene.remove(e.mesh);
        }
        continue;
      }
      const d = dist(e.x, e.z, playerPos.x, playerPos.z);
      // Close to ~18 m, then hold and shoot.
      if (d > 18) {
        const h = Math.atan2(playerPos.x - e.x, playerPos.z - e.z);
        e.x += Math.sin(h) * 5.5 * dt;
        e.z += Math.cos(h) * 5.5 * dt;
        e.mesh.position.set(e.x, 0, e.z);
        e.mesh.rotation.y = h;
      } else {
        e.mesh.rotation.y = Math.atan2(playerPos.x - e.x, playerPos.z - e.z);
      }
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && d < ENEMY_RANGE) {
        e.shootTimer = ENEMY_SHOT_INTERVAL * (0.8 + Math.random() * 0.5);
        const chance = Math.min(ENEMY_HIT_CHANCE, 0.10 + (1 - d / ENEMY_RANGE) * 0.18);
        this.effects.muzzle(e.x, 1.4, e.z);
        this.audio.gunshot();
        if (Math.random() < chance && onPlayerHit) onPlayerHit(ENEMY_DAMAGE);
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead || e.fallTimer > 0);
  }

  clearEnemies() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies = [];
  }

  _spawnTracer(from, dir, len) {
    const m = new THREE.Mesh(this._tracerGeo, new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.8 }));
    m.position.copy(from).addScaledVector(dir, len / 2);
    m.scale.z = len;
    m.lookAt(m.position.clone().add(dir));
    this.scene.add(m);
    this.tracers.push({ mesh: m, life: 0.06 });
  }
}
