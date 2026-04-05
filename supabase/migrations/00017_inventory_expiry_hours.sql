-- Upgrade inventory expiry reminders from day-based date to hour-based timestamp
ALTER TABLE public.inventory_expiry_reminders
    ADD COLUMN IF NOT EXISTS expires_at timestamptz;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'inventory_expiry_reminders'
          AND column_name = 'expires_on'
    ) THEN
        EXECUTE '
            UPDATE public.inventory_expiry_reminders
            SET expires_at = (expires_on::timestamptz + interval ''1 day'')
            WHERE expires_at IS NULL
        ';
    END IF;
END
$$;

ALTER TABLE public.inventory_expiry_reminders
    ALTER COLUMN expires_at SET NOT NULL;

DROP INDEX IF EXISTS idx_inv_expiry_cat_expires;

CREATE INDEX IF NOT EXISTS idx_inv_expiry_cat_expires_at
    ON public.inventory_expiry_reminders(cat_id, expires_at);

ALTER TABLE public.inventory_expiry_reminders
    DROP COLUMN IF EXISTS expires_on;
