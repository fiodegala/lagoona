/**
 * Image optimization utilities.
 * Appends Supabase Storage transform params for auto-resizing/compression.
 * For external URLs, returns as-is.
 */

const SUPABASE_STORAGE_HOST = 'krlnrzwshjwupiklzblz.supabase.co/storage';

export function optimizeImageUrl(
  url: string | null | undefined,
  options: { width?: number; height?: number; quality?: number } = {}
): string {
  if (!url) return '';

  const { width = 600, quality = 75 } = options;

  // Only transform Supabase storage URLs
  if (url.includes(SUPABASE_STORAGE_HOST) && url.includes('/object/public/')) {
    // Convert /object/public/ to /render/image/public/ for transforms
    const transformUrl = url.replace('/object/public/', '/render/image/public/');
    const params = new URLSearchParams();
    if (width) params.set('width', String(width));
    if (options.height) params.set('height', String(options.height));
    params.set('quality', String(quality));
    params.set('format', 'origin');
    return `${transformUrl}?${params.toString()}`;
  }

  return url;
}

/** Thumbnail size for product cards */
export function thumbnailUrl(url: string | null | undefined): string {
  return optimizeImageUrl(url, { width: 400, quality: 70 });
}

/** Medium size for product detail page */
export function mediumImageUrl(url: string | null | undefined): string {
  return optimizeImageUrl(url, { width: 800, quality: 80 });
}

/** Full size for lightbox / zoom */
export function fullImageUrl(url: string | null | undefined): string {
  return optimizeImageUrl(url, { width: 1200, quality: 85 });
}

/** Banner hero size */
export function heroImageUrl(url: string | null | undefined): string {
  return optimizeImageUrl(url, { width: 1920, quality: 75 });
}
