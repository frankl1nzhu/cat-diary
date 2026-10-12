-- Add compound indexes for high-frequency queries on core tables

-- 1. feed_status: queried by cat_id and fed_at DESC
CREATE INDEX IF NOT EXISTS idx_feed_status_cat_fed_at
  ON public.feed_status (cat_id, fed_at DESC);

-- 2. diary_entries: queried by cat_id and created_at DESC
CREATE INDEX IF NOT EXISTS idx_diary_entries_cat_created_at
  ON public.diary_entries (cat_id, created_at DESC);

-- 3. poop_logs: queried by cat_id and created_at DESC
CREATE INDEX IF NOT EXISTS idx_poop_logs_cat_created_at
  ON public.poop_logs (cat_id, created_at DESC);

-- 4. weight_records: queried by cat_id and recorded_at ASC
CREATE INDEX IF NOT EXISTS idx_weight_records_cat_recorded_at
  ON public.weight_records (cat_id, recorded_at ASC);

-- 5. inventory: queried by cat_id and item_name
CREATE INDEX IF NOT EXISTS idx_inventory_cat_item_name
  ON public.inventory (cat_id, item_name);

-- 6. mood_logs: queried by cat_id and date
CREATE INDEX IF NOT EXISTS idx_mood_logs_cat_date
  ON public.mood_logs (cat_id, date);

-- 7. inventory_expiry_reminders: queried by cat_id and discarded_at
CREATE INDEX IF NOT EXISTS idx_inv_expiry_cat_discarded
  ON public.inventory_expiry_reminders (cat_id, discarded_at);

-- 8. health_records: queried by cat_id and date DESC
CREATE INDEX IF NOT EXISTS idx_health_records_cat_date
  ON public.health_records (cat_id, date DESC);
