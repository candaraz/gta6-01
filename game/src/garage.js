// garage.js — Solmar Bay v3: the side economy.
// One job: everything that pays outside the story — garage engine upgrades,
// the gun shop, safehouses, street races (T in a car), taxi fares (T on
// foot), and the 20 hidden Bay Coins.

import * as THREE from 'three';
import { TUNE, AVENUES } from './config.js';
import { makeRng, pick } from './random.js';

const COIN_SPOTS = [
  [0, 232], [-72, -64], [48, -16], [-24, 40], [24, 32], [96, 88], [280, 152],
  [260, -32], [250, 12], [296, 8], [0, 288], [144, 288], [288, 144], [-168, 168],
  [168, -168], [-264, 72], [72, 216], [-96, -96], [96, -96], [-96, 96],
];

const RACE_CIRCUITS = [
  { name: 'Downtown Loop', pts: [[0, -48], [96, -48], [96, 48], [0, 48], [-48, 48], [-48, -48]], par: 75 },
  { name: 'Coast Run', pts: [[288, -96], [288, 96], [288, 240], [144, 288], [0, 288], [-48, 240]], par: 95 },
  { name: 'Yards Sprint', pts: [[-96, -240], [96, -240], [192, -240], [192, -144], [96, -144], [-96, -144]], par: 80 },
];

export function createGarage(G) {
  const scene = G.scene;
  const dummy = new THREE.Object3D();
  // Bay Coins: spinning gold discs.
  const coinGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.14, 14);
  coinGeo.rotateX(Math.PI / 2);
  const coinMat = new THREE.MeshBasicMaterial({ color: 0xffc21f });
  const coinMesh = new THREE.InstancedMesh(coinGeo, coinMat, COIN_SPOTS.length);
  coinMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  coinMesh.frustumCulled = false;
  scene.add(coinMesh);
  const hide = new THREE.Matrix4().makeScale(0, 0, 0);
  const coins = COIN_SPOTS.map(([x, z], i) => ({ x, z, taken: false, slot: i, bob: i * 1.3 }));
  // Race gate markers reuse the mission marker style: small gold diamonds.
  const gateGeo = new THREE.OctahedronGeometry(1.2);
  const gateMat = new THREE.MeshBasicMaterial({ color: 0xffc21f });
  const gateMesh = new THREE.InstancedMesh(gateGeo, gateMat, 8);
  gateMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  gateMesh.frustumCulled = false;
  scene.add(gateMesh);
  for (let i = 0; i < 8; i++) gateMesh.setMatrixAt(i, hide);

  const rng = makeRng(2026);
  let race = null;      // {circuit, idx, t}
  let fare = null;      // {stage, px, pz, dx, dz}
  let shopMsg = '';

  function near(x, z, r) {
    const p = G.player.p;
    return Math.hypot(p.x - x, p.z - z) < r;
  }

  function startRace() {
    const circuit = pick(rng, RACE_CIRCUITS);
    race = { circuit, idx: 0, t: 0 };
    G.hud.announce(`${circuit.name} — beat ${circuit.par}s for $${TUNE.raceReward.toLocaleString()}`, 3000);
    G.hud.dialogue('Ivy', `${circuit.name}. ${circuit.par} seconds. Do not embarrass me.`);
  }
  function startFare() {
    // A passenger waits at a nearby sidewalk; drive them across town.
    const p = G.player.p;
    const a = pick(rng, AVENUES);
    const px = a + 7, pz = p.z + (rng() < 0.5 ? -60 : 60);
    const dx = pick(rng, AVENUES) + 7, dz = pick(rng, [-240, -144, -48, 48, 144, 240]);
    fare = { stage: 'pickup', px, pz, dx, dz };
    G.hud.announce('Taxi fare: pick up the passenger', 2600);
  }

  function update(dt, input) {
    const p = G.player.p;
    // --- Bay Coins ---------------------------------------------------------
    for (const c of coins) {
      if (c.taken) continue;
      dummy.position.set(c.x, 1.1 + Math.sin(G.time * 2 + c.bob) * 0.25, c.z);
      dummy.rotation.set(0, G.time * 1.5 + c.bob, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      coinMesh.setMatrixAt(c.slot, dummy.matrix);
      if (Math.hypot(p.x - c.x, p.z - c.z) < 2.2) {
        c.taken = true;
        coinMesh.setMatrixAt(c.slot, hide);
        G.player.addCash(TUNE.coinValue);
        G.player.p.coins++;
        G.audio.cash();
        G.hud.announce(`Bay Coin +$${TUNE.coinValue} (${G.player.p.coins}/20)`, 1600);
      }
    }
    coinMesh.instanceMatrix.needsUpdate = true;

    // --- Street race (T in a car) / taxi fare (T on foot) ------------------
    if (input.takePressed('KeyT')) {
      if (!p.onFoot && !race) startRace();
      else if (p.onFoot && !fare) startFare();
    }
    if (race) {
      race.t += dt;
      const pt = race.circuit.pts[race.idx];
      const d = Math.hypot(p.x - pt[0], p.z - pt[1]);
      G.hud.setObjective(`${race.circuit.name} — gate ${race.idx + 1}/${race.circuit.pts.length} (${Math.ceil(race.circuit.par - race.t)}s)`, d, { x: pt[0], z: pt[1], r: 9 });
      dummy.position.set(pt[0], 5, pt[1]);
      dummy.rotation.set(0, G.time * 2, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      gateMesh.setMatrixAt(0, dummy.matrix);
      gateMesh.instanceMatrix.needsUpdate = true;
      if (d < 9) {
        G.audio.pickup();
        race.idx++;
        if (race.idx >= race.circuit.pts.length) {
          const won = race.t <= race.circuit.par;
          if (won) {
            G.player.addCash(TUNE.raceReward);
            G.player.addRespect(TUNE.raceRespect);
            G.hud.announce(`${race.circuit.name} won in ${race.t.toFixed(1)}s — $${TUNE.raceReward.toLocaleString()}`, 3200);
          } else G.hud.announce(`${race.circuit.name}: ${race.t.toFixed(1)}s — par was ${race.circuit.par}s`, 2800);
          race = null;
          gateMesh.setMatrixAt(0, hide);
          gateMesh.instanceMatrix.needsUpdate = true;
        }
      } else if (race.t > race.circuit.par + 30) {
        G.hud.announce('Race abandoned', 2000);
        race = null;
        gateMesh.setMatrixAt(0, hide);
        gateMesh.instanceMatrix.needsUpdate = true;
      }
    }
    if (fare) {
      if (fare.stage === 'pickup') {
        const d = Math.hypot(p.x - fare.px, p.z - fare.pz);
        G.hud.setObjective('Taxi: pick up the passenger', d, { x: fare.px, z: fare.pz, r: 8 });
        if (d < 8 && !p.onFoot) {
          fare.stage = 'drop';
          G.hud.announce('Passenger aboard — drive them over', 2200);
        }
      } else {
        const d = Math.hypot(p.x - fare.dx, p.z - fare.dz);
        G.hud.setObjective('Taxi: drop off the passenger', d, { x: fare.dx, z: fare.dz, r: 8 });
        if (d < 8) {
          G.player.addCash(TUNE.taxiReward);
          G.player.addRespect(TUNE.taxiRespect);
          G.hud.announce(`Fare complete +$${TUNE.taxiReward}`, 2600);
          fare = null;
        }
      }
    }

    // --- Shops and safehouses (E on foot, no car in reach) ------------------
    if (p.onFoot && !G.vehicles.nearestCar(p.x, p.z, 4.6)) {
      // Garage: engine upgrades. The prompt sits on the street west of
      // the garage (the building's wall is 10 m out; the prompt must be
      // reachable on foot).
      if (near(48, -48, 9)) {
        const lvl = p.garageLevel;
        if (lvl < 3) {
          const cost = TUNE.garageCost[lvl + 1] || 0;
          G.hud.prompt(`E — Engine upgrade tier ${lvl + 1} ($${cost.toLocaleString()})`);
          if (input.takePressed('KeyE') && p.cash >= cost) {
            p.cash -= cost; p.garageLevel++;
            if (p.car) p.car.upgraded = 1 + p.garageLevel * 0.09;
            G.audio.cash();
            G.hud.announce(`Engine tier ${p.garageLevel} installed`, 2200);
          }
        } else G.hud.prompt("Tessa's Garage — engine maxed");
      }
      // Gun shop: buy the next weapon. Prompt on the street west of it.
      else if (near(-48, 48, 9)) {
        const order = ['smg', 'shotgun', 'rifle'];
        const next = order.find((w) => !p.weapons[w] || !p.weapons[w].owned);
        if (next) {
          const cost = TUNE.gunCost[next];
          G.hud.prompt(`E — Buy ${next.toUpperCase()} ($${cost.toLocaleString()})`);
          if (input.takePressed('KeyE') && p.cash >= cost) {
            p.cash -= cost;
            G.player.giveWeapon(next);
            G.audio.cash();
            G.hud.announce(`${next.toUpperCase()} bought`, 2200);
          }
        } else G.hud.prompt('Gun shop — fully stocked');
      }
      // Safehouses: save + heal. The loft's prompt is on the street west
      // of it (its wall is 12 m out).
      else if (near(-72, -72, 8) || near(280, 160, 8) || near(72, 96, 8)) {
        G.hud.prompt('E — Save at the safehouse');
        if (input.takePressed('KeyE')) {
          G.player.heal(100);
          G.save.write();
          G.audio.cash();
          G.hud.announce('Game saved', 1800);
        }
      } else shopMsg = '';
    }
  }

  return { update, get race() { return race; }, get fare() { return fare; }, coins };
}
