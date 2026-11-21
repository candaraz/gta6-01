// Save / load to localStorage: cash, respect, story progress, weapons,
// coins, garage level, position and vehicle.
const KEY = 'solmar-bay-save-v3';

export function createSave(G) {
  const S = {
    hasSave() {
      try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
    },
    saveGame() {
      const P = G.player;
      const data = {
        cash: G.cash, respect: G.respect,
        mission: G.missions.index,
        x: P.x, z: P.z, heading: P.heading,
        health: P.health,
        weapons: Object.keys(G.combat.owned).filter((k) => G.combat.owned[k]),
        mag: G.combat.mag, reserve: G.combat.reserve,
        coins: G.activities.coins,
        coinsFound: G.activities.coinMeshes.filter((c) => c.taken).map((c) => c.i),
        engineLevel: G.activities.engineLevel,
        station: G.audio.station,
      };
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* private mode */ }
    },
    loadGame() {
      let data = null;
      try { data = JSON.parse(localStorage.getItem(KEY)); } catch (e) { return false; }
      if (!data) return false;
      G.cash = data.cash; G.respect = data.respect;
      G.player.x = data.x; G.player.z = data.z; G.player.heading = data.heading || 0;
      G.player.health = data.health || 100;
      G.player.mesh.position.set(data.x, 0, data.z);
      for (const k of data.weapons || []) G.combat.give(k, 0);
      G.combat.mag = Object.assign(G.combat.mag, data.mag || {});
      G.combat.reserve = Object.assign(G.combat.reserve, data.reserve || {});
      G.activities.engineLevel = data.engineLevel || 0;
      if (typeof data.station === 'number') G.audio.setStation(data.station);
      for (const i of data.coinsFound || []) {
        const c = G.activities.coinMeshes[i];
        if (c) { c.taken = true; c.mesh.visible = false; G.activities.coins++; }
      }
      // Index 10 is the completed campaign (no active mission);
      // startMission handles it by showing the Bay King state, so
      // clamp to 10, not 9 — clamping to 9 would resurrect m10.
      G.missions.startMission(Math.min(data.mission || 0, 10));
      G.cameraRig.snapBehind(G.player.heading);
      return true;
    },
    clear() { try { localStorage.removeItem(KEY); } catch (e) {} },
  };
  G.save = S;
  return S;
}
