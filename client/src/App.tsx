import { useEffect, useState } from 'react';
import { fetchListings, fetchPriceHistory, type Listing, type PriceSnapshot } from './api';
import { ListingCard } from './components/ListingCard';

export default function App() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [historyByUrl, setHistoryByUrl] = useState<Record<string, PriceSnapshot[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const list = await fetchListings();
        if (cancelled) return;
        setListings(list);

        const history: Record<string, PriceSnapshot[]> = {};
        await Promise.all(
          list.map(async (l) => {
            const snapshots = await fetchPriceHistory(l.airbnb_url);
            if (!cancelled) history[l.airbnb_url] = snapshots;
          })
        );
        if (!cancelled) setHistoryByUrl(history);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // Render loading state
  if (loading) return <p style={{ padding: 24 }}>Loading…</p>;
  // Render error state
  if (error) return <p style={{ padding: 24, color: '#c00' }}>{error}</p>;
  // Render empty state
  if (listings.length === 0) {
    return (
      <p style={{ padding: 24, color: '#666' }}>
        No listings yet. Use the extension to check prices on Airbnb; they will appear here.
      </p>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 24 }}>Price history</h1>
      {listings.map((listing) => (
        <ListingCard
          key={listing.id}
          listing={listing}
          snapshots={historyByUrl[listing.airbnb_url] ?? []}
        />
      ))}
    </div>
  );
}
