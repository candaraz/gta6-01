// save.js — Solmar Bay v3: save + Continue.
// One job: write the player's progress to localStorage and read it back.
// The title screen offers Continue when a save exists.

const KEY = 'solmarbay-v3-save';

export function createSave(G) {
  function write() {
    const p = G.player.p;
    const data = {
      v: 3, cash: p.cash, respect: p.respect, health: p.health,
      mission: G.missions.current, x: p.x, z: p.z,
      weapon: p.weapon,
      weapons: Object.fromEntries(Object.entries(p.weapons).map(([k, w]) => [k, w.owned ? 1 : 0])),
      garageLevel: p.garageLevel, coins: p.coins,
      coinsTaken: G.garage.coins.filter((c) => c.taken).map((c) => c.slot),
      savedAt: Date.now(),
    };
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; }
    catch (e) { return false; }
  }
  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (!d || d.v !== 3) return null;
      return d;
    } catch (e) { return null; }
  }
  function apply(d) {
    const p = G.player.p;
    p.cash = d.cash; p.respect = d.respect; p.health = d.health;
    p.x = d.x; p.z = d.z; p.y = 0; p.heading = Math.PI;
    p.weapon = d.weapon || 'pistol';
    p.garageLevel = d.garageLevel || 0;
    p.coins = d.coins || 0;
    for (const [k, v] of Object.entries(d.weapons || {})) {
      if (v) G.player.giveWeapon(k);
    }
    for (const slot of d.coinsTaken || []) {
      const c = G.garage.coins[slot];
      if (c) c.taken = true;
    }
    G.missions.setCurrent(Math.min(9, d.mission || 0));
  }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) {} }
  return { write, read, apply, clear };
}
