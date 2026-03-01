import express, { Request, Response } from 'express';

const router = express.Router();

/** GET /api/og-image?url=... - returns { imageUrl: string | null } from og:image meta tag */
router.get('/', async (req: Request, res: Response) => {
  const url = req.query.url;
  if (typeof url !== 'string' || !url.startsWith('https://')) {
    return res.status(400).json({ imageUrl: null });
  }
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AirbnbDashboard/1.0)' },
    });
    if (!response.ok) {
      return res.json({ imageUrl: null });
    }
    const html = await response.text();
    const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const imageUrl = match ? match[1]?.trim() ?? null : null;
    return res.json({ imageUrl });
  } catch {
    return res.json({ imageUrl: null });
  }
});

export default router;
