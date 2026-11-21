// police.js — Solmar Bay v3: the wanted level and the Solmar PD.
// One job: stars, pursuit, roadblocks, the helicopter, busts, and decay.
//
// Cops steer along the road grid (Manhattan) toward the player, never
// straight through buildings — the v2 fix — and reverse out when pinned.

import * as THREE from 'three';
import { TUNE } from './config.js';
import { makeRng, pick } from './random.js';

export function createPolice(G) {
  const scene = G.scene;
  const rng = makeRng(31337);
  let stars = 0;
  let hiddenTimer = 0;
  let roadblockTimer = 0;
  const cops = []; // {car, stuckT, reverseT}
  let heli = null; // {group, rotor, angle}

  function addStars(n) {
    stars = Math.min(5, stars + n);
    if (stars > 0) hiddenTimer = 0;
    G.hud.setStars(stars);
  }
  function setStars(n) {
    stars = Math.max(0, Math.min(5, n));
    G.hud.setStars(stars);
  }
  function nearestCopDist(x, z) {
    let bd = 1e9;
    for (const c of cops) bd = Math.min(bd, Math.hypot(c.car.x - x, c.car.z - z));
    return bd;
  }

  function spawnCopNear(x, z, dist) {
    // Spawn on a road near the player, at the requested distance.
    for (let tries = 0; tries < 12; tries++) {
      const a = rng() * Math.PI * 2;
      const cx = x + Math.cos(a) * dist, cz = z + Math.sin(a) * dist;
      const rp = G.city.nearestRoadPoint(cx, cz);
      if (!rp) continue;
      const car = G.vehicles.spawnCar('interceptor', rp.x, rp.z, 0, 'police');
      if (!car) return null;
      car.heading = rp.along === 'x' ? Math.PI / 2 : 0;
      const cop = { car, stuckT: 0, reverseT: 0, lastX: rp.x, lastZ: rp.z, staged: false, cruiseSpeed: 0 };
      cops.push(cop);
      return cop;
    }
    return null;
  }

  function spawnRoadblock() {
    const p = G.player.p;
    // Two cruisers parked across the road ahead of the player.
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    const bx = p.x + fx * 55, bz = p.z + fz * 55;
    const rp = G.city.nearestRoadPoint(bx, bz);
    if (!rp) return;
    for (const side of [-1, 1]) {
      const car = G.vehicles.spawnCar('interceptor', rp.x + (rp.along === 'x' ? side * 2.4 : 0), rp.z + (rp.along === 'x' ? 0 : side * 2.4), rp.along === 'x' ? Math.PI / 2 : 0, 'police');
      if (car) { car.roadblock = true; cops.push({ car, stuckT: 0, reverseT: 0, lastX: car.x, lastZ: car.z }); }
    }
  }

  function buildHeli() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 5.2), new THREE.MeshLambertMaterial({ color: 0x1a1d24 }));
    g.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 4.4), new THREE.MeshLambertMaterial({ color: 0x1a1d24 }));
    tail.position.set(0, 0.2, -4.2); g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.7), new THREE.MeshLambertMaterial({ color: 0x3a3a3e }));
    rotor.position.y = 1.1; g.add(rotor);
    const skid = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.2, 3.4), new THREE.MeshLambertMaterial({ color: 0x3a3a3e }));
    skid.position.y = -1.1; g.add(skid);
    // Searchlight cone pointing down.
    const coneGeo = new THREE.ConeGeometry(7, 42, 12, 1, true);
    coneGeo.translate(0, -21, 0);
    const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
    cone.position.y = -1; g.add(cone);
    g.visible = false;
    scene.add(g);
    return { group: g, rotor, angle: 0 };
  }

  function angleDiff(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function update(dt) {
    const p = G.player.p;
    // Wanted decay: hidden (no cop within 55 m) for 9 s loses a star.
    if (stars > 0) {
      const near = nearestCopDist(p.x, p.z);
      if (near > 55 && !heli) {
        hiddenTimer += dt;
        if (hiddenTimer > TUNE.wantedDecayHidden) { setStars(stars - 1); hiddenTimer = 0; }
      } else hiddenTimer = 0;
    }
    // Keep the right number of pursuit cops on the road.
    const want = stars === 0 ? 0 : Math.min(6, stars + 1);
    let active = 0;
    for (const c of [...cops]) {
      if (!c.car.alive) { cops.splice(cops.indexOf(c), 1); continue; }
      active++;
    }
    while (active < want) {
      if (!spawnCopNear(p.x, p.z, 55 + rng() * 40)) break;
      active++;
    }
    // Roadblocks at 3+ stars, one every ~25 s.
    if (stars >= 3) {
      roadblockTimer -= dt;
      if (roadblockTimer <= 0) { spawnRoadblock(); roadblockTimer = 25; }
    }
    // Helicopter at 4+ stars.
    if (stars >= 4 && !heli) heli = buildHeli();
    if (heli) {
      heli.group.visible = stars >= 4;
      if (stars >= 4) {
        heli.angle += dt * 0.35;
        heli.group.position.set(p.x + Math.cos(heli.angle) * 34, 42, p.z + Math.sin(heli.angle) * 34);
        heli.group.rotation.y = -Math.atan2(p.x - heli.group.position.x, p.z - heli.group.position.z);
        heli.rotor.rotation.y += dt * 22;
      }
    }
    // Sirens: on with heat, louder when a cop is close.
    const near = nearestCopDist(p.x, p.z);
    G.audio.setSiren(stars > 0, Math.max(0, 1 - near / 110));
    G.audio.sirenTick(dt);

    // Drive each cop: Manhattan steering toward the player.
    for (const c of [...cops]) {
      const car = c.car;
      if (!car.alive) continue;
      if (car.roadblock) continue; // roadblock cars hold their post
      // Staged cops (screenshot poses) just cruise straight alongside at
      // their set speed — they never ram or bust, so the shot stays composed.
      if (c.staged) {
        const thr = car.speed < c.cruiseSpeed ? 1 : 0;
        G.vehicles.stepCar(car, dt, thr, 0, 0, G.time);
        continue;
      }
      const dx = p.x - car.x, dz = p.z - car.z;
      const dist = Math.hypot(dx, dz);
      // Target: first close the x gap along the current road, then the z gap.
      let tx, tz;
      if (Math.abs(dx) > 12) { tx = p.x; tz = car.z; }
      else { tx = car.x; tz = p.z; }
      const want = Math.atan2(tx - car.x, tz - car.z);
      let steer = Math.max(-1, Math.min(1, angleDiff(want, car.heading) * 1.8));
      // Ram when close: aim straight at the player.
      if (dist < 14) steer = Math.max(-1, Math.min(1, angleDiff(Math.atan2(dx, dz), car.heading) * 1.8));
      // Stuck detection: barely moving while trying -> reverse out.
      const moved = Math.hypot(car.x - c.lastX, car.z - c.lastZ);
      c.lastX = car.x; c.lastZ = car.z;
      if (c.reverseT > 0) {
        c.reverseT -= dt;
        G.vehicles.stepCar(car, dt, -1, -steer, 0, G.time);
        continue;
      }
      if (Math.abs(car.speed) < 1.5 && dist > 10) {
        c.stuckT += dt;
        if (c.stuckT > 2) { c.reverseT = 1.1; c.stuckT = 0; continue; }
      } else c.stuckT = 0;
      G.vehicles.stepCar(car, dt, 1, steer, 0, G.time);
      // Ram impact: a hard hit on the player's car shakes and sparks.
      if (dist < 4.4 && p.car && Math.abs(car.speed) > 8) {
        G.effects.sparks({ x: p.x, y: 1, z: p.z });
        G.audio.crash();
        G.effects.addShake(0.3);
        car.speed *= 0.5;
      }
      // Bust: on foot, a cop right on top of a slow player — but
      // never mid-vault-crack, in the getaway grace after one, or
      // in the 4 s grace after stepping out of a vehicle (see
      // missions.isHoldStage / isHoldGrace, player.isExitGrace).
      if (p.onFoot && dist < 2.6 && !p.dead && !G.missions.isHoldStage() && !G.missions.isHoldGrace() && !G.player.isExitGrace()) {
        G.setState('busted');
      }
    }
    // Clean up cops when the heat is gone.
    if (stars === 0) {
      for (const c of [...cops]) {
        G.vehicles.despawnCar(c.car);
        cops.splice(cops.indexOf(c), 1);
      }
    }
  }

  return { update, addStars, setStars, nearestCopDist, spawnCopNear, get stars() { return stars; }, cops };
}
