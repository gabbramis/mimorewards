export type PendingEffect = { mode: 'light' | 'silhouette' | 'outline'; opacity: number; color: string; thickness: number };
export const defaultPendingEffect: PendingEffect = { mode: 'light', opacity: 0.25, color: '#C9B9B9', thickness: 3 };
export const STAMP_SIZE = 192;

export function validateEffect(value: unknown): PendingEffect {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<PendingEffect>;
  return {
    mode: v.mode === 'silhouette' || v.mode === 'outline' ? v.mode : 'light',
    opacity: typeof v.opacity === 'number' && v.opacity >= 0.1 && v.opacity <= 0.8 ? v.opacity : 0.25,
    color: typeof v.color === 'string' && /^#[0-9a-f]{6}$/i.test(v.color) ? v.color : '#C9B9B9',
    thickness: typeof v.thickness === 'number' && Number.isInteger(v.thickness) && v.thickness >= 1 && v.thickness <= 8 ? v.thickness : 3,
  };
}

export function alphaBounds(data: Uint8ClampedArray, width: number, height: number) {
  let left = width, top = height, right = -1, bottom = -1, transparent = false;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const alpha = data[(y * width + x) * 4 + 3];
    if (alpha < 255) transparent = true;
    if (alpha > 8) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); }
  }
  return { left, top, right, bottom, transparent, empty: right < left };
}

export function pendingPixels(source: Uint8ClampedArray, effect: PendingEffect): Uint8ClampedArray {
  const out = new Uint8ClampedArray(source.length);
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(effect.color.slice(i, i + 2), 16));
  const size = STAMP_SIZE;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    const alpha = source[i + 3];
    if (effect.mode === 'light') {
      out[i] = source[i]; out[i + 1] = source[i + 1]; out[i + 2] = source[i + 2]; out[i + 3] = Math.round(alpha * effect.opacity);
    } else if (effect.mode === 'silhouette') {
      out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = alpha;
    } else {
      let near = 0;
      for (let dy = -effect.thickness; dy <= effect.thickness; dy++) for (let dx = -effect.thickness; dx <= effect.thickness; dx++) {
        if (dx * dx + dy * dy > effect.thickness * effect.thickness) continue;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < size && ny >= 0 && ny < size) near = Math.max(near, source[(ny * size + nx) * 4 + 3]);
      }
      out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = Math.max(0, near - alpha);
    }
  }
  return out;
}
