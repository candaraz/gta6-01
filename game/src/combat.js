// Combat: hitscan shooting from the camera ray, clamped to the ground
// so shots never dive underground. Enemies (Deke's Vultures) hold their
// ground on open road, shoot only with a clear line of sight, and die
// when their HP runs out. Melee punch for close range.
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { clamp, dist, range } from './random.js';
import { damagePlayer } from './player.js';

const ENEMY_HP = 16;
const ENEMY_DMG = 1;

export function createCombat(G) {
  const C = {
    enemies: [], tracers: [], muzzle: 0,
    shotsFiredRecently: 0,
    current: 'pistol', owned: { fists: true, pistol: true },
    mag: { pistol: 12 }, reserve: { pistol: 120 },
    cooldown: 0,
  };
  G.combat = C;

  C.weaponDef = () => WEAPONS[C.current];
  C.ammoText = function () {
    const w = C.weaponDef();
    if (!isFinite(w.mag)) return '∞';
    return `${C.mag[C.current] || 0} rounds`;
  };
  C.cycle = function () {
    const order = ['fists', 'pistol', 'smg', 'shotgun', 'rifle'];
    const owned = order.filter((k) => C.owned[k]);
    const i = owned.indexOf(C.current);
    C.current = owned[(i + 1) % owned.length];
  };
  C.select = function (key) {
    const map = { w1: 'fists', w2: 'pistol', w3: 'smg', w4: 'shotgun', w5: 'rifle' };
    const k = map[key];
    if (k && C.owned[k]) C.current = k;
  };
  C.give = function (key, ammo) {
    C.owned[key] = true;
    const w = WEAPONS[key];
    C.mag[key] = w.mag;
    C.reserve[key] = (C.reserve[key] || 0) + (ammo || w.ammo);
  };
  C.reload = function () {
    const w = C.weaponDef();
    if (!isFinite(w.mag)) return;
    const have = C.reserve[C.current] || 0;
    const need = w.mag - (C.mag[C.current] || 0);
    const take = Math.min(need, have);
    if (take > 0) {
      C.mag[C.current] = (C.mag[C.current] || 0) + take;
      C.reserve[C.current] = have - take;
      G.audio.reload();
    }
  };

  // Line of sight: does the segment hit any building AABB?
  C.hasLOS = function (x1, z1, x2, z2) {
    const steps = 12;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t;
      if (G.city.blocked(x, z, 0)) return false;
    }
    return true;
  };

  C.spawnCrew = function (count, cx, cz) {
    C.clearCrew();
    const B = 48;
    for (let i = 0; i < count; i++) {
      // Spawn on the nearest road, in the open, not among containers.
      const rx = Math.round((cx + (i - count / 2) * 10) / B) * B;
      const rz = Math.round(cz / B) * B;
      const ex = rx + (i % 2 === 0 ? 6 : -6);
      const ez = rz + (i % 3 === 0 ? 6 : -6);
      const fixed = G.city.resolveCollision(ex, ez, 1);
      const g = new THREE.Group();
      const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.95, 0.45),
        new THREE.MeshLambertMaterial({ color: 0x8a1a1a }));
      shirt.position.y = 1.05; shirt.castShadow = true;
      const legs = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.75, 0.4),
        new THREE.MeshLambertMaterial({ color: 0x1a1a22 }));
      legs.position.y = 0.38;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8),
        new THREE.MeshLambertMaterial({ color: 0xc98a5a }));
      head.position.y = 1.8;
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.12),
        new THREE.MeshLambertMaterial({ color: 0x111111 }));
      gun.position.set(0.4, 1.2, 0.2);
      g.add(shirt, legs, head, gun);
      g.position.set(fixed.x, 0, fixed.z);
      G.scene.add(g);
      C.enemies.push({
        mesh: g, x: fixed.x, z: fixed.z, hp: ENEMY_HP,
        shootTimer: 1 + i * 0.5, dead: false, heading: 0,
      });
    }
  };
  C.clearCrew = function () {
    for (const e of C.enemies) G.scene.remove(e.mesh);
    C.enemies = [];
  };
  C.aliveCount = () => C.enemies.filter((e) => !e.dead).length;

  // Player fires the current weapon along the camera ray.
  C.fire = function () {
    if (C.cooldown > 0 || G.state !== 'playing') return;
    const w = C.weaponDef();
    if (w.slot === 1) { C.punch(); return; }
    if ((C.mag[C.current] || 0) <= 0) { C.reload(); return; }
    C.mag[C.current]--;
    C.cooldown = w.rate;
    C.shotsFiredRecently = 1.2;
    const cam = G.cameraRig.cam;
    cam.updateMatrixWorld();
    // Aim: muzzle -> camera ray's ground hit, clamped to weapon range.
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const origin = cam.position.clone();
    let far = w.range;
    if (dir.y < -0.02) {
      // Clamp the far point to where the ray meets the ground, so the
      // tracer never dives underground — but no higher, or the ray
      // would be cut short of enemies at range.
      const t = (0.3 - origin.y) / dir.y;
      if (t > 0) far = Math.min(far, t);
    }
    const farPoint = origin.clone().add(dir.clone().multiplyScalar(far));
    const muzzle = G.player.vehicle
      ? new THREE.Vector3(G.player.x, 1.6, G.player.z)
      : new THREE.Vector3(G.player.x, 1.5, G.player.z);
    // Muzzle flash + tracer.
    C.muzzle = 0.06;
    G.effects.flash(muzzle);
    G.effects.tracer(muzzle, farPoint);
    if (w.pellets) G.audio.shotgun(); else G.audio.shot();
    // Hit test: nearest enemy whose body the ray passes close to.
    const pellets = w.pellets || 1;
    for (let p = 0; p < pellets; p++) {
      const spread = w.pellets ? 0.03 : 0.008;
      const d = dir.clone();
      d.x += (Math.random() - 0.5) * spread * 2;
      d.y += (Math.random() - 0.5) * spread * 2;
      d.normalize();
      let best = null, bestT = far;
      for (const e of C.enemies) {
        if (e.dead) continue;
        const toE = new THREE.Vector3(e.x - origin.x, 1.2 - origin.y, e.z - origin.z);
        const t = toE.dot(d);
        if (t < 0 || t > far) continue;
        const closest = origin.clone().add(d.clone().multiplyScalar(t));
        const miss = Math.hypot(closest.x - e.x, closest.z - e.z, closest.y - 1.2);
        if (miss < 1.1 && t < bestT) { best = e; bestT = t; }
      }
      if (best) {
        best.hp -= w.dmg;
        G.effects.blood(best.x, 1.2, best.z);
        if (best.hp <= 0) {
          best.dead = true;
          best.mesh.visible = false;
          G.effects.explosion(best.x, 1, best.z, 0.5);
          G.audio.explosion();
          G.missions.onKill();
        }
      }
    }
  };

  C.punch = function () {
    C.cooldown = 0.45;
    C.shotsFiredRecently = 0.5;
    for (const e of C.enemies) {
      if (e.dead) continue;
      if (dist(G.player.x, G.player.z, e.x, e.z) < 2.4) {
        e.hp -= WEAPONS.fists.dmg;
        G.effects.blood(e.x, 1.2, e.z);
        if (e.hp <= 0) {
          e.dead = true; e.mesh.visible = false;
          G.missions.onKill();
        }
      }
    }
  };

  C.step = function (dt) {
    C.cooldown = Math.max(0, C.cooldown - dt);
    C.shotsFiredRecently = Math.max(0, C.shotsFiredRecently - dt);
    C.muzzle = Math.max(0, C.muzzle - dt);
    const P = G.player;
    for (const e of C.enemies) {
      if (e.dead) continue;
      const d = dist(e.x, e.z, P.x, P.z);
      e.heading = Math.atan2(P.z - e.z, P.x - e.x);
      e.mesh.rotation.y = -e.heading;
      // Hold ground: Vultures stand and shoot, they do not strafe away.
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && d < 55 && d > 2) {
        e.shootTimer = 1.1 + Math.random() * 0.8;
        if (C.hasLOS(e.x, e.z, P.x, P.z)) {
          // Enemy shot: a visible tracer and damage, dodgeable by range.
          const hitChance = d < 12 ? 0.55 : d < 25 ? 0.35 : 0.18;
          G.effects.tracer(new THREE.Vector3(e.x, 1.3, e.z), new THREE.Vector3(P.x, 1.3, P.z));
          G.audio.shot();
          if (Math.random() < hitChance) {
            damagePlayer(G, ENEMY_DMG);
            G.effects.blood(P.x, 1.4, P.z);
          }
        }
      }
    }
  };
  return C;
}
