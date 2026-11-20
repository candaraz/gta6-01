// Solmar Bay — screenshot scenes.
// One job: given ?shot=start|drive|chase|mission (from shots.json), put the
// game in a photogenic, system-rich state and hold it there, so each of the
// four screenshots shows several systems at once: HUD, minimap, traffic,
// wanted level, police, a mission objective. The game runs normally underneath;
// this only chooses the starting state and camera.

import { Vehicle } from './vehicles.js';

export const SHOT_NAMES = ['start', 'drive', 'chase', 'mission'];

export function applyShot(game, shot) {
  const g = game;
  if (!SHOT_NAMES.includes(shot)) return;
  // start from a clean slate: no wanted, no active mission stage confusion
  g.police.clear();
  g.combat.clearGroup();
  if (shot === 'start') {
    // On foot on a main street: traffic, peds, buildings, HUD + minimap.
    g.player.reset(-19, -70);
    g.player.heading = Math.PI;
    g.cameraRig.snap(g.player.heading);
    g.missions.startStory();
  } else if (shot === 'drive') {
    // Driving a sports car down the coast road with traffic around.
    const car = g.spawnCar('sports', -20, 120, 0, { driver: 'player' });
    g.player.enterVehicle(car);
    g.playerCar = car;
    // hold W so the car is actually driving (not parked) when the shot lands
    g.input.keys.add('KeyW');
    g.cameraRig.snap(0);
    g.missions.startStory();
    g.missions.stage = 0;
  } else if (shot === 'chase') {
    // A 3-star chase: police cars, helicopter, roadblock, objective on the HUD.
    const car = g.spawnCar('sports', 0, 40, Math.PI, { driver: 'player' });
    g.player.enterVehicle(car);
    g.playerCar = car;
    car.speed = 30;
    g.police.setStars(3);
    g.police.spawnRoadblock(0, 40, Math.PI);
    // two pursuit cars close behind
    for (let i = 0; i < 2; i++) {
      const p = g.police.spawnCar(0, 40);
      p.x = -6 + i * 12; p.z = 40 - 22 - i * 6;
      p.heading = Math.PI;
    }
    g.missions.startStory();
    g.cameraRig.snap(Math.PI);
  } else if (shot === 'mission') {
    // Mission 4 shootout at the docks: enemies, cover, objective, HUD.
    // Stand close to the Vultures and face them, so they are in frame.
    g.player.reset(118, 118);
    g.player.heading = Math.PI / 4;
    g.combat.giveWeapon('rifle', 60);
    g.combat.select('rifle');
    g.combat.giveWeapon('smg', 64);
    g.missions.index = 3;
    g.missions.startStory();
    // jump to the kill stage so enemies are present
    g.missions.stage = 1;
    g.missions._enterStage();
    g.cameraRig.snap(g.player.heading);
  }
  // let the audio context exist (it starts on the first gesture; in headless
  // shots it may stay suspended — the game still renders identically).
  g.audio.ensure();
}
