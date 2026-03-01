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

/** Group snapshots by search_context; each group sorted by checked_at asc */
export function groupSnapshotsByContext(
  snapshots: PriceSnapshot[]
): Map<string, PriceSnapshot[]> {
  const byContext = new Map<string, PriceSnapshot[]>();
  for (const s of snapshots) {
    const list = byContext.get(s.search_context) ?? [];
    list.push(s);
    byContext.set(s.search_context, list);
  }
  for (const list of byContext.values()) {
    list.sort(
      (a, b) =>
        new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime()
    );
  }
  return byContext;
}

/** Trend from last two snapshots with prices (chronological). */
export function getTrend(
  snapshots: PriceSnapshot[]
): 'rising' | 'dropping' | 'stable' {
  const withPrice = snapshots
    .filter((s) => s.total_price != null)
    .sort(
      (a, b) =>
        new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime()
    );
  const lastTwo = withPrice.slice(-2);
  if (lastTwo.length < 2) return 'stable';
  const a = lastTwo[0].total_price!;
  const b = lastTwo[1].total_price!;
  if (b > a) return 'rising';
  if (b < a) return 'dropping';
  return 'stable';
}
