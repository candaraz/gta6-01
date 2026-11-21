// Traffic: cars that follow the road grid, turn at intersections,
// brake for trouble ahead and never drive the player's stolen car.
import { VEHICLES } from './config.js';
import { CFG } from './config.js';
import { makeVehicle, steerToward, removeVehicle } from './vehicles.js';
import { makeRng, pick, range, rangeInt, clamp } from './random.js';

const TRAFFIC_TYPES = ['kestrel', 'bantam', 'longhorn', 'viceroy', 'tide', 'falcon'];

export function initTraffic(G) {
  const rng = makeRng(G.seed + 101);
  G.traffic = [];
  const B = CFG.block;
  for (let i = 0; i < 26; i++) {
    const along = rangeInt(rng, -6, 6) * B;
    const cross = rangeInt(rng, -6, 6) * B;
    const horiz = rng() < 0.5;
    const x = horiz ? cross : along;
    const z = horiz ? along : cross;
    if (x > CFG.beachX - 10) continue;
    const type = pick(rng, TRAFFIC_TYPES);
    const v = makeVehicle(G, type, x + (horiz ? 0 : 2.5), z + (horiz ? 2.5 : 0),
      horiz ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2), 'traffic');
    v.driver = 'npc';
    v.cruise = range(rng, 9, 13);
    v.nextTurn = range(rng, 20, 60);
    v.horiz = horiz;
    G.traffic.push(v);
  }
  // Parked cars along downtown curbs.
  for (let i = 0; i < 10; i++) {
    const x = rangeInt(rng, -3, 3) * B;
    const z = rangeInt(rng, -3, 3) * B;
    if (x > CFG.beachX - 10) continue;
    const v = makeVehicle(G, pick(rng, TRAFFIC_TYPES), x + 8, z + range(rng, -20, 20),
      rng() < 0.5 ? 0 : Math.PI, 'parked');
    v.driver = null;
    G.traffic.push(v);
  }
}

function aheadBlocked(G, v, look) {
  const ax = v.x + Math.cos(v.heading) * look, az = v.z + Math.sin(v.heading) * look;
  if (G.city.blocked(ax, az, 1.5)) return true;
  for (const o of G.vehicles) {
    if (o === v || o.dead) continue;
    const dx = o.x - v.x, dz = o.z - v.z;
    const along = dx * Math.cos(v.heading) + dz * Math.sin(v.heading);
    const side = Math.abs(-dx * Math.sin(v.heading) + dz * Math.cos(v.heading));
    if (along > 0 && along < look && side < 3.2) return true;
  }
  return false;
}

export function stepTraffic(G, dt) {
  const B = CFG.block;
  for (const v of G.traffic) {
    if (v.dead) continue;
    if (v.kind === 'parked') continue;
    if (v.driver === 'player') continue; // never drive the player's car
    v.nextTurn -= Math.abs(v.speed) * dt;
    // At an intersection, maybe turn.
    const onX = Math.abs(v.x / B - Math.round(v.x / B)) * B < 3;
    const onZ = Math.abs(v.z / B - Math.round(v.z / B)) * B < 3;
    if (onX && onZ && v.nextTurn <= 0 && Math.abs(v.speed) > 4) {
      v.nextTurn = 40 + Math.random() * 50;
      const r = Math.random();
      if (r < 0.35) {
        // Turn left or right onto the cross street.
        v.heading += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
      } else if (r < 0.42) {
        v.heading += Math.PI; // U-turn, rarely
      }
      v.horiz = Math.abs(Math.cos(v.heading)) > 0.7;
    }
    // Cruise with braking for trouble ahead.
    const blocked = aheadBlocked(G, v, 14);
    const want = blocked ? 0 : v.cruise;
    v.speed += (want - v.speed) * Math.min(1, dt * 1.5);
    v.speed = clamp(v.speed, 0, v.cruise + 2);
    let nx = v.x + Math.cos(v.heading) * v.speed * dt;
    let nz = v.z + Math.sin(v.heading) * v.speed * dt;
    if (G.city.blocked(nx, nz, 1.6) || Math.abs(nx) > 285 || Math.abs(nz) > 285) {
      // Reverse out of trouble, then carry on.
      v.heading += Math.PI;
      v.speed = 4;
      nx = v.x; nz = v.z;
    }
    v.x = nx; v.z = nz;
    v.mesh.position.set(v.x, 0, v.z);
    v.mesh.rotation.y = -v.heading;
  }
}

export function spawnTrafficCar(G, x, z) {
  const v = makeVehicle(G, pick(Math.random, TRAFFIC_TYPES),
    x, z, Math.random() * Math.PI * 2, 'traffic');
  v.driver = 'npc'; v.cruise = 11; v.nextTurn = 30; v.horiz = true;
  G.traffic.push(v);
  return v;
}
