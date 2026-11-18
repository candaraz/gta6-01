// The minimap: a live canvas in the corner showing the road grid, the water,
// the player's arrow, the mission marker and the police. The same drawing
// routine paints the fullscreen map, bigger and with place names.

import { WORLD, PLACES } from './config.js';

const RANGE = 250;

function worldToMap(x, z, size) {
  const half = size / 2;
  return [half + (x / RANGE) * half, half + (z / RANGE) * half];
}

function drawBase(ctx, size, big) {
  ctx.clearRect(0, 0, size, size);
  // Land.
  ctx.fillStyle = big ? '#3d4a3a' : '#46543f';
  ctx.fillRect(0, 0, size, size);
  // The sea, east of the beach.
  const [waterX] = worldToMap(WORLD.waterStart, 0, size);
  ctx.fillStyle = '#2e7fa8';
  ctx.fillRect(waterX, 0, size - waterX, size);
  // The sand strip.
  const [beachX] = worldToMap(WORLD.beachStart, 0, size);
  ctx.fillStyle = '#d9c48a';
  ctx.fillRect(beachX, 0, waterX - beachX, size);
  // Blocks, faintly.
  ctx.fillStyle = big ? '#55624e' : '#4d5c46';
  const centres = [-195, -150, -90, -30, 30, 90, 150, 195];
  for (const cx of centres) {
    for (const cz of centres) {
      const [px, pz] = worldToMap(cx - 24, cz - 24, size);
      const scale = size / (RANGE * 2);
      ctx.fillRect(px, pz, 48 * scale, 48 * scale);
    }
  }
  // Roads.
  ctx.strokeStyle = big ? '#c9c2b2' : '#b9b2a2';
  ctx.lineWidth = Math.max(1, size / 130);
  for (const line of WORLD.roadLines) {
    const [px] = worldToMap(line, 0, size);
    const [, pz] = worldToMap(0, line, size);
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, size);
    ctx.moveTo(0, pz);
    ctx.lineTo(size, pz);
    ctx.stroke();
  }
  if (big) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(size / 34)}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    for (const place of Object.values(PLACES)) {
      const [px, pz] = worldToMap(place.x, place.z, size);
      ctx.fillText(place.name, px, pz - 8);
    }
  }
}

function drawArrow(ctx, x, y, heading, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.7, size * 0.7);
  ctx.lineTo(0, size * 0.3);
  ctx.lineTo(-size * 0.7, size * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawMinimap(canvas, state) {
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  drawBase(ctx, size, false);
  // Mission waypoint: a pulsing diamond.
  if (state.waypoint) {
    const [wx, wz] = worldToMap(state.waypoint.x, state.waypoint.z, size);
    const pulse = 5 + Math.sin(performance.now() / 220) * 1.4;
    ctx.save();
    ctx.translate(wx, wz);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd94a';
    ctx.fillRect(-pulse / 2, -pulse / 2, pulse, pulse);
    ctx.restore();
  }
  // Police blips flash red and blue.
  const policeColor = Math.floor(performance.now() / 300) % 2 === 0 ? '#ff4444' : '#4488ff';
  ctx.fillStyle = policeColor;
  for (const cruiser of state.police) {
    const [px, pz] = worldToMap(cruiser.x, cruiser.z, size);
    ctx.beginPath();
    ctx.arc(px, pz, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Goons read as red dots.
  ctx.fillStyle = '#ff2222';
  for (const goon of state.goons) {
    if (goon.dead) continue;
    const [px, pz] = worldToMap(goon.x, goon.z, size);
    ctx.beginPath();
    ctx.arc(px, pz, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // The player arrow, pointing where the player faces. Canvas north is up,
  // and heading 0 faces +z (south), so the arrow turns by heading + PI.
  const [px, pz] = worldToMap(state.playerX, state.playerZ, size);
  drawArrow(ctx, px, pz, state.heading + Math.PI, 7, '#ffffff');
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(px, pz, 8.5, 0, Math.PI * 2);
  ctx.stroke();
  // North.
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(size / 13)}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('N', size - 12, 16);
}

export function drawBigMap(canvas, state) {
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  drawBase(ctx, size, true);
  if (state.waypoint) {
    const [wx, wz] = worldToMap(state.waypoint.x, state.waypoint.z, size);
    ctx.save();
    ctx.translate(wx, wz);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd94a';
    ctx.fillRect(-8, -8, 16, 16);
    ctx.restore();
  }
  const [px, pz] = worldToMap(state.playerX, state.playerZ, size);
  drawArrow(ctx, px, pz, state.heading + Math.PI, 14, '#ffffff');
}
