// textures.js — every texture in MIRADOR KEYS is painted on offscreen canvases.
// No image files, no network: crisp procedural art for roads, facades, sand, signs.
import * as THREE from 'three';

export function makeCanvasTexture(width, height, draw, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function grain(ctx, w, h, amount, alpha) {
  for (let i = 0; i < amount; i++) {
    const v = Math.floor(Math.random() * 60);
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
}

function makeAsphaltTexture() {
  return makeCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#33343a';
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, 2600, 0.10);
    // subtle patch variation
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.06})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 40 + Math.random() * 90, 24 + Math.random() * 60);
    }
    // double-yellow center lines (vertical in texture space = along road)
    ctx.fillStyle = '#e8c33a';
    ctx.fillRect(w / 2 - 14, 0, 7, h);
    ctx.fillRect(w / 2 + 7, 0, 7, h);
    // dashed white lane lines
    ctx.fillStyle = '#e8e8e8';
    for (const x of [w * 0.25, w * 0.75]) {
      for (let y = 0; y < h; y += 64) ctx.fillRect(x - 3, y, 6, 34);
    }
    // edge lines
    ctx.fillStyle = 'rgba(232,232,232,0.85)';
    ctx.fillRect(6, 0, 4, h);
    ctx.fillRect(w - 10, 0, 4, h);
  }, 1, 6);
}

function makeCrosswalkTexture() {
  return makeCanvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#33343a';
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, 500, 0.08);
    ctx.fillStyle = '#f2f2f2';
    for (let x = 8; x < w; x += 42) ctx.fillRect(x, 10, 26, h - 20);
  });
}

function makeSidewalkTexture() {
  return makeCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#9a938a';
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, 900, 0.08);
    ctx.strokeStyle = 'rgba(60,55,50,0.55)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(w, i * 64); ctx.stroke();
    }
  }, 4, 4);
}

function makeSandTexture() {
  return makeCanvasTexture(512, 512, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#e8c98a');
    grad.addColorStop(0.5, '#dfc07a');
    grad.addColorStop(1, '#eeda9e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, 3200, 0.12);
    // soft dune ripples
    ctx.strokeStyle = 'rgba(180,140,70,0.18)';
    ctx.lineWidth = 5;
    for (let y = 20; y < h; y += 46) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y + Math.sin(x / 60) * 6);
      ctx.stroke();
    }
  }, 6, 6);
}

function makeBoardwalkTexture() {
  return makeCanvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#8a6a45';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) {
      const shade = 0.85 + Math.random() * 0.3;
      ctx.fillStyle = `rgb(${Math.floor(150 * shade)},${Math.floor(112 * shade)},${Math.floor(70 * shade)})`;
      ctx.fillRect(0, y, w, 30);
      ctx.fillStyle = 'rgba(40,24,8,0.6)';
      ctx.fillRect(0, y + 30, w, 2);
      grain(ctx, w, 32, 120, 0.10);
    }
  }, 2, 8);
}

function makeGlassTowerTexture(baseHue) {
  return makeCanvasTexture(512, 1024, (ctx, w, h) => {
    // sunset-mirrored glass: warm gradient with lit window grid
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, `hsl(${baseHue}, 42%, 58%)`);
    grad.addColorStop(0.45, `hsl(${baseHue + 12}, 55%, 46%)`);
    grad.addColorStop(1, `hsl(${baseHue + 26}, 62%, 34%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    // window grid — some lit gold, some dark
    for (let y = 14; y < h - 14; y += 34) {
      for (let x = 14; x < w - 14; x += 30) {
        const lit = Math.random();
        if (lit < 0.42) ctx.fillStyle = `rgba(255,${190 + Math.floor(Math.random() * 50)},90,${0.85})`;
        else if (lit < 0.72) ctx.fillStyle = 'rgba(58,78,118,0.9)';
        else ctx.fillStyle = 'rgba(140,175,220,0.6)';
        ctx.fillRect(x, y, 20, 22);
      }
    }
    // vertical mullions
    ctx.fillStyle = 'rgba(10,14,26,0.35)';
    for (let x = 0; x < w; x += 30) ctx.fillRect(x, 0, 2, h);
  });
}

function makeArtDecoTexture(palette) {
  return makeCanvasTexture(512, 768, (ctx, w, h) => {
    ctx.fillStyle = palette.wall;
    ctx.fillRect(0, 0, w, h);
    // deco vertical ribs
    ctx.fillStyle = palette.trim;
    for (let x = 0; x < w; x += 64) ctx.fillRect(x, 0, 10, h);
    // arched windows with warm light
    for (let y = 30; y < h - 60; y += 96) {
      for (let x = 32; x < w - 32; x += 64) {
        ctx.fillStyle = 'rgba(30,20,40,0.9)';
        ctx.fillRect(x, y, 34, 52);
        ctx.fillStyle = Math.random() < 0.6 ? 'rgba(255,205,110,0.95)' : 'rgba(150,200,255,0.75)';
        ctx.fillRect(x + 4, y + 4, 26, 44);
        // awning stripe
        ctx.fillStyle = palette.awning;
        ctx.fillRect(x - 4, y + 52, 42, 10);
      }
    }
    // deco crown band
    ctx.fillStyle = palette.trim;
    ctx.fillRect(0, 0, w, 18);
    ctx.fillStyle = palette.accent;
    ctx.fillRect(0, 18, w, 6);
    grain(ctx, w, h, 700, 0.05);
  });
}

function makeNeonShopTexture(base, accent) {
  return makeCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, 500, 0.08);
    // big shopfront windows, glowing
    for (let x = 24; x < w - 24; x += 110) {
      ctx.fillStyle = 'rgba(255,190,90,0.9)';
      ctx.fillRect(x, h * 0.42, 86, h * 0.34);
      ctx.fillStyle = 'rgba(20,10,30,0.85)';
      ctx.fillRect(x + 6, h * 0.42 + 6, 74, h * 0.34 - 12);
    }
    // neon band
    ctx.fillStyle = accent;
    ctx.fillRect(0, h * 0.12, w, 26);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(0, h * 0.12 + 10, w, 4);
    // upper windows
    ctx.fillStyle = 'rgba(255,220,150,0.85)';
    for (let x = 30; x < w - 30; x += 64) ctx.fillRect(x, h * 0.24, 38, 44);
  });
}

function makeIndustrialTexture() {
  return makeCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#7a7468';
    ctx.fillRect(0, 0, w, h);
    // corrugated metal ridges
    for (let x = 0; x < w; x += 18) {
      ctx.fillStyle = x % 36 === 0 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.16)';
      ctx.fillRect(x, 0, 8, h);
    }
    // rust streaks
    for (let i = 0; i < 22; i++) {
      ctx.fillStyle = `rgba(140,70,30,${0.08 + Math.random() * 0.14})`;
      const x = Math.random() * w;
      ctx.fillRect(x, Math.random() * h * 0.4, 6 + Math.random() * 10, 60 + Math.random() * 160);
    }
    ctx.fillStyle = 'rgba(30,30,30,0.7)';
    for (let y = 60; y < h; y += 150) ctx.fillRect(20, y, w - 40, 46);
    grain(ctx, w, h, 900, 0.09);
  });
}

function makeConcreteTexture() {
  return makeCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#8d8a86';
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, 1400, 0.10);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, w - 8, h - 8);
  }, 2, 2);
}

export function makeSignTexture(text, subtext, opts = {}) {
  const { bg = '#101828', fg = '#ffd24d', glow = '#ff9a3c', font = '900 64px Arial', subFont = '700 30px Arial' } = opts;
  return makeCanvasTexture(1024, 256, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = glow;
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.shadowColor = glow;
    ctx.shadowBlur = 26;
    ctx.fillStyle = fg;
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, subtext ? h / 2 - 22 : h / 2);
    if (subtext) {
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffffff';
      ctx.font = subFont;
      ctx.fillText(subtext, w / 2, h / 2 + 58);
    }
  });
}

export function makeBillboardTexture(lines, bg1, bg2, accent) {
  return makeCanvasTexture(1024, 512, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, bg1);
    grad.addColorStop(1, bg2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = accent;
    ctx.fillRect(0, h - 26, w, 26);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 92px Arial';
    lines.forEach((line, i) => {
      ctx.fillText(line, w / 2, h / 2 - (lines.length - 1) * 56 + i * 112);
    });
  });
}

export function createTextures() {
  const glassA = makeGlassTowerTexture(212);
  const glassB = makeGlassTowerTexture(28);
  const glassC = makeGlassTowerTexture(168);
  return {
    asphalt: makeAsphaltTexture(),
    crosswalk: makeCrosswalkTexture(),
    sidewalk: makeSidewalkTexture(),
    sand: makeSandTexture(),
    boardwalk: makeBoardwalkTexture(),
    concrete: makeConcreteTexture(),
    industrial: makeIndustrialTexture(),
    glassA, glassB, glassC,
    decoPink: makeArtDecoTexture({ wall: '#f2a7b8', trim: '#fff3e0', awning: '#2ec4b6', accent: '#ff7b54' }),
    decoMint: makeArtDecoTexture({ wall: '#9fd8c9', trim: '#fff8e6', awning: '#ff5f8f', accent: '#ffd24d' }),
    decoCream: makeArtDecoTexture({ wall: '#f6e3c2', trim: '#d97b4f', awning: '#2a9d8f', accent: '#e76f51' }),
    neonCyan: makeNeonShopTexture('#141b2e', '#19e3ff'),
    neonMagenta: makeNeonShopTexture('#221026', '#ff3fd4'),
    neonAmber: makeNeonShopTexture('#241a08', '#ffb347'),
    signs: {
      solaris: makeSignTexture('SOLARIS BANK', 'CENTRO FINANCIERO', { bg: '#0d1b33', fg: '#7ec8ff', glow: '#3aa7ff' }),
      palma: makeSignTexture('PALMA CLUB', 'LIVE MUSIC • COCKTAILS', { bg: '#1c0f2e', fg: '#ff5fd0', glow: '#ff3fd4' }),
      veloz: makeSignTexture('VELOZ MOTORS', 'SPORTS • MUSCLE • TUNING', { bg: '#160f08', fg: '#ffb347', glow: '#ff9a3c' }),
      cafe: makeSignTexture('CAFE MIRADOR', 'COFFEE • SUNSET VIEW', { bg: '#10231c', fg: '#9dff7e', glow: '#5ee66b' }),
      mkpd: makeSignTexture('MKPD', 'MIRADOR KEYS POLICE', { bg: '#0a1226', fg: '#ffffff', glow: '#3aa7ff' }),
      chop: makeSignTexture('CHOP SHOP', 'ARMOR • TURBO • RESPRAY', { bg: '#1a0f00', fg: '#ffd24d', glow: '#ff9a3c' }),
    },
    billboards: {
      synth: makeBillboardTexture(['MIRADOR', 'SYNTHWAVE FM'], '#2a1052', '#ff5f8f', '#19e3ff'),
      veloz: makeBillboardTexture(['VELOZ MOTORS', 'DRIVE THE SUNSET'], '#3a1408', '#ffb347', '#ff5f2e'),
      palms: makeBillboardTexture(['PALMA CLUB', 'TONIGHT • NEON NIGHTS'], '#0d2b3a', '#19e3ff', '#ff5fd0'),
    },
  };
}
