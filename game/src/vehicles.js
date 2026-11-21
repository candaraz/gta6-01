// vehicles.js — Solmar Bay v3: cars, the boat and the bike.
// One job: own every drivable vehicle and its arcade physics.
//
// All cars share one pool of instanced meshes (body, cabin, wheels, police
// light bar), so 40 cars on the road cost 4 draw calls. The boat and the
// bike ride in the same pool as narrow / water classes.

import * as THREE from 'three';
import { VEHICLES } from './config.js';
import { makeRng, pick } from './random.js';

// Body proportions per class: [width, height, length, cabin length].
const DIMS = {
  sedan: [1.9, 0.72, 4.4, 2.2], hatch: [1.8, 0.8, 3.8, 2.0],
  pickup: [1.9, 0.95, 4.8, 2.2], luxury: [1.95, 0.68, 4.9, 2.4],
  van: [2.0, 1.5, 4.6, 0.0], sports: [1.9, 0.6, 4.3, 2.0],
  police: [1.95, 0.75, 4.5, 2.2], boat: [3.2, 1.0, 8.5, 3.4],
  bike: [0.7, 0.5, 2.2, 0.0],
};

const POOL = 72;
const LIGHTS = 12;

export function createVehicles(scene, city, effects, audio) {
  const dummy = new THREE.Object3D();
  const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const bodyMesh = new THREE.InstancedMesh(bodyGeo, bodyMat, POOL);
  const cabinGeo = new THREE.BoxGeometry(1, 1, 1);
  const cabinMat = new THREE.MeshLambertMaterial({ color: 0x18222e });
  const cabinMesh = new THREE.InstancedMesh(cabinGeo, cabinMat, POOL);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.26, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const wheelMesh = new THREE.InstancedMesh(wheelGeo, wheelMat, POOL * 4);
  const lightGeo = new THREE.BoxGeometry(1.2, 0.22, 0.5);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lightMesh = new THREE.InstancedMesh(lightGeo, lightMat, LIGHTS);
  [bodyMesh, cabinMesh, wheelMesh, lightMesh].forEach((m) => {
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    scene.add(m);
  });
  bodyMesh.castShadow = true; cabinMesh.castShadow = true;

  const cars = [];       // live car objects
  const freeSlots = [];  // pool indices
  for (let i = POOL - 1; i >= 0; i--) freeSlots.push(i);
  const freeLights = [];
  for (let i = LIGHTS - 1; i >= 0; i--) freeLights.push(i);
  // Hide every slot at start.
  const hide = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < POOL; i++) {
    bodyMesh.setMatrixAt(i, hide); cabinMesh.setMatrixAt(i, hide);
    for (let w = 0; w < 4; w++) wheelMesh.setMatrixAt(i * 4 + w, hide);
  }
  for (let i = 0; i < LIGHTS; i++) lightMesh.setMatrixAt(i, hide);
  bodyMesh.instanceMatrix.needsUpdate = true;
  cabinMesh.instanceMatrix.needsUpdate = true;
  wheelMesh.instanceMatrix.needsUpdate = true;
  lightMesh.instanceMatrix.needsUpdate = true;

  const rng = makeRng(99);

  function spawnCar(cls, x, z, heading, driver) {
    if (freeSlots.length === 0) return null;
    const slot = freeSlots.pop();
    const def = VEHICLES[cls];
    const car = {
      slot, cls, def, kind: def.kind,
      x, z, heading, speed: 0, steer: 0,
      driver, alive: true, parked: driver === 'parked',
      colour: pick(rng, def.colours),
      lightbar: -1, lightPhase: 0,
      lastCrash: 0, bob: rng() * 6,
    };
    if (cls === 'interceptor' && freeLights.length) {
      car.lightbar = freeLights.pop();
    }
    bodyMesh.setColorAt(slot, new THREE.Color(car.colour));
    cars.push(car);
    return car;
  }

  function despawnCar(car) {
    if (!car.alive) return;
    car.alive = false;
    bodyMesh.setMatrixAt(car.slot, hide);
    cabinMesh.setMatrixAt(car.slot, hide);
    for (let w = 0; w < 4; w++) wheelMesh.setMatrixAt(car.slot * 4 + w, hide);
    if (car.lightbar >= 0) {
      lightMesh.setMatrixAt(car.lightbar, hide);
      freeLights.push(car.lightbar);
      car.lightbar = -1;
    }
    freeSlots.push(car.slot);
    const i = cars.indexOf(car);
    if (i >= 0) cars.splice(i, 1);
  }

  function writeCarMesh(car, time) {
    const dims = DIMS[car.kind] || DIMS.sedan;
    const [w, h, l, cl] = dims;
    const isBoat = car.kind === 'boat';
    const bob = isBoat ? Math.sin(time * 0.9 + car.bob) * 0.12 : 0;
    const roll = isBoat ? Math.sin(time * 0.7 + car.bob) * 0.03 : 0;
    dummy.position.set(car.x, (isBoat ? -0.1 : 0.42) + bob, car.z);
    dummy.rotation.set(roll, -car.heading, 0);
    dummy.scale.set(w, h, l);
    dummy.updateMatrix();
    bodyMesh.setMatrixAt(car.slot, dummy.matrix);
    // Cabin (skip for van/bike: scale ~0). Lower and narrower than the
    // body, so a car reads as a car and not a box on a box.
    if (cl > 0) {
      dummy.position.set(car.x, (isBoat ? 0.55 : 0.42 + h / 2 + 0.26) + bob, car.z);
      dummy.rotation.set(roll, -car.heading, 0);
      dummy.scale.set(w * 0.8, isBoat ? 1.3 : 0.5, cl);
      // Offset the cabin slightly back on cars, forward on boats.
      const fwd = isBoat ? 0.9 : -0.25;
      dummy.position.x += Math.sin(car.heading) * fwd;
      dummy.position.z += Math.cos(car.heading) * fwd;
      dummy.updateMatrix();
      cabinMesh.setMatrixAt(car.slot, dummy.matrix);
    } else {
      cabinMesh.setMatrixAt(car.slot, hide);
    }
    // Wheels: 4 for cars, 2 centreline for bikes, none for boats.
    const wheelOffsets = car.kind === 'bike'
      ? [[0, 0.75], [0, -0.75]]
      : [[-w / 2, l * 0.32], [w / 2, l * 0.32], [-w / 2, -l * 0.32], [w / 2, -l * 0.32]];
    for (let wi = 0; wi < 4; wi++) {
      if (isBoat || wi >= wheelOffsets.length) { wheelMesh.setMatrixAt(car.slot * 4 + wi, hide); continue; }
      const [ox, oz] = wheelOffsets[wi];
      const wx = car.x + Math.cos(car.heading) * ox + Math.sin(car.heading) * oz;
      const wz = car.z - Math.sin(car.heading) * ox + Math.cos(car.heading) * oz;
      dummy.position.set(wx, 0.36, wz);
      dummy.rotation.set(0, -car.heading, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      wheelMesh.setMatrixAt(car.slot * 4 + wi, dummy.matrix);
    }
    // Police light bar, flashing red/blue.
    if (car.lightbar >= 0) {
      car.lightPhase += 1 / 60;
      const red = Math.floor(car.lightPhase * 3) % 2 === 0;
      dummy.position.set(car.x, 0.42 + h + 0.22, car.z);
      dummy.rotation.set(0, -car.heading, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      lightMesh.setMatrixAt(car.lightbar, dummy.matrix);
      lightMesh.setColorAt(car.lightbar, new THREE.Color(red ? 0xff2222 : 0x2244ff));
    }
  }

  // Arcade drive step. throttle -1..1, steer -1..1, brake 0..1.
  function stepCar(car, dt, throttle, steer, brake, time) {
    const def = car.def;
    if (car.kind === 'boat') {
      car.speed += def.accel * throttle * dt;
      car.speed *= (1 - 0.5 * dt);
      car.speed = Math.max(-6, Math.min(def.top, car.speed));
      car.heading += steer * def.turn * Math.max(0.25, Math.abs(car.speed) / 14) * dt * (car.speed >= 0 ? 1 : -1);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      // Stay in the water: east of the beach, or the marina channel.
      if (car.x < 282) car.x = 282;
      if (car.x > 480) car.x = 480;
      if (car.z < -280) car.z = -280;
      if (car.z > 480) car.z = 480;
      return;
    }
    const forward = throttle;
    car.speed += def.accel * forward * dt;
    if (brake > 0) car.speed *= Math.max(0, 1 - 3.2 * brake * dt);
    // Rolling drag + a soft top-speed cap.
    car.speed *= (1 - (forward === 0 ? 0.9 : 0.25) * dt);
    const top = def.top * (car.upgraded || 1);
    car.speed = Math.max(-11, Math.min(top, car.speed));
    const spdF = Math.max(-1, Math.min(1, car.speed / 13));
    car.heading += steer * def.turn * spdF * dt * (car.speed >= 0 ? 1 : -1);
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    const p = { x: nx, z: nz };
    city.collideCircle(p, 2.1);
    const hitWall = Math.abs(p.x - nx) > 0.01 || Math.abs(p.z - nz) > 0.01;
    car.x = p.x; car.z = p.z;
    if (hitWall && Math.abs(car.speed) > 6 && time - car.lastCrash > 0.7) {
      car.lastCrash = time;
      car.speed *= 0.45;
      effects.sparks({ x: car.x, y: 0.8, z: car.z });
      effects.dust({ x: car.x, y: 0.5, z: car.z });
      if (car.driver === 'player') { audio.crash(); effects.addShake(0.25); }
    }
    car.steer = steer;
  }

  function nearestCar(x, z, maxD, kinds) {
    let best = null, bd = maxD;
    for (const c of cars) {
      if (!c.alive || c.driver === 'police') continue;
      if (kinds && !kinds.includes(c.kind)) continue;
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  function update(dt, time) {
    // Soft car-car separation (skip the boat, which is in the water).
    for (let i = 0; i < cars.length; i++) {
      const a = cars[i];
      if (a.kind === 'boat') continue;
      for (let j = i + 1; j < cars.length; j++) {
        const b = cars[j];
        if (b.kind === 'boat') continue;
        const dx = b.x - a.x, dz = b.z - a.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 16 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const push = (4 - d) / 2;
          const ux = dx / d, uz = dz / d;
          if (a.driver !== 'player') { a.x -= ux * push; a.z -= uz * push; }
          if (b.driver !== 'player') { b.x += ux * push; b.z += uz * push; }
          a.speed *= 0.92; b.speed *= 0.92;
        }
      }
    }
    for (const car of cars) writeCarMesh(car, time);
    bodyMesh.instanceMatrix.needsUpdate = true;
    cabinMesh.instanceMatrix.needsUpdate = true;
    wheelMesh.instanceMatrix.needsUpdate = true;
    lightMesh.instanceMatrix.needsUpdate = true;
    if (bodyMesh.instanceColor) bodyMesh.instanceColor.needsUpdate = true;
    if (lightMesh.instanceColor) lightMesh.instanceColor.needsUpdate = true;
  }

  return {
    cars, spawnCar, despawnCar, stepCar, nearestCar, update,
    get count() { return cars.length; },
    // Repaint a car (used by the screenshot staging for a bright hero car).
    setCarColour(car, hex) {
      car.colour = hex;
      bodyMesh.setColorAt(car.slot, new THREE.Color(hex));
      if (bodyMesh.instanceColor) bodyMesh.instanceColor.needsUpdate = true;
    },
    // Parked cars for the player to steal, placed on street edges.
    spawnParked(rng, n) {
      const kinds = ['kestrel', 'bantam', 'longhorn', 'viceroy', 'tide', 'falcon', 'bike'];
      for (let k = 0; k < n; k++) {
        const ave = pick(rng, [-288, -240, -192, -144, -96, -48, 0, 48, 96, 144, 192, 240, 288]);
        const s = (rng() - 0.5) * 560;
        const alongX = rng() < 0.5;
        const x = alongX ? ave + (rng() < 0.5 ? 7.5 : -7.5) : s;
        const z = alongX ? s : ave + (rng() < 0.5 ? 7.5 : -7.5);
        const heading = alongX ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
        spawnCar(pick(rng, kinds), x, z, heading, 'parked');
      }
    },
  };
}
