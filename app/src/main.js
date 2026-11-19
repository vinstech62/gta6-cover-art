/* Vice City Cover Maker: page wiring.
 *
 * Loads the user's photos, keeps five panels (photos 0, 1, 2, 0, 1, each
 * with its own focus point), and redraws the cover whenever anything
 * changes. Click a panel to select it, drag it to move its photo, scroll
 * over it to zoom. Export renders the cover offscreen at full size and
 * downloads it as a PNG.
 */

(function () {
  'use strict';

  var SAMPLE_PHOTO = 'samples/pier.jpg';

  /* Focus points for the five panels when one photo fills them all:
   * centre, top, bottom, left, right. */
  var SINGLE_PHOTO_FOCUS = [
    { fx: 0.5, fy: 0.5 },
    { fx: 0.5, fy: 0.18 },
    { fx: 0.5, fy: 0.82 },
    { fx: 0.16, fy: 0.5 },
    { fx: 0.84, fy: 0.5 }
  ];

  var MULTI_PHOTO_FOCUS = [
    { fx: 0.5, fy: 0.3 },
    { fx: 0.5, fy: 0.3 },
    { fx: 0.5, fy: 0.62 },
    { fx: 0.32, fy: 0.5 },
    { fx: 0.68, fy: 0.5 }
  ];

  var SIZES = {
    '1080x1080': { w: 1080, h: 1080 },
    '1080x1350': { w: 1080, h: 1350 },
    '1920x1080': { w: 1920, h: 1080 }
  };

  var state = {
    photos: [null, null, null],
    panels: [],
    selected: 0,
    layout: 'five-panel',
    grade: 'sunset',
    size: '1080x1080',
    caption: 'VICE CITY',
    subCaption: 'SUNSET HEIST',
    dragging: false,
    dragMoved: false,
    lastX: 0,
    lastY: 0
  };

  var canvas;
  var zoomSlider;
  var focusXSlider;
  var focusYSlider;
  var selectedLabel;
  var statusLine;

  function el(id) {
    return document.getElementById(id);
  }

  function buildPanels() {
    var focus = state.photos.filter(function (p) { return !!p; }).length <= 1
      ? SINGLE_PHOTO_FOCUS
      : MULTI_PHOTO_FOCUS;
    var order = [0, 1, 2, 0, 1];
    state.panels = order.map(function (photoIndex, i) {
      return {
        photo: photoIndex,
        fx: focus[i].fx,
        fy: focus[i].fy,
        zoom: 1.1
      };
    });
  }

  function redraw() {
    if (!canvas) return;
    drawCover(canvas, state.photos, state.panels, state.caption, state.subCaption, state.grade, state.layout);
  }

  function syncSliders() {
    var panel = state.panels[state.selected];
    if (!panel) return;
    zoomSlider.value = String(panel.zoom);
    focusXSlider.value = String(panel.fx);
    focusYSlider.value = String(panel.fy);
    selectedLabel.textContent = 'Panel ' + (state.selected + 1) + ' of ' + state.panels.length;
  }

  function setStatus(message) {
    if (statusLine) statusLine.textContent = message;
  }

  function panelAt(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var x = (clientX - rect.left) * (canvas.width / rect.width);
    var y = (clientY - rect.top) * (canvas.height / rect.height);
    var layout = computeLayout(canvas.width, canvas.height, state.layout);
    for (var i = layout.panels.length - 1; i >= 0; i--) {
      var p = layout.panels[i];
      if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return i;
    }
    return -1;
  }

  function loadPhotoFile(file, index) {
    if (!file) return;
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      state.photos[index] = img;
      buildPanels();
      redraw();
      setStatus('Photo ' + (index + 1) + ' loaded.');
    };
    img.onerror = function () {
      setStatus('Could not read that photo file.');
    };
    img.src = url;
  }

  function loadSamplePhoto() {
    var img = new Image();
    img.onload = function () {
      state.photos = [img, img, img];
      buildPanels();
      redraw();
      setStatus('Sample photo loaded. Add your own photos to make it yours.');
    };
    img.onerror = function () {
      buildPanels();
      redraw();
      setStatus('Sample photo missing. Load a photo to begin.');
    };
    img.src = SAMPLE_PHOTO;
  }

  function applySize() {
    var size = SIZES[state.size] || SIZES['1080x1080'];
    canvas.width = size.w;
    canvas.height = size.h;
    redraw();
  }

  function exportPng() {
    var size = SIZES[state.size] || SIZES['1080x1080'];
    var offscreen = document.createElement('canvas');
    offscreen.width = size.w;
    offscreen.height = size.h;
    drawCover(offscreen, state.photos, state.panels, state.caption, state.subCaption, state.grade, state.layout);
    setStatus('Exporting PNG…');
    offscreen.toBlob(function (blob) {
      if (!blob) {
        setStatus('Export failed: the browser could not make the PNG.');
        return;
      }
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = 'vice-city-cover-' + size.w + 'x' + size.h + '.png';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      setStatus('Exported vice-city-cover-' + size.w + 'x' + size.h + '.png (' + Math.round(blob.size / 1024) + ' KB).');
    }, 'image/png');
  }

  function bindControls() {
    ['photo1', 'photo2', 'photo3'].forEach(function (id, index) {
      el(id).addEventListener('change', function (event) {
        var file = event.target.files && event.target.files[0];
        if (file) loadPhotoFile(file, index);
      });
    });

    el('captionInput').addEventListener('input', function (event) {
      state.caption = event.target.value || 'VICE CITY';
      redraw();
    });

    el('subCaptionInput').addEventListener('input', function (event) {
      state.subCaption = event.target.value || '';
      redraw();
    });

    el('sizeSelect').addEventListener('change', function (event) {
      state.size = event.target.value;
      applySize();
      setStatus('Size set to ' + state.size.replace('x', ' x ') + '.');
    });

    var layoutButtons = document.querySelectorAll('.layout-btn');
    layoutButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        layoutButtons.forEach(function (b) { b.classList.remove('active'); });
        button.classList.add('active');
        state.layout = button.getAttribute('data-layout');
        redraw();
        setStatus('Layout: ' + button.textContent + '.');
      });
    });

    el('gradeSelect').addEventListener('change', function (event) {
      state.grade = event.target.value;
      redraw();
      setStatus('Grade: ' + event.target.selectedOptions[0].textContent + '.');
    });

    zoomSlider.addEventListener('input', function (event) {
      var panel = state.panels[state.selected];
      if (!panel) return;
      panel.zoom = parseFloat(event.target.value) || 1;
      redraw();
    });

    focusXSlider.addEventListener('input', function (event) {
      var panel = state.panels[state.selected];
      if (!panel) return;
      panel.fx = parseFloat(event.target.value) || 0.5;
      redraw();
    });

    focusYSlider.addEventListener('input', function (event) {
      var panel = state.panels[state.selected];
      if (!panel) return;
      panel.fy = parseFloat(event.target.value) || 0.5;
      redraw();
    });

    el('exportBtn').addEventListener('click', exportPng);

    canvas.addEventListener('mousedown', function (event) {
      var hit = panelAt(event.clientX, event.clientY);
      if (hit < 0) return;
      state.selected = hit;
      state.dragging = true;
      state.dragMoved = false;
      state.lastX = event.clientX;
      state.lastY = event.clientY;
      syncSliders();
    });

    canvas.addEventListener('mousemove', function (event) {
      if (!state.dragging) return;
      var panel = state.panels[state.selected];
      if (!panel) return;
      var rect = canvas.getBoundingClientRect();
      var dx = (event.clientX - state.lastX) * (canvas.width / rect.width);
      var dy = (event.clientY - state.lastY) * (canvas.height / rect.height);
      var layout = computeLayout(canvas.width, canvas.height, state.layout);
      var slot = layout.panels[state.selected];
      if (slot) {
        panel.fx = Math.min(1, Math.max(0, panel.fx - dx / slot.w));
        panel.fy = Math.min(1, Math.max(0, panel.fy - dy / slot.h));
      }
      if (Math.abs(event.clientX - state.lastX) + Math.abs(event.clientY - state.lastY) > 2) {
        state.dragMoved = true;
      }
      state.lastX = event.clientX;
      state.lastY = event.clientY;
      syncSliders();
      redraw();
    });

    window.addEventListener('mouseup', function () {
      state.dragging = false;
    });

    canvas.addEventListener('wheel', function (event) {
      event.preventDefault();
      var panel = state.panels[state.selected];
      if (!panel) return;
      var step = event.deltaY < 0 ? 0.1 : -0.1;
      panel.zoom = Math.min(3, Math.max(1, panel.zoom + step));
      syncSliders();
      redraw();
    }, { passive: false });
  }

  function init() {
    canvas = el('coverCanvas');
    zoomSlider = el('zoomSlider');
    focusXSlider = el('focusXSlider');
    focusYSlider = el('focusYSlider');
    selectedLabel = el('selectedPanel');
    statusLine = el('statusLine');
    buildPanels();
    bindControls();
    applySize();
    syncSliders();
    loadSamplePhoto();
    if (document.fonts && document.fonts.load) {
      document.fonts.load('40px "Anton"').then(function () {
        redraw();
      }).catch(function () {
        redraw();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Shared state for the screenshot helper (shots.js). */
  window.ViceCityApp = {
    state: state,
    redraw: redraw,
    applySize: applySize,
    setStatus: setStatus
  };
})();
