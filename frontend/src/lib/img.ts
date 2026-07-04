import { API_BASE_URL } from '../config';

/**
 * Route a remote (Cloudinary) image through our backend proxy so it loads even
 * on networks that can't reach res.cloudinary.com directly. Local previews
 * (blob:/data:) and already-relative URLs are returned unchanged.
 */
export function proxiedImage(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('/')) return url;
  return `${API_BASE_URL}/api/media/image?src=${encodeURIComponent(url)}`;
}
