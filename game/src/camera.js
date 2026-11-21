// camera.js — Solmar Bay v3: the chase camera.
// One job: keep the camera LOW and CLOSE behind the player or the car, so
// the street, the towers and the action fill the frame — never a bird's
// eye. Mouse drag orbits; the camera eases to its target so it feels
// weighted, not glued.
//
// v2's camera sat ~26 m up and far back, which is why its screenshots
// were flat and empty. This one rides ~3 m up and ~8 m back.

import * as THREE from 'three';

export function createCamera(G) {
  const camera = new THREE.PerspectiveCamera(62, 1280 / 800, 0.1, 2000);
  const cam = {
    camera,
    yaw: Math.PI,        // direction the camera looks (world angle)
    pitch: 0.24,         // how far down the camera looks
    dist: 7.5,           // distance behind the target
    height: 3.1,         // height above the target
    px: 0, py: 4, pz: 0, // smoothed camera position
    lookX: 0, lookY: 1.4, lookZ: 0,
    shakeX: 0, shakeY: 0,
  };
  camera.position.set(0, 4, -8);
  camera.lookAt(0, 1.4, 0);

  function update(dt, input) {
    const p = G.player.p;
    // Orbit with the mouse drag.
    if (input.mouse.dx || input.mouse.dy) {
      cam.yaw -= input.mouse.dx * 0.0042;
      cam.pitch = Math.max(0.05, Math.min(0.85, cam.pitch + input.mouse.dy * 0.003));
    }
    const inCar = !p.onFoot && p.car;
    const inBoat = p.boat;
    cam.dist = inBoat ? 11 : inCar ? 7.5 : 7;
    cam.height = inBoat ? 4.2 : inCar ? 2.7 : 3.0;
    // The camera wants to sit behind the target's heading, eased toward
    // the orbit yaw so a drag swings it around smoothly.
    let wantYaw = cam.yaw;
    if (!input.mouse.down) {
      // Ease the orbit yaw back behind the player's heading when not dragging.
      let d = p.heading - cam.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      wantYaw = cam.yaw + d * Math.min(1, dt * 1.4);
      cam.yaw = wantYaw;
    }
    // Target: the player / car, plus a look-ahead so the street ahead is visible.
    const tx = p.x + Math.sin(p.heading) * (inCar ? 6 : 3.5);
    const tz = p.z + Math.cos(p.heading) * (inCar ? 6 : 3.5);
    const ty = (inCar ? 1.1 : 1.2) + p.y; // 1.2 = chest height: the crosshair sits on a distant chest, so the shot lands on it
    const cx = p.x - Math.sin(cam.yaw) * cam.dist * Math.cos(cam.pitch);
    const cz = p.z - Math.cos(cam.yaw) * cam.dist * Math.cos(cam.pitch);
    // Lift above the look target: nearly level on foot (0.02) so the
    // crosshair sits on a distant chest and the shot stays level;
    // elevated in a vehicle (0.15) so the road ahead reads.
    const lift = (inCar || inBoat) ? 0.15 : 0.02;
    const cy = ty + cam.height * Math.sin(cam.pitch) + cam.height * lift;
    // Smooth the camera (a little lag reads as weight).
    const k = 1 - Math.exp(-dt * 7);
    cam.px += (cx - cam.px) * k;
    cam.py += (cy - cam.py) * k;
    cam.pz += (cz - cam.pz) * k;
    cam.lookX += (tx - cam.lookX) * k;
    cam.lookY += (ty - cam.lookY) * k;
    cam.lookZ += (tz - cam.lookZ) * k;
    // Screen shake.
    const s = G.effects.shake;
    cam.shakeX = (Math.random() - 0.5) * s * 0.5;
    cam.shakeY = (Math.random() - 0.5) * s * 0.4;
    camera.position.set(cam.px + cam.shakeX, cam.py + cam.shakeY, cam.pz);
    camera.lookAt(cam.lookX, cam.lookY, cam.lookZ);
    camera.updateMatrixWorld();
  }

  // A world ray through the screen centre (the crosshair) for shooting.
  function crosshairRay() {
    // updateMatrixWorld first: if a frame is ever skipped (headless
    // driver, lag spike) the camera's matrixWorld is stale and the
    // ray would point where the camera WAS, not where it is — every
    // shot would miss a target the crosshair is sitting on.
    camera.updateMatrixWorld();
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    return { origin: camera.position.clone(), dir };
  }

  // Project a world point to screen pixels (for the driver to aim).
  function toScreen(x, y, z, w, h) {
    const v = new THREE.Vector3(x, y, z).project(camera);
    return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h, behind: v.z > 1 };
  }

  // Snap the camera to its target at once (used after staging a shot, so
  // the first frame is already settled behind the player / car). This
  // also snaps the orbit yaw behind the player's heading — the yaw eases
  // slowly (1.4/s) and at low frame rates would otherwise still be
  // swinging around from the title screen when the shot is taken.
  function snap() {
    const p = G.player.p;
    const inCar = !p.onFoot && p.car;
    const inBoat = p.boat;
    const d = inBoat ? 11 : inCar ? 7.5 : 7;
    const h = inBoat ? 4.2 : inCar ? 2.7 : 3.0;
    const tx = p.x + Math.sin(p.heading) * (inCar ? 6 : 3.5);
    const tz = p.z + Math.cos(p.heading) * (inCar ? 6 : 3.5);
    const ty = (inCar ? 1.1 : 1.2) + p.y; // 1.2 = chest height: the crosshair sits on a distant chest, so the shot lands on it
    cam.yaw = p.heading;
    cam.px = p.x - Math.sin(cam.yaw) * d * Math.cos(cam.pitch);
    cam.pz = p.z - Math.cos(cam.yaw) * d * Math.cos(cam.pitch);
    const lift = (inCar || inBoat) ? 0.15 : 0.02;
    cam.py = ty + h * Math.sin(cam.pitch) + h * lift;
    cam.lookX = tx; cam.lookY = ty; cam.lookZ = tz;
    camera.position.set(cam.px, cam.py, cam.pz);
    camera.lookAt(tx, ty, tz);
    camera.updateMatrixWorld();
  }

  // Return the live state object itself (not a spread copy): the spread
  // copies yaw/pitch/dist by value, so G.camera.yaw would freeze at its
  // initial PI and on-foot movement — which reads cam.yaw — would always
  // walk north regardless of where the camera points. Attaching the
  // methods to cam keeps every property live.
  Object.assign(cam, { state: cam, update, snap, crosshairRay, toScreen });
  return cam;
}
