// Pedestrians: simple blocky people strolling the sidewalks.
// They run when shots ring out nearby.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makeRng, pick, range, rangeInt, clamp, dist } from './random.js';

const SHIRTS = [0x2e7d32, 0xd32f2f, 0x1565c0, 0xf2b705, 0x7b1fa2, 0xe8e8e8, 0xff8f00, 0x00838f];

export function initPedestrians(G) {
  const rng = makeRng(G.seed + 202);
  G.peds = [];
  const B = CFG.block;
  for (let i = 0; i < 44; i++) {
    const x = rangeInt(rng, -5, 5) * B + (rng() < 0.5 ? 9 : -9);
    const z = rangeInt(rng, -5, 5) * B + range(rng, -20, 20);
    if (x > CFG.beachX - 10) continue;
    const g = new THREE.Group();
    const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.4),
      new THREE.MeshLambertMaterial({ color: pick(rng, SHIRTS) }));
    shirt.position.y = 1.05; shirt.castShadow = true;
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.35),
      new THREE.MeshLambertMaterial({ color: 0x22222e }));
    legs.position.y = 0.35;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6),
      new THREE.MeshLambertMaterial({ color: pick(rng, [0xe8b88a, 0xc98a5a, 0x8a5a3a, 0xf0c8a0]) }));
    head.position.y = 1.75;
    g.add(shirt, legs, head);
    g.position.set(x, 0, z);
    G.scene.add(g);
    G.peds.push({
      mesh: g, x, z, heading: rng() * Math.PI * 2,
      speed: range(rng, 1.2, 2.2), flee: 0, walkPhase: rng() * 10,
      legSwing: 0,
    });
  }
}

export function stepPedestrians(G, dt) {
  const px = G.player.x, pz = G.player.z;
  for (const p of G.peds) {
    // Flee gunfire and the player's car.
    const d = dist(p.x, p.z, px, pz);
    if (G.combat.shotsFiredRecently > 0 && d < 30) p.flee = 2.5;
    if (G.player.vehicle && d < 8) p.flee = 1.5;
    if (p.flee > 0) {
      p.flee -= dt;
      const away = Math.atan2(p.z - pz, p.x - px);
      p.heading = away;
      p.speed = 5;
    } else {
      p.speed = 1.6;
      // Wander: keep to sidewalks, turn at intersections.
      const B = CFG.block;
      const onX = Math.abs(p.x / B - Math.round(p.x / B)) * B < 10;
      const onZ = Math.abs(p.z / B - Math.round(p.z / B)) * B < 10;
      if (onX && onZ && Math.random() < dt * 0.5) p.heading += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
    }
    let nx = p.x + Math.cos(p.heading) * p.speed * dt;
    let nz = p.z + Math.sin(p.heading) * p.speed * dt;
    if (G.city.blocked(nx, nz, 0.6)) {
      p.heading += Math.PI / 2;
      nx = p.x; nz = p.z;
    }
    p.x = clamp(nx, -285, 285); p.z = clamp(nz, -285, 285);
    p.walkPhase += dt * p.speed * 2;
    p.mesh.position.set(p.x, Math.abs(Math.sin(p.walkPhase)) * 0.06, p.z);
    p.mesh.rotation.y = -p.heading;
  }
}
