// Solmar Bay — the player on foot.
// One job: walk, sprint, jump and interact; get in and out of cars. The camera
// lives in camera.js; this file owns the body and its state.

import * as THREE from 'three';
import { PLAYER } from './config.js';
import { clamp } from './random.js';

export function makePlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0xd8622b }); // orange jacket
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2a3a55 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc89878 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.95, 10), jacket);
  body.position.y = 1.05; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skin);
  head.position.y = 1.78; head.castShadow = true; g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.26, 0.1, 12), new THREE.MeshLambertMaterial({ color: 0x1b1b22 }));
  cap.position.y = 1.95; g.add(cap);
  for (const sx of [-0.14, 0.14]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.6, 8), jeans);
    leg.position.set(sx, 0.32, 0); leg.castShadow = true; g.add(leg);
  }
  for (const sx of [-0.42, 0.42]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.7, 8), jacket);
    arm.position.set(sx, 1.05, 0); arm.castShadow = true; g.add(arm);
  }
  return g;
}

export class Player {
  constructor(scene, x, z) {
    this.mesh = makePlayerMesh();
    scene.add(this.mesh);
    this.x = x; this.z = z; this.y = 0;
    this.vy = 0;
    this.heading = 0; // facing, radians
    this.onGround = true;
    this.health = PLAYER.maxHealth;
    this.armour = 0;
    this.inVehicle = null; // Vehicle or null
    this.dead = false;
    this.walkPhase = 0;
    this.mesh.position.set(x, 0, z);
  }

  // Move on foot. moveX/moveZ are camera-relative, -1..1. Returns speed.
  walk(moveX, moveZ, sprint, jump, dt) {
    if (this.inVehicle || this.dead) return 0;
    const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    const len = Math.hypot(moveX, moveZ);
    let vx = 0, vz = 0;
    if (len > 0.01) {
      vx = (moveX / len) * speed;
      vz = (moveZ / len) * speed;
      this.heading = Math.atan2(moveX, moveZ);
      this.walkPhase += dt * (sprint ? 13 : 9);
    }
    this.x += vx * dt;
    this.z += vz * dt;
    // jump + gravity
    if (jump && this.onGround) { this.vy = PLAYER.jumpSpeed; this.onGround = false; }
    this.vy -= PLAYER.gravity * dt;
    this.y += this.vy * dt;
    if (this.y <= 0) { this.y = 0; this.vy = 0; this.onGround = true; }
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = this.heading;
    // simple walk bob + leg swing
    const bob = len > 0.01 ? Math.abs(Math.sin(this.walkPhase)) * 0.06 : 0;
    this.mesh.position.y = this.y + bob;
    this.mesh.children.forEach((c, i) => {
      if (i >= 4) c.rotation.x = len > 0.01 ? Math.sin(this.walkPhase + (i % 2 ? Math.PI : 0)) * 0.5 : 0;
    });
    return len > 0.01 ? speed : 0;
  }

  // Take damage: armour absorbs first, then health.
  hurt(amount) {
    if (this.dead) return;
    const absorbed = Math.min(this.armour, amount);
    this.armour -= absorbed;
    this.health -= (amount - absorbed);
    if (this.health <= 0) { this.health = 0; this.dead = true; }
  }
  heal(amount) { this.health = clamp(this.health + amount, 0, PLAYER.maxHealth); }
  addArmour(amount) { this.armour = clamp(this.armour + amount, 0, PLAYER.maxArmour); }

  enterVehicle(v) {
    this.inVehicle = v;
    v.driver = 'player';
    this.mesh.visible = false;
  }
  exitVehicle() {
    const v = this.inVehicle;
    if (!v) return;
    v.driver = null;
    this.inVehicle = null;
    // step out to the driver's side
    const side = Math.cos(v.heading);
    const sideZ = -Math.sin(v.heading);
    this.x = v.x + side * 2.2;
    this.z = v.z + sideZ * 2.2;
    this.y = 0;
    this.mesh.visible = true;
    this.mesh.position.set(this.x, 0, this.z);
  }

  reset(x, z) {
    this.x = x; this.z = z; this.y = 0; this.vy = 0;
    this.health = PLAYER.maxHealth;
    this.dead = false;
    if (this.inVehicle) this.exitVehicle();
    this.mesh.visible = true;
    this.mesh.position.set(x, 0, z);
  }
}
