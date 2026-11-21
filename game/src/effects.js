// Particles: muzzle flashes, tracers, dust, smoke, sparks, blood,
// explosions. One pooled Points cloud per effect, capped and reused.
import * as THREE from 'three';

export function createEffects(G) {
  const E = { bursts: [] };
  G.effects = E;
  const geo = new THREE.BufferGeometry();
  const MAX = 400;
  const pos = new Float32Array(MAX * 3);
  const col = new Float32Array(MAX * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: 0.45, vertexColors: true, transparent: true, opacity: 0.9 });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  G.scene.add(points);
  const vel = new Float32Array(MAX * 3);
  const life = new Float32Array(MAX);
  let cursor = 0;

  function spawn(x, y, z, n, color, speed, up, lifeT) {
    for (let i = 0; i < n; i++) {
      const k = cursor; cursor = (cursor + 1) % MAX;
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
      vel[k * 3] = Math.cos(a) * s;
      vel[k * 3 + 1] = up + Math.random() * speed * 0.5;
      vel[k * 3 + 2] = Math.sin(a) * s;
      col[k * 3] = ((color >> 16) & 255) / 255;
      col[k * 3 + 1] = ((color >> 8) & 255) / 255;
      col[k * 3 + 2] = (color & 255) / 255;
      life[k] = lifeT * (0.6 + Math.random() * 0.7);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }
  E.flash = (p) => spawn(p.x, p.y, p.z, 10, 0xffe27a, 6, 2, 0.12);
  E.blood = (x, y, z) => spawn(x, y, z, 12, 0xc02020, 4, 1, 0.5);
  E.dust = (x, z) => spawn(x, 0.3, z, 4, 0x8a7a62, 2, 1, 0.6);
  E.smoke = (x, y, z) => spawn(x, y, z, 8, 0x888888, 2, 3, 1.2);
  E.sparks = (x, y, z) => spawn(x, y, z, 14, 0xffd23e, 9, 3, 0.4);
  E.explosion = (x, y, z, s) => {
    spawn(x, y, z, 26, 0xff7a1a, 10 * (s || 1), 5, 0.9);
    spawn(x, y, z, 14, 0x444444, 4, 6, 1.4);
  };

  // Tracers: short-lived lines from muzzle to hit point.
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.9 });
  E.tracer = function (a, b) {
    const g = new THREE.BufferGeometry().setFromPoints([a, b]);
    const line = new THREE.Line(g, tracerMat.clone());
    G.scene.add(line);
    E.bursts.push({ line, t: 0.09 });
  };

  E.step = function (dt) {
    for (let k = 0; k < MAX; k++) {
      if (life[k] <= 0) continue;
      life[k] -= dt;
      pos[k * 3] += vel[k * 3] * dt;
      pos[k * 3 + 1] += vel[k * 3 + 1] * dt;
      pos[k * 3 + 2] += vel[k * 3 + 2] * dt;
      vel[k * 3 + 1] -= 6 * dt;
      if (pos[k * 3 + 1] < 0.05) { pos[k * 3 + 1] = 0.05; vel[k * 3 + 1] = 0; }
      if (life[k] <= 0) pos[k * 3 + 1] = -100;
    }
    geo.attributes.position.needsUpdate = true;
    for (let i = E.bursts.length - 1; i >= 0; i--) {
      const b = E.bursts[i];
      b.t -= dt;
      if (b.t <= 0) {
        G.scene.remove(b.line);
        b.line.geometry.dispose();
        E.bursts.splice(i, 1);
      }
    }
  };
  return E;
}
