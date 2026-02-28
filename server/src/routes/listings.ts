import express, { Request, Response } from 'express';
import { getAllListings, insertPriceSnapshot, upsertListing } from '../db/queries';
import { IncomingPriceData } from '../types';

const router = express.Router();

router.get('/', async (_req: Request, res: Response) => {
    try {
        const listings = await getAllListings();
        return res.json(listings);
    } catch (error) {
        console.error('Failed to fetch listings', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/price', async (req: Request, res: Response) => {
    try {
        const { airbnb_url, name, date_range, total_price, search_context } = req.body as IncomingPriceData;

        if (!airbnb_url || !date_range || !search_context) {
            return res.status(400).json({ error: 'airbnb_url, date_range and search_context are required' });
        }

        const listingId = await upsertListing({
            airbnb_url,
            name,
            date_range,
            total_price,
            search_context,
        });

        const snapshot = await insertPriceSnapshot(listingId, {
            airbnb_url,
            name,
            date_range,
            total_price,
            search_context,
        });

        return res.status(201).json(snapshot);
    } catch (error: any) {
        console.error('Failed to save price snapshot', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
