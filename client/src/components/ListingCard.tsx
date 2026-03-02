import { useEffect, useState } from 'react';
import type { Listing, PriceSnapshot } from '../api';
import { getTrend, getMostRecentContextKey, groupSnapshotsByContext, fetchOgImage } from '../api';

const COLORS = {
  primary: '#0069A6',
  rising: '#e53935',
  dropping: '#2e7d32',
  stable: '#666',
};

const TREND_STYLES = {
  rising: { backgroundColor: '#fff0f0', color: '#e53935', label: '↑ Rising' as const },
  dropping: { backgroundColor: '#f0fff4', color: '#2e7d32', label: '↓ Dropping' as const },
  stable: { backgroundColor: '#f5f5f5', color: '#666', label: '→ Stable' as const },
};

type ListingCardProps = {
  listing: Listing;
  snapshots: PriceSnapshot[];
  selected: boolean;
  onSelect: () => void;
};

function formatPrice(price: number | null): string {
  if (price == null) return '—';
  return `$${price.toLocaleString()}`;
}

function formatDateRange(dateRange: string): string {
  if (dateRange === 'no-available-dates') return 'No available dates';
  return dateRange;
}

export function ListingCard({ listing, snapshots, selected, onSelect }: ListingCardProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(listing.thumbnail_url ?? null);

  useEffect(() => {
    if (listing.thumbnail_url) {
      setImageUrl(listing.thumbnail_url);
      return;
    }
    let cancelled = false;
    fetchOgImage(listing.airbnb_url)
      .then((url) => {
        if (!cancelled) setImageUrl(url);
      })
      .catch(() => {
        // Leave imageUrl as null; card will show placeholder
      });
    return () => {
      cancelled = true;
    };
  }, [listing.airbnb_url, listing.thumbnail_url]);

  const byContext = groupSnapshotsByContext(snapshots);
  const mostRecentKey = getMostRecentContextKey(byContext);
  const mostRecentSnapshots = mostRecentKey ? byContext.get(mostRecentKey) ?? [] : [];
  const trend =
    mostRecentSnapshots.length < 2
      ? 'stable'
      : getTrend(mostRecentSnapshots);
  const withPrice = snapshots
    .filter((s) => s.total_price != null)
    .sort((a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime());
  const latestSnapshotWithPrice = withPrice[0] ?? null;
  const latestPrice = latestSnapshotWithPrice?.total_price ?? null;
  const mostRecentDateRange = latestSnapshotWithPrice
    ? formatDateRange(latestSnapshotWithPrice.date_range)
    : 'No available dates';

  const trendStyle = TREND_STYLES[trend];
  const listingName = listing.name || 'Unnamed listing';

  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: 14,
        marginBottom: 10,
        background: '#fff',
        border: selected ? `2px solid ${COLORS.primary}` : '2px solid transparent',
        borderRadius: 12,
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        cursor: 'pointer',
      }}
    >
      {/* Top row: image + name + date range */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
        <div
          style={{
            width: 44,
            height: 44,
            flexShrink: 0,
            borderRadius: 8,
            overflow: 'hidden',
            background: '#f0f6fb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
          }}
        >
          {imageUrl ? (
            <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : null}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 13,
              color: '#222',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={listingName}
          >
            {listingName}
          </div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
            {mostRecentDateRange}
          </div>
        </div>
      </div>
  
      {/* Bottom row: price + trend badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#222' }}>
            {formatPrice(latestPrice)}
          </span>
          <span style={{ fontSize: 11, color: '#aaa', marginLeft: 4 }}>latest</span>
        </div>
        <span
          title="Trend in the most recent search context: compares the last two price checks in that context"
          style={{
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 12,
            padding: '2px 10px',
            ...trendStyle,
          }}
        >
          {trendStyle.label}
        </span>
      </div>
    </button>
  );
}
