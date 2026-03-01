import type { Listing, PriceSnapshot } from '../api';
import { getTrend, groupSnapshotsByContext } from '../api';
import { PriceChart } from './PriceChart';
import { PriceLineChart } from './PriceLineChart';

const COLORS = {
  primary: '#0069A6',
  rising: '#e53935',
  dropping: '#2e7d32',
  stable: '#666',
};

type MainPanelProps = {
  listing: Listing;
  snapshots: PriceSnapshot[];
};

function formatPrice(price: number | null): string {
  if (price == null) return '—';
  return `$${price}`;
}

function statsForSnapshots(snapshots: PriceSnapshot[]) {
  const withPrice = snapshots.filter((s) => s.total_price != null);
  if (withPrice.length === 0) {
    return { latest: null, lowest: null, trend: 'stable' as const };
  }
  const sorted = [...withPrice].sort(
    (a, b) => new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime()
  );
  const latest = sorted[sorted.length - 1].total_price;
  const lowest = Math.min(...sorted.map((s) => s.total_price!));
  const trend = getTrend(snapshots);
  return { latest, lowest, trend };
}

export function MainPanel({ listing, snapshots }: MainPanelProps) {
  const byContext = groupSnapshotsByContext(snapshots);
  const contextEntries = Array.from(byContext.entries());

  return (
    <div>
      <h1 style={{ margin: '0 0 8px', fontSize: 22, color: '#111' }}>
        {listing.name || 'Unnamed listing'}
      </h1>
      <a
        href={listing.airbnb_url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: 14, color: COLORS.primary, marginBottom: 24, display: 'inline-block' }}
      >
        View on Airbnb
      </a>

      {contextEntries.length === 0 ? (
        <p style={{ color: '#666' }}>No price history yet.</p>
      ) : (
        contextEntries.map(([searchContext, contextSnapshots]) => {
          const { latest, lowest, trend } = statsForSnapshots(contextSnapshots);
          const trendLabel =
            trend === 'rising'
              ? '↑ Rising'
              : trend === 'dropping'
                ? '↓ Dropping'
                : '→ Stable';
          const trendColor =
            trend === 'rising' ? COLORS.rising : trend === 'dropping' ? COLORS.dropping : COLORS.stable;

          return (
            <section
              key={searchContext}
              style={{
                background: '#fff',
                borderRadius: 8,
                padding: 20,
                marginBottom: 24,
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              <h3 style={{ margin: '0 0 16px', fontSize: 16, color: COLORS.primary }}>
                {searchContext}
              </h3>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 16,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    padding: 16,
                    background: '#fafafa',
                    borderRadius: 8,
                    border: '1px solid #eee',
                  }}
                >
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                    Latest Price
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>
                    {formatPrice(latest)}
                  </div>
                </div>
                <div
                  style={{
                    padding: 16,
                    background: '#fafafa',
                    borderRadius: 8,
                    border: '1px solid #eee',
                  }}
                >
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                    Lowest Seen
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>
                    {formatPrice(lowest)}
                  </div>
                </div>
                <div
                  style={{
                    padding: 16,
                    background: '#fafafa',
                    borderRadius: 8,
                    border: '1px solid #eee',
                  }}
                >
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                    Trend
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: trendColor }}>
                    {trendLabel}
                  </div>
                </div>
              </div>

              <PriceLineChart snapshots={contextSnapshots} title="Price over time" />
              <PriceChart snapshots={contextSnapshots} title={searchContext} />
            </section>
          );
        })
      )}
    </div>
  );
}
