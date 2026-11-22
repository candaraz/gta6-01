// cityBuilder.js — builds all five districts of MIRADOR KEYS from a seed:
// Mirador Strip, Centro Financiero, Puerto Viejo, Barrio Neon, Mirador Heights,
// plus roads, beach, bridge, cranes, palms, lamps, signs and the road graph.
import * as THREE from 'three';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const ROAD_XS = [-240, -160, -80, 0, 80, 160, 240];
export const ROAD_ZS = [-240, -160, -80, 0, 80, 160, 240];
export const ROAD_W = 14;

export const DISTRICTS = {
  strip: { name: 'Mirador Strip', center: new THREE.Vector3(-200, 0, 0), color: '#ffb347' },
  centro: { name: 'Centro Financiero', center: new THREE.Vector3(0, 0, -40), color: '#7ec8ff' },
  puerto: { name: 'Puerto Viejo', center: new THREE.Vector3(200, 0, 60), color: '#ffd24d' },
  barrio: { name: 'Barrio Neon', center: new THREE.Vector3(0, 0, -240), color: '#ff5fd0' },
  heights: { name: 'Mirador Heights', center: new THREE.Vector3(180, 0, 220), color: '#9dff7e' },
};

function flatMesh(w, d, material, x, z, y = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  return m;
}

function makePalm(rng) {
  const g = new THREE.Group();
  const h = 7 + rng() * 3;
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.95 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.42, h, 7), trunkMat);
  trunk.position.y = h / 2;
  trunk.castShadow = true;
  g.add(trunk);
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2f9e4f, roughness: 0.8, side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.6, 4), frondMat);
    const a = (i / 7) * Math.PI * 2 + rng() * 0.4;
    frond.position.set(Math.cos(a) * 1.7, h + 0.4, Math.sin(a) * 1.7);
    frond.rotation.z = Math.cos(a) * 1.15;
    frond.rotation.x = -Math.sin(a) * 1.15;
    frond.scale.set(1, 1, 0.28);
    frond.castShadow = true;
    g.add(frond);
  }
  const nuts = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x6b4a1f, roughness: 0.9 }),
  );
  nuts.position.y = h - 0.3;
  g.add(nuts);
  return g;
}

function makeLamp() {
  const g = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.6, metalness: 0.6 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6.4, 6), poleMat);
  pole.position.y = 3.2;
  pole.castShadow = true;
  g.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.14, 0.14), poleMat);
  arm.position.set(1.0, 6.3, 0);
  g.add(arm);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc46b, emissiveIntensity: 2.2 }),
  );
  bulb.position.set(2.0, 6.15, 0);
  g.add(bulb);
  return g;
}

function makeTrafficLight() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.16, 5.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.6, metalness: 0.5 }),
  );
  pole.position.y = 2.7;
  g.add(pole);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 1.7, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.5 }),
  );
  head.position.y = 5.6;
  g.add(head);
  const lamps = [];
  const colors = [0xff2a1e, 0xffc21e, 0x2eff5e];
  for (let i = 0; i < 3; i++) {
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x330a08, emissive: colors[i], emissiveIntensity: 0.15 }),
    );
    lamp.position.set(0, 6.1 - i * 0.5, 0.28);
    lamps.push(lamp);
    g.add(lamp);
  }
  return { group: g, lamps };
}

function makeCrane() {
  const g = new THREE.Group();
  const yellow = new THREE.MeshStandardMaterial({ color: 0xf2b705, roughness: 0.55, metalness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.7 });
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(1.6, 26, 1.6), yellow);
    leg.position.set(sx * 5, 13, 0);
    leg.castShadow = true;
    g.add(leg);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(34, 1.8, 1.8), yellow);
  beam.position.set(6, 26.5, 0);
  beam.castShadow = true;
  g.add(beam);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(4, 3.4, 3.4), dark);
  cab.position.set(-2, 25, 0);
  g.add(cab);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 12, 5), dark);
  cable.position.set(16, 20, 0);
  g.add(cable);
  const hook = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.8, 1.4), dark);
  hook.position.set(16, 13.5, 0);
  g.add(hook);
  return g;
}

function makeBoat(rng, kind) {
  const g = new THREE.Group();
  const hullColor = kind === 'yacht' ? 0xf2f2ee : 0x3a6ea5;
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(kind === 'yacht' ? 5 : 7, 1.6, kind === 'yacht' ? 14 : 18),
    new THREE.MeshStandardMaterial({ color: hullColor, roughness: 0.4, metalness: 0.3 }),
  );
  hull.position.y = 0.4;
  hull.castShadow = true;
  g.add(hull);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 2.2, kind === 'yacht' ? 7 : 5),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }),
  );
  cabin.position.set(0, 2.2, kind === 'yacht' ? -1 : 2);
  cabin.castShadow = true;
  g.add(cabin);
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.12, 7, 5),
    new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5, metalness: 0.6 }),
  );
  mast.position.set(0, 6, 2);
  g.add(mast);
  return g;
}

function makeBuilding(w, h, d, facadeTex, roofColor) {
  const side = new THREE.MeshStandardMaterial({ map: facadeTex, roughness: 0.55, metalness: 0.25 });
  const roof = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.9 });
  const mats = [side, side, roof, roof, side, side];
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeSignPlane(tex, w, h) {
  const mat = new THREE.MeshStandardMaterial({
    map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.9, roughness: 0.4,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  return m;
}

export function buildCity(scene, textures, seed = 7) {
  const rng = mulberry32(seed);
  const world = {
    roadXs: ROAD_XS, roadZs: ROAD_ZS,
    trafficLights: [],
    ramps: [],
    signs: [],
    palms: [],
    spawnPoints: {},
    graph: { nodes: [], edges: [] },
  };

  // ---- Ground base (concrete city slab) ----
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x8f8a80, roughness: 0.95 });
  const ground = flatMesh(580, 660, groundMat, 5, 5, 0);
  scene.add(ground);

  // ---- Beach sand strip (west) ----
  const sand = flatMesh(86, 660, new THREE.MeshStandardMaterial({ map: textures.sand, roughness: 1 }), -290, 5, 0.06);
  scene.add(sand);
  // Boardwalk along the beachfront avenue
  const boardwalk = flatMesh(12, 660, new THREE.MeshStandardMaterial({ map: textures.boardwalk, roughness: 0.9 }), -244, 5, 0.1);
  scene.add(boardwalk);

  // ---- Roads (asphalt ribbons with painted lines) ----
  const asphaltMat = new THREE.MeshStandardMaterial({ map: textures.asphalt, roughness: 0.92 });
  const asphaltMatZ = asphaltMat.clone();
  asphaltMatZ.map = textures.asphalt.clone();
  asphaltMatZ.map.rotation = Math.PI / 2;
  asphaltMatZ.map.center.set(0.5, 0.5);
  asphaltMatZ.map.needsUpdate = true;
  for (const x of ROAD_XS) {
    const road = flatMesh(ROAD_W, 660, asphaltMat, x, 5, 0.08);
    scene.add(road);
    for (const z of [-246, 246]) {
      const walk = flatMesh(5, 660, new THREE.MeshStandardMaterial({ map: textures.sidewalk, roughness: 0.95 }), x + (z < 0 ? -9.5 : 9.5), 5, 0.09);
      scene.add(walk);
    }
  }
  for (const z of ROAD_ZS) {
    const road = flatMesh(580, ROAD_W, asphaltMatZ, 5, z, 0.08);
    scene.add(road);
  }
  // Crosswalks at every intersection
  const crossMat = new THREE.MeshStandardMaterial({ map: textures.crosswalk, roughness: 0.9 });
  for (const x of ROAD_XS) {
    for (const z of ROAD_ZS) {
      const cw = flatMesh(ROAD_W + 2, 8, crossMat, x, z - 9, 0.12);
      scene.add(cw);
      const cw2 = flatMesh(8, ROAD_W + 2, crossMat, x - 9, z, 0.12);
      scene.add(cw2);
    }
  }

  // ---- Road graph (intersections + edges) for traffic / GPS ----
  const nodeId = (ix, iz) => iz * ROAD_XS.length + ix;
  for (let iz = 0; iz < ROAD_ZS.length; iz++) {
    for (let ix = 0; ix < ROAD_XS.length; ix++) {
      world.graph.nodes.push(new THREE.Vector3(ROAD_XS[ix], 0, ROAD_ZS[iz]));
    }
  }
  const addEdge = (a, b) => world.graph.edges.push([a, b]);
  for (let iz = 0; iz < ROAD_ZS.length; iz++) {
    for (let ix = 0; ix < ROAD_XS.length; ix++) {
      if (ix + 1 < ROAD_XS.length) addEdge(nodeId(ix, iz), nodeId(ix + 1, iz));
      if (iz + 1 < ROAD_ZS.length) addEdge(nodeId(ix, iz), nodeId(ix, iz + 1));
    }
  }

  // ---- Traffic lights at the four central intersections ----
  for (const [x, z] of [[0, 0], [0, -80], [-80, 0], [80, 0]]) {
    const tl = makeTrafficLight();
    tl.group.position.set(x + 9, 0, z + 9);
    scene.add(tl.group);
    world.trafficLights.push(tl);
  }

  // ---- Street lamps along the Strip avenue and downtown ----
  for (let z = -240; z <= 240; z += 80) {
    const lamp = makeLamp();
    lamp.position.set(-232, 0, z + 20);
    lamp.rotation.y = Math.PI / 2;
    scene.add(lamp);
    const lamp2 = makeLamp();
    lamp2.position.set(8, 0, z + 20);
    lamp2.rotation.y = -Math.PI / 2;
    scene.add(lamp2);
  }

  // ---- Palm trees along the beachfront and plaza ----
  for (let z = -230; z <= 230; z += 46) {
    const palm = makePalm(rng);
    palm.position.set(-252 + rng() * 4, 0, z + rng() * 12);
    scene.add(palm);
    world.palms.push(palm);
  }
  for (let i = 0; i < 10; i++) {
    const palm = makePalm(rng);
    palm.position.set(-236 + rng() * 6, 0, -220 + i * 48 + rng() * 10);
    scene.add(palm);
    world.palms.push(palm);
  }
  return { world, rng, scene, textures };
}

// ---- Buildings, signs, docks, bridge, ramps (part 2) ----
export function buildDistricts(ctx) {
  const { world, rng, scene, textures } = ctx;
  const blockCentersX = [-200, -120, -40, 40, 120, 200];
  const blockCentersZ = [-200, -120, -40, 40, 120, 200];

  function districtOf(bx, bz) {
    if (bx === -200) return 'strip';
    if (bz === -200) return 'barrio';
    if (bx >= 120 && bz >= -120 && bz <= 120) return 'puerto';
    if (bz >= 120 && bx >= 40) return 'heights';
    if (bx >= -120 && bx <= 40 && bz >= -120 && bz <= 40) return 'centro';
    return 'centro';
  }

  const glassTexs = [textures.glassA, textures.glassB, textures.glassC];
  const decoTexs = [textures.decoPink, textures.decoMint, textures.decoCream];
  const neonTexs = [textures.neonCyan, textures.neonMagenta, textures.neonAmber];

  for (const bx of blockCentersX) {
    for (const bz of blockCentersZ) {
      const district = districtOf(bx, bz);
      const count = district === 'centro' ? 2 : district === 'heights' ? 3 : 2;
      for (let k = 0; k < count; k++) {
        const ox = (k % 2 === 0 ? -16 : 16) + (rng() - 0.5) * 8;
        const oz = (k < 2 ? -16 : 16) + (rng() - 0.5) * 8;
        const x = bx + ox;
        const z = bz + oz;
        let mesh;
        if (district === 'centro') {
          const h = 42 + rng() * 68;
          const w = 20 + rng() * 10;
          mesh = makeBuilding(w, h, w, glassTexs[Math.floor(rng() * 3)], 0x2a2f3a);
          // rooftop helipad on the tallest towers
          if (h > 85) {
            const pad = new THREE.Mesh(
              new THREE.CylinderGeometry(7, 7, 0.6, 20),
              new THREE.MeshStandardMaterial({ color: 0x1c2b1c, roughness: 0.8 }),
            );
            pad.position.set(x, h + 0.3, z);
            scene.add(pad);
            const padMark = new THREE.Mesh(
              new THREE.CircleGeometry(4.4, 20),
              new THREE.MeshStandardMaterial({ color: 0xffd24d, emissive: 0xcc8a00, emissiveIntensity: 0.6 }),
            );
            padMark.rotation.x = -Math.PI / 2;
            padMark.position.set(x, h + 0.65, z);
            scene.add(padMark);
          }
        } else if (district === 'strip') {
          const h = 12 + rng() * 12;
          mesh = makeBuilding(26 + rng() * 8, h, 16 + rng() * 6, decoTexs[Math.floor(rng() * 3)], 0xf6e3c2);
        } else if (district === 'barrio') {
          const h = 8 + rng() * 7;
          mesh = makeBuilding(22 + rng() * 8, h, 15 + rng() * 5, neonTexs[Math.floor(rng() * 3)], 0x1a1a22);
        } else if (district === 'puerto') {
          const h = 8 + rng() * 6;
          mesh = makeBuilding(24 + rng() * 10, h, 18 + rng() * 6, textures.industrial, 0x4a4640);
        } else {
          const h = 6 + rng() * 5;
          mesh = makeBuilding(16 + rng() * 8, h, 14 + rng() * 6,
            Math.random() < 0.5 ? textures.decoCream : textures.concrete, 0x8a5a3a);
        }
        mesh.position.set(x, mesh.geometry.parameters.height / 2, z);
        mesh.rotation.y = (rng() < 0.12 ? Math.PI / 2 : 0);
        scene.add(mesh);
      }
    }
  }

  // ---- Solaris Bank plaza (Centro) — big tower + plaza + sign ----
  const bank = makeBuilding(34, 96, 30, textures.glassB, 0x2a2f3a);
  bank.position.set(40, 48, -40);
  scene.add(bank);
  const bankSign = makeSignPlane(textures.signs.solaris, 30, 7.5);
  bankSign.position.set(40, 78, -24.8);
  scene.add(bankSign);
  world.signs.push(bankSign);
  const plazaMat = new THREE.MeshStandardMaterial({ color: 0xb8b0a4, roughness: 0.9 });
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), plazaMat);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(40, 0.13, -40);
  plaza.receiveShadow = true;
  scene.add(plaza);

  // ---- Neon signs on the Strip hotels and Barrio shops ----
  const signSpots = [
    { tex: textures.signs.palma, x: -214, y: 13, z: -60, w: 26, h: 6.5, ry: Math.PI / 2 },
    { tex: textures.signs.cafe, x: -214, y: 11, z: 60, w: 24, h: 6, ry: Math.PI / 2 },
    { tex: textures.signs.veloz, x: -214, y: 15, z: 140, w: 28, h: 7, ry: Math.PI / 2 },
    { tex: textures.signs.palma, x: -60, y: 9, z: -214, w: 26, h: 6.5, ry: 0 },
    { tex: textures.signs.chop, x: 60, y: 8, z: -214, w: 24, h: 6, ry: 0 },
    { tex: textures.signs.cafe, x: 140, y: 9, z: -214, w: 22, h: 5.5, ry: 0 },
    { tex: textures.signs.mkpd, x: -120, y: 12, z: -120, w: 20, h: 5, ry: Math.PI / 2 },
  ];
  for (const s of signSpots) {
    const sign = makeSignPlane(s.tex, s.w, s.h);
    sign.position.set(s.x, s.y, s.z);
    sign.rotation.y = s.ry;
    scene.add(sign);
    world.signs.push(sign);
  }

  // ---- Rooftop billboards ----
  const billboards = [
    { tex: textures.billboards.synth, x: -120, y: 26, z: -120, ry: Math.PI / 4 },
    { tex: textures.billboards.veloz, x: 80, y: 52, z: -40, ry: -Math.PI / 3 },
    { tex: textures.billboards.palms, x: -40, y: 30, z: 120, ry: Math.PI / 2 },
  ];
  for (const b of billboards) {
    const board = makeSignPlane(b.tex, 34, 17);
    board.position.set(b.x, b.y, b.z);
    board.rotation.y = b.ry;
    scene.add(board);
    world.signs.push(board);
  }

  // ---- Puerto Viejo docks: piers, containers, cranes, boats ----
  const pierMat = new THREE.MeshStandardMaterial({ map: textures.boardwalk, roughness: 0.9 });
  for (const pz of [-20, 60, 140]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(70, 1.2, 10), pierMat);
    pier.position.set(295, 0.4, pz);
    pier.castShadow = true;
    pier.receiveShadow = true;
    scene.add(pier);
  }
  const containerColors = [0xc23b2a, 0x2a6ec2, 0x3a9e4f, 0xd98a1f, 0x7a4fb5];
  for (let i = 0; i < 26; i++) {
    const c = new THREE.Mesh(
      new THREE.BoxGeometry(12, 2.6, 2.6),
      new THREE.MeshStandardMaterial({ color: containerColors[i % containerColors.length], roughness: 0.7, metalness: 0.3 }),
    );
    const row = Math.floor(i / 6);
    const col = i % 6;
    c.position.set(180 + row * 16 + (rng() - 0.5) * 3, 1.3 + (col % 3 === 0 ? 2.6 : 0), -60 + col * 26 + (rng() - 0.5) * 4);
    c.rotation.y = (rng() - 0.5) * 0.1;
    c.castShadow = true;
    scene.add(c);
  }
  for (const [cx, cz] of [[230, -40], [230, 100], [305, 45]]) {
    const crane = makeCrane();
    crane.position.set(cx, 0, cz);
    crane.rotation.y = Math.PI / 2;
    scene.add(crane);
  }
  const boatSpots = [
    { kind: 'yacht', x: 320, z: -20, ry: 0.3 },
    { kind: 'yacht', x: 330, z: 80, ry: -0.4 },
    { kind: 'boat', x: 310, z: 140, ry: 0.9 },
    { kind: 'boat', x: 350, z: 20, ry: 1.4 },
  ];
  for (const b of boatSpots) {
    const boat = makeBoat(rng, b.kind);
    boat.position.set(b.x, 0.1, b.z);
    boat.rotation.y = b.ry;
    scene.add(boat);
  }

  // ---- Causeway Bridge over the harbor (scenic, elevated) ----
  const bridgeMat = new THREE.MeshStandardMaterial({ color: 0x9a938a, roughness: 0.85 });
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(150, 1.6, 12), bridgeMat);
  bridge.position.set(330, 9, 170);
  bridge.castShadow = true;
  bridge.receiveShadow = true;
  scene.add(bridge);
  for (let i = 0; i < 5; i++) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(3, 10, 8), bridgeMat);
    pillar.position.set(280 + i * 26, 4, 170);
    scene.add(pillar);
  }
  // bridge lamps
  for (let i = 0; i < 6; i++) {
    const lamp = makeLamp();
    lamp.position.set(272 + i * 24, 9.8, 164);
    scene.add(lamp);
  }

  // ---- Stunt ramps (marina + bridge approach) ----
  function makeRamp(x, z, ry) {
    const ramp = new THREE.Mesh(
      new THREE.BoxGeometry(10, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: 0xff9a3c, roughness: 0.6 }),
    );
    ramp.position.set(x, 1.4, z);
    ramp.rotation.y = ry;
    ramp.rotation.z = 0.42;
    ramp.castShadow = true;
    scene.add(ramp);
    const chevron = makeSignPlane(textures.billboards.veloz, 8, 4);
    chevron.position.set(x, 3.4, z - 5);
    chevron.rotation.y = ry;
    scene.add(chevron);
    world.ramps.push({ position: new THREE.Vector3(x, 0, z), rotation: ry });
    return ramp;
  }
  makeRamp(320, 140, -Math.PI / 2);
  makeRamp(160, 200, Math.PI);
  makeRamp(-160, -160, Math.PI / 4);

  // ---- Spawn points ----
  world.spawnPoints = {
    stripAvenue: new THREE.Vector3(-240, 0, 40),
    plaza: new THREE.Vector3(40, 0, -10),
    marina: new THREE.Vector3(220, 0, 60),
    barrio: new THREE.Vector3(0, 0, -240),
    heights: new THREE.Vector3(180, 0, 200),
    bridge: new THREE.Vector3(300, 0, 170),
    chopShop: new THREE.Vector3(60, 0, -232),
  };
  return world;
}
