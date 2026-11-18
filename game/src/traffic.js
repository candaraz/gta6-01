// The city's traffic: cars that follow the road grid, keep a lane, brake for
// whatever is ahead of them, and turn at intersections. They despawn far from
// the player and respawn on roads nearby, so the streets always feel alive.

import { WORLD, VEHICLE_CLASSES } from './config.js';
import { createVehicle, driveVehicle } from './vehicles.js';

const TRAFFIC_COUNT = 14;
const DESPAWN_DISTANCE = 170;
const SPAWN_DISTANCE = 150;

export function createTraffic(scene, city, rng) {
  const cars = [];
  const classes = ['sedan', 'hatch', 'pickup', 'luxury', 'van'];

  function randomRoadPose(farFrom) {
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const vertical = rng.chance(0.5);
      const line = rng.pick(WORLD.roadLines);
      const along = rng.range(-190, 190);
      const dir = rng.chance(0.5) ? 1 : -1;
      const lane = 2.4 * dir;
      const x = vertical ? line + lane : along;
      const z = vertical ? along : line + lane;
      const heading = vertical ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      if (farFrom) {
        const dx = x - farFrom.x;
        const dz = z - farFrom.z;
        if (dx * dx + dz * dz < 45 * 45) continue;
      }
      return { x, z, heading, vertical, dir };
    }
    return { x: 0, z: -120, heading: 0, vertical: true, dir: 1 };
  }

  function spawnCar(farFrom) {
    const classId = rng.pick(classes);
    const spec = VEHICLE_CLASSES[classId];
    const pose = randomRoadPose(farFrom);
    const car = createVehicle(classId, rng.pick(spec.colors), pose.x, pose.z, pose.heading);
    car.isTraffic = true;
    car.cruiseSpeed = rng.range(11, 16);
    car.vertical = pose.vertical;
    car.dir = pose.dir;
    car.line = pose.vertical ? pose.x - 2.4 * pose.dir : pose.z - 2.4 * pose.dir;
    car.patience = rng.range(0, 4);
    scene.add(car.mesh);
    cars.push(car);
    return car;
  }

  function nearestIntersection(value) {
    let best = WORLD.roadLines[0];
    for (const line of WORLD.roadLines) {
      if (Math.abs(line - value) < Math.abs(best - value)) best = line;
    }
    return best;
  }

  function update(dt, playerPos, obstacles, onCarHit) {
    for (const car of cars) {
      // Realign to the lane: traffic hugs its road line.
      const along = car.vertical ? car.z : car.x;
      const cross = car.vertical ? car.x : car.z;
      const targetCross = car.line + 2.4 * car.dir;
      const crossError = targetCross - cross;
      const desiredHeading = car.vertical
        ? (car.dir > 0 ? 0 : Math.PI)
        : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      let headingError = desiredHeading - car.heading;
      while (headingError > Math.PI) headingError -= Math.PI * 2;
      while (headingError < -Math.PI) headingError += Math.PI * 2;
      // Near an intersection, sometimes turn onto the crossing road.
      const nextLine = nearestIntersection(along + car.dir * 10);
      const distToCrossing = Math.abs(nextLine - along);
      if (distToCrossing < 7 && Math.abs(crossError) < 1.5 && rng.chance(dt * 0.9)) {
        const turnLeft = rng.chance(0.5);
        const newVertical = !car.vertical;
        // Turning left from a vertical road keeps the direction sign; from a
        // horizontal road it flips it (and the reverse for a right turn).
        const newDir = turnLeft
          ? (car.vertical ? car.dir : -car.dir)
          : (car.vertical ? -car.dir : car.dir);
        car.vertical = newVertical;
        car.dir = newDir;
        car.line = nextLine;
        // The heading is not snapped: steering eases the car around the turn.
      }

      // Brake for whatever is ahead: the player, another car, a pedestrian.
      const aheadX = car.x + Math.sin(car.heading) * 11;
      const aheadZ = car.z + Math.cos(car.heading) * 11;
      let blocked = false;
      for (const obstacle of obstacles) {
        const dx = obstacle.x - aheadX;
        const dz = obstacle.z - aheadZ;
        if (dx * dx + dz * dz < 7 * 7) {
          blocked = true;
          break;
        }
      }
      const targetSpeed = blocked ? 0 : car.cruiseSpeed;
      const throttle = targetSpeed > car.speed ? 1 : targetSpeed < car.speed - 0.5 ? -1 : 0;
      const steer = Math.max(-1, Math.min(1, headingError * 2 + crossError * 0.12 * (car.vertical ? car.dir : -car.dir)));
      const before = car.health;
      driveVehicle(car, throttle, steer, false, dt, city, null);
      if (car.health < before && onCarHit) onCarHit(car);

      // Despawn far away; the spawner below replaces it near the player.
      const dx = car.x - playerPos.x;
      const dz = car.z - playerPos.z;
      if (dx * dx + dz * dz > DESPAWN_DISTANCE * DESPAWN_DISTANCE || car.health <= 0) {
        scene.remove(car.mesh);
        cars.splice(cars.indexOf(car), 1);
      }
    }
    while (cars.length < TRAFFIC_COUNT) spawnCar(playerPos);
  }

  return {
    cars,
    spawnInitial(playerPos) {
      while (cars.length < TRAFFIC_COUNT) spawnCar(playerPos);
    },
    // A traffic car at an exact pose, for staged scenes.
    spawnCarAt(classId, x, z, heading, vertical, dir) {
      const spec = VEHICLE_CLASSES[classId];
      const car = createVehicle(classId, spec.colors[0], x, z, heading);
      car.isTraffic = true;
      car.cruiseSpeed = 13;
      car.vertical = vertical;
      car.dir = dir;
      car.line = vertical ? x - 2.4 * dir : z - 2.4 * dir;
      car.patience = 0;
      scene.add(car.mesh);
      cars.push(car);
      return car;
    },
    update,
    // The closest traffic car to a point, for stealing.
    nearest(x, z, maxDist) {
      let best = null;
      let bestDist = maxDist;
      for (const car of cars) {
        const dx = car.x - x;
        const dz = car.z - z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < bestDist) {
          bestDist = dist;
          best = car;
        }
      }
      return best;
    },
    remove(car) {
      const index = cars.indexOf(car);
      if (index !== -1) cars.splice(index, 1);
    },
  };
}
