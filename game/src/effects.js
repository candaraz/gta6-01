// effects.js — particles, muzzle flashes, explosions and screen shake.
// One THREE.Points pool reused for every burst, so effects never allocate
// mid-frame. Explosions also flash a light and shake the camera.
import * as THREE from 'three';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.max = 900;
    this.pos = new Float32Array(this.max * 3);
    this.col = new Float32Array(this.max * 3);
    this.vel = new Float32Array(this.max * 3);
    this.life = new Float32Array(this.max);
    this.head = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const mat = new THREE.PointsMaterial({ size: 0.9, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    for (let i = 0; i < this.max; i++) this.pos[i * 3 + 1] = -100;

    this.flash = new THREE.PointLight(0xffcc66, 0, 30);
    scene.add(this.flash);
    this.shake = 0;
    this.smoke = [];
  }

  burst(x, y, z, n, colour, speed, up, life) {
    for (let k = 0; k < n; k++) {
      const i = this.head;
      this.head = (this.head + 1) % this.max;
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.vel[i * 3] = Math.cos(a) * s;
      this.vel[i * 3 + 1] = up + Math.random() * speed * 0.5;
      this.vel[i * 3 + 2] = Math.sin(a) * s;
      const c = new THREE.Color(colour);
      const shade = 0.7 + Math.random() * 0.5;
      this.col[i * 3] = Math.min(1, c.r * shade);
      this.col[i * 3 + 1] = Math.min(1, c.g * shade);
      this.col[i * 3 + 2] = Math.min(1, c.b * shade);
      this.life[i] = life * (0.5 + Math.random() * 0.8);
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  muzzle(x, y, z) {
    this.burst(x, y, z, 6, 0xffd24a, 6, 1, 0.12);
    this.flash.position.set(x, y, z);
    this.flash.intensity = 60;
  }

  explosion(x, y, z, big) {
    const n = big ? 90 : 45;
    this.burst(x, y + 0.5, z, n, 0xff7a1a, big ? 16 : 11, 7, big ? 1.1 : 0.8);
    this.burst(x, y + 0.5, z, n / 2, 0x333333, 5, 9, 1.8);
    this.burst(x, y + 0.5, z, 20, 0xffe08a, 9, 5, 0.4);
    this.flash.position.set(x, y + 2, z);
    this.flash.intensity = big ? 400 : 200;
    this.shake = Math.max(this.shake, big ? 1.0 : 0.55);
  }

  sparks(x, y, z) {
    this.burst(x, y, z, 14, 0xffc860, 8, 3, 0.5);
  }

  blood(x, y, z) {
    this.burst(x, y, z, 10, 0xa01818, 4, 2, 0.5);
  }

  // A rising ring of sparks for a collected coin or checkpoint.
  ring(x, y, z, colour) {
    for (let k = 0; k < 18; k++) {
      const i = this.head;
      this.head = (this.head + 1) % this.max;
      const a = (k / 18) * Math.PI * 2;
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
      this.vel[i * 3] = Math.cos(a) * 7;
      this.vel[i * 3 + 1] = 4;
      this.vel[i * 3 + 2] = Math.sin(a) * 7;
      const c = new THREE.Color(colour);
      this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
      this.life[i] = 0.6;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  addShake(amount) {
    this.shake = Math.max(this.shake, amount);
  }

  shakeOffset() {
    if (this.shake <= 0.001) return { x: 0, y: 0 };
    const s = this.shake;
    return { x: (Math.random() - 0.5) * s * 0.5, y: (Math.random() - 0.5) * s * 0.5 };
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -100; continue; }
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.vel[i * 3 + 1] -= 12 * dt;
      if (this.pos[i * 3 + 1] < 0.05) { this.pos[i * 3 + 1] = 0.05; this.vel[i * 3 + 1] *= -0.3; }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.flash.intensity = Math.max(0, this.flash.intensity - dt * 900);
    this.shake = Math.max(0, this.shake - dt * 1.8);
  }
}
