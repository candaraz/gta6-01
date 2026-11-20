// Solmar Bay — the third-person camera.
// One job: follow the player (on foot or in a car) from behind, orbit on drag,
// zoom on wheel, and never clip through a building.

import * as THREE from 'three';
import { clamp, damp } from './random.js';

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0; // orbit around the player
    this.pitch = 0.25;
    this.dist = 10;
    this.mode = 0; // 0 near, 1 far, 2 top (C cycles)
    this._placed = false;
    this._pos = new THREE.Vector3();
    this._look = new THREE.Vector3();
  }

  cycleMode() { this.mode = (this.mode + 1) % 3; }

  update(dt, target, heading, inCar, speed, input, city) {
    // drag orbits; when driving, the camera eases back behind the car
    this.yaw -= input.mouseDX * 0.005;
    this.pitch = clamp(this.pitch + input.mouseDY * 0.004, 0.05, 1.1);
    if (input.wheel !== 0) this.dist = clamp(this.dist + input.wheel * 0.01, 5, 16);
    const baseDist = this.mode === 0 ? 10 : this.mode === 1 ? 14 : 20;
    const wantDist = inCar ? baseDist + clamp(Math.abs(speed) * 0.08, 0, 4) : baseDist;
    this.dist = damp(this.dist, wantDist, 3, dt);
    if (inCar) {
      // ease the orbit back behind the car's heading
      const diff = ((heading - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      this.yaw += diff * Math.min(1, 1.6 * dt);
    }
    const px = target.x - Math.sin(this.yaw) * Math.cos(this.pitch) * this.dist;
    const pz = target.z - Math.cos(this.yaw) * Math.cos(this.pitch) * this.dist;
    const py = (target.y ?? 0) + 2.2 + Math.sin(this.pitch) * this.dist;
    this._pos.set(px, py, pz);
    // Look at a point ahead of the player in the camera's view direction, so
    // the player sits below centre and the crosshair points at what is ahead
    // (not at the player's back) — that is what makes shooting work.
    this._look.set(target.x + Math.sin(this.yaw) * 6, (target.y ?? 0) + 1.4, target.z + Math.cos(this.yaw) * 6);
    // keep the camera out of buildings: walk from the player toward the
    // desired spot and stop at the last point that is not inside a collider,
    // so the camera pulls in close instead of climbing to a bird's-eye view.
    if (city) {
      for (let t = 1; t >= 0.3; t -= 0.1) {
        const cx = target.x + (px - target.x) * t;
        const cz = target.z + (pz - target.z) * t;
        if (!this._insideCollider(cx, cz, city)) {
          this._pos.set(cx, py, cz);
          break;
        }
        if (t <= 0.31) this._pos.set(target.x + (px - target.x) * 0.3, py, target.z + (pz - target.z) * 0.3);
      }
    }
    if (!this._placed) {
      // first frame after a snap: put the camera exactly there, no easing
      this.camera.position.copy(this._pos);
      this._placed = true;
    } else {
      this.camera.position.lerp(this._pos, 1 - Math.exp(-10 * dt));
    }
    this.camera.lookAt(this._look);
  }

  _insideCollider(x, z, city) {
    for (const c of city.colliders) {
      if (Math.abs(x - c.x) < c.hx + 0.5 && Math.abs(z - c.z) < c.hz + 0.5) return true;
    }
    return false;
  }

  // Snap the camera behind a heading instantly (used on mission starts / shots).
  snap(heading) { this.yaw = heading; this._placed = false; }
}
