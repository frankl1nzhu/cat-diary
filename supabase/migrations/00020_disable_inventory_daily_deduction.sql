-- Disable legacy daily inventory deduction.
-- The app now treats inventory.daily_consumption as an alert threshold,
-- and stock is deducted on explicit feeding actions only.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'daily-inventory-deduction') then
    perform cron.unschedule('daily-inventory-deduction');
  end if;
exception when others then
  null;
end $$;

drop function if exists public.deduct_daily_inventory();
