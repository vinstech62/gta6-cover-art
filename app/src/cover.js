/* Vice City Cover Maker - cover painter.
 *
 * Pure canvas painting for the multi-panel cover: photos are cover-fit
 * into panels, tinted with a colour grade, dusted with deterministic
 * film grain, and finished with a sunset caption band (sun, halftone
 * dots, palm silhouettes and big Anton lettering).
 *
 * Classic script: attaches drawCover, computeLayout and ViceCoverGrades
 * to window. No modules, no network, no dependencies.
 */
(function () {
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

  var DEFAULT_GRADE = 'sunset';
  var GRAIN_SEED = 20261119;
  var HALFTONE_SEED = 977351;

  function clamp(value, lo, hi) {
    return value < lo ? lo : (value > hi ? hi : value);
  }

  /* Deterministic PRNG (mulberry32) so renders are reproducible. */
  function makeRng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Geometry: the caption band takes the bottom 28% of the height; the
   * photo area above it is divided according to the chosen layout. */
  function computeLayout(width, height, layout) {
    var bandH = Math.round(height * 0.28);
    var photoH = height - bandH;
    var gap = Math.max(8, Math.round(width * 0.012));
    var panels = [];
    var name = layout || 'five-panel';

    if (name === 'classic') {
      var heroW = Math.round(width * 0.62);
      var colX = heroW + gap;
      var colW = width - colX;
      var halfH = Math.floor((photoH - gap) / 2);
      panels.push({ x: 0, y: 0, w: heroW, h: photoH });
      panels.push({ x: colX, y: 0, w: colW, h: halfH });
      panels.push({ x: colX, y: halfH + gap, w: colW, h: photoH - halfH - gap });
    } else if (name === 'full-bleed') {
      panels.push({ x: 0, y: 0, w: width, h: photoH });
      var insetW = Math.round(width * 0.30);
      var insetH = Math.round(photoH * 0.28);
      var insetY = photoH - insetH - gap;
      panels.push({ x: gap, y: insetY, w: insetW, h: insetH });
      panels.push({ x: width - insetW - gap, y: insetY, w: insetW, h: insetH });
    } else {
      /* five-panel (default) */
      var heroW5 = Math.round(width * 0.62);
      var heroH5 = Math.round(photoH * 0.62);
      var colX5 = heroW5 + gap;
      var colW5 = width - colX5;
      var halfTop = Math.floor((heroH5 - gap) / 2);
      var bottomY = heroH5 + gap;
      var bottomH = photoH - bottomY;
      var halfW = Math.floor((width - gap) / 2);
      panels.push({ x: 0, y: 0, w: heroW5, h: heroH5 });
      panels.push({ x: colX5, y: 0, w: colW5, h: halfTop });
      panels.push({ x: colX5, y: halfTop + gap, w: colW5, h: heroH5 - halfTop - gap });
      panels.push({ x: 0, y: bottomY, w: halfW, h: bottomH });
      panels.push({ x: halfW + gap, y: bottomY, w: width - halfW - gap, h: bottomH });
    }

    return {
      band: { x: 0, y: photoH, w: width, h: bandH },
      panels: panels,
      gap: gap
    };
  }

  function drawPhotoCover(ctx, img, rect, fx, fy, zoom) {
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    var scale = Math.max(rect.w / iw, rect.h / ih) * clamp(zoom || 1, 1, 3);
    var sw = rect.w / scale;
    var sh = rect.h / scale;
    var sx = clamp((fx == null ? 0.5 : fx) * iw - sw / 2, 0, Math.max(0, iw - sw));
    var sy = clamp((fy == null ? 0.5 : fy) * ih - sh / 2, 0, Math.max(0, ih - sh));
    ctx.drawImage(img, sx, sy, sw, sh, rect.x, rect.y, rect.w, rect.h);
  }

  function drawPanel(ctx, rect, img, spec, grade) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();

    if (img && (img.naturalWidth || img.width)) {
      drawPhotoCover(ctx, img, rect, spec.fx, spec.fy, spec.zoom);
    } else {
      var fill = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
      fill.addColorStop(0, grade.panel[0]);
      fill.addColorStop(1, grade.panel[2]);
      ctx.fillStyle = fill;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }

    /* Grade tint: the three panel colours swept diagonally, soft light. */
    var tint = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
    tint.addColorStop(0, grade.panel[0]);
    tint.addColorStop(0.5, grade.panel[1]);
    tint.addColorStop(1, grade.panel[2]);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = tint;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    /* Vignette: transparent in the middle, dark at the corners. */
    var cx = rect.x + rect.w / 2;
    var cy = rect.y + rect.h / 2;
    var inner = Math.min(rect.w, rect.h) * 0.36;
    var outer = Math.sqrt(rect.w * rect.w + rect.h * rect.h) / 2;
    var vig = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
    ctx.fillStyle = vig;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

    ctx.restore();

    /* Panel border. */
    ctx.save();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(12, 4, 20, 0.92)';
    ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
    ctx.restore();
  }

  function drawGrain(ctx, width, height) {
    var count = Math.min(6000, Math.floor((width * height) / 900));
    if (count <= 0) return;
    var rng = makeRng(GRAIN_SEED);
    for (var i = 0; i < count; i++) {
      var x = rng() * width;
      var y = rng() * height;
      var s = rng() < 0.5 ? 1 : 2;
      if (rng() < 0.5) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      } else {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
      }
      ctx.fillRect(x, y, s, s);
    }
  }

  function fadedRgba(rgba) {
    return rgba.replace(/[\d.]+(\s*\))/, '0$1');
  }

  function drawPalm(ctx, baseX, baseY, size, lean) {
    var topX = baseX + lean * size;
    var topY = baseY - size;
    ctx.save();
    ctx.strokeStyle = '#160a24';
    ctx.lineCap = 'round';

    /* Leaning trunk. */
    ctx.lineWidth = Math.max(2, size * 0.045);
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.quadraticCurveTo(
      baseX + lean * size * 0.35,
      baseY - size * 0.6,
      topX,
      topY
    );
    ctx.stroke();

    /* Seven fronds fanning from the crown, drooping at the tips. */
    ctx.lineWidth = Math.max(1.5, size * 0.028);
    for (var i = 0; i < 7; i++) {
      var t = i / 6;
      var angle = Math.PI * (0.92 + 1.16 * t); /* left, over the top, right */
      var len = size * 0.55 * (0.78 + 0.34 * Math.sin(t * Math.PI));
      var endX = topX + Math.cos(angle) * len;
      var endY = topY + Math.sin(angle) * len + len * 0.34;
      var ctrlX = topX + Math.cos(angle) * len * 0.55;
      var ctrlY = topY + Math.sin(angle) * len * 0.55 - len * 0.16;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBand(ctx, band, caption, subCaption, grade) {
    var x = band.x;
    var y = band.y;
    var w = band.w;
    var h = band.h;
    var cx = x + w / 2;

    /* Sunset gradient through the five band colours. */
    var grad = ctx.createLinearGradient(0, y, 0, y + h);
    for (var i = 0; i < grade.band.length; i++) {
      grad.addColorStop(i / (grade.band.length - 1), grade.band[i]);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    /* Sun glow, then the disc itself. */
    var sunR = h * 0.36;
    var sunY = y + h * 0.34;
    var glow = ctx.createRadialGradient(cx, sunY, 0, cx, sunY, sunR * 2.7);
    glow.addColorStop(0, grade.glow);
    glow.addColorStop(1, fadedRgba(grade.glow));
    ctx.fillStyle = glow;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = grade.sun;
    ctx.beginPath();
    ctx.arc(cx, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();

    /* Halftone dots fading down from the top of the band. */
    var rng = makeRng(HALFTONE_SEED);
    var rows = 5;
    var spacing = Math.max(10, h * 0.085);
    ctx.fillStyle = grade.sun;
    for (var r = 0; r < rows; r++) {
      ctx.globalAlpha = 0.5 * (1 - r / rows) + 0.06;
      var dotY = y + h * 0.055 + r * h * 0.048;
      for (var dotX = x + spacing * 0.6; dotX < x + w; dotX += spacing) {
        var jitter = (rng() - 0.5) * spacing * 0.4;
        ctx.beginPath();
        ctx.arc(dotX + jitter, dotY, Math.max(1.2, h * 0.014), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    /* Palms framing the band from both bottom corners. */
    drawPalm(ctx, x + w * 0.05, y + h * 0.99, h * 0.78, 0.38);
    drawPalm(ctx, x + w * 0.95, y + h * 0.99, h * 0.85, -0.38);

    /* Main caption: big Anton lettering, auto-fit to the band. */
    var text = String(caption == null ? '' : caption).toUpperCase();
    if (text) {
      var size = h * 0.52;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = size + 'px Anton, "Arial Black", sans-serif';
      while (ctx.measureText(text).width > w * 0.86 && size > 10) {
        size *= 0.94;
        ctx.font = size + 'px Anton, "Arial Black", sans-serif';
      }
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = size * 0.16;
      ctx.shadowOffsetY = size * 0.05;
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2, size * 0.15);
      ctx.strokeStyle = '#14041f';
      var textY = y + h * 0.44;
      ctx.strokeText(text, cx, textY);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, cx, textY);
      ctx.restore();
    }

    /* Sub-caption: letter-spaced Anton under the main caption. */
    var sub = String(subCaption == null ? '' : subCaption).toUpperCase();
    if (sub) {
      var subSize = h * 0.13;
      var tracking = subSize * 0.42;
      ctx.font = subSize + 'px Anton, "Arial Black", sans-serif';
      ctx.textBaseline = 'middle';
      var widths = [];
      var total = 0;
      for (var c = 0; c < sub.length; c++) {
        var cw = ctx.measureText(sub.charAt(c)).width;
        widths.push(cw);
        total += cw;
      }
      total += tracking * (sub.length - 1);
      var cursor = cx - total / 2;
      var subY = y + h * 0.82;
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(1.5, subSize * 0.14);
      ctx.strokeStyle = '#14041f';
      ctx.fillStyle = '#ffffff';
      for (var k = 0; k < sub.length; k++) {
        var ch = sub.charAt(k);
        ctx.textAlign = 'center';
        var centre = cursor + widths[k] / 2;
        ctx.strokeText(ch, centre, subY);
        ctx.fillText(ch, centre, subY);
        cursor += widths[k] + tracking;
      }
      ctx.restore();
    }
  }

  function drawCover(canvas, photos, panels, caption, subCaption, gradeName, layoutName) {
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var width = canvas.width;
    var height = canvas.height;
    var grade = GRADES[gradeName] || GRADES[DEFAULT_GRADE];
    var layout = computeLayout(width, height, layoutName || 'five-panel');

    ctx.fillStyle = '#12081f';
    ctx.fillRect(0, 0, width, height);

    for (var i = 0; i < layout.panels.length; i++) {
      var spec = (panels && panels[i]) || {};
      var photoIndex = typeof spec.photo === 'number' ? spec.photo : 0;
      var img = photos ? photos[photoIndex] : null;
      drawPanel(ctx, layout.panels[i], img, {
        fx: typeof spec.fx === 'number' ? spec.fx : 0.5,
        fy: typeof spec.fy === 'number' ? spec.fy : 0.5,
        zoom: typeof spec.zoom === 'number' ? spec.zoom : 1
      }, grade);
    }

    drawGrain(ctx, width, height);
    drawBand(ctx, layout.band, caption, subCaption, grade);
  }

  window.drawCover = drawCover;
  window.computeLayout = computeLayout;
  window.ViceCoverGrades = GRADES;
})();
