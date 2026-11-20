// shots.js — poses the game for the four screenshots the entry ships.
// Each pose sets the player, camera and world state, then the caller
// waits a few frames and captures. Used by the test driver; the poses
// are ordinary game state, nothing is faked for the camera.
import { Vehicle, spawnBoat } from './vehicles.js';

export const SHOT_NAMES = ['1-chase.jpg', '2-mission.jpg', '3-drive.jpg', '4-start.jpg'];

// Put the player in a sports car on the coast road, 3 stars, police
// behind — the chase shot.
export function poseChase(G) {
  const car = new Vehicle(G.scene, 'sports', 0, 210, Math.PI / 2, { driver: null, owned: true });
  G.vehicles.push(car);
  G.player.teleport(0, 210, Math.PI / 2);
  G.player.enterVehicle(car);
  car.speed = 24;
  G.police.setStars(3);
  G.police.cops = [];
  for (let i = 0; i < 3; i++) {
    const cop = new Vehicle(G.scene, 'police', -30 - i * 12, 210 + (i % 2) * 6, Math.PI / 2, { driver: 'police' });
    cop.speed = 22;
    G.police.cops.push(cop);
    G.vehicles.push(cop);
  }
  G.cameraRig.setYaw(Math.PI / 2, 0.3);
  G.cameraRig.snap(G.player.x, G.player.z, 1.5);
  G.hud.message('Police chase — 3 stars');
}

// Mission in progress: m4 Dockside, Vultures in view, player aiming.
export function poseMission(G) {
  G.missions.nextIndex = 3; // m4 is next
  G.missions.startMission(G.missionCtx);
  // Teleport to the docks and let the kill stage begin.
  G.player.teleport(210, 70, Math.PI / 2);
  G.cameraRig.setYaw(Math.PI / 2, 0.3);
  const alive = G.combat.aliveEnemies();
  if (alive.length) {
    const e = alive[0];
    const h = Math.atan2(e.x - G.player.x, e.z - G.player.z);
    G.player.aimHeading = h;
    G.player.firing = true;
    G.cameraRig.setYaw(h, 0.28);
  }
  G.cameraRig.snap(G.player.x, G.player.z, 1.5);
}

// Driving: sports car on the coast road at speed, camera behind.
export function poseDrive(G) {
  const car = new Vehicle(G.scene, 'sports', -120, 210, Math.PI / 2, { driver: null, owned: true });
  G.vehicles.push(car);
  G.player.teleport(-120, 210, Math.PI / 2);
  G.player.enterVehicle(car);
  car.speed = 30;
  G.cameraRig.setYaw(Math.PI / 2, 0.32);
  G.cameraRig.snap(G.player.x, G.player.z, 1.5);
}

// On foot at the start, HUD and minimap visible. Mara's Place sits at
// (-245,-245) — a house, so the player stands on the avenue beside it
// (x=-210 is the road) facing west at the house and the city; standing
// ON the house puts the camera inside its walls and the shot is blank.
export function poseStart(G) {
  if (G.player.inVehicle) G.player.exitVehicle();
  G.player.teleport(-210, -245, -Math.PI / 2);
  G.player.health = 100;
  G.police.clear();
  G.cameraRig.setYaw(-Math.PI / 2, 0.3);
  G.cameraRig.snap(G.player.x, G.player.z, 1.5);
}

// Human-readable descriptions of the four shipped screenshots.
export function describeShots() {
  return [
    { file: '1-chase.jpg', what: 'Police chase at 3 stars — Interceptors behind the Comet GT on the coast road, HUD + minimap live' },
    { file: '2-mission.jpg', what: 'Mission m4 Dockside in progress — Vultures in view, objective marker, player aiming' },
    { file: '3-drive.jpg', what: 'Driving the Comet GT along the coast road at speed' },
    { file: '4-start.jpg', what: "On foot at Mara's Place at the start — HUD, minimap and the city ahead" },
  ];
}
