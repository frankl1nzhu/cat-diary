-- Trigger to keep inventory.status automatically synchronized with total_quantity and daily_consumption (alert threshold)
create or replace function sync_inventory_status()
returns trigger as $$
begin
  if new.total_quantity is not null and new.total_quantity <= 0 then
    new.status := 'urgent';
  elsif new.total_quantity is not null and new.daily_consumption is not null then
    if new.total_quantity <= new.daily_consumption then
      new.status := 'urgent';
    elsif new.total_quantity <= new.daily_consumption * 1.5 then
      new.status := 'low';
    else
      new.status := 'plenty';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_sync_inventory_status on inventory;
create trigger trigger_sync_inventory_status
  before insert or update on inventory
  for each row execute function sync_inventory_status();

-- Backfill existing rows whose status may be inconsistent with total_quantity
update inventory
set status = case
  when total_quantity is not null and total_quantity <= 0 then 'urgent'::inventory_status
  when total_quantity is not null and daily_consumption is not null and total_quantity <= daily_consumption then 'urgent'::inventory_status
  when total_quantity is not null and daily_consumption is not null and total_quantity <= daily_consumption * 1.5 then 'low'::inventory_status
  when total_quantity is not null and daily_consumption is not null then 'plenty'::inventory_status
  else status
end;
