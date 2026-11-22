// traffic.js — 20+ civilian vehicles following the road grid: lane discipline,
// turns at intersections, red-light stops, braking for the player, panic on gunfire.
import * as THREE from 'three';
import { createCarMesh, Vehicle } from './vehicles.js';
import { ROAD_XS, ROAD_ZS } from '../world/cityBuilder.js';

const TRAFFIC_TYPES = ['sedan', 'sedan', 'taxi', 'suv', 'muscle', 'van', 'sedan', 'taxi'];
const TRAFFIC_COLORS = [0x2a6ec2, 0xd9d9d9, 0xc23b2a, 0x3a9e4f, 0x7a4fb5, 0x8a8a8a, 0x1c1f26, 0xe8c33a];

export class TrafficSystem {
  constructor(scene, world, seed = 7) {
    this.scene = scene;
    this.world = world;
    this.cars = [];
    let s = seed * 7919 + 13;
    this.rng = () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
    this.lightState = 'green';
    this.lightTimer = 0;
    this.panic = 0;
  }

  spawn(count = 22) {
    for (let i = 0; i < count; i++) {
      const type = TRAFFIC_TYPES[Math.floor(this.rng() * TRAFFIC_TYPES.length)];
      const color = TRAFFIC_COLORS[Math.floor(this.rng() * TRAFFIC_COLORS.length)];
      const mesh = createCarMesh(type, color);
      this.scene.add(mesh);
      const v = new Vehicle(mesh, this.randomRoadPoint(), this.rng() * Math.PI * 2);
      v.cruiseSpeed = 10 + this.rng() * 7;
      v.targetNode = this.randomNode();
      v.waitTimer = 0;
      v.panicking = false;
      this.cars.push(v);
    }
  }

  randomNode() {
    const ix = Math.floor(this.rng() * ROAD_XS.length);
    const iz = Math.floor(this.rng() * ROAD_ZS.length);
    return iz * ROAD_XS.length + ix;
  }

  randomRoadPoint() {
    const horizontal = this.rng() < 0.5;
    if (horizontal) {
      return new THREE.Vector3(-240 + this.rng() * 480, 0, ROAD_ZS[Math.floor(this.rng() * ROAD_ZS.length)] + 3.5);
    }
    return new THREE.Vector3(ROAD_XS[Math.floor(this.rng() * ROAD_XS.length)] + 3.5, 0, -240 + this.rng() * 480);
  }

  triggerPanic(at) {
    this.panic = 1;
    for (const car of this.cars) {
      if (car.position.distanceTo(at) < 90) car.panicking = true;
    }
  }

  update(dt, playerPos, playerVehicle) {
    this.lightTimer += dt;
    if (this.lightTimer > 9) {
      this.lightTimer = 0;
      this.lightState = this.lightState === 'green' ? 'red' : 'green';
      for (const tl of this.world.trafficLights) {
        tl.lamps[0].material.emissiveIntensity = this.lightState === 'red' ? 3.2 : 0.15;
        tl.lamps[2].material.emissiveIntensity = this.lightState === 'green' ? 3.2 : 0.15;
      }
    }
    this.panic = Math.max(0, this.panic - dt * 0.25);

    for (const car of this.cars) {
      const target = this.world.graph.nodes[car.targetNode];
      const toTarget = new THREE.Vector3().subVectors(target, car.position);
      toTarget.y = 0;
      const dist = toTarget.length();
      if (dist < 6) {
        car.targetNode = this.randomNode();
        continue;
      }
      const desiredHeading = Math.atan2(toTarget.x, toTarget.z);
      let d = desiredHeading - car.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      car.heading += THREE.MathUtils.clamp(d, -dt * 1.4, dt * 1.4);

      // stopping: red light near an intersection, or the player in the way
      let wantStop = false;
      if (this.lightState === 'red' && dist < 26) wantStop = true;
      const playerBlock = playerVehicle ? playerVehicle.position : playerPos;
      if (playerBlock && car.position.distanceTo(playerBlock) < 9) wantStop = true;
      // car ahead
      for (const other of this.cars) {
        if (other === car) continue;
        if (other.position.distanceTo(car.position) < 8) {
          const ahead = new THREE.Vector3(Math.sin(car.heading), 0, Math.cos(car.heading));
          const toOther = new THREE.Vector3().subVectors(other.position, car.position);
          if (toOther.dot(ahead) > 0) { wantStop = true; break; }
        }
      }
      if (wantStop) {
        car.waitTimer += dt;
        car.speed = THREE.MathUtils.lerp(car.speed, 0, Math.min(1, dt * 6));
      } else {
        const cruise = car.panicking ? car.cruiseSpeed * 1.9 : car.cruiseSpeed;
        car.speed = THREE.MathUtils.lerp(car.speed, cruise, Math.min(1, dt * 1.2));
      }
      const forward = new THREE.Vector3(Math.sin(car.heading), 0, Math.cos(car.heading));
      car.position.addScaledVector(forward, car.speed * dt);
      car.mesh.position.copy(car.position);
      car.mesh.rotation.y = car.heading;
      const spin = car.speed * dt / 0.42;
      for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
      if (car.panicking && this.rng() < 0.002) car.panicking = false;
    }
  }
}
