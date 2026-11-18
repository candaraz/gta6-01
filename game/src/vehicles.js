// Cars: one mesh builder per class, arcade handling with a distinct feel per
// class, and the parked cars waiting to be stolen. Physics is deliberately
// simple — speed, heading and grip — so it feels right at 60 steps a second
// and never tunnels through a building.

import * as THREE from 'three';
import { VEHICLE_CLASSES } from './config.js';

const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1c });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x1e2e3a });
const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff6d8, emissive: 0xfff2c8, emissiveIntensity: 0.9 });
const tailMat = new THREE.MeshLambertMaterial({ color: 0xaa1c1c, emissive: 0x881111, emissiveIntensity: 0.6 });

export function buildCarMesh(classId, color) {
  const spec = VEHICLE_CLASSES[classId];
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const bodyHeight = classId === 'van' ? spec.height * 0.72 : spec.height * 0.55;
  const body = new THREE.Mesh(new THREE.BoxGeometry(spec.width, bodyHeight, spec.length), bodyMat);
  body.position.y = 0.42 + bodyHeight / 2;
  body.castShadow = true;
  group.add(body);

  if (classId !== 'van') {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.84, spec.height * 0.5, spec.length * 0.44), glassMat);
    cabin.position.set(0, 0.42 + bodyHeight + spec.height * 0.22, -spec.length * 0.04);
    cabin.castShadow = true;
    group.add(cabin);
  } else {
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.86, spec.height * 0.3, 0.1), glassMat);
    windshield.position.set(0, spec.height * 0.72, spec.length / 2 - 0.05);
    group.add(windshield);
  }
  if (classId === 'pickup') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.9, 0.34, spec.length * 0.4), bodyMat);
    bed.position.set(0, 0.42 + bodyHeight + 0.1, -spec.length * 0.26);
    group.add(bed);
  }

  const wheels = [];
  const wheelOffsets = [
    [-spec.width / 2, spec.length / 2 - 0.8, true],
    [spec.width / 2, spec.length / 2 - 0.8, true],
    [-spec.width / 2, -spec.length / 2 + 0.8, false],
    [spec.width / 2, -spec.length / 2 + 0.8, false],
  ];
  for (const [x, z, front] of wheelOffsets) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.36, z);
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    pivot.add(wheel);
    group.add(pivot);
    wheels.push({ pivot, wheel, front });
  }

  const headGeo = new THREE.BoxGeometry(0.4, 0.18, 0.1);
  for (const side of [-1, 1]) {
    const head = new THREE.Mesh(headGeo, lightMat);
    head.position.set(side * (spec.width / 2 - 0.35), 0.72, spec.length / 2 + 0.02);
    group.add(head);
    const tail = new THREE.Mesh(headGeo, tailMat);
    tail.position.set(side * (spec.width / 2 - 0.35), 0.72, -spec.length / 2 - 0.02);
    group.add(tail);
  }

  let lightBar = null;
  if (classId === 'police') {
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 0.4), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    barBase.position.set(0, 0.42 + bodyHeight + spec.height * 0.48, -spec.length * 0.04);
    group.add(barBase);
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.22, 0.34),
      new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 1.6 }),
    );
    red.position.set(-0.32, 0.42 + bodyHeight + spec.height * 0.48 + 0.16, -spec.length * 0.04);
    group.add(red);
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.22, 0.34),
      new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x0022ff, emissiveIntensity: 1.6 }),
    );
    blue.position.set(0.32, 0.42 + bodyHeight + spec.height * 0.48 + 0.16, -spec.length * 0.04);
    group.add(blue);
    lightBar = { red, blue };
    // White doors on the dark body: the city's own livery.
    const doorGeo = new THREE.BoxGeometry(0.06, bodyHeight * 0.7, spec.length * 0.34);
    const doorMat = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });
    for (const side of [-1, 1]) {
      const door = new THREE.Mesh(doorGeo, doorMat);
      door.position.set(side * (spec.width / 2 + 0.01), 0.42 + bodyHeight / 2, 0);
      group.add(door);
    }
  }

  return { group, wheels, lightBar, spec };
}

// A vehicle in the world: position, heading in radians (0 faces +z, and the
// facing vector is (sin heading, cos heading)), speed along its facing, health.
export function createVehicle(classId, color, x, z, heading) {
  const { group, wheels, lightBar, spec } = buildCarMesh(classId, color);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  return {
    classId,
    spec,
    mesh: group,
    wheels,
    lightBar,
    x,
    z,
    heading,
    speed: 0,
    health: 100,
    steering: 0,
    wheelSpin: 0,
    smoke: 0,
    isPlayerCar: false,
    isPolice: classId === 'police',
    isTraffic: false,
    dead: false,
    flashPhase: Math.random() * Math.PI * 2,
  };
}

// Arcade driving: throttle accelerates toward the class top speed, steering
// turns harder at low speed, the handbrake cuts grip for slides.
export function driveVehicle(vehicle, throttle, steerInput, handbrake, dt, city, onCrash) {
  const spec = vehicle.spec;
  const forward = throttle;
  if (forward > 0) vehicle.speed += spec.accel * forward * dt;
  else if (forward < 0) {
    if (vehicle.speed > 0.5) vehicle.speed -= spec.brake * dt;
    else vehicle.speed = Math.max(vehicle.speed + spec.accel * 0.6 * forward * dt, -spec.topSpeed * 0.35);
  } else {
    // Rolling drag.
    vehicle.speed -= Math.sign(vehicle.speed) * Math.min(Math.abs(vehicle.speed), 3.5 * dt);
  }
  vehicle.speed = Math.max(-spec.topSpeed * 0.35, Math.min(spec.topSpeed, vehicle.speed));

  const speedFactor = Math.min(1, Math.abs(vehicle.speed) / 12);
  const targetSteer = steerInput * spec.steer * (0.45 + 0.55 * (1 - speedFactor * 0.6));
  vehicle.steering += (targetSteer - vehicle.steering) * Math.min(1, dt * 8);
  const grip = handbrake ? spec.grip * 0.35 : spec.grip;
  const turnRate = vehicle.steering * Math.min(1, Math.abs(vehicle.speed) / 6) * (handbrake ? 1.5 : 1);
  vehicle.heading += turnRate * dt * Math.sign(vehicle.speed || 1);

  // Grip pulls the velocity toward the facing; low grip slides.
  const moveX = Math.sin(vehicle.heading) * vehicle.speed;
  const moveZ = Math.cos(vehicle.heading) * vehicle.speed;
  const newX = vehicle.x + moveX * dt;
  const newZ = vehicle.z + moveZ * dt;
  const radius = spec.length / 2;
  const resolved = city.resolveCollision(newX, newZ, radius * 0.82);
  const hitWall = Math.abs(resolved.x - newX) > 0.001 || Math.abs(resolved.z - newZ) > 0.001;
  if (hitWall && Math.abs(vehicle.speed) > 6) {
    const impact = Math.abs(vehicle.speed);
    vehicle.health -= impact * 0.55;
    vehicle.speed *= 0.35;
    if (onCrash) onCrash(impact);
  } else if (hitWall) {
    vehicle.speed *= 0.6;
  }
  vehicle.x = resolved.x;
  vehicle.z = resolved.z;
  vehicle.mesh.position.set(vehicle.x, 0, vehicle.z);
  vehicle.mesh.rotation.y = vehicle.heading;
  vehicle.wheelSpin += (vehicle.speed / 0.36) * dt;
  for (const wheel of vehicle.wheels) {
    wheel.wheel.rotation.x = vehicle.wheelSpin;
    wheel.pivot.rotation.y = wheel.front ? vehicle.steering * 0.42 : 0;
  }
  if (vehicle.lightBar) {
    vehicle.flashPhase += dt * 9;
    const on = Math.sin(vehicle.flashPhase) > 0;
    vehicle.lightBar.red.material.emissiveIntensity = on ? 2.2 : 0.15;
    vehicle.lightBar.blue.material.emissiveIntensity = on ? 0.15 : 2.2;
  }
  return { crashed: hitWall };
}

export function vehicleSpeedKmh(vehicle) {
  return Math.round(Math.abs(vehicle.speed) * 3.6);
}
