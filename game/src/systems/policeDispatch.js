// policeDispatch.js — the 5-star MKPD tactical dispatch: patrol cruisers, aggressive
// interceptors (PIT/RAM), roadblocks, tactical vans, and OSPREY-1, the helicopter
// with a sweeping searchlight cone, plus the live dispatch radio ticker.
import * as THREE from 'three';
import { createCarMesh, Vehicle } from '../entities/vehicles.js';

const TICKER_LINES = [
  'MKPD DISPATCH — All units, stand by.',
  'DISPATCH — Suspect vehicle reported on the Strip, crimson coupe.',
  'DISPATCH — Unit 12 in pursuit, requesting backup on the avenue.',
  'DISPATCH — Interceptors rolling, PIT authorized at 2 stars.',
  'DISPATCH — Roadblock forming at the causeway, spike strips ready.',
  'DISPATCH — Tactical vans deploying, armed officers on foot.',
  'DISPATCH — OSPREY-1 airborne, spotlight on the suspect.',
  'DISPATCH — Suspect breaking line of sight, maintain the cordon.',
  'DISPATCH — All units, suspect still at large. Stay sharp, Keys.',
];

export class PoliceDispatch {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.wanted = 0;
    this.units = [];
    this.roadblocks = [];
    this.helicopter = null;
    this.cooldown = 0;
    this.tickerTimer = 0;
    this.tickerIndex = 0;
    this.onTicker = null;
    this.onWantedChange = null;
    this.spawnTimer = 0;
    this.elenaDistraction = 0;
    this.staging = false; // staged screenshot: units hold position, lightbars still flash
  }

  setWanted(level, silent = false) {
    const prev = this.wanted;
    this.wanted = THREE.MathUtils.clamp(level, 0, 5);
    if (this.wanted !== prev && this.onWantedChange) this.onWantedChange(this.wanted);
    if (this.wanted === 0) this.clearUnits();
    if (this.wanted >= 5 && !this.helicopter) this.spawnHelicopter();
    if (this.wanted < 5 && this.helicopter) this.removeHelicopter();
    if (!silent) this.cooldown = 0;
  }

  addHeat(amount) {
    this.setWanted(this.wanted + amount);
  }

  clearUnits() {
    for (const u of this.units) this.scene.remove(u.mesh);
    this.units.length = 0;
    for (const rb of this.roadblocks) this.scene.remove(rb);
    this.roadblocks.length = 0;
    this.removeHelicopter();
  }

  spawnUnit(type, position) {
    const mesh = createCarMesh(type);
    this.scene.add(mesh);
    const v = new Vehicle(mesh, position, 0);
    v.police = true;
    v.ramTimer = 0;
    this.units.push(v);
    return v;
  }

  spawnHelicopter() {
    const g = new THREE.Group();
    // the airframe is scaled 1.5x (imposing tactical air unit) but the
    // searchlight cone + spot stay unscaled: their local offsets are computed
    // from the heli's height, and a group scale would bury the spot pool.
    const bodyG = new THREE.Group();
    bodyG.scale.setScalar(1.5);
    g.add(bodyG);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.4, metalness: 0.6 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 7.5), bodyMat);
    body.castShadow = true;
    bodyG.add(body);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x0e2233, roughness: 0.15, metalness: 0.9 }));
    nose.position.set(0, -0.2, 3.6);
    bodyG.add(nose);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 6), bodyMat);
    tail.position.set(0, 0.4, -6.4);
    bodyG.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.2, 1.4), bodyMat);
    fin.position.set(0, 1.2, -9);
    bodyG.add(fin);
    // main rotor
    const rotor = new THREE.Group();
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.5, metalness: 0.7 });
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 7.5), bladeMat);
      blade.rotation.y = (i / 4) * Math.PI;
      rotor.add(blade);
    }
    rotor.position.y = 1.6;
    bodyG.add(rotor);
    // searchlight cone (translucent, additive) — narrow, aimed down at the street
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(4.2, 34, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.13, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    cone.position.y = -17;
    g.add(cone);
    const spot = new THREE.Mesh(
      new THREE.CircleGeometry(4.2, 20),
      new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    spot.rotation.x = -Math.PI / 2;
    spot.position.y = -33.5;
    g.add(spot);
    this.scene.add(g);
    this.helicopter = { group: g, rotor, cone, spot, angle: 0, height: 46 };
  }

  removeHelicopter() {
    if (!this.helicopter) return;
    this.scene.remove(this.helicopter.group);
    this.helicopter = null;
  }

  spawnRoadblock(at, heading) {
    const group = new THREE.Group();
    for (const sx of [-4, 0, 4]) {
      const cruiser = createCarMesh('cruiser');
      cruiser.position.set(sx, 0, 0);
      cruiser.rotation.y = Math.PI / 2;
      group.add(cruiser);
    }
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0xff8a1e, roughness: 0.6 });
    for (const sx of [-7, 7]) {
      const barrier = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 0.6), barrierMat);
      barrier.position.set(sx, 0.55, 0);
      group.add(barrier);
    }
    group.position.copy(at);
    group.rotation.y = heading;
    this.scene.add(group);
    this.roadblocks.push(group);
  }

  callElena() {
    this.elenaDistraction = 12;
    this.pushTicker('ELENA — “Copy that. I’ll pull two units off you — go dark, Mateo.”');
    // half the units peel away to chase the decoy
    for (let i = 0; i < Math.ceil(this.units.length / 2); i++) {
      const u = this.units[this.units.length - 1 - i];
      if (u) u.distracted = 10;
    }
  }

  pushTicker(text) {
    if (this.onTicker) this.onTicker(text);
  }

  update(dt, playerPos, playerVehicle, onBusted) {
    this.tickerTimer += dt;
    if (this.tickerTimer > 7) {
      this.tickerTimer = 0;
      const line = TICKER_LINES[Math.min(this.wanted, TICKER_LINES.length - 1)];
      if (this.wanted > 0 || Math.random() < 0.4) this.pushTicker(line);
    }
    if (this.elenaDistraction > 0) this.elenaDistraction -= dt;

    if (this.wanted === 0) return;
    this.spawnTimer -= dt;
    const maxUnits = Math.min(1 + this.wanted, 6);
    if (!this.staging && this.units.length < maxUnits && this.spawnTimer <= 0) {
      this.spawnTimer = 2.2;
      const angle = Math.random() * Math.PI * 2;
      const pos = playerPos.clone().add(new THREE.Vector3(Math.sin(angle) * 70, 0, Math.cos(angle) * 70));
      pos.x = THREE.MathUtils.clamp(pos.x, -240, 240);
      pos.z = THREE.MathUtils.clamp(pos.z, -240, 240);
      const type = this.wanted >= 2 ? 'interceptor' : 'cruiser';
      this.spawnUnit(type, pos);
      if (this.wanted >= 3 && this.roadblocks.length < 1 && Math.random() < 0.5) {
        const ahead = playerPos.clone().add(new THREE.Vector3(Math.sin(0.6) * 55, 0, Math.cos(0.6) * 55));
        this.spawnRoadblock(ahead, 0.6);
      }
    }

    const target = playerVehicle ? playerVehicle.position : playerPos;
    for (const u of this.units) {
      if (this.staging) { u.update(dt, null, this.world); continue; }
      if (u.distracted > 0) {
        u.distracted -= dt;
        // peel away: drive off in a random direction
        u.update(dt, { forward: true, back: false, left: false, right: false, handbrake: false }, this.world);
        continue;
      }
      const toTarget = new THREE.Vector3().subVectors(target, u.position);
      const dist = toTarget.length();
      const desired = Math.atan2(toTarget.x, toTarget.z);
      let d = desired - u.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const steer = THREE.MathUtils.clamp(d * 2, -1, 1);
      const ram = this.wanted >= 2 && dist < 14;
      u.update(dt, {
        forward: dist > 7,
        back: false,
        left: steer > 0.15,
        right: steer < -0.15,
        handbrake: ram,
      }, this.world);
      // PIT / RAM contact
      if (dist < 4.2 && playerVehicle) {
        playerVehicle.damage(6 * dt * 10);
        if (playerVehicle.health <= 0) {
          this.pushTicker('DISPATCH — Suspect vehicle disabled. Move in, move in.');
        }
      }
      // busted: on foot and a unit is right on top of the player, stopped
      if (!playerVehicle && dist < 3.4 && u.speed < 2 && onBusted) {
        u.bustTimer = (u.bustTimer || 0) + dt;
        if (u.bustTimer > 2.2) onBusted();
      } else {
        u.bustTimer = 0;
      }
    }

    // wanted cooldown: break line of sight long enough and heat fades
    if (!this.staging && this.wanted > 0) {
      const nearest = this.units.length ? Math.min(...this.units.map((u) => u.position.distanceTo(playerPos))) : 999;
      if (nearest > 95 || this.units.length === 0) {
        this.cooldown += dt;
        if (this.cooldown > 14) {
          this.cooldown = 0;
          this.setWanted(this.wanted - 1);
          this.pushTicker('DISPATCH — Lost visual on the suspect. Heat dropping.');
        }
      } else {
        this.cooldown = Math.max(0, this.cooldown - dt * 2);
      }
    }

    // OSPREY-1: circle the player, sweep the searchlight
    if (this.helicopter) {
      const h = this.helicopter;
      h.angle += dt * 0.35;
      const radius = 26;
      const hx = playerPos.x + Math.sin(h.angle) * radius;
      const hz = playerPos.z + Math.cos(h.angle) * radius;
      h.group.position.set(hx, h.height + Math.sin(this.elenaDistraction * 2) * 0, hz);
      h.group.rotation.y = Math.atan2(playerPos.x - hx, playerPos.z - hz);
      h.rotor.rotation.y += dt * 28;
      // searchlight tracks the player with a sweep wobble — computed in the
      // heli's local space (group only rotates around Y, so invert that yaw).
      const wob = Math.sin(performance.now() * 0.0012) * 4;
      const target = new THREE.Vector3(playerPos.x + wob, 0, playerPos.z);
      const dirWorld = new THREE.Vector3().subVectors(target, h.group.position).normalize();
      const dirLocal = dirWorld.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -h.group.rotation.y);
      // cone axis is Y (apex up at the heli, base down at the ground): aim -Y at the target
      h.cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dirLocal);
      // spot circle sits on the ground under the beam, in local space
      const toTarget = new THREE.Vector3().subVectors(target, h.group.position);
      const localSpot = toTarget.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -h.group.rotation.y);
      localSpot.y = -h.height + 1.2;
      h.spot.position.copy(localSpot);
    }
  }
}
