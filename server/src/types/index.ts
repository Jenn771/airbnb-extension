export interface Listing {
    id: number;
    airbnb_url: string;
    name: string | null;
    created_at: Date;
}

export interface PriceSnapshot {
    id: number;
    listing_id: number;
    date_range: string;
    total_price: number;
    checked_at: Date;
}

// What the extension POSTs to the API
export interface IncomingPriceData {
    airbnb_url: string;
    name: string;
    date_range: string;
    total_price: number;
}