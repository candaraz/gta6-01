// traffic.js — Solmar Bay v3: the cars that fill the roads.
// One job: keep the streets busy with cars that follow the road grid,
// brake for trouble ahead, and turn at intersections.
//
// The v2 bug this must never repeat: traffic drove the player's stolen
// car. Traffic only ever steers a car whose driver is 'traffic'; the
// moment the player takes a car its driver becomes 'player' and traffic
// lets go, and it rejoins when the player steps out.

import { AVENUES } from './config.js';
import { makeRng, pick } from './random.js';

const CRUISE = 12;

export function createTraffic(vehicles, city, player) {
  const rng = makeRng(4242);
  const flow = new Map(); // car -> {axis, dir, tx, tz}

  function nearestAvenue(v) {
    let best = AVENUES[0], bd = 1e9;
    for (const a of AVENUES) { const d = Math.abs(v - a); if (d < bd) { bd = d; best = a; } }
    return best;
  }

  function spawnOne(nearX, nearZ) {
    // Spawn on a road near the given point (or anywhere at the start).
    let ave, along, x, z, heading, axis, dir;
    for (let tries = 0; tries < 20; tries++) {
      ave = pick(rng, AVENUES);
      along = (rng() - 0.5) * 560;
      axis = rng() < 0.5 ? 'x' : 'z';
      dir = rng() < 0.5 ? 1 : -1;
      if (axis === 'x') { x = along; z = ave + 2.6 * dir; heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      else { x = ave + 2.6 * dir; z = along; heading = dir > 0 ? 0 : Math.PI; }
      if (nearX === undefined) break;
      if (Math.hypot(x - nearX, z - nearZ) < 180) break;
    }
    const kinds = ['kestrel', 'bantam', 'longhorn', 'viceroy', 'tide', 'falcon'];
    const car = vehicles.spawnCar(pick(rng, kinds), x, z, heading, 'traffic');
    if (!car) return null;
    flow.set(car, { axis, dir, tx: x, tz: z });
    retarget(car);
    return car;
  }

  function retarget(car) {
    // Aim 40 m ahead along the car's current road, at the next intersection
    // choosing straight / left / right.
    const f = flow.get(car);
    if (!f) return;
    const pos = f.axis === 'x' ? car.x : car.z;
    const av = nearestAvenue(pos);
    // The next intersection along the road, in the car's direction.
    let next = null;
    for (const a of AVENUES) {
      if (f.dir > 0 && a > pos + 4) { next = a; break; }
      if (f.dir < 0 && a < pos - 4) { next = a; break; }
    }
    if (next === null) { // end of the road: turn around
      f.dir *= -1;
      retarget(car);
      return;
    }
    const roll = rng();
    const at = f.axis === 'x' ? { x: next, z: car.z } : { x: car.x, z: next };
    if (roll < 0.62) {
      // Straight on: target 40 m past the intersection.
      f.tx = f.axis === 'x' ? next + f.dir * 40 : at.x;
      f.tz = f.axis === 'x' ? at.z : next + f.dir * 40;
    } else {
      // Turn onto the crossing avenue.
      const nd = rng() < 0.5 ? 1 : -1;
      if (f.axis === 'x') { f.axis = 'z'; f.dir = nd; f.tx = next; f.tz = car.z + nd * 40; }
      else { f.axis = 'x'; f.dir = nd; f.tx = car.x + nd * 40; f.tz = next; }
    }
  }

  function angleDiff(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function blockedAhead(car) {
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    for (const o of vehicles.cars) {
      if (o === car || !o.alive) continue;
      const dx = o.x - car.x, dz = o.z - car.z;
      const along = dx * fx + dz * fz;
      if (along < 0 || along > 11) continue;
      const side = Math.abs(dx * fz - dz * fx);
      if (side < 3.2) return true;
    }
    return false;
  }

  function update(dt, time, px, pz) {
    // Keep ~26 traffic cars, respawning near the player when one is lost.
    let n = 0;
    for (const car of [...vehicles.cars]) {
      if (car.driver !== 'traffic') continue;
      n++;
      // Despawn far away, respawn near the player.
      if (Math.hypot(car.x - px, car.z - pz) > 300) {
        flow.delete(car);
        vehicles.despawnCar(car);
        n--;
      }
    }
    while (n < 26) {
      if (!spawnOne(px, pz)) break;
      n++;
    }
    // Drive each traffic car toward its waypoint.
    for (const car of [...vehicles.cars]) {
      if (car.driver !== 'traffic') continue;
      const f = flow.get(car);
      if (!f) { flow.set(car, { axis: 'x', dir: 1, tx: car.x, tz: car.z }); continue; }
      const dx = f.tx - car.x, dz = f.tz - car.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 7) { retarget(car); continue; }
      const want = Math.atan2(dx, dz);
      const steer = Math.max(-1, Math.min(1, angleDiff(want, car.heading) * 1.6));
      const blocked = blockedAhead(car);
      const throttle = blocked ? 0 : 1;
      const brake = blocked ? 1 : 0;
      // Ease up to cruise speed, never the player's pace.
      const target = blocked ? 0 : CRUISE;
      const thr = car.speed < target ? throttle : 0;
      vehicles.stepCar(car, dt, thr, steer, brake, time);
    }
  }

  return { update, spawnOne };
}
