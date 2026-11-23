-- D045/D076: reject excessive attempts before scanning the bounded catalogue.
begin;
alter function adme_recommendation.context(uuid) rename to context_unmetered;
create function adme_recommendation.context(p_campaign uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
 if auth.uid() is null or public.my_role() is distinct from 'brand' or not exists(
 select 1 from public.campaigns where id=p_campaign and owner_id=auth.uid() and moderation_status='allowed') then
 raise exception 'campaign owner required' using errcode='42501'; end if;
 perform adme_ops.require_quota('recommendation_context',auth.uid()::text,120,60);
 return adme_recommendation.context_unmetered(p_campaign);
end;
$$;
revoke all on function adme_recommendation.context(uuid),adme_recommendation.context_unmetered(uuid) from public,anon,authenticated,service_role;
commit;
