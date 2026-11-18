// The story of Solmar Bay: six linked jobs for Pearl Ochoa, from a first
// stolen car to the sunset getaway. Each mission is a list of steps — drive
// somewhere, fight someone, fetch something, outrun the heat — with dialogue
// that plays as the steps land, and a reward when the last one clears.

import * as THREE from 'three';
import { PLACES } from './config.js';

const MISSIONS = [
  {
    id: 'wheels-up',
    title: 'Wheels Up',
    reward: 150,
    brief: [
      ['Pearl', 'Milo. You came back. Good — the city missed its best driver.'],
      ['Pearl', 'First things first: get yourself a car. Any car. Borrowing counts.'],
      ['Pearl', 'Then bring it to Tessa at the garage. She will make it yours.'],
    ],
    steps: [
      { type: 'getCar', text: 'Get in a car — any parked car will do (E)' },
      { type: 'driveTo', place: 'tessasGarage', radius: 10, text: "Drive to Tessa's Garage" },
    ],
    outro: [
      ['Tessa', 'Nice. A little rough, but she runs. I will keep her safe for you.'],
      ['Pearl', 'That is job one done. Come back when you want real money.'],
    ],
  },
  {
    id: 'the-pickup',
    title: 'The Pickup',
    reward: 300,
    unlock: 'pistol',
    brief: [
      ['Pearl', 'Deke Marsh has been leaning on my drivers. Tonight we lean back.'],
      ['Pearl', 'Drive me to the marina meet. And Milo — keep the engine running.'],
    ],
    steps: [
      { type: 'goto', place: 'pearlsOffice', radius: 8, text: 'Meet Pearl at her office' },
      { type: 'driveTo', place: 'marinaMeet', radius: 10, text: 'Drive Pearl to the marina meet' },
      { type: 'kill', count: 2, spawnAt: 'marinaMeet', spread: 14, text: "Deke's crew crashed the meet — fight them off" },
      { type: 'driveTo', place: 'pearlsOffice', radius: 10, text: 'Drive Pearl back to her office' },
    ],
    outro: [
      ['Pearl', 'You handle yourself well. Take this — you will need it.'],
      ['Pearl', 'Deke will not forget tonight. Neither will I.'],
    ],
  },
  {
    id: 'dockside-heat',
    title: 'Dockside Heat',
    reward: 450,
    unlock: 'smg',
    brief: [
      ['Pearl', 'Deke took three of my crates at the docks. I want them back.'],
      ['Tessa', 'His boys are all over the yards. Go loud or go quiet — just come back.'],
    ],
    steps: [
      { type: 'goto', place: 'docks', radius: 14, text: 'Reach the Dockside Yards' },
      { type: 'kill', count: 4, spawnAt: 'docks', spread: 18, text: 'Clear the yards of Deke\u2019s crew' },
      { type: 'collect', count: 3, spawnAt: 'docks', spread: 16, text: 'Recover the 3 crates' },
      { type: 'driveTo', place: 'tessasGarage', radius: 10, text: 'Deliver the crates to Tessa' },
    ],
    outro: [
      ['Tessa', 'Three crates, all accounted for. You are a marvel, Milo.'],
      ['Pearl', 'Deke is going to take this personally. Good.'],
    ],
  },
  {
    id: 'payback-lap',
    title: 'Payback Lap',
    reward: 400,
    brief: [
      ['Pearl', 'Deke brags his drivers own this city. Prove him wrong.'],
      ['Pearl', 'Six checkpoints, two and a half minutes. Beat the clock and the Falcon GT is yours.'],
    ],
    steps: [
      {
        type: 'checkpoints', timeLimit: 150,
        points: [
          { x: -60, z: 60 }, { x: 60, z: 60 }, { x: 120, z: -60 },
          { x: 0, z: -120 }, { x: -120, z: -60 }, { x: -60, z: -30 },
        ],
        text: 'Hit all 6 checkpoints before the clock runs out',
      },
    ],
    outro: [
      ['Pearl', 'Two and a half minutes of pure disrespect. The Falcon is yours.'],
    ],
  },
  {
    id: 'the-swap',
    title: 'The Swap',
    reward: 600,
    brief: [
      ['Pearl', 'A Viceroy is sitting at the Hotel Palmera valet, keys in it, ego attached.'],
      ['Pearl', 'Take it, shake the heat, and park it at the lockup. Clean.'],
    ],
    steps: [
      { type: 'stealMarked', place: 'hotelValet', radius: 9, text: 'Steal the Viceroy from the hotel valet' },
      { type: 'loseHeat', text: 'Lose the heat — hide, or visit the spray shop' },
      { type: 'deliverCar', place: 'lockup', radius: 10, text: 'Deliver the Viceroy to the lockup' },
    ],
    outro: [
      ['Pearl', 'Clean work. The buyer is happy, Deke is furious, and you are richer.'],
    ],
  },
  {
    id: 'solmar-sunset',
    title: 'Solmar Sunset',
    reward: 1000,
    brief: [
      ['Pearl', 'This is it, Milo. Deke is coming for the marina himself.'],
      ['Pearl', 'Hold the docks, then run for Lighthouse Point. Do not stop for anyone.'],
      ['Tessa', 'I left the getaway car fuelled and angry. Go get your sunset.'],
    ],
    steps: [
      { type: 'goto', place: 'marinaMeet', radius: 10, text: 'Meet Pearl at the marina' },
      { type: 'kill', count: 6, spawnAt: 'marinaMeet', spread: 20, text: 'Hold the marina against Deke\u2019s crew' },
      {
        type: 'checkpoints', timeLimit: 120,
        points: [{ x: 180, z: 0 }, { x: 180, z: -120 }, { x: 226, z: -150 }],
        text: 'Run for Lighthouse Point — do not stop',
      },
    ],
    outro: [
      ['Pearl', 'You did it. Solmar Bay is ours again, Milo.'],
      ['Milo', 'Then let us enjoy the sunset. We earned it.'],
    ],
  },
];

export function createMissions(scene, city, combat, rng, hooks) {
  // The waypoint beacon: a glowing pillar and a spinning diamond over it.
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd94a, transparent: true, opacity: 0.35 });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 30, 12, 1, true), beaconMat);
  beacon.visible = false;
  scene.add(beacon);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshBasicMaterial({ color: 0xffd94a }),
  );
  diamond.visible = false;
  scene.add(diamond);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.4, 3.1, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd94a, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene.add(ring);

  // Mission giver marker: a floating "P" over Pearl's office.
  const giverMat = new THREE.MeshBasicMaterial({ color: 0x7ae0c8 });
  const giver = new THREE.Mesh(new THREE.OctahedronGeometry(1.2), giverMat);
  giver.position.set(PLACES.pearlsOffice.x, 7, PLACES.pearlsOffice.z);
  scene.add(giver);

  const crateGeo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
  const crateMat = new THREE.MeshLambertMaterial({ color: 0x8a6a3a });
  const crates = [];
  const checkpointMeshes = [];

  let active = null;
  let stepIndex = 0;
  let stepState = null;
  let dialogueQueue = [];
  let dialogueTimer = 0;
  let currentLine = null;
  let completedCount = 0;
  let failed = false;

  function setWaypoint(x, z, label) {
    beacon.position.set(x, 15, z);
    beacon.visible = true;
    diamond.position.set(x, 6.5, z);
    diamond.visible = true;
    ring.position.set(x, 0.12, z);
    ring.visible = true;
    hooks.onWaypoint(x, z, label);
  }
  function clearWaypoint() {
    beacon.visible = false;
    diamond.visible = false;
    ring.visible = false;
    hooks.onWaypoint(null, null, null);
  }

  function sayLines(lines) {
    dialogueQueue = [...lines];
    dialogueTimer = 0;
    currentLine = null;
  }

  function spawnStepEntities(step) {
    if (step.type === 'kill') {
      const place = PLACES[step.spawnAt];
      stepState.goons = [];
      for (let i = 0; i < step.count; i += 1) {
        const angle = (i / step.count) * Math.PI * 2;
        const gx = place.x + Math.cos(angle) * step.spread * 0.7;
        const gz = place.z + Math.sin(angle) * step.spread * 0.7;
        const resolved = city.resolveCollision(gx, gz, 1);
        stepState.goons.push(combat.spawnGoon(resolved.x, resolved.z, rng));
      }
      stepState.remaining = step.count;
    }
    if (step.type === 'collect') {
      const place = PLACES[step.spawnAt];
      for (let i = 0; i < step.count; i += 1) {
        const angle = (i / step.count) * Math.PI * 2 + 0.5;
        const cx = place.x + Math.cos(angle) * step.spread * 0.6;
        const cz = place.z + Math.sin(angle) * step.spread * 0.6;
        const resolved = city.resolveCollision(cx, cz, 1);
        const mesh = new THREE.Mesh(crateGeo, crateMat);
        mesh.position.set(resolved.x, 0.75, resolved.z);
        mesh.castShadow = true;
        scene.add(mesh);
        crates.push({ mesh, x: resolved.x, z: resolved.z, taken: false });
      }
      stepState.remaining = step.count;
    }
    if (step.type === 'checkpoints') {
      stepState.pointIndex = 0;
      stepState.timeLeft = step.timeLimit;
      for (const point of step.points) {
        const mesh = new THREE.Mesh(
          new THREE.TorusGeometry(4, 0.35, 8, 24),
          new THREE.MeshBasicMaterial({ color: 0xffd94a }),
        );
        mesh.position.set(point.x, 3.2, point.z);
        mesh.rotation.y = Math.PI / 2;
        scene.add(mesh);
        checkpointMeshes.push(mesh);
      }
      const first = step.points[0];
      setWaypoint(first.x, first.z, 'Checkpoint');
    }
    if (step.type === 'stealMarked') {
      hooks.onRequestMarkedCar(step.place);
      const place = PLACES[step.place];
      setWaypoint(place.x, place.z, 'Viceroy');
    }
    if (step.type === 'goto' || step.type === 'driveTo' || step.type === 'deliverCar') {
      const place = PLACES[step.place];
      setWaypoint(place.x, place.z, place.name);
    }
    if (step.type === 'getCar' || step.type === 'loseHeat') {
      clearWaypoint();
    }
  }

  function clearStepEntities() {
    for (const crate of crates) scene.remove(crate.mesh);
    crates.length = 0;
    for (const mesh of checkpointMeshes) scene.remove(mesh);
    checkpointMeshes.length = 0;
  }

  function startStep(index) {
    stepIndex = index;
    const step = active.steps[index];
    stepState = { goons: [], remaining: 0, pointIndex: 0, timeLeft: 0 };
    spawnStepEntities(step);
    hooks.onObjective(step.text, active.title);
  }

  function advanceStep() {
    clearStepEntities();
    hooks.onStepDone();
    if (stepIndex + 1 >= active.steps.length) {
      finishMission(true);
    } else {
      startStep(stepIndex + 1);
    }
  }

  function finishMission(passed) {
    clearStepEntities();
    clearWaypoint();
    combat.clearGoons();
    const mission = active;
    active = null;
    stepState = null;
    if (passed) {
      completedCount += 1;
      hooks.onMissionPassed(mission);
      sayLines(mission.outro);
    } else {
      failed = true;
      hooks.onMissionFailed(mission);
    }
  }

  return {
    get active() {
      return active;
    },
    get completedCount() {
      return completedCount;
    },
    get currentStep() {
      return active ? active.steps[stepIndex] : null;
    },
    get dialogueLine() {
      return currentLine;
    },
    get timeLeft() {
      return stepState ? stepState.timeLeft : 0;
    },
    missionList: MISSIONS,
    setCompleted(count) {
      completedCount = count;
    },
    canStart() {
      return !active && completedCount < MISSIONS.length;
    },
    nextMission() {
      return MISSIONS[completedCount] || null;
    },
    startNext() {
      if (!this.canStart()) return false;
      active = MISSIONS[completedCount];
      failed = false;
      sayLines(active.brief);
      startStep(0);
      hooks.onMissionStarted(active);
      return true;
    },
    failActive(reason) {
      if (!active) return;
      hooks.onToast(reason);
      finishMission(false);
    },
    onGoonDown(goon) {
      if (!active || !stepState) return;
      const step = active.steps[stepIndex];
      if (step.type === 'kill' && stepState.goons.includes(goon)) {
        stepState.remaining -= 1;
        hooks.onObjective(`${step.text} (${Math.max(0, stepState.remaining)} left)`, active.title);
        if (stepState.remaining <= 0) advanceStep();
      }
    },
    onMarkedCarStolen() {
      if (!active) return;
      const step = active.steps[stepIndex];
      if (step.type === 'stealMarked') advanceStep();
    },
    update(dt, player, playerCar, wantedStars) {
      // Dialogue playback: one line at a time, 4.2 seconds each.
      if (currentLine) {
        dialogueTimer -= dt;
        if (dialogueTimer <= 0) {
          currentLine = null;
          hooks.onDialogue(null);
        }
      } else if (dialogueQueue.length > 0) {
        currentLine = dialogueQueue.shift();
        dialogueTimer = 4.2;
        hooks.onDialogue(currentLine);
      }
      // Beacon animation.
      if (beacon.visible) {
        diamond.rotation.y += dt * 2;
        diamond.position.y = 6.5 + Math.sin(performance.now() / 300) * 0.4;
        beaconMat.opacity = 0.28 + Math.sin(performance.now() / 240) * 0.1;
      }
      giver.rotation.y += dt * 1.4;
      giver.position.y = 7 + Math.sin(performance.now() / 400) * 0.35;

      if (!active || !stepState) return;
      const step = active.steps[stepIndex];
      const px = player.x;
      const pz = player.z;
      if (step.type === 'getCar' && playerCar) {
        advanceStep();
        return;
      }
      if (step.type === 'goto' || step.type === 'driveTo' || step.type === 'deliverCar') {
        const place = PLACES[step.place];
        const dx = px - place.x;
        const dz = pz - place.z;
        const inCar = step.type === 'goto' ? true : !!playerCar;
        const rightCar = step.type === 'deliverCar' ? hooks.isDeliverCarValid() : true;
        if (inCar && rightCar && dx * dx + dz * dz < step.radius * step.radius) advanceStep();
        return;
      }
      if (step.type === 'collect') {
        for (const crate of crates) {
          if (crate.taken) continue;
          const dx = px - crate.x;
          const dz = pz - crate.z;
          if (dx * dx + dz * dz < 3.2 * 3.2) {
            crate.taken = true;
            scene.remove(crate.mesh);
            stepState.remaining -= 1;
            hooks.onCrateTaken(stepState.remaining);
            if (stepState.remaining <= 0) advanceStep();
            return;
          }
        }
        return;
      }
      if (step.type === 'checkpoints') {
        stepState.timeLeft -= dt;
        hooks.onTimer(stepState.timeLeft);
        if (stepState.timeLeft <= 0) {
          this.failActive('Out of time — the run is blown.');
          return;
        }
        const point = step.points[stepState.pointIndex];
        const dx = px - point.x;
        const dz = pz - point.z;
        if (dx * dx + dz * dz < 7 * 7) {
          const mesh = checkpointMeshes[stepState.pointIndex];
          if (mesh) mesh.material.color.set(0x2ecc71);
          hooks.onCheckpoint(stepState.pointIndex + 1, step.points.length);
          stepState.pointIndex += 1;
          if (stepState.pointIndex >= step.points.length) {
            advanceStep();
          } else {
            const next = step.points[stepState.pointIndex];
            setWaypoint(next.x, next.z, 'Checkpoint');
          }
        }
        return;
      }
      if (step.type === 'loseHeat' && wantedStars === 0) {
        advanceStep();
      }
    },
  };
}
