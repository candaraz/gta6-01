// Solmar Bay — the city itself.
// One job: build every static piece of the world from the seed — ground, roads,
// buildings, beach, water, marina, palms, lamps and sky — and answer "what is
// the ground / road here?" so cars, peds and missions can place themselves.

import * as THREE from 'three';
import { WORLD, SEED } from './config.js';
import { makeRng, hash2, clamp } from './random.js';

const BLOCK = WORLD.blockSize;
const ROAD = WORLD.roadWidth;
const HALF = (WORLD.grid * BLOCK) / 2; // city half-extent in metres

export function cityHalf() { return HALF; }
// Is (x,z) on a road (not inside a block)?
export function onRoad(x, z) {
  const px = ((x + HALF) % BLOCK + BLOCK) % BLOCK;
  const pz = ((z + HALF) % BLOCK + BLOCK) % BLOCK;
  return px < ROAD || pz < ROAD;
}
// Nearest road centre line coordinate on one axis.
export function roadCentre(v) {
  const n = Math.floor((v + HALF) / BLOCK);
  return -HALF + n * BLOCK + ROAD / 2;
}
// Is (x,z) on sand / in the bay?
export function onBeach(x, z) { return z > HALF - BLOCK * 1.5; }
export function inWater(x, z) { return z > HALF + 40; }

// Procedural window texture: a lit facade. One canvas, tinted per building.
function facadeTexture(base, lit) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  const rng = makeRng(base.length * 7919 + lit);
  for (let y = 8; y < 248; y += 16) {
    for (let x = 8; x < 120; x += 14) {
      const warm = rng.next() < 0.55;
      g.fillStyle = warm ? (lit ? '#ffd98a' : '#ffe9b0') : '#2a3542';
      g.fillRect(x, y, 9, 11);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const PALETTES = {
  downtown: ['#7a8ba0', '#5d6b7d', '#8a7a68', '#6b7a8a', '#9a8a7a'],
  marina: ['#e8e2d0', '#d8c8a8', '#b8c8d8', '#e0d0c0'],
  suburb: ['#e8d8b8', '#d8c8b8', '#c8d8c8', '#e0b8a8', '#b8c8d8'],
  industrial: ['#8a8580', '#7a7a72', '#9a8a7a', '#6a6a62'],
};

function districtAt(bx, bz) {
  const d = WORLD;
  if (bx >= d.downtown.x0 && bx <= d.downtown.x1 && bz >= d.downtown.z0 && bz <= d.downtown.z1) return 'downtown';
  if (bx >= d.marina.x0 && bx <= d.marina.x1 && bz >= d.marina.z0 && bz <= d.marina.z1) return 'marina';
  if (bx >= d.industrial.x0 && bx <= d.industrial.x1 && bz >= d.industrial.z0 && bz <= d.industrial.z1) return 'industrial';
  return 'suburb';
}

export class City {
  constructor(scene) {
    this.scene = scene;
    this.colliders = []; // {x, z, hx, hz} axis-aligned boxes cars/peds cannot cross
    this.roadGraph = []; // intersections for traffic waypoints
    this.build();
  }

  build() {
    const rng = makeRng(SEED);
    const scene = this.scene;

    // Golden-hour sky: warm sun low in the west, soft fog.
    scene.background = new THREE.Color(0xffd9a0);
    scene.fog = new THREE.Fog(0xffd9a0, 180, 700);
    const hemi = new THREE.HemisphereLight(0xffe0b0, 0x3a4a5a, 0.9);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffb060, 1.6);
    sun.position.set(-180, 120, -80);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
    sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
    sun.shadow.camera.far = 600;
    scene.add(sun);
    this.sun = sun;

    // Ground: asphalt-grey city slab.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(HALF * 2 + 400, HALF * 2 + 400),
      new THREE.MeshLambertMaterial({ color: 0x4a4a48 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // The bay: water to the south and east.
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(700, 260),
      new THREE.MeshPhongMaterial({ color: 0x1e6f8a, shininess: 120, transparent: true, opacity: 0.92 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(60, 0.15, HALF + 150);
    scene.add(water);
    this.water = water;

    // Beach: sand strip along the south edge.
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(HALF * 2 + 100, 60),
      new THREE.MeshLambertMaterial({ color: 0xe8d8a8 }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.05, HALF + 10);
    sand.receiveShadow = true;
    scene.add(sand);

    this.buildRoads(scene);
    this.buildBuildings(scene, rng);
    this.buildProps(scene, rng);
    this.buildMarina(scene);
  }

  buildRoads(scene) {
    // Road ribbons: dark strips with a pale centre line, plus sidewalks.
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e2e30 });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8c86a });
    const walkMat = new THREE.MeshLambertMaterial({ color: 0x8a8a86 });
    const n = WORLD.grid;
    for (let i = 0; i <= n; i++) {
      const c = -HALF + i * BLOCK;
      // vertical road (along z)
      const v = new THREE.Mesh(new THREE.PlaneGeometry(ROAD, HALF * 2), roadMat);
      v.rotation.x = -Math.PI / 2;
      v.position.set(c + ROAD / 2, 0.02, 0);
      v.receiveShadow = true;
      scene.add(v);
      // horizontal road (along x)
      const h = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, ROAD), roadMat);
      h.rotation.x = -Math.PI / 2;
      h.position.set(0, 0.02, c + ROAD / 2);
      h.receiveShadow = true;
      scene.add(h);
      // centre dashes
      for (let d = -HALF + 20; d < HALF; d += 24) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 6), lineMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(c + ROAD / 2, 0.03, d);
        scene.add(dash);
        const dash2 = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.5), lineMat);
        dash2.rotation.x = -Math.PI / 2;
        dash2.position.set(d, 0.03, c + ROAD / 2);
        scene.add(dash2);
      }
      // sidewalks (pale strips flanking each road)
      for (const off of [-1.5, ROAD + 1.5]) {
        const sw = new THREE.Mesh(new THREE.PlaneGeometry(3, HALF * 2), walkMat);
        sw.rotation.x = -Math.PI / 2;
        sw.position.set(c + off, 0.04, 0);
        scene.add(sw);
        const sw2 = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, 3), walkMat);
        sw2.rotation.x = -Math.PI / 2;
        sw2.position.set(0, 0.04, c + off);
        scene.add(sw2);
      }
      // intersections for the traffic graph
      for (let j = 0; j <= n; j++) {
        this.roadGraph.push({ x: -HALF + i * BLOCK + ROAD / 2, z: -HALF + j * BLOCK + ROAD / 2 });
      }
    }
  }

  buildBuildings(scene, rng) {
    const geoCache = new Map();
    const matCache = new Map();
    const n = WORLD.grid;
    for (let bx = 0; bx < n; bx++) {
      for (let bz = 0; bz < n; bz++) {
        const district = districtAt(bx - 4, bz - 4);
        // Marina blocks on the water side and beach blocks stay open.
        if (district === 'marina' && bz >= 7) continue;
        if (bz >= 8) continue; // beach blocks: no buildings
        const x0 = -HALF + bx * BLOCK + ROAD + 4;
        const z0 = -HALF + bz * BLOCK + ROAD + 4;
        const w = BLOCK - ROAD - 8;
        const h = hash2(bx, bz, SEED);
        // 1-3 buildings per block, placed on a jittered sub-grid.
        const count = district === 'downtown' ? 2 : (h < 0.5 ? 2 : 3);
        for (let k = 0; k < count; k++) {
          const sub = count === 2 ? 2 : 3;
          const sx = x0 + (k % sub) * (w / sub) + w / sub / 2;
          const sz = z0 + Math.floor(k / sub) * (w / sub) + w / sub / 2;
          const bw = w / sub - 6;
          const bd = w / sub - 6;
          let height;
          if (district === 'downtown') height = 18 + h * 55 + (k === 0 ? 25 : 0);
          else if (district === 'industrial') height = 8 + h * 8;
          else if (district === 'marina') height = 10 + h * 14;
          else height = 6 + h * 8;
          const pal = PALETTES[district];
          const colour = pal[Math.floor(hash2(bx * 7 + k, bz * 3, SEED) * pal.length) % pal.length];
          const key = colour + '|' + Math.round(height);
          if (!geoCache.has(key)) {
            geoCache.set(key, new THREE.BoxGeometry(bw, height, bd));
            matCache.set(key, new THREE.MeshLambertMaterial({
              map: facadeTexture(colour, true), color: 0xffffff,
            }));
          }
          const b = new THREE.Mesh(geoCache.get(key), matCache.get(key));
          b.position.set(sx, height / 2, sz);
          b.castShadow = true;
          b.receiveShadow = true;
          scene.add(b);
          this.colliders.push({ x: sx, z: sz, hx: bw / 2 + 0.4, hz: bd / 2 + 0.4 });
          // Rooftop box (AC unit / sign) for silhouette variety.
          if (hash2(bx + k, bz, SEED + 5) < 0.4) {
            const roof = new THREE.Mesh(
              new THREE.BoxGeometry(bw * 0.4, 2, bd * 0.4),
              new THREE.MeshLambertMaterial({ color: 0x555550 }),
            );
            roof.position.set(sx, height + 1, sz);
            scene.add(roof);
          }
        }
      }
    }
    // Landmark: the Solmar Tower, tallest in the city, with a lit crown.
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(24, 95, 24),
      new THREE.MeshLambertMaterial({ map: facadeTexture('#5d6b7d', true) }),
    );
    tower.position.set(0, 47.5, -78);
    tower.castShadow = true;
    scene.add(tower);
    this.colliders.push({ x: 0, z: -78, hx: 12.5, hz: 12.5 });
    const crown = new THREE.Mesh(
      new THREE.BoxGeometry(26, 4, 26),
      new THREE.MeshBasicMaterial({ color: 0xffc860 }),
    );
    crown.position.set(0, 97, -78);
    scene.add(crown);
  }

  buildProps(scene, rng) {
    // Palm trees along the beach and marina.
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 7, 6);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a48 });
    const leafGeo = new THREE.ConeGeometry(2.6, 3.2, 6);
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f7a3a });
    for (let i = 0; i < 46; i++) {
      const x = -HALF + 10 + rng.range(0, HALF * 2 - 20);
      const z = HALF - 8 + rng.range(0, 26);
      const t = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 3.5;
      trunk.castShadow = true;
      t.add(trunk);
      const leaves = new THREE.Mesh(leafGeo, leafMat);
      leaves.position.y = 8;
      leaves.castShadow = true;
      t.add(leaves);
      t.position.set(x, 0, z);
      t.rotation.y = rng.range(0, Math.PI * 2);
      scene.add(t);
    }
    // Street lamps at intersections.
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 7, 6);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
    const lampGeo = new THREE.SphereGeometry(0.45, 8, 6);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0 });
    for (const p of this.roadGraph) {
      if (hash2(Math.round(p.x), Math.round(p.z), SEED + 11) < 0.45) {
        const lamp = new THREE.Group();
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = 3.5;
        lamp.add(pole);
        const bulb = new THREE.Mesh(lampGeo, lampMat);
        bulb.position.y = 7.1;
        lamp.add(bulb);
        lamp.position.set(p.x + ROAD / 2 + 2, 0, p.z + ROAD / 2 + 2);
        scene.add(lamp);
      }
    }
  }

  buildMarina(scene) {
    // Wooden piers reaching into the bay, with a few moored boats.
    const pierMat = new THREE.MeshLambertMaterial({ color: 0x9a7a52 });
    for (const px of [120, 156, 192]) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(6, 1, 46), pierMat);
      pier.position.set(px, 0.6, HALF + 55);
      pier.castShadow = true;
      pier.receiveShadow = true;
      scene.add(pier);
      this.colliders.push({ x: px, z: HALF + 55, hx: 3.5, hz: 23 });
    }
  }

  // Resolve a circle (x,z,r) against building colliders: push it out.
  collide(x, z, r) {
    for (const c of this.colliders) {
      const dx = x - c.x, dz = z - c.z;
      const ox = c.hx + r - Math.abs(dx);
      const oz = c.hz + r - Math.abs(dz);
      if (ox > 0 && oz > 0) {
        if (ox < oz) x = c.x + Math.sign(dx || 1) * (c.hx + r);
        else z = c.z + Math.sign(dz || 1) * (c.hz + r);
      }
    }
    return { x: clamp(x, -HALF - 60, HALF + 260), z: clamp(z, -HALF - 60, HALF + 260) };
  }
}
