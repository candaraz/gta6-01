// Solmar Bay — save and load.
// One job: persist the player's progress to localStorage and restore it, so
// Continue actually resumes the game. The save is a plain JSON object; loading
// it never throws (a corrupt save is ignored and a fresh game starts).

import { SAVE_KEY, SETTINGS_KEY } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      version: 2,
      savedAt: Date.now(),
      cash: state.cash,
      respect: state.respect,
      missionIndex: state.missionIndex,
      missionsDone: state.missionsDone,
      weapons: state.weapons,
      ammo: state.ammo,
      mag: state.mag,
      owned: state.owned,
      upgrades: state.upgrades,
      safehouses: state.safehouses,
      radio: state.radio,
      player: { x: state.playerX, z: state.playerZ, health: state.health, armour: state.armour },
      car: state.car ? { cls: state.car.cls, x: state.car.x, z: state.car.z, heading: state.car.heading, hp: state.car.hp } : null,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 2) return null;
    return data;
  } catch { return null; }
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

export function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
