// garage.js — the three interactable spots: Sol's Garage (vehicle
// upgrades), Ivy's Arms (weapons and ammo) and the safehouses (save,
// heal, lose the heat). Menus are DOM overlays; E opens, Esc closes.
import { UPGRADES, WEAPONS } from './config.js';
import { dist } from './random.js';

export class Garage {
  constructor() {
    this.open = null; // 'garage' | 'gunshop' | 'safehouse'
    this.overlay = null;
    this._buildOverlay();
  }

  _buildOverlay() {
    const el = document.createElement('div');
    el.id = 'shop-overlay';
    el.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:420px;max-width:90vw;background:rgba(10,14,20,.92);border:2px solid #f2c200;color:#eee;font-family:system-ui,sans-serif;padding:18px 22px;border-radius:10px;display:none;z-index:30;';
    document.getElementById('game-root').appendChild(el);
    this.overlay = el;
  }

  // What interactable is the player near? Checks garage, gun shop, safehouses.
  nearby(player, city) {
    const spots = [
      { type: 'garage', x: city.landmarks.garage.x, z: city.landmarks.garage.z, r: 14, label: "Sol's Garage — upgrades (E)" },
      { type: 'gunshop', x: city.landmarks.gunshop.x, z: city.landmarks.gunshop.z, r: 12, label: "Ivy's Arms — guns & ammo (E)" },
    ];
    for (const s of city.landmarks.safehouses) {
      spots.push({ type: 'safehouse', x: s.x, z: s.z, r: 12, label: `${s.label} — save & rest (E)` });
    }
    for (const s of spots) {
      if (dist(player.x, player.z, s.x, s.z) < s.r) return s;
    }
    return null;
  }

  openMenu(type, ctx) {
    this.open = type;
    const o = this.overlay;
    o.style.display = 'block';
    if (type === 'garage') this._renderGarage(ctx);
    else if (type === 'gunshop') this._renderGunshop(ctx);
    else if (type === 'safehouse') this._renderSafehouse(ctx);
  }

  close() {
    this.open = null;
    this.overlay.style.display = 'none';
  }

  isOpen() {
    return this.open !== null;
  }

  // Auto-close if the player walks away from the spot.
  closeIfFar(player, city) {
    if (!this.open) return;
    const spot = this.nearby(player, city);
    if (!spot || spot.type !== this.open) this.close();
  }

  _row(label, price, canAfford, onBuy, owned) {
    const b = document.createElement('button');
    b.textContent = owned ? `${label} — OWNED` : `${label} — $${price}`;
    b.disabled = owned || !canAfford;
    b.style.cssText = 'display:block;width:100%;margin:6px 0;padding:10px;background:#223;color:#fff;border:1px solid #557;border-radius:6px;cursor:pointer;font-size:15px;';
    if (!b.disabled) b.onclick = onBuy;
    return b;
  }

  _renderGarage(ctx) {
    const o = this.overlay;
    o.innerHTML = `<h2 style="margin:0 0 4px">Sol's Garage</h2><p style="margin:0 0 10px;color:#aaa">Cash: $${ctx.cash} · Upgrades apply to your owned cars.</p>`;
    for (const key of ['engine', 'armour', 'brakes']) {
      const up = UPGRADES[key];
      const lvl = ctx.upgrades[key];
      const next = lvl + 1;
      const owned = next >= up.levels.length;
      const price = owned ? 0 : up.levels[next];
      o.appendChild(this._row(`${up.name} Lv${next}`, price, ctx.cash >= price, () => {
        ctx.onSpend(price);
        ctx.upgrades[key] = next;
        for (const v of ctx.vehicles) if (v.owned) { v.upgrades[key] = next; v.topSpeed = v.def.speed * (1 + [0, 0.12, 0.25][ctx.upgrades.engine]); v.brakePower = v.def.brake * (1 + [0, 0.2, 0.45][ctx.upgrades.brakes]); }
        ctx.onMessage(`${up.name} upgraded to Lv${next}.`);
        this._renderGarage(ctx);
      }, owned));
    }
    this._closeRow(o, 'Close (Esc)');
  }

  _renderGunshop(ctx) {
    const o = this.overlay;
    o.innerHTML = `<h2 style="margin:0 0 4px">Ivy's Arms</h2><p style="margin:0 0 10px;color:#aaa">Cash: $${ctx.cash} · Press 1-4 to switch weapons, R to reload.</p>`;
    for (const key of ['smg', 'shotgun', 'rifle']) {
      const w = WEAPONS[key];
      const owned = ctx.combat.owned[key];
      o.appendChild(this._row(`${w.name} (${w.damage} dmg)`, w.price, ctx.cash >= w.price, () => {
        ctx.onSpend(w.price);
        ctx.combat.giveWeapon(key, w.mag * 2);
        ctx.onMessage(`Bought the ${w.name}.`);
        this._renderGunshop(ctx);
      }, owned));
      if (owned) {
        o.appendChild(this._row(`${w.name} ammo ×60`, w.ammoPrice, ctx.cash >= w.ammoPrice, () => {
          ctx.onSpend(w.ammoPrice);
          ctx.combat.ammo[key] += 60;
          ctx.onMessage(`+60 ${w.name} ammo.`);
          this._renderGunshop(ctx);
        }, false));
      }
    }
    this._closeRow(o, 'Close (Esc)');
  }

  _renderSafehouse(ctx) {
    const o = this.overlay;
    o.innerHTML = `<h2 style="margin:0 0 4px">Safehouse</h2><p style="margin:0 0 10px;color:#aaa">Catch your breath. The heat dies down here.</p>`;
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save game';
    saveBtn.style.cssText = 'display:block;width:100%;margin:6px 0;padding:10px;background:#253;color:#fff;border:1px solid #575;border-radius:6px;cursor:pointer;font-size:15px;';
    saveBtn.onclick = () => { ctx.onSave(); ctx.onMessage('Game saved.'); this.close(); };
    o.appendChild(saveBtn);
    const restBtn = document.createElement('button');
    restBtn.textContent = 'Rest (heal + lose wanted)';
    restBtn.style.cssText = 'display:block;width:100%;margin:6px 0;padding:10px;background:#223;color:#fff;border:1px solid #557;border-radius:6px;cursor:pointer;font-size:15px;';
    restBtn.onclick = () => {
      ctx.player.heal(100);
      ctx.police.clear();
      ctx.onSave();
      ctx.onMessage('Rested. Health full, heat gone, game saved.');
      this.close();
    };
    o.appendChild(restBtn);
    this._closeRow(o, 'Close (Esc)');
  }

  _closeRow(o, label) {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'display:block;width:100%;margin:12px 0 0;padding:10px;background:#444;color:#fff;border:1px solid #777;border-radius:6px;cursor:pointer;font-size:15px;';
    b.onclick = () => this.close();
    o.appendChild(b);
  }
}
