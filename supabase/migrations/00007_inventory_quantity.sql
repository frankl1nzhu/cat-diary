-- Add quantity-based inventory tracking
ALTER TABLE inventory
    ADD COLUMN total_quantity numeric DEFAULT NULL,
    ADD COLUMN daily_consumption numeric DEFAULT NULL;

-- Backfill: derive quantity from existing status for smooth migration
-- urgent => ~1 day, low => ~5 days, plenty => ~14 days   (assuming consumption = 1)
UPDATE inventory SET total_quantity = 1, daily_consumption = 1 WHERE status = 'urgent';
UPDATE inventory SET total_quantity = 5, daily_consumption = 1 WHERE status = 'low';
UPDATE inventory SET total_quantity = 14, daily_consumption = 1 WHERE status = 'plenty';
