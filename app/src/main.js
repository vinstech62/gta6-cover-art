/* Vice City Cover Maker - editor wiring.
 *
 * Owns the app state (three photo slots, five panel specs, layout,
 * grade, post size, captions), binds every control on the page, and
 * handles pointer editing on the preview canvas: click to select a
 * panel, drag to move its photo, scroll to zoom it. Export renders the
 * cover offscreen at full size and downloads it as a PNG.
 *
 * Classic script; exposes window.ViceCityApp for the screenshot helper.
 */
(function () {
  'use strict';

  var PHOTO_ORDER = [0, 1, 2, 0, 1];
  var DEFAULT_ZOOM = 1.1;

  /* Focus presets when a single photo fills every panel: spread the
   * crops around so the panels do not all show the same spot. The hero
   * panel sits a little high, where faces usually are in a portrait. */
  var SINGLE_FOCUS = [
    { fx: 0.5, fy: 0.36 },
    { fx: 0.5, fy: 0.2 },
    { fx: 0.5, fy: 0.8 },
    { fx: 0.2, fy: 0.45 },
    { fx: 0.8, fy: 0.45 }
  ];

  /* Focus presets when several photos are in play. */
  var MULTI_FOCUS = [
    { fx: 0.5, fy: 0.38 },
    { fx: 0.5, fy: 0.3 },
    { fx: 0.5, fy: 0.62 },
    { fx: 0.36, fy: 0.5 },
    { fx: 0.64, fy: 0.5 }
  ];

  var state = {
    photos: [null, null, null],
    panels: [],
    selected: 0,
    layout: 'five-panel',
    grade: 'sunset',
    size: '1080x1080',
    caption: 'VICE CITY',
    subCaption: 'SUNSET HEIST'
  };

  var els = {};
  var booted = false;
  var drag = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function clamp(value, lo, hi) {
    return value < lo ? lo : (value > hi ? hi : value);
  }

  function setStatus(message) {
    if (els.statusLine) els.statusLine.textContent = message;
  }

  function distinctPhotoCount() {
    var seen = [];
    for (var i = 0; i < state.photos.length; i++) {
      var p = state.photos[i];
      if (p && seen.indexOf(p) === -1) seen.push(p);
    }
    return seen.length;
  }

  function buildPanels() {
    var presets = distinctPhotoCount() <= 1 ? SINGLE_FOCUS : MULTI_FOCUS;
    state.panels = PHOTO_ORDER.map(function (photoIndex, i) {
      var f = presets[i % presets.length];
      return { photo: photoIndex, fx: f.fx, fy: f.fy, zoom: DEFAULT_ZOOM };
    });
    if (state.selected >= state.panels.length) state.selected = 0;
  }

  function layoutPanelCount() {
    if (!els.canvas || !window.computeLayout) return state.panels.length;
    var layout = window.computeLayout(els.canvas.width, els.canvas.height, state.layout);
    return layout.panels.length;
  }

  function updatePanelLabel() {
    if (!els.selectedPanel) return;
    els.selectedPanel.textContent =
      'Panel ' + (state.selected + 1) + ' of ' + layoutPanelCount();
  }

  function syncSliders() {
    var panel = state.panels[state.selected];
    if (!panel) return;
    if (els.zoomSlider) els.zoomSlider.value = String(panel.zoom);
    if (els.focusXSlider) els.focusXSlider.value = String(panel.fx);
    if (els.focusYSlider) els.focusYSlider.value = String(panel.fy);
    updatePanelLabel();
  }

  function redraw() {
    if (!els.canvas || !window.drawCover) return;
    window.drawCover(
      els.canvas,
      state.photos,
      state.panels,
      state.caption,
      state.subCaption,
      state.grade,
      state.layout
    );
    updatePanelLabel();
  }

  function applySize() {
    if (!els.canvas) return;
    var parts = String(state.size).split('x');
    var w = parseInt(parts[0], 10) || 1080;
    var h = parseInt(parts[1], 10) || 1080;
    els.canvas.width = w;
    els.canvas.height = h;
    redraw();
  }

  /* ---- photo loading ------------------------------------------------ */

  function loadPhotoIntoSlot(index, src, doneMessage) {
    var img = new Image();
    img.onload = function () {
      state.photos[index] = img;
      buildPanels();
      syncSliders();
      redraw();
      if (doneMessage) setStatus(doneMessage);
    };
    img.onerror = function () {
      setStatus('That photo could not be loaded.');
    };
    img.src = src;
  }

  function loadSamplePhoto() {
    var img = new Image();
    img.onload = function () {
      state.photos = [img, img, img];
      buildPanels();
      syncSliders();
      redraw();
      setStatus('Sample photo loaded. Add your own photos, pick a panel, then export.');
    };
    img.onerror = function () {
      buildPanels();
      syncSliders();
      redraw();
      setStatus('The sample photo is missing. Please choose a photo to begin.');
    };
    img.src = 'samples/pier.jpg';
  }

  /* ---- pointer editing ---------------------------------------------- */

  function canvasPoint(evt) {
    var rect = els.canvas.getBoundingClientRect();
    return {
      x: (evt.clientX - rect.left) * (els.canvas.width / rect.width),
      y: (evt.clientY - rect.top) * (els.canvas.height / rect.height)
    };
  }

  function panelIndexAt(point) {
    var layout = window.computeLayout(els.canvas.width, els.canvas.height, state.layout);
    for (var i = layout.panels.length - 1; i >= 0; i--) {
      var p = layout.panels[i];
      if (point.x >= p.x && point.x <= p.x + p.w && point.y >= p.y && point.y <= p.y + p.h) {
        return i;
      }
    }
    return -1;
  }

  function selectPanel(index) {
    var count = layoutPanelCount();
    if (index < 0 || index >= count) return;
    state.selected = index;
    syncSliders();
    redraw();
  }

  function onPointerDown(evt) {
    var point = canvasPoint(evt);
    var index = panelIndexAt(point);
    if (index === -1) return;
    selectPanel(index);
    drag = { x: point.x, y: point.y, index: index };
    if (els.canvas.setPointerCapture) {
      try { els.canvas.setPointerCapture(evt.pointerId); } catch (err) { /* noop */ }
    }
    evt.preventDefault();
  }

  function onPointerMove(evt) {
    if (!drag) return;
    var point = canvasPoint(evt);
    var dx = point.x - drag.x;
    var dy = point.y - drag.y;
    drag.x = point.x;
    drag.y = point.y;

    var panel = state.panels[drag.index];
    if (!panel) return;
    var layout = window.computeLayout(els.canvas.width, els.canvas.height, state.layout);
    var rect = layout.panels[drag.index];
    var img = state.photos[panel.photo];
    if (img && img.naturalWidth && img.naturalHeight && rect) {
      var scale = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) *
        clamp(panel.zoom || 1, 1, 3);
      panel.fx = clamp(panel.fx - dx / (img.naturalWidth * scale), 0, 1);
      panel.fy = clamp(panel.fy - dy / (img.naturalHeight * scale), 0, 1);
    } else if (rect) {
      panel.fx = clamp(panel.fx - dx / rect.w, 0, 1);
      panel.fy = clamp(panel.fy - dy / rect.h, 0, 1);
    }
    syncSliders();
    redraw();
  }

  function onPointerUp() {
    drag = null;
  }

  function onWheel(evt) {
    evt.preventDefault();
    var point = canvasPoint(evt);
    var index = panelIndexAt(point);
    if (index !== -1 && index !== state.selected) selectPanel(index);
    var panel = state.panels[state.selected];
    if (!panel) return;
    var step = evt.deltaY < 0 ? 0.1 : -0.1;
    panel.zoom = clamp(Math.round((panel.zoom + step) * 100) / 100, 1, 3);
    syncSliders();
    redraw();
  }

  /* ---- export -------------------------------------------------------- */

  function triggerDownload(url, w, h) {
    var a = document.createElement('a');
    a.href = url;
    a.download = 'vice-city-cover-' + w + 'x' + h + '.png';
    document.body.appendChild(a);
    a.click();
    if (a.remove) a.remove();
  }

  function exportPng() {
    var parts = String(state.size).split('x');
    var w = parseInt(parts[0], 10) || 1080;
    var h = parseInt(parts[1], 10) || 1080;
    setStatus('Rendering ' + w + ' x ' + h + ' PNG...');

    var off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    window.drawCover(off, state.photos, state.panels, state.caption, state.subCaption, state.grade, state.layout);

    if (typeof off.toBlob === 'function') {
      off.toBlob(function (blob) {
        if (!blob) {
          setStatus('Export failed in this browser.');
          return;
        }
        var url = URL.createObjectURL(blob);
        triggerDownload(url, w, h);
        setStatus('Exported vice-city-cover-' + w + 'x' + h + '.png (' +
          Math.round(blob.size / 1024) + ' KB).');
        window.setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      }, 'image/png');
    } else {
      triggerDownload(off.toDataURL('image/png'), w, h);
      setStatus('Exported vice-city-cover-' + w + 'x' + h + '.png.');
    }
  }

  /* ---- control bindings ---------------------------------------------- */

  function bindFileInput(id, index) {
    var input = byId(id);
    if (!input) return;
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var url = URL.createObjectURL(file);
      loadPhotoIntoSlot(index, url, 'Photo ' + (index + 1) + ' loaded.');
    });
  }

  function bindEvents() {
    bindFileInput('photo1', 0);
    bindFileInput('photo2', 1);
    bindFileInput('photo3', 2);

    els.captionInput.addEventListener('input', function () {
      var value = els.captionInput.value;
      state.caption = value.trim() === '' ? 'VICE CITY' : value;
      redraw();
    });

    els.subCaptionInput.addEventListener('input', function () {
      state.subCaption = els.subCaptionInput.value;
      redraw();
    });

    els.sizeSelect.addEventListener('change', function () {
      state.size = els.sizeSelect.value;
      applySize();
      setStatus('Post size set to ' + state.size.replace('x', ' x ') + '.');
    });

    var buttons = document.querySelectorAll('.layout-btn');
    Array.prototype.forEach.call(buttons, function (button) {
      button.addEventListener('click', function () {
        state.layout = button.getAttribute('data-layout') || 'five-panel';
        Array.prototype.forEach.call(buttons, function (b) {
          if (b === button) b.classList.add('active');
          else b.classList.remove('active');
        });
        var count = layoutPanelCount();
        if (state.selected >= count) state.selected = 0;
        syncSliders();
        redraw();
        setStatus('Layout: ' + button.textContent + '.');
      });
    });

    els.gradeSelect.addEventListener('change', function () {
      state.grade = els.gradeSelect.value;
      redraw();
      var label = els.gradeSelect.options[els.gradeSelect.selectedIndex];
      setStatus('Colour grade: ' + (label ? label.text : state.grade) + '.');
    });

    els.zoomSlider.addEventListener('input', function () {
      var panel = state.panels[state.selected];
      if (!panel) return;
      panel.zoom = clamp(parseFloat(els.zoomSlider.value) || 1, 1, 3);
      redraw();
    });

    els.focusXSlider.addEventListener('input', function () {
      var panel = state.panels[state.selected];
      if (!panel) return;
      panel.fx = clamp(parseFloat(els.focusXSlider.value) || 0, 0, 1);
      redraw();
    });

    els.focusYSlider.addEventListener('input', function () {
      var panel = state.panels[state.selected];
      if (!panel) return;
      panel.fy = clamp(parseFloat(els.focusYSlider.value) || 0, 0, 1);
      redraw();
    });

    els.exportBtn.addEventListener('click', exportPng);

    els.canvas.addEventListener('pointerdown', onPointerDown);
    els.canvas.addEventListener('pointermove', onPointerMove);
    els.canvas.addEventListener('pointerup', onPointerUp);
    els.canvas.addEventListener('pointercancel', onPointerUp);
    els.canvas.addEventListener('wheel', onWheel, { passive: false });
  }

  /* ---- boot ------------------------------------------------------------ */

  function init() {
    els = {
      canvas: byId('coverCanvas'),
      captionInput: byId('captionInput'),
      subCaptionInput: byId('subCaptionInput'),
      sizeSelect: byId('sizeSelect'),
      gradeSelect: byId('gradeSelect'),
      selectedPanel: byId('selectedPanel'),
      zoomSlider: byId('zoomSlider'),
      focusXSlider: byId('focusXSlider'),
      focusYSlider: byId('focusYSlider'),
      exportBtn: byId('exportBtn'),
      statusLine: byId('statusLine')
    };

    state.caption = els.captionInput.value || 'VICE CITY';
    state.subCaption = els.subCaptionInput.value || '';

    buildPanels();
    bindEvents();
    applySize();
    syncSliders();
    booted = true;
    loadSamplePhoto();

    if (document.fonts && typeof document.fonts.load === 'function') {
      document.fonts.load('32px Anton').then(function () { redraw(); }, function () { /* noop */ });
      if (document.fonts.ready) {
        document.fonts.ready.then(function () { redraw(); }, function () { /* noop */ });
      }
    }
  }

  window.ViceCityApp = {
    state: state,
    redraw: redraw,
    applySize: applySize,
    setStatus: setStatus,
    isBooted: function () { return booted; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
