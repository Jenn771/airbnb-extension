/**
 * Client API: calls the Express backend (listings + snapshots).
 * Assumes Vite proxy: /api -> http://localhost:3000
 */

export interface Listing {
  id: number;
  airbnb_url: string;
  name: string | null;
  thumbnail_url: string | null;
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

const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

export async function fetchListings(): Promise<Listing[]> {
  // Send request to server
  const res = await fetch(`${API_BASE}/listings`);

  if (!res.ok) {
    throw new Error(`Failed to fetch listings: ${res.status}`);
  }
  return res.json();
}

export async function deleteListing(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/listings/${id}`, { method: 'DELETE' });
  if (res.status === 404) throw new Error('Listing not found');
  if (!res.ok) throw new Error(`Failed to delete listing: ${res.status}`);
}

export async function fetchOgImage(url: string): Promise<string | null> {
  const res = await fetch(`${API_BASE}/og-image?${new URLSearchParams({ url })}`);
  if (!res.ok) return null;
  try {
    const data = await res.json();
    return data.imageUrl ?? null;
  } catch {
    return null;
  }
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

  if (!res.ok) {
    throw new Error(`Failed to fetch price history: ${res.status}`);
  }
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

/** Context key whose snapshots have the latest checked_at. */
export function getMostRecentContextKey(
  byContext: Map<string, PriceSnapshot[]>
): string | null {
  let latestKey: string | null = null;
  let latestTime = 0;
  for (const [key, list] of byContext.entries()) {
    if (list.length === 0) continue;
    const maxTime = Math.max(
      ...list.map((s) => new Date(s.checked_at).getTime())
    );
    if (maxTime > latestTime) {
      latestTime = maxTime;
      latestKey = key;
    }
  }
  return latestKey;
}
