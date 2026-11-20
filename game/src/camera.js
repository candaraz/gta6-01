// camera.js — third-person follow camera that stays CLOSE (no bird's-eye),
// looks AHEAD of the player so the crosshair leads the character, and
// eases behind the car while driving. W moves away from the camera.
import * as THREE from 'three';
import { clamp, angleDiff } from './random.js';

export class CameraRig {
  constructor(camera, scene) {
    this.camera = camera;
    this.scene = scene;
    this.yaw = Math.PI;      // camera looks north... see below
    this.pitch = 0.32;
    this.dist = 8;
    this.height = 3.2;
    this.target = new THREE.Vector3(-245, 1.5, -245);
    this._desired = new THREE.Vector3();
    this._snapped = false;
    this.mouseIdle = 0;
  }

  // Camera forward on the ground: the direction W takes the player.
  forward() {
    return { x: Math.sin(this.yaw), z: Math.cos(this.yaw) };
  }

  // Point the camera at a heading (used by screenshots and teleports).
  setYaw(yaw, pitch) {
    this.yaw = yaw;
    if (pitch !== undefined) this.pitch = clamp(pitch, 0.05, 0.85);
    this._snapped = false;
  }

  // The direction the crosshair points on the ground.
  aimHeading() {
    return this.yaw;
  }

  // Instantly place the camera (after a teleport, or for a screenshot).
  snap(px, pz, py) {
    const f = this.forward();
    this.camera.position.set(px - f.x * this.dist, (py || 1.5) + this.height, pz - f.z * this.dist);
    this._lookAt(px, pz, py);
    this._snapped = true;
  }

  _lookAt(px, pz, py) {
    // Look AHEAD of the player at a far point, so the crosshair sits in
    // front of the character and the centre ray stays near level: a ray
    // aimed at a point 5 m ahead dives into the ground before it reaches
    // an enemy 25 m out. 30 m ahead keeps shots on target.
    const f = this.forward();
    this.target.set(px + f.x * 30, (py || 1.5) - 0.1, pz + f.z * 30);
    this.camera.lookAt(this.target);
  }

  update(dt, px, pz, py, heading, speed, inVehicle, mouseDX, mouseDY, shake) {
    this.mouseIdle += dt;
    if (mouseDX || mouseDY) {
      this.yaw -= mouseDX * 0.0032;
      this.pitch = clamp(this.pitch + mouseDY * 0.0022, 0.05, 0.85);
      this.mouseIdle = 0;
    }
    // While driving fast with no mouse input, ease the camera behind the car.
    if (inVehicle && speed > 6 && this.mouseIdle > 1.2) {
      const d = angleDiff(this.yaw, heading);
      this.yaw += d * Math.min(1, dt * 0.7);
    }
    const dist = inVehicle ? 10.5 : 8;
    const height = inVehicle ? 3.8 : 1.0;
    const f = this.forward();
    const lift = Math.sin(this.pitch) * dist;
    this._desired.set(
      px - f.x * (dist - lift * 0.3),
      (py || 1.5) + height + lift * 0.45,
      pz - f.z * (dist - lift * 0.3)
    );
    const cur = this.camera.position;
    const gap = cur.distanceTo(this._desired);
    if (!this._snapped || gap > 30) {
      cur.copy(this._desired);
      this._snapped = true;
    } else {
      const k = Math.min(1, dt * 7);
      cur.lerp(this._desired, k);
    }
    // Screen shake on top of the smoothed position.
    if (shake) {
      cur.x += shake.x;
      cur.y += shake.y;
    }
    this._lookAt(px, pz, py);
  }
}
