// Solmar Bay: a procedural sun-soaked coastal city on a road grid.
// Downtown towers wear canvas-painted window facades (4 palettes); the
// marina has cranes, containers and boats; suburbs, yards, beach, sea
// and a lighthouse read as different districts. Palms, lamps and traffic
// lights line every street; clouds drift; a low golden sun casts real
// shadows that follow the player.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makeRng, pick, range, rangeInt, clamp } from './random.js';

const FACADES = [
  { base: '#5a5148', trim: '#8a7a5c', lit: '#ffd28a', dark: '#2c2830', shop: '#c9a86a' },
  { base: '#4a4f5e', trim: '#6e7488', lit: '#ffe1a0', dark: '#23262e', shop: '#7fa3c9' },
  { base: '#6b4a3a', trim: '#9c6f52', lit: '#ffcf7d', dark: '#2e211a', shop: '#d98a4a' },
  { base: '#3f4a3f', trim: '#5f705f', lit: '#ffe9b0', dark: '#20261f', shop: '#8fb08a' },
];

function facadeTexture(rng, pal) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = pal.base; g.fillRect(0, 0, 128, 256);
  // Horizontal floor bands.
  const floors = 12;
  for (let f = 0; f < floors; f++) {
    const y = 8 + f * 20;
    g.fillStyle = pal.trim; g.fillRect(0, y - 1, 128, 2);
    for (let w = 0; w < 4; w++) {
      const x = 8 + w * 30;
      const lit = rng() < 0.45;
      g.fillStyle = lit ? pal.lit : pal.dark;
      g.fillRect(x, y, 20, 13);
      if (lit && rng() < 0.5) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, y + 6, 20, 7); }
    }
  }
  // Shopfront band at the base.
  g.fillStyle = pal.shop; g.fillRect(0, 236, 128, 20);
  g.fillStyle = 'rgba(0,0,0,0.4)';
  g.fillRect(6, 240, 34, 12); g.fillRect(48, 240, 34, 12); g.fillRect(90, 240, 32, 12);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function lowriseTexture(rng, pal) {
  // Two floors of windows and a door — for sheds and warehouses, which
  // the tall tower texture would stretch into dark stripes.
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = pal.base; g.fillRect(0, 0, 128, 64);
  for (let f = 0; f < 2; f++) {
    const y = 8 + f * 22;
    for (let w = 0; w < 4; w++) {
      g.fillStyle = rng() < 0.5 ? pal.lit : pal.dark;
      g.fillRect(8 + w * 30, y, 20, 13);
    }
  }
  g.fillStyle = pal.shop; g.fillRect(52, 44, 24, 20);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function roadTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#5a5e68'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#f2c230'; g.fillRect(30, 4, 4, 20); g.fillRect(30, 36, 4, 20);
  g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(4, 0, 2, 64); g.fillRect(58, 0, 2, 64);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildCity(G) {
  const rng = makeRng(G.seed);
  const scene = G.scene;
  const B = CFG.block, N = CFG.halfBlocks;
  const colliders = []; // {x0,z0,x1,z1} AABBs
  const city = { colliders, clouds: [], sea: null, lighthouseLight: null, roadTex: null };

  // Sky: a gradient dome — warm gold at the horizon, blue above.
  // (A solid background colour reads flat in screenshots.)
  const skyC = document.createElement('canvas'); skyC.width = 4; skyC.height = 128;
  const sg = skyC.getContext('2d');
  const grad = sg.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#6ea8dd');
  grad.addColorStop(0.55, '#a8c8e8');
  grad.addColorStop(0.78, '#ffd9a8');
  grad.addColorStop(1, '#ffb070');
  sg.fillStyle = grad; sg.fillRect(0, 0, 4, 128);
  const skyTex = new THREE.CanvasTexture(skyC);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(850, 16, 12),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }));
  scene.add(sky);
  scene.background = new THREE.Color(CFG.skyTop);
  scene.fog = new THREE.Fog(CFG.fogColor, CFG.fogNear, CFG.fogFar);
  const sun = new THREE.DirectionalLight(CFG.sunColor, 2.6);
  sun.position.set(-120, 160, -90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -90; sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
  sun.shadow.camera.far = 500; sun.shadow.bias = -0.0004;
  scene.add(sun); scene.add(sun.target);
  G.sun = sun;
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a6a4a, 1.25);
  scene.add(hemi);
  const amb = new THREE.AmbientLight(0xffd9b0, 0.6);
  scene.add(amb);

  // Ground base (grass/concrete) and the sea.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshLambertMaterial({ color: 0x6f7d5a }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.05, 0); ground.receiveShadow = true;
  scene.add(ground);
  // Sand band on the east edge.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 620),
    new THREE.MeshLambertMaterial({ color: 0xe8d29a }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(285, 0.02, 0); sand.receiveShadow = true;
  scene.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(320, 900),
    new THREE.MeshLambertMaterial({ color: 0x2a7fa8, transparent: true, opacity: 0.92 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(460, 0.05, 0);
  scene.add(sea); city.sea = sea;

  // Roads: dark strips along every grid line, with dashes.
  const rTex = roadTexture(); city.roadTex = rTex;
  const roadMat = new THREE.MeshLambertMaterial({ map: rTex });
  for (let k = -N; k <= N; k++) {
    const c = k * B;
    for (const horiz of [true, false]) {
      const len = (2 * N + 1) * B + 20;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, CFG.roadHalf * 2), roadMat.clone());
      m.material.map = rTex.clone();
      m.material.map.repeat.set(len / 16, 1);
      m.material.map.needsUpdate = true;
      m.rotation.x = -Math.PI / 2;
      if (horiz) { m.position.set(0, 0.06, c); }
      else { m.rotation.z = Math.PI / 2; m.position.set(c, 0.06, 0); }
      m.receiveShadow = true;
      scene.add(m);
    }
  }
  // Sidewalks: pale strips flanking each road.
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x9aa0a8 });
  for (let k = -N; k <= N; k++) {
    const c = k * B;
    for (const off of [-8.5, 8.5]) {
      const len = (2 * N + 1) * B + 20;
      const s1 = new THREE.Mesh(new THREE.PlaneGeometry(len, 3.4), walkMat);
      s1.rotation.x = -Math.PI / 2; s1.position.set(0, 0.04, c + off); s1.receiveShadow = true; scene.add(s1);
      const s2 = new THREE.Mesh(new THREE.PlaneGeometry(3.4, len), walkMat);
      s2.rotation.x = -Math.PI / 2; s2.position.set(c + off, 0.04, 0); s2.receiveShadow = true; scene.add(s2);
    }
  }

  // Facade textures, one per palette; low-rise versions for sheds.
  const texes = FACADES.map((p) => facadeTexture(rng, p));
  const lowTexes = FACADES.map((p) => lowriseTexture(rng, p));
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3a3a40 });
  const boxMat = new THREE.MeshLambertMaterial({ color: 0x8a8a8a });

  function addBox(x, z, w, h, d, mat, collide) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, h / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    if (collide !== false) colliders.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
    return m;
  }
  function blockCenter(bx, bz) { return { x: (bx + 0.5) * B, z: (bz + 0.5) * B }; }
  function inDistrict(bx, bz, d) { return bx >= d.x0 && bx <= d.x1 && bz >= d.z0 && bz <= d.z1; }

  // Landmark buildings, centred in their blocks so roads stay open.
  const landmarks = [
    { name: "Mara's Place", bx: 0, bz: -1, w: 20, h: 12, d: 14, color: 0x7a4a3a },
    { name: 'Bay Bank', bx: 1, bz: 1, w: 24, h: 16, d: 16, color: 0x8a7a4a },
    { name: 'Dock Office', bx: 3, bz: -1, w: 18, h: 10, d: 12, color: 0x4a6a7a },
    { name: "Tessa's Garage", bx: 1, bz: -3, w: 22, h: 9, d: 16, color: 0x5a5a6a },
    { name: 'Ammo & Iron', bx: -2, bz: 2, w: 16, h: 9, d: 12, color: 0x6a5a3a },
    { name: 'The Loft', bx: -1, bz: 1, w: 18, h: 14, d: 14, color: 0x9a5a4a },
  ];
  for (const L of landmarks) {
    const c = blockCenter(L.bx, L.bz);
    const mat = new THREE.MeshLambertMaterial({ color: L.color });
    addBox(c.x, c.z, L.w, L.h, L.d, mat);
    // Roof sign board.
    addBox(c.x, c.z, L.w * 0.7, 1.2, 1, new THREE.MeshLambertMaterial({ color: 0xffd23e }), false)
      .position.y = L.h + 0.8;
    G.landmarks = G.landmarks || {};
    G.landmarks[L.name] = { x: c.x, z: c.z };
  }

  // District buildings, block by block.
  const towerGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let bx = -N; bx < N; bx++) {
    for (let bz = -N; bz < N; bz++) {
      const c = blockCenter(bx, bz);
      if (c.x > CFG.beachX - 20) continue; // beach / sea, no buildings
      if (landmarks.some((L) => L.bx === bx && L.bz === bz)) continue;
      if (inDistrict(bx, bz, CFG.downtown)) {
        // Tall windowed tower, 30–72 m.
        const h = range(rng, 30, 72);
        const w = range(rng, 20, 30), d = range(rng, 20, 30);
        const pal = Math.floor(rng() * texes.length);
        const mats = [
          new THREE.MeshLambertMaterial({ map: texes[pal] }),
          new THREE.MeshLambertMaterial({ map: texes[pal] }),
          roofMat, roofMat,
          new THREE.MeshLambertMaterial({ map: texes[pal] }),
          new THREE.MeshLambertMaterial({ map: texes[pal] }),
        ];
        const t = new THREE.Mesh(towerGeo, mats);
        t.scale.set(w, h, d); t.position.set(c.x, h / 2, c.z);
        t.castShadow = true; t.receiveShadow = true;
        scene.add(t);
        colliders.push({ x0: c.x - w / 2, z0: c.z - d / 2, x1: c.x + w / 2, z1: c.z + d / 2 });
        // Parapet + rooftop props.
        addBox(c.x, c.z, w + 1, 1.2, d + 1, roofMat, false).position.y = h + 0.4;
        if (rng() < 0.7) addBox(c.x + range(rng, -6, 6), c.z + range(rng, -6, 6), 3, 2, 3, boxMat, false).position.y = h + 1.6;
        if (rng() < 0.5) {
          const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 7, 5), boxMat);
          ant.position.set(c.x + range(rng, -8, 8), h + 4, c.z + range(rng, -8, 8));
          scene.add(ant);
        }
      } else if (inDistrict(bx, bz, CFG.marina)) {
        // Concrete yard pad, then dock sheds + container stacks.
        const pad = new THREE.Mesh(new THREE.PlaneGeometry(38, 38),
          new THREE.MeshLambertMaterial({ color: 0x8f9296 }));
        pad.rotation.x = -Math.PI / 2; pad.position.set(c.x, 0.03, c.z);
        pad.receiveShadow = true; scene.add(pad);
        if (rng() < 0.5) addBox(c.x, c.z, range(rng, 18, 26), range(rng, 6, 9), range(rng, 12, 18),
          new THREE.MeshLambertMaterial({ map: lowTexes[Math.floor(rng() * lowTexes.length)] }));
        const n = rangeInt(rng, 2, 5);
        for (let i = 0; i < n; i++) {
          addBox(c.x + range(rng, -12, 12), c.z + range(rng, -12, 12),
            6, 2.6, 2.6, new THREE.MeshLambertMaterial({ color: pick(rng, [0xd32f2f, 0x1565c0, 0xf2b705, 0x2e7d32, 0x7b1fa2]) }));
        }
      } else if (inDistrict(bx, bz, CFG.suburbs)) {
        // Low houses with pitched roofs and yards.
        const n = rangeInt(rng, 1, 2);
        for (let i = 0; i < n; i++) {
          const hx = c.x + range(rng, -10, 10), hz = c.z + range(rng, -10, 10);
          addBox(hx, hz, range(rng, 9, 13), range(rng, 4, 6), range(rng, 8, 11),
            new THREE.MeshLambertMaterial({ color: pick(rng, [0xe8dcc0, 0xd8b8a0, 0xc0d0d8, 0xe0c8b0]) }));
          const roof = new THREE.Mesh(new THREE.ConeGeometry(7, 3.5, 4),
            new THREE.MeshLambertMaterial({ color: pick(rng, [0x8a4a3a, 0x5a4a3a, 0x4a5a6a]) }));
          roof.position.set(hx, 7.5, hz); roof.rotation.y = Math.PI / 4;
          roof.castShadow = true; scene.add(roof);
        }
      } else if (inDistrict(bx, bz, CFG.yards)) {
        // Warehouses with low-rise windowed facades.
        addBox(c.x, c.z, range(rng, 22, 30), range(rng, 7, 10), range(rng, 14, 20),
          new THREE.MeshLambertMaterial({ map: lowTexes[Math.floor(rng() * lowTexes.length)] }));
      } else if (rng() < 0.6) {
        // Low commercial block elsewhere.
        addBox(c.x, c.z, range(rng, 14, 24), range(rng, 8, 16), range(rng, 12, 20),
          new THREE.MeshLambertMaterial({ map: texes[Math.floor(rng() * texes.length)] }));
      }
    }
  }

  // Marina cranes (tall yellow lattice-ish towers with a jib).
  const craneMat = new THREE.MeshLambertMaterial({ color: 0xf2b705 });
  for (const [cx, cz] of [[216, -72], [216, 72], [264, 0]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(4, 34, 4), craneMat);
    leg.position.set(cx, 17, cz); leg.castShadow = true; scene.add(leg);
    const jib = new THREE.Mesh(new THREE.BoxGeometry(26, 2, 2), craneMat);
    jib.position.set(cx - 6, 33, cz); jib.castShadow = true; scene.add(jib);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(5, 4, 5), new THREE.MeshLambertMaterial({ color: 0x333333 }));
    cab.position.set(cx, 31, cz); scene.add(cab);
    colliders.push({ x0: cx - 2, z0: cz - 2, x1: cx + 2, z1: cz + 2 });
  }
  // Moored boats in the marina.
  const boatMat = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });
  for (const [bx, bz] of [[320, -120], [330, -40], [320, 40], [335, 130], [315, 200]]) {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(10, 2.5, 4), boatMat);
    hull.position.set(bx, 0.8, bz); hull.rotation.y = range(rng, -0.3, 0.3);
    hull.castShadow = true; scene.add(hull);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 3), new THREE.MeshLambertMaterial({ color: 0x2a4a6a }));
    cab.position.set(bx, 2.8, bz); scene.add(cab);
  }
  // Wooden pier out into the sea at the marina (walkable, boards the Marlin).
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  for (let px = 272; px <= 312; px += 8) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(8, 0.6, 6), pierMat);
    plank.position.set(px, 0.35, 96); plank.receiveShadow = true; scene.add(plank);
  }

  // Lighthouse on the point (south-east).
  const lhBase = new THREE.Mesh(new THREE.CylinderGeometry(5, 7, 26, 10),
    new THREE.MeshLambertMaterial({ color: 0xf0ead8 }));
  lhBase.position.set(282, 13, 262); lhBase.castShadow = true; scene.add(lhBase);
  const lhTop = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 5, 10),
    new THREE.MeshLambertMaterial({ color: 0xd32f2f }));
  lhTop.position.set(282, 28, 262); scene.add(lhTop);
  const lhLight = new THREE.PointLight(0xffe9a0, 60, 120);
  lhLight.position.set(282, 29, 262); scene.add(lhLight);
  city.lighthouseLight = lhLight;
  colliders.push({ x0: 275, z0: 255, x1: 289, z1: 269 });

  // Palms, lamps and traffic lights along every street (instanced).
  // A palm is a trunk plus five drooping fronds, not a green cone.
  const palmTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.5, 7, 6),
    new THREE.MeshLambertMaterial({ color: 0xa88a62 }), 400);
  const frondGeo = new THREE.BoxGeometry(2.8, 0.08, 0.9);
  frondGeo.translate(1.4, 0, 0);
  // Fronds are unlit flat green: a sunlit Lambert frond reads black
  // from the shadow side, and a black bar across the frame looks broken.
  const palmFrond = new THREE.InstancedMesh(frondGeo,
    new THREE.MeshBasicMaterial({ color: 0x2e8a32 }), 2000);
  const lampPole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.12, 6.5, 5),
    new THREE.MeshLambertMaterial({ color: 0x222222 }), 200);
  const lampHead = new THREE.InstancedMesh(new THREE.SphereGeometry(0.35, 6, 5),
    new THREE.MeshLambertMaterial({ color: 0xffe9a0, emissive: 0xffd28a, emissiveIntensity: 0.9 }), 200);
  const tlPole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.12, 5, 5),
    new THREE.MeshLambertMaterial({ color: 0x888888 }), 120);
  const tlBox = new THREE.InstancedMesh(new THREE.BoxGeometry(0.45, 1.1, 0.45),
    new THREE.MeshLambertMaterial({ color: 0x333333 }), 120);
  const tlLight = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 6, 5),
    new THREE.MeshBasicMaterial({ color: 0xff4444 }), 120);
  const dummy = new THREE.Object3D();
  let pi = 0, li = 0, ti = 0;
  function plantPalm(px, pz) {
    if (pi >= 400) return;
    dummy.position.set(px, 3.5, pz); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
    dummy.updateMatrix(); palmTrunk.setMatrixAt(pi, dummy.matrix);
    const phase = Math.random() * Math.PI * 2;
    for (let j = 0; j < 5; j++) {
      dummy.position.set(px, 7.1, pz);
      dummy.rotation.order = 'YXZ';
      dummy.rotation.set(0, phase + (j * Math.PI * 2) / 5, -0.55);
      dummy.updateMatrix();
      palmFrond.setMatrixAt(pi * 5 + j, dummy.matrix);
    }
    dummy.rotation.order = 'XYZ';
    pi++;
  }
  for (let k = -N; k <= N; k++) {
    for (let j = -N; j < N; j++) {
      const c = j * B + B / 2;
      // Palms on both sides of each road segment (near the block edge,
      // so fronds stay out of the camera's path).
      if (rng() < 0.75) plantPalm(c, k * B + 10.5);
      if (rng() < 0.6) plantPalm(k * B + 10.5, c);
      // Lamps every other segment.
      if ((j + k) % 2 === 0 && li < 200) {
        dummy.position.set(c, 3.25, k * B - 9); dummy.updateMatrix(); lampPole.setMatrixAt(li, dummy.matrix);
        dummy.position.set(c, 6.6, k * B - 9); dummy.updateMatrix(); lampHead.setMatrixAt(li, dummy.matrix);
        li++;
      }
      // Traffic lights at intersections.
      if (ti < 120 && Math.abs(k) <= 5 && Math.abs(j) <= 5) {
        dummy.position.set(k * B + 7, 2.5, j * B + 7); dummy.updateMatrix(); tlPole.setMatrixAt(ti, dummy.matrix);
        dummy.position.set(k * B + 7, 5.2, j * B + 7); dummy.updateMatrix(); tlBox.setMatrixAt(ti, dummy.matrix);
        dummy.position.set(k * B + 7, 5.4, j * B + 7); dummy.updateMatrix(); tlLight.setMatrixAt(ti, dummy.matrix);
        ti++;
      }
    }
  }
  palmTrunk.count = pi; palmFrond.count = pi * 5; lampPole.count = li; lampHead.count = li; tlPole.count = ti; tlBox.count = ti; tlLight.count = ti;
  palmTrunk.castShadow = true; palmFrond.castShadow = true;
  scene.add(palmTrunk, palmFrond, lampPole, lampHead, tlPole, tlBox, tlLight);

  // Billboards on downtown rooftops.
  const bbColors = [0xff5a7a, 0x37b6ff, 0xffd23e, 0x7dff8a];
  for (let i = 0; i < 8; i++) {
    const bx = rangeInt(rng, -2, 2), bz = rangeInt(rng, -2, 2);
    const c = blockCenter(bx, bz);
    const bb = new THREE.Mesh(new THREE.PlaneGeometry(16, 6),
      new THREE.MeshBasicMaterial({ color: pick(rng, bbColors), side: THREE.DoubleSide }));
    bb.position.set(c.x, range(rng, 34, 60), c.z);
    bb.rotation.y = rng() < 0.5 ? 0 : Math.PI / 2;
    scene.add(bb);
  }

  // Drifting clouds.
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 14; i++) {
    const cl = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(range(rng, 8, 16), 8, 6), cloudMat);
      s.position.set(j * 10 - 15 + range(rng, -3, 3), range(rng, -2, 2), range(rng, -4, 4));
      s.scale.y = 0.45;
      cl.add(s);
    }
    cl.position.set(range(rng, -320, 320), range(rng, 90, 150), range(rng, -320, 320));
    scene.add(cl);
    city.clouds.push(cl);
  }

  // Road helpers.
  city.nearestRoadPoint = function (x, z) {
    // Snap to the closest road centreline point.
    const rx = Math.round(x / B) * B, rz = Math.round(z / B) * B;
    return Math.abs(x - rx) < Math.abs(z - rz) ? { x: rx, z } : { x, z: rz };
  };
  city.onRoad = function (x, z) {
    const fx = Math.abs(x / B - Math.round(x / B)) * B;
    const fz = Math.abs(z / B - Math.round(z / B)) * B;
    return Math.min(fx, fz) <= CFG.roadHalf + 3;
  };
  city.blocked = function (x, z, pad) {
    pad = pad || 0;
    for (const c of colliders) {
      if (x > c.x0 - pad && x < c.x1 + pad && z > c.z0 - pad && z < c.z1 + pad) return c;
    }
    return null;
  };
  city.resolveCollision = function (x, z, r) {
    // Push a circle out of building AABBs; returns corrected {x,z}.
    for (const c of colliders) {
      const nx = clamp(x, c.x0, c.x1), nz = clamp(z, c.z0, c.z1);
      const dx = x - nx, dz = z - nz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 < 0.0001) { x = c.x1 + r; continue; }
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r; z = nz + (dz / d) * r;
      }
    }
    return { x, z };
  };
  return city;
}
