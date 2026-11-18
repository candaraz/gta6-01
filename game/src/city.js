// Solmar Bay itself: the ground, the road grid, the districts, the beach and
// the marina, built once from a seed. Buildings get canvas-drawn facades so
// the skyline reads as a real place without any image files. The builder
// returns the colliders, the parking spots and the animated pieces.

import * as THREE from 'three';
import { WORLD } from './config.js';

function makeFacadeTexture(base, litRatio, rng) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  const cols = 5;
  const rows = 11;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const lit = rng.next() < litRatio;
      g.fillStyle = lit ? '#ffe9a8' : '#2c3a44';
      g.fillRect(8 + x * 24, 10 + y * 22, 16, 13);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeSignTexture(text, sub, bg, fg) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const g = canvas.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 192);
  g.strokeStyle = fg;
  g.lineWidth = 8;
  g.strokeRect(10, 10, 492, 172);
  g.fillStyle = fg;
  g.font = 'bold 64px Arial, sans-serif';
  g.textAlign = 'center';
  g.fillText(text, 256, 92);
  g.font = 'bold 30px Arial, sans-serif';
  g.fillText(sub, 256, 148);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function districtAt(x, z) {
  if (z < -120) return 'industrial';
  if (Math.abs(x) <= 90 && Math.abs(z) <= 90) return 'downtown';
  if (x > 120 && z > 30) return 'marina';
  if (x < -90) return 'suburb';
  return 'mixed';
}

export function buildCity(scene, rng) {
  const colliders = [];
  const parkingSpots = [];
  const clouds = [];
  let waterMesh = null;

  const facadeDowntown = makeFacadeTexture('#8fa3b0', 0.35, rng);
  const facadeMixed = makeFacadeTexture('#c9b18c', 0.3, rng);
  const facadeMarina = makeFacadeTexture('#e8dcc8', 0.4, rng);
  const matDowntown = new THREE.MeshLambertMaterial({ map: facadeDowntown });
  const matMixed = new THREE.MeshLambertMaterial({ map: facadeMixed });
  const matMarina = new THREE.MeshLambertMaterial({ map: facadeMarina });
  const matHouse = new THREE.MeshLambertMaterial({ color: 0xe6d7bd });
  const matRoof = new THREE.MeshLambertMaterial({ color: 0x9e5a44 });
  const matWarehouse = new THREE.MeshLambertMaterial({ color: 0x8a8f96 });
  const matConcrete = new THREE.MeshLambertMaterial({ color: 0xb9b3a6 });

  function addCollider(x, z, halfX, halfZ) {
    colliders.push({ minX: x - halfX, maxX: x + halfX, minZ: z - halfZ, maxZ: z + halfZ });
  }

  // Base ground: warm dry grass under the whole city.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshLambertMaterial({ color: 0x9aa86b }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  // City slab: pale concrete the blocks sit on.
  const slab = new THREE.Mesh(
    new THREE.PlaneGeometry(424, 424),
    new THREE.MeshLambertMaterial({ color: 0xc4bda9 }),
  );
  slab.rotation.x = -Math.PI / 2;
  slab.position.y = 0.02;
  slab.receiveShadow = true;
  scene.add(slab);

  // Roads: dark strips on the grid lines, with pale centre dashes.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x3c3f45 });
  const dashGeo = new THREE.BoxGeometry(0.5, 0.06, 3);
  const dashMat = new THREE.MeshLambertMaterial({ color: 0xe8e4da });
  const dashes = [];
  for (const line of WORLD.roadLines) {
    const vertical = new THREE.Mesh(new THREE.PlaneGeometry(12, 424), roadMat);
    vertical.rotation.x = -Math.PI / 2;
    vertical.position.set(line, 0.04, 0);
    vertical.receiveShadow = true;
    scene.add(vertical);
    const horizontal = new THREE.Mesh(new THREE.PlaneGeometry(424, 12), roadMat);
    horizontal.rotation.x = -Math.PI / 2;
    horizontal.position.set(0, 0.04, line);
    horizontal.receiveShadow = true;
    scene.add(horizontal);
    for (let t = -200; t <= 200; t += 16) {
      if (WORLD.roadLines.some((other) => Math.abs(t - other) < 9)) continue;
      dashes.push([line, t, 0]);
      dashes.push([t, line, 1]);
    }
  }
  const dashMesh = new THREE.InstancedMesh(dashGeo, dashMat, dashes.length);
  const dummy = new THREE.Object3D();
  dashes.forEach(([a, b, horizontal], i) => {
    dummy.position.set(horizontal ? a : a, 0.07, horizontal ? b : b);
    dummy.position.set(a, 0.07, b);
    dummy.rotation.set(0, horizontal ? Math.PI / 2 : 0, 0);
    dummy.updateMatrix();
    dashMesh.setMatrixAt(i, dummy.matrix);
  });
  scene.add(dashMesh);

  // Beach sand and the sea beyond it.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(48, 460),
    new THREE.MeshLambertMaterial({ color: 0xe3cf96 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(228, 0.03, 0);
  sand.receiveShadow = true;
  scene.add(sand);
  waterMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 900),
    new THREE.MeshLambertMaterial({ color: 0x2e7fa8, transparent: true, opacity: 0.92 }),
  );
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.set(460, 0.0, 0);
  scene.add(waterMesh);

  // Blocks and buildings.
  const blockCentres = [-195, -150, -90, -30, 30, 90, 150, 195];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (const cx of blockCentres) {
    for (const cz of blockCentres) {
      const size = Math.abs(cx) === 195 || Math.abs(cz) === 195 ? 30 : 48;
      const district = districtAt(cx, cz);
      // Raised block pad.
      const pad = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        new THREE.MeshLambertMaterial({ color: district === 'suburb' ? 0xa8b078 : 0xcfc8b8 }),
      );
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(cx, 0.05, cz);
      pad.receiveShadow = true;
      scene.add(pad);

      if (district === 'suburb') {
        // Two houses per block, with pitched roofs.
        for (const [ox, oz] of [[-10, -10], [10, 10]]) {
          const w = rng.range(9, 13);
          const d = rng.range(8, 11);
          const h = rng.range(4.5, 6.5);
          const house = new THREE.Mesh(boxGeo, matHouse);
          house.scale.set(w, h, d);
          house.position.set(cx + ox, h / 2 + 0.05, cz + oz);
          house.castShadow = true;
          house.receiveShadow = true;
          scene.add(house);
          const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, 2.6, 4), matRoof);
          roof.position.set(cx + ox, h + 1.3, cz + oz);
          roof.rotation.y = Math.PI / 4;
          roof.castShadow = true;
          scene.add(roof);
          addCollider(cx + ox, cz + oz, w / 2, d / 2);
        }
        continue;
      }
      if (district === 'industrial') {
        const w = rng.range(22, 30);
        const d = rng.range(16, 22);
        const h = rng.range(8, 12);
        const warehouse = new THREE.Mesh(boxGeo, matWarehouse);
        warehouse.scale.set(w, h, d);
        warehouse.position.set(cx, h / 2 + 0.05, cz);
        warehouse.castShadow = true;
        warehouse.receiveShadow = true;
        scene.add(warehouse);
        addCollider(cx, cz, w / 2, d / 2);
        // Shipping containers beside it.
        for (let i = 0; i < 3; i += 1) {
          const cc = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: rng.pick([0xc25a3a, 0x3a6e8a, 0xd9a441]) }));
          cc.scale.set(6, 2.6, 2.4);
          const px = cx + rng.range(-size / 2 + 6, size / 2 - 6);
          const pz = cz + (d / 2 + 5) * (i % 2 === 0 ? 1 : -1);
          cc.position.set(px, 1.35, pz);
          cc.castShadow = true;
          scene.add(cc);
          addCollider(px, pz, 3, 1.2);
        }
        continue;
      }
      // Downtown, marina and mixed: one to four towers per block.
      const lots = district === 'downtown' ? 4 : rng.chance(0.5) ? 2 : 1;
      const offsets = lots === 4 ? [[-11, -11], [11, -11], [-11, 11], [11, 11]]
        : lots === 2 ? [[-11, 0], [11, 0]] : [[0, 0]];
      for (const [ox, oz] of offsets) {
        if (lots > 1 && rng.chance(0.2)) {
          // An empty lot becomes parking.
          parkingSpots.push({ x: cx + ox, z: cz + oz, heading: rng.pick([0, Math.PI / 2, Math.PI]) });
          continue;
        }
        const w = lots === 1 ? rng.range(24, 34) : rng.range(14, 20);
        const d = lots === 1 ? rng.range(24, 34) : rng.range(14, 20);
        const h = district === 'downtown' ? rng.range(26, 68) : district === 'marina' ? rng.range(9, 20) : rng.range(10, 26);
        const mat = district === 'downtown' ? matDowntown : district === 'marina' ? matMarina : matMixed;
        const tower = new THREE.Mesh(boxGeo, mat);
        tower.scale.set(w, h, d);
        tower.position.set(cx + ox, h / 2 + 0.05, cz + oz);
        tower.castShadow = true;
        tower.receiveShadow = true;
        scene.add(tower);
        // Rooftop box, so the skyline is not flat.
        const cap = new THREE.Mesh(boxGeo, matConcrete);
        cap.scale.set(w * 0.4, 2.5, d * 0.4);
        cap.position.set(cx + ox, h + 1.25, cz + oz);
        cap.castShadow = true;
        scene.add(cap);
        addCollider(cx + ox, cz + oz, w / 2, d / 2);
      }
    }
  }

  // Parked-car spots along the roads as well as in lots.
  for (const line of WORLD.roadLines) {
    for (let t = -170; t <= 170; t += 60) {
      if (rng.chance(0.55)) parkingSpots.push({ x: line + 4.6, z: t + rng.range(-14, 14), heading: 0 });
      if (rng.chance(0.55)) parkingSpots.push({ x: t + rng.range(-14, 14), z: line + 4.6, heading: Math.PI / 2 });
    }
  }

  // Palm trees: instanced trunks and fronds.
  const palmSpots = [];
  for (const line of WORLD.roadLines) {
    for (let t = -190; t <= 190; t += 30) {
      if (rng.chance(0.6)) palmSpots.push([line + 9, t]);
      if (rng.chance(0.6)) palmSpots.push([line - 9, t + 15]);
    }
  }
  for (let i = 0; i < 26; i += 1) palmSpots.push([rng.range(212, 240), rng.range(-200, 200)]);
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 6, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a3a });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const frondGeo = new THREE.BoxGeometry(3.4, 0.08, 0.7);
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x3d8a3d });
  const fronds = new THREE.InstancedMesh(frondGeo, frondMat, palmSpots.length * 5);
  palmSpots.forEach(([x, z], i) => {
    const lean = rng.range(-0.08, 0.08);
    dummy.position.set(x, 3, z);
    dummy.rotation.set(lean, 0, lean);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    for (let f = 0; f < 5; f += 1) {
      const angle = (f / 5) * Math.PI * 2 + rng.range(-0.2, 0.2);
      dummy.position.set(x + Math.cos(angle) * 1.4, 6.1, z + Math.sin(angle) * 1.4);
      dummy.rotation.set(0, -angle, -0.42);
      dummy.updateMatrix();
      fronds.setMatrixAt(i * 5 + f, dummy.matrix);
    }
  });
  trunks.castShadow = true;
  scene.add(trunks);
  scene.add(fronds);

  // Street lamps along the avenues.
  const lampSpots = [];
  for (const line of WORLD.roadLines) {
    for (let t = -180; t <= 180; t += 60) lampSpots.push([line + 8, t]);
  }
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 5.4, 5);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c2c30 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampSpots.length);
  const headGeo = new THREE.SphereGeometry(0.28, 8, 6);
  const headMat = new THREE.MeshLambertMaterial({ color: 0xfff2c8, emissive: 0xffe9a8, emissiveIntensity: 0.7 });
  const heads = new THREE.InstancedMesh(headGeo, headMat, lampSpots.length);
  lampSpots.forEach(([x, z], i) => {
    dummy.position.set(x, 2.7, z);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    poles.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 5.5, z);
    dummy.updateMatrix();
    heads.setMatrixAt(i, dummy.matrix);
  });
  scene.add(poles);
  scene.add(heads);

  // Billboards with the city's own names on them.
  const signs = [
    { text: 'SOLMAR BAY', sub: 'SUN • SALT • SECOND CHANCES', x: -60, z: -96, bg: '#1c4a6e', fg: '#ffd94a' },
    { text: 'MARINA', sub: 'BOATS • BAIT • BAD DECISIONS', x: 150, z: 96, bg: '#0e5a4a', fg: '#ffffff' },
    { text: "TESSA'S", sub: 'GARAGE • SPRAY • REPAIRS', x: 60, z: 96, bg: '#7a2e1c', fg: '#ffe9a8' },
    { text: 'HOTEL PALMERA', sub: 'VALET • VIEWS • VICES', x: 96, z: -60, bg: '#4a2e5a', fg: '#ffd94a' },
  ];
  for (const sign of signs) {
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(16, 6, 0.6),
      new THREE.MeshLambertMaterial({ map: makeSignTexture(sign.text, sign.sub, sign.bg, sign.fg) }),
    );
    board.position.set(sign.x, 9, sign.z);
    board.castShadow = true;
    scene.add(board);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 6.5, 6), poleMat);
    post.position.set(sign.x, 3.2, sign.z);
    post.castShadow = true;
    scene.add(post);
    addCollider(sign.x, sign.z, 0.6, 0.6);
  }

  // The marina: wooden docks and moored boats.
  const dockMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  for (const dz of [80, 120, 160]) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(34, 0.8, 5), dockMat);
    dock.position.set(258, 0.6, dz);
    dock.castShadow = true;
    dock.receiveShadow = true;
    scene.add(dock);
    addCollider(258, dz, 17, 2.5);
  }
  const hullMat = new THREE.MeshLambertMaterial({ color: 0xe8e4da });
  const hullMat2 = new THREE.MeshLambertMaterial({ color: 0x3a6e8a });
  [[268, 92], [268, 132], [268, 172], [252, 104]].forEach(([x, z], i) => {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(9, 1.6, 3), i % 2 ? hullMat2 : hullMat);
    hull.position.y = 0.8;
    boat.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 2.2), hullMat);
    cabin.position.set(-0.5, 2.2, 0);
    boat.add(cabin);
    boat.position.set(x, 0.1, z);
    boat.rotation.y = rng.range(-0.15, 0.15);
    scene.add(boat);
  });

  // The lighthouse at the north end of the beach.
  const lightBase = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.4, 22, 10), matConcrete);
  lightBase.position.set(232, 11, -150);
  lightBase.castShadow = true;
  scene.add(lightBase);
  const lightTop = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 3, 10),
    new THREE.MeshLambertMaterial({ color: 0xfff2c8, emissive: 0xffdf6e, emissiveIntensity: 1.4 }),
  );
  lightTop.position.set(232, 23.5, -150);
  scene.add(lightTop);
  addCollider(232, -150, 3.4, 3.4);

  // Cranes over the industrial yards.
  const craneMat = new THREE.MeshLambertMaterial({ color: 0xd9a441 });
  for (const [x, z] of [[-150, -165], [-30, -165], [90, -165]]) {
    const mast = new THREE.Mesh(new THREE.BoxGeometry(1.6, 26, 1.6), craneMat);
    mast.position.set(x, 13, z);
    mast.castShadow = true;
    scene.add(mast);
    const jib = new THREE.Mesh(new THREE.BoxGeometry(20, 1.2, 1.2), craneMat);
    jib.position.set(x, 25, z);
    scene.add(jib);
    addCollider(x, z, 1, 1);
  }

  // Tessa's garage: a low workshop block with a forecourt.
  const garage = new THREE.Mesh(new THREE.BoxGeometry(20, 7, 14), new THREE.MeshLambertMaterial({ color: 0x7a8a96 }));
  garage.position.set(60, 3.5, 104);
  garage.castShadow = true;
  garage.receiveShadow = true;
  scene.add(garage);
  addCollider(60, 104, 10, 7);

  // A hazy ring of distant towers, so the horizon is a city, not a void.
  const farMat = new THREE.MeshLambertMaterial({ color: 0xa8b8c0 });
  for (let i = 0; i < 40; i += 1) {
    const angle = (i / 40) * Math.PI * 2;
    const radius = rng.range(380, 460);
    const h = rng.range(30, 90);
    const far = new THREE.Mesh(boxGeo, farMat);
    far.scale.set(rng.range(18, 34), h, rng.range(18, 34));
    far.position.set(Math.cos(angle) * radius, h / 2 - 2, Math.sin(angle) * radius);
    scene.add(far);
  }

  // Drifting clouds, unlit so they stay bright against the sky.
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
  for (let i = 0; i < 9; i += 1) {
    const cloud = new THREE.Group();
    for (let p = 0; p < 3; p += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(rng.range(4, 8), 10, 8), cloudMat);
      puff.scale.y = 0.45;
      puff.position.set(p * 6 - 6, rng.range(-1, 1), rng.range(-2, 2));
      cloud.add(puff);
    }
    cloud.position.set(rng.range(-320, 320), rng.range(70, 110), rng.range(-320, 320));
    scene.add(cloud);
    clouds.push(cloud);
  }

  return {
    colliders,
    parkingSpots,
    clouds,
    waterMesh,
    districtAt,
    // Circle-vs-box push-out: returns the corrected position.
    resolveCollision(x, z, radius) {
      let px = x;
      let pz = z;
      for (const box of colliders) {
        const cx = Math.max(box.minX, Math.min(px, box.maxX));
        const cz = Math.max(box.minZ, Math.min(pz, box.maxZ));
        const dx = px - cx;
        const dz = pz - cz;
        const distSq = dx * dx + dz * dz;
        if (distSq >= radius * radius) continue;
        if (distSq < 1e-6) {
          // Dead centre of a box: push out along the smallest penetration.
          const pushLeft = px - box.minX + radius;
          const pushRight = box.maxX - px + radius;
          const pushUp = pz - box.minZ + radius;
          const pushDown = box.maxZ - pz + radius;
          const min = Math.min(pushLeft, pushRight, pushUp, pushDown);
          if (min === pushLeft) px = box.minX - radius;
          else if (min === pushRight) px = box.maxX + radius;
          else if (min === pushUp) pz = box.minZ - radius;
          else pz = box.maxZ + radius;
        } else {
          const dist = Math.sqrt(distSq);
          px = cx + (dx / dist) * radius;
          pz = cz + (dz / dist) * radius;
        }
      }
      // The sea is not walkable or drivable; the beach is.
      if (px > WORLD.waterStart - radius) px = WORLD.waterStart - radius;
      px = Math.max(-WORLD.bound - 20, Math.min(WORLD.bound + 40, px));
      pz = Math.max(-WORLD.bound - 20, Math.min(WORLD.bound + 20, pz));
      return { x: px, z: pz };
    },
    isOnRoad(x, z) {
      return WORLD.roadLines.some((line) => Math.abs(x - line) < WORLD.roadHalf)
        || WORLD.roadLines.some((line) => Math.abs(z - line) < WORLD.roadHalf);
    },
  };
}
