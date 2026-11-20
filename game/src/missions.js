// Solmar Bay — story missions and side activities.
// One job: run the mission state machine. A mission is a list of stages from
// config.js; each stage has a goal (reach a marker, talk, win a race, defeat
// enemies, collect and deliver, survive a wanted level, steal a named car).
// Every stage is forgiving — generous radii, no hard fail timers — so a mission
// can always be finished by playing it. Side activities (races, taxi fares,
// collectibles) run on the same stage machinery.

import * as THREE from 'three';
import { MISSIONS, RACES, SAFEHOUSES, WEAPONS } from './config.js';
import { dist2D } from './random.js';

export class Missions {
  constructor(game) {
    this.game = game;
    this.index = 0; // current story mission
    this.done = []; // completed mission ids
    this.stage = 0;
    this.stageState = null;
    this.active = null; // {kind:'story'|'race'|'taxi', ...}
    this.marker = null; // THREE.Mesh for the objective marker
    this.markerRing = null;
    this.coins = []; // collectibles
    this.raceState = null;
    this.taxiState = null;
    this.holdTimer = 0;
    this._buildMarker();
    this._spawnCoins();
  }

  _buildMarker() {
    const g = this.game;
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 14, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
    );
    cyl.position.y = 7;
    g.scene.add(cyl);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.4, 0.18, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0xffd23e }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.25;
    g.scene.add(ring);
    this.marker = cyl; this.markerRing = ring;
    this.marker.visible = false; this.markerRing.visible = false;
  }

  _spawnCoins() {
    // 20 Bay Coins hidden around the city, worth $150 + 10 respect each.
    const spots = [
      [-100, -100], [60, -130], [130, -60], [-160, -30], [30, 80], [-60, 130],
      [170, 20], [-130, 160], [90, 170], [-30, -160], [200, 90], [-190, 60],
      [10, 130], [-80, -60], [150, -130], [-170, -130], [60, 30], [-20, 180],
      [190, 160], [-110, 30],
    ];
    for (const [x, z] of spots) {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7, 0.7, 0.15, 14),
        new THREE.MeshBasicMaterial({ color: 0xffd23e }),
      );
      m.rotation.x = Math.PI / 2;
      m.position.set(x, 1.2, z);
      this.game.scene.add(m);
      this.coins.push({ mesh: m, x, z, taken: false });
    }
  }

  currentMission() { return MISSIONS[this.index] ?? null; }
  currentStage() {
    const m = this.currentMission();
    return m ? m.stages[this.stage] : null;
  }
  objectiveText() {
    if (this.raceState) return this.raceState.text ?? '';
    if (this.active?.kind === 'taxi') return this.taxiState?.text ?? '';
    const m = this.currentMission();
    if (!m) return 'All story missions complete — Bay King. Free roam!';
    const s = this.currentStage();
    if (!s) return m.name + ' — done';
    return `${m.name}: ${s.text}`;
  }

  startStory() {
    const m = this.currentMission();
    if (!m) return;
    this.active = { kind: 'story', mission: m };
    this.stage = 0;
    this._enterStage();
    this.game.hud.banner(`${m.name}`, `${m.giver}: ${m.brief}`);
    this.game.audio.pickup();
  }

  _enterStage() {
    const s = this.currentStage();
    this.stageState = null;
    this.holdTimer = 0;
    if (!s) return;
    const g = this.game;
    if (s.type === 'goto' || s.type === 'talk' || s.type === 'collect' || s.type === 'deliver' || s.type === 'stealNamed' || s.type === 'boat') {
      this._showMarker(s.x, s.z);
    } else if (s.type === 'kill') {
      this._showMarker(s.x, s.z);
      const spawned = g.combat.spawnEnemies(s.x, s.z, s.count, this.currentMission().id);
      this.stageState = { spawned, killed: 0 };
      s.text = s.text.replace(/\(\d+\/\d+\)/, `(0/${s.count})`);
    } else if (s.type === 'survive') {
      this._showMarker(s.x, s.z);
      g.police.setStars(s.wanted ?? 2);
    } else if (s.type === 'race') {
      this._startRace(s.race, s.laps ?? 2, s.boat ?? false, s.text, true);
    } else if (s.type === 'steal') {
      this._hideMarker();
    }
    // The Marlin is moored at the marker: spawn it if it is not there yet,
    // so the stage is always completable (there is no boat in traffic).
    if (s.type === 'boat' && !g.vehicles.some((v) => v.cls === 'boat' && !v.dead)) {
      g.spawnCar('boat', s.x, s.z, 0, { driver: null });
    }
  }

  _showMarker(x, z) {
    this.marker.position.set(x, 7, z);
    this.markerRing.position.set(x, 0.25, z);
    this.marker.visible = true; this.markerRing.visible = true;
    this.markerPos = { x, z };
  }
  _hideMarker() { this.marker.visible = false; this.markerRing.visible = false; this.markerPos = null; }

  // --- races ---
  _raceWaypoints(raceId, boat) {
    if (boat) return [{ x: 190, z: 210 }, { x: 240, z: 260 }, { x: 120, z: 280 }, { x: 60, z: 240 }];
    if (raceId === 'harbour') return [{ x: 130, z: 130 }, { x: 190, z: 60 }, { x: 190, z: -60 }, { x: 60, z: -60 }];
    if (raceId === 'coast') return [{ x: 60, z: 180 }, { x: 190, z: 180 }, { x: 190, z: 60 }, { x: 60, z: 60 }];
    return [{ x: -60, z: -60 }, { x: 60, z: -60 }, { x: 60, z: 60 }, { x: -60, z: 60 }];
  }
  _startRace(raceId, laps, boat, text, isStory = false) {
    const g = this.game;
    const waypoints = this._raceWaypoints(raceId, boat);
    // A car race on foot is unwinnable: give the player a sports car to start in.
    if (!boat && !g.playerCar) {
      const car = g.spawnCar('sports', g.player.x + 4, g.player.z, 0, { driver: 'player' });
      g.player.enterVehicle(car);
      g.playerCar = car;
    }
    // 3 AI racers in sports/muscle cars, starting just behind the player
    const racers = [];
    for (let i = 0; i < 3; i++) {
      const cls = i === 0 ? 'sports' : i === 1 ? 'muscle' : 'sports';
      const v = g.spawnCar(cls, g.player.x - 6 - i * 5, g.player.z - 4, 0, { driver: 'racer' });
      racers.push({ car: v, wp: 0, lap: 0, finished: false });
    }
    this.raceState = { raceId, laps, boat, waypoints, wp: 0, lap: 1, racers, text, place: 1, done: false, story: isStory };
    // A story race keeps the mission as the active kind, so finishing it
    // advances the mission. A side race pauses the story mission: it becomes
    // kind 'race', and finishing it restores whatever was active before.
    if (isStory) {
      // active stays 'story'
    } else {
      this._savedActive = this.active;
      this.active = { kind: 'race', raceId };
    }
    this._showMarker(waypoints[0].x, waypoints[0].z);
  }
  _updateRace(dt) {
    const g = this.game;
    const r = this.raceState;
    if (!r || r.done) return;
    const px = g.playerCar ? g.playerCar.x : g.player.x;
    const pz = g.playerCar ? g.playerCar.z : g.player.z;
    const wp = r.waypoints[r.wp];
    if (dist2D(px, pz, wp.x, wp.z) < 12) {
      r.wp++;
      if (r.wp >= r.waypoints.length) {
        r.wp = 0; r.lap++;
        if (r.lap > r.laps) { this._finishRace(true); return; }
      }
      const next = r.waypoints[r.wp];
      this._showMarker(next.x, next.z);
      g.audio.pickup();
    }
    // AI racers drive the waypoint loop
    let ahead = 0;
    for (const racer of r.racers) {
      if (racer.finished) { ahead++; continue; }
      const w = r.waypoints[racer.wp];
      const dx = w.x - racer.car.x, dz = w.z - racer.car.z;
      const d = Math.hypot(dx, dz);
      if (d < 10) {
        racer.wp++;
        if (racer.wp >= r.waypoints.length) {
          racer.wp = 0; racer.lap++;
          if (racer.lap > r.laps) { racer.finished = true; ahead++; continue; }
        }
      }
      const want = Math.atan2(dx, dz);
      let diff = want - racer.car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      racer.car.drive(1, Math.max(-1, Math.min(1, diff * 1.5)), false, dt, false);
      const prog = racer.lap * r.waypoints.length + racer.wp;
      const myProg = (r.lap - 1) * r.waypoints.length + r.wp;
      if (prog > myProg) ahead++;
    }
    r.place = ahead + 1;
    r.text = `${r.raceId === 'harbour' ? 'Harbour Loop' : r.raceId === 'coast' ? 'Coast Run' : 'Downtown Dash'} — Lap ${Math.min(r.lap, r.laps)}/${r.laps} — P${r.place}/4`;
    // race fail: player wrecked their car
    if (g.playerCar && g.playerCar.dead) this._finishRace(false);
  }
  _finishRace(won) {
    const g = this.game;
    const r = this.raceState;
    r.done = true;
    for (const racer of r.racers) { racer.car.driver = null; }
    this.raceState = null;
    this._hideMarker();
    if (won) {
      const prize = RACES.find((x) => x.id === r.raceId)?.prize ?? 1200;
      g.addCash(prize); g.addRespect(120);
      g.hud.banner('Race won!', `+$${prize}  +120 respect`);
      g.audio.missionDone();
      // only a story race advances the mission; a side race just pays
      if (r.story) this._advanceStage();
    } else {
      g.hud.banner('Race lost', 'Your car was wrecked — try again.');
      g.audio.failed();
      if (r.story) this._restartStage();
    }
    // a side race restores whatever was active before it (usually the story
    // mission, paused); a story race leaves the mission active
    if (!r.story) this.active = this._savedActive ?? null;
  }
  startSideRace(raceId) {
    const race = RACES.find((r) => r.id === raceId);
    if (!race || this.game.cash < race.fee) return false;
    this.game.addCash(-race.fee);
    this._startRace(raceId, race.laps, false, `Win the ${race.name}`);
    return true;
  }

  // --- taxi fares ---
  startTaxi() {
    const g = this.game;
    const ped = g.traffic.nearestPed(g.player.x, g.player.z, 30);
    if (!ped) return false;
    const dest = g.city.roadGraph[Math.floor(Math.random() * g.city.roadGraph.length)];
    this.taxiState = { ped, dest, text: 'Taxi fare: drive the passenger to the marker', timer: 90 };
    this.active = { kind: 'taxi' };
    this._showMarker(dest.x, dest.z);
    ped.fleeing = false;
    return true;
  }
  _updateTaxi(dt) {
    const g = this.game;
    const t = this.taxiState;
    if (!t) return;
    t.timer -= dt;
    const px = g.playerCar ? g.playerCar.x : g.player.x;
    const pz = g.playerCar ? g.playerCar.z : g.player.z;
    t.text = `Taxi fare: ${Math.ceil(t.timer)}s left — reach the marker`;
    if (dist2D(px, pz, t.dest.x, t.dest.z) < 10) {
      const tip = Math.max(50, Math.round(t.timer * 4));
      g.addCash(150 + tip); g.addRespect(25);
      g.hud.banner('Fare complete!', `+$${150 + tip}  +25 respect`);
      g.audio.missionDone();
      this.taxiState = null; this.active = null; this._hideMarker();
    } else if (t.timer <= 0) {
      g.hud.banner('Fare failed', 'The passenger gave up.');
      this.taxiState = null; this.active = null; this._hideMarker();
    }
  }

  _advanceStage() {
    this.stage++;
    const m = this.currentMission();
    if (!m || this.stage >= m.stages.length) { this._completeMission(); return; }
    this._enterStage();
  }
  _restartStage() { this._enterStage(); }

  _completeMission() {
    const g = this.game;
    const m = this.currentMission();
    if (!m) return;
    this.done.push(m.id);
    g.addCash(m.reward.cash);
    g.addRespect(m.reward.respect);
    if (m.grant) {
      g.combat.giveWeapon(m.grant, 64);
      g.hud.toast(`Mara gave you a ${WEAPONS[m.grant].label} — press 2 to use it`);
    }
    g.hud.banner('Mission complete!', `${m.name}  +$${m.reward.cash}  +${m.reward.respect} respect`);
    g.audio.missionDone();
    g.police.setStars(0);
    this.index++;
    this.active = null;
    this.stage = 0; // the next mission starts at its own stage 0
    this._hideMarker();
    if (this.currentMission()) {
      g.hud.toast(`Next mission: ${this.currentMission().name} — press M to start it (or walk to the marker)`);
    } else {
      g.hud.banner('BAY KING', 'Every story mission complete. The Bay is yours.');
    }
  }

  // Called when the player dies: the mission restarts from its current stage.
  onPlayerDeath() {
    if (this.active?.kind === 'story') {
      this.game.combat.clearGroup(this.currentMission()?.id);
      this._enterStage();
    }
  }

  update(dt) {
    const g = this.game;
    // coins
    for (const c of this.coins) {
      if (c.taken) continue;
      c.mesh.rotation.y += dt * 2;
      const px = g.playerCar ? g.playerCar.x : g.player.x;
      const pz = g.playerCar ? g.playerCar.z : g.player.z;
      if (dist2D(px, pz, c.x, c.z) < 2.5) {
        c.taken = true; c.mesh.visible = false;
        g.addCash(150); g.addRespect(10);
        g.hud.toast('Bay Coin +$150  +10 respect');
        g.audio.pickup();
      }
    }
    if (this.raceState) this._updateRace(dt);
    if (this.taxiState) this._updateTaxi(dt);
    if (!this.active || this.active.kind !== 'story') return;
    const m = this.currentMission();
    const s = this.currentStage();
    if (!m || !s) return;
    const px = g.playerCar ? g.playerCar.x : g.player.x;
    const pz = g.playerCar ? g.playerCar.z : g.player.z;
    const inCar = !!g.playerCar;
    switch (s.type) {
      case 'steal':
        if (inCar) this._advanceStage();
        break;
      case 'goto':
      case 'deliver':
        if (dist2D(px, pz, s.x, s.z) < s.radius) this._advanceStage();
        break;
      case 'talk':
      case 'collect':
        // press F once to grab/talk; hold F for the whole hold time when the
        // stage asks for it (down, not hit — hit is only true on one frame)
        if (dist2D(px, pz, s.x, s.z) < s.radius && (s.hold ? g.input.down('KeyF') : g.input.hit('KeyF'))) {
          if (s.hold) {
            this.holdTimer += dt;
            if (this.holdTimer >= s.hold) this._advanceStage();
          } else this._advanceStage();
        } else if (s.hold) this.holdTimer = 0;
        break;
      case 'kill': {
        const killed = (this.stageState?.spawned ?? []).filter((e) => e.dead).length;
        s.text = s.text.replace(/\(\d+\/\d+\)/, `(${killed}/${s.count})`);
        if (killed >= s.count) this._advanceStage();
        break;
      }
      case 'survive':
        if (dist2D(px, pz, s.x, s.z) < s.radius) {
          g.police.setStars(0);
          this._advanceStage();
        }
        break;
      case 'stealNamed':
        if (inCar && g.playerCar.cls === s.vehicle) this._advanceStage();
        break;
      case 'boat':
        if (inCar && g.playerCar.cls === 'boat') this._advanceStage();
        break;
      case 'race':
        break; // handled by _updateRace
    }
  }
}
