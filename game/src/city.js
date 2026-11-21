// city.js — Solmar Bay v3: the city itself.
// One job: build a dense, sun-soaked coastal city that reads as a CITY in
// every screenshot — tall windowed towers close to narrow streets, palms
// lining the sidewalks, districts that look different, a marina with
// cranes and boats, a beach and sea, a lighthouse, golden-hour sun with
// real shadows, and fog on the skyline.
//
// Performance is by instancing: every building, palm, lamp, container and
// boat is one of a handful of InstancedMesh draws, so the city costs ~30
// draw calls no matter how dense it is.

import * as THREE from 'three';
import { WORLD, AVENUES, DISTRICTS, PALETTES } from './config.js';
import { makeRng, range, rangeInt, pick, chance, cellHash } from './random.js';

// Height classes for the facade textures: rows of windows + typical size.
const CLASSES = {
  low:  { rows: 4,  cols: 3, w: 12, hMin: 7,  hMax: 11 },
  mid:  { rows: 8,  cols: 6, w: 26, hMin: 12, hMax: 28 },
  tall: { rows: 16, cols: 6, w: 30, hMin: 30, hMax: 72 },
  yard: { rows: 2,  cols: 8, w: 34, hMin: 10, hMax: 18 },
};

// --- facade textures: a canvas per (height class x palette) ----------------
function makeFacadeTexture(cls, pal) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const g = c.getContext('2d');
  // Vertical gradient: lighter at the top, warmer and darker at the base.
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, pal.base);
  grad.addColorStop(0.75, pal.base);
  grad.addColorStop(1, pal.trim);
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 512);
  // Subtle horizontal banding (floor slabs) for texture.
  g.fillStyle = 'rgba(0,0,0,0.08)';
  for (let y = 0; y < 512; y += 32) g.fillRect(0, y, 256, 2);
  const rows = CLASSES[cls].rows, cols = CLASSES[cls].cols;
  const mx = 14, my = 18, gapX = 10, gapY = 12;
  const ww = (256 - mx * 2 - gapX * (cols - 1)) / cols;
  const wh = (512 - my * 2 - 110 - gapY * (rows - 1)) / rows; // leave room for ground floor
  const litCols = ['#ffd98a', '#ffe9b0', '#ffc46a', '#fff3c8', '#ffb85e'];
  const darkCols = ['#232a33', '#1c222b', '#2e3742', '#26221f'];
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x = mx + col * (ww + gapX);
      const y = my + r * (wh + gapY);
      // Frame.
      g.fillStyle = '#1e1c1a';
      g.fillRect(x - 2, y - 2, ww + 4, wh + 4);
      // Glass: mostly lit warm, some dark.
      const lit = Math.random() < 0.55;
      g.fillStyle = lit ? pick(Math.random, litCols) : pick(Math.random, darkCols);
      g.fillRect(x, y, ww, wh);
      if (lit && Math.random() < 0.3) { // half-drawn blind
        g.fillStyle = 'rgba(30,28,26,0.55)';
        g.fillRect(x, y, ww, wh * 0.45);
      }
    }
  }
  // Ground floor: darker band, a door and lit shopfronts.
  const gy = 512 - 96;
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.fillRect(0, gy, 256, 96);
  g.fillStyle = '#141210';
  g.fillRect(108, gy + 34, 40, 62); // door
  g.fillStyle = '#ffd98a';
  g.fillRect(16, gy + 22, 70, 44);  // shopfront
  g.fillRect(170, gy + 22, 70, 44);
  // Rooftop parapet band.
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(0, 0, 256, 10);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeBillboardTexture(lines, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 256);
  g.fillStyle = fg;
  g.font = 'bold 64px Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const n = lines.length;
  lines.forEach((line, i) => {
    g.fillText(line, 256, 128 + (i - (n - 1) / 2) * 72);
  });
  g.strokeStyle = fg; g.lineWidth = 10;
  g.strokeRect(8, 8, 496, 240);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSkyTexture() {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#5f8fc4');
  grad.addColorStop(0.38, '#8fb4d8');
  grad.addColorStop(0.5, '#ffd9a0');
  grad.addColorStop(0.58, '#f2b878');
  grad.addColorStop(1, '#e8c9a4');
  g.fillStyle = grad; g.fillRect(0, 0, 16, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A palm crown: six drooping frond blades radiating from the trunk top.
function makePalmCrownGeometry() {
  const pos = [], idx = [];
  const fronds = 6;
  for (let f = 0; f < fronds; f++) {
    const a = (f / fronds) * Math.PI * 2 + 0.3;
    const dx = Math.cos(a), dz = Math.sin(a);
    const px = -dz, pz = dx; // perpendicular (blade width direction)
    const base = pos.length / 3;
    // Blade: wide at the base, pointed and drooping at the tip.
    pos.push(0, 0, 0, px * 0.28, 0.1, pz * 0.28,
      dx * 1.1 + px * 0.22, -0.28, dz * 1.1 + pz * 0.22,
      dx * 2.3, -0.95, dz * 2.3);
    idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export function buildCity(scene, seed) {
  const rng = makeRng(seed);
  const dummy = new THREE.Object3D();
  const colliders = []; // {x0,z0,x1,z1} building footprints
  const H = WORLD.half;

  // --- lights, sky, fog ----------------------------------------------------
  const sun = new THREE.DirectionalLight(0xffd9a8, 2.6);
  const sunDir = new THREE.Vector3(-0.62, 0.55, 0.34).normalize();
  sun.position.copy(sunDir).multiplyScalar(300);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -90; sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0006;
  scene.add(sun); scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0x9db8e8, 0x8a6f5a, 1.6);
  scene.add(hemi);
  scene.fog = new THREE.Fog(0xe8c9a4, 220, 720);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(850, 24, 16),
    new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false })
  );
  scene.add(sky);
  // Sun disc low in the west.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(34, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff2c8, fog: false, transparent: true, opacity: 0.95 })
  );
  sunDisc.position.set(-720, 150, 280);
  sunDisc.lookAt(0, 40, 0);
  scene.add(sunDisc);

  // --- ground, roads, beach, sea -------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(H * 2, H * 2),
    new THREE.MeshLambertMaterial({ color: 0xb5ada0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const roadMat = new THREE.MeshLambertMaterial({ color: 0x6a6a72 });
  const roadGeo = new THREE.PlaneGeometry(H * 2, WORLD.road);
  for (const a of AVENUES) {
    const r1 = new THREE.Mesh(roadGeo, roadMat);
    r1.rotation.x = -Math.PI / 2; r1.position.set(0, 0.02, a); r1.receiveShadow = true;
    scene.add(r1);
    const r2 = new THREE.Mesh(roadGeo, roadMat);
    r2.rotation.x = -Math.PI / 2; r2.rotation.z = Math.PI / 2; r2.position.set(a, 0.02, 0); r2.receiveShadow = true;
    scene.add(r2);
  }
  // Dashed yellow centre lines, one canvas texture repeated along the road.
  const dashCanvas = document.createElement('canvas');
  dashCanvas.width = 8; dashCanvas.height = 64;
  const dg = dashCanvas.getContext('2d');
  dg.fillStyle = '#6a6a72'; dg.fillRect(0, 0, 8, 64);
  dg.fillStyle = '#e8c93a'; dg.fillRect(2, 8, 4, 28);
  const dashTex = new THREE.CanvasTexture(dashCanvas);
  dashTex.wrapS = dashTex.wrapT = THREE.RepeatWrapping;
  dashTex.repeat.set(1, 90);
  dashTex.colorSpace = THREE.SRGBColorSpace;
  const dashMat = new THREE.MeshLambertMaterial({ map: dashTex });
  const dashGeo = new THREE.PlaneGeometry(1.2, H * 2);
  for (const a of AVENUES) {
    const d1 = new THREE.Mesh(dashGeo, dashMat);
    d1.rotation.x = -Math.PI / 2; d1.position.set(0, 0.04, a);
    scene.add(d1);
    const d2 = new THREE.Mesh(dashGeo, dashMat);
    d2.rotation.x = -Math.PI / 2; d2.rotation.z = Math.PI / 2; d2.position.set(a, 0.04, 0);
    scene.add(d2);
  }

  // Beach sand along the east and south sea edges.
  const sandMat = new THREE.MeshLambertMaterial({ color: 0xd8c49a });
  const sandE = new THREE.Mesh(new THREE.PlaneGeometry(12, H * 2), sandMat);
  sandE.rotation.x = -Math.PI / 2; sandE.position.set(294, 0.03, 0); sandE.receiveShadow = true;
  scene.add(sandE);
  const sandS = new THREE.Mesh(new THREE.PlaneGeometry(H * 2, 12), sandMat);
  sandS.rotation.x = -Math.PI / 2; sandS.position.set(0, 0.03, 294); sandS.receiveShadow = true;
  scene.add(sandS);
  // Sea: two planes (east + south) meeting at the corner.
  const seaMat = new THREE.MeshStandardMaterial({ color: 0x2a7a8a, roughness: 0.25, metalness: 0.15 });
  const seaE = new THREE.Mesh(new THREE.PlaneGeometry(220, H * 2 + 220), seaMat);
  seaE.rotation.x = -Math.PI / 2; seaE.position.set(410, -0.4, 110);
  scene.add(seaE);
  const seaS = new THREE.Mesh(new THREE.PlaneGeometry(H * 2, 220), seaMat);
  seaS.rotation.x = -Math.PI / 2; seaS.position.set(0, -0.4, 410);
  scene.add(seaS);

  // --- parks: green squares with palms -------------------------------------
  const parkMat = new THREE.MeshLambertMaterial({ color: 0x5a8a4a });
  const parks = [];
  for (const [px, pz] of [[-168, 168], [168, -168], [-168, -24], [72, 216], [-264, 72]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(38, 38), parkMat);
    p.rotation.x = -Math.PI / 2; p.position.set(px, 0.03, pz); p.receiveShadow = true;
    scene.add(p);
    parks.push([px, pz]);
  }

  // --- buildings ------------------------------------------------------------
  // Landmark blocks: no generic building here; missions place their own.
  // Block centres occupied by a landmark building (the building's
  // centre after the block-interior offset, NOT the street address).
  const landmarkBlocks = new Set([
    '-72,-72', '72,-24', '-24,72', '24,24', '120,120', '264,168',
    '264,-24', '240,40', '285,0',
  ]);
  const blockCenters = [];
  for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) {
    blockCenters.push([-264 + i * 48, -264 + j * 48]);
  }
  const parkSet = new Set(parks.map(([x, z]) => `${x},${z}`));

  function districtOf(x, z) {
    if (x >= DISTRICTS.marina.x0 && z >= DISTRICTS.marina.z0 && z <= DISTRICTS.marina.z1) return 'marina';
    if (z <= DISTRICTS.yards.z1) return 'yards';
    if (x <= DISTRICTS.suburbs.x1) return 'suburbs';
    if (Math.abs(x) <= 120 && Math.abs(z) <= 120) return 'downtown';
    return 'midrise';
  }

  // Collect instances per (class x palette).
  const buckets = new Map();
  function addBuilding(x, z, w, d, h, cls, palIdx) {
    const key = `${cls}:${palIdx}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push({ x, z, w, d, h });
    colliders.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
  }

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const roofProps = []; // {x,z,h} for AC boxes / antennas

  for (const [bx, bz] of blockCenters) {
    const key = `${bx},${bz}`;
    if (landmarkBlocks.has(key) || parkSet.has(key)) continue;
    const dist = districtOf(bx, bz);
    const h1 = cellHash(bx, bz, 1), h2 = cellHash(bx, bz, 2), h3 = cellHash(bx, bz, 3);
    const palIdx = Math.floor(h1 * PALETTES.length);
    if (dist === 'downtown') {
      const h = 30 + h2 * 42 * (0.85 + h3 * 0.3);
      addBuilding(bx, bz, 30, 30, Math.min(72, h), 'tall', palIdx);
      roofProps.push({ x: bx, z: bz, h: Math.min(72, h) });
    } else if (dist === 'midrise') {
      const h = 12 + h2 * 16;
      addBuilding(bx, bz, 26, 26, h, 'mid', palIdx);
      if (h2 > 0.5) roofProps.push({ x: bx, z: bz, h });
    } else if (dist === 'suburbs') {
      // Two houses per block, set back with a yard between them.
      addBuilding(bx - 9, bz - 6, 12, 11, 7 + h2 * 4, 'low', palIdx);
      addBuilding(bx + 9, bz + 7, 12, 11, 7 + h3 * 4, 'low', (palIdx + 1) % PALETTES.length);
    } else if (dist === 'yards') {
      addBuilding(bx, bz, 34, 18, 10 + h2 * 8, 'yard', palIdx);
    } else if (dist === 'marina') {
      if (bz < 0) addBuilding(bx, bz, 30, 16, 10 + h2 * 10, 'yard', palIdx);
      // South half of the marina stays open: container yard + piers.
    }
  }

  // Landmark buildings (distinct, so missions read on the map).
  function landmark(x, z, w, d, h, cls, palIdx, tint) {
    // The address (x,z) is a street address (often ON an avenue), but
    // the building itself must sit in the block interior: a building
    // centred on an avenue walls the road off (the loft at (96,96)
    // blocked x=96, the garage at (48,-24) blocked x=48, the dock
    // office overlapped z=-48). Centre it in the block that contains
    // the address — avenues are at multiples of 48, block centres at
    // +24 — so the AABB never touches a road. The address stays on
    // the road as the mission waypoint.
    const bx = Math.floor(x / 48) * 48 + 24, bz = Math.floor(z / 48) * 48 + 24;
    addBuilding(bx, bz, w, d, h, cls, palIdx);
    roofProps.push({ x: bx, z: bz, h });
    return { x: bx, z: bz, w, d, h };
  }
  const landmarks = {
    marasPlace: landmark(-72, -72, 14, 12, 9, 'low', 2, 0),
    garage: landmark(48, -24, 30, 20, 12, 'mid', 1, 0),
    gunShop: landmark(-24, 48, 22, 18, 14, 'mid', 3, 0),
    bank: landmark(24, 24, 32, 32, 46, 'tall', 0, 0),
    loft: landmark(96, 96, 24, 24, 34, 'tall', 2, 0),
    pierHouse: landmark(280, 160, 14, 12, 9, 'low', 0, 0),
    dockOffice: landmark(260, -40, 30, 16, 14, 'yard', 1, 0),
  };

  // Build the instanced meshes.
  const buildingMeshes = [];
  for (const [key, list] of buckets) {
    const [cls, palIdx] = key.split(':');
    const tex = makeFacadeTexture(cls, PALETTES[+palIdx]);
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    const mesh = new THREE.InstancedMesh(boxGeo, mat, list.length);
    list.forEach((b, i) => {
      dummy.position.set(b.x, 0, b.z);
      dummy.scale.set(b.w, b.h, b.d);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      // Slight brightness variation so neighbours do not match exactly.
      const v = 0.92 + cellHash(b.x, b.z, 7) * 0.14;
      mesh.setColorAt(i, new THREE.Color(v, v, v));
    });
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
    buildingMeshes.push(mesh);
  }

  // Rooftop props: AC boxes + antennas on the taller buildings.
  const acGeo = new THREE.BoxGeometry(2.2, 1.2, 2.2);
  const acMat = new THREE.MeshLambertMaterial({ color: 0x6a6a66 });
  const acMesh = new THREE.InstancedMesh(acGeo, acMat, roofProps.length * 2);
  const antGeo = new THREE.CylinderGeometry(0.12, 0.2, 7, 5);
  const antMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
  const antMesh = new THREE.InstancedMesh(antGeo, antMat, roofProps.length);
  roofProps.forEach((r, i) => {
    dummy.position.set(r.x - 4, r.h + 0.6, r.z - 3); dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix(); acMesh.setMatrixAt(i * 2, dummy.matrix);
    dummy.position.set(r.x + 5, r.h + 0.6, r.z + 4);
    dummy.updateMatrix(); acMesh.setMatrixAt(i * 2 + 1, dummy.matrix);
    dummy.position.set(r.x + 8, r.h + 3.5, r.z - 6);
    dummy.updateMatrix(); antMesh.setMatrixAt(i, dummy.matrix);
  });
  acMesh.instanceMatrix.needsUpdate = true; antMesh.instanceMatrix.needsUpdate = true;
  scene.add(acMesh); scene.add(antMesh);

  // --- palms: trunks + crowns along every street, in parks, on the beach ---
  const palmSpots = [];
  for (const a of AVENUES) {
    for (let s = -300; s <= 300; s += 16) {
      if (Math.abs(s) < 8) continue;
      if (cellHash(a, s, 11) < 0.72) palmSpots.push([a + 8.5, s + (cellHash(a, s, 12) - 0.5) * 4]);
      if (cellHash(a, s, 13) < 0.72) palmSpots.push([a - 8.5, s + (cellHash(a, s, 14) - 0.5) * 4]);
      if (cellHash(s, a, 15) < 0.72) palmSpots.push([s + (cellHash(s, a, 16) - 0.5) * 4, a + 8.5]);
      if (cellHash(s, a, 17) < 0.72) palmSpots.push([s + (cellHash(s, a, 18) - 0.5) * 4, a - 8.5]);
    }
  }
  for (const [px, pz] of parks) for (let k = 0; k < 5; k++) palmSpots.push([px + range(rng, -14, 14), pz + range(rng, -14, 14)]);
  for (let s = -280; s <= 280; s += 22) palmSpots.push([292, s]);
  // Keep palms out of the road and out of buildings.
  const palmList = palmSpots.filter(([x, z]) => {
    if (Math.abs(x) > 296 || Math.abs(z) > 296) return false;
    for (const c of colliders) if (x > c.x0 - 1 && x < c.x1 + 1 && z > c.z0 - 1 && z < c.z1 + 1) return false;
    return true;
  });
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.24, 5.2, 6);
  trunkGeo.translate(0, 2.6, 0);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, palmList.length);
  const crownGeo = makePalmCrownGeometry();
  const crownMat = new THREE.MeshLambertMaterial({ color: 0x2f7a3a, side: THREE.DoubleSide });
  const crownMesh = new THREE.InstancedMesh(crownGeo, crownMat, palmList.length);
  palmList.forEach(([x, z], i) => {
    const tilt = (cellHash(x, z, 21) - 0.5) * 0.14;
    const tiltA = cellHash(x, z, 22) * Math.PI * 2;
    dummy.position.set(x, 0, z);
    dummy.rotation.set(Math.cos(tiltA) * tilt, 0, Math.sin(tiltA) * tilt);
    dummy.scale.setScalar(0.9 + cellHash(x, z, 23) * 0.35);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x + Math.sin(tiltA) * tilt * 5, 5.1 * dummy.scale.y, z + Math.cos(tiltA) * tilt * 5);
    dummy.updateMatrix();
    crownMesh.setMatrixAt(i, dummy.matrix);
  });
  trunkMesh.instanceMatrix.needsUpdate = true; crownMesh.instanceMatrix.needsUpdate = true;
  trunkMesh.castShadow = true; crownMesh.castShadow = true;
  scene.add(trunkMesh); scene.add(crownMesh);

  // --- street lamps ---------------------------------------------------------
  const lampSpots = [];
  for (const a of AVENUES) {
    for (let s = -288; s <= 288; s += 48) {
      // A lamp for one avenue must not land on the crossing avenue's road
      // (a lamp at (0, a-7.5) would stand in the middle of the x=0 road).
      if (!isRoad(a + 7.5, s)) lampSpots.push([a + 7.5, s]);
      if (!isRoad(s, a - 7.5)) lampSpots.push([s, a - 7.5]);
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 6.4, 5);
  poleGeo.translate(0, 3.2, 0);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c2c30 });
  const poleMesh = new THREE.InstancedMesh(poleGeo, poleMat, lampSpots.length);
  const lampHeadGeo = new THREE.BoxGeometry(1.1, 0.28, 0.4);
  lampHeadGeo.translate(0.5, 0, 0);
  const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xffe2a0 });
  const lampHeadMesh = new THREE.InstancedMesh(lampHeadGeo, lampHeadMat, lampSpots.length);
  lampSpots.forEach(([x, z], i) => {
    dummy.position.set(x, 0, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
    dummy.updateMatrix(); poleMesh.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 6.4, z); dummy.rotation.set(0, (i % 2) * Math.PI, 0);
    dummy.updateMatrix(); lampHeadMesh.setMatrixAt(i, dummy.matrix);
  });
  poleMesh.instanceMatrix.needsUpdate = true; lampHeadMesh.instanceMatrix.needsUpdate = true;
  scene.add(poleMesh); scene.add(lampHeadMesh);

  // --- traffic lights at every second intersection ---------------------------
  const tlSpots = [];
  for (let i = 0; i < AVENUES.length; i += 2) for (let j = 0; j < AVENUES.length; j += 2) {
    tlSpots.push([AVENUES[i] + 6.5, AVENUES[j] - 6.5]);
  }
  const tlPoleGeo = new THREE.CylinderGeometry(0.1, 0.13, 5.4, 5);
  tlPoleGeo.translate(0, 2.7, 0);
  const tlPoleMesh = new THREE.InstancedMesh(tlPoleGeo, new THREE.MeshLambertMaterial({ color: 0x242428 }), tlSpots.length);
  const tlHeadGeo = new THREE.BoxGeometry(0.5, 1.3, 0.5);
  tlHeadGeo.translate(0, 5.6, 0);
  const tlHeadMesh = new THREE.InstancedMesh(tlHeadGeo, new THREE.MeshLambertMaterial({ color: 0x1a1a1c }), tlSpots.length);
  const tlDotGeo = new THREE.SphereGeometry(0.16, 6, 5);
  const tlDotMesh = new THREE.InstancedMesh(tlDotGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), tlSpots.length);
  tlSpots.forEach(([x, z], i) => {
    dummy.position.set(x, 0, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    tlPoleMesh.setMatrixAt(i, dummy.matrix);
    tlHeadMesh.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 5.95, z); dummy.updateMatrix();
    tlDotMesh.setMatrixAt(i, dummy.matrix);
    tlDotMesh.setColorAt(i, new THREE.Color(i % 2 ? 0x2aff5a : 0xff3a2a));
  });
  tlPoleMesh.instanceMatrix.needsUpdate = true;
  tlHeadMesh.instanceMatrix.needsUpdate = true;
  tlDotMesh.instanceMatrix.needsUpdate = true;
  if (tlDotMesh.instanceColor) tlDotMesh.instanceColor.needsUpdate = true;
  scene.add(tlPoleMesh); scene.add(tlHeadMesh); scene.add(tlDotMesh);

  // --- billboards: bright canvas signs on downtown rooftops ------------------
  const billboards = [
    { lines: ['SOLMAR', 'BAY'], bg: '#0f7a8a', fg: '#ffe9a0', x: 24, y: 48, z: -120, ry: 0 },
    { lines: ['BAY FM 88'], bg: '#c83a5a', fg: '#ffffff', x: -72, y: 40, z: 120, ry: Math.PI },
    { lines: ['SUNSET', 'MOTEL'], bg: '#e8a13a', fg: '#3a1a2a', x: 120, y: 42, z: 24, ry: -Math.PI / 2 },
    { lines: ['CASINO', 'SOL'], bg: '#3a2a6a', fg: '#ffd94a', x: -120, y: 44, z: -72, ry: Math.PI / 2 },
    { lines: ['PALM', 'COURT'], bg: '#2a8a5a', fg: '#ffffff', x: 72, y: 38, z: 120, ry: Math.PI },
    { lines: ['COMET GT'], bg: '#d81f2a', fg: '#ffffff', x: -24, y: 34, z: -120, ry: 0 },
    { lines: ['MARINA'], bg: '#1a5a8a', fg: '#a0e8ff', x: 216, y: 22, z: -60, ry: -Math.PI / 2 },
    { lines: ['TIDE', 'RUNNER'], bg: '#5a3a8a', fg: '#ffe9a0', x: 168, y: 30, z: 72, ry: Math.PI / 2 },
  ];
  for (const b of billboards) {
    const tex = makeBillboardTexture(b.lines, b.bg, b.fg);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 8),
      new THREE.MeshBasicMaterial({ map: tex })
    );
    m.position.set(b.x, b.y, b.z);
    m.rotation.y = b.ry;
    scene.add(m);
    // Support poles.
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 0.5), new THREE.MeshLambertMaterial({ color: 0x2c2c30 }));
    pole.position.set(b.x, b.y - 7, b.z);
    scene.add(pole);
  }

  // --- dock cranes (mast + jib + cab + hook, jibs slew slowly) --------------
  const craneSpots = [
    { x: 250, z: -100, ry: 0.4 }, { x: 250, z: -20, ry: -0.3 }, { x: 250, z: 60, ry: 0.9 },
    { x: 0, z: -260, ry: 0.2 }, { x: 96, z: -260, ry: -0.5 },
  ];
  const craneMastGeo = new THREE.BoxGeometry(2.4, 34, 2.4); craneMastGeo.translate(0, 17, 0);
  const craneMast = new THREE.InstancedMesh(craneMastGeo, new THREE.MeshLambertMaterial({ color: 0xd8a13a }), craneSpots.length);
  const craneJibGeo = new THREE.BoxGeometry(26, 1.6, 1.6); craneJibGeo.translate(11, 0, 0);
  const craneJib = new THREE.InstancedMesh(craneJibGeo, new THREE.MeshLambertMaterial({ color: 0xc88a2a }), craneSpots.length);
  const craneCabGeo = new THREE.BoxGeometry(4, 3.4, 3.4);
  const craneCab = new THREE.InstancedMesh(craneCabGeo, new THREE.MeshLambertMaterial({ color: 0x3a3a3e }), craneSpots.length);
  craneSpots.forEach((c, i) => {
    dummy.position.set(c.x, 0, c.z); dummy.rotation.set(0, c.ry, 0); dummy.scale.set(1, 1, 1);
    dummy.updateMatrix(); craneMast.setMatrixAt(i, dummy.matrix);
    dummy.position.set(c.x, 32, c.z);
    dummy.updateMatrix(); craneCab.setMatrixAt(i, dummy.matrix);
    dummy.position.set(c.x, 34, c.z); dummy.rotation.set(0, c.ry, 0);
    dummy.updateMatrix(); craneJib.setMatrixAt(i, dummy.matrix);
  });
  craneMast.instanceMatrix.needsUpdate = true;
  craneJib.instanceMatrix.needsUpdate = true;
  craneCab.instanceMatrix.needsUpdate = true;
  craneMast.castShadow = true; craneJib.castShadow = true;
  scene.add(craneMast); scene.add(craneJib); scene.add(craneCab);

  // --- containers: bright stacked boxes at the docks and the yards -----------
  // Never on a road or inside a building — the streets stay drivable.
  const contSpots = [];
  let guard = 0;
  while (contSpots.length < 46 && guard++ < 400) {
    const x = range(rng, 216, 288), z = range(rng, -110, 110);
    if (isRoad(x, z)) continue;
    contSpots.push([x, z, rangeInt(rng, 0, 1)]);
  }
  guard = 0;
  while (contSpots.length < 72 && guard++ < 400) {
    const x = range(rng, -180, 180), z = range(rng, -300, -220);
    if (isRoad(x, z)) continue;
    contSpots.push([x, z, rangeInt(rng, 0, 1)]);
  }
  const contGeo = new THREE.BoxGeometry(6, 2.6, 2.6);
  const contMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const contMesh = new THREE.InstancedMesh(contGeo, contMat, contSpots.length);
  const contCols = [0xd83a2a, 0x2a5ad8, 0x2a8a4a, 0xe88a2a, 0xe8c93a, 0x7a3a8a];
  contSpots.forEach(([x, z, stack], i) => {
    dummy.position.set(x, 1.3 + stack * 2.6, z);
    dummy.rotation.set(0, (i % 2) * Math.PI / 2, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    contMesh.setMatrixAt(i, dummy.matrix);
    contMesh.setColorAt(i, new THREE.Color(pick(rng, contCols)));
    if (stack === 0) colliders.push({ x0: x - 3, z0: z - 1.3, x1: x + 3, z1: z + 1.3 });
  });
  contMesh.instanceMatrix.needsUpdate = true;
  if (contMesh.instanceColor) contMesh.instanceColor.needsUpdate = true;
  contMesh.castShadow = true; contMesh.receiveShadow = true;
  scene.add(contMesh);

  // --- boats moored at the marina piers + a few out in the bay --------------
  const boatSpots = [];
  for (let k = 0; k < 9; k++) boatSpots.push({ x: 306 + (k % 3) * 7, z: -96 + k * 22, ry: Math.PI / 2 + (k % 2 ? 0.1 : -0.1) });
  for (let k = 0; k < 3; k++) boatSpots.push({ x: 330 + k * 14, z: 60 + k * 30, ry: 0.6 + k * 0.4 });
  const hullGeo = new THREE.BoxGeometry(3.2, 1.1, 8.5);
  const hullMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const hullMesh = new THREE.InstancedMesh(hullGeo, hullMat, boatSpots.length);
  const boatCabGeo = new THREE.BoxGeometry(2.2, 1.4, 3.4); boatCabGeo.translate(0, 0, -0.8);
  const boatCabMesh = new THREE.InstancedMesh(boatCabGeo, new THREE.MeshLambertMaterial({ color: 0x2a4a5a }), boatSpots.length);
  boatSpots.forEach((b, i) => {
    dummy.position.set(b.x, 0, b.z); dummy.rotation.set(0, b.ry, 0); dummy.scale.set(1, 1, 1);
    dummy.updateMatrix(); hullMesh.setMatrixAt(i, dummy.matrix);
    boatCabMesh.setMatrixAt(i, dummy.matrix);
    hullMesh.setColorAt(i, new THREE.Color(pick(rng, [0xe8e4da, 0x2a6f8a, 0xd83a2a, 0xe8c93a])));
  });
  hullMesh.instanceMatrix.needsUpdate = true;
  boatCabMesh.instanceMatrix.needsUpdate = true;
  if (hullMesh.instanceColor) hullMesh.instanceColor.needsUpdate = true;
  scene.add(hullMesh); scene.add(boatCabMesh);

  // --- clouds: soft squashed spheres drifting over the skyline --------------
  const cloudGeo = new THREE.SphereGeometry(1, 10, 8);
  cloudGeo.scale(14, 3.2, 7);
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.82 });
  const cloudSpots = [];
  for (let k = 0; k < 20; k++) cloudSpots.push([range(rng, -500, 500), range(rng, 130, 200), range(rng, -500, 500)]);
  const cloudMesh = new THREE.InstancedMesh(cloudGeo, cloudMat, cloudSpots.length);
  cloudSpots.forEach(([x, y, z], i) => {
    dummy.position.set(x, y, z); dummy.rotation.set(0, 0, 0);
    dummy.scale.set(0.7 + rng() * 0.9, 1, 0.7 + rng() * 0.9);
    dummy.updateMatrix(); cloudMesh.setMatrixAt(i, dummy.matrix);
  });
  cloudMesh.instanceMatrix.needsUpdate = true;
  scene.add(cloudMesh);

  // --- lighthouse on the south-east point ------------------------------------
  const lh = new THREE.Group();
  const lhBase = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4, 16, 10), new THREE.MeshLambertMaterial({ color: 0xe8e4da }));
  lhBase.position.y = 8; lh.add(lhBase);
  const lhBand = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.3, 3, 10), new THREE.MeshLambertMaterial({ color: 0xd83a2a }));
  lhBand.position.y = 11; lh.add(lhBand);
  const lhTop = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.6, 3.4), new THREE.MeshLambertMaterial({ color: 0x2a2a2e }));
  lhTop.position.y = 17; lh.add(lhTop);
  const beamGeo = new THREE.ConeGeometry(9, 60, 12, 1, true);
  beamGeo.translate(0, 30, 0); beamGeo.rotateZ(Math.PI / 2);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false, fog: false });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.y = 17; lh.add(beam);
  lh.position.set(306, 0, 306);
  scene.add(lh);
  colliders.push({ x0: 302, z0: 302, x1: 310, z1: 310 });

  // --- helpers ---------------------------------------------------------------
  function isRoad(x, z) {
    for (const a of AVENUES) {
      if (Math.abs(x - a) < WORLD.road / 2 + 0.5) return true;
      if (Math.abs(z - a) < WORLD.road / 2 + 0.5) return true;
    }
    return false;
  }
  function nearestRoadPoint(x, z) {
    let best = null, bd = 1e9;
    for (const a of AVENUES) {
      const d1 = Math.abs(x - a), d2 = Math.abs(z - a);
      if (d1 < bd) { bd = d1; best = { x: a, z, along: 'z' }; }
      if (d2 < bd) { bd = d2; best = { x, z: a, along: 'x' }; }
    }
    return best;
  }
  function collideCircle(p, r) {
    // Push a circle (x,z,r) out of every building AABB it overlaps.
    for (const c of colliders) {
      const cx = Math.max(c.x0, Math.min(p.x, c.x1));
      const cz = Math.max(c.z0, Math.min(p.z, c.z1));
      const dx = p.x - cx, dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          p.x = cx + (dx / d) * r; p.z = cz + (dz / d) * r;
        } else {
          // Centre inside the box: push out along the smallest penetration.
          const pl = p.x - c.x0, pr = c.x1 - p.x, pt = p.z - c.z0, pb = c.z1 - p.z;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) p.x = c.x0 - r; else if (m === pr) p.x = c.x1 + r;
          else if (m === pt) p.z = c.z0 - r; else p.z = c.z1 + r;
        }
      }
    }
    // World edge: block cars and clamp feet.
    const m = H - 2;
    p.x = Math.max(-m, Math.min(m, p.x));
    p.z = Math.max(-m, Math.min(m, p.z));
  }

  let time = 0;
  return {
    colliders, landmarks, isRoad, nearestRoadPoint, collideCircle,
    // Good downtown avenue for a chase shot (north-south, towers both sides).
    chaseStreet: { x: 0, z: -40 },
    driveStreet: { x: 48, z: 60 },
    dockYard: { x: 250, z: 20 },
    marinaPier: { x: 296, z: 0 },
    startAvenue: { x: 0, z: 200 },
    update(dt, playerPos) {
      time += dt;
      // Shadow camera follows the player, so shadows stay crisp nearby.
      sun.position.set(playerPos.x + sunDir.x * 300, sunDir.y * 300, playerPos.z + sunDir.z * 300);
      sun.target.position.set(playerPos.x, 0, playerPos.z);
      sun.target.updateMatrixWorld();
      // Clouds drift east and wrap.
      for (let i = 0; i < cloudSpots.length; i++) {
        cloudSpots[i][0] += dt * 1.6;
        if (cloudSpots[i][0] > 520) cloudSpots[i][0] = -520;
        dummy.position.set(cloudSpots[i][0], cloudSpots[i][1], cloudSpots[i][2]);
        dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
        dummy.updateMatrix(); cloudMesh.setMatrixAt(i, dummy.matrix);
      }
      cloudMesh.instanceMatrix.needsUpdate = true;
      // Boats bob and roll gently.
      boatSpots.forEach((b, i) => {
        const bob = Math.sin(time * 0.9 + i * 1.7) * 0.14;
        dummy.position.set(b.x, -0.2 + bob, b.z);
        dummy.rotation.set(Math.sin(time * 0.7 + i) * 0.03, b.ry, Math.sin(time * 0.55 + i * 2) * 0.04);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        hullMesh.setMatrixAt(i, dummy.matrix);
        boatCabMesh.setMatrixAt(i, dummy.matrix);
      });
      hullMesh.instanceMatrix.needsUpdate = true;
      boatCabMesh.instanceMatrix.needsUpdate = true;
      // Crane jibs slew slowly.
      craneSpots.forEach((c, i) => {
        dummy.position.set(c.x, 34, c.z);
        dummy.rotation.set(0, c.ry + Math.sin(time * 0.08 + i * 2) * 0.5, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix(); craneJib.setMatrixAt(i, dummy.matrix);
      });
      craneJib.instanceMatrix.needsUpdate = true;
      // Lighthouse beam sweeps.
      beam.rotation.y = time * 0.5;
    },
  };
}
