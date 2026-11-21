// The story: ten linked missions for Mara, Dario, Ivy and Sol.
// A mission is a list of stages; each stage completes when its
// condition is met, then the next begins. Rewards pay cash + respect
// and unlock weapons. The driver (and the player) reads G.missions.
import * as THREE from 'three';
import { MISSIONS, RANKS } from './config.js';
import { dist } from './random.js';
import { makeVehicle } from './vehicles.js';

export function createMissions(G) {
  const M = {
    index: 0,            // 0-based mission index; 10 = campaign done
    stage: 0,
    stageT: 0,           // time in the current stage
    race: null,          // active checkpoint race {points, next, limit, t, prize, kind}
    holdT: 0,            // vault hold progress
    wantedVehicle: null, // class the current stage wants the player to enter
    objective: null,     // {x, z, text} for the HUD + minimap + beam
    beam: null,          // gold objective beam mesh
    diamond: null,       // gold objective diamond mesh
  };
  G.missions = M;

  // Objective beam + diamond, a tall gold pillar marking the target.
  const beamGeo = new THREE.CylinderGeometry(1.2, 1.2, 60, 10, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
  M.beam = new THREE.Mesh(beamGeo, beamMat);
  M.beam.visible = false;
  G.scene.add(M.beam);
  const diaGeo = new THREE.OctahedronGeometry(1.6);
  const diaMat = new THREE.MeshBasicMaterial({ color: 0xffd23e });
  M.diamond = new THREE.Mesh(diaGeo, diaMat);
  M.diamond.visible = false;
  G.scene.add(M.diamond);

  M.shotTitle = null; // staged-shot display title (overrides the mission title)
  M.mission = () => MISSIONS[M.index] || null;
  M.currentStage = () => {
    const m = M.mission();
    return m ? m.stages[M.stage] : null;
  };
  M.rankName = function () {
    let name = RANKS[0].name;
    for (const r of RANKS) if (G.cash !== undefined && G.respect >= r.at) name = r.name;
    return name;
  };

  M.setObjective = function (x, z, text) {
    M.objective = { x, z, text };
    M.beam.position.set(x, 30, z);
    M.beam.visible = true;
    M.diamond.position.set(x, 8, z);
    M.diamond.visible = true;
  };
  M.clearObjective = function () {
    M.objective = null;
    M.beam.visible = false;
    M.diamond.visible = false;
  };

  M.restoreObjective = function () {
    // Re-show the current stage's objective without re-running its
    // setup (no crew respawn, no timer reset) — used after a side
    // activity borrowed the objective beam.
    const st = M.currentStage();
    if (!st) { M.clearObjective(); return; }
    if (st.kind === 'go' || st.kind === 'drive' || st.kind === 'escape' || st.kind === 'hold') {
      M.setObjective(st.x, st.z, st.text);
    } else if (st.kind === 'kill') {
      const left = G.combat.aliveCount();
      M.setObjective(st.cx, st.cz, st.text.replace(/\(\d+ left\)/, `(${left} left)`));
    } else if ((st.kind === 'race' || st.kind === 'boat') && M.race) {
      M.setObjective(M.race.points[M.race.next].x, M.race.points[M.race.next].z, st.text);
    } else M.clearObjective();
    G.hud.updateMission();
  };

  M.startMission = function (i) {
    M.index = i; M.stage = 0; M.stageT = 0; M.holdT = 0; M.race = null;
    G.combat.clearCrew();
    M.wantedVehicle = null;
    M.shotTitle = null;
    const m = M.mission();
    if (!m) { M.clearObjective(); G.hud.toast('Campaign complete — you are the Bay King'); return; }
    G.hud.toast(`${m.title} — ${m.giver}: ${m.brief}`);
    M.beginStage();
  };

  M.beginStage = function () {
    const st = M.currentStage();
    if (!st) { M.completeMission(); return; }
    M.stageT = 0; M.holdT = 0;
    M.wantedVehicle = st.vehicle || null;
    if (st.kind === 'go' || st.kind === 'drive' || st.kind === 'escape') {
      M.setObjective(st.x, st.z, st.text);
    } else if (st.kind === 'kill') {
      M.setObjective(st.cx, st.cz, st.text);
      G.combat.spawnCrew(st.count, st.cx, st.cz);
    } else if (st.kind === 'hold') {
      M.setObjective(st.x, st.z, st.text);
    } else if (st.kind === 'enter') {
      M.clearObjective();
    } else if (st.kind === 'race' || st.kind === 'boat') {
      M.race = { points: st.points, next: 0, limit: st.limit, t: 0, prize: st.prize || 0, kind: st.kind, text: st.text };
      M.setObjective(st.points[0].x, st.points[0].z, st.text);
    }
    G.hud.updateMission();
  };

  M.advance = function () {
    M.stage++;
    const m = M.mission();
    if (!m || M.stage >= m.stages.length) { M.completeMission(); return; }
    M.beginStage();
  };

  M.completeMission = function () {
    const m = M.mission();
    if (!m) return;
    G.cash += m.reward.cash;
    G.respect += m.reward.respect;
    if (m.reward.unlock) {
      G.combat.give(m.reward.unlock);
      G.hud.toast(`Unlocked the ${m.reward.unlock === 'smg' ? 'K9 SMG' : m.reward.unlock === 'shotgun' ? 'Riot 12' : 'Longshot'}!`);
    }
    G.audio.missionOk();
    G.audio.cash();
    G.hud.toast(`${m.title} complete! +$${m.reward.cash}  +${m.reward.respect} respect`);
    G.hud.showBanner(m.title + ' COMPLETE');
    setTimeout(() => G.hud.hideBanner(), 1600);
    M.index++;
    M.stage = 0;
    G.combat.clearCrew();
    M.wantedVehicle = null;
    if (M.index < MISSIONS.length) {
      setTimeout(() => {
        if (G.state === 'playing' && !(G.activities && (G.activities.race || G.activities.taxi))) M.startMission(M.index);
      }, 1800);
    } else {
      M.clearObjective();
      G.hud.updateMission();
    }
  };

  M.onKill = function () {
    const st = M.currentStage();
    if (!st || st.kind !== 'kill') return;
    const left = G.combat.aliveCount();
    if (st.count - left > 0) {
      const txt = st.text.replace(/\(\d+ left\)/, `(${left} left)`);
      if (M.objective) M.objective.text = txt;
      G.hud.updateMission();
    }
    if (left <= 0) M.advance();
  };

  M.failRace = function (reason) {
    G.hud.toast(reason + ' — race failed, try again');
    M.race = null;
    M.beginStage(); // restart the stage
  };

  M.step = function (dt) {
    const m = M.mission();
    if (!m || G.state !== 'playing') return;
    const st = M.currentStage();
    if (!st) return;
    M.stageT += dt;
    const P = G.player;
    // Objective diamond spins; beam pulses.
    if (M.diamond.visible) {
      M.diamond.rotation.y += dt * 2;
      M.diamond.position.y = 8 + Math.sin(G.time * 2) * 0.8;
    }
    const dObj = M.objective ? dist(P.x, P.z, M.objective.x, M.objective.z) : 9999;

    if (st.kind === 'go') {
      if (dObj < st.r) M.advance();
    } else if (st.kind === 'drive') {
      if (P.vehicle && dObj < st.r) M.advance();
    } else if (st.kind === 'enter') {
      if (P.vehicle && P.vehicle.type === st.vehicle) M.advance();
    } else if (st.kind === 'escape') {
      if (M.stageT < 0.5) G.police.setWanted(Math.max(G.police.wanted, st.wanted || 3));
      if (dObj < st.r) { G.police.setWanted(0); M.advance(); }
    } else if (st.kind === 'hold') {
      const inR = dObj < st.r;
      const holding = G.input.isDown('punch') || G.input.mouseDown;
      if (inR && holding) {
        M.holdT += dt;
        if (M.holdT >= st.secs) {
          P.vaultGrace = 12; // no bust mid-vault, 12 s to reach the car
          G.police.setWanted(Math.max(G.police.wanted, 3));
          G.audio.cash();
          M.advance();
        }
      } else if (!inR) {
        M.holdT = Math.max(0, M.holdT - dt * 2);
      }
      if (M.objective) M.objective.text = `${st.text} (${Math.ceil(Math.max(0, st.secs - M.holdT))}s)`;
    } else if (st.kind === 'race' || st.kind === 'boat') {
      const R = M.race;
      if (!R) return;
      R.t += dt;
      const pt = R.points[R.next];
      const d = dist(P.x, P.z, pt.x, pt.z);
      if (d < 10) {
        R.next++;
        G.audio.pickup();
        if (R.next >= R.points.length) {
          M.race = null;
          M.advance();
          return;
        }
        M.setObjective(R.points[R.next].x, R.points[R.next].z, st.text);
      }
      if (M.objective) {
        M.objective.text = `${st.text} — checkpoint ${R.next + 1}/${R.points.length} (${Math.ceil(Math.max(0, R.limit - R.t))}s)`;
      }
      if (R.t > R.limit) M.failRace('Out of time');
    }
  };

  // Mission vehicles parked in the world.
  M.spawnMissionVehicles = function () {
    // The Kestrel for m1, parked at the Palm Court curb.
    const k = makeVehicle(G, 'kestrel', -96, 92, Math.PI / 2, 'parked');
    k.driver = null;
    // The Comet GT for m6, in the north yards.
    const c = makeVehicle(G, 'comet', -48, -140, 0, 'parked');
    c.driver = null;
    // The Marlin for m9, moored at the pier (reachable from the pier end).
    const b = makeVehicle(G, 'marlin', 300, 104, Math.PI / 2, 'parked');
    b.driver = null; b.kind = 'boat';
    // A Stallion bike near the bank for flavour.
    const s = makeVehicle(G, 'stallion', 56, 44, Math.PI, 'parked');
    s.driver = null;
  };
  return M;
}
