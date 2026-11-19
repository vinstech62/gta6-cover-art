// Vice City Cover Maker: draws a multi-panel GTA-style poster cover.
// Three layouts (Classic, Five-panel, Full-bleed) and five colour grades.
// Every render is deterministic: no Math.random, no Date.now, fixed-seed grain.

/** Colour stops for each grade: [bandTop, bandMid, bandBot, sun, tintTop, tintBot]. */
export const GRADES = {
  sunset: ['#3b1d5e', '#c2185b', '#ff7a1a', '#ffd23f', 'rgba(255, 45, 149, 0.20)', 'rgba(255, 122, 26, 0.28)'],
  neon: ['#12082e', '#7b2ff7', '#00c2ff', '#ff2e88', 'rgba(123, 47, 247, 0.22)', 'rgba(0, 229, 255, 0.24)'],
  pink: ['#2a0a3d', '#ff2e88', '#ff8fb3', '#fff176', 'rgba(255, 46, 136, 0.22)', 'rgba(255, 143, 179, 0.26)'],
  golden: ['#3d1c02', '#d97706', '#fbbf24', '#fff7cc', 'rgba(217, 119, 6, 0.22)', 'rgba(251, 191, 36, 0.26)'],
  teal: ['#031525', '#0e7490', '#2dd4bf', '#a5f3fc', 'rgba(14, 116, 144, 0.24)', 'rgba(45, 212, 191, 0.26)'],
};

export const LAYOUTS = ['classic', 'five', 'fullbleed'];

/** Default panels per layout: photos cycle [0,1,2,0,1], each framed on a different part. */
export function defaultPanels(layout = 'five') {
  if (layout === 'classic') {
    return [
      { photoIndex: 0, focusX: 0.5, focusY: 0.35, zoom: 1 },
      { photoIndex: 1, focusX: 0.5, focusY: 0.25, zoom: 1 },
      { photoIndex: 2, focusX: 0.5, focusY: 0.75, zoom: 1 },
    ];
  }
  if (layout === 'fullbleed') {
    return [
      { photoIndex: 0, focusX: 0.5, focusY: 0.35, zoom: 1 },
      { photoIndex: 1, focusX: 0.2, focusY: 0.5, zoom: 1 },
      { photoIndex: 2, focusX: 0.8, focusY: 0.5, zoom: 1 },
    ];
  }
  return [
    { photoIndex: 0, focusX: 0.5, focusY: 0.35, zoom: 1 },
    { photoIndex: 1, focusX: 0.5, focusY: 0.25, zoom: 1 },
    { photoIndex: 2, focusX: 0.5, focusY: 0.75, zoom: 1 },
    { photoIndex: 0, focusX: 0.2, focusY: 0.3, zoom: 1 },
    { photoIndex: 1, focusX: 0.8, focusY: 0.3, zoom: 1 },
  ];
}

/** Classic layout: hero on the left, two stacked panels on the right. */
function classicRects(W, H) {
  const captionH = 0.28 * H;
  const panelsH = H - captionH;
  const g = Math.max(8, Math.round(W * 0.012));
  const heroW = Math.round((W - 3 * g) * 0.62);
  const rightX = g + heroW + g;
  const rightW = W - heroW - 3 * g;
  const halfH = (panelsH - 3 * g) / 2;
  return [
    { x: g, y: g, w: heroW, h: panelsH - 2 * g },
    { x: rightX, y: g, w: rightW, h: halfH },
    { x: rightX, y: g + halfH + g, w: rightW, h: halfH },
  ];
}

/** Five-panel layout: big hero left, two small stacked top-right, two small along the bottom. */
function fiveRects(W, H) {
  const captionH = 0.28 * H;
  const panelsH = H - captionH;
  const g = Math.max(8, Math.round(W * 0.012));
  const heroW = Math.round((W - 3 * g) * 0.62);
  const rightX = g + heroW + g;
  const rightW = W - heroW - 3 * g;
  const topH = Math.round((panelsH - 3 * g) * 0.62);
  const smallH = (topH - g) / 2;
  const botY = g + topH + g;
  const botH = panelsH - topH - 3 * g;
  const botW = (W - 3 * g) / 2;
  return [
    { x: g, y: g, w: heroW, h: topH },
    { x: rightX, y: g, w: rightW, h: smallH },
    { x: rightX, y: g + smallH + g, w: rightW, h: smallH },
    { x: g, y: botY, w: botW, h: botH },
    { x: g + botW + g, y: botY, w: botW, h: botH },
  ];
}

/** Full-bleed layout: one photo fills the panel area, two small panels inset at the bottom-right corner. */
function fullbleedRects(W, H) {
  const captionH = 0.28 * H;
  const panelsH = H - captionH;
  const g = Math.max(8, Math.round(W * 0.012));
  const insetW = Math.round((W - 2 * g) * 0.3);
  const insetH = Math.round((panelsH - 2 * g) * 0.36);
  const insetY = g + panelsH - 2 * g - insetH;
  return [
    { x: g, y: g, w: W - 2 * g, h: panelsH - 2 * g },
    { x: W - g - 2 * insetW - g, y: insetY, w: insetW, h: insetH },
    { x: W - g - insetW, y: insetY, w: insetW, h: insetH },
  ];
}

/** Panel rectangles for a canvas of W x H, for the given layout. */
export function panelRects(W, H, layout = 'five') {
  if (layout === 'classic') return classicRects(W, H);
  if (layout === 'fullbleed') return fullbleedRects(W, H);
  return fiveRects(W, H);
}

// --- deterministic grain: a 128x128 noise tile from a fixed-seed LCG. ---
let grainTile = null;
function grainPattern(ctx) {
  if (grainTile) return grainTile;
  const tile = document.createElement('canvas');
  tile.width = 128;
  tile.height = 128;
  const tctx = tile.getContext('2d');
  const img = tctx.createImageData(128, 128);
  let seed = 20261119;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const v = seed >>> 24;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  tctx.putImageData(img, 0, 0);
  grainTile = ctx.createPattern(tile, 'repeat');
  return grainTile;
}

/** Draws one photo cover-fit inside a panel rect, cropped on its focus point. */
function drawPanelPhoto(ctx, photo, rect, focusX, focusY, zoom) {
  if (!photo) {
    ctx.fillStyle = '#241533';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    return;
  }
  const iw = photo.naturalWidth;
  const ih = photo.naturalHeight;
  const scale = Math.max(rect.w / iw, rect.h / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  let dx = rect.x + rect.w / 2 - focusX * dw;
  let dy = rect.y + rect.h / 2 - focusY * dh;
  dx = Math.min(rect.x, Math.max(rect.x + rect.w - dw, dx));
  dy = Math.min(rect.y, Math.max(rect.y + rect.h - dh, dy));
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.drawImage(photo, dx, dy, dw, dh);
  ctx.restore();
}

/** A palm silhouette, drawn from paths: a curved trunk and arcing fronds. */
function drawPalm(ctx, x, y, s, flip) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip ? -s : s, s);
  ctx.fillStyle = 'rgba(16, 6, 28, 0.9)';
  // Trunk: a gently curving stem.
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.quadraticCurveTo(-2, -60, 14, -118);
  ctx.quadraticCurveTo(18, -122, 20, -116);
  ctx.quadraticCurveTo(8, -58, 8, 0);
  ctx.closePath();
  ctx.fill();
  // Fronds: arcs fanning out from the crown.
  const fronds = [
    [-95, -150, -70, -185, -20, -128],
    [-70, -168, -30, -196, 12, -132],
    [-28, -178, 8, -198, 34, -130],
    [10, -172, 48, -182, 66, -128],
    [34, -158, 74, -152, 88, -104],
    [-58, -140, -96, -128, -104, -92],
  ];
  for (const [cx1, cy1, cx2, cy2, ex, ey] of fronds) {
    ctx.beginPath();
    ctx.moveTo(16, -118);
    ctx.quadraticCurveTo(cx1, cy1, cx2, cy2);
    ctx.quadraticCurveTo((cx2 + ex) / 2 + 8, (cy2 + ey) / 2 - 6, ex, ey);
    ctx.quadraticCurveTo((cx1 + 16) / 2, (cy1 - 118) / 2 - 4, 16, -118);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Draws text with manual letter spacing (deterministic across renderers). */
function drawSpacedText(ctx, text, cx, y, spacing) {
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
  let x = cx - total / 2;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  [...text].forEach((ch, i) => {
    ctx.fillText(ch, x, y);
    x += widths[i] + spacing;
  });
  ctx.textAlign = prevAlign;
}

/**
 * Draws the whole cover onto `canvas`.
 * @param {HTMLCanvasElement} canvas
 * @param {Array<HTMLImageElement|null>} photos - loaded photos by index
 * @param {Array<{photoIndex:number,focusX:number,focusY:number,zoom:number}>} panels
 * @param {string} caption - big title text
 * @param {string} subcaption - small line under the title
 * @param {string} grade - 'sunset' | 'neon' | 'pink' | 'golden' | 'teal'
 * @param {number} selected - index of the panel to highlight, or -1
 * @param {string} layout - 'classic' | 'five' | 'fullbleed'
 */
export function drawCover(canvas, photos, panels, caption, subcaption, grade, selected = -1, layout = 'five') {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const [bandTop, bandMid, bandBot, sunColor, tintTop, tintBot] = GRADES[grade] || GRADES.sunset;
  const captionH = 0.28 * H;
  const bandY = H - captionH;
  const rects = panelRects(W, H, layout);

  // Base.
  ctx.fillStyle = '#14101c';
  ctx.fillRect(0, 0, W, H);

  // Panels: photo, grade tint, vignette, grain, dark border.
  rects.forEach((rect, i) => {
    const p = panels[i] || defaultPanels(layout)[i];
    const photo = photos[p.photoIndex] ?? null;
    drawPanelPhoto(ctx, photo, rect, p.focusX, p.focusY, p.zoom);
    const tint = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    tint.addColorStop(0, tintTop);
    tint.addColorStop(1, tintBot);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = tint;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.globalCompositeOperation = 'source-over';
    const vig = ctx.createRadialGradient(
      rect.x + rect.w / 2, rect.y + rect.h / 2, Math.min(rect.w, rect.h) * 0.35,
      rect.x + rect.w / 2, rect.y + rect.h / 2, Math.max(rect.w, rect.h) * 0.75,
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(10,4,20,0.42)');
    ctx.fillStyle = vig;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = grainPattern(ctx);
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.globalAlpha = 1;
    ctx.lineWidth = layout === 'fullbleed' && i > 0 ? 6 : 4;
    ctx.strokeStyle = i === selected ? '#ff7a1a' : 'rgba(12, 6, 20, 0.95)';
    ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
  });

  // Caption band: grade gradient.
  const band = ctx.createLinearGradient(0, bandY, 0, H);
  band.addColorStop(0, bandTop);
  band.addColorStop(0.55, bandMid);
  band.addColorStop(1, bandBot);
  ctx.fillStyle = band;
  ctx.fillRect(0, bandY, W, captionH);

  // Sun, low in the band on the right.
  const sunR = captionH * 0.34;
  const sunX = W * 0.84;
  const sunY = bandY + captionH * 0.46;
  const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 2.2);
  glow.addColorStop(0, sunColor + '55');
  glow.addColorStop(1, sunColor + '00');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - sunR * 2.2, sunY - sunR * 2.2, sunR * 4.4, sunR * 4.4);
  ctx.fillStyle = sunColor;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();

  // Halftone dots across the band, fading toward the bottom.
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  const dotGap = Math.max(14, captionH * 0.14);
  for (let row = 0; row < 4; row++) {
    const y = bandY + captionH * 0.12 + row * dotGap;
    const r = Math.max(1.5, captionH * 0.028 * (1 - row * 0.18));
    for (let x = dotGap / 2 + (row % 2) * dotGap / 2; x < W; x += dotGap) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Palm silhouettes at both ends of the band.
  drawPalm(ctx, W * 0.03, bandY + captionH * 0.98, captionH / 170, false);
  drawPalm(ctx, W * 0.97, bandY + captionH * 0.98, captionH / 200, true);

  // Caption: Anton caps, white with a thick black outline and a drop shadow.
  const text = (caption || '').trim().toUpperCase();
  if (text) {
    let size = captionH * 0.52;
    ctx.font = `${size}px Anton, sans-serif`;
    while (ctx.measureText(text).width > W * 0.9 && size > 12) {
      size -= 2;
      ctx.font = `${size}px Anton, sans-serif`;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0d0518';
    ctx.lineWidth = Math.max(3, size * 0.16);
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = size * 0.12;
    ctx.shadowOffsetY = size * 0.05;
    const textY = bandY + captionH * 0.42;
    ctx.strokeText(text, W / 2, textY);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, W / 2, textY);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  // Sub-caption: small, letterspaced, under the title.
  const sub = (subcaption || '').trim().toUpperCase();
  if (sub) {
    const size = Math.max(10, captionH * 0.115);
    ctx.font = `${size}px Anton, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    drawSpacedText(ctx, sub, W / 2, bandY + captionH * 0.82, size * 0.42);
  }
}
