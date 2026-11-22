// combat.js — 5-weapon wheel, hitscan ballistics, tracers, muzzle flash,
// explosions, particle effects (smoke, sparks, fire) and enemy AI shooters.
import * as THREE from 'three';
import { createHumanoidMesh } from '../entities/player.js';

export const WEAPONS = [
  { name: '9MM PISTOL', damage: 22, rate: 0.22, range: 90, spread: 0.012, ammo: Infinity, auto: false, tracer: 0xffe9a8 },
  { name: 'MICRO SMG', damage: 13, rate: 0.075, range: 70, spread: 0.035, ammo: 240, auto: true, tracer: 0xffd24d },
  { name: 'TACTICAL SHOTGUN', damage: 14, rate: 0.75, range: 34, spread: 0.09, ammo: 40, auto: false, pellets: 7, tracer: 0xff9a3c },
  { name: 'CARBINE RIFLE', damage: 34, rate: 0.12, range: 140, spread: 0.008, ammo: 180, auto: true, tracer: 0x7ec8ff },
  { name: 'FRAG GRENADE', damage: 90, rate: 1.1, range: 55, spread: 0, ammo: 6, auto: false, explosive: true, tracer: 0xff5a3c },
];

export class CombatSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.tracers = [];
    this.enemies = [];
    this.flash = null;
    this.flashTimer = 0;
    this.shake = 0;
    // shared particle material pools
    this.smokeMat = new THREE.MeshBasicMaterial({ color: 0x8a8a8a, transparent: true, opacity: 0.38, depthWrite: false });
    this.fireMat = new THREE.MeshBasicMaterial({ color: 0xff7a1e, transparent: true, opacity: 0.9, depthWrite: false });
    this.sparkMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.95, depthWrite: false });
  }

  spawnParticle(pos, vel, size, life, material, gravity = -3) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(size, 6, 5), material.clone());
    m.position.copy(pos);
    if (material === this.smokeMat) m.scale.y = 0.55; // smoke puffs read flat, not like grey balls
    this.scene.add(m);
    this.particles.push({ mesh: m, vel: vel.clone(), life, maxLife: life, gravity, grow: material === this.smokeMat ? 1.6 : 0.2 });
  }

  burst(pos, count, color, speed, size, life, gravity = -3) {
    const mat = color === 'smoke' ? this.smokeMat : color === 'fire' ? this.fireMat : this.sparkMat;
    for (let i = 0; i < count; i++) {
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * speed,
        Math.random() * speed * 0.8 + speed * 0.2,
        (Math.random() - 0.5) * speed,
      );
      this.spawnParticle(pos, vel, size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.8), mat, gravity);
    }
  }

  explode(pos, big = false) {
    this.burst(pos, big ? 26 : 14, 'fire', big ? 14 : 9, big ? 0.9 : 0.6, 0.9, -2);
    this.burst(pos, big ? 18 : 10, 'smoke', 5, 1.4, 2.4, 2.5);
    this.burst(pos, 12, 'spark', 18, 0.16, 0.5, -12);
    this.shake = Math.max(this.shake, big ? 0.9 : 0.5);
    const light = new THREE.PointLight(0xff7a1e, 60, 40, 1.8);
    light.position.copy(pos).add(new THREE.Vector3(0, 2, 0));
    this.scene.add(light);
    this.particles.push({ mesh: light, vel: new THREE.Vector3(), life: 0.45, maxLife: 0.45, gravity: 0, isLight: true });
  }

  muzzleFlash(pos, dir) {
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.95, depthWrite: false }),
    );
    flash.position.copy(pos).addScaledVector(dir, 0.8);
    this.scene.add(flash);
    this.particles.push({ mesh: flash, vel: new THREE.Vector3(), life: 0.07, maxLife: 0.07, gravity: 0 });
    this.burst(pos, 3, 'spark', 6, 0.1, 0.25, -6);
  }

  fireTracer(from, to, color) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color, transparent: true, opacity: 0.95, linewidth: 2,
    }));
    this.scene.add(line);
    this.tracers.push({ line, life: 0.09, maxLife: 0.09 });
  }

  spawnEnemy(position, kind = 'crew') {
    const mesh = createHumanoidMesh('mateo');
    const shirtColor = kind === 'officer' ? 0x1a2a4a : 0x8a1f1f;
    mesh.userData.torso.material = mesh.userData.torso.material.clone();
    mesh.userData.torso.material.color.setHex(shirtColor);
    mesh.position.copy(position);
    this.scene.add(mesh);
    const enemy = {
      mesh, position: position.clone(), health: 60,
      shootTimer: 1 + Math.random() * 2, kind,
      walkPhase: Math.random() * 10,
    };
    this.enemies.push(enemy);
    return enemy;
  }

  clearEnemies() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies.length = 0;
  }

  // Hitscan shot from origin along dir. Returns the hit object (enemy/vehicle) or null.
  shoot(origin, dir, weapon, targets) {
    const pellets = weapon.pellets || 1;
    let hitAny = null;
    for (let p = 0; p < pellets; p++) {
      const d = dir.clone();
      d.x += (Math.random() - 0.5) * weapon.spread * 2;
      d.y += (Math.random() - 0.5) * weapon.spread * 2;
      d.z += (Math.random() - 0.5) * weapon.spread * 2;
      d.normalize();
      const end = origin.clone().addScaledVector(d, weapon.range);
      let bestDist = weapon.range;
      let best = null;
      for (const t of targets) {
        if (t.dead) continue;
        const toT = new THREE.Vector3().subVectors(t.position, origin);
        const along = toT.dot(d);
        if (along < 0 || along > weapon.range) continue;
        const closest = origin.clone().addScaledVector(d, along);
        const perp = closest.distanceTo(t.position.clone().setY(t.position.y + 1.1));
        if (perp < 1.1 && along < bestDist) {
          bestDist = along;
          best = t;
        }
      }
      if (best) {
        end.copy(origin).addScaledVector(d, bestDist);
        best.health -= weapon.damage;
        this.burst(end, 5, 'spark', 5, 0.12, 0.3, -6);
        if (best.health <= 0) best.dead = true;
        hitAny = best;
      } else if (weapon.explosive) {
        this.explode(end, false);
      }
      this.fireTracer(origin.clone(), end, weapon.tracer);
    }
    this.muzzleFlash(origin, dir);
    return hitAny;
  }

  update(dt, playerPos) {
    // particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      if (p.isLight) {
        p.mesh.intensity = 60 * (p.life / p.maxLife);
        continue;
      }
      p.vel.y += p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.scale.multiplyScalar(1 + p.grow * dt);
      if (p.mesh.material.opacity !== undefined) {
        p.mesh.material.opacity = Math.max(0, (p.life / p.maxLife) * 0.9);
      }
    }
    // tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        this.tracers.splice(i, 1);
      } else {
        t.line.material.opacity = t.life / t.maxLife;
      }
    }
    this.shake = Math.max(0, this.shake - dt * 2.2);
    // enemies: stand ground, shoot at the player with line of sight
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dist = e.position.distanceTo(playerPos);
      e.shootTimer -= dt;
      const toPlayer = new THREE.Vector3().subVectors(playerPos, e.position).setY(0).normalize();
      e.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
      e.mesh.userData.arms[0].rotation.x = -1.1;
      e.mesh.userData.arms[1].rotation.x = -1.1;
      if (dist < 55 && e.shootTimer <= 0) {
        e.shootTimer = 0.9 + Math.random() * 0.8;
        const origin = e.position.clone().setY(e.position.y + 1.5);
        const dir = new THREE.Vector3().subVectors(playerPos.clone().setY(playerPos.y + 1.2), origin).normalize();
        dir.x += (Math.random() - 0.5) * 0.1;
        dir.z += (Math.random() - 0.5) * 0.1;
        dir.normalize();
        const end = origin.clone().addScaledVector(dir, 60);
        this.fireTracer(origin, end, 0xff5a3c);
        this.muzzleFlash(origin, dir);
        e.lastShot = { origin, dir };
      }
    }
    // remove dead enemies (fall over)
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead) {
        e.mesh.rotation.x = -Math.PI / 2;
        e.mesh.position.y = 0.3;
        e.deathTimer = (e.deathTimer || 0) + dt;
        if (e.deathTimer > 6) {
          this.scene.remove(e.mesh);
          this.enemies.splice(i, 1);
        }
      }
    }
  }
}
