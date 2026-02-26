import pool from './client';
import { Listing, PriceSnapshot, IncomingPriceData } from '../types/index';

// Find or create a listing, always returns the listing id
export async function upsertListing(data: IncomingPriceData): Promise<number> {
    // Try to insert, if URL already exists update the name
    const result = await pool.query<{ id: number }>(
        `INSERT INTO listings (airbnb_url, name)
         VALUES ($1, $2)
         ON CONFLICT (airbnb_url)
         DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [data.airbnb_url, data.name]
    );

    const listing = result.rows[0];
    if (!listing) {
        throw new Error('Upsert failed');
    }

    return listing.id;
}

// Save a new price check for a listing
export async function insertPriceSnapshot(
    listing_id: number,
    data: IncomingPriceData
): Promise<PriceSnapshot> {
    const result = await pool.query<PriceSnapshot>(
        `INSERT INTO price_snapshots (listing_id, date_range, total_price, search_context)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [listing_id, data.date_range, data.total_price, data.search_context]
    );

    const snapshot = result.rows[0];
    if (!snapshot) {
        throw new Error('Price snapshot not returned after insert');
    }

    return snapshot;
}

// Get price snapshots for a listing, optionally filtered by search_context (e.g. week|march)
export async function getPriceHistory(
    airbnb_url: string,
    search_context?: string
): Promise<PriceSnapshot[]> {
    if (search_context) {
        const result = await pool.query<PriceSnapshot>(
            `SELECT ps.*
             FROM price_snapshots ps
             JOIN listings l ON l.id = ps.listing_id
             WHERE l.airbnb_url = $1 AND ps.search_context = $2
             ORDER BY ps.checked_at ASC`,
            [airbnb_url, search_context]
        );
        return result.rows;
    }

    const result = await pool.query<PriceSnapshot>(
        `SELECT ps.*
         FROM price_snapshots ps
         JOIN listings l ON l.id = ps.listing_id
         WHERE l.airbnb_url = $1
         ORDER BY ps.checked_at ASC`,
        [airbnb_url]
    );
    
    return result.rows;
}

// Get all listings
export async function getAllListings(): Promise<Listing[]> {
    const result = await pool.query<Listing>(
        `SELECT * FROM listings ORDER BY created_at DESC`
    );

    return result.rows;
}