// Solmar Bay — garage, shops, safehouses and respect.
// One job: the progression economy. The garage stores owned cars and sells
// upgrades; the gun shop sells weapons and ammo; safehouses heal and save;
// respect ranks gate what the player can buy and which missions open.

import { UPGRADES, WEAPONS, SAFEHOUSES, GUN_SHOP, RESPECT_RANKS } from './config.js';

export function respectRank(respect) {
  let rank = RESPECT_RANKS[0];
  for (const r of RESPECT_RANKS) if (respect >= r.at) rank = r;
  return rank.name;
}

export class Garage {
  constructor(game) {
    this.game = game;
    this.owned = []; // {cls, colour, upgrades:{engine,armour,nitro,paint}}
    this.upgrades = {}; // car index -> {engine:0, armour:0, nitro:0}
  }

  storeCar(car) {
    if (this.owned.length >= 6) return false;
    this.owned.push({ cls: car.cls, colour: car.mesh.userData.paint ?? null, upgrades: { engine: 0, armour: 0, nitro: 0 } });
    return true;
  }

  buyUpgrade(carIndex, kind) {
    const g = this.game;
    const car = this.owned[carIndex];
    if (!car) return false;
    const def = UPGRADES[kind];
    const lvl = car.upgrades[kind] ?? 0;
    if (lvl >= def.levels) return false;
    const cost = def.cost[lvl];
    if (g.cash < cost) return false;
    g.addCash(-cost);
    car.upgrades[kind] = lvl + 1;
    return true;
  }

  // Apply owned-car upgrades to a live Vehicle.
  applyUpgrades(vehicle, carIndex) {
    const car = this.owned[carIndex];
    if (!car) return;
    const u = car.upgrades;
    vehicle.def = { ...vehicle.def };
    if (u.engine) {
      vehicle.def.topSpeed *= 1 + 0.18 * u.engine;
      vehicle.def.accel *= 1 + 0.2 * u.engine;
    }
    if (u.armour) {
      vehicle.maxHp *= 1 + 0.5 * u.armour;
      vehicle.hp = vehicle.maxHp;
    }
    if (u.nitro) vehicle.nitro = 8 * u.nitro;
  }

  buyWeapon(id) {
    const g = this.game;
    const w = WEAPONS[id];
    if (!w || g.cash < w.price) return false;
    if (g.combat.hasWeapon(id)) return false; // already owned; buy ammo instead
    g.addCash(-w.price);
    g.combat.giveWeapon(id, w.mag);
    return true;
  }
  buyAmmo(id, count = 1) {
    const g = this.game;
    const w = WEAPONS[id];
    if (!w || g.cash < w.ammoPrice * count) return false;
    g.addCash(-w.ammoPrice * count);
    g.combat.ammo[id] = (g.combat.ammo[id] ?? 0) + w.mag * count;
    return true;
  }

  nearestSafehouse(x, z) {
    let best = null, bd = 14;
    for (const s of SAFEHOUSES) {
      const d = Math.hypot(x - s.x, z - s.z);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }
  nearestGunShop(x, z) {
    const d = Math.hypot(x - GUN_SHOP.x, z - GUN_SHOP.z);
    return d < 12 ? GUN_SHOP : null;
  }
  isAtGarage(x, z) {
    return Math.hypot(x - SAFEHOUSES[0].x, z - SAFEHOUSES[0].z) < 14;
  }
}
