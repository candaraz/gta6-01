// Solmar Bay — HUD, minimap and menus.
// One job: everything the player reads. A live minimap (canvas, top-down: roads,
// player, cars, police, mission marker), wanted stars, health/armour, cash,
// respect, mission objective, speed, weapon and radio — plus the start screen,
// pause menu, settings, garage/shop panels and banners. All DOM, no WebGL.

import { WEAPONS } from './config.js';
import { BINDINGS } from './input.js';
import { respectRank } from './garage.js';

export class HUD {
  constructor(game) {
    this.game = game;
    this.el = {};
    for (const id of ['hud', 'stars', 'health-fill', 'health-num', 'armour-fill', 'armour-num', 'cash', 'respect', 'objective', 'objective-text', 'objective-dist', 'speed', 'speed-unit', 'weapon', 'ammo', 'radio', 'prompt', 'banner', 'banner-title', 'banner-sub', 'toast', 'menu', 'menu-title', 'menu-body', 'pause', 'vignette', 'crosshair', 'minimap']) {
      this.el[id] = document.getElementById(id);
    }
    this.map = this.el.minimap.getContext('2d');
    this._toastTimer = 0;
    this._bannerTimer = 0;
    this.el.hud.style.display = 'none'; // the menu covers the screen first
    this._bindMenuButtons();
  }

  _bindMenuButtons() {
    const bind = (id, fn) => { const b = document.getElementById(id); if (b) b.addEventListener('click', () => { this.game.audio.ensure(); this.game.audio.click(); fn(); }); };
    bind('btn-new', () => this.game.newGame());
    bind('btn-continue', () => this.game.continueGame());
    bind('btn-settings', () => this.showSettings());
    bind('btn-resume', () => this.game.resume());
    bind('btn-save', () => { this.game.saveNow(); this.toast('Game saved'); });
    bind('btn-quit', () => this.game.toMenu());
    bind('btn-settings-back', () => this.showPause());
    bind('btn-mute', () => { this.game.toggleMute(); });
  }

  show(el, on) { if (el) el.style.display = on ? '' : 'none'; }
  showStart(canContinue) {
    this.show(this.el.menu, true);
    this.show(this.el.pause, false);
    this.show(this.el.hud, false);
    document.getElementById('btn-continue').style.display = canContinue ? '' : 'none';
    this.el['menu-title'].textContent = 'SOLMAR BAY';
    this.el['menu-body'].innerHTML = `
      <p class="tagline">Sun, salt, stolen cars. Build a crew. Own the Bay.</p>
      <p class="controls">${BINDINGS.map(([k, v]) => `<span><b>${k}</b> ${v}</span>`).join('')}</p>
      <p class="hint">Ten story missions. Street races. A garage, a gun shop, three safehouses.<br>Five stars of Bay PD. One Bay King.</p>`;
  }
  showPause() {
    this.show(this.el.pause, true);
    this.show(this.el.menu, false);
    document.getElementById('pause-title').textContent = 'Paused';
    document.getElementById('pause-body').innerHTML = `
      <p>Cash $${this.game.cash.toLocaleString()} · ${respectRank(this.game.respect)} · ${this.game.respect} respect</p>
      <p>${this.game.missions.objectiveText()}</p>`;
  }
  showSettings() {
    this.show(this.el.menu, true);
    this.show(this.el.pause, false);
    this.el['menu-title'].textContent = 'Settings';
    const s = this.game.settings;
    this.el['menu-body'].innerHTML = `
      <label>Master volume <input id="set-master" type="range" min="0" max="100" value="${Math.round(s.master * 100)}"></label>
      <label>Music volume <input id="set-music" type="range" min="0" max="100" value="${Math.round(s.music * 100)}"></label>
      <label>Effects volume <input id="set-sfx" type="range" min="0" max="100" value="${Math.round(s.sfx * 100)}"></label>
      <label>Quality <select id="set-quality"><option ${s.quality === 'low' ? 'selected' : ''}>low</option><option ${s.quality === 'medium' ? 'selected' : ''}>medium</option><option ${s.quality === 'high' ? 'selected' : ''}>high</option></select></label>
      <label>Mouse sensitivity <input id="set-sens" type="range" min="30" max="200" value="${Math.round(s.sens * 100)}"></label>
      <p class="controls">${BINDINGS.map(([k, v]) => `<span><b>${k}</b> ${v}</span>`).join('')}</p>
      <button id="btn-settings-done" class="btn">Done</button>`;
    const done = document.getElementById('btn-settings-done');
    if (done) done.addEventListener('click', () => { this.readSettings(); this.game.toMenu(); });
  }
  readSettings() {
    const s = this.game.settings;
    const v = (id) => document.getElementById(id)?.value;
    if (v('set-master') != null) s.master = +v('set-master') / 100;
    if (v('set-music') != null) s.music = +v('set-music') / 100;
    if (v('set-sfx') != null) s.sfx = +v('set-sfx') / 100;
    if (v('set-quality') != null) s.quality = v('set-quality');
    if (v('set-sens') != null) s.sens = +v('set-sens') / 100;
    this.game.applySettings();
  }

  banner(title, sub = '') {
    this.el['banner-title'].textContent = title;
    this.el['banner-sub'].textContent = sub;
    this.el.banner.classList.add('show');
    this._bannerTimer = 3.2;
  }
  toast(text) {
    this.el.toast.textContent = text;
    this.el.toast.classList.add('show');
    this._toastTimer = 2.4;
  }
  prompt(text) {
    if (text) { this.el.prompt.textContent = text; this.el.prompt.style.display = ''; }
    else this.el.prompt.style.display = 'none';
  }

  update(dt) {
    const g = this.game;
    if (this._bannerTimer > 0) { this._bannerTimer -= dt; if (this._bannerTimer <= 0) this.el.banner.classList.remove('show'); }
    if (this._toastTimer > 0) { this._toastTimer -= dt; if (this._toastTimer <= 0) this.el.toast.classList.remove('show'); }
    if (!g.playing) return;
    // stars
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < g.police.stars ? '★' : '☆';
    this.el.stars.textContent = stars;
    this.el.stars.style.color = g.police.stars >= 3 ? '#ff4040' : '#ffd23e';
    // health / armour
    this.el['health-fill'].style.width = g.player.health + '%';
    this.el['health-num'].textContent = Math.ceil(g.player.health);
    this.el['armour-fill'].style.width = g.player.armour + '%';
    this.el['armour-num'].textContent = Math.ceil(g.player.armour);
    this.el.cash.textContent = '$' + g.cash.toLocaleString();
    this.el.respect.textContent = `${respectRank(g.respect)} · ${g.respect}`;
    // objective + distance
    this.el['objective-text'].textContent = g.missions.objectiveText();
    const mp = g.missions.markerPos;
    if (mp) {
      const px = g.playerCar ? g.playerCar.x : g.player.x;
      const pz = g.playerCar ? g.playerCar.z : g.player.z;
      this.el['objective-dist'].textContent = Math.round(Math.hypot(px - mp.x, pz - mp.z)) + ' m';
    } else this.el['objective-dist'].textContent = '';
    // speed / weapon / radio
    if (g.playerCar) {
      this.el.speed.textContent = Math.round(Math.abs(g.playerCar.speed) * 3.6);
      this.el['speed-unit'].textContent = 'km/h';
    } else {
      this.el.speed.textContent = '—';
      this.el['speed-unit'].textContent = '';
    }
    const w = WEAPONS[g.combat.weapon];
    this.el.weapon.textContent = w.label;
    this.el.ammo.textContent = `${g.combat.mag[g.combat.weapon]} / ${g.combat.ammo[g.combat.weapon]}`;
    this.el.radio.textContent = `♪ ${g.audio.stationName}`;
    // low-health vignette
    this.el.vignette.style.opacity = g.player.health < 35 ? String(0.55 - g.player.health / 100) : '0';
    this.el.crosshair.style.display = g.aiming ? '' : 'none';
    this.drawMinimap();
  }

  drawMinimap() {
    const g = this.game;
    const ctx = this.map;
    const S = 180, half = 300; // world half-extent shown
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(12, 20, 28, 0.85)';
    ctx.fillRect(0, 0, S, S);
    const px = g.playerCar ? g.playerCar.x : g.player.x;
    const pz = g.playerCar ? g.playerCar.z : g.player.z;
    const toMap = (x, z) => [S / 2 + ((x - px) / half) * (S / 2), S / 2 + ((z - pz) / half) * (S / 2)];
    // roads (grid)
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.35)';
    ctx.lineWidth = 2;
    const step = 52 / half * (S / 2);
    for (let i = 0; i <= 9; i++) {
      const off = (i * 52 - 234 - px) / half * (S / 2) + S / 2;
      ctx.beginPath(); ctx.moveTo(off, 0); ctx.lineTo(off, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, off); ctx.lineTo(S, off); ctx.stroke();
    }
    // water (south)
    const [, wy] = toMap(0, 260);
    if (wy > 0 && wy < S) { ctx.fillStyle = 'rgba(40, 130, 170, 0.8)'; ctx.fillRect(0, wy, S, S - wy); }
    // mission marker
    if (g.missions.markerPos) {
      const [mx, mz] = toMap(g.missions.markerPos.x, g.missions.markerPos.z);
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath(); ctx.arc(mx, mz, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffd23e'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(mx, mz, 10 + Math.sin(performance.now() / 300) * 3, 0, Math.PI * 2); ctx.stroke();
    }
    // police (red dots)
    ctx.fillStyle = '#ff4040';
    for (const c of g.police.cars) {
      const [x, y] = toMap(c.x, c.z);
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
    if (g.police.heli) {
      const [x, y] = toMap(g.police.heli.position.x, g.police.heli.position.z);
      ctx.fillStyle = '#ff8040';
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    }
    // traffic (grey dots)
    ctx.fillStyle = 'rgba(220, 220, 220, 0.7)';
    for (const c of g.traffic.cars) {
      const [x, y] = toMap(c.x, c.z);
      if (x > 0 && x < S && y > 0 && y < S) ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    // player arrow (centre, pointing up = heading)
    const heading = g.playerCar ? g.playerCar.heading : g.player.heading;
    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.rotate(heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    // north tick
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('N', S / 2 - 4, 12);
  }
}
