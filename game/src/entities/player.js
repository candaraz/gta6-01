// player.js — Mateo Vega & Elena Cruz: articulated 3D humanoids with walk/run
// animation, aiming stance, on-foot physics and carjacking (F to enter any car).
import * as THREE from 'three';

export const CHARACTERS = {
  mateo: {
    name: 'MATEO VEGA', skin: 0xc98d64, shirt: 0x2a6ec2, pants: 0x2a2f38,
    hair: 0x1a120c, accent: 0xffd24d, bio: 'Ex-wheelman, back in the Keys with a debt to pay.',
  },
  elena: {
    name: 'ELENA CRUZ', skin: 0xd9a37e, shirt: 0xc22a6e, pants: 0x1c1f26,
    hair: 0x2a1a10, accent: 0x19e3ff, bio: 'Fixer, getaway driver, the crew’s calm under fire.',
  },
};

export function createHumanoidMesh(charKey) {
  const c = CHARACTERS[charKey] || CHARACTERS.mateo;
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: c.skin, roughness: 0.7 });
  const shirt = new THREE.MeshStandardMaterial({ color: c.shirt, roughness: 0.75 });
  const pants = new THREE.MeshStandardMaterial({ color: c.pants, roughness: 0.8 });
  const hairM = new THREE.MeshStandardMaterial({ color: c.hair, roughness: 0.9 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt);
  torso.position.y = 1.18;
  torso.castShadow = true;
  g.add(torso);
  // accent jacket stripe
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.12, 0.36),
    new THREE.MeshStandardMaterial({ color: c.accent, roughness: 0.5, emissive: c.accent, emissiveIntensity: 0.25 }));
  stripe.position.y = 1.38;
  g.add(stripe);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), skin);
  head.position.y = 1.78;
  head.castShadow = true;
  g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM);
  hair.position.y = 1.82;
  g.add(hair);
  const arms = [];
  for (const sx of [-0.4, 0.4]) {
    const arm = new THREE.Group();
    arm.position.set(sx, 1.48, 0);
    const armMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.18), shirt);
    armMesh.position.y = -0.31;
    armMesh.castShadow = true;
    arm.add(armMesh);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), skin);
    hand.position.y = -0.64;
    arm.add(hand);
    g.add(arm);
    arms.push(arm);
  }
  const legs = [];
  for (const sx of [-0.16, 0.16]) {
    const leg = new THREE.Group();
    leg.position.set(sx, 0.82, 0);
    const legMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), pants);
    legMesh.position.y = -0.4;
    legMesh.castShadow = true;
    leg.add(legMesh);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.36),
      new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.5 }));
    shoe.position.set(0, -0.78, 0.05);
    leg.add(shoe);
    g.add(leg);
    legs.push(leg);
  }
  g.userData = { ...g.userData, arms, legs, torso, head, charKey };
  return g;
}

export class Player {
  constructor(scene, charKey = 'mateo') {
    this.charKey = charKey;
    this.mesh = createHumanoidMesh(charKey);
    scene.add(this.mesh);
    this.position = new THREE.Vector3(-240, 0, 40);
    this.heading = Math.PI;
    this.velocity = new THREE.Vector3();
    this.onGround = true;
    this.verticalSpeed = 0;
    this.health = 100;
    this.armor = 50;
    this.inVehicle = null;
    this.aiming = false;
    this.walkPhase = 0;
    this.speed = 0;
    this.mesh.position.copy(this.position);
  }

  switchCharacter(scene, charKey) {
    if (charKey === this.charKey) return;
    scene.remove(this.mesh);
    this.charKey = charKey;
    this.mesh = createHumanoidMesh(charKey);
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.heading;
    scene.add(this.mesh);
  }

  update(dt, input, cameraYaw) {
    if (this.inVehicle) return;
    const sprint = input.sprint ? 1.55 : 1;
    const maxSpeed = 7.5 * sprint;
    const forward = new THREE.Vector3(Math.sin(cameraYaw), 0, Math.cos(cameraYaw));
    const right = new THREE.Vector3(forward.z, 0, -forward.x);
    const move = new THREE.Vector3();
    if (input.forward) move.add(forward);
    if (input.back) move.sub(forward);
    if (input.right) move.add(right);
    if (input.left) move.sub(right);
    if (move.lengthSq() > 0) {
      move.normalize();
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, move.x * maxSpeed, Math.min(1, dt * 10));
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, move.z * maxSpeed, Math.min(1, dt * 10));
      const targetHeading = Math.atan2(move.x, move.z);
      let d = targetHeading - this.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.heading += d * Math.min(1, dt * 12);
    } else {
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, 0, Math.min(1, dt * 10));
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, 0, Math.min(1, dt * 10));
    }
    // jump
    if (input.jump && this.onGround) {
      this.verticalSpeed = 7.2;
      this.onGround = false;
    }
    if (!this.onGround) {
      this.verticalSpeed -= 22 * dt;
      this.position.y += this.verticalSpeed * dt;
      if (this.position.y <= 0) {
        this.position.y = 0;
        this.verticalSpeed = 0;
        this.onGround = true;
      }
    }
    this.position.addScaledVector(this.velocity, dt);
    this.position.x = THREE.MathUtils.clamp(this.position.x, -330, 330);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -255, 330);

    this.speed = Math.hypot(this.velocity.x, this.velocity.z);
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.aiming ? cameraYaw : this.heading;
    // walk / run animation
    const { arms, legs } = this.mesh.userData;
    if (this.speed > 0.4) {
      this.walkPhase += dt * this.speed * 1.6;
      const swing = Math.sin(this.walkPhase) * 0.7;
      legs[0].rotation.x = swing;
      legs[1].rotation.x = -swing;
      arms[0].rotation.x = this.aiming ? -1.2 : -swing * 0.8;
      arms[1].rotation.x = this.aiming ? -1.2 : swing * 0.8;
    } else {
      legs[0].rotation.x *= 0.85;
      legs[1].rotation.x *= 0.85;
      arms[0].rotation.x = this.aiming ? -1.2 : THREE.MathUtils.lerp(arms[0].rotation.x, 0, dt * 6);
      arms[1].rotation.x = this.aiming ? -1.2 : THREE.MathUtils.lerp(arms[1].rotation.x, 0, dt * 6);
    }
    // idle breathing
    this.mesh.userData.torso.position.y = 1.18 + Math.sin(performance.now() * 0.002) * 0.012;
  }

  takeDamage(amount) {
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, amount * 0.6);
      this.armor -= absorbed;
      amount -= absorbed;
    }
    this.health -= amount;
    return this.health <= 0;
  }

  enterVehicle(vehicle) {
    this.inVehicle = vehicle;
    vehicle.driver = this;
    this.mesh.visible = false;
  }

  exitVehicle() {
    if (!this.inVehicle) return null;
    const v = this.inVehicle;
    this.inVehicle = null;
    v.driver = null;
    const side = new THREE.Vector3(Math.cos(v.heading), 0, -Math.sin(v.heading));
    this.position.copy(v.position).addScaledVector(side, 2.6);
    this.position.y = 0;
    this.mesh.visible = true;
    this.mesh.position.copy(this.position);
    return v;
  }
}
