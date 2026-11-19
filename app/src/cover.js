/* Vice City Cover Maker: the cover painter.
 *
 * drawCover(canvas, photos, panels, caption, subCaption, grade) paints one
 * multi-panel GTA-style poster: photos in panels up top, a sunset caption
 * band along the bottom. Every number derives from the canvas size, so the
 * same call works for 1080x1080, 1080x1350 and 1920x1080.
 *
 * Panels carry { photo, fx, fy, zoom }: which photo, the focus point inside
 * it (0..1) and a zoom from 1 to 3. The film grain comes from a fixed-seed
 * generator, so the same inputs always paint the same pixels.
 */

(function (global) {
  'use strict';

  var GRADES = {
    'sunset': {
      label: 'Sunset',
      panel: ['#6d28d9', '#db2777', '#f97316'],
      band: ['#2e1065', '#7e22ce', '#db2777', '#f97316', '#fbbf24'],
      sun: '#ffd166',
      glow: 'rgba(255, 122, 61, 0.55)'
    },
    'neon-night': {
      label: 'Neon Night',
      panel: ['#0f2a6b', '#6d28d9', '#ec4899'],
      band: ['#020617', '#1e1b4b', '#6d28d9', '#c026d3', '#ec4899'],
      sun: '#f0abfc',
      glow: 'rgba(236, 72, 153, 0.6)'
    },
    'vice-pink': {
      label: 'Vice Pink',
      panel: ['#831843', '#db2777', '#f472b6'],
      band: ['#500724', '#9d174d', '#db2777', '#f472b6', '#fbcfe8'],
      sun: '#fff1f2',
      glow: 'rgba(219, 39, 119, 0.55)'
    },
    'golden-hour': {
      label: 'Golden Hour',
      panel: ['#92400e', '#d97706', '#facc15'],
      band: ['#451a03', '#92400e', '#d97706', '#f59e0b', '#fde68a'],
      sun: '#fef3c7',
      glow: 'rgba(245, 158, 11, 0.55)'
    },
    'midnight-teal': {
      label: 'Midnight Teal',
      panel: ['#042f2e', '#0f766e', '#2dd4bf'],
      band: ['#022c22', '#134e4a', '#0f766e', '#14b8a6', '#99f6e4'],
      sun: '#ccfbf1',
      glow: 'rgba(45, 212, 191, 0.5)'
    }
  };

  var FONT_FAMILY = '"Anton", "Arial Black", sans-serif';
  var GRAIN_SEED = 20261119;

  function gradeOf(name) {
    return GRADES[name] || GRADES['sunset'];
  }

  function clamp(value, low, high) {
    return value < low ? low : value > high ? high : value;
  }

  /* A tiny fixed-seed generator: the same seed paints the same grain. */
  function seededRandom(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Panel rectangles for a layout, all in canvas pixels. The photo area
   * sits above a caption band 28% of the canvas height. */
  function computeLayout(width, height, layout) {
    var bandH = Math.round(height * 0.28);
    var photoH = height - bandH;
    var gap = Math.max(8, Math.round(width * 0.012));
    var panels = [];
    var band = { x: 0, y: photoH, w: width, h: bandH };
    var heroW, rightX, rightW, topH, bottomY, bottomH;

    if (layout === 'classic') {
      heroW = Math.round(width * 0.62) - Math.round(gap / 2);
      rightX = heroW + gap;
      rightW = width - rightX;
      panels.push({ x: 0, y: 0, w: heroW, h: photoH });
      panels.push({ x: rightX, y: 0, w: rightW, h: Math.floor((photoH - gap) / 2) });
      panels.push({ x: rightX, y: Math.floor((photoH - gap) / 2) + gap, w: rightW, h: photoH - Math.floor((photoH - gap) / 2) - gap });
    } else if (layout === 'full-bleed') {
      panels.push({ x: 0, y: 0, w: width, h: photoH });
      var insetW = Math.round(width * 0.3);
      var insetH = Math.round(photoH * 0.28);
      panels.push({ x: gap, y: photoH - insetH - gap, w: insetW, h: insetH });
      panels.push({ x: width - insetW - gap, y: photoH - insetH - gap, w: insetW, h: insetH });
    } else {
      /* five-panel: hero top-left, two stacked top-right, two along the bottom. */
      topH = Math.round(photoH * 0.62);
      bottomY = topH + gap;
      bottomH = photoH - bottomY;
      heroW = Math.round(width * 0.62) - Math.round(gap / 2);
      rightX = heroW + gap;
      rightW = width - rightX;
      panels.push({ x: 0, y: 0, w: heroW, h: topH });
      panels.push({ x: rightX, y: 0, w: rightW, h: Math.floor((topH - gap) / 2) });
      panels.push({ x: rightX, y: Math.floor((topH - gap) / 2) + gap, w: rightW, h: topH - Math.floor((topH - gap) / 2) - gap });
      panels.push({ x: 0, y: bottomY, w: Math.floor((width - gap) / 2), h: bottomH });
      panels.push({ x: Math.floor((width - gap) / 2) + gap, y: bottomY, w: width - Math.floor((width - gap) / 2) - gap, h: bottomH });
    }

    return { band: band, panels: panels, gap: gap };
  }

  /* Draw one photo so it covers its panel, cropped around the focus point. */
  function drawPhotoCover(ctx, img, rect, fx, fy, zoom) {
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    var base = Math.max(rect.w / iw, rect.h / ih);
    var scale = base * clamp(zoom || 1, 1, 3);
    var sw = rect.w / scale;
    var sh = rect.h / scale;
    var cx = clamp(fx, 0, 1) * iw;
    var cy = clamp(fy, 0, 1) * ih;
    var sx = clamp(cx - sw / 2, 0, Math.max(0, iw - sw));
    var sy = clamp(cy - sh / 2, 0, Math.max(0, ih - sh));
    ctx.drawImage(img, sx, sy, sw, sh, rect.x, rect.y, rect.w, rect.h);
  }

  function drawGradeOverlay(ctx, rect, grade) {
    var grad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
    grad.addColorStop(0, grade.panel[0]);
    grad.addColorStop(0.55, grade.panel[1]);
    grad.addColorStop(1, grade.panel[2]);
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = grad;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  }

  function drawVignette(ctx, rect) {
    var cx = rect.x + rect.w / 2;
    var cy = rect.y + rect.h / 2;
    var r = Math.max(rect.w, rect.h) * 0.72;
    var grad = ctx.createRadialGradient(cx, cy, r * 0.35, cx, cy, r);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  }

  function drawPanel(ctx, img, rect, panel, grade) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    if (img) {
      drawPhotoCover(ctx, img, rect, panel.fx, panel.fy, panel.zoom);
    } else {
      var grad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
      grad.addColorStop(0, grade.panel[0]);
      grad.addColorStop(1, grade.panel[2]);
      ctx.fillStyle = grad;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    drawGradeOverlay(ctx, rect, grade);
    drawVignette(ctx, rect);
    ctx.restore();
    ctx.save();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(12, 4, 20, 0.92)';
    ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
    ctx.restore();
  }

  /* One palm tree, drawn as paths: a leaning trunk and seven fronds. */
  function drawPalm(ctx, x, y, size, lean) {
    var topX = x + lean * size;
    var topY = y - size;
    ctx.save();
    ctx.strokeStyle = '#160a24';
    ctx.lineWidth = Math.max(3, size * 0.06);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + lean * size * 0.3, y - size * 0.55, topX, topY);
    ctx.stroke();
    ctx.lineWidth = Math.max(2, size * 0.035);
    var fronds = 7;
    for (var i = 0; i < fronds; i++) {
      var angle = Math.PI * (0.08 + (i / (fronds - 1)) * 0.84);
      var len = size * (0.52 + 0.18 * Math.sin(i * 1.7));
      var endX = topX + Math.cos(angle) * len;
      var endY = topY + Math.sin(angle) * len * 0.38 + size * 0.04;
      var midX = topX + Math.cos(angle) * len * 0.55;
      var midY = topY + Math.sin(angle) * len * 0.2 - size * 0.14;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(midX, midY, endX, endY);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHalftone(ctx, band, grade) {
    var rand = seededRandom(GRAIN_SEED + 77);
    var rows = 5;
    for (var r = 0; r < rows; r++) {
      var y = band.y + 10 + r * 9;
      var alpha = 0.28 - r * 0.045;
      if (alpha <= 0) break;
      ctx.save();
      ctx.fillStyle = grade.sun;
      ctx.globalAlpha = alpha;
      for (var x = band.x + 14; x < band.x + band.w - 14; x += 16) {
        var jitter = (rand() - 0.5) * 4;
        ctx.beginPath();
        ctx.arc(x + jitter, y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawFilmGrain(ctx, width, height) {
    var rand = seededRandom(GRAIN_SEED);
    var count = Math.min(6000, Math.floor((width * height) / 900));
    ctx.save();
    for (var i = 0; i < count; i++) {
      var v = rand();
      ctx.fillStyle = v > 0.5 ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.06)';
      var s = rand() > 0.85 ? 2 : 1;
      ctx.fillRect(Math.floor(rand() * width), Math.floor(rand() * height), s, s);
    }
    ctx.restore();
  }

  function fitCaptionSize(ctx, text, maxWidth, startSize) {
    var size = startSize;
    ctx.font = size + 'px ' + FONT_FAMILY;
    while (size > 12 && ctx.measureText(text).width > maxWidth) {
      size -= 2;
      ctx.font = size + 'px ' + FONT_FAMILY;
    }
    return size;
  }

  function drawCaptionBand(ctx, band, caption, subCaption, grade) {
    var grad = ctx.createLinearGradient(band.x, band.y, band.x, band.y + band.h);
    var stops = grade.band;
    for (var i = 0; i < stops.length; i++) {
      grad.addColorStop(i / (stops.length - 1), stops[i]);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(band.x, band.y, band.w, band.h);

    /* Sun, low behind the lettering. */
    var sunR = band.h * 0.36;
    var sunX = band.x + band.w * 0.5;
    var sunY = band.y + band.h * 0.34;
    var glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 2.1);
    glow.addColorStop(0, grade.glow);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(band.x, band.y, band.w, band.h);
    ctx.save();
    ctx.fillStyle = grade.sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawHalftone(ctx, band, grade);

    /* Palms frame the band from both edges. */
    var palmSize = band.h * 0.78;
    drawPalm(ctx, band.x + band.w * 0.045, band.y + band.h - 6, palmSize, 0.28);
    drawPalm(ctx, band.x + band.w * 0.955, band.y + band.h - 6, palmSize * 0.85, -0.28);

    var text = (caption || 'VICE CITY').toUpperCase();
    var maxW = band.w * 0.86;
    var size = fitCaptionSize(ctx, text, maxW, Math.round(band.h * 0.52));
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = size + 'px ' + FONT_FAMILY;
    var capY = band.y + band.h * 0.44;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = Math.round(size * 0.12);
    ctx.shadowOffsetY = Math.round(size * 0.06);
    ctx.lineWidth = Math.max(4, Math.round(size * 0.11));
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#14041f';
    ctx.strokeText(text, band.x + band.w / 2, capY);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, band.x + band.w / 2, capY);
    ctx.restore();

    var sub = (subCaption || '').toUpperCase();
    if (sub) {
      var subSize = Math.max(12, Math.round(band.h * 0.13));
      var tracking = Math.round(subSize * 0.42);
      ctx.save();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.lineWidth = Math.max(2, Math.round(subSize * 0.12));
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(20, 4, 31, 0.9)';
      var subY = band.y + band.h * 0.82;
      ctx.font = subSize + 'px ' + FONT_FAMILY;
      var widths = [];
      var total = 0;
      for (var k = 0; k < sub.length; k++) {
        var cw = ctx.measureText(sub[k]).width;
        widths.push(cw);
        total += cw;
      }
      total += tracking * Math.max(0, sub.length - 1);
      var sx = band.x + band.w / 2 - total / 2;
      for (var m = 0; m < sub.length; m++) {
        ctx.strokeText(sub[m], sx, subY);
        ctx.fillText(sub[m], sx, subY);
        sx += widths[m] + tracking;
      }
      ctx.restore();
    }
  }

  function drawCover(canvas, photos, panels, caption, subCaption, gradeName, layoutName) {
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var width = canvas.width;
    var height = canvas.height;
    var grade = gradeOf(gradeName);
    var panelList = panels || [];
    var layout = computeLayout(width, height, layoutName || 'five-panel');
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#12081f';
    ctx.fillRect(0, 0, width, height);
    for (var i = 0; i < layout.panels.length; i++) {
      var slot = layout.panels[i];
      var spec = panelList[i] || { photo: 0, fx: 0.5, fy: 0.5, zoom: 1 };
      var img = photos && photos[spec.photo] ? photos[spec.photo] : null;
      drawPanel(ctx, img, slot, spec, grade);
    }
    drawFilmGrain(ctx, width, height);
    drawCaptionBand(ctx, layout.band, caption, subCaption, grade);
  }

  global.drawCover = drawCover;
  global.computeLayout = computeLayout;
  global.ViceCoverGrades = GRADES;
})(typeof window !== 'undefined' ? window : globalThis);
