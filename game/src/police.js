// Police: five stars of heat. Patrol cruisers pursue along the grid,
// ram and bust a stopped player, roadblocks rise at three stars and a
// helicopter circles at four. Heat fades when the player hides.
// Bust has grace: 12 s after a vault hold, 4 s after stepping out.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makeVehicle, steerToward, removeVehicle } from './vehicles.js';
import { clamp, dist } from './random.js';
import { damagePlayer } from './player.js';

export function createPolice(G) {
  const P = {
    wanted: 0, cops: [], heli: null, heliAngle: 0,
    roadblocks: [], decayTimer: 0, bustTimer: 0, sirenOn: false,
  };
  G.police = P;

  P.setWanted = function (n) {
    P.wanted = clamp(n, 0, 5);
    P.syncCops();
  };
  P.addWanted = function (n) { P.setWanted(P.wanted + n); };

  P.syncCops = function () {
    // Desired cruisers on scene: 0,1,2,3,4,5 by stars.
    const want = P.wanted;
    while (P.cops.length < want) {
      const px = G.player.x, pz = G.player.z;
      const a = Math.random() * Math.PI * 2;
      const v = makeVehicle(G, 'interceptor', px + Math.cos(a) * 60, pz + Math.sin(a) * 60,
        Math.random() * Math.PI * 2, 'police');
      v.driver = 'npc'; v.cruise = 0;
      P.cops.push(v);
    }
    while (P.cops.length > want) {
      const v = P.cops.pop();
      removeVehicle(G, v);
    }
    // Roadblocks at 3+ stars: two cruisers parked across the road ahead.
    if (P.wanted >= 3 && P.roadblocks.length === 0) {
      const h = G.player.heading || 0;
      for (const side of [-1, 1]) {
        const bx = G.player.x + Math.cos(h) * 70 + Math.cos(h + Math.PI / 2) * side * 4;
        const bz = G.player.z + Math.sin(h) * 70 + Math.sin(h + Math.PI / 2) * side * 4;
        const v = makeVehicle(G, 'interceptor', bx, bz, h + Math.PI / 2, 'police');
        v.driver = null; v.kind = 'parked';
        P.roadblocks.push(v);
      }
    }
    if (P.wanted < 3) {
      for (const v of P.roadblocks) removeVehicle(G, v);
      P.roadblocks = [];
    }
    // Helicopter at 4+ stars.
    if (P.wanted >= 4 && !P.heli) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(4, 1.4, 2),
        new THREE.MeshLambertMaterial({ color: 0x222222 }));
      const tail = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 0.5),
        new THREE.MeshLambertMaterial({ color: 0x222222 }));
      tail.position.x = -3;
      const rotor = new THREE.Mesh(new THREE.BoxGeometry(7, 0.1, 0.4),
        new THREE.MeshLambertMaterial({ color: 0x888888 }));
      rotor.position.y = 1;
      const spot = new THREE.SpotLight(0xffffff, 200, 60, 0.3, 0.5);
      spot.position.y = -1;
      g.add(body, tail, rotor, spot);
      g.userData.rotor = rotor; g.userData.spot = spot;
      G.scene.add(g);
      P.heli = g;
    }
    if (P.wanted < 4 && P.heli) {
      G.scene.remove(P.heli);
      P.heli = null;
    }
  };

  P.step = function (dt) {
    const Pl = G.player;
    // Siren while wanted.
    const siren = P.wanted > 0;
    if (siren !== P.sirenOn) { P.sirenOn = siren; G.audio.setSiren(siren); }
    // Heat fades when the player is slow and out of sight of cops.
    if (P.wanted > 0) {
      P.decayTimer += dt;
      const nearCop = P.cops.some((c) => dist(c.x, c.z, Pl.x, Pl.z) < 45);
      const speed = Math.abs(Pl.speed || 0);
      if (!nearCop && speed < 3 && P.decayTimer > 14) {
        P.decayTimer = 0;
        P.setWanted(P.wanted - 1);
        G.hud.toast('Heat fading…');
      }
    }
    // Pursuit: cruisers chase the player along the grid, ramming.
    for (const c of P.cops) {
      if (c.dead) continue;
      const d = dist(c.x, c.z, Pl.x, Pl.z);
      const want = Math.atan2(Pl.z - c.z, Pl.x - c.x);
      // Manhattan steering: prefer the axis with the bigger gap.
      const dx = Pl.x - c.x, dz = Pl.z - c.z;
      let target = want;
      if (Math.abs(dx) > Math.abs(dz) * 1.3) target = dx > 0 ? 0 : Math.PI;
      else if (Math.abs(dz) > Math.abs(dx) * 1.3) target = dz > 0 ? Math.PI / 2 : -Math.PI / 2;
      const turn = clamp(((target - c.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -2.2, 2.2);
      c.heading += turn * dt;
      const top = 34 + P.wanted * 2;
      c.speed += ((d > 12 ? top : top * 0.55) - c.speed) * Math.min(1, dt * 1.2);
      let nx = c.x + Math.cos(c.heading) * c.speed * dt;
      let nz = c.z + Math.sin(c.heading) * c.speed * dt;
      if (G.city.blocked(nx, nz, 1.6)) {
        // Reverse out and re-aim (unstuck).
        c.heading += Math.PI * 0.9;
        c.speed = 6;
        nx = c.x; nz = c.z;
      }
      c.x = clamp(nx, -285, 285); c.z = clamp(nz, -285, 285);
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = -c.heading;
      // Ram: bump the player's car, or bust a stopped player.
      // On foot any stop near a cop counts; in a car the player must
      // be nearly stopped (cops pull you out of a stalled car).
      if (d < 4.5 && Pl.vehicle) {
        Pl.vehicle.speed *= 0.85;
        G.cameraRig.shake = 0.4;
        if (Math.random() < dt * 2) G.audio.crash();
      }
      const stopped = !Pl.vehicle || Math.abs(Pl.vehicle.speed) < 1.5;
      if (d < 3.5 && stopped && Pl.bustGrace <= 0 && Pl.exitGrace <= 0 && Pl.vaultGrace <= 0) {
        P.bustTimer += dt;
        if (P.bustTimer > 2.2) {
          P.bustTimer = 0;
          G.state = 'busted';
          G.audio.busted();
          G.hud.showBanner('BUSTED');
          setTimeout(() => G.hud.respawn(), 1800);
        }
      } else if (d >= 3.5) P.bustTimer = Math.max(0, P.bustTimer - dt * 2);
    }
    // Helicopter circles overhead, spotlight on the player.
    if (P.heli) {
      P.heliAngle += dt * 0.5;
      const hx = Pl.x + Math.cos(P.heliAngle) * 26;
      const hz = Pl.z + Math.sin(P.heliAngle) * 26;
      P.heli.position.set(hx, 42, hz);
      P.heli.userData.rotor.rotation.y += dt * 20;
      P.heli.userData.spot.target.position.set(Pl.x, 0, Pl.z);
      P.heli.userData.spot.target.updateMatrixWorld();
    }
  };
  return P;
}
