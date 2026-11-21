// Live circular minimap: roads, sea, the waypoint diamond, police
// blips, enemies, the player arrow and north. Drawn every frame on a
// small canvas, cheap enough to never matter.
import { CFG } from './config.js';

export function createMinimap(G) {
  const cv = document.getElementById('minimap');
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height, R = W / 2;
  const SCALE = R / 330; // world 660 m across -> the circle
  const MM = {
    draw() {
      const P = G.player;
      ctx.clearRect(0, 0, W, H);
      // Base disc.
      ctx.beginPath(); ctx.arc(R, R, R - 2, 0, Math.PI * 2);
      ctx.fillStyle = '#22304a'; ctx.fill();
      ctx.save();
      ctx.beginPath(); ctx.arc(R, R, R - 2, 0, Math.PI * 2); ctx.clip();
      const px = (x) => R + x * SCALE;
      const py = (z) => R + z * SCALE;
      // Sea on the east.
      ctx.fillStyle = '#2a7fa8';
      ctx.fillRect(px(CFG.beachX), 0, W, H);
      ctx.fillStyle = '#e8d29a';
      ctx.fillRect(px(CFG.beachX - 32), 0, 32 * SCALE, H);
      // Roads.
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      for (let k = -6; k <= 6; k++) {
        const c = k * CFG.block;
        ctx.beginPath(); ctx.moveTo(px(-330), py(c)); ctx.lineTo(px(330), py(c)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px(c), py(-330)); ctx.lineTo(px(c), py(330)); ctx.stroke();
      }
      // Downtown block tint.
      ctx.fillStyle = 'rgba(255,210,62,0.12)';
      ctx.fillRect(px(-96), py(-96), 192 * SCALE, 192 * SCALE);
      // Objective diamond.
      const obj = G.missions.objective;
      if (obj) {
        const ox = px(obj.x), oy = py(obj.z);
        ctx.save();
        ctx.translate(ox, oy); ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#ffd23e';
        ctx.fillRect(-6, -6, 12, 12);
        ctx.restore();
        ctx.strokeStyle = '#ffd23e'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(ox, oy, 10, 0, Math.PI * 2); ctx.stroke();
      }
      // Enemies (red) and cops (blue).
      for (const e of G.combat.enemies) {
        if (e.dead) continue;
        ctx.fillStyle = '#ff3b30';
        ctx.beginPath(); ctx.arc(px(e.x), py(e.z), 3.5, 0, Math.PI * 2); ctx.fill();
      }
      for (const c of G.police.cops) {
        ctx.fillStyle = '#37b6ff';
        ctx.beginPath(); ctx.arc(px(c.x), py(c.z), 3.5, 0, Math.PI * 2); ctx.fill();
      }
      // Player arrow.
      const ux = px(P.x), uy = py(P.z);
      ctx.save();
      ctx.translate(ux, uy);
      ctx.rotate(Math.atan2(Math.sin(P.heading), Math.cos(P.heading)) + Math.PI / 2);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -8); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.restore();
      // North tick.
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px Verdana';
      ctx.fillText('N', R - 5, 15);
    },
  };
  G.minimap = MM;
  return MM;
}
