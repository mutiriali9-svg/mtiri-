export const IMAGE_BUDGETS = {
  logo:    { maxPx: 512,  quality: 0.85, webp: true, maxBytes: 120 * 1024 },
  proof:   { maxPx: 1800, quality: 0.85, webp: true, maxBytes: 300 * 1024 },
  default: { maxPx: 1600, quality: 0.82, webp: true, maxBytes: 300 * 1024 },
};

export const PDF_MAX_BYTES = 5 * 1024 * 1024;

const SKIP_UNDER_BYTES = 120 * 1024;
const PASS_THROUGH = ['image/gif', 'image/svg+xml'];

export function pdfTooLargeMessage(ar = true) {
  return ar
    ? 'ملف PDF أكبر من ٥ ميجابايت — يرجى مسحه بدقة أقل أو تقسيمه إلى ملفات'
    : 'PDF is larger than 5 MB — rescan at a lower resolution or split it';
}

const encode = (canvas, type, quality) =>
  new Promise(res => canvas.toBlob(res, type, quality));

const extFor = (type) => (
  type === 'image/webp' ? 'webp'
    : type === 'image/png' ? 'png'
      : 'jpg'
);

const renderTo = (bitmap, maxPx) => {
  const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas;
};

export async function prepareUpload(file, kind = 'default') {
  if (!file || typeof document === 'undefined') return file;
  const type = file.type || '';

  if (type === 'application/pdf') {
    if (file.size > PDF_MAX_BYTES) throw new Error(pdfTooLargeMessage(true));
    return file;
  }

  if (!type.startsWith('image/') || PASS_THROUGH.includes(type)) return file;

  const budget = IMAGE_BUDGETS[kind] || IMAGE_BUDGETS.default;
  const sourceIsPng = type === 'image/png';

  try {
    let bitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      bitmap = await createImageBitmap(file);
    }

    const fitsAlready = Math.max(bitmap.width, bitmap.height) <= budget.maxPx
      && file.size <= Math.min(SKIP_UNDER_BYTES, budget.maxBytes);
    if (fitsAlready) {
      bitmap.close?.();
      return file;
    }

    const wanted = budget.webp ? 'image/webp' : sourceIsPng ? 'image/png' : 'image/jpeg';
    const attempts = [
      { px: budget.maxPx, q: budget.quality },
      { px: budget.maxPx, q: 0.75 },
      { px: Math.round(budget.maxPx * 0.8), q: 0.72 },
      { px: Math.round(budget.maxPx * 0.65), q: 0.7 },
    ];

    let best = null;
    for (const step of attempts) {
      const canvas = renderTo(bitmap, step.px);
      let blob = await encode(canvas, wanted, step.q);
      const fellBack = blob && blob.type && blob.type !== wanted;
      const unwantedPng = blob && blob.type === 'image/png' && !sourceIsPng;
      if (!blob || fellBack || unwantedPng) blob = await encode(canvas, 'image/jpeg', step.q);
      canvas.width = 0;
      canvas.height = 0;
      if (!blob) continue;
      if (!best || blob.size < best.size) best = blob;
      if (blob.size <= budget.maxBytes) break;
    }

    bitmap.close?.();

    if (!best || best.size >= file.size) return file;

    const outType = best.type || 'image/jpeg';
    const base = String(file.name || 'image').replace(/\.[^.]+$/, '');
    return new File([best], `${base}.${extFor(outType)}`, { type: outType, lastModified: Date.now() });
  } catch (e) {
    if (e instanceof Error && e.message === pdfTooLargeMessage(true)) throw e;
    return file;
  }
}
