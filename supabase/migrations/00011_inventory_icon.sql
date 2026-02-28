-- Add icon column to inventory table
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT NULL;
