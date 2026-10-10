// Conservative edge-connected matte removal for small, opaque UI icons.
const iconBackgroundCache = new Map();

function normalizeIconTolerance(value) {
  const number = Number(value ?? 48);
  return Number.isFinite(number) ? Math.max(8, Math.min(100, Math.round(number))) : 48;
}

function removeIconBackgroundPixels(pixels, width, height, tolerance = 48) {
  const count = width * height;
  if (width < 3 || height < 3 || pixels.length !== count * 4) return false;
  // Already transparent artwork is authored content; preserve its alpha exactly.
  for (let i = 3; i < pixels.length; i += 4) if (pixels[i] < 250) return false;
  const border = [];
  for (let x = 0; x < width; x++) border.push(x, (height - 1) * width + x);
  for (let y = 1; y < height - 1; y++) border.push(y * width, y * width + width - 1);
  const bins = new Map();
  for (const index of border) {
    const i = index * 4;
    const key = `${pixels[i] >> 5},${pixels[i + 1] >> 5},${pixels[i + 2] >> 5}`;
    const bin = bins.get(key) || [];
    bin.push(index);
    bins.set(key, bin);
  }
  const dominant = [...bins.values()].sort((a, b) => b.length - a.length)[0];
  const color = [0, 1, 2].map(channel => dominant.reduce((sum, i) => sum + pixels[i * 4 + channel], 0) / dominant.length);
  const colorful = Math.max(...color) - Math.min(...color) > 45;
  const norm = color.reduce((sum, c) => sum + c * c, 0);
  function distance(index) {
    const i = index * 4;
    // Colored backgrounds can have dark shadows. Keep grayscale edges strict
    // so pale metal and white details are not mistaken for a white background.
    const scale = colorful ? Math.max(0.5, Math.min(1.2,
      (pixels[i] * color[0] + pixels[i + 1] * color[1] + pixels[i + 2] * color[2]) / norm)) : 1;
    return Math.hypot(pixels[i] - color[0] * scale, pixels[i + 1] - color[1] * scale,
      pixels[i + 2] - color[2] * scale, (1 - scale) * 35);
  }
  const limit = normalizeIconTolerance(tolerance);
  // A complex scene without a consistent border is left intact.
  if (border.filter(index => distance(index) <= limit).length < border.length * 0.6) return false;
  const queue = new Int32Array(count);
  const visited = new Uint8Array(count);
  const alpha = new Uint8ClampedArray(count);
  alpha.fill(255);
  let head = 0, tail = 0;
  function visit(index) {
    if (visited[index]) return;
    visited[index] = 1;
    const d = distance(index);
    if (d > limit + 12) return;
    alpha[index] = Math.round(255 * Math.max(0, (d - limit) / 12));
    // Soft edge pixels do not seed further removal into the foreground.
    if (d <= limit) queue[tail++] = index;
  }
  border.forEach(visit);
  while (head < tail) {
    const index = queue[head++], x = index % width;
    if (x > 0) visit(index - 1);
    if (x < width - 1) visit(index + 1);
    if (index >= width) visit(index - width);
    if (index < count - width) visit(index + width);
  }
  // Never replace a flat swatch or an indistinguishable subject with nothing.
  if (tail > count * 0.99 || tail === 0) return false;
  for (let i = 0; i < count; i++) pixels[i * 4 + 3] = Math.min(pixels[i * 4 + 3], alpha[i]);
  return true;
}

function getIconBackgroundPreview(source, tolerance = 48) {
  const key = `${normalizeIconTolerance(tolerance)}:${source}`;
  if (iconBackgroundCache.has(key)) return iconBackgroundCache.get(key);
  const result = new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => { img.onload = img.onerror = null; reject(new Error("이미지 로드 시간이 초과되었습니다.")); }, 15000);
    img.onerror = () => { clearTimeout(timer); reject(new Error("아이콘 이미지를 읽지 못했습니다.")); };
    img.onload = () => {
      clearTimeout(timer);
      try {
        const ratio = Math.min(1, 384 / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const changed = removeIconBackgroundPixels(frame.data, canvas.width, canvas.height, tolerance);
        if (changed) ctx.putImageData(frame, 0, 0);
        resolve(changed ? canvas.toDataURL("image/png") : source);
      } catch (error) { reject(error); }
    };
    img.src = source;
  });
  // Bound both decoded results and cached failures; repeated lists share work.
  if (iconBackgroundCache.size >= 64) iconBackgroundCache.delete(iconBackgroundCache.keys().next().value);
  iconBackgroundCache.set(key, result);
  return result;
}
