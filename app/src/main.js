// Vice City Cover Maker: wires the editor. Pick up to three photos, caption
// it, crop each panel by dragging (or the sliders), pick a layout, a size and
// a grade, export the cover as a PNG. A `?shot=` query sets up a fixed scene
// for a screenshot instead (./shots.js).
import { drawCover, defaultPanels, panelRects } from './cover.js';
import { runShot } from './shots.js';

const SIZES = {
  '1080x1080': [1080, 1080],
  '1080x1350': [1080, 1350],
  '1920x1080': [1920, 1080],
};

const canvas = document.getElementById('cover');
const captionInput = document.getElementById('caption');
const subcaptionInput = document.getElementById('subcaption');
const gradeSelect = document.getElementById('grade');
const sizeSelect = document.getElementById('size');
const status = document.getElementById('status');
const zoomSlider = document.getElementById('zoom');
const focusXSlider = document.getElementById('focus-x');
const focusYSlider = document.getElementById('focus-y');
const panelLabel = document.getElementById('panel-label');
const zoomValue = document.getElementById('zoom-value');
const layoutButtons = [...document.querySelectorAll('[data-layout]')];

const photos = [null, null, null];
let layout = 'five';
let panels = defaultPanels(layout);
let selected = 0;
let dragging = false;
let lastX = 0;
let lastY = 0;

/** Loads an image from a URL, resolving to the image once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function redraw() {
  drawCover(
    canvas,
    photos,
    panels,
    captionInput.value,
    subcaptionInput.value,
    gradeSelect.value,
    selected,
    layout,
  );
  syncSliders();
}

function syncSliders() {
  // Guard: cover screenshots set selected = -1, and a layout switch can
  // shrink the panel list below the old selection — never index blindly.
  if (selected < 0 || selected >= panels.length || !panels[selected]) {
    panelLabel.textContent = 'Cover — no panel selected';
    return;
  }
  const p = panels[selected];
  zoomSlider.value = String(p.zoom);
  focusXSlider.value = String(Math.round(p.focusX * 100));
  focusYSlider.value = String(Math.round(p.focusY * 100));
  panelLabel.textContent = `Panel ${selected + 1} of ${panels.length} — photo ${p.photoIndex + 1}`;
  zoomValue.textContent = `${p.zoom.toFixed(2)}x`;
}

function setStatus(text) {
  status.textContent = text;
}

function applySize() {
  const [w, h] = SIZES[sizeSelect.value] || SIZES['1080x1080'];
  canvas.width = w;
  canvas.height = h;
  redraw();
}

function setLayout(next) {
  if (!['classic', 'five', 'fullbleed'].includes(next)) return;
  layout = next;
  panels = defaultPanels(layout);
  selected = 0;
  for (const btn of layoutButtons) {
    btn.classList.toggle('active', btn.dataset.layout === layout);
    btn.setAttribute('aria-pressed', String(btn.dataset.layout === layout));
  }
  setStatus(`Layout ${layout === 'five' ? 'Five-panel' : layout === 'classic' ? 'Classic' : 'Full-bleed'} — ${panels.length} panels`);
  redraw();
}

/** Which panel holds a point in client pixels, or -1. */
export function panelAt(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const cx = (clientX - r.left) * (canvas.width / r.width);
  const cy = (clientY - r.top) * (canvas.height / r.height);
  const rects = panelRects(canvas.width, canvas.height, layout);
  // Full-bleed insets sit on top of the big panel: check them first.
  const order = layout === 'fullbleed' ? [1, 2, 0] : rects.map((_, i) => i);
  for (const i of order) {
    const rc = rects[i];
    if (cx >= rc.x && cx <= rc.x + rc.w && cy >= rc.y && cy <= rc.y + rc.h) return i;
  }
  return -1;
}

// Layout buttons: Classic (3 panels), Five-panel (5, default), Full-bleed (1 + 2 insets).
for (const btn of layoutButtons) {
  btn.addEventListener('click', () => setLayout(btn.dataset.layout));
}

// Photo inputs: each file goes to its own slot.
for (let i = 0; i < 3; i++) {
  const input = document.getElementById(`photo-${i + 1}`);
  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    photos[i] = await loadImage(URL.createObjectURL(file));
    setStatus(`Photo ${i + 1} loaded — ${file.name}`);
    redraw();
  });
  document.getElementById(`use-photo-${i + 1}`).addEventListener('click', () => {
    if (selected < 0 || selected >= panels.length) return;
    panels[selected].photoIndex = i;
    setStatus(`Panel ${selected + 1} now uses photo ${i + 1}`);
    redraw();
  });
}

captionInput.addEventListener('input', redraw);
subcaptionInput.addEventListener('input', redraw);
gradeSelect.addEventListener('change', redraw);
sizeSelect.addEventListener('change', () => {
  applySize();
  setStatus(`Size ${sizeSelect.value.replace('x', ' x ')}`);
});
zoomSlider.addEventListener('input', () => {
  if (selected < 0 || selected >= panels.length) return;
  panels[selected].zoom = Number(zoomSlider.value);
  redraw();
});
focusXSlider.addEventListener('input', () => {
  if (selected < 0 || selected >= panels.length) return;
  panels[selected].focusX = Number(focusXSlider.value) / 100;
  redraw();
});
focusYSlider.addEventListener('input', () => {
  if (selected < 0 || selected >= panels.length) return;
  panels[selected].focusY = Number(focusYSlider.value) / 100;
  redraw();
});

// Click a panel to select it; drag it to pan the photo; wheel to zoom.
canvas.addEventListener('pointerdown', (e) => {
  const hit = panelAt(e.clientX, e.clientY);
  if (hit === -1) return;
  selected = hit;
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const r = canvas.getBoundingClientRect();
  const p = panels[selected];
  const scaleX = canvas.width / r.width;
  const scaleY = canvas.height / r.height;
  p.focusX -= ((e.clientX - lastX) * scaleX) / (canvas.width * p.zoom) * 2;
  p.focusY -= ((e.clientY - lastY) * scaleY) / (canvas.height * p.zoom) * 2;
  p.focusX = Math.min(1, Math.max(0, p.focusX));
  p.focusY = Math.min(1, Math.max(0, p.focusY));
  lastX = e.clientX;
  lastY = e.clientY;
  redraw();
});
canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('wheel', (e) => {
  const hit = panelAt(e.clientX, e.clientY);
  if (hit === -1) return;
  e.preventDefault();
  selected = hit;
  const p = panels[selected];
  p.zoom = Math.min(3, Math.max(1, p.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
  redraw();
}, { passive: false });

document.getElementById('export').addEventListener('click', () => {
  const [w, h] = SIZES[sizeSelect.value] || SIZES['1080x1080'];
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  drawCover(off, photos, panels, captionInput.value, subcaptionInput.value, gradeSelect.value, -1, layout);
  off.toBlob((blob) => {
    if (!blob) {
      setStatus('Export failed — the browser could not make the PNG.');
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-city-cover-${w}x${h}.png`;
    a.click();
    setStatus(`Saved vice-city-cover-${w}x${h}.png (${Math.round(blob.size / 1024)} KB)`);
  }, 'image/png');
});

// Start: load the Anton font, then draw. With ?shot=, shots.js sets the scene.
document.fonts.load('16px Anton').finally(() => {
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  if (shot) {
    runShot(shot, params, async (sample, text, size, grade, shotLayout) => {
      const img = await loadImage(sample);
      photos[0] = img;
      photos[1] = img;
      photos[2] = img;
      captionInput.value = text;
      if (shot === 'cover') selected = -1; // cover shots show no editor selection
      if (size && SIZES[size]) sizeSelect.value = size;
      if (grade) gradeSelect.value = grade;
      if (shotLayout) setLayout(shotLayout);
      applySize();
      if (shot === 'cover') selected = -1;
      redraw();
    });
  } else {
    loadImage('samples/pier.jpg').then((img) => {
      photos[0] = img;
      photos[1] = img;
      photos[2] = img;
      redraw();
    });
    redraw();
  }
});
