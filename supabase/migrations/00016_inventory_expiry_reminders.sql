-- Add per-item expiry reminders for inventory supplies
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS inventory_expiry_reminders (
    id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    cat_id uuid NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
    item_name text NOT NULL,
    expires_on date NOT NULL,
    discarded_at timestamptz DEFAULT NULL,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_expiry_cat_expires
    ON inventory_expiry_reminders(cat_id, expires_on);

ALTER TABLE inventory_expiry_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inv_expiry_select" ON public.inventory_expiry_reminders;
DROP POLICY IF EXISTS "inv_expiry_insert" ON public.inventory_expiry_reminders;
DROP POLICY IF EXISTS "inv_expiry_update" ON public.inventory_expiry_reminders;
DROP POLICY IF EXISTS "inv_expiry_delete" ON public.inventory_expiry_reminders;

CREATE POLICY "inv_expiry_select"
    ON public.inventory_expiry_reminders FOR SELECT
    USING (can_access_cat(cat_id));

CREATE POLICY "inv_expiry_insert"
    ON public.inventory_expiry_reminders FOR INSERT
    WITH CHECK (can_access_cat(cat_id));

CREATE POLICY "inv_expiry_update"
    ON public.inventory_expiry_reminders FOR UPDATE
    USING (can_access_cat(cat_id));

CREATE POLICY "inv_expiry_delete"
    ON public.inventory_expiry_reminders FOR DELETE
    USING (can_access_cat(cat_id));
