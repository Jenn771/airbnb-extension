-- Add thumbnail_url to existing listings table (safe to run multiple times)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
