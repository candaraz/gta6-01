// vehicles.js — sculpted 3D cars (sports, muscle, SUV, van, police) with arcade-sim
// driving physics: acceleration, steering, handbrake drift, damage smoke and fire.
import * as THREE from 'three';

export const VEHICLE_TYPES = {
  sports: { name: 'VELOZ GT', topSpeed: 62, accel: 26, grip: 0.94, color: 0xc8102e, spoiler: true },
  muscle: { name: 'BRUJA 440', topSpeed: 54, accel: 30, grip: 0.86, color: 0x1f6f3f, spoiler: false },
  suv: { name: 'COASTAL X', topSpeed: 48, accel: 20, grip: 0.9, color: 0xe8e0d0, spoiler: false },
  van: { name: 'ARMORED VAN', topSpeed: 42, accel: 15, grip: 0.92, color: 0x3a3f4a, spoiler: false },
  cruiser: { name: 'MKPD CRUISER', topSpeed: 56, accel: 24, grip: 0.92, color: 0xf2f2f2, police: true },
  interceptor: { name: 'MKPD INTERCEPTOR', topSpeed: 64, accel: 30, grip: 0.96, color: 0x14161c, police: true, spoiler: true },
  taxi: { name: 'KEYS CAB', topSpeed: 46, accel: 18, grip: 0.9, color: 0xffc21e, spoiler: false },
  sedan: { name: 'PALMA SEDAN', topSpeed: 47, accel: 19, grip: 0.9, color: 0x2a6ec2, spoiler: false },
};

function box(w, h, d, color, roughness = 0.35, metalness = 0.7) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness, metalness }),
  );
  m.castShadow = true;
  return m;
}

export function createCarMesh(type, colorOverride) {
  const def = VEHICLE_TYPES[type] || VEHICLE_TYPES.sedan;
  const color = colorOverride !== undefined ? colorOverride : def.color;
  const g = new THREE.Group();
  const isVan = type === 'van';
  const bodyH = isVan ? 1.7 : 0.62;
  const bodyY = isVan ? 1.15 : 0.62;
  const bodyLen = isVan ? 5.2 : type === 'sports' ? 4.6 : 4.8;
  const bodyWid = isVan ? 2.2 : 2.0;

  // lower body
  const body = box(bodyWid, bodyH, bodyLen, color, 0.28, 0.75);
  body.position.y = bodyY;
  g.add(body);
  // cabin / greenhouse
  const cabin = box(bodyWid * 0.86, isVan ? 0.5 : 0.55, isVan ? 3.4 : 2.2, 0x11141c, 0.15, 0.9);
  cabin.position.set(0, bodyY + bodyH / 2 + 0.26, isVan ? -0.4 : -0.25);
  g.add(cabin);
  // windshield slope (dark glass plane)
  const shield = new THREE.Mesh(
    new THREE.PlaneGeometry(bodyWid * 0.8, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x0e2233, roughness: 0.08, metalness: 0.95 }),
  );
  shield.position.set(0, bodyY + bodyH / 2 + 0.45, 0.95);
  shield.rotation.x = -0.5;
  g.add(shield);
  // wheel arches + wheels
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.34, 14);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.95 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xc8ccd4, roughness: 0.25, metalness: 0.9 });
  for (const [wx, wz] of [[-0.95, 1.55], [0.95, 1.55], [-0.95, -1.55], [0.95, -1.55]]) {
    const wheel = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeo, tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.36, 10), hubMat);
    hub.rotation.z = Math.PI / 2;
    wheel.add(tire);
    wheel.add(hub);
    wheel.position.set(wx, 0.42, wz);
    g.add(wheel);
    wheels.push(wheel);
  }
  // headlights (emissive) + fake volumetric cones
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a8, emissiveIntensity: 3 });
  for (const sx of [-0.68, 0.68]) {
    const hl = box(0.42, 0.16, 0.1, 0xfff2c0, 0.2, 0.2);
    hl.material = headMat;
    hl.position.set(sx, 0.72, bodyLen / 2 + 0.02);
    g.add(hl);
  }
  const coneGeo = new THREE.ConeGeometry(1.5, 9, 12, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xffe9a8, transparent: true, opacity: 0.10, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  for (const sx of [-0.68, 0.68]) {
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.rotation.x = -Math.PI / 2 - 0.06;
    cone.position.set(sx, 0.6, bodyLen / 2 + 4.6);
    g.add(cone);
  }
  // taillights
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff1e1e, emissive: 0xff1e1e, emissiveIntensity: 2.4 });
  for (const sx of [-0.68, 0.68]) {
    const tl = box(0.42, 0.14, 0.1, 0xff1e1e, 0.3, 0.2);
    tl.material = tailMat;
    tl.position.set(sx, 0.72, -bodyLen / 2 - 0.02);
    g.add(tl);
  }
  // spoiler on sports / interceptor
  if (def.spoiler) {
    const wing = box(1.9, 0.08, 0.5, 0x11141c, 0.3, 0.8);
    wing.position.set(0, 1.28, -bodyLen / 2 + 0.25);
    g.add(wing);
    for (const sx of [-0.8, 0.8]) {
      const strut = box(0.08, 0.3, 0.08, 0x11141c, 0.3, 0.8);
      strut.position.set(sx, 1.1, -bodyLen / 2 + 0.25);
      g.add(strut);
    }
  }
  // police livery: lightbar + door decal
  if (def.police) {
    const barBase = box(1.3, 0.14, 0.5, 0x14161c, 0.4, 0.5);
    barBase.position.set(0, 1.52, -0.25);
    g.add(barBase);
    const redMat = new THREE.MeshStandardMaterial({ color: 0xff1e1e, emissive: 0xff1e1e, emissiveIntensity: 4 });
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x1e6bff, emissive: 0x1e6bff, emissiveIntensity: 4 });
    const red = box(0.55, 0.18, 0.5, 0xff1e1e, 0.3, 0.3);
    red.material = redMat;
    red.position.set(-0.33, 1.62, -0.25);
    g.add(red);
    const blue = box(0.55, 0.18, 0.5, 0x1e6bff, 0.3, 0.3);
    blue.material = blueMat;
    blue.position.set(0.33, 1.62, -0.25);
    g.add(blue);
    // lightbar halo (additive glow sprite)
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0x8899ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    halo.position.set(0, 1.65, -0.25);
    halo.scale.y = 0.5;
    g.add(halo);
    g.userData.lightbar = { red, blue, halo, phase: Math.random() * 10 };
    // MKPD door stripe
    const stripe = box(0.06, 0.3, 3.4, 0x1e6bff, 0.4, 0.4);
    stripe.position.set(-1.01, 0.72, 0);
    g.add(stripe);
    const stripe2 = stripe.clone();
    stripe2.position.x = 1.01;
    g.add(stripe2);
  }
  g.userData.wheels = wheels;
  g.userData.def = def;
  g.userData.type = type;
  return g;
}

export class Vehicle {
  constructor(mesh, position, heading = 0) {
    this.mesh = mesh;
    this.def = mesh.userData.def;
    this.position = position.clone();
    this.position.y = 0;
    this.heading = heading;
    this.speed = 0; // signed, units/s
    this.steer = 0;
    this.health = 100;
    this.burning = false;
    this.smokeTimer = 0;
    this.drift = 0;
    this.driver = null;
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = heading;
  }

  update(dt, input, world) {
    const def = this.def;
    const maxSpeed = def.topSpeed * (this.health < 30 ? 0.6 : 1);
    let targetSteer = 0;
    if (input) {
      if (input.left) targetSteer += 1;
      if (input.right) targetSteer -= 1;
    }
    this.steer += (targetSteer - this.steer) * Math.min(1, dt * 8);
    const handbrake = input && input.handbrake;
    if (input && input.forward) this.speed += def.accel * dt;
    if (input && input.back) this.speed -= def.accel * 0.8 * dt;
    // drag + rolling resistance
    this.speed -= this.speed * (handbrake ? 0.4 : 1.1) * dt;
    this.speed = THREE.MathUtils.clamp(this.speed, -maxSpeed * 0.45, maxSpeed);
    if (Math.abs(this.speed) < 0.05 && !(input && (input.forward || input.back))) this.speed = 0;

    const speedFactor = THREE.MathUtils.clamp(Math.abs(this.speed) / 22, 0, 1);
    const turnRate = this.steer * (handbrake ? 2.4 : 1.35) * speedFactor * (this.speed >= 0 ? 1 : -1);
    this.heading += turnRate * dt * (handbrake ? 1.5 : 1);
    this.drift = handbrake ? THREE.MathUtils.clamp(this.drift + dt * 3, 0, 1) : Math.max(0, this.drift - dt * 4);

    const forward = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const lateral = new THREE.Vector3(forward.z, 0, -forward.x);
    const driftOffset = lateral.multiplyScalar(this.drift * this.speed * 0.35);
    this.position.addScaledVector(forward, this.speed * dt);
    this.position.addScaledVector(driftOffset, dt);
    // keep inside the city bounds (ground slab ends at x=335, z=335)
    this.position.x = THREE.MathUtils.clamp(this.position.x, -245, 330);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -250, 330);

    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.heading;
    // body roll + pitch juice
    this.mesh.rotation.z = -this.steer * speedFactor * 0.06 - this.drift * this.steer * 0.12;
    this.mesh.rotation.x = THREE.MathUtils.clamp(-this.speed * 0.0006, -0.02, 0.02);
    // spinning wheels
    const spin = this.speed * dt / 0.42;
    for (const w of this.mesh.userData.wheels) {
      w.rotation.x += spin;
      w.rotation.y = this.steer * 0.3 * (w.position.z > 0 ? 1 : 0);
    }
    // police lightbar flash
    const lb = this.mesh.userData.lightbar;
    if (lb) {
      lb.phase += dt * 9;
      const on = Math.sin(lb.phase) > 0;
      lb.red.material.emissiveIntensity = on ? 5 : 0.4;
      lb.blue.material.emissiveIntensity = on ? 0.4 : 5;
      lb.halo.material.opacity = 0.10 + Math.abs(Math.sin(lb.phase)) * 0.12;
    }
    // damage smoke
    if (this.health < 45 && !this.burning) {
      this.smokeTimer += dt;
    }
    return this.speed;
  }

  damage(amount) {
    this.health -= amount;
    if (this.health <= 0 && !this.burning) {
      this.burning = true;
      this.health = 0;
    }
  }
}
