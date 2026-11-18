// The people of Solmar Bay: walkers on the sidewalks who stroll between
// corners, chat in place, and run when things get loud. A pedestrian is a
// small jointed figure built from boxes, animated by swinging its limbs.

import * as THREE from 'three';
import { WORLD } from './config.js';

const PED_COUNT = 24;
const SKIN = [0xe8b98a, 0xc98d5e, 0x8a5a3a, 0xf0cfa8, 0x6e4530];
const SHIRTS = [0xd94a4a, 0x4a7ad9, 0x4ad97a, 0xd9c24a, 0x9a4ad9, 0xe8e4da, 0x3a3a44, 0xe87a3a];
const PANTS = [0x3a4a6e, 0x2e2e34, 0x6e5a3a, 0x4a4a52];

export function buildPersonMesh(shirt, pants, skin, scale = 1) {
  const group = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.34), shirtMat);
  torso.position.y = 1.18;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.44, 0.42), skinMat);
  head.position.y = 1.82;
  head.castShadow = true;
  group.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.44), new THREE.MeshLambertMaterial({ color: 0x2a2018 }));
  hair.position.y = 2.06;
  group.add(hair);
  const limbs = {};
  for (const [name, x, y, mat, w, h] of [
    ['armL', -0.42, 1.5, shirtMat, 0.18, 0.7],
    ['armR', 0.42, 1.5, shirtMat, 0.18, 0.7],
    ['legL', -0.17, 0.78, pantsMat, 0.22, 0.78],
    ['legR', 0.17, 0.78, pantsMat, 0.22, 0.78],
  ]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const limb = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat);
    limb.position.y = -h / 2;
    limb.castShadow = true;
    pivot.add(limb);
    group.add(pivot);
    limbs[name] = pivot;
  }
  group.scale.setScalar(scale);
  return { group, limbs };
}

export function createPedestrians(scene, city, rng) {
  const peds = [];

  function randomSidewalkSpot(farFrom) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const vertical = rng.chance(0.5);
      const line = rng.pick(WORLD.roadLines);
      const along = rng.range(-195, 195);
      const side = rng.chance(0.5) ? 1 : -1;
      const offset = (WORLD.roadHalf + 2) * side;
      const x = vertical ? line + offset : along;
      const z = vertical ? along : line + offset;
      if (farFrom) {
        const dx = x - farFrom.x;
        const dz = z - farFrom.z;
        if (dx * dx + dz * dz < 20 * 20) continue;
      }
      return { x, z };
    }
    return { x: 20, z: 20 };
  }

  function spawnPed(farFrom) {
    const spot = randomSidewalkSpot(farFrom);
    const { group, limbs } = buildPersonMesh(rng.pick(SHIRTS), rng.pick(PANTS), rng.pick(SKIN));
    group.position.set(spot.x, 0, spot.z);
    scene.add(group);
    const ped = {
      mesh: group,
      limbs,
      x: spot.x,
      z: spot.z,
      heading: rng.range(0, Math.PI * 2),
      speed: 0,
      walkPhase: rng.range(0, Math.PI * 2),
      state: 'walk',
      target: randomSidewalkSpot(null),
      idleTimer: rng.range(0, 6),
      fleeTimer: 0,
      down: false,
      downTimer: 0,
    };
    peds.push(ped);
    return ped;
  }

  function update(dt, playerPos, danger, cityRef) {
    for (const ped of peds) {
      if (ped.down) {
        ped.downTimer -= dt;
        ped.mesh.rotation.z = Math.min(Math.PI / 2, ped.mesh.rotation.z + dt * 4);
        if (ped.downTimer <= 0) {
          scene.remove(ped.mesh);
          peds.splice(peds.indexOf(ped), 1);
        }
        continue;
      }
      // Danger nearby: run away from it.
      const dxDanger = ped.x - danger.x;
      const dzDanger = ped.z - danger.z;
      const dangerDist = Math.sqrt(dxDanger * dxDanger + dzDanger * dzDanger);
      if (danger.level > 0 && dangerDist < 30) {
        ped.state = 'flee';
        ped.fleeTimer = 3;
        ped.target = { x: ped.x + (dxDanger / (dangerDist || 1)) * 40, z: ped.z + (dzDanger / (dangerDist || 1)) * 40 };
      }
      if (ped.state === 'flee') {
        ped.fleeTimer -= dt;
        if (ped.fleeTimer <= 0) ped.state = 'walk';
      }
      if (ped.state === 'idle') {
        ped.idleTimer -= dt;
        ped.speed = 0;
        if (ped.idleTimer <= 0) {
          ped.state = 'walk';
          ped.target = randomSidewalkSpot(null);
        }
      } else {
        const tx = ped.target.x - ped.x;
        const tz = ped.target.z - ped.z;
        const dist = Math.sqrt(tx * tx + tz * tz);
        if (dist < 2) {
          if (ped.state === 'flee') {
            ped.state = 'walk';
            ped.target = randomSidewalkSpot(null);
          } else if (rng.chance(0.3)) {
            ped.state = 'idle';
            ped.idleTimer = rng.range(2, 7);
          } else {
            ped.target = randomSidewalkSpot(null);
          }
        } else {
          const wantHeading = Math.atan2(tx, tz);
          let diff = wantHeading - ped.heading;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          ped.heading += Math.max(-3 * dt, Math.min(3 * dt, diff));
          const targetSpeed = ped.state === 'flee' ? 6.5 : 1.6;
          ped.speed += (targetSpeed - ped.speed) * Math.min(1, dt * 4);
        }
      }
      const nx = ped.x + Math.sin(ped.heading) * ped.speed * dt;
      const nz = ped.z + Math.cos(ped.heading) * ped.speed * dt;
      const resolved = cityRef.resolveCollision(nx, nz, 0.5);
      ped.x = resolved.x;
      ped.z = resolved.z;
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
      // Walk cycle: opposite arms and legs swing.
      ped.walkPhase += ped.speed * dt * 3.4;
      const swing = Math.sin(ped.walkPhase) * Math.min(0.7, ped.speed * 0.14);
      ped.limbs.legL.rotation.x = swing;
      ped.limbs.legR.rotation.x = -swing;
      ped.limbs.armL.rotation.x = -swing * 0.8;
      ped.limbs.armR.rotation.x = swing * 0.8;
      // Respawn far-away peds near the player so the streets stay populated.
      const pdx = ped.x - playerPos.x;
      const pdz = ped.z - playerPos.z;
      if (pdx * pdx + pdz * pdz > 190 * 190) {
        scene.remove(ped.mesh);
        peds.splice(peds.indexOf(ped), 1);
      }
    }
    while (peds.length < PED_COUNT) spawnPed(playerPos);
  }

  return {
    peds,
    spawnInitial(playerPos) {
      while (peds.length < PED_COUNT) spawnPed(playerPos);
    },
    update,
    nearest(x, z, maxDist) {
      let best = null;
      let bestDist = maxDist;
      for (const ped of peds) {
        if (ped.down) continue;
        const dx = ped.x - x;
        const dz = ped.z - z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < bestDist) {
          bestDist = dist;
          best = ped;
        }
      }
      return best;
    },
    knockDown(ped) {
      ped.down = true;
      ped.downTimer = 6;
      ped.speed = 0;
    },
  };
}
