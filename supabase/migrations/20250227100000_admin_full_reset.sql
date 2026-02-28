-- Admin-only full reset: orders, inventory_ledger, inventory_state in a single transaction.
-- Called from API route with service role; not exposed to client.
create or replace function admin_full_reset()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  seq text;
begin
  delete from orders;
  delete from inventory_ledger;
  delete from inventory_state;

  insert into inventory_state (id, usdt_balance, total_cost_ils, avg_cost_ils_per_usdt)
  values (1, 0, 0, 0)
  on conflict (id) do nothing;

  select pg_get_serial_sequence('inventory_ledger', 'id') into seq;
  if seq is not null then
    execute format('select setval(%L, 1)', seq);
  end if;

  return json_build_object('success', true);
exception when others then
  return json_build_object('success', false, 'error', sqlerrm);
end;
$$;

grant execute on function admin_full_reset() to service_role;
grant execute on function admin_full_reset() to authenticated;
