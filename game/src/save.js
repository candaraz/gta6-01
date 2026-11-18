// Saving and loading: one JSON object in localStorage holding the player's
// position, money, story progress, unlocked weapons, owned cars, medallions
// and best trial times. Saving never throws — a full or blocked store just
// means the session is the save.

import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      savedAt: Date.now(),
      x: Math.round(state.x * 10) / 10,
      z: Math.round(state.z * 10) / 10,
      heading: state.heading,
      money: state.money,
      health: state.health,
      missionsDone: state.missionsDone,
      weapons: state.weapons,
      ammo: state.ammo,
      ownedCars: state.ownedCars,
      medallions: state.medallions,
      bestTimes: state.bestTimes,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear, or storage is unavailable.
  }
}
