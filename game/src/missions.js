// missions.js — Solmar Bay v3: the 10-story campaign.
// One job: run the story — objectives, waypoints, dialogue, rewards.
// Each mission is a list of stages; a stage is a goto, an enter (press E),
// a kill count, a hold (hold F), or a checkpoint race. Completing a
// mission pays cash + respect and opens the next one.

import * as THREE from 'three';
import { MISSION_REWARDS } from './config.js';

const CREW = {
  mara: 'Mara', dario: 'Dario', ivy: 'Ivy', sol: 'Sol', pearl: 'Pearl',
};

// Mission definitions: [name, speaker, briefing, stages].
// Stage: {t:'goto', x, z, r, text} | {t:'enter', x, z, r, text, what}
//       | {t:'kill', x, z, n, text} | {t:'hold', x, z, s, text}
//       | {t:'race', pts:[[x,z]...], r, time, text}
const DEFS = [
  ['First Wheels', 'mara', 'Milo. You need wheels before anything else. There is a Kestrel parked up the avenue — take it, then come see me.',
    [{ t: 'goto', x: 0, z: 232, r: 6, text: 'Go to the parked Kestrel' },
     { t: 'enter', x: 0, z: 232, r: 5, text: 'Get in the car (E)', what: 'car' },
     { t: 'goto', x: -72, z: -72, r: 8, text: "Drive to Mara's Place" }]],
  ['The Package', 'dario', 'Dario here. Pick up the package at the dock office, then run it to Tessa at the garage. No detours.',
    [{ t: 'goto', x: 240, z: -40, r: 7, text: 'Pick up the package at the dock office' },
     { t: 'goto', x: 48, z: -48, r: 8, text: "Deliver it to Tessa's Garage" }]],
  ['Bay Run', 'ivy', 'Ivy: the Bay Run is tonight. Five gates down the coast road — beat the clock and the whole Bay hears about it.',
    [{ t: 'race', pts: [[0, 288], [144, 288], [288, 144], [288, 0], [296, 0]], r: 9, time: 150, text: 'Bay Run: hit every gate' }]],
  ['Dockside', 'mara', 'The Vultures are muscling the docks. Clear all six of them out, and the yard is ours again.',
    [{ t: 'goto', x: 250, z: 20, r: 10, text: 'Go to the dock yard' },
     { t: 'kill', x: 250, z: 20, n: 3, text: "Clear the yard of Deke's crew" }]],
  ['The Getaway', 'sol', 'Sol: the cops are coming — three stars and climbing. Get to the Pier House and lay low. Move!',
    [{ t: 'escape', x: 280, z: 160, r: 8, text: 'Escape to the Pier House', stars: 3 }]],
  ['Grand Theft Bay', 'ivy', 'Ivy: a Comet GT is sitting at the hotel valet, keys in it, begging to be taken. Bring it to the garage.',
    [{ t: 'goto', x: 96, z: 48, r: 7, text: 'Find the Comet GT at the valet' },
     { t: 'enter', x: 96, z: 48, r: 5, text: 'Steal the Comet GT (E)', what: 'comet' },
     { t: 'goto', x: 48, z: -48, r: 8, text: "Bring the Comet to Tessa's Garage" }]],
  ['Payback', 'dario', 'Dario: ten Vultures downtown, around the bank. They hit our crew — now we hit back. All ten.',
    [{ t: 'goto', x: 0, z: 24, r: 12, text: 'Go to the bank plaza' },
     { t: 'kill', x: 0, z: 24, n: 4, text: "Take down Deke's crew (4 left)" }]],
  ['The Heist', 'mara', 'Mara: the bank vault, eight seconds on the drill, then four stars and a run for the loft. This is the big one.',
    [{ t: 'goto', x: 0, z: 24, r: 7, text: 'Get to the bank' },
     { t: 'hold', x: 0, z: 24, s: 8, r: 30, text: 'Hold F to crack the vault', stars: 4 },
     { t: 'goto', x: 72, z: 96, r: 8, text: 'Escape to the loft' }]],
  ['High Tide', 'sol', 'Sol: the Marlin is fuelled at the pier. Five buoys out in the bay — thread them and bring her home.',
    [{ t: 'goto', x: 296, z: 0, r: 7, text: 'Go to the Marlin at the pier' },
     { t: 'enter', x: 296, z: 0, r: 5, text: 'Board the Marlin (E)', what: 'boat' },
     { t: 'race', pts: [[330, -60], [380, -20], [420, 30], [380, 80], [330, 60], [310, 120]], r: 10, time: 120, text: 'High Tide: thread the buoys' }]],
  ['King of the Bay', 'mara', 'Mara: last one. A dash across downtown, then the rest of Deke\u2019s crew at the loft. Win this and the Bay is yours.',
    [{ t: 'race', pts: [[0, 0], [96, -96], [-96, -96], [-96, 96], [72, 96]], r: 9, time: 160, text: 'Downtown Dash: hit every gate' },
     { t: 'kill', x: 72, z: 96, n: 3, text: 'Finish Deke\u2019s crew at the loft' }]],
];

export function createMissions(G) {
  const scene = G.scene;
  // The objective marker: a golden light beam + a spinning diamond.
  const beamGeo = new THREE.CylinderGeometry(0.9, 0.9, 60, 10, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffc21f, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.y = 30;
  const diaGeo = new THREE.OctahedronGeometry(1.4);
  const diaMat = new THREE.MeshBasicMaterial({ color: 0xffc21f });
  const diamond = new THREE.Mesh(diaGeo, diaMat);
  diamond.position.y = 6;
  const marker = new THREE.Group();
  marker.add(beam); marker.add(diamond);
  marker.visible = false;
  scene.add(marker);

  let current = 0;      // mission index 0..9, 10 = campaign done
  let stage = 0;
  let holdT = 0;
  let holdEndT = -100; // game time a vault-crack hold last completed
  let raceIdx = 0, raceT = 0;
  let spawnedForStage = -1;
  let cometCar = null, marlinBoat = null, m1Car = null;

  function def() { return DEFS[current]; }
  function stageDef() { return DEFS[current][3][stage]; }
  function name() { return current < 10 ? DEFS[current][0] : 'Free Roam'; }
  function objective() {
    if (current >= 10) return 'Solmar Bay is yours. Free roam — races, fares, coins.';
    const s = stageDef();
    return s.text;
  }
  function waypoint() {
    if (current >= 10) return null;
    const s = stageDef();
    if (s.t === 'race') return { x: s.pts[raceIdx][0], z: s.pts[raceIdx][1], r: s.r };
    return { x: s.x, z: s.z, r: s.r || 7 };
  }

  function startMission(i) {
    current = i; stage = 0; holdT = 0; raceIdx = 0; raceT = 0; spawnedForStage = -1;
    const [nm, who, brief] = DEFS[i];
    G.hud.setMission(nm, objective());
    G.hud.dialogue(CREW[who] || who, brief);
    G.hud.announce(`${nm} — ${objective()}`, 3000);
  }

  function completeMission() {
    const [cash, rep] = MISSION_REWARDS[current];
    G.player.addCash(cash);
    G.player.addRespect(rep);
    G.audio.mission();
    G.hud.announce(`${DEFS[current][0]} complete — $${cash.toLocaleString()} + ${rep} respect`, 3200);
    // Unlocks along the way.
    if (current === 0) G.player.giveWeapon('pistol', 12);
    if (current === 1) G.player.giveWeapon('smg', 30);
    if (current === 5) { /* the Comet is yours now */ }
    if (current === 6) G.player.giveWeapon('shotgun', 6);
    if (current === 7) G.player.giveWeapon('rifle', 20);
    current++;
    if (current >= 10) {
      G.hud.setMission('Bay King', 'Solmar Bay is yours.');
      G.hud.dialogue('Mara', 'Bay King. The whole city knows your name now, Milo.');
      G.hud.announce('KING OF THE BAY — campaign complete', 5000);
      marker.visible = false;
      return;
    }
    startMission(current);
  }

  function advance() {
    // Leaving a hold stage starts a 12 s bust grace: the player has
    // just cracked the vault on foot at 4 stars and needs a moment
    // to reach the car — an instant bust the frame the drill ends
    // would make the escape unplayable.
    if (stageDef() && stageDef().t === 'hold') holdEndT = G.time;
    stage++;
    holdT = 0; raceIdx = 0; raceT = 0; spawnedForStage = -1;
    if (stage >= DEFS[current][3].length) { completeMission(); return; }
    G.hud.setMission(DEFS[current][0], objective());
    const s = stageDef();
    if (s.t === 'escape' && s.stars) G.police.setStars(s.stars);
    if (s.t === 'hold' && s.stars) G.police.setStars(s.stars);
  }

  function ensureStageSpawns() {
    const s = stageDef();
    if (spawnedForStage === stage) return;
    spawnedForStage = stage;
    if (s.t === 'kill') {
      G.combat.clearEnemies();
      // Spawn the crew along the nearest road through the waypoint, not
      // in a circle: the dock yard / plaza is full of containers and
      // walls, and a crew member behind a container has no line of
      // sight and cannot be shot (nor shoot back fairly). A road is
      // always open, so the fight is a fair shootout.
      const ax = Math.round(s.x / 48) * 48, az = Math.round(s.z / 48) * 48;
      const alongX = Math.abs(s.x - ax) <= Math.abs(s.z - az);
      for (let k = 0; k < s.n; k++) {
        const off = (k - (s.n - 1) / 2) * 4; // 4 m spacing (was 9): the whole crew stays within the 16 m stand-and-shoot band, so none of them chases at 5.2 m/s while the driver aims
        if (alongX) G.combat.spawnEnemy(ax, s.z + off);
        else G.combat.spawnEnemy(s.x + off, az);
      }
    }
    if (current === 0 && stage === 0 && !m1Car) {
      m1Car = G.vehicles.spawnCar('kestrel', 0, 232, Math.PI, 'parked');
    }
    if (current === 5 && stage === 0 && !cometCar) {
      cometCar = G.vehicles.spawnCar('comet', 96, 48, Math.PI / 2, 'parked');
    }
    if (current === 8 && stage === 0 && !marlinBoat) {
      marlinBoat = G.vehicles.spawnCar('marlin', 298, 0, Math.PI / 2, 'parked'); // 298 (was 300): 2 m off the pier, so it is unambiguously the nearest vehicle to board
    }
  }

  function update(dt, input) {
    if (current >= 10) { marker.visible = false; return; }
    const s = stageDef();
    ensureStageSpawns();
    const p = G.player.p;
    const wp = waypoint();
    if (wp) {
      marker.visible = true;
      marker.position.set(wp.x, 0, wp.z);
      diamond.rotation.y += dt * 2;
      diamond.position.y = 6 + Math.sin(G.time * 2) * 0.6;
    } else marker.visible = false;

    const d = wp ? Math.hypot(p.x - wp.x, p.z - wp.z) : 1e9;
    G.hud.setObjective(objective(), d, wp);

    if (s.t === 'goto' || s.t === 'enter' || s.t === 'escape') {
      if (d < (s.r || 7)) {
        if (s.t === 'enter') {
          // Wait for E near the target (entering the car/boat completes it).
          if (s.what === 'car' && !p.onFoot) advance();
          else if (s.what === 'comet' && p.car === cometCar) advance();
          else if (s.what === 'boat' && p.boat === marlinBoat) advance();
          else if (!s.what && input.takePressed('KeyE')) advance();
        } else {
          advance();
          if (s.t === 'escape') G.police.setStars(0);
        }
      }
    } else if (s.t === 'kill') {
      const left = G.combat.aliveCount();
      G.hud.setObjective(`${s.text} (${left} left)`, d, wp);
      if (left === 0) advance();
    } else if (s.t === 'hold') {
      if (d < (s.r || 7) && input.down('KeyF')) {
        holdT += dt;
        G.hud.setObjective(`${s.text} — ${Math.ceil(s.s - holdT)}s`, d, wp);
        if (holdT >= s.s) advance();
      } else {
        holdT = Math.max(0, holdT - dt * 2);
        G.hud.setObjective(s.text, d, wp);
      }
    } else if (s.t === 'race') {
      raceT += dt;
      const pt = s.pts[raceIdx];
      const rd = Math.hypot(p.x - pt[0], p.z - pt[1]);
      G.hud.setObjective(`${s.text} — gate ${raceIdx + 1}/${s.pts.length} (${Math.ceil(s.time - raceT)}s)`, rd, wp);
      if (rd < s.r) {
        G.audio.pickup();
        raceIdx++;
        if (raceIdx >= s.pts.length) { advance(); return; }
      }
      if (raceT > s.time) {
        // Out of time: restart the race stage.
        G.hud.announce('Out of time — run it again', 2500);
        raceIdx = 0; raceT = 0;
      }
    }
  }

  return {
    update, startMission, name, objective, waypoint,
    get current() { return current; },
    get stage() { return stage; },
    // True while the current stage is a vault-crack hold: the cops
    // close in but do not bust mid-drill (the bust is for the escape,
    // not for standing at the vault — otherwise the hold is impossible
    // at 4 stars). DEFS entries are [name, speaker, dialogue, stages].
    isHoldStage() { const d = DEFS[current]; return !!d && !!d[3][stage] && d[3][stage].t === 'hold'; },
    // True for 12 s after a hold completes (the getaway grace — walk back to the car and get in).
    isHoldGrace() { return (G.time - holdEndT) < 12; },
    // The vehicle kind the current enter stage wants ('car' / 'boat' /
    // 'comet' / null): pressing E near the pier must board the Marlin,
    // not whichever traffic car happens to be closest.
    enterWhat() { const s = stageDef(); return s && s.t === 'enter' ? (s.what || null) : null; },
    // The SPECIFIC vehicle the current enter stage wants (the parked
    // Comet GT, the Marlin) — the stage only advances on that one.
    enterTarget() {
      const s = stageDef();
      if (!s || s.t !== 'enter') return null;
      if (s.what === 'comet') return cometCar;
      if (s.what === 'boat') return marlinBoat;
      return null;
    },
    setCurrent(i) { startMission(i); },
    // Jump straight to a stage (used by the screenshot staging).
    setStage(s) {
      stage = s; holdT = 0; raceIdx = 0; raceT = 0; spawnedForStage = -1;
      G.hud.setMission(DEFS[current][0], objective());
    },
  };
}
