import { useEffect, useState } from 'react';
import type { Listing, PriceSnapshot } from '../api';
import { getTrend, getMostRecentContextKey, groupSnapshotsByContext, fetchOgImage, deleteListing } from '../api';

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
  onDelete: () => void;
};

function formatPrice(price: number | null): string {
  if (price == null) return '—';
  return `$${price.toLocaleString()}`;
}

function formatDateRange(dateRange: string): string {
  if (dateRange === 'no-available-dates') return 'No available dates';
  return dateRange;
}

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

export function ListingCard({ listing, snapshots, selected, onSelect, onDelete }: ListingCardProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(listing.thumbnail_url ?? null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteHover, setDeleteHover] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await deleteListing(listing.id);
      setShowDeleteModal(false);
      onDelete();
    } catch {
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.location.hostname !== 'localhost') {
      alert('Demo mode: deletion is disabled on the live dashboard. Run the project locally to test full functionality.');
      return;
    }
    setShowDeleteModal(true);
  };
  
return (
    <div style={{ position: 'relative', marginBottom: 10 }}>
      <button
        type="button"
        onClick={onSelect}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: 14,
          background: '#fff',
          border: selected ? `2px solid ${COLORS.primary}` : '2px solid transparent',
          borderRadius: 12,
          boxShadow: '0 1px 6px rgba(0,0,0,0.12)',
          cursor: 'pointer',
        }}
      >
        {/* Top row: image + name + date range */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
          <div
            style={{
              width: 65,
              height: 65,
              flexShrink: 0,
              borderRadius: 8,
              overflow: 'hidden',
              background: '#f0f6fb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {imageUrl ? (
              <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : null}
          </div>
          
          <div style={{ flex: 1, minWidth: 0, paddingRight: 30, marginTop: 8 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 14,
                color: '#222',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={listingName}
            >
              {listingName}
            </div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 3 }}>
              {mostRecentDateRange}
            </div>
          </div>
        </div>
  
        {/* Bottom row: price + trend badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#222' }}>
              {formatPrice(latestPrice)}
            </span>
            <span style={{ fontSize: 12, color: '#aaa', marginLeft: 4 }}>latest</span>
          </div>
          <span
            title="Trend in the most recent search context"
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

      {/* Delete Button - Positioned Absolute */}
      <button
        type="button"
        aria-label="Delete listing"
        onClick={handleDeleteClick}
        onMouseEnter={() => setDeleteHover(true)}
        onMouseLeave={() => setDeleteHover(false)}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          padding: 6,
          border: 'none',
          borderRadius: 8,
          background: 'transparent',
          cursor: 'pointer',
          color: deleteHover ? '#e53935' : '#ccc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
        }}
      >
        <TrashIcon />
      </button>

      {/* Confirmation Modal */}
      {showDeleteModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)', 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => !deleting && setShowDeleteModal(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: 24,
              maxWidth: 320,
              textAlign: 'center',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700 }}>Delete listing?</h3>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: '#666', lineHeight: 1.5 }}>
              This will remove all price history for this Airbnb. This cannot be undone.
            </p>
            
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => !deleting && setShowDeleteModal(false)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  background: '#fff',
                  color: '#444',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  border: 'none',
                  borderRadius: 8,
                  background: '#e53935',
                  color: '#fff',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}