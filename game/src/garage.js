// Side activities: garage upgrades, gun shop, safehouse saving,
// twenty hidden Bay Coins, three street-race circuits (T in a car)
// and taxi fares (T on foot). All pay out and never touch the story.
import * as THREE from 'three';
import { GARAGE, GUNSHOP, SAFEHOUSES, COIN_SPOTS, RACES, TAXI_SPOTS, WEAPONS } from './config.js';
import { dist } from './random.js';

export function createActivities(G) {
  const A = {
    coins: 0, coinsFound: {},
    race: null, taxi: null,
    engineLevel: 0,
  };
  G.activities = A;
  G.safehouses = SAFEHOUSES;

  // Bay Coins: spinning gold coins on the streets.
  const coinGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.15, 12);
  const coinMat = new THREE.MeshBasicMaterial({ color: 0xffd23e });
  A.coinMeshes = [];
  COIN_SPOTS.forEach(([x, z], i) => {
    const m = new THREE.Mesh(coinGeo, coinMat);
    m.position.set(x, 1.2, z);
    m.rotation.x = Math.PI / 2;
    G.scene.add(m);
    A.coinMeshes.push({ mesh: m, x, z, i, taken: false });
  });

  // Garage + gun shop markers (floating signs).
  function marker(x, z, color, label) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(6, 1, 0.2),
      new THREE.MeshBasicMaterial({ color }));
    m.position.set(x, 6, z);
    G.scene.add(m);
    return m;
  }
  marker(GARAGE.x, GARAGE.z, 0x37b6ff, 'garage');
  marker(GUNSHOP.x, GUNSHOP.z, 0xff5a7a, 'gunshop');

  A.step = function (dt) {
    const P = G.player;
    // Coins spin and get collected.
    for (const c of A.coinMeshes) {
      if (c.taken) continue;
      c.mesh.rotation.z += dt * 3;
      c.mesh.position.y = 1.2 + Math.sin(G.time * 3 + c.i) * 0.2;
      if (dist(P.x, P.z, c.x, c.z) < 2.5) {
        c.taken = true;
        c.mesh.visible = false;
        A.coins++;
        G.cash += 250;
        G.audio.pickup();
        G.hud.toast(`Bay Coin ${A.coins}/20  +$250`);
      }
    }
    // Garage: hold F at it to tune the current car: $1000 a level, +8% top speed.
    if (dist(P.x, P.z, GARAGE.x, GARAGE.z) < 10 && P.vehicle && G.input.isDown('punch')) {
      // Hold F at the garage to tune: $1000 a level, +8% top speed.
      if (G.cash >= 1000 && A.engineLevel < 3) {
        G.cash -= 1000;
        A.engineLevel++;
        P.vehicle.def = Object.assign({}, P.vehicle.def, { top: P.vehicle.def.top * 1.08 });
        G.audio.cash();
        G.hud.toast(`Engine tuned to level ${A.engineLevel}`);
      }
    }
    // Gun shop: E near it buys the next weapon.
    if (dist(P.x, P.z, GUNSHOP.x, GUNSHOP.z) < 8 && G.input.consume('enter') && !P.vehicle) {
      const order = ['smg', 'shotgun', 'rifle'];
      const next = order.find((k) => !G.combat.owned[k]);
      if (next) {
        const price = next === 'smg' ? 1500 : next === 'shotgun' ? 2500 : 4000;
        if (G.cash >= price) {
          G.cash -= price;
          G.combat.give(next);
          G.audio.cash();
          G.hud.toast(`Bought the ${WEAPONS[next].name} — $${price}`);
        } else G.hud.toast(`Need $${price} for the ${WEAPONS[next].name}`);
      } else G.hud.toast('Ammo restocked');
      if (!next) {
        G.combat.reserve[G.combat.current] = (G.combat.reserve[G.combat.current] || 0) + 60;
      }
    }
    // Safehouse: standing at one saves the game.
    for (const s of SAFEHOUSES) {
      if (dist(P.x, P.z, s.x, s.z) < 10 && G.input.consume('enter') && !P.vehicle) {
        G.save.saveGame();
        G.hud.toast('Saved at ' + s.name);
      }
    }
    // Street race (T in a car) / taxi fare (T on foot). Not during a
    // mission race stage — the objective beam is already in use there.
    const mst = G.missions.currentStage();
    const inMissionRace = mst && (mst.kind === 'race' || mst.kind === 'boat');
    if (G.input.consume('activity') && !inMissionRace) {
      if (P.vehicle && !A.race && !A.taxi) {
        const R = RACES[Math.floor(Math.random() * RACES.length)];
        A.race = { def: R, next: 0, t: 0 };
        G.missions.setObjective(R.points[0].x, R.points[0].z, `Race: ${R.name}`);
        G.hud.toast(`Street race: ${R.name} — ${R.limit}s, $${R.prize}`);
      } else if (!P.vehicle && !A.race && !A.taxi) {
        const from = TAXI_SPOTS[Math.floor(Math.random() * TAXI_SPOTS.length)];
        const to = TAXI_SPOTS[Math.floor(Math.random() * TAXI_SPOTS.length)];
        A.taxi = { from, to, t: 0, state: 'pickup' };
        G.missions.setObjective(from.x, from.z, 'Taxi: pick up the fare');
        G.hud.toast('Taxi fare — pick up the passenger');
      }
    }
    if (A.race) {
      const R = A.race;
      R.t += dt;
      const pt = R.def.points[R.next];
      if (dist(P.x, P.z, pt.x, pt.z) < 10) {
        R.next++;
        G.audio.pickup();
        if (R.next >= R.def.points.length) {
          G.cash += R.def.prize;
          G.respect += 40;
          G.audio.cash();
          G.hud.toast(`Race won! +$${R.def.prize}`);
          A.race = null;
          G.missions.clearObjective();
          if (G.missions.mission()) G.missions.restoreObjective();
        } else G.missions.setObjective(R.def.points[R.next].x, R.def.points[R.next].z, `Race: ${R.def.name}`);
      }
      if (R.t > R.def.limit) {
        G.hud.toast('Race lost — out of time');
        A.race = null;
        G.missions.clearObjective();
        if (G.missions.mission()) G.missions.restoreObjective();
      }
    }
    if (A.taxi) {
      const T = A.taxi;
      T.t += dt;
      if (T.state === 'pickup') {
        if (dist(P.x, P.z, T.from.x, T.from.z) < 6) {
          T.state = 'dropoff';
          G.missions.setObjective(T.to.x, T.to.z, 'Taxi: drop off the fare');
          G.hud.toast('Passenger aboard — drop them off');
        }
      } else if (dist(P.x, P.z, T.to.x, T.to.z) < 6) {
        const fare = 120 + Math.floor(Math.random() * 180);
        G.cash += fare;
        G.respect += 10;
        G.audio.cash();
        G.hud.toast(`Fare paid +$${fare}`);
        A.taxi = null;
        G.missions.clearObjective();
        if (G.missions.mission()) G.missions.restoreObjective();
      }
      if (T.t > 240) {
        G.hud.toast('The fare gave up waiting');
        A.taxi = null;
        G.missions.clearObjective();
        if (G.missions.mission()) G.missions.restoreObjective();
      }
    }
  };
  return A;
}
