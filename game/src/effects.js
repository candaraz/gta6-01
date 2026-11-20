// Solmar Bay — effects.
// One job: the juice — muzzle flashes, tracers, blood puffs, explosions, smoke,
// skid marks and the fire that eats a burning car. All cheap instanced/pooled
// meshes so the frame rate survives a shootout.

import * as THREE from 'three';
import { makeRng } from './random.js';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.rng = makeRng(31337);
    this.particles = []; // {mesh, vel, life, maxLife, grow}
    this.flashes = []; // short-lived glow sprites
    this.skids = [];
    this.geo = new THREE.SphereGeometry(0.16, 6, 5);
  }

  _spawn(pos, colour, count, speed, life, up = 0.5) {
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ color: colour, transparent: true }));
      m.position.copy(pos);
      const a = this.rng.range(0, Math.PI * 2);
      const s = speed * this.rng.range(0.4, 1);
      this.scene.add(m);
      this.particles.push({
        mesh: m,
        vel: new THREE.Vector3(Math.sin(a) * s, this.rng.range(0, up) * speed, Math.cos(a) * s),
        life, maxLife: life,
      });
    }
  }

  muzzle(pos) {
    const f = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true }),
    );
    f.position.copy(pos);
    this.scene.add(f);
    this.flashes.push({ mesh: f, life: 0.07, maxLife: 0.07 });
  }
  tracer(from, dir) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, from.clone().add(dir)]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 }));
    this.scene.add(line);
    this.flashes.push({ mesh: line, life: 0.09, maxLife: 0.09 });
  }
  blood(x, y, z) { this._spawn(new THREE.Vector3(x, y, z), 0x8a1010, 6, 3, 0.5); }
  explosion(x, y, z, big = false) {
    const n = big ? 26 : 14;
    this._spawn(new THREE.Vector3(x, y, z), 0xff7a20, n, 9, 0.9, 1.2);
    this._spawn(new THREE.Vector3(x, y, z), 0xffd23e, Math.floor(n / 2), 6, 0.7, 1);
    this._spawn(new THREE.Vector3(x, y, z), 0x333333, 10, 3, 1.6, 1.4);
    const f = new THREE.Mesh(
      new THREE.SphereGeometry(big ? 4 : 2.2, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.85 }),
    );
    f.position.set(x, y + 0.5, z);
    this.scene.add(f);
    this.flashes.push({ mesh: f, life: 0.28, maxLife: 0.28, grow: big ? 6 : 3 });
  }
  smoke(x, y, z) {
    this._spawn(new THREE.Vector3(x, y + 1, z), 0x555555, 2, 1.2, 1.4, 1.6);
  }
  sparks(x, y, z) { this._spawn(new THREE.Vector3(x, y, z), 0xffe9a0, 8, 6, 0.4); }

  skid(x, z, heading) {
    if (this.skids.length > 120) {
      const old = this.skids.shift();
      this.scene.remove(old);
    }
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.35, 1.6),
      new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.55 }),
    );
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -heading;
    m.position.set(x, 0.06, z);
    this.scene.add(m);
    this.skids.push(m);
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.scene.remove(p.mesh); this.particles.splice(i, 1); continue; }
      p.vel.y -= 6 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.material.opacity = p.life / p.maxLife;
      const s = 0.6 + (1 - p.life / p.maxLife) * 1.4;
      p.mesh.scale.setScalar(s);
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.life -= dt;
      if (f.life <= 0) { this.scene.remove(f.mesh); this.flashes.splice(i, 1); continue; }
      if (f.mesh.material) f.mesh.material.opacity = f.life / f.maxLife;
      if (f.grow) f.mesh.scale.setScalar(1 + (1 - f.life / f.maxLife) * f.grow);
    }
  }
}
