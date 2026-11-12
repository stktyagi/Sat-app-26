/**
 * Utility for optimizing image URLs for mobile rendering.
 * Automatically adds ImageKit transformations (responsive width, quality, format auto-negotiation, and smart crop).
 */

export interface ImageTransformOptions {
  width?: number;
  height?: number;
  quality?: number;
  aspectRatio?: string; // e.g. "16-9", "4-3", "1-1"
  focus?: 'auto' | 'face' | 'center' | string;
  blur?: number;
  cropMode?: 'maintain_ratio' | 'pad_resize' | 'force' | string;
}

/**
 * Strips any preexisting query or path-based ImageKit transformations to get the clean canonical URL.
 * Safely accepts either a string URL or an object with `url`/`uri`.
 */
export function getCanonicalImageUrl(url?: any): string {
  if (!url) return '';
  const rawString =
    typeof url === 'string'
      ? url
      : typeof url === 'object' && (url.url || url.uri)
      ? String(url.url || url.uri)
      : '';

  if (!rawString || rawString.trim() === '' || rawString === '[]') {
    return '';
  }

  let clean = rawString.trim();

  // Strip query parameters (?tr=... or other query strings)
  clean = clean.split('?')[0];

  // Strip path-based ImageKit transformations like /tr:w-500,q-80/
  clean = clean.replace(/\/tr:[^\/]+\//g, '/');

  return clean;
}

/**
 * Optimizes an ImageKit URL with responsive dimensions, quality, auto format, and smart cropping.
 * Supports either a numeric width for backward compatibility or a comprehensive ImageTransformOptions object.
 */
export function getOptimizedImageUrl(
  url?: any,
  optionsOrWidth: number | ImageTransformOptions = 500,
  quality: number = 75
): string {
  const canonical = getCanonicalImageUrl(url);
  if (!canonical) {
    return '';
  }

  // Only apply ImageKit transformations if the asset is hosted on ImageKit
  if (!canonical.includes('ik.imagekit.io')) {
    return canonical;
  }

  const options: ImageTransformOptions =
    typeof optionsOrWidth === 'number'
      ? { width: optionsOrWidth, quality }
      : { width: 500, quality: 75, ...optionsOrWidth };

  const trParts: string[] = [];

  if (options.width && options.width > 0) {
    trParts.push(`w-${Math.round(options.width)}`);
  }
  if (options.height && options.height > 0) {
    trParts.push(`h-${Math.round(options.height)}`);
  }
  if (options.quality && options.quality > 0) {
    trParts.push(`q-${Math.round(options.quality)}`);
  }
  if (options.aspectRatio) {
    trParts.push(`ar-${options.aspectRatio}`);
  }
  if (options.focus) {
    trParts.push(`fo-${options.focus}`);
  }
  if (options.blur && options.blur > 0) {
    trParts.push(`bl-${Math.round(options.blur)}`);
  }
  if (options.cropMode) {
    trParts.push(`cm-${options.cropMode}`);
  }

  // Always negotiate the best modern format (WebP / AVIF) supported by the client OS
  trParts.push('f-auto');

  return `${canonical}?tr=${trParts.join(',')}`;
}

/**
 * Returns a tiny blurred placeholder URL for ImageKit images.
 * Useful for fast progressive loading while the high-resolution image downloads.
 */
export function getImagePlaceholderUrl(url?: any): string {
  const canonical = getCanonicalImageUrl(url);
  if (!canonical || !canonical.includes('ik.imagekit.io')) {
    return '';
  }
  return `${canonical}?tr=w-30,bl-6,q-40,f-auto`;
}
