/**
 * Utility for optimizing image URLs for mobile rendering.
 * Automatically adds ImageKit transformations (responsive width, quality, and modern format auto-negotiation).
 */

export function getOptimizedImageUrl(
  url?: string | null,
  width: number = 500,
  quality: number = 75
): string {
  if (!url || typeof url !== 'string' || url.trim() === '' || url === '[]') {
    return '';
  }

  const cleanUrl = url.trim();

  // If it is an ImageKit URL, ensure optimized width, quality, and auto format
  if (cleanUrl.includes('ik.imagekit.io')) {
    const baseUrl = cleanUrl.split('?')[0];
    return `${baseUrl}?tr=w-${width},q-${quality},f-auto`;
  }

  return cleanUrl;
}

/**
 * Returns a tiny blurred placeholder URL for ImageKit images.
 * Useful for fast progressive loading while the main image downloads.
 */
export function getImagePlaceholderUrl(url?: string | null): string {
  if (!url || typeof url !== 'string' || !url.includes('ik.imagekit.io')) {
    return '';
  }
  const baseUrl = url.split('?')[0];
  return `${baseUrl}?tr=w-30,bl-6,q-40,f-auto`;
}
