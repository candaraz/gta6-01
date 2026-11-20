// save.js — save / load through localStorage. A save holds the money,
// respect, mission progress, weapons, upgrades, collected coins and the
// player's position, so Continue resumes exactly where the player left.
import { SAVE_KEY } from './config.js';

export function hasSave() {
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch (_) {
    return false;
  }
}

export function saveGame(G) {
  const data = {
    version: 2,
    cash: G.cash,
    respect: G.respect,
    nextMission: G.missions.nextIndex,
    completed: G.missions.completed,
    owned: G.combat.owned,
    ammo: G.combat.ammo,
    upgrades: G.upgrades,
    station: G.audio.station,
    volume: G.audio.volume,
    coinsTaken: G.city.coins.map((c) => c.taken),
    player: {
      x: G.player.x, z: G.player.z,
      heading: G.player.heading,
      health: G.player.health,
      inVehicle: !!G.player.inVehicle,
      vehicleCls: G.player.inVehicle ? G.player.inVehicle.cls : null,
      vehicleX: G.player.inVehicle ? G.player.inVehicle.x : null,
      vehicleZ: G.player.inVehicle ? G.player.inVehicle.z : null,
      vehicleHeading: G.player.inVehicle ? G.player.inVehicle.heading : null,
    },
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (_) {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 2) return null;
    return data;
  } catch (_) {
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
}

// One line for the Continue button: cash, respect and mission progress.
export function saveSummary() {
  const s = loadSave();
  if (!s) return null;
  return `$${s.cash.toLocaleString('en-US')} · ${s.completed}/10 missions · respect ${s.respect}`;
}
