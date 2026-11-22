// saveSystem.js — 3-slot localStorage persistence for MIRADOR KEYS:
// mission progress, cash, respect rank, garage upgrades, timestamps.
const SAVE_KEY = 'mirador-keys-saves-v1';

export const GARAGE_UPGRADES = [
  { id: 'armor', name: 'ARMOR PLATING', cost: 1500, desc: '+50 vehicle health' },
  { id: 'turbo', name: 'TURBO KIT', cost: 2200, desc: '+18% top speed' },
  { id: 'respray', name: 'SUNSET RESPRAY', cost: 800, desc: 'Crimson-gold paint job' },
];

export class SaveSystem {
  constructor() {
    this.slots = this.loadAll();
  }

  loadAll() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return [null, null, null];
      const parsed = JSON.parse(raw);
      return [parsed[0] || null, parsed[1] || null, parsed[2] || null];
    } catch (e) {
      return [null, null, null];
    }
  }

  persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.slots));
    } catch (e) { /* storage unavailable — play on without saving */ }
  }

  save(slot, state) {
    const record = {
      mission: state.missionIndex,
      missionsDone: state.missionsDone,
      cash: state.cash,
      respect: state.respect,
      rank: state.rank,
      character: state.character,
      upgrades: state.upgrades || [],
      savedAt: new Date().toISOString(),
    };
    this.slots[slot] = record;
    this.persist();
    return record;
  }

  load(slot) {
    return this.slots[slot] || null;
  }

  hasSave(slot) {
    return !!this.slots[slot];
  }

  formatSlot(slot) {
    const s = this.slots[slot];
    if (!s) return null;
    const date = new Date(s.savedAt);
    const when = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    return {
      mission: `MISSION ${Math.min(s.mission + 1, 8)} / 8 — ${s.missionsDone} DONE`,
      cash: `$${s.cash.toLocaleString()}`,
      rank: s.rank,
      when,
    };
  }
}
