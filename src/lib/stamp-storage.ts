import 'server-only';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { alphaBounds, pendingPixels, STAMP_SIZE, type PendingEffect } from './stamp-image';

export const MAX_STAMP_BYTES = 2 * 1024 * 1024;
export const MAX_STAMP_SIDE = 2048;
export const MIN_STAMP_SIDE = 64;

export async function prepareStamp(file: File, effect: PendingEffect) {
  if (file.type !== 'image/png' || file.size > MAX_STAMP_BYTES || file.size === 0) throw new Error('El sello debe ser un PNG de hasta 2 MB.');
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('El archivo no es un PNG válido.');
  const declaredWidth = bytes.readUInt32BE(16), declaredHeight = bytes.readUInt32BE(20);
  if (declaredWidth < MIN_STAMP_SIDE || declaredHeight < MIN_STAMP_SIDE || declaredWidth > MAX_STAMP_SIDE || declaredHeight > MAX_STAMP_SIDE) {
    throw new Error('El sello debe medir entre 64 y 2048 píxeles por lado.');
  }
  const image = await loadImage(bytes).catch(() => { throw new Error('No se pudo leer la imagen del sello.'); });
  if (image.width < MIN_STAMP_SIDE || image.height < MIN_STAMP_SIDE || image.width > MAX_STAMP_SIDE || image.height > MAX_STAMP_SIDE) {
    throw new Error('El sello debe medir entre 64 y 2048 píxeles por lado.');
  }
  const source = createCanvas(image.width, image.height);
  const sourceContext = source.getContext('2d');
  sourceContext.drawImage(image, 0, 0);
  const bounds = alphaBounds(sourceContext.getImageData(0, 0, image.width, image.height).data, image.width, image.height);
  if (bounds.empty) throw new Error('La imagen del sello está vacía.');
  if (!bounds.transparent) throw new Error('El PNG no tiene transparencia. Necesitás una imagen sin fondo para crear la silueta o el contorno.');

  const completed = createCanvas(STAMP_SIZE, STAMP_SIZE);
  const completedContext = completed.getContext('2d');
  const contentWidth = bounds.right - bounds.left + 1;
  const contentHeight = bounds.bottom - bounds.top + 1;
  const scale = Math.min(144 / contentWidth, 144 / contentHeight);
  const width = contentWidth * scale, height = contentHeight * scale;
  completedContext.drawImage(source, bounds.left, bounds.top, contentWidth, contentHeight, (STAMP_SIZE - width) / 2, (STAMP_SIZE - height) / 2, width, height);
  const pixels = completedContext.getImageData(0, 0, STAMP_SIZE, STAMP_SIZE);
  const pending = createCanvas(STAMP_SIZE, STAMP_SIZE);
  const pendingContext = pending.getContext('2d');
  const pendingData = pendingContext.createImageData(STAMP_SIZE, STAMP_SIZE);
  pendingData.data.set(pendingPixels(pixels.data, effect));
  pendingContext.putImageData(pendingData, 0, 0);
  return { completed: completed.toBuffer('image/png'), pending: pending.toBuffer('image/png') };
}

export async function storeStampPair(supabase: any, businessId: string, pair: Awaited<ReturnType<typeof prepareStamp>>) {
  const base = `stamps/${businessId}/${crypto.randomUUID()}`;
  const completedPath = `${base}-completed.png`, pendingPath = `${base}-pending.png`;
  const bucket = supabase.storage.from('logos');
  const first = await bucket.upload(completedPath, pair.completed, { contentType: 'image/png' });
  if (first.error) throw new Error(`No se pudo guardar el sello completado: ${first.error.message}`);
  const second = await bucket.upload(pendingPath, pair.pending, { contentType: 'image/png' });
  if (second.error) {
    await bucket.remove([completedPath]);
    throw new Error(`No se pudo guardar el sello pendiente: ${second.error.message}`);
  }
  return {
    completedUrl: bucket.getPublicUrl(completedPath).data.publicUrl,
    pendingUrl: bucket.getPublicUrl(pendingPath).data.publicUrl,
    paths: [completedPath, pendingPath],
  };
}
