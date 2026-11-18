// Life beyond the story: stunt ramps that launch a speeding car, twelve sun
// medallions hidden around the city, and two checkpoint time trials that can
// be run again and again for a faster time.

import * as THREE from 'three';
import { STUNT_RAMPS, MEDALLIONS } from './config.js';

const TRIALS = [
  {
    id: 'bay-loop',
    name: 'Bay Loop',
    start: { x: 180, z: 180 },
    points: [
      { x: 180, z: -60 }, { x: 60, z: -180 }, { x: -180, z: -60 }, { x: -180, z: 180 }, { x: 0, z: 180 },
    ],
  },
  {
    id: 'marina-sprint',
    name: 'Marina Sprint',
    start: { x: 120, z: 180 },
    points: [
      { x: 180, z: 60 }, { x: 60, z: 60 }, { x: 60, z: 180 }, { x: 180, z: 180 },
    ],
  },
];

export function createActivities(scene, city, rng, hooks) {
  // Stunt ramps: wedges on the roads, striped like a warning.
  const rampMat = new THREE.MeshLambertMaterial({ color: 0xd9a441 });
  const rampEdgeMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const ramps = [];
  for (const ramp of STUNT_RAMPS) {
    const group = new THREE.Group();
    const wedge = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 8), rampMat);
    wedge.position.y = 0.6;
    wedge.rotation.x = -0.42;
    wedge.castShadow = true;
    group.add(wedge);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 0.5), rampEdgeMat);
    edge.position.set(0, 1.9, -3.4);
    group.add(edge);
    group.position.set(ramp.x, 0, ramp.z);
    group.rotation.y = ramp.heading;
    scene.add(group);
    ramps.push({ ...ramp, usedAt: -10 });
  }

  // Sun medallions: spinning golden discs.
  const medalGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.16, 20);
  const medalMat = new THREE.MeshLambertMaterial({ color: 0xffd94a, emissive: 0xa8840a, emissiveIntensity: 0.9 });
  const medallions = MEDALLIONS.map((spot, index) => {
    const mesh = new THREE.Mesh(medalGeo, medalMat);
    mesh.position.set(spot.x, 1.3, spot.z);
    mesh.rotation.x = Math.PI / 2.4;
    scene.add(mesh);
    return { ...spot, mesh, index, taken: false };
  });

  // Trial start posts.
  const postMat = new THREE.MeshLambertMaterial({ color: 0x7ae0c8, emissive: 0x2a8a74, emissiveIntensity: 0.6 });
  for (const trial of TRIALS) {
    const post = new THREE.Mesh(new THREE.OctahedronGeometry(1.1), postMat);
    post.position.set(trial.start.x, 4, trial.start.z);
    scene.add(post);
    trial.marker = post;
  }

  let collected = new Set();
  let airTime = 0;
  let airborne = false;
  let activeTrial = null;
  let trialTime = 0;
  let trialPoint = 0;
  let trialMeshes = [];
  let bestTimes = {};
  let stuntCooldown = 0;

  function startTrial(trial) {
    activeTrial = trial;
    trialTime = 0;
    trialPoint = 0;
    for (const point of trial.points) {
      const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(4, 0.35, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0x7ae0c8 }),
      );
      mesh.position.set(point.x, 3.2, point.z);
      mesh.rotation.y = Math.PI / 2;
      scene.add(mesh);
      trialMeshes.push(mesh);
    }
    hooks.onToast(`${trial.name} — hit every gate!`);
    hooks.onWaypoint(trial.points[0].x, trial.points[0].z, 'Gate');
  }

  function endTrial(finished) {
    for (const mesh of trialMeshes) scene.remove(mesh);
    trialMeshes = [];
    if (finished && activeTrial) {
      const previous = bestTimes[activeTrial.id];
      if (!previous || trialTime < previous) {
        bestTimes[activeTrial.id] = trialTime;
        hooks.onToast(`${activeTrial.name} — new best: ${trialTime.toFixed(1)}s (+$120)`);
        hooks.onMoney(120);
      } else {
        hooks.onToast(`${activeTrial.name} — ${trialTime.toFixed(1)}s (best ${previous.toFixed(1)}s)`);
      }
    }
    activeTrial = null;
    hooks.onWaypoint(null, null, null);
  }

  return {
    get collectedCount() {
      return collected.size;
    },
    get bestTimes() {
      return bestTimes;
    },
    get activeTrial() {
      return activeTrial;
    },
    setCollected(indices) {
      collected = new Set(indices);
      for (const medal of medallions) {
        if (collected.has(medal.index)) {
          medal.taken = true;
          medal.mesh.visible = false;
        }
      }
    },
    getCollectedIndices() {
      return [...collected];
    },
    setBestTimes(times) {
      bestTimes = { ...times };
    },
    update(dt, player, playerCar, carAir) {
      stuntCooldown = Math.max(0, stuntCooldown - dt);
      // Medallions spin; the player collects them on foot or by car.
      for (const medal of medallions) {
        if (medal.taken) continue;
        medal.mesh.rotation.z += dt * 1.8;
        medal.mesh.position.y = 1.3 + Math.sin(performance.now() / 350 + medal.index) * 0.18;
        const dx = player.x - medal.x;
        const dz = player.z - medal.z;
        if (dx * dx + dz * dz < 2.6 * 2.6) {
          medal.taken = true;
          medal.mesh.visible = false;
          collected.add(medal.index);
          hooks.onMedallion(collected.size, MEDALLIONS.length);
        }
      }
      // Stunt ramps: a fast car crossing one goes airborne.
      if (playerCar && playerCar.speed > 16 && stuntCooldown <= 0) {
        for (const ramp of ramps) {
          const dx = playerCar.x - ramp.x;
          const dz = playerCar.z - ramp.z;
          if (dx * dx + dz * dz < 5 * 5) {
            const facing = Math.atan2(Math.sin(playerCar.heading), Math.cos(playerCar.heading));
            let diff = facing - ramp.heading;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            if (Math.abs(diff) < 0.9 || Math.abs(diff) > Math.PI - 0.9) {
              carAir.launch(6.5 + playerCar.speed * 0.12);
              airborne = true;
              airTime = 0;
              stuntCooldown = 3;
              hooks.onToast('STUNT JUMP!');
            }
          }
        }
      }
      if (airborne) {
        airTime += dt;
        if (!carAir.isAirborne()) {
          airborne = false;
          if (airTime > 0.9) {
            const bonus = Math.round(40 + airTime * 30);
            hooks.onMoney(bonus);
            hooks.onToast(`Clean landing! +$${bonus}`);
          }
        }
      }
      // Time trials: start by driving through the marker, then the gates.
      if (!activeTrial && playerCar) {
        for (const trial of TRIALS) {
          const dx = player.x - trial.start.x;
          const dz = player.z - trial.start.z;
          if (dx * dx + dz * dz < 6 * 6) {
            startTrial(trial);
            break;
          }
        }
      }
      if (activeTrial) {
        trialTime += dt;
        hooks.onTimer(trialTime, true);
        const point = activeTrial.points[trialPoint];
        const dx = player.x - point.x;
        const dz = player.z - point.z;
        if (dx * dx + dz * dz < 7 * 7) {
          const mesh = trialMeshes[trialPoint];
          if (mesh) mesh.material.color.set(0x2ecc71);
          trialPoint += 1;
          if (trialPoint >= activeTrial.points.length) {
            endTrial(true);
          } else {
            const next = activeTrial.points[trialPoint];
            hooks.onWaypoint(next.x, next.z, 'Gate');
          }
        }
        if (!playerCar) endTrial(false);
      }
      for (const trial of TRIALS) {
        if (trial.marker) {
          trial.marker.rotation.y += dt;
          trial.marker.position.y = 4 + Math.sin(performance.now() / 400) * 0.3;
        }
      }
    },
  };
}
