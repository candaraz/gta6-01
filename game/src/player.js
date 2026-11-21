// player.js — Solmar Bay v3: the player on foot and behind the wheel.
// One job: move, steal and drive, take damage, earn cash and respect.
// The player faces where the camera looks; W/S move along the camera yaw,
// A/D strafe, mouse drag orbits the camera, click shoots at the crosshair.

import * as THREE from 'three';
import { WEAPONS, WEAPON_ORDER, RANKS, TUNE } from './config.js';

export function createPlayer(G) {
  // The visible player: Milo in a teal shirt, dark pants, seen from behind
  // on foot (hidden while driving, like every third-person game).
  const mesh = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: 0x2a8a7a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2a30 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a878 });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.8, 0.26), pants);
  legs.position.y = 0.4; mesh.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.72, 0.32), shirt);
  torso.position.y = 1.16; mesh.add(torso);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.62, 0.14), shirt);
  armL.position.set(-0.36, 1.16, 0); mesh.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.62, 0.14), shirt);
  armR.position.set(0.36, 1.16, 0); mesh.add(armR);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), skin);
  head.position.y = 1.72; mesh.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.1, 0.44), new THREE.MeshLambertMaterial({ color: 0xd81f2a }));
  cap.position.y = 1.9; mesh.add(cap);
  mesh.castShadow = true;
  G.scene.add(mesh);
  const p = {
    x: 0, z: 200, y: 0, vy: 0, heading: Math.PI,
    onFoot: true, car: null, boat: null,
    health: TUNE.playerHealth, cash: 500, respect: 0,
    weapon: 'pistol', weapons: {},
    garageLevel: 0, ownedCars: [], safehouse: 0,
    coins: 0, dead: false, lastDamage: 0,
  };
  p.weapons.fists = { owned: true, ammo: Infinity };
  p.weapons.pistol = { owned: true, ammo: WEAPONS.pistol.mag };
  p.weapon = 'pistol';

  function rank() {
    let title = RANKS[0][1];
    for (const [t, name] of RANKS) if (p.respect >= t) title = name;
    return title;
  }
  function addCash(n) { p.cash += n; G.hud.flashCash(n); }
  function addRespect(n) {
    const before = rank();
    p.respect += n;
    if (rank() !== before) G.hud.announce(`Rank up: ${rank()}`, 2600);
  }
  function giveWeapon(id, ammo) {
    p.weapons[id] = { owned: true, ammo: ammo ?? WEAPONS[id].mag };
    p.weapon = id;
  }
  function setWeapon(id) {
    if (p.weapons[id] && p.weapons[id].owned) p.weapon = id;
  }
  function cycleWeapon(dir) {
    const owned = WEAPON_ORDER.filter((w) => p.weapons[w] && p.weapons[w].owned);
    if (!owned.length) return;
    const i = owned.indexOf(p.weapon);
    p.weapon = owned[(i + dir + owned.length) % owned.length];
  }
  function reload() {
    const w = p.weapons[p.weapon];
    if (!w || w.ammo === Infinity) return;
    w.ammo = WEAPONS[p.weapon].mag;
  }
  function damage(amount, fromX, fromZ) {
    if (p.dead || G.state !== 'playing') return;
    p.health -= amount;
    p.lastDamage = G.time;
    G.hud.damageFlash();
    if (p.health <= 0) {
      p.health = 0; p.dead = true;
      G.setState('wasted');
    }
  }
  function heal(amount) { p.health = Math.min(TUNE.playerHealth, p.health + amount); }

  function enterVehicle(car) {
    if (!car || !car.alive) return false;
    const wasTraffic = car.driver === 'traffic';
    if (wasTraffic) {
      G.police.addStars(1);
      G.hud.announce('Carjacked — the heat is on', 2200);
      G.effects.addShake(0.2);
      G.audio.crash();
    } else if (car.driver === 'parked') {
      // Taking a parked car: heat only if a cop is watching.
      if (G.police.nearestCopDist(p.x, p.z) < 55) G.police.addStars(1);
    }
    car.prevDriver = car.driver;
    car.driver = 'player';
    car.parked = false;
    p.car = car;
    p.onFoot = false;
    p.boat = car.kind === 'boat' ? car : null;
    return true;
  }

  let lastExitT = -100; // game time the player last stepped out
  function exitVehicle() {
    const car = p.car;
    if (!car) return;
    // Step out to the car's left side.
    const lx = car.x + Math.cos(car.heading) * 2.4;
    const lz = car.z - Math.sin(car.heading) * 2.4;
    const pos = { x: lx, z: lz };
    G.city.collideCircle(pos, 0.6);
    p.x = pos.x; p.z = pos.z; p.y = 0;
    p.heading = car.heading;
    car.driver = car.prevDriver || 'parked';
    car.parked = car.driver === 'parked';
    car.speed = 0;
    p.car = null; p.boat = null; p.onFoot = true;
    // A 4 s bust grace after stepping out: the player needs a moment
    // to get into another vehicle (boat -> Comet at the pier) without
    // a cop that is already on top of them busting instantly.
    lastExitT = G.time;
  }

  function update(dt, input) {
    if (p.dead) return;
    const cam = G.camera;
    if (p.onFoot) {
      // Move along the camera yaw; A/D strafe.
      const fwd = (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0)
        - (input.down('KeyS') || input.down('ArrowDown') ? 1 : 0);
      const strafe = (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0)
        - (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0);
      const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
      const speed = sprint ? TUNE.runSpeed : TUNE.walkSpeed;
      const yaw = cam.yaw;
      let mx = Math.sin(yaw) * fwd + Math.cos(yaw) * strafe;
      let mz = Math.cos(yaw) * fwd - Math.sin(yaw) * strafe;
      const len = Math.hypot(mx, mz);
      if (len > 0) { mx /= len; mz /= len; p.heading = Math.atan2(mx, mz); }
      const nx = p.x + mx * speed * dt;
      const nz = p.z + mz * speed * dt;
      const pos = { x: nx, z: nz };
      G.city.collideCircle(pos, 0.6);
      p.x = pos.x; p.z = pos.z;
      // Jump.
      if (input.takePressed('Space') && p.y <= 0.01) p.vy = TUNE.jumpSpeed;
      if (p.y > 0 || p.vy !== 0) {
        p.vy -= 22 * dt;
        p.y += p.vy * dt;
        if (p.y <= 0) { p.y = 0; p.vy = 0; }
      }
      // Slow health regen out of combat.
      if (G.time - p.lastDamage > 8 && p.health < TUNE.playerHealth) p.health = Math.min(TUNE.playerHealth, p.health + 2 * dt);
    } else if (p.car) {
      const car = p.car;
      const throttle = (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0)
        - (input.down('KeyS') || input.down('ArrowDown') ? 1 : 0);
      const steer = (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0)
        - (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0);
      const brake = input.down('Space') ? 1 : 0;
      G.vehicles.stepCar(car, dt, throttle, steer, brake, G.time);
      p.x = car.x; p.z = car.z;
      p.heading = car.heading;
      // Tyre smoke + dust at speed, and a skid when handbraking.
      if (Math.abs(car.speed) > 18) {
        if (Math.random() < dt * 6) {
          G.effects.tyreSmoke({ x: car.x - Math.sin(car.heading) * 1.6, y: 0.3, z: car.z - Math.cos(car.heading) * 1.6 });
        }
      }
      if (input.takePressed('KeyH')) G.audio.horn();
    }
    // Enter / exit.
    if (input.takePressed('KeyE')) {
      if (p.onFoot) {
        // If the mission wants a specific vehicle (the Marlin for the
        // boat race, the Comet for the theft), board THAT one when it
        // is in range — not whichever traffic car is a metre closer.
        const target = G.missions.enterTarget();
        let car = null;
        if (target && target.alive && Math.hypot(target.x - p.x, target.z - p.z) < 4.6) {
          car = target;
        }
        if (!car) car = G.vehicles.nearestCar(p.x, p.z, 4.6);
        if (car) enterVehicle(car);
      } else {
        exitVehicle();
      }
    }
    // Weapon switching / reload.
    if (input.takePressed('KeyQ')) cycleWeapon(1);
    if (input.takePressed('KeyR')) reload();
    for (let i = 0; i < WEAPON_ORDER.length; i++) {
      if (input.takePressed(`Digit${i + 1}`)) setWeapon(WEAPON_ORDER[i]);
    }
    // The visible player: on foot, standing where the camera looks.
    mesh.visible = p.onFoot;
    if (p.onFoot) {
      mesh.position.set(p.x, p.y, p.z);
      mesh.rotation.y = -p.heading;
    }
  }

  return {
    p, rank, addCash, addRespect, giveWeapon, setWeapon, cycleWeapon, reload,
    damage, heal, enterVehicle, exitVehicle, update,
    // True for 4 s after stepping out of a vehicle (bust grace).
    isExitGrace() { return (G.time - lastExitT) < 4; },
  };
}
