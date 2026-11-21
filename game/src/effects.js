// effects.js — Solmar Bay v3: particles (dust, smoke, sparks, muzzle flash,
// explosions) plus screen shake. One job: the visible chaos of a chase.
// Two THREE.Points pools: one additive (sparks / flash / fire), one soft
// (smoke / dust) that fades toward the fog colour.

import * as THREE from 'three';

const MAX = 700;

export function createEffects(scene) {
  function makePool(additive) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(MAX * 3);
    const col = new Float32Array(MAX * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.85, vertexColors: true, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);
    return {
      pos, col, vel: new Float32Array(MAX * 3), life: new Float32Array(MAX),
      maxLife: new Float32Array(MAX), base: new Float32Array(MAX * 3),
      head: 0, geo,
    };
  }
  const sparks = makePool(true);
  const smoke = makePool(false);
  let trauma = 0;

  function spawn(pool, x, y, z, vx, vy, vz, life, r, g, b) {
    const i = pool.head; pool.head = (pool.head + 1) % MAX;
    pool.pos[i * 3] = x; pool.pos[i * 3 + 1] = y; pool.pos[i * 3 + 2] = z;
    pool.vel[i * 3] = vx; pool.vel[i * 3 + 1] = vy; pool.vel[i * 3 + 2] = vz;
    pool.life[i] = life; pool.maxLife[i] = life;
    pool.base[i * 3] = r; pool.base[i * 3 + 1] = g; pool.base[i * 3 + 2] = b;
    pool.col[i * 3] = r; pool.col[i * 3 + 1] = g; pool.col[i * 3 + 2] = b;
  }

  function burst(pool, p, n, spread, up, life, rgb) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const s = spread * (0.4 + Math.random() * 0.8);
      spawn(pool, p.x, p.y, p.z,
        Math.cos(a) * s, up * (0.3 + Math.random() * 0.9), Math.sin(a) * s,
        life * (0.6 + Math.random() * 0.7), rgb[0], rgb[1], rgb[2]);
    }
  }

  function updatePool(pool, dt, gravity, drag) {
    for (let i = 0; i < MAX; i++) {
      if (pool.life[i] <= 0) { pool.col[i * 3] = 0; pool.col[i * 3 + 1] = 0; pool.col[i * 3 + 2] = 0; continue; }
      pool.life[i] -= dt;
      pool.vel[i * 3 + 1] -= gravity * dt;
      pool.vel[i * 3] *= drag; pool.vel[i * 3 + 1] *= drag; pool.vel[i * 3 + 2] *= drag;
      pool.pos[i * 3] += pool.vel[i * 3] * dt;
      pool.pos[i * 3 + 1] += pool.vel[i * 3 + 1] * dt;
      pool.pos[i * 3 + 2] += pool.vel[i * 3 + 2] * dt;
      const f = Math.max(0, pool.life[i] / pool.maxLife[i]);
      pool.col[i * 3] = pool.base[i * 3] * f;
      pool.col[i * 3 + 1] = pool.base[i * 3 + 1] * f;
      pool.col[i * 3 + 2] = pool.base[i * 3 + 2] * f;
    }
    pool.geo.attributes.position.needsUpdate = true;
    pool.geo.attributes.color.needsUpdate = true;
  }

  return {
    dust(p) { burst(smoke, p, 7, 2.2, 1.2, 0.9, [0.62, 0.58, 0.52]); },
    tyreSmoke(p) { burst(smoke, p, 4, 1.4, 1.6, 0.7, [0.55, 0.55, 0.58]); },
    sparks(p) { burst(sparks, p, 14, 6, 3.5, 0.5, [1.0, 0.75, 0.25]); },
    muzzle(p, dir) {
      for (let k = 0; k < 5; k++) {
        spawn(sparks, p.x, p.y, p.z,
          dir.x * 14 + (Math.random() - 0.5) * 4, dir.y * 14 + (Math.random() - 0.5) * 4, dir.z * 14 + (Math.random() - 0.5) * 4,
          0.12, 1.0, 0.85, 0.4);
      }
    },
    explosion(p) {
      burst(sparks, p, 26, 9, 6, 0.8, [1.0, 0.55, 0.15]);
      burst(smoke, p, 18, 4, 5, 1.6, [0.32, 0.3, 0.3]);
      trauma = Math.min(1, trauma + 0.55);
    },
    splash(p) { burst(smoke, p, 10, 3, 4, 0.7, [0.7, 0.85, 0.9]); },
    blood(p) { burst(smoke, p, 6, 2, 1.5, 0.5, [0.55, 0.1, 0.1]); },
    addShake(a) { trauma = Math.min(1, trauma + a); },
    get shake() { return trauma * trauma; },
    update(dt) {
      trauma = Math.max(0, trauma - dt * 1.6);
      updatePool(sparks, dt, 9, 0.96);
      updatePool(smoke, dt, -1.5, 0.94);
    },
  };
}
