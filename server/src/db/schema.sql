CREATE TABLE IF NOT EXISTS listings (
    id SERIAL PRIMARY KEY,
    airbnb_url TEXT NOT NULL UNIQUE,
    name TEXT,
    thumbnail_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_snapshots (
    id SERIAL PRIMARY KEY,
    listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
    date_range TEXT NOT NULL,
    total_price INTEGER,
    search_context TEXT NOT NULL,
    checked_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE price_snapshots DROP CONSTRAINT IF EXISTS price_snapshots_listing_id_fkey;
ALTER TABLE price_snapshots ADD CONSTRAINT price_snapshots_listing_id_fkey
FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;