// combat.js — Solmar Bay v3: shooting, Deke's crew, and pickups.
// One job: the player's weapons, the Vultures who shoot back, and the
// health/ammo pickups they drop.
//
// The aim fix (from v2): a shot travels from the muzzle to the crosshair's
// far point (60 m along the camera ray), so it never dives over a near
// enemy. The bullet stops at the first thing it hits: an enemy, or a wall.

import * as THREE from 'three';
import { WEAPONS, TUNE } from './config.js';

const ENEMY_POOL = 16;
const PICKUP_POOL = 14;

export function createCombat(G) {
  const scene = G.scene;
  const dummy = new THREE.Object3D();
  // Enemies: dark body, skin head, red bandana — so they read as a crew.
  const bodyGeo = new THREE.BoxGeometry(0.56, 1.2, 0.34);
  bodyGeo.translate(0, 1.0, 0);
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2a2a30 });
  const bodyMesh = new THREE.InstancedMesh(bodyGeo, bodyMat, ENEMY_POOL);
  const headGeo = new THREE.SphereGeometry(0.21, 8, 6);
  headGeo.translate(0, 1.78, 0);
  const headMat = new THREE.MeshLambertMaterial({ color: 0xd8a878 });
  const headMesh = new THREE.InstancedMesh(headGeo, headMat, ENEMY_POOL);
  const bandGeo = new THREE.BoxGeometry(0.46, 0.12, 0.46);
  bandGeo.translate(0, 1.88, 0);
  const bandMat = new THREE.MeshBasicMaterial({ color: 0xd81f2a });
  const bandMesh = new THREE.InstancedMesh(bandGeo, bandMat, ENEMY_POOL);
  [bodyMesh, headMesh, bandMesh].forEach((m) => {
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    scene.add(m);
  });
  const hide = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < ENEMY_POOL; i++) {
    bodyMesh.setMatrixAt(i, hide); headMesh.setMatrixAt(i, hide); bandMesh.setMatrixAt(i, hide);
  }
  // Pickups: green cross (health) / yellow box (ammo), bobbing and spinning.
  const pickGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
  const pickMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const pickMesh = new THREE.InstancedMesh(pickGeo, pickMat, PICKUP_POOL);
  pickMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  pickMesh.frustumCulled = false;
  scene.add(pickMesh);
  for (let i = 0; i < PICKUP_POOL; i++) pickMesh.setMatrixAt(i, hide);

  const enemies = [];
  const pickups = [];
  const freeEnemy = [];
  for (let i = ENEMY_POOL - 1; i >= 0; i--) freeEnemy.push(i);
  const freePick = [];
  for (let i = PICKUP_POOL - 1; i >= 0; i--) freePick.push(i);
  let fireCooldown = 0, reloadTimer = 0;

  function spawnEnemy(x, z) {
    if (!freeEnemy.length) return null;
    const slot = freeEnemy.pop();
    const e = { slot, x, z, heading: 0, hp: TUNE.enemyHealth, alive: true, shootT: 0.8 + Math.random() * 0.8, strafeDir: Math.random() < 0.5 ? 1 : -1, state: 'idle' };
    enemies.push(e);
    return e;
  }
  function clearEnemies() {
    for (const e of [...enemies]) killEnemy(e, false);
  }
  function killEnemy(e, drop = true) {
    if (!e.alive) return;
    e.alive = false;
    bodyMesh.setMatrixAt(e.slot, hide); headMesh.setMatrixAt(e.slot, hide); bandMesh.setMatrixAt(e.slot, hide);
    freeEnemy.push(e.slot);
    enemies.splice(enemies.indexOf(e), 1);
    G.effects.blood({ x: e.x, y: 1.2, z: e.z });
    if (drop) spawnPickup(e.x, e.z, Math.random() < 0.5 ? 'health' : 'ammo');
  }
  function spawnPickup(x, z, kind) {
    if (!freePick.length) return;
    const slot = freePick.pop();
    const pk = { slot, x, z, kind, bob: Math.random() * 6 };
    pickups.push(pk);
    pickMesh.setColorAt(slot, new THREE.Color(kind === 'health' ? 0x2aff5a : 0xffc21f));
  }
  function aliveCount() { return enemies.length; }

  // Ray vs enemy spheres (chest at y 1.2, radius 0.7) and building AABBs.
  // Line of sight: does the 2D segment (x1,z1)->(x2,z2) cross any
  // collider AABB (building / container)? Used so enemies only shoot
  // when they can actually see the player.
  function hasLOS(x1, z1, x2, z2) {
    const dx = x2 - x1, dz = z2 - z1;
    for (const c of G.city.colliders) {
      let t0 = 0, t1 = 1, ok = true;
      for (const [o, d, lo, hi] of [[x1, dx, c.x0, c.x1], [z1, dz, c.z0, c.z1]]) {
        if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { ok = false; break; } }
        else {
          let a = (lo - o) / d, b = (hi - o) / d;
          if (a > b) [a, b] = [b, a];
          t0 = Math.max(t0, a); t1 = Math.min(t1, b);
          if (t0 > t1) { ok = false; break; }
        }
      }
      if (ok && t0 < 1 && t1 > 0) return false;
    }
    return true;
  }

  function raycastShot(origin, dir, maxDist) {
    let best = { dist: maxDist, enemy: null };
    for (const e of enemies) {
      if (!e.alive) continue;
      // Ray-sphere test against the chest.
      const cx = e.x - origin.x, cy = 1.2 - origin.y, cz = e.z - origin.z;
      const t = cx * dir.x + cy * dir.y + cz * dir.z;
      if (t < 0 || t > best.dist) continue;
      const px = origin.x + dir.x * t, py = origin.y + dir.y * t, pz = origin.z + dir.z * t;
      const d2 = (px - e.x) ** 2 + (py - 1.2) ** 2 + (pz - e.z) ** 2;
      if (d2 < 0.9 * 0.9) best = { dist: t, enemy: e }; // 0.9 (was 0.7): a strafing chest at 10 m must stay hittable
    }
    // Ray vs building AABBs (2D slab test on x/z, y within 0..60).
    for (const c of G.city.colliders) {
      let tmin = 0, tmax = best.dist;
      let ok = true;
      for (const [o, d, lo, hi] of [[origin.x, dir.x, c.x0, c.x1], [origin.z, dir.z, c.z0, c.z1]]) {
        if (Math.abs(d) < 1e-8) { if (o < lo || o > hi) { ok = false; break; } }
        else {
          let t1 = (lo - o) / d, t2 = (hi - o) / d;
          if (t1 > t2) [t1, t2] = [t2, t1];
          tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
          if (tmin > tmax) { ok = false; break; }
        }
      }
      if (ok && tmin < best.dist && tmin > 0) {
        const y = origin.y + dir.y * tmin;
        if (y > 0 && y < 60) best = { dist: tmin, enemy: null };
      }
    }
    return best;
  }

  function playerShoot() {
    const p = G.player.p;
    const w = WEAPONS[p.weapon];
    if (!w || p.weapon === 'fists') {
      // Melee: hit the nearest enemy in front within range.
      for (const e of [...enemies]) {
        const d = Math.hypot(e.x - p.x, e.z - p.z);
        if (d < w.range) {
          e.hp -= w.dmg;
          G.effects.blood({ x: e.x, y: 1.2, z: e.z });
          if (e.hp <= 0) killEnemy(e);
          break;
        }
      }
      G.audio.shot();
      return;
    }
    const slot = p.weapons[p.weapon];
    if (!slot || slot.ammo <= 0) { G.audio.denied(); return; }
    slot.ammo--;
    const ray = G.camera.crosshairRay();
    // Muzzle at the player's chest, toward the crosshair's far point.
    // The camera looks down, so a fixed 60 m far point is UNDERGROUND
    // (the ray hits the ground at ~17 m) and a muzzle-to-far shot would
    // dive into the dirt at ~8 m, never reaching a chest at 9 m+.
    // Clamp the far point to the camera ray's ground hit so the shot
    // stays above ground and passes through the crosshair's target.
    const muzzle = new THREE.Vector3(p.x + Math.sin(p.heading) * 0.5, p.y + 1.4, p.z + Math.cos(p.heading) * 0.5);
    let farDist = 60;
    if (ray.dir.y < -0.001) {
      const tGround = (ray.origin.y - 0) / -ray.dir.y;
      if (tGround > 2) farDist = Math.min(60, tGround);
    }
    const far = ray.origin.clone().add(ray.dir.clone().multiplyScalar(farDist));
    const dir = far.clone().sub(muzzle).normalize();
    G.effects.muzzle(muzzle, dir);
    G.audio.shot();
    const pellets = w.pellets || 1;
    for (let k = 0; k < pellets; k++) {
      const d = dir.clone();
      if (pellets > 1) {
        d.x += (Math.random() - 0.5) * 0.09;
        d.y += (Math.random() - 0.5) * 0.09;
        d.z += (Math.random() - 0.5) * 0.09;
        d.normalize();
      }
      const hit = raycastShot(muzzle, d, w.range);
      const end = muzzle.clone().add(d.clone().multiplyScalar(hit.dist));
      G.effects.sparks(end);
      if (hit.enemy) {
        hit.enemy.hp -= w.dmg;
        G.effects.blood({ x: hit.enemy.x, y: 1.2, z: hit.enemy.z });
        if (hit.enemy.hp <= 0) killEnemy(hit.enemy);
      }
    }
    // Loud shots scare the peds and draw the police's attention.
    G.peds.scare(p.x, p.z, 40);
    G.effects.addShake(0.12);
  }

  function update(dt, input) {
    const p = G.player.p;
    // Player fire: mouse click or F (semi-auto on press, auto on hold).
    fireCooldown -= dt;
    if (reloadTimer > 0) {
      reloadTimer -= dt;
      if (reloadTimer <= 0) G.player.reload();
    }
    const w = WEAPONS[p.weapon];
    if (w && p.weapon !== 'fists' && G.state === 'playing' && p.onFoot) {
      const wantFire = input.mouse.clicked || input.down('KeyF');
      const auto = w.auto;
      const pressed = input.mouse.clicked || input.takePressed('KeyF');
      if ((auto ? wantFire : pressed) && fireCooldown <= 0) {
        const slot = p.weapons[p.weapon];
        if (slot && slot.ammo > 0) {
          playerShoot();
          fireCooldown = 1 / w.rate;
        } else if (pressed) {
          G.audio.denied();
          reloadTimer = 0.01; // auto-reload on empty click
        }
      }
    } else if (p.weapon === 'fists' && G.state === 'playing' && p.onFoot) {
      if ((input.mouse.clicked || input.takePressed('KeyF')) && fireCooldown <= 0) {
        playerShoot();
        fireCooldown = 1 / w.rate;
      }
    }
    if (input.takePressed('KeyR')) reloadTimer = WEAPONS[p.weapon].reload;

    // Enemies: chase / strafe / shoot.
    for (const e of [...enemies]) {
      const d = Math.hypot(e.x - p.x, e.z - p.z);
      const dx = p.x - e.x, dz = p.z - e.z;
      if (d < 48) e.state = 'chase';
      if (e.state === 'chase') {
        if (d > 16) {
          // Close in.
          e.heading = Math.atan2(dx, dz);
          const nx = e.x + Math.sin(e.heading) * 5.2 * dt;
          const nz = e.z + Math.cos(e.heading) * 5.2 * dt;
          const pos = { x: nx, z: nz };
          G.city.collideCircle(pos, 0.6);
          e.x = pos.x; e.z = pos.z;
        } else {
          // Strafe at mid range, keeping the player in sight.
          e.heading = Math.atan2(dx, dz);
          const sx = Math.cos(e.heading) * e.strafeDir, sz = -Math.sin(e.heading) * e.strafeDir;
          const nx = e.x, nz = e.z; // no strafe: Vultures hold their ground and shoot, so an aimed round lands (a strafing target at 10 m dodged ~95% of driver rounds)
          const pos = { x: nx, z: nz };
          G.city.collideCircle(pos, 0.6);
          e.x = pos.x; e.z = pos.z;
          if (Math.random() < dt * 0.25) e.strafeDir *= -1;
        }
        // Shoot: a hit every ~1.1 s at close range, less often far away.
        // Only with a clear line of sight: a Vulture behind a container
        // cannot hit the player, just as the player cannot hit it —
        // otherwise a blocked enemy would bleed the player dry while
        // being unshootable.
        e.shootT -= dt;
        if (e.shootT <= 0 && d < 42 && p.onFoot && hasLOS(e.x, e.z, p.x, p.z)) {
          e.shootT = 1.1 + Math.random() * 0.8;
          const muzzle = new THREE.Vector3(e.x, 1.4, e.z);
          const dir = new THREE.Vector3(dx / d, 0, dz / d);
          G.effects.muzzle(muzzle, dir);
          G.audio.enemyShot();
          // Hit chance falls with distance; damage is tuned survivable.
          const hitP = Math.max(0.12, 0.55 - d * 0.008);
          if (Math.random() < hitP) G.player.damage(1, e.x, e.z); // 1: Vultures chip, they do not melt the player — the fight is about aim, not attrition
        }
      }
      // Write the enemy meshes.
      dummy.position.set(e.x, 0, e.z);
      dummy.rotation.set(0, -e.heading, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      bodyMesh.setMatrixAt(e.slot, dummy.matrix);
      headMesh.setMatrixAt(e.slot, dummy.matrix);
      bandMesh.setMatrixAt(e.slot, dummy.matrix);
    }
    bodyMesh.instanceMatrix.needsUpdate = true;
    headMesh.instanceMatrix.needsUpdate = true;
    bandMesh.instanceMatrix.needsUpdate = true;

    // Pickups: bob, spin, collect on proximity.
    for (const pk of [...pickups]) {
      const bobY = 0.9 + Math.sin(G.time * 2 + pk.bob) * 0.18;
      dummy.position.set(pk.x, bobY, pk.z);
      dummy.rotation.set(0, G.time * 1.2 + pk.bob, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      pickMesh.setMatrixAt(pk.slot, dummy.matrix);
      if (Math.hypot(pk.x - p.x, pk.z - p.z) < 1.6 && p.y < 2) {
        if (pk.kind === 'health') { G.player.heal(30); G.hud.announce('+30 health', 1200); }
        else { const w2 = G.player.p.weapons[G.player.p.weapon]; if (w2) w2.ammo = WEAPONS[G.player.p.weapon].mag; G.hud.announce('Ammo restocked', 1200); }
        G.audio.pickup();
        pickMesh.setMatrixAt(pk.slot, hide);
        freePick.push(pk.slot);
        pickups.splice(pickups.indexOf(pk), 1);
      }
    }
    pickMesh.instanceMatrix.needsUpdate = true;
    if (pickMesh.instanceColor) pickMesh.instanceColor.needsUpdate = true;
  }

  return { update, spawnEnemy, clearEnemies, killEnemy, spawnPickup, aliveCount, enemies };
}
