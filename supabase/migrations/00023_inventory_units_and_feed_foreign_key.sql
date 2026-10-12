-- Migration 00023: Add custom units to inventory and foreign key to feed_status
-- 1. Inventory units support: base quantity is ALWAYS stored in grams (g)
ALTER TABLE public.inventory
    ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'g',
    ADD COLUMN IF NOT EXISTS unit_ratio numeric NOT NULL DEFAULT 1 CHECK (unit_ratio > 0);

-- 2. Link feed_status directly to inventory via foreign key
ALTER TABLE public.feed_status
    ADD COLUMN IF NOT EXISTS inventory_id uuid REFERENCES public.inventory(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_feed_status_inventory_id
    ON public.feed_status(inventory_id);
