import { useEffect, useState, useRef } from 'react';
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
  background: '#f8fafc',
  rising: '#e53935',
  dropping: '#2e7d32',
  stable: '#64748b',
};

const header = (
  <header style={{ 
    width: '100%', 
    flexShrink: 0, 
    padding: '20px 32px',
    background: '#fff',
    borderBottom: '1px solid #e2e8f0', 
    boxSizing: 'border-box' 
  }}>
    <h1 style={{ 
      fontSize: 22,
      fontWeight: 800,
      color: COLORS.primary,
      margin: 0,
      letterSpacing: '-0.02em' 
    }}>
      Airbnb Price Tracker
    </h1>
    <p style={{ 
      fontSize: 13, 
      color: '#64748b', 
      margin: '4px 0 0',
      fontWeight: 500 
    }}>
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
  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    let cancelled = false;
  
    async function load(isBackground = false) {
      try {
        // Only show global loading spinner on the very first mount
        if (!isBackground && !hasLoadedOnce.current) {
          setLoading(true);
        }
        
        const list = await fetchListings();
        if (cancelled) return;

        setListings(list);
        hasLoadedOnce.current = true;
        
        if (list.length > 0) {
          setSelectedListing((prev) => prev ?? list[0]);
        }
    
        const history: Record<string, PriceSnapshot[]> = {};
        await Promise.all(
          list.map(async (l) => {
            const snapshots = await fetchPriceHistory(l.airbnb_url);
            if (!cancelled) history[l.airbnb_url] = snapshots;
          })
        );
        
        if (!cancelled) {
          setHistoryByUrl(history);
          setError(null);
        }
      } catch (e) {
        if (!cancelled && !isBackground) {
          setError(e instanceof Error ? e.message : 'Failed to load');
        }
        console.error("Background refresh failed:", e);
      } finally {
        if (!cancelled && !isBackground) {
          setLoading(false);
        }
      }
    }

    load();
  
    // Re-fetch data whenever the user returns to this tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        load(true); 
      }
    };
  
    document.addEventListener('visibilitychange', handleVisibilityChange);
  
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.background }}>
        {header}
        <div style={{ padding: 40, color: '#64748b', fontSize: 14, fontWeight: 500 }}>
          Initializing dashboard...
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.background }}>
        {header}
        <div style={{ padding: 40, color: COLORS.rising, fontSize: 14, fontWeight: 500 }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: COLORS.background,
        overflowX: 'auto', 
        overflowY: 'hidden',
        minWidth: 1160,
      }}
    >
      {header}

      <div
        style={{
          flex: 1,
          display: 'flex',
          minHeight: 0,
          minWidth: 1160,
        }}
      >
        {listings.length > 0 && (
          <aside
            style={{
              width: 350, 
              flexShrink: 0,
              padding: '24px 20px',
              overflowY: 'auto',
              background: '#f8fafc',
              borderRight: '1px solid #e2e8f0', 
            }}
          >
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                snapshots={historyByUrl[listing.airbnb_url] ?? []}
                selected={selectedListing?.id === listing.id}
                onSelect={() => setSelectedListing(listing)}
                onDelete={() => {
                  setListings((prev) => prev.filter((l) => l.id !== listing.id));
                  setHistoryByUrl((prev) => {
                    const next = { ...prev };
                    delete next[listing.airbnb_url];
                    return next;
                  });
                  if (selectedListing?.id === listing.id) {
                    const remaining = listings.filter((l) => l.id !== listing.id);
                    setSelectedListing(remaining.length > 0 ? remaining[0] : null);
                  }
                }}
              />
            ))}
          </aside>
        )}

        <main
          style={{
            flex: 1,
            minWidth: 0,
            padding: '32px 40px',
            overflowY: 'auto',
          }}
        >
          {listings.length === 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100%',
                color: '#64748b',
                fontSize: 15,
                textAlign: 'center',
              }}
            >
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