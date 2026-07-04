import type { NextFunction, Request, RequestHandler, Response } from 'express';
import axios from 'axios';
import { logger } from '../config/logger.js';

function asyncWrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => { fn(req, res, next).catch(next); };
}

// Only Cloudinary delivery hosts may be proxied — prevents this from becoming
// an open proxy / SSRF vector. Cloudinary images are already public, so serving
// them through us doesn't expose anything new.
const ALLOWED_HOST = /^res(-\d+)?\.cloudinary\.com$/i;

/**
 * GET /api/media/image?src=<cloudinary url>
 * Fetches a Cloudinary image server-side and streams it back. Lets clients on
 * networks that can't reach res.cloudinary.com still load photos (the server
 * can reach it fine). Public: it only re-serves already-public Cloudinary URLs.
 */
export const proxyImage = asyncWrap(async (req, res) => {
  const src = String(req.query.src ?? '');
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return res.status(400).json({ message: 'Invalid image URL' });
  }

  if (url.protocol !== 'https:' || !ALLOWED_HOST.test(url.hostname)) {
    return res.status(400).json({ message: 'Only Cloudinary image URLs may be proxied' });
  }

  try {
    const upstream = await axios.get<ArrayBuffer>(url.toString(), {
      responseType: 'arraybuffer',
      timeout: 20_000,
      maxRedirects: 3,
    });
    const contentType = String(upstream.headers['content-type'] ?? 'image/jpeg');
    if (!contentType.startsWith('image/')) {
      return res.status(415).json({ message: 'Upstream is not an image' });
    }
    res.setHeader('Content-Type', contentType);
    // Cache aggressively — Cloudinary assets are immutable.
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    return res.send(Buffer.from(upstream.data));
  } catch (err) {
    logger.warn('[media proxy] failed to fetch image:', (err as Error).message);
    return res.status(502).json({ message: 'Failed to fetch image' });
  }
});
