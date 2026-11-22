// hudMinimap.js — the HUD: wanted stars, vitals, cash, speedometer, live circular
// radar minimap (roads, water, GPS route, police blips), weapon wheel, mission
// banner, dispatch ticker, dialogue bar, title screen and the City Atlas.
import { ROAD_XS, ROAD_ZS, DISTRICTS } from '../world/cityBuilder.js';

export class Hud {
  constructor() {
    this.el = (id) => document.getElementById(id);
    this.starsEl = this.el('stars');
    this.cashEl = this.el('cash');
    this.respectEl = this.el('respect-rank');
    this.radioEl = this.el('radio-name');
    this.missionTitleEl = this.el('mission-title');
    this.objectiveEl = this.el('objective');
    this.dialogueEl = this.el('dialogue');
    this.dialogueNameEl = this.el('dialogue-name');
    this.dialogueTextEl = this.el('dialogue-text');
    this.healthEl = this.el('health-fill');
    this.armorEl = this.el('armor-fill');
    this.weaponEl = this.el('weapon-name');
    this.ammoEl = this.el('ammo');
    this.speedEl = this.el('speed');
    this.promptEl = this.el('prompt');
    this.toastEl = this.el('toast');
    this.tickerEl = this.el('dispatch-text');
    this.minimap = this.el('minimap');
    this.mapCtx = this.minimap.getContext('2d');
    this.stuntEl = this.el('stunt-popup');
    this.stuntTitleEl = this.el('stunt-title');
    this.stuntSubEl = this.el('stunt-sub');
    this.dialogueTimer = null;
    this.toastTimer = null;
  }

  showHud() { this.el('hud').classList.remove('hidden'); }
  hideHud() { this.el('hud').classList.add('hidden'); }

  setStars(n) {
    let html = '';
    for (let i = 0; i < 5; i++) {
      const cls = i < n ? (n >= 4 ? 'star hot' : 'star') : 'star off';
      html += `<span class="${cls}">★</span>`;
    }
    this.starsEl.innerHTML = html;
  }

  setCash(v) { this.cashEl.textContent = v.toLocaleString(); }
  setRespect(rank) { this.respectEl.textContent = rank; }
  setRadio(name) { this.radioEl.textContent = name; }
  setMission(title, objective) {
    this.missionTitleEl.textContent = title;
    this.objectiveEl.textContent = objective;
  }
  setVitals(health, armor) {
    this.healthEl.style.width = `${Math.max(0, health)}%`;
    this.armorEl.style.width = `${Math.max(0, armor)}%`;
  }
  setWeapon(name, ammoText) {
    this.weaponEl.textContent = name;
    this.ammoEl.textContent = ammoText;
  }
  setSpeed(mph) { this.speedEl.textContent = Math.round(mph); }
  setPrompt(text) {
    if (!text) { this.promptEl.classList.add('hidden'); return; }
    this.promptEl.textContent = text;
    this.promptEl.classList.remove('hidden');
  }
  setTicker(text) { this.tickerEl.textContent = text; }

  showDialogue(name, text, ms = 5200) {
    this.dialogueNameEl.textContent = name;
    this.dialogueTextEl.textContent = text;
    this.dialogueEl.classList.remove('hidden');
    if (this.dialogueTimer) clearTimeout(this.dialogueTimer);
    this.dialogueTimer = setTimeout(() => this.dialogueEl.classList.add('hidden'), ms);
  }

  showToast(text, ms = 2600) {
    this.toastEl.textContent = text;
    this.toastEl.classList.remove('hidden');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.add('hidden'), ms);
  }

  showStunt(title, sub, ms = 2200) {
    this.stuntTitleEl.textContent = title;
    this.stuntSubEl.textContent = sub;
    this.stuntEl.classList.remove('hidden');
    setTimeout(() => this.stuntEl.classList.add('hidden'), ms);
  }

  setWheelVisible(visible, activeIndex) {
    const wheel = this.el('weapon-wheel');
    wheel.classList.toggle('hidden', !visible);
    if (visible) {
      wheel.querySelectorAll('.wheel-slot').forEach((slot) => {
        slot.classList.toggle('active', Number(slot.dataset.weapon) === activeIndex);
      });
    }
  }

  // ---- Minimap: circular radar, roads, water, GPS route, blips ----
  drawMinimap(playerPos, playerHeading, police, waypoint, enemies, traffic) {
    const ctx = this.mapCtx;
    const S = 220;
    const C = S / 2;
    const scale = S / 620; // world units -> map px
    const toMap = (x, z) => [C + (x - playerPos.x) * scale, C + (z - playerPos.z) * scale];
    ctx.clearRect(0, 0, S, S);
    // clip to circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(C, C, C - 2, 0, Math.PI * 2);
    ctx.clip();
    // water background
    ctx.fillStyle = '#0e4a6b';
    ctx.fillRect(0, 0, S, S);
    // land
    ctx.fillStyle = '#3a4a3a';
    const [lx0, ly0] = toMap(-250, -255);
    const [lx1, ly1] = toMap(260, 260);
    ctx.fillRect(lx0, ly0, lx1 - lx0, ly1 - ly0);
    // beach
    ctx.fillStyle = '#d9bd7f';
    const [bx0, by0] = toMap(-330, -255);
    const [bx1, by1] = toMap(-250, 260);
    ctx.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
    // harbor basin
    ctx.fillStyle = '#0e4a6b';
    const [hx0, hy0] = toMap(260, -70);
    const [hx1, hy1] = toMap(420, 190);
    ctx.fillRect(hx0, hy0, hx1 - hx0, hy1 - hy0);
    // roads
    ctx.strokeStyle = '#c8c4bc';
    ctx.lineWidth = 5;
    for (const x of ROAD_XS) {
      const [a, b] = toMap(x, -255);
      const [c, d] = toMap(x, 260);
      ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke();
    }
    for (const z of ROAD_ZS) {
      const [a, b] = toMap(-250, z);
      const [c, d] = toMap(260, z);
      ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke();
    }
    // GPS route to waypoint
    if (waypoint) {
      const [wx, wy] = toMap(waypoint.x, waypoint.z);
      ctx.strokeStyle = '#ffd24d';
      ctx.lineWidth = 3;
      ctx.setLineDash([7, 5]);
      ctx.beginPath(); ctx.moveTo(C, C); ctx.lineTo(wx, wy); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffd24d';
      ctx.beginPath(); ctx.arc(wx, wy, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#241300';
      ctx.font = 'bold 9px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('★', wx, wy + 3);
    }
    // traffic dots
    if (traffic) {
      ctx.fillStyle = '#e8e8e8';
      for (const car of traffic.cars || []) {
        const [tx, ty] = toMap(car.position.x, car.position.z);
        ctx.fillRect(tx - 1.5, ty - 1.5, 3, 3);
      }
    }
    // enemy blips
    ctx.fillStyle = '#ff3b30';
    for (const e of enemies || []) {
      if (e.dead) continue;
      const [ex, ey] = toMap(e.position.x, e.position.z);
      ctx.beginPath(); ctx.arc(ex, ey, 4, 0, Math.PI * 2); ctx.fill();
    }
    // police blips (flashing)
    const flash = Math.floor(performance.now() / 350) % 2 === 0;
    if (police && police.units) {
      for (const u of police.units) {
        const [ux, uy] = toMap(u.position.x, u.position.z);
        ctx.fillStyle = flash ? '#ff3b30' : '#1e6bff';
        ctx.beginPath(); ctx.arc(ux, uy, 5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    // player arrow (center, rotated)
    ctx.save();
    ctx.translate(C, C);
    ctx.rotate(-playerHeading + Math.PI);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.restore();
    // north tick
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('N', C, 14);
  }

  drawAtlas(playerPos) {
    const canvas = this.el('atlas-canvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const scaleX = W / 640;
    const scaleY = H / 560;
    const toAtlas = (x, z) => [(x + 330) * scaleX, (z + 270) * scaleY];
    ctx.fillStyle = '#0e4a6b';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#4a5a44';
    const [gx0, gy0] = toAtlas(-250, -255);
    const [gx1, gy1] = toAtlas(260, 260);
    ctx.fillRect(gx0, gy0, gx1 - gx0, gy1 - gy0);
    ctx.fillStyle = '#d9bd7f';
    const [sx0, sy0] = toAtlas(-330, -255);
    const [sx1, sy1] = toAtlas(-250, 260);
    ctx.fillRect(sx0, sy0, sx1 - sx0, sy1 - sy0);
    ctx.fillStyle = '#0e4a6b';
    const [hx0, hy0] = toAtlas(260, -70);
    const [hx1, hy1] = toAtlas(420, 190);
    ctx.fillRect(hx0, hy0, hx1 - hx0, hy1 - hy0);
    // district tints
    for (const key of Object.keys(DISTRICTS)) {
      const d = DISTRICTS[key];
      const [dx, dy] = toAtlas(d.center.x, d.center.z);
      ctx.fillStyle = d.color + '55';
      ctx.beginPath(); ctx.arc(dx, dy, 62, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(d.name.toUpperCase(), dx, dy + 4);
    }
    // roads
    ctx.strokeStyle = '#d8d4cc';
    ctx.lineWidth = 3;
    for (const x of ROAD_XS) {
      const [a, b] = toAtlas(x, -255);
      const [c, d] = toAtlas(x, 260);
      ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke();
    }
    for (const z of ROAD_ZS) {
      const [a, b] = toAtlas(-250, z);
      const [c, d] = toAtlas(260, z);
      ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke();
    }
    // player marker
    if (playerPos) {
      const [px, py] = toAtlas(playerPos.x, playerPos.z);
      ctx.fillStyle = '#ffd24d';
      ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px Arial';
      ctx.fillText('YOU', px, py - 14);
    }
  }
}
