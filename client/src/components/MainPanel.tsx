import { useState, useMemo, useEffect } from 'react';
import type { Listing, PriceSnapshot } from '../api';
import { getTrend, groupSnapshotsByContext, getMostRecentContextKey } from '../api';
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

function formatContextLabel(context: string): string {
  const [type, months] = context.split('|');
  if (!months) return context;
  const monthList = months.split(',').map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(', ');
  
  const nightMatch = type.match(/^(\d+)night$/i);
  const typeLabel = nightMatch
    ? `${nightMatch[1]} Nights`
    : type.charAt(0).toUpperCase() + type.slice(1);

  return `${typeLabel} · ${monthList}`;
}

function formatPrice(price: number | null): string {
  if (price == null) return '—';
  return `$${price.toLocaleString()}`;
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

function hasAnyPrice(snapshots: PriceSnapshot[]): boolean {
  return snapshots.some((s) => s.total_price != null);
}

export function MainPanel({ listing, snapshots }: MainPanelProps) {
  const byContext = groupSnapshotsByContext(snapshots);
  const contextEntries = useMemo(() => {
    const entries = Array.from(byContext.entries());
    entries.sort(([, a], [, b]) => {
      const maxA = Math.max(...a.map((s) => new Date(s.checked_at).getTime()));
      const maxB = Math.max(...b.map((s) => new Date(s.checked_at).getTime()));
      return maxB - maxA;
    });
    return entries;
  }, [byContext]);

  const defaultChartContext = getMostRecentContextKey(byContext);
  const [chartContextKey, setChartContextKey] = useState<string | null>(defaultChartContext);
  useEffect(() => {
    setChartContextKey(getMostRecentContextKey(byContext));
  }, [listing.id]);
  const effectiveChartContext = chartContextKey ?? defaultChartContext;
  const chartSnapshots = effectiveChartContext ? byContext.get(effectiveChartContext) ?? [] : [];

  const listingName = listing.name || 'Unnamed listing';

  function getTrendPillStyle(trend: 'rising' | 'dropping' | 'stable') {
    return trend === 'rising'
      ? { backgroundColor: '#fff0f0', color: '#c62828' }
      : trend === 'dropping'
        ? { backgroundColor: '#e8f5e9', color: '#2e7d32' }
        : { backgroundColor: '#f5f5f5', color: '#616161' };
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      <a
        href={listing.airbnb_url}
        target="_blank"
        rel="noopener noreferrer"
        title="Open listing on Airbnb"
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: COLORS.primary,
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 24,
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.textDecoration = 'underline';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.textDecoration = 'none';
        }}
      >
        {listingName}
        <span style={{ fontSize: 14, opacity: 0.85 }} aria-hidden="true">↗</span>
      </a>

      {contextEntries.length === 0 ? (
        <div
          style={{
            background: '#fff',
            borderRadius: 10,
            padding: 32,
            textAlign: 'center',
            color: '#666',
            fontSize: 14,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          No price history yet. Check prices from the extension to see data here.
        </div>
      ) : (
        <>
          <section
            style={{
              background: '#fff',
              borderRadius: 10,
              padding: 28,
              marginBottom: 40,
              boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 24,
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#222' }}>
                Price history
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>
                  Search context
                </span>
                <select
                  id="chart-context-select"
                  value={effectiveChartContext ?? ''}
                  onChange={(e) => setChartContextKey(e.target.value || null)}
                  style={{
                    padding: '8px 12px',
                    fontSize: 13,
                    borderRadius: 8,
                    border: '1px solid #e0e0e0',
                    color: '#333',
                    background: '#fff',
                    cursor: 'pointer',
                    minWidth: 180,
                  }}
                >
                  {contextEntries.map(([key]) => (
                    <option key={key} value={key}>
                      {formatContextLabel(key)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {hasAnyPrice(chartSnapshots) ? (
              <PriceLineChart snapshots={chartSnapshots} />
            ) : (
              <div
                style={{
                  padding: '32px 24px',
                  background: '#fafafa',
                  borderRadius: 8,
                  color: '#888',
                  fontSize: 13,
                  textAlign: 'center',
                  border: '1px dashed #e8e8e8',
                }}
              >
                No price data to chart for this context.
              </div>
            )}
          </section>

          {contextEntries.map(([searchContext, contextSnapshots]) => {
            const hasPrice = hasAnyPrice(contextSnapshots);
            const { latest, lowest, trend } = statsForSnapshots(contextSnapshots);
            const trendLabel =
              trend === 'rising'
                ? '↑ Rising'
                : trend === 'dropping'
                  ? '↓ Dropping'
                  : '→ Stable';
            const pill = getTrendPillStyle(trend);

            return (
              <section
                key={searchContext}
                style={{
                  background: '#fff',
                  borderRadius: 10,
                  padding: 24,
                  marginBottom: 24,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                  minWidth: 0,
                  overflow: 'hidden',
                }}
              >
                <h3
                  style={{
                    margin: '0 0 20px',
                    fontSize: 15,
                    fontWeight: 600,
                    color: COLORS.primary,
                  }}
                >
                  {formatContextLabel(searchContext)}
                </h3>

                {hasPrice ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 28,
                      marginBottom: 20,
                      paddingBottom: 20,
                      borderBottom: '1px solid #f0f0f0',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span
                        style={{
                          fontSize: 11,
                          color: '#888',
                          fontWeight: 500,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Latest
                      </span>
                      <span style={{ fontSize: 16, fontWeight: 600, color: '#222' }}>
                        {formatPrice(latest)}
                      </span>
                    </div>
                    <div
                      style={{
                        width: 1,
                        height: 32,
                        background: '#ebebeb',
                        flexShrink: 0,
                      }}
                    />
                    <div
                      style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                      title="Lowest price in this search context since tracking began"
                    >
                      <span
                        style={{
                          fontSize: 11,
                          color: '#888',
                          fontWeight: 500,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Lowest
                      </span>
                      <span style={{ fontSize: 16, fontWeight: 600, color: '#222' }}>
                        {formatPrice(lowest)}
                      </span>
                    </div>
                    <div
                      style={{
                        width: 1,
                        height: 32,
                        background: '#ebebeb',
                        flexShrink: 0,
                      }}
                    />
                    <div
                      style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                      title="Compared to the previous check in this search context (last two price points)"
                    >
                      <span
                        style={{
                          fontSize: 11,
                          color: '#888',
                          fontWeight: 500,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Trend
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          borderRadius: 12,
                          padding: '4px 10px',
                          display: 'inline-block',
                          width: 'fit-content',
                          ...pill,
                        }}
                      >
                        {trendLabel}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p
                    style={{
                      color: '#888',
                      fontSize: 13,
                      margin: '0 0 20px',
                      paddingBottom: 20,
                      borderBottom: '1px solid #f0f0f0',
                    }}
                  >
                    No available dates found for this search.
                  </p>
                )}

                <PriceChart snapshots={contextSnapshots} />
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}