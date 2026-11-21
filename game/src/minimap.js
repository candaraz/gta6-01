// minimap.js — Solmar Bay v3: the circular live minimap.
// One job: draw the city around the player — road grid, sea, parks, the
// player arrow, the waypoint, police blips and enemy dots — north up,
// centred on the player. Drawn every frame onto the HUD's canvas.

import { AVENUES, WORLD } from './config.js';

export function createMinimap(G) {
  const canvas = document.getElementById('minimap');
  const ctx = canvas.getContext('2d');
  const S = 200, R = 120; // canvas size, metres shown (radius)

  function draw() {
    const p = G.player.p;
    const scale = S / (R * 2);
    ctx.clearRect(0, 0, S, S);
    // Base: dark green-grey city.
    ctx.fillStyle = '#26332a';
    ctx.fillRect(0, 0, S, S);
    const toMap = (x, z) => [S / 2 + (x - p.x) * scale, S / 2 + (z - p.z) * scale];
    // Sea (east + south edges).
    ctx.fillStyle = '#2a7a8a';
    let [sx] = toMap(WORLD.seaX, 0);
    if (sx < S) ctx.fillRect(Math.max(0, sx), 0, S - Math.max(0, sx), S);
    let [, sy] = toMap(0, WORLD.seaZ);
    if (sy < S) ctx.fillRect(0, Math.max(0, sy), S, S - Math.max(0, sy));
    // Beach sand.
    ctx.fillStyle = '#c8b48a';
    [sx] = toMap(WORLD.beach, 0);
    if (sx < S && sx > -10) ctx.fillRect(Math.max(0, sx), 0, 3, S);
    [, sy] = toMap(0, WORLD.beach);
    if (sy < S && sy > -10) ctx.fillRect(0, Math.max(0, sy), S, 3);
    // Roads: the avenue grid.
    ctx.strokeStyle = '#8a8a86';
    ctx.lineWidth = 2;
    for (const a of AVENUES) {
      let [x1] = toMap(a, 0);
      if (x1 > -4 && x1 < S + 4) { ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1, S); ctx.stroke(); }
      let [, z1] = toMap(0, a);
      if (z1 > -4 && z1 < S + 4) { ctx.beginPath(); ctx.moveTo(0, z1); ctx.lineTo(S, z1); ctx.stroke(); }
    }
    // Parks.
    ctx.fillStyle = '#3a6a34';
    for (const [px, pz] of [[-168, 168], [168, -168], [-168, -24], [72, 216], [-264, 72]]) {
      const [mx, my] = toMap(px, pz);
      ctx.fillRect(mx - 8, my - 8, 16, 16);
    }
    // Enemies (red dots).
    for (const e of G.combat.enemies) {
      const [mx, my] = toMap(e.x, e.z);
      if (mx < -4 || mx > S + 4 || my < -4 || my > S + 4) continue;
      ctx.fillStyle = '#ff3a2a';
      ctx.beginPath(); ctx.arc(mx, my, 3, 0, Math.PI * 2); ctx.fill();
    }
    // Police (blue dots with a red rim).
    for (const c of G.police.cops) {
      const [mx, my] = toMap(c.car.x, c.car.z);
      if (mx < -4 || mx > S + 4 || my < -4 || my > S + 4) continue;
      ctx.fillStyle = '#2a5aff';
      ctx.beginPath(); ctx.arc(mx, my, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ff3a2a'; ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Waypoint (gold diamond).
    const wp = G.missions.waypoint();
    if (wp) {
      const [mx, my] = toMap(wp.x, wp.z);
      if (mx > -6 && mx < S + 6 && my > -6 && my < S + 6) {
        ctx.fillStyle = '#ffc21f';
        ctx.beginPath();
        ctx.moveTo(mx, my - 6); ctx.lineTo(mx + 5, my); ctx.lineTo(mx, my + 6); ctx.lineTo(mx - 5, my);
        ctx.closePath(); ctx.fill();
      }
    }
    // Player arrow (white, rotated to the heading).
    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.rotate(Math.PI - p.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    // North tick.
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('N', S / 2, 12);
  }

  return { draw };
}
