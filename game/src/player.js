// player.js — the on-foot character: camera-relative WASD movement
// (W always moves AWAY from the camera), sprint, entering and leaving
// vehicles with E, and the health / busted / wasted states.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { clamp, dist } from './random.js';

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.x = -245; this.z = -245;
    this.heading = Math.PI; // faces south, into the city
    this.aimHeading = this.heading;
    this.health = 100;
    this.maxHealth = 100;
    this.speed = 0;
    this.inVehicle = null;
    this.firing = false;
    this.bustedTimer = 0;
    this.wasted = false;
    this.busted = false;
    this.invuln = 0;

    const group = new THREE.Group();
    const jacket = new THREE.MeshLambertMaterial({ color: 0x2a6e8a });
    const jeans = new THREE.MeshLambertMaterial({ color: 0x2a2a3a });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd8a878 });
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 1.0, 10), jacket);
    torso.position.y = 1.15;
    group.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 10), skin);
    head.position.y = 1.95;
    group.add(head);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 10), new THREE.MeshLambertMaterial({ color: 0xd42a2a }));
    cap.position.y = 2.18;
    group.add(cap);
    for (const sx of [-0.2, 0.2]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.9, 8), jeans);
      leg.position.set(sx, 0.45, 0);
      leg.name = 'leg';
      group.add(leg);
    }
    // A simple held gun, shown while armed.
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.5), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
    gun.position.set(0.3, 1.25, 0.4);
    gun.name = 'gun';
    group.add(gun);
    this.mesh = group;
    this.mesh.position.set(this.x, 0, this.z);
    scene.add(group);
    this.walkPhase = 0;
  }

  get pos() { return { x: this.x, z: this.z }; }

  // Instant reposition (used by the test driver and mission teleports).
  teleport(x, z, heading) {
    if (this.inVehicle) {
      this.inVehicle.x = x; this.inVehicle.z = z;
      this.inVehicle.speed = 0;
      if (heading !== undefined) { this.inVehicle.heading = heading; this.inVehicle.mesh.rotation.y = heading; }
    }
    this.x = x; this.z = z;
    if (heading !== undefined) this.heading = heading;
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = this.heading;
  }

  // Move on foot. fwd/strafe are -1..1 in camera space; camFwd is the
  // camera's forward on the ground (the direction W must take us).
  moveOnFoot(dt, fwd, strafe, camFwdX, camFwdZ, sprint, city, others) {
    const len = Math.hypot(fwd, strafe);
    if (len > 0.01) {
      const nx = fwd / len, nz = strafe / len;
      // Camera-relative: forward is away from the camera, right is its right.
      const rx = -camFwdZ, rz = camFwdX;
      const mx = camFwdX * nx + rx * nz;
      const mz = camFwdZ * nx + rz * nz;
      const targetSpeed = sprint ? 10 : 6;
      this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 8);
      const p = { x: this.x + mx * this.speed * dt, z: this.z + mz * this.speed * dt };
      const hitWall = city.collide(p, 0.5);
      if (!hitWall || true) { this.x = p.x; this.z = p.z; }
      // The map edge is a wall: nobody walks off the world.
      this.x = clamp(this.x, -WORLD.half, WORLD.half);
      this.z = clamp(this.z, -WORLD.half, WORLD.half);
      // Face the movement direction unless aiming.
      if (!this.firing) this.heading = Math.atan2(mx, mz);
      this.walkPhase += dt * this.speed * 1.6;
    } else {
      this.speed += (0 - this.speed) * Math.min(1, dt * 10);
    }
    // Gentle push from vehicles so cars cannot sit inside the player.
    for (const v of others) {
      if (v.dead) continue;
      const d = dist(this.x, this.z, v.x, v.z);
      if (d < v.radius + 0.5 && d > 0.01) {
        this.x += ((this.x - v.x) / d) * (v.radius + 0.5 - d);
        this.z += ((this.z - v.z) / d) * (v.radius + 0.5 - d);
      }
    }
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.firing ? this.aimHeading : this.heading;
    // Walk-cycle leg swing.
    const swing = Math.sin(this.walkPhase) * 0.5 * clamp(this.speed / 6, 0, 1);
    this.mesh.children.forEach((c) => {
      if (c.name === 'leg') c.rotation.x = c.position.x < 0 ? swing : -swing;
    });
  }

  // Find the nearest boardable vehicle (driverless, traffic, or parked).
  // Police, roadblock and race cars are never boardable.
  nearestBoardable(vehicles, maxD) {
    let best = null, bd = maxD * maxD;
    for (const v of vehicles) {
      if (v.dead) continue;
      if (v.driver === 'police' || v.driver === 'roadblock' || v.driver === 'racer') continue;
      const d2 = (v.x - this.x) ** 2 + (v.z - this.z) ** 2;
      if (d2 < bd) { bd = d2; best = v; }
    }
    return best;
  }

  enterVehicle(v) {
    this.inVehicle = v;
    v.driver = 'player';
    v.speed = 0;
    this.mesh.visible = false;
  }

  exitVehicle() {
    if (!this.inVehicle) return null;
    const v = this.inVehicle;
    v.driver = null;
    this.inVehicle = null;
    // Step out to the left of the vehicle.
    const side = v.heading + Math.PI / 2;
    this.x = v.x + Math.sin(side) * 2.5;
    this.z = v.z + Math.cos(side) * 2.5;
    this.mesh.visible = true;
    this.mesh.position.set(this.x, 0, this.z);
    return v;
  }

  hurt(amount) {
    if (this.invuln > 0) return false;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.wasted = true;
      return true;
    }
    return false;
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  respawnAt(x, z) {
    this.x = x; this.z = z;
    this.health = this.maxHealth;
    this.wasted = false;
    this.busted = false;
    this.invuln = 3;
    if (this.inVehicle) this.exitVehicle();
    this.mesh.visible = true;
    this.mesh.position.set(x, 0, z);
  }

  update(dt) {
    this.invuln = Math.max(0, this.invuln - dt);
    if (this.inVehicle) {
      this.x = this.inVehicle.x;
      this.z = this.inVehicle.z;
    }
  }
}
