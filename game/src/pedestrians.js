// pedestrians.js — Solmar Bay v3: the people on the sidewalks.
// One job: keep the sidewalks alive with walkers who stroll, and run
// when things get loud (gunshots, explosions, a car bearing down).
//
// Peds are two instanced meshes (body + head), so 40 walkers cost 2 draws.

import * as THREE from 'three';
import { AVENUES } from './config.js';
import { makeRng, pick } from './random.js';

const POOL = 44;

export function createPedestrians(scene, city) {
  const dummy = new THREE.Object3D();
  const bodyGeo = new THREE.BoxGeometry(0.52, 1.15, 0.32);
  bodyGeo.translate(0, 0.95, 0);
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const bodyMesh = new THREE.InstancedMesh(bodyGeo, bodyMat, POOL);
  const headGeo = new THREE.SphereGeometry(0.21, 8, 6);
  headGeo.translate(0, 1.72, 0);
  const headMat = new THREE.MeshLambertMaterial({ color: 0xd8a878 });
  const headMesh = new THREE.InstancedMesh(headGeo, headMat, POOL);
  [bodyMesh, headMesh].forEach((m) => {
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    scene.add(m);
  });
  bodyMesh.castShadow = true;
  const hide = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < POOL; i++) { bodyMesh.setMatrixAt(i, hide); headMesh.setMatrixAt(i, hide); }

  const rng = makeRng(777);
  const shirts = [0xd83a2a, 0x2a5ad8, 0x2a8a4a, 0xe8c93a, 0x7a3a8a, 0xe8e4da, 0x3a3a3e, 0xe88a2a];
  const skins = [0xd8a878, 0xb98a5e, 0x8a5e3a, 0xe8c098];
  const peds = [];
  const freeSlots = [];
  for (let i = POOL - 1; i >= 0; i--) freeSlots.push(i);

  function spawn(x, z) {
    if (!freeSlots.length) return null;
    const slot = freeSlots.pop();
    const ped = {
      slot, x, z, heading: rng() * Math.PI * 2,
      speed: 1.2 + rng() * 0.7, axis: 'x', dir: 1, ave: 0,
      flee: 0, fx: 0, fz: 0, bob: rng() * 6,
    };
    // Walk a sidewalk: pick an avenue and a side.
    ped.ave = pick(rng, AVENUES);
    ped.axis = rng() < 0.5 ? 'x' : 'z';
    ped.dir = rng() < 0.5 ? 1 : -1;
    const side = rng() < 0.5 ? 7 : -7;
    if (ped.axis === 'x') { ped.x = (rng() - 0.5) * 560; ped.z = ped.ave + side; }
    else { ped.x = ped.ave + side; ped.z = (rng() - 0.5) * 560; }
    ped.heading = ped.axis === 'x' ? (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (ped.dir > 0 ? 0 : Math.PI);
    bodyMesh.setColorAt(slot, new THREE.Color(pick(rng, shirts)));
    headMesh.setColorAt(slot, new THREE.Color(pick(rng, skins)));
    peds.push(ped);
    return ped;
  }

  function scare(x, z, radius) {
    for (const p of peds) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < radius) {
        p.flee = 2.5 + Math.random() * 2;
        const a = Math.atan2(p.x - x, p.z - z);
        p.fx = Math.sin(a); p.fz = Math.cos(a);
      }
    }
  }

  function update(dt, time, px, pz) {
    // Keep ~34 walkers near the player.
    let n = 0;
    for (const p of [...peds]) {
      if (Math.hypot(p.x - px, p.z - pz) > 280) {
        bodyMesh.setMatrixAt(p.slot, hide); headMesh.setMatrixAt(p.slot, hide);
        freeSlots.push(p.slot);
        peds.splice(peds.indexOf(p), 1);
      } else n++;
    }
    while (n < 34) { if (!spawn(px, pz)) break; n++; }

    for (const p of peds) {
      if (p.flee > 0) {
        p.flee -= dt;
        p.heading = Math.atan2(p.fx, p.fz);
        p.x += p.fx * 4.2 * dt;
        p.z += p.fz * 4.2 * dt;
      } else {
        // Stroll the sidewalk; turn at the world edge or at random.
        const step = p.speed * dt;
        if (p.axis === 'x') {
          p.x += p.dir * step;
          if (Math.abs(p.x) > 300 || rng() < dt * 0.02) { p.dir *= -1; p.heading += Math.PI; }
        } else {
          p.z += p.dir * step;
          if (Math.abs(p.z) > 300 || rng() < dt * 0.02) { p.dir *= -1; p.heading += Math.PI; }
        }
        p.heading = p.axis === 'x' ? (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (p.dir > 0 ? 0 : Math.PI);
      }
      // Stay out of buildings and on the map.
      const pos = { x: p.x, z: p.z };
      city.collideCircle(pos, 0.5);
      p.x = pos.x; p.z = pos.z;
      const bobY = Math.abs(Math.sin(time * 6 + p.bob)) * 0.06;
      dummy.position.set(p.x, bobY, p.z);
      dummy.rotation.set(0, -p.heading, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      bodyMesh.setMatrixAt(p.slot, dummy.matrix);
      headMesh.setMatrixAt(p.slot, dummy.matrix);
    }
    bodyMesh.instanceMatrix.needsUpdate = true;
    headMesh.instanceMatrix.needsUpdate = true;
    if (bodyMesh.instanceColor) bodyMesh.instanceColor.needsUpdate = true;
    if (headMesh.instanceColor) headMesh.instanceColor.needsUpdate = true;
  }

  return { update, scare, peds };
}
