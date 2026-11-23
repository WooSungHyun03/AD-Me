-- D008/D065: app flags alone never enable direct database TEST orders.
begin;
create schema adme_release;
revoke all on schema adme_release from public,anon,authenticated,service_role;
grant usage on schema adme_release to anon,authenticated,service_role;
create table adme_release.billing_boundary(singleton boolean primary key default true check(singleton),enabled boolean not null default false,release_ref text,changed_at timestamptz);
alter table adme_release.billing_boundary enable row level security;
revoke all on adme_release.billing_boundary from public,anon,authenticated,service_role;
insert into adme_release.billing_boundary(singleton) values(true);
create function adme_release.billing_enabled() returns boolean language sql stable security definer set search_path='' as $$ select coalesce((select enabled from adme_release.billing_boundary where singleton),false); $$;
create function adme_release.set_test_billing(p_enabled boolean,p_release text) returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_enabled is null or p_release is null or length(btrim(p_release)) not between 7 and 100 then raise invalid_parameter_value; end if;
 update adme_release.billing_boundary set enabled=p_enabled,release_ref=btrim(p_release),changed_at=statement_timestamp() where singleton;
end;
$$;
alter function public.create_test_order(text) set schema adme_release;
alter function adme_release.create_test_order(text) rename to create_order_legacy;
alter function public.finalize_test_order(uuid,uuid,text,integer) set schema adme_release;
alter function adme_release.finalize_test_order(uuid,uuid,text,integer) rename to finalize_order_legacy;
create function adme_release.create_order(p_sku text) returns public.orders language plpgsql security definer set search_path='' as $$
begin
 if not adme_release.billing_enabled() then raise exception 'TEST billing disabled' using errcode='PT404'; end if;
 return adme_release.create_order_legacy(p_sku);
end;
$$;
create function adme_release.finalize_order(p_order uuid,p_owner uuid,p_payment_key text,p_amount integer) returns uuid language plpgsql security definer set search_path='' as $$
begin
 if not adme_release.billing_enabled() then raise exception 'TEST billing disabled' using errcode='PT404'; end if;
 return adme_release.finalize_order_legacy(p_order,p_owner,p_payment_key,p_amount);
end;
$$;
create function public.create_test_order(p_sku text) returns public.orders language sql volatile security invoker set search_path='' as $$ select adme_release.create_order($1); $$;
create function public.finalize_test_order(p_order uuid,p_owner uuid,p_payment_key text,p_amount integer) returns uuid language sql volatile security invoker set search_path='' as $$ select adme_release.finalize_order($1,$2,$3,$4); $$;
create function public.test_billing_available() returns boolean language sql stable security invoker set search_path='' as $$ select adme_release.billing_enabled(); $$;
create policy test_products_boundary on public.products as restrictive for select to anon,authenticated using(adme_release.billing_enabled());
create or replace function public.active_hot_creators() returns table(creator_id text,profile jsonb,expires_at timestamptz)
language sql stable security invoker set search_path='' as $$ select * from adme_creator.hot_catalog() where adme_release.billing_enabled(); $$;
revoke all on all functions in schema adme_release from public,anon,authenticated,service_role;
grant execute on function adme_release.billing_enabled() to anon,authenticated,service_role;
grant execute on function adme_release.create_order(text) to authenticated;
grant execute on function adme_release.finalize_order(uuid,uuid,text,integer) to service_role;
revoke all on function public.create_test_order(text),public.finalize_test_order(uuid,uuid,text,integer),public.test_billing_available() from public,anon,authenticated,service_role;
grant execute on function public.create_test_order(text) to authenticated;
grant execute on function public.finalize_test_order(uuid,uuid,text,integer) to service_role;
grant execute on function public.test_billing_available() to anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
