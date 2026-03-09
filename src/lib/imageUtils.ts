const SUPABASE_STORAGE_HOST = 'krlnrzwshjwupiklzblz.supabase.co';

/**
 * Converts a Supabase Storage public URL to a resized/optimized URL
 * using Supabase Image Transformations.
 *
 * Non-Supabase URLs are returned unchanged.
 */
export function getOptimizedImageUrl(
  url: string | null | undefined,
  options: { width?: number; height?: number; quality?: number } = {}
): string {
  if (!url) return '';

  // Only transform Supabase Storage URLs
  if (!url.includes(SUPABASE_STORAGE_HOST)) return url;

  const { width = 800, quality = 75 } = options;

  // Already a render URL
  if (url.includes('/render/image/')) return url;

  // Transform: /storage/v1/object/public/... → /storage/v1/render/image/public/...
  const transformed = url.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/'
  );

  const params = new URLSearchParams();
  if (width) params.set('width', String(width));
  if (options.height) params.set('height', String(options.height));
  params.set('quality', String(quality));
  params.set('resize', 'contain');

  return `${transformed}?${params.toString()}`;
}
