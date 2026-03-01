import type { Listing, PriceSnapshot } from '../api';
import { getTrend } from '../api';

const COLORS = {
  primary: '#0069A6',
  rising: '#e53935',
  dropping: '#2e7d32',
  stable: '#666',
};

type ListingCardProps = {
  listing: Listing;
  snapshots: PriceSnapshot[];
  selected: boolean;
  onSelect: () => void;
};

function formatPrice(price: number | null): string {
  if (price == null) return '—';
  return `$${price}`;
}

export function ListingCard({ listing, snapshots, selected, onSelect }: ListingCardProps) {
  const trend = getTrend(snapshots);
  const withPrice = snapshots.filter((s) => s.total_price != null);
  const latestPrice =
    withPrice.length > 0
      ? withPrice[withPrice.length - 1].total_price
      : null;

  const trendLabel =
    trend === 'rising' ? '↑ Rising' : trend === 'dropping' ? '↓ Dropping' : '→ Stable';
  const trendColor = trend === 'rising' ? COLORS.rising : trend === 'dropping' ? COLORS.dropping : COLORS.stable;

  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: 12,
        marginBottom: 8,
        background: '#fff',
        border: selected ? `2px solid ${COLORS.primary}` : '1px solid #e0e0e0',
        borderRadius: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        cursor: 'pointer',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
        {listing.name || 'Unnamed listing'}
      </div>
      <div style={{ fontSize: 13, color: '#333', marginBottom: 4 }}>
        {formatPrice(latestPrice)}
      </div>
      <span
        style={{
          fontSize: 12,
          color: trendColor,
          fontWeight: 500,
        }}
      >
        {trendLabel}
      </span>
    </button>
  );
}
