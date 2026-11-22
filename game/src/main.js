// main.js — MIRADOR KEYS GameEngine: bootstrap, main loop, state machine,
// third-person spring camera, input, carjacking, weapons, and the ?shot=
// screenshot choreography (cover / combat / heist / title).
import * as THREE from 'three';
import { createTextures } from './world/textures.js';
import { Environment } from './world/environment.js';
import { buildCity, buildDistricts, DISTRICTS } from './world/cityBuilder.js';
import { createCarMesh, Vehicle, VEHICLE_TYPES } from './entities/vehicles.js';
import { Player } from './entities/player.js';
import { TrafficSystem } from './entities/traffic.js';
import { PedestrianSystem } from './entities/pedestrians.js';
import { CombatSystem, WEAPONS } from './systems/combat.js';
import { PoliceDispatch } from './systems/policeDispatch.js';
import { MissionSystem } from './systems/missions.js';
import { AudioRadio } from './systems/audioRadio.js';
import { SaveSystem } from './systems/saveSystem.js';
import { Hud } from './ui/hudMinimap.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot') || null;
const SEED = Number(params.get('seed') || 7);

export class GameEngine {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 4000);
    this.camera.position.set(-280, 40, 120);
    this.clock = new THREE.Clock();
    this.state = 'title'; // title | playing | paused | busted | wasted
    this.selectedSlot = 0;
    this.weaponIndex = 0;
    this.ammo = WEAPONS.map((w) => w.ammo);
    this.fireTimer = 0;
    this.mouseDown = false;
    this.aiming = false;
    this.cameraYaw = Math.PI;
    this.cameraPitch = 0.32;
    this.camPos = new THREE.Vector3(-280, 40, 120);
    this.camLook = new THREE.Vector3(0, 0, 0);
    this.frozen = false;
    this.shotReady = false;
    this.fixedCamera = null; // { pos: Vector3, look: Vector3 } — staged shot framing
    this.shotFrames = 0;
    this.shotFrameHooks = {}; // frame number -> fn, run once during shot warmup
    this.airTime = 0;
    this.wasAirborne = false;
    this.stuntCooldown = 0;
    this.keys = {};
    this.input = { forward: false, back: false, left: false, right: false, sprint: false, jump: false, handbrake: false };
    this.hud = new Hud();
    this.audio = new AudioRadio();
    this.saves = new SaveSystem();
    this.titleAngle = 0;
    window.__game = this;
  }

  init() {
    this.textures = createTextures();
    this.env = new Environment(this.scene, this.renderer);
    const ctx = buildCity(this.scene, this.textures, SEED);
    this.world = buildDistricts(ctx);
    this.player = new Player(this.scene, 'mateo');
    this.traffic = new TrafficSystem(this.scene, this.world, SEED);
    this.traffic.spawn(22);
    this.peds = new PedestrianSystem(this.scene, SEED + 4);
    this.peds.spawn(34);
    this.combat = new CombatSystem(this.scene);
    this.police = new PoliceDispatch(this.scene, this.world);
    this.police.onTicker = (t) => this.hud.setTicker(t);
    this.police.onWantedChange = (n) => this.hud.setStars(n);
    this.missions = new MissionSystem(this.scene);
    this.missions.onDialogue = (name, text) => this.hud.showDialogue(name, text);
    this.missions.onObjective = (title, obj) => this.hud.setMission(title, obj);
    this.missions.onReward = (title, cash, respect) => {
      this.hud.showToast(`MISSION COMPLETE — ${title}  +$${cash.toLocaleString()}  +${respect} RESPECT`);
      this.audio.cash();
      this.hud.setCash(this.missions.cash);
      this.hud.setRespect(this.missions.respectRank);
    };
    this.spawnParkedCars();
    this.bindInput();
    this.bindMenus();
    this.refreshSaveSlots();
    this.hud.setStars(0);
    this.hud.setCash(0);
    this.hud.setRespect('ROOKIE');
    this.hud.setWeapon(WEAPONS[0].name, '12 / ∞');
    this.hud.setVitals(100, 50);
    window.addEventListener('resize', () => this.onResize());
    document.getElementById('loading').remove();
    if (SHOT) {
      this.setupShot(SHOT);
    } else {
      this.showTitle();
    }
    window.__gameReady = true;
    this.renderer.setAnimationLoop(() => this.tick());
  }

  spawnParkedCars() {
    this.parkedCars = [];
    const spots = [
      { type: 'sports', color: 0xe8112e, x: -233, z: 40, h: Math.PI },
      { type: 'muscle', color: 0x1f6f3f, x: -233, z: 120, h: Math.PI },
      { type: 'suv', color: 0xe8e0d0, x: -233, z: -80, h: 0 },
      { type: 'sedan', color: 0x2a6ec2, x: 8, z: 60, h: Math.PI / 2 },
      { type: 'taxi', color: 0xffc21e, x: -8, z: -60, h: -Math.PI / 2 },
      { type: 'sports', color: 0x7a4fb5, x: 88, z: 40, h: 0 },
      { type: 'muscle', color: 0xd98a1f, x: 168, z: -40, h: Math.PI / 2 },
      { type: 'van', color: 0x3a3f4a, x: 200, z: 120, h: Math.PI },
    ];
    for (const s of spots) {
      const mesh = createCarMesh(s.type, s.color);
      this.scene.add(mesh);
      const v = new Vehicle(mesh, new THREE.Vector3(s.x, 0, s.z), s.h);
      v.parked = true;
      this.parkedCars.push(v);
    }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  bindInput() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      if (this.state !== 'playing') return;
      if (e.code === 'KeyF') this.tryEnterExitCar();
      if (e.code === 'KeyR') this.hud.setRadio(this.audio.nextStation());
      if (e.code === 'KeyG') this.callElena();
      if (e.code === 'KeyM') this.toggleAtlas();
      if (e.code === 'KeyC') this.switchCharacter();
      if (e.code === 'Tab') { e.preventDefault(); this.hud.setWheelVisible(true, this.weaponIndex); }
      if (e.code.startsWith('Digit')) {
        const n = Number(e.code.slice(5)) - 1;
        if (n >= 0 && n < 5) this.selectWeapon(n);
      }
      if (e.code === 'Escape') this.pauseGame();
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (e.code === 'Tab') this.hud.setWheelVisible(false, this.weaponIndex);
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.state !== 'playing') return;
      if (e.button === 0) this.mouseDown = true;
      if (e.button === 2) { this.aiming = true; this.player.aiming = true; }
      if (!document.pointerLockElement) {
        try { this.canvas.requestPointerLock(); } catch (err) { /* pointer lock optional */ }
      }
      this.audio.init();
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
      if (e.button === 2) { this.aiming = false; this.player.aiming = false; }
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== this.canvas) return;
      this.cameraYaw -= e.movementX * 0.0026;
      this.cameraPitch = THREE.MathUtils.clamp(this.cameraPitch + e.movementY * 0.0022, -0.15, 0.9);
    });
  }

  bindMenus() {
    const $ = (id) => document.getElementById(id);
    document.querySelectorAll('.save-slot').forEach((slot) => {
      slot.addEventListener('click', () => {
        this.selectedSlot = Number(slot.dataset.slot);
        document.querySelectorAll('.save-slot').forEach((s) => s.classList.remove('selected'));
        slot.classList.add('selected');
        this.audio.init();
        this.audio.uiClick();
      });
    });
    $('btn-continue').addEventListener('click', () => {
      this.audio.init();
      this.audio.uiClick();
      this.startGame(this.saves.hasSave(this.selectedSlot) ? this.selectedSlot : null);
    });
    $('btn-new').addEventListener('click', () => {
      this.audio.init();
      this.audio.uiClick();
      this.startGame(null);
    });
    $('btn-controls').addEventListener('click', () => {
      $('controls-panel').classList.toggle('hidden');
      this.audio.uiClick();
    });
    $('btn-resume').addEventListener('click', () => this.resumeGame());
    $('btn-save').addEventListener('click', () => {
      this.saveGame();
      this.hud.showToast(`SAVED TO SLOT ${this.selectedSlot + 1}`);
    });
    $('btn-quit-title').addEventListener('click', () => {
      this.state = 'title';
      this.showTitle();
    });
    $('btn-atlas-close').addEventListener('click', () => this.toggleAtlas());
    $('btn-end-retry').addEventListener('click', () => {
      this.resetRun();
      this.startGame(null);
    });
  }

  refreshSaveSlots() {
    document.querySelectorAll('.save-slot').forEach((slot) => {
      const i = Number(slot.dataset.slot);
      const body = slot.querySelector('.slot-body');
      const fmt = this.saves.formatSlot(i);
      if (!fmt) {
        body.innerHTML = '<span class="slot-empty">EMPTY — NEW GAME</span>';
      } else {
        body.innerHTML = `<span class="slot-stat">${fmt.mission}</span>` +
          `<span class="slot-stat">CASH <b>${fmt.cash}</b> • ${fmt.rank}</span>` +
          `<span class="slot-stat">${fmt.when}</span>`;
      }
    });
  }

  showTitle() {
    this.state = 'title';
    document.getElementById('title-screen').classList.remove('hidden');
    this.hud.hideHud();
    document.getElementById('atlas').classList.add('hidden');
    document.getElementById('pause-menu').classList.add('hidden');
    document.getElementById('end-screen').classList.add('hidden');
    this.refreshSaveSlots();
  }

  startGame(loadSlot) {
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('end-screen').classList.add('hidden');
    this.hud.showHud();
    this.state = 'playing';
    this.audio.init();
    if (loadSlot !== null && loadSlot !== undefined) {
      const s = this.saves.load(loadSlot);
      if (s) {
        this.missions.cash = s.cash;
        this.missions.respect = s.respect;
        this.missions.index = Math.min(s.mission, 7);
        this.missions.completed = s.missionsDone;
        this.player.switchCharacter(this.scene, s.character || 'mateo');
        this.hud.setCash(s.cash);
        this.hud.setRespect(s.rank);
        this.missions.startMission(this.missions.index);
        this.hud.showToast(`WELCOME BACK — ${s.rank}`);
        return;
      }
    }
    this.resetRun();
    this.missions.startMission(0);
  }

  resetRun() {
    this.missions.cash = 0;
    this.missions.respect = 0;
    this.missions.index = 0;
    this.missions.completed = 0;
    this.player.health = 100;
    this.player.armor = 50;
    this.player.position.set(-240, 0, 40);
    this.player.heading = Math.PI;
    this.police.setWanted(0);
    this.combat.clearEnemies();
    this.hud.setCash(0);
    this.hud.setRespect('ROOKIE');
    this.hud.setVitals(100, 50);
  }

  saveGame() {
    this.saves.save(this.selectedSlot, {
      missionIndex: this.missions.index,
      missionsDone: this.missions.completed,
      cash: this.missions.cash,
      respect: this.missions.respect,
      rank: this.missions.respectRank,
      character: this.player.charKey,
      upgrades: this.upgrades || [],
    });
    this.refreshSaveSlots();
  }

  pauseGame() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    document.getElementById('pause-menu').classList.remove('hidden');
    document.exitPointerLock && document.exitPointerLock();
  }

  resumeGame() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    document.getElementById('pause-menu').classList.add('hidden');
  }

  toggleAtlas() {
    const atlas = document.getElementById('atlas');
    const show = atlas.classList.contains('hidden');
    atlas.classList.toggle('hidden', !show);
    if (show) {
      const pos = this.player.inVehicle ? this.player.inVehicle.position : this.player.position;
      this.hud.drawAtlas(pos);
    }
  }

  switchCharacter() {
    const next = this.player.charKey === 'mateo' ? 'elena' : 'mateo';
    this.player.switchCharacter(this.scene, next);
    const c = next === 'mateo' ? 'MATEO VEGA' : 'ELENA CRUZ';
    this.hud.showToast(`NOW PLAYING — ${c}`);
  }

  callElena() {
    if (this.police.wanted === 0) {
      this.hud.showToast('ELENA — “No heat on you. Call me when the MKPD shows up.”');
      return;
    }
    this.police.callElena();
    this.hud.showToast('ELENA IS PULLING UNITS OFF YOU — GO DARK');
    this.audio.uiClick();
  }

  selectWeapon(n) {
    this.weaponIndex = n;
    const w = WEAPONS[n];
    const ammo = this.ammo[n] === Infinity ? '∞' : `${this.ammo[n]}`;
    this.hud.setWeapon(w.name, `${ammo} / ${w.ammo === Infinity ? '∞' : w.ammo}`);
    this.hud.setWheelVisible(this.keys.Tab, n);
  }

  // ---- Carjacking: F enters the nearest car (traffic or parked, civilian or police) ----
  nearestVehicle(maxDist = 5) {
    const p = this.player.position;
    let best = null;
    let bestD = maxDist;
    const all = [...this.parkedCars, ...this.traffic.cars, ...this.police.units];
    for (const v of all) {
      if (v.burning) continue;
      const d = v.position.distanceTo(p);
      if (d < bestD) { bestD = d; best = v; }
    }
    return best;
  }

  tryEnterExitCar() {
    if (this.player.inVehicle) {
      this.player.exitVehicle();
      this.hud.setPrompt('');
      return;
    }
    const v = this.nearestVehicle(5);
    if (!v) return;
    // pull traffic cars out of the traffic system when stolen
    const ti = this.traffic.cars.indexOf(v);
    if (ti >= 0) this.traffic.cars.splice(ti, 1);
    const pi = this.parkedCars.indexOf(v);
    if (pi >= 0) this.parkedCars.splice(pi, 1);
    v.parked = false;
    this.player.enterVehicle(v);
    this.police.addHeat(v.police ? 2 : 1);
    this.hud.showToast(v.police ? 'MKPD UNIT STOLEN — HEAT +2' : `STOLE THE ${v.def.name}`);
    this.audio.horn();
    this.cameraYaw = v.heading + Math.PI;
  }

  updatePrompt() {
    if (this.state !== 'playing' || this.player.inVehicle) {
      if (!this.player.inVehicle) this.hud.setPrompt('');
      return;
    }
    const v = this.nearestVehicle(5);
    if (v) {
      this.hud.setPrompt(v.police ? '[F] STEAL MKPD INTERCEPTOR' : `[F] STEAL ${v.def.name}`);
    } else {
      this.hud.setPrompt('');
    }
  }

  // ---- Shooting ----
  tryShoot(dt) {
    this.fireTimer -= dt;
    const w = WEAPONS[this.weaponIndex];
    const wantFire = this.mouseDown && (w.auto || this.fireTimer <= -0.05);
    if (!wantFire || this.fireTimer > 0) return;
    if (this.ammo[this.weaponIndex] !== Infinity) {
      if (this.ammo[this.weaponIndex] <= 0) { this.hud.showToast('OUT OF AMMO — switch weapon [1-5]'); this.fireTimer = 0.4; return; }
      this.ammo[this.weaponIndex]--;
    }
    this.fireTimer = w.rate;
    const origin = this.player.position.clone().setY(this.player.position.y + 1.5);
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const targets = [...this.combat.enemies, ...this.police.units];
    const hit = this.combat.shoot(origin, dir, w, targets);
    this.audio.gunshot(this.weaponIndex);
    this.combat.shake = Math.max(this.combat.shake, 0.12);
    if (hit) {
      if (hit.health <= 0) {
        this.missions.notifyKill();
        if (hit.police) this.police.addHeat(1);
        if (hit.burning === undefined && hit.mesh) this.combat.burst(hit.position.clone().setY(1), 8, 'spark', 6, 0.2, 0.4, -6);
      }
      this.traffic.triggerPanic(this.player.position);
      this.peds.triggerFlee(this.player.position, 55);
      this.police.addHeat(0); // shooting already raises heat via addHeat below
    }
    this.police.setWanted(Math.max(this.police.wanted, 1));
    this.selectWeapon(this.weaponIndex);
  }

  // ---- Stunt jumps over ramps ----
  checkStunts(dt) {
    const v = this.player.inVehicle;
    if (!v || this.stuntCooldown > 0) { this.stuntCooldown = Math.max(0, this.stuntCooldown - dt); return; }
    v.airY = v.airY || 0;
    v.airVy = v.airVy || 0;
    if (v.airY <= 0) {
      for (const ramp of this.world.ramps) {
        const d = Math.hypot(v.position.x - ramp.position.x, v.position.z - ramp.position.z);
        if (d < 7 && Math.abs(v.speed) > 20) {
          v.airVy = 9 + Math.abs(v.speed) * 0.12;
          v.airY = 0.1;
          this.airTime = 0;
          this.wasAirborne = true;
          this.audio.skid();
          break;
        }
      }
    }
    if (v.airY > 0 || v.airVy > 0) {
      v.airVy -= 20 * dt;
      v.airY += v.airVy * dt;
      this.airTime += dt;
      if (v.airY <= 0) {
        v.airY = 0;
        v.airVy = 0;
        if (this.wasAirborne && this.airTime > 0.7) {
          const bonus = Math.round(this.airTime * 220);
          this.missions.cash += bonus;
          this.hud.setCash(this.missions.cash);
          this.hud.showStunt('STUNT JUMP!', `AIR TIME ${this.airTime.toFixed(1)}s  •  +$${bonus}`);
          this.audio.cash();
        }
        this.wasAirborne = false;
        this.stuntCooldown = 1.5;
      }
      v.mesh.position.y = v.airY;
    }
  }

  // ---- Camera: third-person spring, speed FOV, aim over-the-shoulder ----
  updateCamera(dt) {
    // staged shots pin the camera exactly — the chase cam never overrides them
    if (this.fixedCamera) {
      this.camera.position.copy(this.fixedCamera.pos);
      this.camera.lookAt(this.fixedCamera.look);
      this.camera.fov = 60;
      this.camera.updateProjectionMatrix();
      return;
    }
    const inCar = this.player.inVehicle;
    const anchor = inCar ? inCar.position : this.player.position;
    const heading = inCar ? inCar.heading : this.cameraYaw;
    const speed = inCar ? Math.abs(inCar.speed) : this.player.speed;
    const dist = inCar ? 10 + speed * 0.12 : (this.aiming ? 4.6 : 6.4);
    const height = inCar ? 3.4 + speed * 0.02 : (this.aiming ? 2.3 : 2.7);
    const side = this.aiming && !inCar ? 1.1 : 0;
    const back = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    const right = new THREE.Vector3(back.z, 0, -back.x);
    const desired = anchor.clone()
      .addScaledVector(back, -dist)
      .addScaledVector(right, side)
      .add(new THREE.Vector3(0, height, 0));
    const k = 1 - Math.exp(-dt * (inCar ? 5.5 : 8));
    this.camPos.lerp(desired, k);
    const lookTarget = anchor.clone().add(new THREE.Vector3(0, inCar ? 1.4 : 1.6, 0))
      .addScaledVector(back, inCar ? 6 : 3);
    this.camLook.lerp(lookTarget, 1 - Math.exp(-dt * 10));
    this.camera.position.copy(this.camPos);
    if (this.combat.shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.combat.shake * 0.35;
      this.camera.position.y += (Math.random() - 0.5) * this.combat.shake * 0.25;
    }
    this.camera.lookAt(this.camLook);
    const targetFov = 62 + (inCar ? Math.min(16, speed * 0.28) : (this.aiming ? -8 : 0));
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, Math.min(1, dt * 4));
    this.camera.updateProjectionMatrix();
  }

  // ---- Main loop ----
  tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.frozen) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.env.update(dt);
    if (this.state === 'title') {
      // slow cinematic flyover behind the title screen
      this.titleAngle += dt * 0.045;
      const r = 300;
      this.camera.position.set(Math.sin(this.titleAngle) * r - 60, 62 + Math.sin(this.titleAngle * 0.7) * 14, Math.cos(this.titleAngle) * r * 0.7);
      this.camera.lookAt(0, 18, -20);
      this.camera.fov = 58;
      this.camera.updateProjectionMatrix();
      this.traffic.update(dt, this.player.position, null);
      this.peds.update(dt);
      if (SHOT === 'title' && !window.__shotReady) {
        this.shotFrames++;
        if (this.shotFrames >= 4) window.__shotReady = true;
      }
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (this.state !== 'playing') {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    // input vector
    const k = this.keys;
    this.input.forward = !!(k.KeyW || k.ArrowUp);
    this.input.back = !!(k.KeyS || k.ArrowDown);
    this.input.left = !!(k.KeyA || k.ArrowLeft);
    this.input.right = !!(k.KeyD || k.ArrowRight);
    this.input.sprint = !!k.ShiftLeft || !!k.ShiftRight;
    this.input.jump = !!k.Space;
    this.input.handbrake = !!k.Space;

    const inCar = this.player.inVehicle;
    if (inCar) {
      inCar.update(dt, this.input, this.world);
      if (inCar.health <= 0 && !inCar.exploded) {
        inCar.exploded = true;
        this.combat.explode(inCar.position.clone().setY(1), true);
        this.audio.explosion();
        this.player.exitVehicle();
        this.hud.showToast('YOUR CAR EXPLODED — RUN!');
      }
      this.audio.setEngine(Math.abs(inCar.speed) / inCar.def.topSpeed, true);
      // drift smoke + sparks
      if (inCar.drift > 0.4 && Math.abs(inCar.speed) > 12) {
        const back = new THREE.Vector3(Math.sin(inCar.heading), 0, Math.cos(inCar.heading));
        const pos = inCar.position.clone().addScaledVector(back, -1.8).setY(0.4);
        this.combat.burst(pos, 2, 'smoke', 2, 0.5, 0.8, 1.5);
        if (Math.random() < 0.4) this.combat.burst(pos, 2, 'spark', 6, 0.1, 0.3, -8);
        if (Math.random() < 0.05) this.audio.skid();
      }
      // burning cars smoke
      if (inCar.health < 45 && Math.random() < 0.3) {
        this.combat.burst(inCar.position.clone().setY(1.2), 1, 'smoke', 1.5, 0.7, 1.4, 2.5);
      }
      if (this.mouseDown) this.audio.horn();
    } else {
      this.player.update(dt, this.input, this.cameraYaw);
      this.audio.setEngine(0, false);
      this.tryShoot(dt);
    }
    this.checkStunts(dt);
    this.traffic.update(dt, this.player.position, inCar);
    this.peds.update(dt);
    this.police.update(dt, this.player.position, inCar, () => this.endRun('BUSTED', 'The MKPD caught up with you.'));
    this.missions.update(dt, this.player.position, inCar, null);
    this.combat.update(dt, this.player.position);
    // enemy shots can hit the player
    for (const e of this.combat.enemies) {
      if (e.lastShot) {
        const dist = e.position.distanceTo(this.player.position);
        const hitChance = dist < 20 ? 0.22 : 0.08;
        if (Math.random() < hitChance) {
          const dead = this.player.takeDamage(9);
          this.hud.setVitals(this.player.health, this.player.armor);
          if (dead) this.endRun('WASTED', 'Mateo went down in the streets of Mirador.');
        }
        e.lastShot = null;
      }
    }
    // wanted heat from firing / stealing is handled in the action methods
    this.updatePrompt();
    this.updateCamera(dt);
    // HUD refresh
    const speedMph = inCar ? Math.abs(inCar.speed) * 1.9 : this.player.speed * 2.2;
    this.hud.setSpeed(speedMph);
    this.hud.setVitals(this.player.health, this.player.armor);
    this.hud.drawMinimap(
      inCar ? inCar.position : this.player.position,
      inCar ? inCar.heading : this.cameraYaw,
      this.police,
      this.missions.beaconTarget,
      this.combat.enemies,
      this.traffic,
    );
    this.audio.siren(this.police.wanted >= 1);
    // shot choreography: freeze after a fixed number of rendered frames, so the
    // staged moment is deterministic even on slow software GL (wall time varies)
    if (SHOT && !this.frozen && this.state === 'playing') {
      this.shotFrames++;
      if (this.shotFrameHooks[this.shotFrames]) this.shotFrameHooks[this.shotFrames]();
      if (this.shotFrames >= 14) {
        if (this.shotFrameHooks.freeze) this.shotFrameHooks.freeze();
        this.frozen = true;
        window.__shotReady = true;
      }
    }
    this.renderer.render(this.scene, this.camera);
  }

  endRun(title, sub) {
    this.state = title === 'BUSTED' ? 'busted' : 'wasted';
    document.getElementById('end-title').textContent = title;
    document.getElementById('end-sub').textContent = sub;
    document.getElementById('end-screen').classList.remove('hidden');
    document.exitPointerLock && document.exitPointerLock();
    this.audio.siren(false);
  }

  // ---- Screenshot choreography: live in-engine states, no fakes ----
  // Each shot pins a fixed cinematic camera, stages the actors, then freezes
  // after 14 rendered frames. Frame hooks (12 = last action, freeze = final
  // effects + HUD text) run right before the freeze so tracers, fire and
  // prompts are caught at full strength.
  setupShot(name) {
    this.hud.showHud();
    this.state = 'playing';
    document.getElementById('title-screen').classList.add('hidden');
    const freeze = () => {
      this.frozen = true;
      window.__shotReady = true;
    };
    if (name === 'cover') {
      // Hero chase on the Strip: camera on the beach side looking north — the
      // sunlit crimson coupe, 2 cruisers right behind it, OSPREY-1 overhead
      // with its cone on the coupe, ocean glittering at the frame's left.
      const coupe = this.parkedCars[0];
      this.parkedCars.splice(0, 1);
      coupe.parked = false;
      coupe.position.set(-240, 0, 34);
      coupe.heading = Math.PI + 0.22; // slight drift angle
      coupe.speed = 0;
      this.player.enterVehicle(coupe);
      this.cameraYaw = Math.PI;
      // classic chase framing: camera south of the pursuit on the avenue
      // centerline — cruisers 16–26 units out flanking the road, the crimson
      // coupe centered ahead, OSPREY-1 above it, ocean at the frame's left.
      this.fixedCamera = {
        pos: new THREE.Vector3(-240, 5, 0),
        look: new THREE.Vector3(-240, 3, 50),
      };
      this.police.setWanted(4, true);
      this.police.staging = true;
      const c1 = this.police.spawnUnit('cruiser', new THREE.Vector3(-246, 0, 22));
      const c2 = this.police.spawnUnit('cruiser', new THREE.Vector3(-234, 0, 26));
      const c3 = this.police.spawnUnit('interceptor', new THREE.Vector3(-240, 0, 16));
      for (const u of [c1, c2, c3]) u.heading = Math.PI;
      this.police.spawnHelicopter();
      this.police.helicopter.group.position.set(-236, 18, 55);
      this.police.helicopter.height = 18;
      this.police.helicopter.angle = 0;
      this.missions.startMission(0);
      this.missions.cash = 4200;
      this.missions.respect = 34;
      this.hud.setCash(4200);
      this.hud.setRespect(this.missions.respectRank);
      this.hud.setTicker('DISPATCH — OSPREY-1 airborne, spotlight on the suspect.');
      this.hud.setRadio('MIRADOR SYNTHWAVE FM');
      // fresh drift smoke + sparks at the coupe's rear wheels, right at the freeze
      this.shotFrameHooks.freeze = () => {
        this.combat.burst(new THREE.Vector3(-238.5, 0.5, 30.5), 6, 'smoke', 3, 0.6, 1.8, 1.5);
        this.combat.burst(new THREE.Vector3(-241.5, 0.5, 30.5), 6, 'smoke', 3, 0.6, 1.8, 1.5);
        this.combat.burst(new THREE.Vector3(-240, 0.4, 30), 6, 'spark', 7, 0.12, 0.5, -8);
      };
      setTimeout(freeze, 30000); // safety net only; the frame counter freezes first
    } else if (name === 'combat') {
      // On-foot shootout at Solaris Bank plaza: over-the-shoulder aim, the
      // player big in the foreground, enemies in front of the bank, tracer +
      // muzzle flash + weapon wheel caught fresh at the freeze.
      this.player.position.set(40, 0, -8);
      this.player.heading = Math.PI;
      this.cameraYaw = Math.PI;
      this.fixedCamera = {
        pos: new THREE.Vector3(40, 2.6, -2),
        look: new THREE.Vector3(40, 1.5, -40),
      };
      this.player.aiming = true;
      this.aiming = true;
      this.combat.spawnEnemy(new THREE.Vector3(48, 0, -30), 'crew');
      this.combat.spawnEnemy(new THREE.Vector3(34, 0, -34), 'crew');
      this.combat.spawnEnemy(new THREE.Vector3(52, 0, -22), 'officer');
      this.combat.spawnEnemy(new THREE.Vector3(28, 0, -28), 'officer');
      this.missions.startMission(2);
      this.missions.cash = 2400;
      this.hud.setCash(2400);
      this.police.setWanted(2, true);
      this.selectWeapon(3);
      // fire + wheel + prompt in the freeze hook: the tracer and flash are
      // created in the same tick as the freeze, so they render at full strength.
      // The wheel sits at the left so it never covers the player or the tracer.
      this.shotFrameHooks.freeze = () => {
        const origin = this.player.position.clone().setY(1.5);
        const target = this.combat.enemies[0].position.clone().setY(1.2);
        const dir = target.sub(origin).normalize();
        this.combat.shoot(origin, dir, WEAPONS[3], this.combat.enemies);
        this.hud.setWheelVisible(true, 3);
        document.getElementById('weapon-wheel').style.left = '20%';
        this.hud.setPrompt('[F] STEAL MKPD INTERCEPTOR');
      };
      setTimeout(freeze, 30000);
    } else if (name === 'heist') {
      // Dusk getaway at the marina / causeway: the action spreads east-west
      // across the frame — muscle car left, burning wreck center, cruiser
      // roadblock right, bridge + dock crane + harbor water behind.
      this.env.setMode('dusk');
      const muscle = this.parkedCars[1];
      this.parkedCars.splice(1, 1);
      muscle.parked = false;
      muscle.position.set(245, 0, 118);
      muscle.heading = 1.57; // east, toward the roadblock
      muscle.speed = 26;
      this.player.enterVehicle(muscle);
      this.cameraYaw = 1.57;
      this.fixedCamera = {
        pos: new THREE.Vector3(270, 7, 85),
        look: new THREE.Vector3(270, 2, 125),
      };
      this.police.setWanted(3, true);
      this.police.spawnRoadblock(new THREE.Vector3(295, 0, 130), 0.6);
      // burning wreck between the player and the roadblock
      const wreck = this.parkedCars.find((v) => v.def.name === 'ARMORED VAN') || this.parkedCars[0];
      wreck.position.set(270, 0, 125);
      wreck.heading = 0.9;
      wreck.health = 0;
      wreck.burning = true;
      this.missions.startMission(2);
      this.missions.cash = 8600;
      this.hud.setCash(8600);
      this.hud.setTicker('DISPATCH — Roadblock forming at the causeway, spike strips ready.');
      this.shotFrameHooks.freeze = () => {
        // fire at the wreck's rear so the van's body stays visible in front;
        // a warm point light makes the dark van read against the dusk road
        this.combat.burst(new THREE.Vector3(268.5, 1.2, 123.5), 12, 'fire', 8, 0.9, 1.4, -2);
        this.combat.burst(new THREE.Vector3(268.5, 3.0, 123.5), 10, 'smoke', 4, 1.2, 2.4, 2.5);
        const wreckLight = new THREE.PointLight(0xff8844, 60, 30, 1.8);
        wreckLight.position.set(270, 3, 125);
        this.scene.add(wreckLight);
        this.hud.showDialogue('ELENA', 'Vault’s open, Mateo — now drive like the whole city is watching. Because it is.');
      };
      setTimeout(freeze, 30000);
    } else if (name === 'title') {
      // Title screen over a live sunset flyover looking west across the city
      // toward the beach and the ocean sunset, with three filled save slots.
      this.state = 'title';
      this.titleAngle = 1.2;
      this.saves.save(0, { missionIndex: 1, missionsDone: 1, cash: 4200, respect: 34, rank: 'HUSTLER', character: 'mateo', upgrades: ['respray'] });
      this.saves.save(1, { missionIndex: 3, missionsDone: 3, cash: 12800, respect: 76, rank: 'WHEELMAN', character: 'elena', upgrades: ['armor', 'turbo'] });
      this.saves.save(2, { missionIndex: 6, missionsDone: 6, cash: 31400, respect: 148, rank: 'KEYS ROYALTY', character: 'mateo', upgrades: ['armor', 'turbo', 'respray'] });
      this.refreshSaveSlots();
      this.showTitle();
    } else {
      setTimeout(freeze, 2000);
    }
  }
}

const engine = new GameEngine();
engine.init();
