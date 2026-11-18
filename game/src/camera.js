// The third-person camera: an orbit the player drags with the mouse, a chase
// view behind the car that widens with speed, and a shake for impacts. The
// camera never clips below the ground and eases toward its target so motion
// feels weighted instead of nailed to the player.

import * as THREE from 'three';

export function createCamera(camera) {
  let yaw = Math.PI;
  let pitch = 0.32;
  let distance = 7.5;
  let shake = 0;
  const current = new THREE.Vector3(0, 8, 20);
  const lookTarget = new THREE.Vector3();

  return {
    get yaw() {
      return yaw;
    },
    get pitch() {
      return pitch;
    },
    setYaw(value) {
      yaw = value;
    },
    setPitch(value) {
      pitch = value;
    },
    addShake(amount) {
      shake = Math.min(1.2, shake + amount);
    },
    orbit(dragX, dragY) {
      yaw -= dragX * 0.0042;
      pitch = Math.max(0.06, Math.min(1.15, pitch + dragY * 0.0032));
    },
    // Follow a point on foot; the camera sits behind the orbit yaw.
    followOnFoot(target, dt) {
      const wantDistance = 7.5;
      distance += (wantDistance - distance) * Math.min(1, dt * 4);
      const cx = target.x + Math.sin(yaw) * Math.cos(pitch) * distance;
      const cz = target.z + Math.cos(yaw) * Math.cos(pitch) * distance;
      const cy = target.y + 1.8 + Math.sin(pitch) * distance;
      current.x += (cx - current.x) * Math.min(1, dt * 9);
      current.y += (Math.max(0.6, cy) - current.y) * Math.min(1, dt * 9);
      current.z += (cz - current.z) * Math.min(1, dt * 9);
      lookTarget.set(target.x, target.y + 1.6, target.z);
      this.apply(dt);
    },
    // Chase a car: behind its heading, easing the yaw toward the car's own.
    followCar(car, dt) {
      const behindYaw = car.heading + Math.PI;
      let diff = behindYaw - yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      yaw += diff * Math.min(1, dt * (Math.abs(car.speed) > 4 ? 2.2 : 0.9));
      const speed01 = Math.min(1, Math.abs(car.speed) / car.spec.topSpeed);
      const wantDistance = 9 + speed01 * 3.5;
      distance += (wantDistance - distance) * Math.min(1, dt * 3);
      const cx = car.x + Math.sin(yaw) * Math.cos(pitch) * distance;
      const cz = car.z + Math.cos(yaw) * Math.cos(pitch) * distance;
      const cy = 2.2 + Math.sin(pitch) * distance * 0.8;
      current.x += (cx - current.x) * Math.min(1, dt * 7);
      current.y += (Math.max(0.8, cy) - current.y) * Math.min(1, dt * 7);
      current.z += (cz - current.z) * Math.min(1, dt * 7);
      lookTarget.set(car.x, 1.4, car.z);
      camera.fov += ((62 + speed01 * 12) - camera.fov) * Math.min(1, dt * 3);
      camera.updateProjectionMatrix();
      this.apply(dt);
    },
    // A fixed cinematic angle, for the title screen.
    setFraming(x, y, z, lookX, lookY, lookZ) {
      current.set(x, y, z);
      lookTarget.set(lookX, lookY, lookZ);
      camera.position.copy(current);
      camera.lookAt(lookTarget);
    },
    apply(dt) {
      shake = Math.max(0, shake - dt * 2.4);
      const sx = shake > 0 ? (Math.random() - 0.5) * shake * 0.5 : 0;
      const sy = shake > 0 ? (Math.random() - 0.5) * shake * 0.4 : 0;
      camera.position.set(current.x + sx, current.y + sy, current.z);
      camera.lookAt(lookTarget);
      if (camera.fov !== 62) {
        camera.fov += (62 - camera.fov) * Math.min(1, dt * 3);
        camera.updateProjectionMatrix();
      }
    },
    snapTo(target) {
      const ty = target.y || 0;
      current.set(
        target.x + Math.sin(yaw) * Math.cos(pitch) * distance,
        ty + 1.8 + Math.sin(pitch) * distance,
        target.z + Math.cos(yaw) * Math.cos(pitch) * distance,
      );
    },
  };
}
