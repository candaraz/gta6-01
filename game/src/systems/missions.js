// missions.js — the 8-mission MIRADOR KEYS story campaign: objectives, dialogue,
// GPS waypoints, cash & District Respect rewards, plus street races and stunt jumps.
import * as THREE from 'three';

export const MISSIONS = [
  {
    title: 'SUNSET BOOST', giver: 'ELENA',
    brief: 'Steal the crimson coupe on the Strip. The Keys respect a clean boost.',
    steps: [
      { type: 'goto', at: [-240, 40], text: 'Reach the crimson coupe on the Strip.' },
      { type: 'steal', text: 'Get in the coupe [F] and drive it to the chop shop.' },
      { type: 'goto', at: [60, -232], text: 'Deliver the coupe to the Barrio chop shop.' },
    ],
    reward: 1200, respect: 12,
  },
  {
    title: 'PIER 4 SMUGGLERS', giver: 'MATEO',
    brief: 'The smugglers at Pier 4 are moving product that belongs to the Keys. Take it.',
    steps: [
      { type: 'goto', at: [220, 60], text: 'Reach Pier 4 in Puerto Viejo.' },
      { type: 'combat', count: 3, text: 'Clear the smugglers on the pier (3).' },
      { type: 'goto', at: [-240, 120], text: 'Stash the goods at the Strip safehouse.' },
    ],
    reward: 2400, respect: 16,
  },
  {
    title: 'SOLARIS VAULT HEIST', giver: 'ELENA',
    brief: 'Solaris Bank keeps a vault full of dirty money. We take it at dusk, fast and loud.',
    steps: [
      { type: 'goto', at: [40, -40], text: 'Reach Solaris Bank plaza in Centro.' },
      { type: 'combat', count: 4, text: 'Hold the plaza against MKPD response (4).' },
      { type: 'goto', at: [180, 200], text: 'Escape to the Heights safehouse.' },
    ],
    reward: 5200, respect: 22,
  },
  {
    title: 'CAUSEWAY INTERCEPT', giver: 'MATEO',
    brief: 'A rival convoy is crossing the causeway. Intercept it before it reaches the Heights.',
    steps: [
      { type: 'goto', at: [300, 170], text: 'Reach the causeway bridge.' },
      { type: 'chase', text: 'Ram the convoy van off the road.' },
      { type: 'goto', at: [0, -240], text: 'Lose the heat in Barrio Neon.' },
    ],
    reward: 3800, respect: 18,
  },
  {
    title: 'NEON SYNDICATE AMBUSH', giver: 'ELENA',
    brief: 'The Syndicate set a trap in the Barrio. Walk in ready — and walk out louder.',
    steps: [
      { type: 'goto', at: [0, -240], text: 'Enter the Barrio Neon ambush zone.' },
      { type: 'combat', count: 5, text: 'Survive the Syndicate ambush (5).' },
      { type: 'goto', at: [-240, -120], text: 'Regroup at the Strip with Elena.' },
    ],
    reward: 4600, respect: 20,
  },
  {
    title: 'OSPREY DOWN', giver: 'MATEO',
    brief: 'OSPREY-1 has been hunting us all week. Time to ground it — permanently.',
    steps: [
      { type: 'goto', at: [200, 60], text: 'Reach the marina launch point.' },
      { type: 'combat', count: 4, text: 'Take out the OSPREY ground crew (4).' },
      { type: 'goto', at: [-240, 40], text: 'Vanish into the Strip crowd.' },
    ],
    reward: 6000, respect: 26,
  },
  {
    title: 'HARBOR EXTRACTION', giver: 'ELENA',
    brief: 'Elena is pinned at the harbor with the whole MKPD on her. Get her out by boat or by bullet.',
    steps: [
      { type: 'goto', at: [220, 60], text: 'Reach the harbor extraction point.' },
      { type: 'combat', count: 4, text: 'Clear the dockside officers (4).' },
      { type: 'goto', at: [180, 200], text: 'Extract Elena to the Heights.' },
    ],
    reward: 7400, respect: 28,
  },
  {
    title: 'CROWN OF MIRADOR', giver: 'MATEO',
    brief: 'One last job: the crown, the vault, the whole city watching. Take Mirador tonight.',
    steps: [
      { type: 'goto', at: [40, -40], text: 'Reach the Centro crown vault.' },
      { type: 'combat', count: 6, text: 'Hold the vault against everyone (6).' },
      { type: 'goto', at: [-240, 0], text: 'Drive the crown home down the Strip.' },
    ],
    reward: 12000, respect: 40,
  },
];

export const RESPECT_RANKS = [
  { at: 0, name: 'ROOKIE' },
  { at: 30, name: 'HUSTLER' },
  { at: 70, name: 'WHEELMAN' },
  { at: 130, name: 'KEYS ROYALTY' },
  { at: 200, name: 'CROWN OF MIRADOR' },
];

export class MissionSystem {
  constructor(scene) {
    this.scene = scene;
    this.index = 0;
    this.step = 0;
    this.completed = 0;
    this.cash = 0;
    this.respect = 0;
    this.killsThisStep = 0;
    this.active = false;
    this.onDialogue = null;
    this.onObjective = null;
    this.onReward = null;
    // golden beacon marker
    const beaconGeo = new THREE.CylinderGeometry(1.6, 1.6, 26, 16, 1, true);
    this.beaconMat = new THREE.MeshBasicMaterial({
      color: 0xffd24d, transparent: true, opacity: 0.45, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.beacon = new THREE.Mesh(beaconGeo, this.beaconMat);
    this.beacon.visible = false;
    scene.add(this.beacon);
    const ringGeo = new THREE.RingGeometry(2.2, 3.2, 32);
    this.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
      color: 0xffd24d, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false,
    }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    scene.add(this.ring);
    this.beaconTarget = null;
  }

  get current() { return MISSIONS[this.index]; }

  get respectRank() {
    let rank = RESPECT_RANKS[0].name;
    for (const r of RESPECT_RANKS) if (this.respect >= r.at) rank = r.name;
    return rank;
  }

  startMission(index = 0) {
    this.index = index;
    this.step = 0;
    this.killsThisStep = 0;
    this.active = true;
    const m = this.current;
    if (this.onDialogue) this.onDialogue(m.giver, m.brief);
    this.updateObjective();
  }

  updateObjective() {
    const m = this.current;
    if (!m) { this.active = false; return; }
    const s = m.steps[this.step];
    if (!s) { this.completeMission(); return; }
    if (this.onObjective) this.onObjective(m.title, s.text);
    if (s.type === 'goto' && s.at) {
      this.beaconTarget = new THREE.Vector3(s.at[0], 0, s.at[1]);
      this.beacon.position.set(s.at[0], 13, s.at[1]);
      this.beacon.visible = true;
      this.ring.position.set(s.at[0], 0.15, s.at[1]);
      this.ring.visible = true;
    } else {
      this.beacon.visible = false;
      this.ring.visible = false;
      this.beaconTarget = null;
    }
  }

  completeMission() {
    const m = this.current;
    this.cash += m.reward;
    this.respect += m.respect;
    this.completed++;
    if (this.onReward) this.onReward(m.title, m.reward, m.respect);
    this.index++;
    if (this.index >= MISSIONS.length) {
      this.active = false;
      if (this.onDialogue) this.onDialogue('MATEO', 'That’s the crown. Mirador is ours now — every key, every street, every sunset.');
      this.beacon.visible = false;
      this.ring.visible = false;
      return;
    }
    this.startMission(this.index);
  }

  notifyKill() {
    const m = this.current;
    if (!m || !this.active) return;
    const s = m.steps[this.step];
    if (s && s.type === 'combat') {
      this.killsThisStep++;
      if (this.onObjective) this.onObjective(m.title, `${s.text} — ${this.killsThisStep}/${s.count}`);
      if (this.killsThisStep >= s.count) {
        this.killsThisStep = 0;
        this.step++;
        this.updateObjective();
      }
    }
  }

  update(dt, playerPos, inVehicle, onStunt) {
    // beacon pulse
    if (this.beacon.visible) {
      this.beaconMat.opacity = 0.32 + Math.sin(performance.now() * 0.004) * 0.14;
      this.ring.scale.setScalar(1 + Math.sin(performance.now() * 0.003) * 0.12);
    }
    if (!this.active) return;
    const m = this.current;
    if (!m) return;
    const s = m.steps[this.step];
    if (!s) return;
    if (s.type === 'goto' && s.at) {
      const d = Math.hypot(playerPos.x - s.at[0], playerPos.z - s.at[1]);
      if (d < 9) {
        this.step++;
        this.updateObjective();
      }
    }
    if (s.type === 'steal' && inVehicle) {
      this.step++;
      this.updateObjective();
    }
    if (s.type === 'chase' && inVehicle) {
      // chase step completes when the player rams hard at speed near the bridge
      if (inVehicle.speed > 30 && Math.hypot(playerPos.x - 300, playerPos.z - 170) < 60) {
        this.step++;
        this.updateObjective();
      }
    }
  }
}
