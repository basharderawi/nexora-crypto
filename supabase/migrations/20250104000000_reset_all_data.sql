-- DEV ONLY: Full development reset (orders + inventory_ledger + inventory_state zeroed)
create or replace function reset_all_data()
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from orders;
  delete from inventory_ledger;

  update inventory_state
  set
    usdt_balance = 0,
    total_cost_ils = 0,
    avg_cost_ils_per_usdt = 0,
    updated_at = now()
  where id = 1;

  return json_build_object('ok', true);
end;
$$;

grant execute on function reset_all_data() to authenticated;
