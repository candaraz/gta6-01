// Solmar Bay — the game itself.
// One job: own the loop and the glue. Boot Three.js, build the city, wire the
// player, vehicles, traffic, police, combat, missions, garage, HUD, audio and
// saves into one state machine (menu / playing / paused / dead), and expose a
// small debug hook (window.__solmar) so play-tests can drive it headlessly.

import * as THREE from 'three';
import { WORLD, PLAYER, VEHICLES, WEAPONS, RACES, SAFEHOUSES, GUN_SHOP, SAVE_KEY } from './config.js';
import { makeRng, clamp, dist2D } from './random.js';
import { City, cityHalf, onRoad, inWater } from './city.js';
import { Player } from './player.js';
import { Vehicle } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Effects } from './effects.js';
import { Missions } from './missions.js';
import { Garage, respectRank } from './garage.js';
import { HUD } from './hud.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { CameraRig } from './camera.js';
import { saveGame, loadGame, hasSave, saveSettings, loadSettings } from './save.js';
import { applyShot } from './shots.js';

export class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
    this.clock = new THREE.Clock();
    this.rng = makeRng(20261121);
    this.settings = {
      master: 0.8, music: 0.55, sfx: 0.9, quality: 'high', sens: 1,
      ...(loadSettings() ?? {}),
    };
    this.audio = new AudioEngine();
    this.audio.setVolumes({ master: this.settings.master, music: this.settings.music, sfx: this.settings.sfx });
    this.input = new Input(this.canvas);
    this.cameraRig = new CameraRig(this.camera);
    this.city = new City(this.scene);
    this.effects = new Effects(this.scene);
    this.player = new Player(this.scene, -19, -70); // on the road by Mara's Garage
    this.player.heading = Math.PI; // face north, toward the garage
    this.playerCar = null;
    this.vehicles = []; // owned/spawned cars the player can use (not traffic)
    this.traffic = new Traffic(this.scene, this.city);
    this.police = new Police(this.scene, this.city);
    this.combat = new Combat(this.scene, this.city, this.effects);
    this.missions = new Missions(this);
    this.garage = new Garage(this);
    this.hud = new HUD(this);
    this.cash = PLAYER.startCash;
    this.respect = 0;
    this.state = 'menu'; // menu | playing | paused | dead
    this.playing = false;
    this.aiming = false;
    this.shot = new URLSearchParams(location.search).get('shot');
    this._wantedStingAt = 0;
    this._spawnTimer = 0;
    this._raceIndex = 0; // which street-race circuit T starts next
    this._applyQuality();
    window.addEventListener('resize', () => this._resize());
    // debug hook for headless play-tests: state + helpers, no gameplay effect
    window.__solmar = {
      game: this,
      state: () => ({
        state: this.state,
        cash: this.cash, respect: this.respect,
        mission: this.missions.currentMission()?.id ?? null,
        stage: this.missions.stage,
        objective: this.missions.objectiveText(),
        wanted: this.police.stars,
        health: this.player.health,
        inCar: !!this.playerCar,
        carCls: this.playerCar?.cls ?? null,
        speed: this.playerCar ? Math.abs(this.playerCar.speed) : 0,
        x: this.playerCar ? this.playerCar.x : this.player.x,
        z: this.playerCar ? this.playerCar.z : this.player.z,
        enemies: this.combat.enemiesAlive(),
        audioRunning: this.audio.running,
        station: this.audio.stationName,
      }),
      startMission: (i) => { this.missions.index = i; this.missions.startStory(); },
      teleport: (x, z) => {
        if (this.playerCar) { this.playerCar.x = x; this.playerCar.z = z; }
        else { this.player.x = x; this.player.z = z; }
      },
      giveCash: (n) => { this.addCash(n); },
      setWanted: (n) => this.police.setStars(n),
      completeStage: () => this.missions._advanceStage(),
    };
    this._showMenu();
  }

  _resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  _applyQuality() {
    const q = this.settings.quality;
    this.renderer.shadowMap.enabled = q !== 'low';
    this.renderer.setPixelRatio(q === 'low' ? 1 : Math.min(window.devicePixelRatio, 2));
  }
  applySettings() {
    this._applyQuality();
    this.audio.setVolumes({ master: this.settings.master, music: this.settings.music, sfx: this.settings.sfx });
    saveSettings(this.settings);
  }
  toggleMute() { this.audio.setMuted(!this.audio.muted); }

  // --- flow ---
  _showMenu() {
    this.state = 'menu';
    this.playing = false;
    this.hud.showStart(hasSave());
  }
  newGame() {
    this.cash = PLAYER.startCash;
    this.respect = 0;
    this.missions.index = 0;
    this.missions.done = [];
    this.missions.stage = 0;
    this.missions.active = null;
    this.combat.clearGroup();
    this.police.clear();
    this.player.reset(-19, -70);
    this.player.heading = Math.PI;
    this.playerCar = null;
    this.combat.weapon = 'pistol';
    this.combat.ammo = { pistol: 48, smg: 0, shotgun: 0, rifle: 0 };
    this.combat.mag = { pistol: 12, smg: 0, shotgun: 0, rifle: 0 };
    this.start();
  }
  continueGame() {
    const data = loadGame();
    if (!data) { this.newGame(); return; }
    this.cash = data.cash;
    this.respect = data.respect;
    this.missions.index = data.missionIndex;
    this.missions.done = data.missionsDone ?? [];
    this.missions.stage = 0;
    this.missions.active = null;
    this.combat.ammo = data.ammo ?? this.combat.ammo;
    this.combat.mag = data.mag ?? this.combat.mag;
    this.combat.weapon = 'pistol';
    this.player.reset(data.player.x, data.player.z);
    this.player.health = data.health ?? PLAYER.maxHealth;
    this.player.armour = data.armour ?? 0;
    if (data.car) {
      const car = this.spawnCar(data.car.cls, data.car.x, data.car.z, data.car.heading, { driver: 'player' });
      car.hp = data.car.hp ?? car.maxHp;
      this.player.enterVehicle(car);
      this.playerCar = car;
    }
    this.start();
    this.hud.toast('Welcome back to Solmar Bay');
  }
  start() {
    this.state = 'playing';
    this.playing = true;
    this.hud.show(this.hud.el.menu, false);
    this.hud.show(this.hud.el.pause, false);
    this.hud.show(this.hud.el.hud, true);
    // snap the camera behind the player so the first frame is already a
    // proper third-person view, never the high establishing shot
    this.cameraRig.snap(this.playerCar ? this.playerCar.heading : this.player.heading);
    this.audio.ensure();
    if (this.shot) applyShot(this, this.shot);
    else if (!this.missions.active) this.missions.startStory();
  }
  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.playing = false;
    this.hud.showPause();
  }
  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.playing = true;
    this.hud.show(this.hud.el.pause, false);
    this.hud.show(this.hud.el.menu, false);
    this.audio.ensure();
  }
  toMenu() {
    this.saveNow();
    this._showMenu();
  }
  saveNow() {
    saveGame({
      cash: this.cash, respect: this.respect,
      missionIndex: this.missions.index, missionsDone: this.missions.done,
      weapons: this.combat.weapon, ammo: this.combat.ammo, mag: this.combat.mag,
      owned: this.garage.owned, upgrades: this.garage.upgrades,
      safehouses: [], radio: this.audio.station,
      playerX: this.player.x, playerZ: this.player.z,
      health: this.player.health, armour: this.player.armour,
      car: this.playerCar ? { cls: this.playerCar.cls, x: this.playerCar.x, z: this.playerCar.z, heading: this.playerCar.heading, hp: this.playerCar.hp } : null,
    });
  }
  addCash(n) { this.cash = Math.max(0, this.cash + n); }
  addRespect(n) { this.respect = Math.max(0, this.respect + n); }

  spawnCar(cls, x, z, heading, opts = {}) {
    const v = new Vehicle(this.scene, cls, x, z, heading, opts);
    this.vehicles.push(v);
    return v;
  }

  // --- per-frame ---
  loop = () => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.state === 'playing') this.update(dt);
    this.hud.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  };

  update(dt) {
    const input = this.input;
    // global keys
    if (input.hit('Escape') || input.hit('KeyP')) { this.pause(); return; }
    if (input.hit('KeyM')) this.toggleMute();
    if (input.hit('KeyR')) { this.audio.nextStation(); this.hud.toast(`Radio: ${this.audio.stationName}`); }
    if (input.hit('KeyC')) this.cameraRig.cycleMode();
    if (input.hit('Digit1')) this.combat.select('pistol');
    if (input.hit('Digit2')) this.combat.select('smg');
    if (input.hit('Digit3')) this.combat.select('shotgun');
    if (input.hit('Digit4')) this.combat.select('rifle');
    if (input.hit('KeyQ')) this.combat.cycle();

    // --- entering / exiting vehicles ---
    const px = this.playerCar ? this.playerCar.x : this.player.x;
    const pz = this.playerCar ? this.playerCar.z : this.player.z;
    if (input.hit('KeyE')) {
      if (this.playerCar) {
        this.player.exitVehicle();
        this.playerCar = null;
        this.audio.click();
      } else {
        // nearest traffic car (carjack) or a driverless spawned vehicle
        // (the Marlin boat, a race car the player was given)
        const car = this.traffic.nearestCar(this.player.x, this.player.z, 4);
        if (car) {
          // carjack: pull the driver out (they flee), take the car, +1 star
          this.traffic.scare(car.x, car.z, 10);
          const v = this.spawnCar(car.cls, car.x, car.z, car.heading, { driver: 'player' });
          v.speed = car.speed;
          this.scene.remove(car.mesh);
          this.traffic.cars.splice(this.traffic.cars.indexOf(car), 1);
          this.player.enterVehicle(v);
          this.playerCar = v;
          this.police.addCrime(0.18, v.x, v.z);
          this.hud.toast('Carjacked! The cops noticed.');
          this.audio.wanted();
        } else {
          // a driverless spawned vehicle (the Marlin boat, a gifted race car):
          // board it freely, no crime
          const owned = this.vehicles.find((v) => !v.dead && !v.driver && dist2D(this.player.x, this.player.z, v.x, v.z) < 4);
          if (owned) {
            owned.driver = 'player';
            this.player.enterVehicle(owned);
            this.playerCar = owned;
            this.audio.click();
            if (owned.cls === 'boat') this.hud.toast('Aboard the Marlin — run the buoys!');
          }
        }
      }
    }

    // --- movement ---
    const fwd = input.axis('KeyS', 'KeyW');
    const strafe = input.axis('KeyA', 'KeyD');
    const yaw = this.cameraRig.yaw;
    // forward is away from the camera: the camera sits at target minus
    // (sin yaw, cos yaw) * dist, so camera-forward is +(sin yaw, cos yaw)
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const rx = -fz, rz = fx;
    const moveX = fx * fwd + rx * strafe;
    const moveZ = fz * fwd + rz * strafe;
    if (this.playerCar) {
      const car = this.playerCar;
      const nitro = input.down('ShiftLeft') && car.nitro > 0;
      car.drive(fwd, strafe, input.down('Space'), dt, nitro);
      // collide with buildings
      const pos = this.city.collide(car.x, car.z, 1.6);
      if (pos.x !== car.x || pos.z !== car.z) {
        if (Math.abs(car.speed) > 8) { car.damage(8, pos.x, pos.z); this.audio.collision(true); this.effects.sparks(car.x, 1, car.z); }
        car.x = pos.x; car.z = pos.z; car.speed *= 0.5;
      }
      // collide with traffic cars (soft)
      for (const t of this.traffic.cars) {
        if (dist2D(car.x, car.z, t.x, t.z) < 3.2) {
          car.damage(2, t.x, t.z); car.speed *= 0.9;
          t.speed = Math.max(0, t.speed - 4);
          if (Math.abs(car.speed) > 10) this.audio.collision(false);
        }
      }
      // water: a car in the bay sinks (respawn on shore) — boats float
      if (car.cls !== 'boat' && inWater(car.x, car.z)) {
        car.damage(100, car.x, car.z);
        this.player.exitVehicle();
        this.playerCar = null;
        this.player.reset(car.x, 200);
        this.hud.toast('Your car sank in the bay!');
      }
      // skid marks + engine sound
      if (Math.abs(car.speed) > 20 && (input.down('Space') || Math.abs(car.steer) > 1.8)) {
        this.effects.skid(car.x - Math.sin(car.heading) * 1.5, car.z - Math.cos(car.heading) * 1.5, car.heading);
      }
      this.audio.engine(Math.abs(car.speed) / car.def.topSpeed, true);
      // car wrecked?
      if (car.dead) {
        this.effects.explosion(car.x, 1, car.z, true);
        this.audio.explosion();
        this.police.addCrime(0.1, car.x, car.z);
        this.player.exitVehicle();
        this.playerCar = null;
        this.scene.remove(car.mesh);
        this.vehicles.splice(this.vehicles.indexOf(car), 1);
      }
      this.player.x = car.x; this.player.z = car.z;
    } else {
      this.player.walk(moveX, moveZ, input.down('ShiftLeft'), input.hit('Space'), dt);
      const pos = this.city.collide(this.player.x, this.player.z, 0.55);
      this.player.x = pos.x; this.player.z = pos.z;
      this.audio.engine(0, false);
    }

    // --- shooting (hold left mouse, or J in headless tests) ---
    this.aiming = input.leftDown || input.down('KeyJ');
    if (this.aiming && !this.playerCar) {
      // face the aim direction while firing, so the character turns to the
      // crosshair instead of shooting over their own shoulder
      this.player.heading = this.cameraRig.yaw;
      this.player.mesh.rotation.y = this.cameraRig.yaw;
    }
    if ((input.leftDown || input.hit('KeyJ')) && !this.playerCar) {
      const didShoot = this.combat.shoot(this.camera, this.player, null, (kind, enemy) => {
        if (kind === 'kill') {
          this.addCash(50); this.addRespect(5);
          this.police.addCrime(0.08, enemy.x, enemy.z);
        }
      });
      if (didShoot) {
        this.audio.gunshot();
        this.traffic.scare(this.player.x, this.player.z, 35);
        this.police.addCrime(0.03, this.player.x, this.player.z);
      }
    }
    if (input.leftDown && this.playerCar) {
      // drive-by: shoot from the car (same weapon, less accurate)
      const didShoot = this.combat.shoot(this.camera, this.player, this.playerCar, (kind) => {
        if (kind === 'kill') { this.addCash(50); this.addRespect(5); }
      });
      if (didShoot) this.audio.gunshot();
    }

    // --- interactions (F) ---
    if (input.hit('KeyF')) {
      const sh = this.garage.nearestSafehouse(this.player.x, this.player.z);
      if (sh && !this.playerCar) {
        this.saveNow();
        this.player.heal(100);
        this.hud.toast(`Saved at ${sh.name} — health restored`);
        this.audio.pickup();
      }
      const shop = this.garage.nearestGunShop(this.player.x, this.player.z);
      if (shop && !this.playerCar) {
        // buy the cheapest weapon the player lacks, else ammo for current
        const missing = ['smg', 'shotgun', 'rifle'].find((w) => !this.combat.hasWeapon(w));
        if (missing && this.garage.buyWeapon(missing)) {
          this.hud.toast(`Bought ${WEAPONS[missing].label} at Bay Arms`);
          this.audio.pickup();
        } else if (this.garage.buyAmmo(this.combat.weapon)) {
          this.hud.toast(`Bought ammo for ${WEAPONS[this.combat.weapon].label}`);
          this.audio.pickup();
        }
      }
      // start the next story mission from anywhere (F also works)
      if (!this.missions.active && this.missions.currentMission()) {
        this.missions.startStory();
      }
    }

    // --- side activities (T): a street race when driving, a taxi fare on foot ---
    if (input.hit('KeyT')) {
      if (this.playerCar && !this.missions.raceState) {
        const race = RACES[this._raceIndex % RACES.length];
        this._raceIndex++;
        if (this.missions.startSideRace(race.id)) {
          this.hud.toast(`Street race: ${race.name} — $${race.fee} entry, $${race.prize} to win`);
        } else {
          this.hud.toast(`Need $${race.fee} to enter the ${race.name}`);
        }
      } else if (!this.playerCar) {
        if (this.missions.startTaxi()) this.hud.toast('Taxi fare — drive the passenger to the marker');
        else this.hud.toast('No passenger nearby — find someone on the sidewalk');
      }
    }

    // --- systems ---
    this.traffic.update(dt, this.player, this.playerCar);
    this.police.update(dt, this.player, this.playerCar);
    this.combat.update(dt, this.player, this.playerCar);
    this.missions.update(dt);
    this.effects.update(dt);
    for (const v of this.vehicles) v.update(dt);
    // burning cars smoke + explode
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      if (v.burning && !v.dead) {
        this.effects.smoke(v.x, 1.5, v.z);
        if (Math.random() < dt * 0.5) this.audio.collision(false);
      }
      if (v.dead && v !== this.playerCar) {
        this.effects.explosion(v.x, 1, v.z, false);
        this.audio.explosion();
        this.traffic.scare(v.x, v.z, 30);
        this.scene.remove(v.mesh);
        this.vehicles.splice(i, 1);
      }
    }

    // --- wanted sting when stars rise ---
    if (this.police.stars > this._wantedStingAt) {
      this._wantedStingAt = this.police.stars;
      this.audio.wanted();
    } else if (this.police.stars < this._wantedStingAt) this._wantedStingAt = this.police.stars;
    // siren volume by nearest police distance
    let nearest = Infinity;
    for (const c of this.police.cars) nearest = Math.min(nearest, dist2D(px, pz, c.x, c.z));
    this.audio.siren(this.police.stars > 0 && nearest < 80, nearest === Infinity ? 1 : clamp(nearest / 80, 0, 1));

    // --- camera ---
    const target = this.playerCar
      ? { x: this.playerCar.x, y: 1.2, z: this.playerCar.z }
      : { x: this.player.x, y: this.player.y + 1, z: this.player.z };
    this.cameraRig.update(dt, target, this.playerCar ? this.playerCar.heading : this.player.heading, !!this.playerCar, this.playerCar ? this.playerCar.speed : 0, this.input, this.city);

    // --- prompts ---
    let prompt = '';
    if (!this.playerCar) {
      const car = this.traffic.nearestCar(this.player.x, this.player.z, 4);
      if (car) prompt = 'E — Steal car';
      const sh = this.garage.nearestSafehouse(this.player.x, this.player.z);
      if (sh) prompt = `F — Save at ${sh.name}`;
      const shop = this.garage.nearestGunShop(this.player.x, this.player.z);
      if (shop) prompt = 'F — Buy weapons at Bay Arms';
      if (!this.missions.active && this.missions.currentMission()) prompt = prompt || 'F — Start mission: ' + this.missions.currentMission().name;
    } else {
      prompt = 'E — Exit car · Space — Handbrake · Shift — Nitro · T — Street race';
    }
    this.hud.prompt(prompt);

    // --- death ---
    if (this.player.dead) {
      this.state = 'dead';
      this.playing = false;
      this.audio.failed();
      this.hud.banner('WASTED', 'You died. The Bay keeps your cash — half of it, anyway.');
      this.addCash(-Math.floor(this.cash / 2));
      setTimeout(() => {
        this.player.reset(-19, -70);
        this.player.heading = Math.PI;
        this.playerCar = null;
        this.police.clear();
        this.combat.clearGroup();
        this.missions.onPlayerDeath();
        this.state = 'playing';
        this.playing = true;
        this.hud.banner('Back on your feet', 'The mission restarts from its current stage.');
      }, 2500);
    }
  }
}
