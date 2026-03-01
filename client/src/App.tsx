import { useEffect, useState } from 'react';
import {
  fetchListings,
  fetchPriceHistory,
  type Listing,
  type PriceSnapshot,
} from './api';
import { ListingCard } from './components/ListingCard';
import { MainPanel } from './components/MainPanel';

const COLORS = {
  primary: '#0069A6',
  background: '#f7f7f7',
  rising: '#e53935',
  dropping: '#2e7d32',
  stable: '#666',
};

export default function App() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [historyByUrl, setHistoryByUrl] = useState<Record<string, PriceSnapshot[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const list = await fetchListings();
        if (cancelled) return;
        setListings(list);
        if (list.length > 0) setSelectedListing((prev) => prev ?? list[0]);

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
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 24, background: COLORS.background, minHeight: '100vh' }}>
        Loading…
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ padding: 24, background: COLORS.background, minHeight: '100vh', color: COLORS.rising }}>
        {error}
      </div>
    );
  }
  if (listings.length === 0) {
    return (
      <div style={{ padding: 24, background: COLORS.background, minHeight: '100vh', color: '#666' }}>
        No listings yet. Use the extension to check prices on Airbnb; they will appear here.
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: COLORS.background,
      }}
    >
      <aside
        style={{
          width: 280,
          flexShrink: 0,
          padding: 16,
          overflowY: 'auto',
          borderRight: '1px solid #e0e0e0',
          background: '#fff',
        }}
      >
        <h2 style={{ margin: '0 0 16px', fontSize: 18, color: COLORS.primary }}>
          Listings
        </h2>
        {listings.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            snapshots={historyByUrl[listing.airbnb_url] ?? []}
            selected={selectedListing?.id === listing.id}
            onSelect={() => setSelectedListing(listing)}
          />
        ))}
      </aside>
      <main style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
        {selectedListing && (
          <MainPanel
            listing={selectedListing}
            snapshots={historyByUrl[selectedListing.airbnb_url] ?? []}
          />
        )}
      </main>
    </div>
  );
}
