import type { Listing, PriceSnapshot } from '../api';
import { PriceChart } from './PriceChart';

type ListingCardProps = {
  listing: Listing;
  snapshots: PriceSnapshot[];
};

export function ListingCard({ listing, snapshots }: ListingCardProps) {
  return (
    <article
      style={{
        background: 'white',
        borderRadius: 8,
        padding: '1rem 1.25rem',
        marginBottom: 16,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}
    >
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>
        {listing.name || 'Unnamed listing'}
      </h3>
      <a
        href={listing.airbnb_url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: 14, color: '#0069A6' }}
      >
        View on Airbnb
      </a>
      {snapshots.length > 0 ? (
        <PriceChart snapshots={snapshots} />
      ) : (
        <p style={{ margin: '1rem 0 0', color: '#666', fontSize: 14 }}>
          No price history yet.
        </p>
      )}
    </article>
  );
}
