-- Daily inventory deduction: subtract daily_consumption from total_quantity
-- Scheduled via pg_cron to run at midnight UTC+8 (16:00 UTC = 00:00 Asia/Shanghai)

-- Create the deduction function
create or replace function deduct_daily_inventory()
returns void as $$
begin
  update inventory
  set total_quantity = greatest(0, total_quantity - daily_consumption)
  where daily_consumption is not null
    and daily_consumption > 0
    and total_quantity is not null
    and total_quantity > 0;
end;
$$ language plpgsql security definer;

-- Schedule cron job: every day at 16:00 UTC (= midnight Asia/Shanghai)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'daily-inventory-deduction') then
    perform cron.unschedule('daily-inventory-deduction');
  end if;
exception when others then
  null;
end $$;

select cron.schedule(
  'daily-inventory-deduction',
  '0 16 * * *',
  $$ select deduct_daily_inventory(); $$
);
