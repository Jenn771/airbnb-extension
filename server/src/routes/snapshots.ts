import express, { Request, Response } from 'express';
import { getPriceHistory } from '../db/queries';

const router = express.Router();

/*
 * GET /api/snapshots?airbnb_url=<url>&search_context=<optional>
 * Returns ordered price history for a listing (oldest first).
 * search_context filters to one series, e.g. "week|march" or "weekend|july,august".
*/
router.get('/', async (req: Request, res: Response) => {
    try {
        const airbnb_url = req.query.airbnb_url as string | undefined;
        const search_context = req.query.search_context as string | undefined;

        if (!airbnb_url) {
            return res.status(400).json({ error: 'airbnb_url query parameter is required' });
        }

        const snapshots = await getPriceHistory(airbnb_url, search_context);
        return res.json(snapshots);
    } catch (error) {
        console.error('Failed to fetch price history', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
