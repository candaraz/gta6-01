// Combat: fists, a pistol and an SMG, the Marsh crew goons who fight back,
// and the pickups they drop. Shooting is a hitscan check down the aim line
// with a spread that grows with distance; melee is a short arc in front of
// the player. Goons chase, strafe and shoot back until they drop.

import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { buildPersonMesh } from './pedestrians.js';

export function createCombat(scene, city, effects, audio) {
  const goons = [];
  const pickups = [];
  let cooldown = 0;
  let muzzleTimer = 0;

  const pickupGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const healthMat = new THREE.MeshLambertMaterial({ color: 0x2ecc71, emissive: 0x1a7a44, emissiveIntensity: 0.8 });
  const ammoMat = new THREE.MeshLambertMaterial({ color: 0xe8a81c, emissive: 0x8a5a00, emissiveIntensity: 0.8 });
  const cashMat = new THREE.MeshLambertMaterial({ color: 0x2e8a5a, emissive: 0x145a30, emissiveIntensity: 0.8 });

  function spawnGoon(x, z, rng) {
    const { group, limbs } = buildPersonMesh(0x22222a, 0x33333c, rng.pick([0xe8b98a, 0xc98d5e, 0x8a5a3a]), 1.08);
    group.position.set(x, 0, z);
    // A red cap marks the Marsh crew.
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.46), new THREE.MeshLambertMaterial({ color: 0xc22e2e }));
    cap.position.y = 2.08;
    group.add(cap);
    // The gun in his hand.
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.42), new THREE.MeshLambertMaterial({ color: 0x1a1a1c }));
    gun.position.set(0.42, 1.35, 0.3);
    group.add(gun);
    scene.add(group);
    const goon = {
      mesh: group,
      limbs,
      x,
      z,
      heading: Math.atan2(0 - x, 0 - z),
      health: 55,
      speed: 0,
      walkPhase: 0,
      shootTimer: rng.range(0.6, 1.6),
      strafeDir: rng.chance(0.5) ? 1 : -1,
      strafeTimer: rng.range(1, 3),
      dead: false,
      deadTimer: 0,
      alerted: false,
    };
    goons.push(goon);
    return goon;
  }

  function spawnPickup(kind, x, z) {
    const mat = kind === 'health' ? healthMat : kind === 'ammo' ? ammoMat : cashMat;
    const mesh = new THREE.Mesh(pickupGeo, mat);
    mesh.position.set(x, 0.7, z);
    mesh.rotation.y = Math.PI / 4;
    scene.add(mesh);
    pickups.push({ kind, mesh, x, z, bob: Math.random() * Math.PI * 2, life: 45 });
  }

  // A shot from (x, z) along heading: the first goon, ped or police target
  // inside a narrow cone and the weapon's range takes the damage.
  function shoot(shooter, weaponId, targets, onHit) {
    const weapon = WEAPONS[weaponId];
    if (cooldown > 0) return false;
    cooldown = weapon.rate;
    effects.muzzle(shooter.x, shooter.y || 0, shooter.z, shooter.heading);
    audio.shot(weaponId === 'smg');
    muzzleTimer = 0.06;
    let best = null;
    let bestDist = weapon.range;
    for (const target of targets) {
      if (target.dead || target.down) continue;
      const dx = target.x - shooter.x;
      const dz = target.z - shooter.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > weapon.range || dist < 0.5) continue;
      const angle = Math.atan2(dx, dz);
      let diff = angle - shooter.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const spread = 0.06 + dist * 0.004;
      if (Math.abs(diff) > spread + 0.1) continue;
      if (dist < bestDist) {
        bestDist = dist;
        best = target;
      }
    }
    if (best) {
      const damage = weapon.damage * (bestDist > 30 ? 0.7 : 1);
      onHit(best, damage);
      effects.blood(best.x, 0, best.z);
    } else {
      // A miss still kicks up dust where the shot lands.
      const endX = shooter.x + Math.sin(shooter.heading) * Math.min(weapon.range, 30);
      const endZ = shooter.z + Math.cos(shooter.heading) * Math.min(weapon.range, 30);
      effects.dust(endX, 0, endZ);
    }
    return true;
  }

  function melee(shooter, targets, onHit) {
    const weapon = WEAPONS.fists;
    let hitAny = false;
    for (const target of targets) {
      if (target.dead || target.down) continue;
      const dx = target.x - shooter.x;
      const dz = target.z - shooter.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > weapon.range) continue;
      const angle = Math.atan2(dx, dz);
      let diff = angle - shooter.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > 0.9) continue;
      onHit(target, weapon.damage);
      effects.blood(target.x, 0, target.z);
      hitAny = true;
    }
    if (hitAny) audio.punch();
    return hitAny;
  }

  function updateGoons(dt, player, rng, onGoonShot, onGoonDown) {
    for (const goon of goons) {
      if (goon.dead) {
        goon.deadTimer -= dt;
        goon.mesh.rotation.z = Math.min(Math.PI / 2, goon.mesh.rotation.z + dt * 5);
        goon.mesh.position.y = Math.max(-0.2, goon.mesh.position.y - dt * 0.2);
        if (goon.deadTimer <= 0) {
          scene.remove(goon.mesh);
          goons.splice(goons.indexOf(goon), 1);
        }
        continue;
      }
      const dx = player.x - goon.x;
      const dz = player.z - goon.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (!goon.alerted && dist < 34) goon.alerted = true;
      if (!goon.alerted) {
        goon.speed = 0;
      } else {
        const wantHeading = Math.atan2(dx, dz);
        let diff = wantHeading - goon.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        goon.heading += Math.max(-4 * dt, Math.min(4 * dt, diff));
        goon.strafeTimer -= dt;
        if (goon.strafeTimer <= 0) {
          goon.strafeDir *= -1;
          goon.strafeTimer = rng.range(1, 2.5);
        }
        // Keep 9 to 16 metres: advance when far, strafe when close.
        let moveX = 0;
        let moveZ = 0;
        if (dist > 16) {
          moveX = Math.sin(goon.heading);
          moveZ = Math.cos(goon.heading);
          goon.speed = 4.6;
        } else if (dist < 8) {
          moveX = -Math.sin(goon.heading);
          moveZ = -Math.cos(goon.heading);
          goon.speed = 3;
        } else {
          moveX = Math.cos(goon.heading) * goon.strafeDir;
          moveZ = -Math.sin(goon.heading) * goon.strafeDir;
          goon.speed = 2.2;
        }
        const nx = goon.x + moveX * goon.speed * dt;
        const nz = goon.z + moveZ * goon.speed * dt;
        const resolved = city.resolveCollision(nx, nz, 0.55);
        goon.x = resolved.x;
        goon.z = resolved.z;
        goon.shootTimer -= dt;
        if (goon.shootTimer <= 0 && dist < 30 && Math.abs(diff) < 0.4) {
          goon.shootTimer = rng.range(0.9, 1.7);
          onGoonShot(goon, dist);
        }
      }
      goon.mesh.position.set(goon.x, 0, goon.z);
      goon.mesh.rotation.y = goon.heading;
      goon.walkPhase += goon.speed * dt * 3.2;
      const swing = Math.sin(goon.walkPhase) * Math.min(0.7, goon.speed * 0.13);
      goon.limbs.legL.rotation.x = swing;
      goon.limbs.legR.rotation.x = -swing;
      goon.limbs.armR.rotation.x = goon.alerted ? -1.45 : -swing * 0.8;
      goon.limbs.armL.rotation.x = goon.alerted ? -0.4 : swing * 0.8;
    }
    cooldown = Math.max(0, cooldown - dt);
    muzzleTimer = Math.max(0, muzzleTimer - dt);
  }

  function updatePickups(dt, player, onCollect) {
    for (const pickup of pickups) {
      pickup.life -= dt;
      pickup.bob += dt * 2.4;
      pickup.mesh.position.y = 0.7 + Math.sin(pickup.bob) * 0.15;
      pickup.mesh.rotation.y += dt * 1.6;
      const dx = player.x - pickup.x;
      const dz = player.z - pickup.z;
      if (dx * dx + dz * dz < 1.6 * 1.6) {
        onCollect(pickup.kind);
        scene.remove(pickup.mesh);
        pickups.splice(pickups.indexOf(pickup), 1);
        continue;
      }
      if (pickup.life <= 0) {
        scene.remove(pickup.mesh);
        pickups.splice(pickups.indexOf(pickup), 1);
      }
    }
  }

  return {
    goons,
    pickups,
    spawnGoon,
    spawnPickup,
    shoot,
    melee,
    updateGoons,
    updatePickups,
    damageGoon(goon, damage, onGoonDown) {
      goon.health -= damage;
      goon.alerted = true;
      if (goon.health <= 0 && !goon.dead) {
        goon.dead = true;
        goon.deadTimer = 5;
        if (onGoonDown) onGoonDown(goon);
      }
    },
    clearGoons() {
      for (const goon of goons) scene.remove(goon.mesh);
      goons.length = 0;
    },
    resetCooldown() {
      cooldown = 0;
    },
  };
}
