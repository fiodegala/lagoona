/**
 * Client-side image compression helper.
 *
 * Resizes proportionally to a max width (default 1200px) and converts to WebP
 * (quality 80%) before uploading to Storage. Aspect ratio is always preserved —
 * images are never cropped or distorted.
 */

export interface CompressedImage {
  blob: Blob;
  ext: string;
  contentType: string;
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar imagem'));
    img.src = src;
  });

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));

export async function compressImage(
  input: Blob,
  options: { maxWidth?: number; quality?: number } = {}
): Promise<CompressedImage> {
  const { maxWidth = 1200, quality = 0.8 } = options;

  const fallback = (): CompressedImage => {
    const type = input.type || 'image/jpeg';
    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
    return { blob: input, ext, contentType: type };
  };

  // SVG / GIF: keep original (canvas would lose animation / vector quality)
  if (/svg|gif/i.test(input.type)) return fallback();

  let objectUrl: string | null = null;
  try {
    objectUrl = URL.createObjectURL(input);
    const img = await loadImage(objectUrl);

    const scale = img.naturalWidth > maxWidth ? maxWidth / img.naturalWidth : 1;
    const width = Math.round(img.naturalWidth * scale);
    const height = Math.round(img.naturalHeight * scale); // proporção preservada

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return fallback();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    let blob = await canvasToBlob(canvas, 'image/webp', quality);
    let contentType = 'image/webp';
    let ext = 'webp';

    // Browser without WebP encoding support
    if (!blob || blob.type !== 'image/webp') {
      blob = await canvasToBlob(canvas, 'image/jpeg', quality);
      contentType = 'image/jpeg';
      ext = 'jpg';
    }

    if (!blob) return fallback();

    // Never upload something bigger than the original
    if (blob.size >= input.size && scale === 1) return fallback();

    return { blob, ext, contentType };
  } catch (err) {
    console.error('compressImage error:', err);
    return fallback();
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}
