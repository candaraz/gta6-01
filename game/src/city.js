// city.js — builds Solmar Bay: a sun-soaked coastal city on a road grid,
// with a beach and bay to the south, docks to the east, downtown towers,
// and the landmarks the missions use. Also owns the collision boxes and
// the race-circuit waypoint loops.
import * as THREE from 'three';
import { WORLD, COLOURS } from './config.js';
import { mulberry32, pick, range, hash2, clamp } from './random.js';

export function buildCity(scene) {
  const rng = mulberry32(20261121);
  const city = {
    colliders: [],   // {x, z, hw, hd} axis-aligned boxes
    buildings: [],
    coins: [],
    circuits: {},
    landmarks: {},
    roadLines: [],   // for the minimap: {x1,z1,x2,z2}
  };

  // --- ground, beach, water ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.half * 2 + 80, WORLD.half * 2 + 80),
    new THREE.MeshLambertMaterial({ color: COLOURS.grass })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 10);
  scene.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.half * 2 + 80, 32),
    new THREE.MeshLambertMaterial({ color: COLOURS.sand })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.05, WORLD.beachZ + 16);
  scene.add(sand);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.half * 2 + 80, 130),
    new THREE.MeshLambertMaterial({ color: COLOURS.water, transparent: true, opacity: 0.9 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.1, WORLD.bayZ + 65);
  water.name = 'bay-water';
  scene.add(water);

  // --- roads: grid strips + centre dashes ---
  const roadMat = new THREE.MeshLambertMaterial({ color: COLOURS.asphalt });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5d90a });
  const avenues = [];
  for (let x = -280; x <= 280; x += WORLD.roadGap) avenues.push(x);
  const streets = [];
  for (let z = -280; z <= 210; z += WORLD.roadGap) streets.push(z);

  for (const x of avenues) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.roadWidth, 560), roadMat);
    r.rotation.x = -Math.PI / 2;
    r.position.set(x, 0.08, -35);
    scene.add(r);
    city.roadLines.push({ x1: x, z1: -315, x2: x, z2: 205 });
    for (let z = -280; z < 200; z += 28) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 4), dashMat);
      d.rotation.x = -Math.PI / 2;
      d.position.set(x, 0.1, z);
      scene.add(d);
    }
  }
  for (const z of streets) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(560, WORLD.roadWidth), roadMat);
    r.rotation.x = -Math.PI / 2;
    r.position.set(0, 0.08, z);
    scene.add(r);
    city.roadLines.push({ x1: -280, z1: z, x2: 280, z2: z });
    for (let x = -280; x < 280; x += 28) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.6), dashMat);
      d.rotation.x = -Math.PI / 2;
      d.position.set(x, 0.1, z);
      scene.add(d);
    }
  }

  // --- buildings: one per block cell, skipped on roads and plazas ---
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const plazaCells = new Set(['0,-70', '0,-140', '70,-70', '-70,0', '0,0']);
  for (let gx = -280; gx < 280; gx += WORLD.roadGap) {
    for (let gz = -280; gz < 210; gz += WORLD.roadGap) {
      const cx = gx + WORLD.roadGap / 2;
      const cz = gz + WORLD.roadGap / 2;
      const key = `${gx},${gz}`;
      if (plazaCells.has(key)) continue;
      if (cz > 180) continue; // beach stays open
      if (cx > 220 && cz > -20 && cz < 180) continue; // docks district
      const h = hash2(gx, gz);
      const downtown = Math.abs(cx) < 110 && cz < 0 && cz > -220;
      const height = downtown ? 26 + h * 55 : 6 + h * 16;
      const w = 26 + h * 14;
      const d = 22 + hash2(gz, gx) * 12;
      const colour = downtown ? COLOURS.towerGlass : pick(rng, COLOURS.buildingPalette);
      const mat = new THREE.MeshLambertMaterial({ color: colour });
      const b = new THREE.Mesh(boxGeo, mat);
      b.scale.set(w, height, d);
      b.position.set(cx, height / 2, cz);
      scene.add(b);
      city.colliders.push({ x: cx, z: cz, hw: w / 2, hd: d / 2 });
      city.buildings.push({ x: cx, z: cz, w, h: height, d, downtown });
      // Rooftop box for variety on taller buildings.
      if (height > 30) {
        const roof = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x30343a }));
        roof.scale.set(w * 0.3, 4, d * 0.3);
        roof.position.set(cx, height + 2, cz);
        scene.add(roof);
      }
    }
  }

  // Solmar Tower — the tallest landmark, downtown north edge.
  const tower = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x9fc8e8 }));
  tower.scale.set(30, 95, 30);
  tower.position.set(0, 47.5, -210);
  scene.add(tower);
  city.colliders.push({ x: 0, z: -210, hw: 15, hd: 15 });
  city.buildings.push({ x: 0, z: -210, w: 30, h: 95, d: 30, downtown: true });
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(2, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff4040 })
  );
  beacon.position.set(0, 97, -210);
  scene.add(beacon);
  // --- docks district (east): warehouses, containers, piers ---
  const dockMat = new THREE.MeshLambertMaterial({ color: 0x8a7a6a });
  const contCols = [0xc25a3a, 0x3a7ac2, 0x4a9a5a, 0xd8b13a];
  for (let i = 0; i < 5; i++) {
    const w = new THREE.Mesh(boxGeo, dockMat);
    w.scale.set(34, 12, 20);
    w.position.set(258, 6, 10 + i * 32);
    scene.add(w);
    city.colliders.push({ x: 258, z: 10 + i * 32, hw: 17, hd: 10 });
  }
  for (let i = 0; i < 14; i++) {
    const c = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: pick(rng, contCols) }));
    c.scale.set(12, 3.4, 3.4);
    c.position.set(232 + (i % 2) * 16, 1.7 + Math.floor(i / 7) * 3.6, -10 + Math.floor(i / 2) * 14);
    scene.add(c);
    city.colliders.push({ x: c.position.x, z: c.position.z, hw: 6, hd: 1.7 });
  }
  // Piers reaching into the bay.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x6a5a44 });
  for (const pz of [30, 90, 150]) {
    const pier = new THREE.Mesh(boxGeo, pierMat);
    pier.scale.set(8, 1, 60);
    pier.position.set(300, 0.6, pz);
    scene.add(pier);
  }
  city.landmarks.docks = { x: 240, z: 70 };

  // --- landmarks: safehouses, garage, gun shop, start ---
  function landmarkHouse(x, z, colour, label) {
    const h = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: colour }));
    h.scale.set(16, 8, 14);
    h.position.set(x, 4, z);
    scene.add(h);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(11, 5, 4), new THREE.MeshLambertMaterial({ color: 0x8a3a2a }));
    roof.position.set(x, 10.5, z);
    roof.rotation.y = Math.PI / 4;
    scene.add(roof);
    city.colliders.push({ x, z, hw: 8, hd: 7 });
    return { x, z, label };
  }
  city.landmarks.start = { x: -245, z: -245 };
  city.landmarks.safehouses = [
    landmarkHouse(-245, -245, 0xe8c890, "Mara's Place"),
    landmarkHouse(215, 145, 0x90c8e8, 'Beach House'),
    landmarkHouse(-215, 215, 0xc89090, 'Pier House'),
  ];
  city.landmarks.garage = landmarkHouse(-140, 5, 0x4a4a55, "Sol's Garage");
  city.landmarks.gunshop = landmarkHouse(75, -145, 0x3a3a3a, "Ivy's Arms");
  // Garage forecourt stays drivable: remove its collider, keep the walls visual.
  city.colliders = city.colliders.filter((c) => !(c.x === -140 && c.z === 5));

  // --- Bay Coins: 20 collectibles around the map ---
  const coinSpots = [
    [-245, -175], [-175, -245], [-105, -210], [-35, -245], [35, -210], [105, -245],
    [175, -210], [245, -175], [245, -105], [245, 35], [210, 105], [140, 175],
    [70, 210], [0, 175], [-70, 210], [-140, 175], [-210, 105], [-245, 35],
    [-175, -105], [105, -105],
  ];
  for (const [x, z] of coinSpots) city.coins.push({ x, z, taken: false });

  // --- race circuits (waypoint loops) ---
  city.circuits.harbour = {
    name: 'Harbour Loop',
    laps: 2,
    points: [[210, 0], [280, 0], [280, 140], [210, 140], [140, 140], [140, 70], [210, 70]],
  };
  city.circuits.downtown = {
    name: 'Downtown Dash',
    laps: 3,
    points: [[-70, -70], [70, -70], [70, -140], [0, -210], [-70, -140], [-140, -70], [-140, 0], [-70, 0]],
  };
  city.circuits.coast = {
    name: 'Coast Run',
    laps: 2,
    points: [[-280, 210], [280, 210], [280, 140], [210, 140], [210, 210], [-210, 210], [-280, 140]],
  };

  // --- collision + ground helpers ---
  city.isWater = (x, z) => z > WORLD.bayZ;
  city.isBeach = (x, z) => z > WORLD.beachZ && z <= WORLD.bayZ;
  city.inBounds = (x, z) => Math.abs(x) < WORLD.half + 30 && z > -WORLD.half - 30 && z < WORLD.bayZ + 110;

  // Push a circle (x, z, r) out of every building box it overlaps.
  // Returns true if any push happened.
  city.collide = (p, r) => {
    let hit = false;
    for (const c of city.colliders) {
      const nx = clamp(p.x, c.x - c.hw, c.x + c.hw);
      const nz = clamp(p.z, c.z - c.hd, c.z + c.hd);
      const dx = p.x - nx, dz = p.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      hit = true;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        p.x = nx + (dx / d) * r;
        p.z = nz + (dz / d) * r;
      } else {
        // Centre inside the box: push out along the smallest penetration.
        const px = c.hw + r - Math.abs(p.x - c.x);
        const pz = c.hd + r - Math.abs(p.z - c.z);
        if (px < pz) p.x = c.x + Math.sign(p.x - c.x || 1) * (c.hw + r);
        else p.z = c.z + Math.sign(p.z - c.z || 1) * (c.hd + r);
      }
    }
    return hit;
  };

  return city;
}

