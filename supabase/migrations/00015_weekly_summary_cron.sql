-- Server-side weekly summary schedule: every Sunday 12:00 (Asia/Shanghai ~= 04:00 UTC)

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'weekly-summary-sunday-noon') then
    perform cron.unschedule('weekly-summary-sunday-noon');
  end if;
exception when others then
  null;
end $$;

select cron.schedule(
  'weekly-summary-sunday-noon',
  '0 4 * * 0',
  $$
    select net.http_post(
      url := 'https://bfxfelvwerplnomsmsns.supabase.co/functions/v1/send-reminders',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{"action":"weekly-summary-cron"}'::jsonb
    );
  $$
);
