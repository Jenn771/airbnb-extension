CREATE TABLE IF NOT EXISTS listings (
    id SERIAL PRIMARY KEY,
    airbnb_url TEXT NOT NULL UNIQUE,
    name TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_snapshots (
    id SERIAL PRIMARY KEY,
    listing_id INTEGER REFERENCES listings(id),
    date_range TEXT NOT NULL,
    total_price INTEGER,
    search_context TEXT NOT NULL,
    checked_at TIMESTAMP DEFAULT NOW()
);