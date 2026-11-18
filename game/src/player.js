// Milo Kade on foot: the jointed figure, camera-relative movement, sprinting,
// a small hop, and the get-in/get-out dance with cars. Aiming turns him toward
// the camera so shots go where the crosshair points.

import { buildPersonMesh } from './pedestrians.js';

const WALK_SPEED = 4.2;
const RUN_SPEED = 7.6;

export function createPlayer(scene, x, z) {
  const { group, limbs } = buildPersonMesh(0x2e8a7a, 0x2e2e34, 0xe8b98a, 1.06);
  group.position.set(x, 0, z);
  scene.add(group);
  // Milo's own touches: a cap and a shoulder bag.
  const capMat = group.children[0].material;
  const player = {
    mesh: group,
    limbs,
    x,
    z,
    y: 0,
    vy: 0,
    heading: 0,
    speed: 0,
    walkPhase: 0,
    health: 100,
    aiming: false,
    inCar: null,
    punchTimer: 0,
    punchSide: 1,
  };
  return player;
}

// moveX/moveZ are camera-relative (-1..1); cameraYaw is the camera's orbit.
export function updatePlayer(player, moveX, moveZ, sprint, jump, cameraYaw, aiming, dt, city) {
  player.aiming = aiming;
  const moving = moveX !== 0 || moveZ !== 0;
  if (moving) {
    // Camera forward on the ground is (-sin yaw, -cos yaw); right is its
    // perpendicular. W is -z in input space, which maps to camera forward.
    const forwardX = -Math.sin(cameraYaw);
    const forwardZ = -Math.cos(cameraYaw);
    const rightX = -forwardZ;
    const rightZ = forwardX;
    const dirX = forwardX * -moveZ + rightX * moveX;
    const dirZ = forwardZ * -moveZ + rightZ * moveX;
    const len = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
    const targetSpeed = sprint ? RUN_SPEED : WALK_SPEED;
    player.speed += (targetSpeed - player.speed) * Math.min(1, dt * 8);
    const wantHeading = aiming ? cameraYaw + Math.PI : Math.atan2(dirX, dirZ);
    let diff = wantHeading - player.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    player.heading += Math.max(-10 * dt, Math.min(10 * dt, diff));
    const nx = player.x + (dirX / len) * player.speed * dt;
    const nz = player.z + (dirZ / len) * player.speed * dt;
    const resolved = city.resolveCollision(nx, nz, 0.55);
    player.x = resolved.x;
    player.z = resolved.z;
  } else {
    player.speed += (0 - player.speed) * Math.min(1, dt * 10);
    if (aiming) {
      const wantHeading = cameraYaw + Math.PI;
      let diff = wantHeading - player.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      player.heading += Math.max(-10 * dt, Math.min(10 * dt, diff));
    }
  }
  if (jump && player.y <= 0.01) player.vy = 5.2;
  player.vy -= 16 * dt;
  player.y = Math.max(0, player.y + player.vy * dt);
  if (player.y === 0) player.vy = 0;

  player.mesh.position.set(player.x, player.y, player.z);
  player.mesh.rotation.y = player.heading;
  player.walkPhase += player.speed * dt * 3.2;
  const swing = Math.sin(player.walkPhase) * Math.min(0.75, player.speed * 0.13);
  if (player.punchTimer > 0) {
    player.punchTimer -= dt;
    const arm = player.punchSide > 0 ? player.limbs.armR : player.limbs.armL;
    arm.rotation.x = -1.9 + (0.38 - player.punchTimer) * 4;
    (player.punchSide > 0 ? player.limbs.armL : player.limbs.armR).rotation.x = 0.3;
  } else if (aiming) {
    player.limbs.armR.rotation.x = -1.45;
    player.limbs.armL.rotation.x = -1.2;
  } else {
    player.limbs.armL.rotation.x = -swing * 0.85;
    player.limbs.armR.rotation.x = swing * 0.85;
  }
  player.limbs.legL.rotation.x = swing;
  player.limbs.legR.rotation.x = -swing;
}

export function playerPunch(player) {
  if (player.punchTimer <= 0) {
    player.punchTimer = 0.38;
    player.punchSide *= -1;
    return true;
  }
  return false;
}
