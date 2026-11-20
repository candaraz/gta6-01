// hud.js — the HUD (cash, respect, rank, wanted stars, health, weapon,
// speed, radio, objective), the live minimap, message toasts, and the
// start / pause / settings menus. The HUD is visible from the first
// frame of play — never display:none while playing.
import { RANKS, STATIONS } from './config.js';

export class HUD {
  constructor() {
    const root = document.getElementById('game-root');
    this.root = root;
    this.el = {};
    const mk = (id, css) => {
      const d = document.createElement('div');
      d.id = id;
      d.style.cssText = css;
      root.appendChild(d);
      this.el[id] = d;
      return d;
    };
    // Top-left: money + respect.
    mk('hud-money', 'position:absolute;left:14px;top:12px;color:#fff;font:700 20px system-ui;text-shadow:0 2px 4px #000;z-index:10;');
    mk('hud-respect', 'position:absolute;left:14px;top:40px;color:#ffd24a;font:600 15px system-ui;text-shadow:0 2px 4px #000;z-index:10;');
    // Top-right: wanted stars + health.
    mk('hud-stars', 'position:absolute;right:16px;top:10px;color:#ffd24a;font:700 26px system-ui;letter-spacing:4px;text-shadow:0 2px 6px #000;z-index:10;');
    mk('hud-health', 'position:absolute;right:16px;top:46px;width:180px;height:14px;background:rgba(0,0,0,.55);border:1px solid #fff3;border-radius:7px;z-index:10;');
    this.el['hud-health'].innerHTML = '<div id="hud-health-fill" style="height:100%;width:100%;background:linear-gradient(90deg,#37c837,#8aff8a);border-radius:6px"></div>';
    // Bottom-left: minimap.
    const map = document.createElement('canvas');
    map.id = 'minimap';
    map.width = 200; map.height = 200;
    map.style.cssText = 'position:absolute;left:14px;bottom:14px;width:200px;height:200px;border:2px solid rgba(255,255,255,.65);border-radius:50%;background:#0a2030;z-index:10;';
    root.appendChild(map);
    this.minimap = map;
    this.mapCtx = map.getContext('2d');
    // Bottom-centre: objective.
    mk('hud-objective', 'position:absolute;left:50%;bottom:18px;transform:translateX(-50%);max-width:46vw;color:#fff;font:600 16px system-ui;text-align:center;text-shadow:0 2px 4px #000;background:rgba(0,0,0,.45);padding:8px 16px;border-radius:8px;z-index:10;');
    // Bottom-right: speed + weapon + radio.
    mk('hud-speed', 'position:absolute;right:16px;bottom:14px;color:#fff;font:700 26px system-ui;text-align:right;text-shadow:0 2px 4px #000;z-index:10;');
    mk('hud-weapon', 'position:absolute;right:16px;bottom:52px;color:#fff;font:600 15px system-ui;text-align:right;text-shadow:0 2px 4px #000;z-index:10;');
    mk('hud-radio', 'position:absolute;right:16px;bottom:76px;color:#9fd8ff;font:600 14px system-ui;text-align:right;text-shadow:0 2px 4px #000;z-index:10;');
    // Centre: crosshair (only while armed on foot).
    const ch = document.createElement('div');
    ch.id = 'crosshair';
    ch.style.cssText = 'position:absolute;left:50%;top:50%;width:22px;height:22px;transform:translate(-50%,-50%);z-index:10;pointer-events:none;display:none;';
    ch.innerHTML = '<div style="position:absolute;left:10px;top:0;width:2px;height:22px;background:#fff"></div><div style="position:absolute;top:10px;left:0;width:22px;height:2px;background:#fff"></div>';
    root.appendChild(ch);
    this.el['crosshair'] = ch;
    // Message feed (toasts).
    mk('hud-messages', 'position:absolute;left:14px;top:76px;color:#fff;font:600 15px system-ui;text-shadow:0 2px 4px #000;z-index:10;max-width:420px;');
    this.messages = [];
    // Interaction prompt ("Press E ...").
    mk('hud-prompt', 'position:absolute;left:50%;top:62%;transform:translateX(-50%);color:#ffd24a;font:700 17px system-ui;text-shadow:0 2px 4px #000;z-index:10;display:none;');
    this._buildMenus();
  }

  _buildMenus() {
    const root = this.root;
    // Start screen.
    const start = document.createElement('div');
    start.id = 'menu-start';
    start.style.cssText = 'position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,20,40,.82),rgba(20,10,30,.88));display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;z-index:40;font-family:system-ui,sans-serif;';
    start.innerHTML = `
      <div style="font:800 64px system-ui;letter-spacing:2px;text-shadow:0 4px 0 #c22,0 8px 24px #000">SOLMAR BAY</div>
      <div style="font:600 18px system-ui;color:#ffd24a;margin:6px 0 22px">An open-world crime story · 10 missions · 5-star police · 3 radio stations</div>
      <button id="btn-new" style="font:700 18px system-ui;padding:12px 34px;margin:6px;background:#f2c200;border:0;border-radius:8px;cursor:pointer">New Game</button>
      <button id="btn-continue" style="font:700 18px system-ui;padding:12px 34px;margin:6px;background:#234;border:1px solid #789;color:#fff;border-radius:8px;cursor:pointer;display:none">Continue</button>
      <div style="margin-top:18px;font:400 14px/1.7 system-ui;color:#cdd;text-align:center">WASD move · Mouse look · E enter car / interact · F hold to use · Click shoot<br>1-4 weapons · Q cycle · R reload · T street race / taxi · C radio · M mute · Esc pause</div>`;
    root.appendChild(start);
    this.el['menu-start'] = start;
    // Pause screen.
    const pause = document.createElement('div');
    pause.id = 'menu-pause';
    pause.style.cssText = 'position:absolute;inset:0;background:rgba(8,12,20,.78);display:none;flex-direction:column;align-items:center;justify-content:center;color:#fff;z-index:40;font-family:system-ui,sans-serif;';
    pause.innerHTML = `
      <div style="font:800 40px system-ui">Paused</div>
      <button id="btn-resume" style="font:700 17px system-ui;padding:11px 30px;margin:8px;background:#f2c200;border:0;border-radius:8px;cursor:pointer">Resume</button>
      <button id="btn-save-quit" style="font:700 17px system-ui;padding:11px 30px;margin:8px;background:#234;border:1px solid #789;color:#fff;border-radius:8px;cursor:pointer">Save &amp; Quit to Menu</button>
      <div style="margin-top:14px;font:400 14px system-ui;color:#cdd">Volume <input id="set-volume" type="range" min="0" max="100" value="70" style="width:140px;vertical-align:middle"> <span id="set-volume-val">70</span>% · Quality <select id="set-quality"><option value="high">High</option><option value="low">Low</option></select></div>`;
    root.appendChild(pause);
    this.el['menu-pause'] = pause;
    // Busted / wasted banner.
    const banner = document.createElement('div');
    banner.id = 'hud-banner';
    banner.style.cssText = 'position:absolute;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;color:#fff;z-index:35;font-family:system-ui,sans-serif;background:rgba(0,0,0,.45);';
    root.appendChild(banner);
    this.el['hud-banner'] = banner;
  }

  showStart(hasSave) {
    this.el['menu-start'].style.display = 'flex';
    const cont = document.getElementById('btn-continue');
    if (cont) cont.style.display = hasSave ? 'block' : 'none';
    this.setHudVisible(false);
  }

  hideStart() {
    this.el['menu-start'].style.display = 'none';
    this.setHudVisible(true);
  }

  showPause(show) {
    this.el['menu-pause'].style.display = show ? 'flex' : 'none';
  }

  showBanner(title, sub) {
    const b = this.el['hud-banner'];
    b.style.display = 'flex';
    b.innerHTML = `<div style="font:800 52px system-ui;text-shadow:0 4px 16px #000">${title}</div><div style="font:600 18px system-ui;color:#ffd24a">${sub}</div>`;
  }

  hideBanner() {
    this.el['hud-banner'].style.display = 'none';
  }

  setHudVisible(v) {
    for (const id of ['hud-money', 'hud-respect', 'hud-stars', 'hud-health', 'hud-objective', 'hud-speed', 'hud-weapon', 'hud-radio', 'hud-messages', 'hud-prompt']) {
      if (this.el[id]) this.el[id].style.display = v ? '' : 'none';
    }
    if (this.minimap) this.minimap.style.display = v ? '' : 'none';
  }

  message(text) {
    this.messages.push({ text, t: 6 });
    if (this.messages.length > 3) this.messages.shift();
  }

  setPrompt(text) {
    const p = this.el['hud-prompt'];
    if (!text) { p.style.display = 'none'; return; }
    p.style.display = 'block';
    p.textContent = text;
  }

  rankName(respect) {
    let name = RANKS[0].name;
    for (const r of RANKS) if (respect >= r.at) name = r.name;
    return name;
  }

  // Refresh every HUD readout and redraw the minimap.
  update(dt, G) {
    const p = G.player;
    this.el['hud-money'].textContent = `$${G.cash.toLocaleString('en-US')}`;
    this.el['hud-respect'].textContent = `Respect ${G.respect} · ${this.rankName(G.respect)} · Missions ${G.missions.completed}/10`;
    this.el['hud-stars'].textContent = '★'.repeat(G.police.stars) + '☆'.repeat(5 - G.police.stars);
    const fill = document.getElementById('hud-health-fill');
    if (fill) {
      fill.style.width = `${Math.max(0, p.health)}%`;
      fill.style.background = p.health > 50 ? 'linear-gradient(90deg,#37c837,#8aff8a)' : p.health > 25 ? 'linear-gradient(90deg,#e8a020,#ffd24a)' : 'linear-gradient(90deg,#d42a2a,#ff6a6a)';
    }
    const w = G.combat.current;
    const mag = G.combat.mag[w];
    const reserve = G.combat.ammo[w] === Infinity ? '∞' : G.combat.ammo[w];
    this.el['hud-weapon'].textContent = `${w.toUpperCase()}  ${mag} / ${reserve}`;
    const spd = p.inVehicle ? Math.abs(p.inVehicle.speed) * 3.6 : Math.abs(p.speed) * 3.6;
    this.el['hud-speed'].textContent = p.inVehicle ? `${Math.round(spd)} km/h · ${p.inVehicle.def.name}` : `${Math.round(spd)} km/h · on foot`;
    this.el['hud-radio'].textContent = G.audio.radioOn ? `♪ ${STATIONS[G.audio.station].name}` : '♪ radio off';
    this.el['hud-objective'].textContent = G.missions.objectiveText;
    this.el['crosshair'].style.display = (!p.inVehicle && G.state === 'playing') ? 'block' : 'none';
    // Message toasts.
    for (const m of this.messages) m.t -= dt;
    this.messages = this.messages.filter((m) => m.t > 0);
    this.el['hud-messages'].innerHTML = this.messages.map((m) => `<div style="opacity:${Math.min(1, m.t)}">${m.text}</div>`).join('');
    this._drawMinimap(G);
  }

  _drawMinimap(G) {
    const c = this.mapCtx;
    const S = 200, W = 700; // world -350..350 maps to 0..200
    const toX = (x) => ((x + 350) / W) * S;
    const toY = (z) => ((z + 350) / W) * S;
    c.clearRect(0, 0, S, S);
    c.fillStyle = '#0a2030';
    c.fillRect(0, 0, S, S);
    // Water + beach.
    c.fillStyle = '#2e7fb8';
    c.fillRect(0, toY(235), S, S - toY(235));
    c.fillStyle = '#e8d49a';
    c.fillRect(0, toY(205), S, toY(235) - toY(205));
    // Land.
    c.fillStyle = '#3a6a3a';
    c.fillRect(0, 0, S, toY(205));
    // Roads.
    c.strokeStyle = '#555';
    c.lineWidth = 2;
    for (const r of G.city.roadLines) {
      c.beginPath();
      c.moveTo(toX(r.x1), toY(r.z1));
      c.lineTo(toX(r.x2), toY(r.z2));
      c.stroke();
    }
    // Buildings.
    c.fillStyle = '#8a8a7a';
    for (const b of G.city.buildings) {
      c.fillRect(toX(b.x - b.w / 2), toY(b.z - b.d / 2), Math.max(1, (b.w / W) * S), Math.max(1, (b.d / W) * S));
    }
    // Bay coins.
    c.fillStyle = '#ffd24a';
    for (const coin of G.city.coins) {
      if (coin.taken) continue;
      c.beginPath(); c.arc(toX(coin.x), toY(coin.z), 1.6, 0, Math.PI * 2); c.fill();
    }
    // Objective marker (pulsing yellow).
    if (G.missions.markerPos) {
      const pulse = 3 + Math.sin(performance.now() / 200) * 1.2;
      c.fillStyle = '#ffd24a';
      c.beginPath(); c.arc(toX(G.missions.markerPos.x), toY(G.missions.markerPos.z), pulse, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 1;
      c.beginPath(); c.arc(toX(G.missions.markerPos.x), toY(G.missions.markerPos.z), pulse + 2.5, 0, Math.PI * 2); c.stroke();
    }
    // Police (blue), enemies (red), traffic (grey).
    const dot = (x, z, colour, r) => {
      c.fillStyle = colour;
      c.beginPath(); c.arc(toX(x), toY(z), r, 0, Math.PI * 2); c.fill();
    };
    for (const cop of G.police.cops) if (!cop.dead) dot(cop.x, cop.z, '#3a8aff', 2.4);
    for (const e of G.combat.enemies) if (!e.dead) dot(e.x, e.z, '#ff4040', 2.2);
    for (const v of G.traffic.cars) if (!v.dead) dot(v.x, v.z, '#bbbbbb', 1.4);
    // Player arrow (white, points along heading).
    const px = toX(G.player.x), py = toY(G.player.z);
    const h = G.player.inVehicle ? G.player.inVehicle.heading : G.player.heading;
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(px + Math.sin(h) * 6, py + Math.cos(h) * 6);
    c.lineTo(px + Math.sin(h + 2.5) * 4.5, py + Math.cos(h + 2.5) * 4.5);
    c.lineTo(px + Math.sin(h - 2.5) * 4.5, py + Math.cos(h - 2.5) * 4.5);
    c.closePath(); c.fill();
    c.strokeStyle = '#000'; c.lineWidth = 1; c.stroke();
    // North tick.
    c.fillStyle = '#fff';
    c.font = 'bold 10px system-ui';
    c.fillText('N', S - 12, 12);
  }
}
