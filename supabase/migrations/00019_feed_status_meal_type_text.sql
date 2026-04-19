-- Migrate feed_status.meal_type from enum to free-form text
-- The app now uses "item_name|grams" format for inventory-based feeding
-- rather than fixed meal-type enum values.

-- 1. Drop the unique index (per-meal-type-per-day — no longer valid
--    with free-form item names; multiple feedings per day are allowed)
DROP INDEX IF EXISTS feed_status_unique_daily;

-- 2. Remove the enum default before altering the column type
ALTER TABLE feed_status ALTER COLUMN meal_type DROP DEFAULT;

-- 3. Change column from meal_type enum → text, preserving existing values
ALTER TABLE feed_status
    ALTER COLUMN meal_type TYPE text USING meal_type::text;

-- 4. Keep NOT NULL; set empty-string default so inserts without a value still work
ALTER TABLE feed_status ALTER COLUMN meal_type SET DEFAULT '';
