export interface ConvertedImage { base64: string; dataUrl: string }

/** Scale an image file down to fit in `max` pixels and re-encode it as WebP. */
export async function imageToWebp(file: File, max: number): Promise<ConvertedImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL('image/webp', 0.9);
  if (!dataUrl.startsWith('data:image/webp')) throw new Error('This browser cannot encode WebP images.');
  return { dataUrl, base64: dataUrl.slice(dataUrl.indexOf(',') + 1) };
}
