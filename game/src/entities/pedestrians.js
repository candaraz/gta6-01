// pedestrians.js — 30+ sidewalk walkers with varied outfits, idle strolls and
// fleeing behavior when gunfire or sirens get close.
import * as THREE from 'three';
import { createHumanoidMesh } from './player.js';
import { ROAD_XS, ROAD_ZS } from '../world/cityBuilder.js';

const SHIRTS = [0xe8e0d0, 0xff8a5c, 0x19e3ff, 0xffd24d, 0x9dff7e, 0xc22a6e, 0x7a4fb5, 0x3a9e4f];
const PANTS = [0x2a2f38, 0x5a4a3a, 0x1c1f26, 0x3a3f4a, 0x6b4a1f];
const SKINS = [0xc98d64, 0xd9a37e, 0x8a5a3a, 0xe8b88a, 0x6b4423];

export class PedestrianSystem {
  constructor(scene, seed = 11) {
    this.scene = scene;
    this.peds = [];
    let s = seed * 104729 + 7;
    this.rng = () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
  }

  spawn(count = 34) {
    for (let i = 0; i < count; i++) {
      const mesh = createHumanoidMesh('mateo');
      // recolor outfit for variety
      const shirtColor = SHIRTS[Math.floor(this.rng() * SHIRTS.length)];
      const pantsColor = PANTS[Math.floor(this.rng() * PANTS.length)];
      const skinColor = SKINS[Math.floor(this.rng() * SKINS.length)];
      mesh.traverse((o) => {
        if (o.isMesh && o.material) {
          if (o.geometry && o.geometry.parameters && o.geometry.parameters.height === 0.72) {
            o.material = o.material.clone();
            o.material.color.setHex(shirtColor);
          }
        }
      });
      mesh.userData.torso.material = mesh.userData.torso.material.clone();
      mesh.userData.torso.material.color.setHex(shirtColor);
      mesh.userData.head.material = mesh.userData.head.material.clone();
      mesh.userData.head.material.color.setHex(skinColor);
      const scale = 0.92 + this.rng() * 0.16;
      mesh.scale.setScalar(scale);
      this.scene.add(mesh);
      const ped = {
        mesh,
        position: this.randomSidewalkPoint(),
        heading: this.rng() * Math.PI * 2,
        speed: 1.1 + this.rng() * 1.2,
        walkPhase: this.rng() * 10,
        fleeing: false,
        fleeTimer: 0,
        target: null,
      };
      ped.mesh.position.copy(ped.position);
      this.peds.push(ped);
    }
  }

  randomSidewalkPoint() {
    const horizontal = this.rng() < 0.5;
    if (horizontal) {
      const z = ROAD_ZS[Math.floor(this.rng() * ROAD_ZS.length)] + (this.rng() < 0.5 ? -10.5 : 10.5);
      return new THREE.Vector3(-240 + this.rng() * 480, 0, z);
    }
    const x = ROAD_XS[Math.floor(this.rng() * ROAD_XS.length)] + (this.rng() < 0.5 ? -10.5 : 10.5);
    return new THREE.Vector3(x, 0, -240 + this.rng() * 480);
  }

  triggerFlee(at, radius = 60) {
    for (const ped of this.peds) {
      if (ped.position.distanceTo(at) < radius) {
        ped.fleeing = true;
        ped.fleeTimer = 4 + this.rng() * 3;
        const away = new THREE.Vector3().subVectors(ped.position, at).setY(0).normalize();
        ped.heading = Math.atan2(away.x, away.z);
      }
    }
  }

  update(dt) {
    for (const ped of this.peds) {
      if (ped.fleeing) {
        ped.fleeTimer -= dt;
        if (ped.fleeTimer <= 0) ped.fleeing = false;
      }
      const speed = ped.fleeing ? ped.speed * 3.4 : ped.speed;
      const forward = new THREE.Vector3(Math.sin(ped.heading), 0, Math.cos(ped.heading));
      ped.position.addScaledVector(forward, speed * dt);
      // wander: gentle heading drift, bounce off the city edge
      ped.heading += (this.rng() - 0.5) * dt * 0.6;
      if (Math.abs(ped.position.x) > 250 || Math.abs(ped.position.z) > 250) {
        ped.heading += Math.PI;
        ped.position.x = THREE.MathUtils.clamp(ped.position.x, -248, 248);
        ped.position.z = THREE.MathUtils.clamp(ped.position.z, -248, 248);
      }
      ped.mesh.position.copy(ped.position);
      ped.mesh.rotation.y = ped.heading;
      ped.walkPhase += dt * speed * 2.2;
      const swing = Math.sin(ped.walkPhase) * 0.55;
      const { arms, legs } = ped.mesh.userData;
      legs[0].rotation.x = swing;
      legs[1].rotation.x = -swing;
      arms[0].rotation.x = -swing * 0.7;
      arms[1].rotation.x = swing * 0.7;
    }
  }
}
