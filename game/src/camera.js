// Third-person camera: chase cam behind the car, level chest-height
// cam on foot. Mouse drag orbits; yaw snaps instantly when the driver
// (or a staged shot) asks, so shots are never taken mid-swing.
import * as THREE from 'three';
import { angDiff, clamp } from './random.js';

export function createCamera(G) {
  const cam = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
  G.scene.add(cam);
  const C = {
    cam, yaw: Math.PI / 2, pitch: 0.32, dist: 11, height: 4.2,
    target: new THREE.Vector3(0, 1.5, 48),
    shake: 0,
  };
  G.cameraRig = C;
  window.addEventListener('resize', () => {
    cam.aspect = window.innerWidth / window.innerHeight;
    cam.updateProjectionMatrix();
    G.renderer.setSize(window.innerWidth, window.innerHeight);
  });
  C.snapBehind = function (heading) {
    // Face the same way the player faces: camera forward (sin yaw, cos yaw)
    // must equal the heading direction (cos h, sin h), so yaw = PI/2 - h.
    C.yaw = Math.PI / 2 - heading;
  };
  C.setShot = function (yaw, pitch, dist, height) {
    C.yaw = yaw; C.pitch = pitch; C.dist = dist; C.height = height;
  };
  C.step = function (dt) {
    const I = G.input;
    C.yaw -= I.mouseDX * 0.004;
    C.pitch = clamp(C.pitch + I.mouseDY * 0.003, 0.02, 1.1);
    const P = G.player;
    const inCar = !!P.vehicle;
    // On foot the camera drops to chest height and levels out, so the
    // crosshair ray runs flat and shots reach enemies at range instead
    // of diving underground a few metres out.
    const wantPitch = inCar ? 0.14 : 0.02;
    C.pitch += (wantPitch - C.pitch) * Math.min(1, dt * 1.2);
    const wantDist = inCar ? 12 : 5.5;
    const wantHeight = inCar ? 3.0 : 1.7;
    C.dist += (wantDist - C.dist) * Math.min(1, dt * 4);
    C.height += (wantHeight - C.height) * Math.min(1, dt * 4);
    const tx = P.x, tz = P.z;
    const ty = inCar ? 1.6 : 1.7;
    C.target.x += (tx - C.target.x) * Math.min(1, dt * 10);
    C.target.y += (ty - C.target.y) * Math.min(1, dt * 10);
    C.target.z += (tz - C.target.z) * Math.min(1, dt * 10);
    const cx = C.target.x - Math.sin(C.yaw) * Math.cos(C.pitch) * C.dist;
    const cz = C.target.z - Math.cos(C.yaw) * Math.cos(C.pitch) * C.dist;
    const cy = C.target.y + Math.sin(C.pitch) * C.dist + (C.height - 1.7);
    let sx = cx, sz = cz;
    if (C.shake > 0) {
      sx += (Math.random() - 0.5) * C.shake;
      sz += (Math.random() - 0.5) * C.shake;
      C.shake = Math.max(0, C.shake - dt * 2);
    }
    cam.position.set(sx, Math.max(1.2, cy), sz);
    cam.lookAt(C.target.x, C.target.y, C.target.z);
    // The golden sun follows the player so shadows stay near.
    if (G.sun) {
      G.sun.position.set(P.x - 120, 160, P.z - 90);
      G.sun.target.position.set(P.x, 0, P.z);
      G.sun.target.updateMatrixWorld();
    }
  };
  return C;
}
