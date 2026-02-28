/**
 * Client API: calls the Express backend (listings + snapshots).
 * Assumes Vite proxy: /api -> http://localhost:3000
 */

export interface Listing {
  id: number;
  airbnb_url: string;
  name: string | null;
  created_at: string;
}

export interface PriceSnapshot {
  id: number;
  listing_id: number;
  date_range: string;
  total_price: number | null;
  checked_at: string;
  search_context: string;
}

const API_BASE = '/api';

export async function fetchListings(): Promise<Listing[]> {
  // Send request to server
  const res = await fetch(`${API_BASE}/listings`);

  if (!res.ok) throw new Error('Failed to fetch listings');

  // Parse response as JSON
  return res.json();
}

export async function fetchPriceHistory(
  airbnbUrl: string,
  searchContext?: string
): Promise<PriceSnapshot[]> {
  // Build query string
  const params = new URLSearchParams({ airbnb_url: airbnbUrl });
  
  // Add search context if provided
  if (searchContext) params.set('search_context', searchContext);
  
  // Send request to server
  const res = await fetch(`${API_BASE}/snapshots?${params.toString()}`);

  if (!res.ok) throw new Error('Failed to fetch price history');
  
  // Parse response as JSON
  return res.json();
}
