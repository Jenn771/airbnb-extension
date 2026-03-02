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

const header = (
  <header style={{ width: '100%', padding: '24px 28px', background: COLORS.background, borderBottom: '1px solid #ebebeb', boxSizing: 'border-box' }}>
    <h1 style={{ fontSize: 25, fontWeight: 700, color: COLORS.primary, margin: '0 0 6px' }}>
      Airbnb Price Tracker
    </h1>
    <p style={{ fontSize: 13, color: '#888', margin: 0 }}>
      Track price changes across your saved listings
    </p>
  </header>
);

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
      <div style={{ minHeight: '100vh', background: COLORS.background }}>
        {header}
        <div style={{ padding: 28, color: '#888', fontSize: 14 }}>Loading…</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.background }}>
        {header}
        <div style={{ padding: 28, color: COLORS.rising, fontSize: 14 }}>{error}</div>
      </div>
    );
  }


  return (
    <div style={{ minHeight: '100vh', background: COLORS.background }}>
      {/* Full-width header above sidebar and main */}
      {header}

      <div style={{ display: 'flex', flex: 1, minHeight: 'calc(100vh - 80px)' }}>
  
        {/* Only show sidebar if there are listings */}
        {listings.length > 0 && (
          <aside
            style={{
              width: 300,
              flexShrink: 0,
              padding: 20,
              overflowY: 'auto',
              background: '#f7f7f7',
            }}
          >
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
        )}

        <main
          style={{
            flex: 1,
            padding: 28,
            overflowY: 'auto',
            background: COLORS.background,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {listings.length === 0 ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#888',
              fontSize: 15,
              textAlign: 'center',
            }}>
              No listings yet. Use the extension to check prices on Airbnb and they will appear here automatically.
            </div>
          ) : selectedListing ? (
            <MainPanel
              listing={selectedListing}
              snapshots={historyByUrl[selectedListing.airbnb_url] ?? []}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}
