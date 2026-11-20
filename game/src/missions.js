// missions.js — the 10 story missions, the street-race and taxi side
// activities, and the race engine. Story races keep the mission active;
// side races and fares PAUSE the mission and restore it afterwards.
// Hold-to-use stages read the held key, never the edge.
import * as THREE from 'three';
import { MISSION_REWARDS, CIRCUITS } from './config.js';
import { Vehicle, spawnBoat } from './vehicles.js';
import { dist, clamp, angleDiff } from './random.js';

export const MISSION_DEFS = [
  {
    id: 1, name: 'First Wheels', giver: 'Mara',
    brief: 'Dario needs a van. Lift one and bring it to the drop-off.',
    stages: [
      { type: 'goto', x: -140, z: 5, r: 12, text: 'Meet Dario at the garage' },
      { type: 'enter', cls: 'van', x: -140, z: 5, r: 14, text: 'Steal the Hauler van (E)' },
      { type: 'drive', x: 140, z: 140, r: 12, text: 'Drive the van to the drop-off' },
    ],
  },
  {
    id: 2, name: 'The Pickup', giver: 'Dario',
    brief: 'Grab the package from Ivy and run it to the Beach House.',
    stages: [
      { type: 'goto', x: 75, z: -145, r: 12, text: "Go to Ivy's Arms" },
      { type: 'interact', x: 75, z: -145, r: 8, key: 'e', text: 'Pick up the package (E)' },
      { type: 'drive', x: 215, z: 145, r: 12, text: 'Deliver the package to the Beach House' },
    ],
  },
  {
    id: 3, name: 'Bay Run', giver: 'Ivy',
    brief: 'Win the Harbour Loop. A Comet GT is waiting at the start line.',
    stages: [
      { type: 'goto', x: 210, z: 0, r: 12, text: 'Get to the Harbour Loop start' },
      { type: 'race', circuit: 'harbour', laps: 2, car: 'sports', text: 'Win the Harbour Loop (2 laps)' },
    ],
  },
  {
    id: 4, name: 'Dockside', giver: 'Sol',
    brief: 'The Vultures are muscling the docks. Clear all six of them.',
    stages: [
      { type: 'goto', x: 240, z: 70, r: 14, text: 'Go to the docks' },
      { type: 'kill', x: 240, z: 70, count: 6, label: 'Vulture', text: 'Take out the Vultures (0/6)' },
    ],
  },
  {
    id: 5, name: 'The Getaway', giver: 'Mara',
    brief: 'The cops are coming. Get to 3 stars, then lose them at the Pier House.',
    stages: [
      { type: 'wanted', stars: 3, text: 'Raise your wanted level to 3 stars' },
      { type: 'escape', x: -215, z: 215, r: 14, text: 'Lose the cops at the Pier House' },
    ],
  },
  {
    id: 6, name: 'Grand Theft Bay', giver: 'Ivy',
    brief: 'A Comet GT is parked downtown. Take it and bring it to the garage.',
    stages: [
      { type: 'goto', x: 0, z: -70, r: 12, text: 'Go downtown' },
      { type: 'enter', cls: 'sports', x: 0, z: -70, r: 14, text: 'Steal the Comet GT (E)' },
      { type: 'drive', x: -140, z: 5, r: 12, text: 'Bring the Comet GT to the garage' },
    ],
  },
  {
    id: 7, name: 'Payback', giver: 'Dario',
    brief: 'Ten Vultures, one plaza. Settle it.',
    stages: [
      { type: 'goto', x: -70, z: 0, r: 14, text: 'Go to the plaza' },
      { type: 'kill', x: -70, z: 0, count: 10, label: 'Vulture', text: 'Take out the Vultures (0/10)' },
    ],
  },
  {
    id: 8, name: 'The Heist', giver: 'Sol',
    brief: 'Crack the vault downtown, then run — the whole city will be after you.',
    stages: [
      { type: 'goto', x: 70, z: -70, r: 12, text: 'Go to the bank' },
      { type: 'hold', x: 70, z: -70, r: 9, seconds: 8, key: 'f', text: 'Hold F to crack the vault' },
      { type: 'escape', x: -245, z: -245, r: 14, text: 'Escape to Mara’s Place (4 stars)' },
    ],
  },
  {
    id: 9, name: 'High Tide', giver: 'Mara',
    brief: 'A Marlin is waiting at the pier. Win the bay race.',
    stages: [
      { type: 'goto', x: 300, z: 90, r: 12, text: 'Go to the pier' },
      { type: 'boatrace', laps: 1, text: 'Win the bay race (1 lap)' },
    ],
  },
  {
    id: 10, name: 'King of the Bay', giver: 'Sol',
    brief: 'Win the Downtown Dash, then finish the Vultures for good.',
    stages: [
      { type: 'goto', x: 0, z: -178, r: 16, text: 'Meet Sol by the Solmar Tower' },
      { type: 'race', circuit: 'downtown', laps: 3, car: 'sports', text: 'Win the Downtown Dash (3 laps)' },
      { type: 'kill', x: 0, z: -70, count: 12, label: 'Vulture', text: 'Take out the Vultures (0/12)' },
    ],
  },
];

// A race: waypoint loop, 3 AI opponents, position by progress.
export class Race {
  constructor(scene, city, circuitKey, laps, boat, playerVehicle) {
    this.scene = scene;
    this.city = city;
    this.circuit = city.circuits[circuitKey];
    this.laps = laps;
    this.boat = boat;
    this.points = this.circuit.points;
    this.playerVehicle = playerVehicle;
    this.playerCp = 0;
    this.playerLap = 0;
    this.finished = false;
    this.playerPlace = 0;
    this.racers = [];
    this.time = 0;
    const start = this.points[0];
    const dir = Math.atan2(this.points[1][0] - start[0], this.points[1][1] - start[1]);
    for (let i = 0; i < 3; i++) {
      const bx = start[0] - Math.sin(dir) * (6 + i * 7);
      const bz = start[1] - Math.cos(dir) * (6 + i * 7);
      const cls = boat ? 'boat' : (i === 0 ? 'sports' : i === 1 ? 'muscle' : 'sedan');
      const v = new Vehicle(scene, cls, bx, bz, dir, { driver: 'racer' });
      v.raceCp = 0;
      v.raceLap = 0;
      v.racePace = 0.68 + i * 0.03 + Math.random() * 0.02;
      v.raceDone = false;
      this.racers.push(v);
    }
  }

  // Total progress in checkpoints (lap * points + cp) for a racer.
  _progress(v) {
    return (v.raceLap || 0) * this.points.length + (v.raceCp || 0);
  }

  playerProgress() {
    return this.playerLap * this.points.length + this.playerCp;
  }

  update(dt, player) {
    this.time += dt;
    if (this.finished) return;
    // Player checkpoint: pass within 18 m of the next point, in order.
    const pv = player.inVehicle || player;
    const next = this.points[(this.playerCp + 1) % this.points.length];
    if (dist(pv.x, pv.z, next[0], next[1]) < 18) {
      this.playerCp++;
      if (this.playerCp >= this.points.length) {
        this.playerCp = 0;
        this.playerLap++;
        if (this.playerLap >= this.laps) {
          this.finished = true;
          this.playerPlace = this._placeAtFinish();
        }
      }
    }
    // AI racers follow the waypoints.
    for (const r of this.racers) {
      if (r.raceDone || r.dead) continue;
      const target = this.points[(r.raceCp + 1) % this.points.length];
      const wantHeading = Math.atan2(target[0] - r.x, target[1] - r.z);
      const steer = clamp(angleDiff(r.heading, wantHeading) * 1.8, -1, 1);
      const cruise = r.topSpeed * r.racePace;
      const throttle = r.speed < cruise ? 0.8 : 0.1;
      r.drive(dt, steer, throttle, this.city, [this.playerVehicle, ...this.racers].filter(Boolean));
      if (dist(r.x, r.z, target[0], target[1]) < 18) {
        r.raceCp++;
        if (r.raceCp >= this.points.length) {
          r.raceCp = 0;
          r.raceLap++;
          if (r.raceLap >= this.laps) r.raceDone = true;
        }
      }
    }
    // If every racer finished before the player, the player cannot win.
    if (this.racers.every((r) => r.raceDone)) {
      this.finished = true;
      this.playerPlace = 4;
    }
  }

  _placeAtFinish() {
    let place = 1;
    const mine = this.playerProgress();
    for (const r of this.racers) {
      if (this._progress(r) > mine) place++;
      else if (r.raceDone) place++;
    }
    return place;
  }

  positionText() {
    const total = this.points.length * this.laps;
    return `P${this._livePlace()}/4 · Lap ${Math.min(this.playerLap + 1, this.laps)}/${this.laps}`;
  }

  _livePlace() {
    let place = 1;
    const mine = this.playerProgress();
    for (const r of this.racers) if (this._progress(r) > mine) place++;
    return place;
  }

  dispose() {
    for (const r of this.racers) r.remove(this.scene);
    this.racers = [];
  }
}

// Runs the story and the side activities. The game passes a ctx with the
// live objects it needs; the manager calls back for rewards and messages.
export class MissionManager {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.nextIndex = 0;
    this.active = null;
    this.paused = null;
    this.side = null;
    this.completed = 0;
    this.raceCycle = 0;
    this._spawned = [];
    // Objective beacon: a light pillar and a floating diamond.
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
    );
    beam.position.y = 30;
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.6),
      new THREE.MeshBasicMaterial({ color: 0xffd24a })
    );
    diamond.position.y = 7;
    this.marker = new THREE.Group();
    this.marker.add(beam);
    this.marker.add(diamond);
    this.marker.visible = false;
    scene.add(this.marker);
    this.markerPos = null;
    this.objectiveText = 'Welcome to Solmar Bay';
    this.time = 0;
  }

  allDone() {
    return this.nextIndex >= MISSION_DEFS.length;
  }

  currentDef() {
    return MISSION_DEFS[this.nextIndex];
  }

  // Where the next mission starts (its first located stage, else Mara's).
  startPosition() {
    const def = this.currentDef();
    if (!def) return null;
    for (const s of def.stages) if (s.x !== undefined) return { x: s.x, z: s.z, r: s.r || 12 };
    return { x: -245, z: -245, r: 12 };
  }

  startMission(ctx) {
    const def = this.currentDef();
    if (!def || this.active || this.side) return false;
    this.active = { def, stageIdx: 0, hold: 0, spawned: [], race: null, raceLostAt: 0 };
    ctx.onMessage(`${def.name} — ${def.brief}`);
    this._beginStage(ctx);
    return true;
  }

  _beginStage(ctx) {
    const a = this.active;
    const s = a.def.stages[a.stageIdx];
    a.hold = 0;
    a.spawned = [];
    if (s.type === 'enter' && s.cls) {
      const v = new Vehicle(this.scene, s.cls, s.x + 4, s.z + 4, Math.PI / 2, { driver: null, owned: true });
      ctx.addVehicle(v);
      a.spawned.push(v);
    } else if (s.type === 'kill') {
      a.spawned = ctx.combat.spawnEnemies(s.x, s.z, s.count, s.label);
    } else if (s.type === 'race') {
      const start = this.city.circuits[s.circuit].points[0];
      let car = ctx.player.inVehicle;
      // A slow car cannot win: a proper race car waits at the start line.
      if (!car || car.def.speed < 34) {
        car = new Vehicle(this.scene, s.car || 'sports', start[0], start[1] - 8, 0, { driver: null, owned: true });
        ctx.addVehicle(car);
        a.spawned.push(car);
        ctx.onMessage(`A ${car.def.name} is waiting at the start line — get in (E).`);
      }
      a.race = new Race(this.scene, this.city, s.circuit, s.laps, false, car);
    } else if (s.type === 'boatrace') {
      const boat = spawnBoat(this.scene, 300, 252, 0);
      ctx.addVehicle(boat);
      a.spawned.push(boat);
      ctx.onMessage('The Marlin is waiting at the pier — board it (E).');
      a.race = new Race(this.scene, this.city, 'harbour', s.laps, true, boat);
      // Bay buoys instead of the harbour loop.
      a.race.points = [[-200, 260], [0, 305], [200, 260], [200, 320], [-200, 320]];
      a.race.circuit = { name: 'Bay Circuit', points: a.race.points };
    } else if (s.type === 'wanted') {
      ctx.police.setStars(s.stars);
    }
    this._updateObjective(ctx);
  }

  _stageText(ctx) {
    const a = this.active;
    if (!a) return '';
    const s = a.def.stages[a.stageIdx];
    if (s.type === 'kill') {
      const left = a.spawned.filter((e) => !e.dead).length;
      return s.text.replace(/\(\d+\/\d+\)/, `(${s.count - left}/${s.count})`);
    }
    if (s.type === 'hold') return `${s.text} (${Math.floor(a.hold)}/${s.seconds}s)`;
    if (s.type === 'race' || s.type === 'boatrace') return a.race ? a.race.positionText() + ' — ' + s.text : s.text;
    return s.text;
  }

  _updateObjective(ctx) {
    if (this.side) {
      this.objectiveText = this.side.text;
      this.markerPos = this.side.markerPos;
      return;
    }
    if (this.active) {
      const a = this.active;
      const s = a.def.stages[a.stageIdx];
      this.objectiveText = `${a.def.name}: ${this._stageText(ctx)}`;
      if (s.type === 'race' || s.type === 'boatrace') {
        if (a.race) {
          const next = a.race.points[(a.race.playerCp + 1) % a.race.points.length];
          this.markerPos = { x: next[0], z: next[1] };
        }
      } else if (s.x !== undefined) {
        this.markerPos = { x: s.x, z: s.z };
      } else {
        this.markerPos = null;
      }
      return;
    }
    if (!this.allDone()) {
      const def = this.currentDef();
      const sp = this.startPosition();
      this.objectiveText = `Next mission: ${def.name} — go to the marker, press E`;
      this.markerPos = sp;
      return;
    }
    this.objectiveText = 'ALL MISSIONS DONE — you are the Bay King';
    this.markerPos = null;
  }

  _advance(ctx) {
    const a = this.active;
    a.stageIdx++;
    if (a.stageIdx >= a.def.stages.length) {
      const reward = MISSION_REWARDS[a.def.id - 1];
      ctx.onReward(reward.cash, reward.respect, `${a.def.name} complete: +$${reward.cash}, +${reward.respect} respect`);
      ctx.audio.missionDone();
      if (a.def.id === 3) {
        ctx.combat.giveWeapon('smg', 96);
        ctx.onMessage('Ivy gave you an SMG (press 2).');
      }
      if (a.race) { a.race.dispose(); a.race = null; }
      this.completed++;
      this.nextIndex++;
      this.active = null;
    } else {
      this._beginStage(ctx);
    }
    this._updateObjective(ctx);
  }

  // The active mission's current stage wants this E press (interact).
  wantsInteract(ctx) {
    if (!this.active) return false;
    const s = this.active.def.stages[this.active.stageIdx];
    if (s.type !== 'interact') return false;
    return dist(ctx.player.x, ctx.player.z, s.x, s.z) < s.r;
  }

  // Is the player at the next mission's start marker? (E starts it there,
  // and that beats entering a nearby car.)
  nearStartMarker(ctx) {
    if (this.active || this.side || this.allDone()) return false;
    const sp = this.startPosition();
    if (!sp) return false;
    return dist(ctx.player.x, ctx.player.z, sp.x, sp.z) < (sp.r || 12);
  }

  // Start the next mission from its marker (called by the game's E key).
  tryStartAtMarker(ctx) {
    if (this.active || this.side || this.allDone()) return false;
    const sp = this.startPosition();
    if (!sp) return false;
    if (dist(ctx.player.x, ctx.player.z, sp.x, sp.z) < (sp.r || 12)) {
      return this.startMission(ctx);
    }
    return false;
  }

  update(dt, ctx) {
    this.time += dt;
    if (this.side) {
      this._updateSide(dt, ctx);
      this._updateObjective(ctx);
      this._animateMarker(dt);
      return;
    }
    if (!this.active) {
      // The next mission waits at its start marker (E starts it).
      this._updateObjective(ctx);
      this._animateMarker(dt);
      return;
    }
    const a = this.active;
    const s = a.def.stages[a.stageIdx];
    const p = ctx.player;
    const at = (x, z, r) => dist(p.x, p.z, x, z) < r;
    let done = false;
    switch (s.type) {
      case 'goto':
      case 'drive':
      case 'escape':
        if (at(s.x, s.z, s.r)) {
          if (s.type === 'escape') ctx.police.clear();
          done = true;
        }
        break;
      case 'interact':
        if (at(s.x, s.z, s.r) && ctx.input.wasHit(s.key || 'e')) done = true;
        break;
      case 'enter':
        if (p.inVehicle && (!s.cls || p.inVehicle.cls === s.cls)) done = true;
        break;
      case 'kill':
        if (a.spawned.every((e) => e.dead)) done = true;
        break;
      case 'hold':
        if (at(s.x, s.z, s.r) && ctx.input.isDown(s.key || 'f')) {
          a.hold += dt;
          if (a.hold >= s.seconds) {
            done = true;
            if (a.def.id === 8) ctx.police.setStars(4);
          }
        } else {
          a.hold = Math.max(0, a.hold - dt * 2);
        }
        break;
      case 'wanted':
        if (ctx.police.stars >= s.stars) done = true;
        break;
      case 'race':
      case 'boatrace': {
        if (!a.race) break;
        a.race.update(dt, p);
        if (a.race.finished) {
          if (a.race.playerPlace === 1) {
            ctx.onMessage(a.race.boat ? 'Bay race won!' : 'Race won!');
            a.race.dispose();
            a.race = null;
            done = true;
          } else {
            ctx.onMessage(`Finished P${a.race.playerPlace} — race restarts.`);
            a.race.dispose();
            a.race = null;
            this._beginStage(ctx); // re-spawn the race
          }
        }
        break;
      }
      default:
        break;
    }
    if (done) this._advance(ctx);
    else this._updateObjective(ctx);
    this._animateMarker(dt);
  }

  _animateMarker(dt) {
    if (!this.markerPos) { this.marker.visible = false; return; }
    this.marker.visible = true;
    this.marker.position.set(this.markerPos.x, 0, this.markerPos.z);
    this.marker.children[1].position.y = 7 + Math.sin(this.time * 3) * 0.8;
    this.marker.children[1].rotation.y += dt * 2;
  }


  // ---- side activities: T starts a street race (in a car) or a taxi
  // fare (on foot). Both PAUSE the story mission and restore it after.
  trySideActivity(ctx) {
    if (this.side) return false;
    const p = ctx.player;
    if (p.inVehicle) {
      // Street race: cycle the three circuits. $200 entry fee.
      if (ctx.cash < 200) { ctx.onMessage('Street race needs a $200 entry fee.'); return false; }
      ctx.onSpend(200);
      const keys = ['harbour', 'downtown', 'coast'];
      const key = keys[this.raceCycle % keys.length];
      this.raceCycle++;
      this.paused = this.active;
      this.active = null;
      const race = new Race(this.scene, this.city, key, CIRCUITS[key].laps, false, p.inVehicle);
      this.side = { type: 'race', race, circuit: key, text: `Street race: ${CIRCUITS[key].name} — win $1200 + $500`, markerPos: null };
      ctx.onMessage(`Street race: ${CIRCUITS[key].name} ($200 fee). Win it!`);
      return true;
    }
    // Taxi fare: a cab and a passenger appear nearby.
    const cab = new Vehicle(this.scene, 'taxi', p.x + 8, p.z + 8, 0, { driver: null });
    ctx.addVehicle(cab);
    const dests = [[140, 140], [-140, -70], [210, -140], [0, 210], [-210, -210]];
    const dest = dests[Math.floor(Math.random() * dests.length)];
    this.paused = this.active;
    this.active = null;
    this.side = {
      type: 'taxi', phase: 'pickup', cab, dest,
      text: 'Taxi fare: get in the cab, then pick up the passenger',
      markerPos: { x: p.x + 14, z: p.z + 14 },
      passenger: { x: p.x + 14, z: p.z + 14 },
    };
    ctx.onMessage('Taxi fare: get in the cab (E).');
    return true;
  }

  _updateSide(dt, ctx) {
    const s = this.side;
    const p = ctx.player;
    if (s.type === 'race') {
      s.race.update(dt, p);
      s.text = `Street race: ${CIRCUITS[s.circuit].name} — ${s.race.positionText()}`;
      const next = s.race.points[(s.race.playerCp + 1) % s.race.points.length];
      s.markerPos = { x: next[0], z: next[1] };
      if (s.race.finished) {
        if (s.race.playerPlace === 1) {
          ctx.onReward(1700, 120, 'Street race won: +$1700, +120 respect');
          ctx.audio.missionDone();
        } else {
          ctx.onMessage(`Street race: finished P${s.race.playerPlace}. Fee lost.`);
        }
        s.race.dispose();
        this.side = null;
        this.active = this.paused;
        this.paused = null;
        if (this.active) this._updateObjective(ctx);
      }
      return;
    }
    // Taxi fare.
    if (s.phase === 'pickup') {
      if (p.inVehicle) {
        s.phase = 'ride';
        s.text = 'Taxi fare: drive the passenger to the marker';
        s.markerPos = { x: s.dest[0], z: s.dest[1] };
        ctx.onMessage('Passenger aboard — drive to the marker.');
      }
      return;
    }
    if (s.phase === 'ride') {
      if (!p.inVehicle) { s.phase = 'pickup'; s.markerPos = s.passenger; return; }
      if (dist(p.x, p.z, s.dest[0], s.dest[1]) < 12) {
        const fare = 60 + Math.round(dist(s.passenger.x, s.passenger.z, s.dest[0], s.dest[1]) * 1.5);
        ctx.onReward(fare, 20, `Taxi fare complete: +$${fare}, +20 respect`);
        ctx.audio.pickup();
        this.side = null;
        this.active = this.paused;
        this.paused = null;
        if (this.active) this._updateObjective(ctx);
      }
    }
  }

  cancelSide(ctx) {
    if (!this.side) return;
    if (this.side.type === 'race' && this.side.race) this.side.race.dispose();
    this.side = null;
    this.active = this.paused;
    this.paused = null;
    this._updateObjective(ctx);
  }
}
