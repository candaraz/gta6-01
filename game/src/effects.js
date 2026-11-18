// Particles: one pool of small sprites for dust, smoke, sparks, muzzle flash
// and explosions. Each burst is a handful of points with a velocity, a life
// and a colour; the pool recycles them so the game never allocates mid-frame.

import * as THREE from 'three';

const MAX_PARTICLES = 600;

export function createEffects(scene) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(MAX_PARTICLES * 3);
  const colors = new Float32Array(MAX_PARTICLES * 3);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 0.55,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  const pool = [];
  for (let i = 0; i < MAX_PARTICLES; i += 1) {
    pool.push({ life: 0, maxLife: 1, x: 0, y: -100, z: 0, vx: 0, vy: 0, vz: 0, gravity: 0, r: 1, g: 1, b: 1 });
  }
  let cursor = 0;

  function spawn(x, y, z, vx, vy, vz, life, gravity, color) {
    const p = pool[cursor];
    cursor = (cursor + 1) % MAX_PARTICLES;
    p.life = life;
    p.maxLife = life;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.gravity = gravity;
    p.r = ((color >> 16) & 0xff) / 255;
    p.g = ((color >> 8) & 0xff) / 255;
    p.b = (color & 0xff) / 255;
  }

  function burst(x, y, z, count, speed, life, gravity, color, spread = 1) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const up = Math.random() * 0.9 + 0.2;
      const s = speed * (0.4 + Math.random() * 0.8);
      spawn(
        x, y, z,
        Math.cos(angle) * s * spread, up * s, Math.sin(angle) * s * spread,
        life * (0.6 + Math.random() * 0.7), gravity, color,
      );
    }
  }

  return {
    dust(x, y, z) {
      burst(x, y + 0.2, z, 6, 1.6, 0.55, -0.5, 0xc9b896);
    },
    smoke(x, y, z) {
      burst(x, y, z, 3, 0.8, 1.4, 1.2, 0x555555);
    },
    sparks(x, y, z) {
      burst(x, y, z, 10, 5, 0.35, -9, 0xffd94a);
    },
    muzzle(x, y, z, heading) {
      // At the gun in the right hand: ahead of the shooter and a touch to
      // the right, so the flash reads from the chase camera instead of
      // hiding directly behind the shooter's silhouette.
      const fx = x + Math.sin(heading) * 0.9 + Math.cos(heading) * 0.35;
      const fz = z + Math.cos(heading) * 0.9 - Math.sin(heading) * 0.35;
      burst(fx, y + 1.35, fz, 7, 2.5, 0.11, 0, 0xffd94a);
    },
    blood(x, y, z) {
      burst(x, y + 1, z, 8, 2.4, 0.5, -7, 0xa02020);
    },
    explosion(x, y, z) {
      burst(x, y + 0.6, z, 40, 7, 0.9, -3, 0xff7a2a);
      burst(x, y + 0.6, z, 24, 4, 1.6, 1.6, 0x444444);
      burst(x, y + 0.6, z, 16, 9, 0.5, -6, 0xffd94a);
    },
    update(dt) {
      for (let i = 0; i < MAX_PARTICLES; i += 1) {
        const p = pool[i];
        if (p.life > 0) {
          p.life -= dt;
          p.vy += p.gravity * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          if (p.y < 0.05) {
            p.y = 0.05;
            p.vy = 0;
          }
        } else {
          p.y = -100;
        }
        positions[i * 3] = p.x;
        positions[i * 3 + 1] = p.y;
        positions[i * 3 + 2] = p.z;
        const fade = p.life > 0 ? Math.min(1, p.life / (p.maxLife * 0.6)) : 0;
        colors[i * 3] = p.r * fade;
        colors[i * 3 + 1] = p.g * fade;
        colors[i * 3 + 2] = p.b * fade;
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
    },
  };
}
