-- Add ON DELETE CASCADE to price_snapshots.listing_id so deleting a listing removes its snapshots
ALTER TABLE price_snapshots DROP CONSTRAINT IF EXISTS price_snapshots_listing_id_fkey;
ALTER TABLE price_snapshots ADD CONSTRAINT price_snapshots_listing_id_fkey
FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
