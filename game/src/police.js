// The wanted level and the Solmar Bay police: cruisers that spawn on roads
// ahead of the player, pursue and ram, and bust a player who stops. Hide
// well and the heat fades star by star; the spray shop at Tessa's clears it
// at once, for a price.

import { WANTED } from './config.js';
import { createVehicle, driveVehicle } from './vehicles.js';

export function createPolice(scene, city, rng, audio) {
  const cruisers = [];
  let stars = 0;
  let evadeTimer = 0;
  let bustTimer = 0;
  let evading = false;
  let crimeCooldown = 0;

  function spawnCruiser(player, playerHeading) {
    // Ahead of the player, on a road, so the chase reads at once.
    const angle = playerHeading + rng.range(-0.7, 0.7);
    const dist = rng.range(55, 85);
    let x = player.x + Math.sin(angle) * dist;
    let z = player.z + Math.cos(angle) * dist;
    // Snap to the nearest road line.
    const lines = [-180, -120, -60, 0, 60, 120, 180];
    let best = lines[0];
    for (const line of lines) {
      if (Math.abs(line - x) < Math.abs(best - x)) best = line;
    }
    if (Math.abs(best - x) < 30) x = best + 2.4;
    else {
      let bestZ = lines[0];
      for (const line of lines) {
        if (Math.abs(line - z) < Math.abs(bestZ - z)) bestZ = line;
      }
      z = bestZ + 2.4;
    }
    const resolved = city.resolveCollision(x, z, 2.5);
    const cruiser = createVehicle('police', 0x14161c, resolved.x, resolved.z, Math.atan2(player.x - resolved.x, player.z - resolved.z));
    cruiser.isPolice = true;
    scene.add(cruiser.mesh);
    cruisers.push(cruiser);
    return cruiser;
  }

  function update(dt, player, playerCar, danger) {
    crimeCooldown = Math.max(0, crimeCooldown - dt);
    const wantCount = stars === 0 ? 0 : Math.min(stars + 1, 5);
    // Spawn or retire cruisers to match the wanted level.
    while (cruisers.length < wantCount) spawnCruiser(player, playerCar ? playerCar.heading : player.heading);
    while (cruisers.length > wantCount) {
      const cruiser = cruisers.pop();
      scene.remove(cruiser.mesh);
    }
    audio.setSiren(stars > 0 && cruisers.length > 0);

    if (stars === 0) {
      evading = false;
      bustTimer = 0;
      return { busted: false };
    }

    // Pursuit: steer at the player, ram when close, ease off never.
    let nearestDist = Infinity;
    for (const cruiser of cruisers) {
      const dx = player.x - cruiser.x;
      const dz = player.z - cruiser.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      nearestDist = Math.min(nearestDist, dist);
      // A cruiser pinned against a building reverses out instead of pushing
      // at the wall forever. A cruiser holding the cordon is not stuck.
      if (cruiser.holding) cruiser.stuckTimer = 0;
      else if (Math.abs(cruiser.speed) < 2) cruiser.stuckTimer = (cruiser.stuckTimer || 0) + dt;
      else cruiser.stuckTimer = 0;
      // Holding: parked in the cordon around a player on foot. It clears
      // when the player gets in a car or gets away.
      if (!playerCar && dist < 9 && Math.abs(cruiser.speed) < 4) cruiser.holding = true;
      if (playerCar || dist > 16) cruiser.holding = false;
      const reversing = !cruiser.holding && cruiser.stuckTimer > 1.1 && cruiser.stuckTimer < 2.1;
      // Aim slightly ahead of a moving target.
      const lead = playerCar ? Math.min(1.2, Math.abs(playerCar.speed) * 0.05) : 0;
      const targetX = player.x + (playerCar ? Math.sin(playerCar.heading) * playerCar.speed * lead * 0.4 : 0);
      const targetZ = player.z + (playerCar ? Math.cos(playerCar.heading) * playerCar.speed * lead * 0.4 : 0);
      const wantHeading = Math.atan2(targetX - cruiser.x, targetZ - cruiser.z);
      let diff = wantHeading - cruiser.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = cruiser.holding ? 0 : Math.max(-1, Math.min(1, diff * 2.2));
      // Against a player on foot the cruiser eases in — its approach speed
      // shrinks with the gap, so it stops beside the player instead of
      // screaming past in a wide orbit. Against a car it brakes late and
      // keeps ramming.
      let throttle;
      if (reversing) throttle = -1;
      else if (cruiser.holding) throttle = 0;
      else if (!playerCar) {
        const wantSpeed = Math.min(38, Math.max(0, (dist - 2) * 0.9));
        throttle = cruiser.speed < wantSpeed ? 1 : cruiser.speed > wantSpeed + 2 ? -0.8 : 0;
      } else if (dist < 18 && Math.abs(cruiser.speed) > 14) throttle = -0.7;
      else throttle = dist > 7 ? 1 : 0.4;
      const before = cruiser.health;
      driveVehicle(cruiser, throttle, reversing ? -steer : steer, false, dt, city, null);
      if (cruiser.health < before - 0.01 && cruiser.health <= 25) {
        // A wrecked cruiser drops out of the chase in smoke.
        cruiser.speed *= 0.4;
      }
      if (dist < 4.5 && playerCar) {
        // Ramming: shove the player's car and shake things up.
        const push = 3.5 * dt;
        playerCar.x += (dx / (dist || 1)) * -push * 4;
        playerCar.z += (dz / (dist || 1)) * -push * 4;
        danger.rammed = true;
      }
    }

    // Bust: a slow, cornered player gets caught.
    const playerSpeed = playerCar ? Math.abs(playerCar.speed) : player.speed;
    const cornered = nearestDist < WANTED.bustDistance && playerSpeed < 1.6;
    if (cornered) {
      bustTimer += dt;
      if (bustTimer >= WANTED.bustSeconds) {
        return { busted: true };
      }
    } else {
      bustTimer = Math.max(0, bustTimer - dt * 2);
    }

    // Evade: out of sight, the heat fades one star at a time.
    const hidden = nearestDist > 55;
    if (hidden) {
      evading = true;
      evadeTimer += dt * (danger.inHidingSpot ? 2.2 : 1);
      if (evadeTimer >= WANTED.evadeSecondsPerStar) {
        evadeTimer = 0;
        stars = Math.max(0, stars - 1);
        danger.starLost = true;
      }
    } else {
      evading = false;
      evadeTimer = Math.max(0, evadeTimer - dt * 3);
    }
    return { busted: false };
  }

  return {
    cruisers,
    get stars() {
      return stars;
    },
    get evading() {
      return evading;
    },
    get bustProgress() {
      return Math.min(1, bustTimer / WANTED.bustSeconds);
    },
    addStars(count, reason) {
      if (crimeCooldown > 0 && reason === 'noise') return;
      if (reason === 'noise') crimeCooldown = 10;
      stars = Math.min(WANTED.maxStars, stars + count);
      evadeTimer = 0;
    },
    clearStars() {
      stars = 0;
      evadeTimer = 0;
      evading = false;
    },
    setStars(count) {
      stars = Math.max(0, Math.min(WANTED.maxStars, count));
    },
    update,
    clear() {
      for (const cruiser of cruisers) scene.remove(cruiser.mesh);
      cruisers.length = 0;
      stars = 0;
    },
  };
}
