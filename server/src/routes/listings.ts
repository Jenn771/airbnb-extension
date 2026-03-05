import express, { Request, Response } from 'express';
import { getAllListings, savePriceSnapshot, deleteListing } from '../db/queries';
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

        const snapshot = await savePriceSnapshot({
            airbnb_url,
            name,
            date_range,
            total_price,
            search_context,
        });

        return res.status(201).json(snapshot);
    } catch (error: unknown) {
        console.error('Failed to save price snapshot', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const paramId = req.params.id;
        if (typeof paramId !== 'string') {
            return res.status(400).json({ error: 'Invalid listing id' });
        }
        const id = parseInt(paramId, 10);
        if (Number.isNaN(id)) {
            return res.status(400).json({ error: 'Invalid listing id' });
        }
        const deleted = await deleteListing(id);
        if (!deleted) {
            return res.status(404).json({ error: 'Listing not found' });
        }
        return res.status(200).send();
    } catch (error: unknown) {
        console.error('Failed to delete listing', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
