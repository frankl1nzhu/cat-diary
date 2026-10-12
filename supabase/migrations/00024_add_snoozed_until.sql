-- Migration 00024: Add snoozed_until column to inventory, inventory_expiry_reminders, and health_records
alter table public.inventory
  add column if not exists snoozed_until timestamptz null;

alter table public.inventory_expiry_reminders
  add column if not exists snoozed_until timestamptz null;

alter table public.health_records
  add column if not exists snoozed_until timestamptz null;

create index if not exists idx_inventory_snoozed_until on public.inventory (cat_id, snoozed_until);
create index if not exists idx_expiry_snoozed_until on public.inventory_expiry_reminders (cat_id, snoozed_until);
create index if not exists idx_health_snoozed_until on public.health_records (cat_id, snoozed_until);
