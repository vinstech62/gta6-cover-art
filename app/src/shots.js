// Fixed scenes for screenshots: ?shot=editor shows the page with a sample
// photo; ?shot=cover shows the cover alone. `photo` picks the sample
// (samples/<photo>.jpg), `caption` the words, `size` the post size, `grade`
// the colour grade and `layout` the panel layout (classic, five, fullbleed).
// Defaults: five-panel layout, Sunset grade. window.__shotReady is set once painted.
export async function runShot(shot, query, load) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const size = query.get('size') ?? '1080x1080';
  const grade = query.get('grade') ?? 'sunset';
  const layout = query.get('layout') ?? 'five';
  await load(
    `samples/${query.get('photo') ?? 'pier'}.jpg`,
    query.get('caption') ?? 'Vice City',
    size,
    grade,
    layout,
  );
  await document.fonts.ready;
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
