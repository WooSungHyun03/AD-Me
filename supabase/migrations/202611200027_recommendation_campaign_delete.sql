-- Preserve the existing owner's campaign DELETE flow. Direct history mutation
-- remains forbidden; only the actual parent FK cascade may remove snapshots.
begin;
alter table adme_recommendation.snapshots drop constraint snapshots_campaign_id_fkey;
alter table adme_recommendation.snapshots add constraint snapshots_campaign_id_fkey
 foreign key(campaign_id) references public.campaigns(id) on delete cascade;
create or replace function adme_recommendation.immutable() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' and pg_trigger_depth()>1 and not exists(select 1 from public.campaigns where id=old.campaign_id) then return old; end if;
 raise exception 'recommendation snapshot is immutable' using errcode='23514';
end;
$$;
revoke all on function adme_recommendation.immutable() from public,anon,authenticated,service_role;
commit;
