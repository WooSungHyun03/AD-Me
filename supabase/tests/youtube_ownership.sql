\set ON_ERROR_STOP on
begin;
update adme_ops.resource_controls set ingestion_enabled=true,llm_enabled=true where singleton=true;
insert into auth.users(id,raw_user_meta_data) values
 ('ad000000-0000-4000-8000-000000000101','{"role":"creator"}'),
 ('ad000000-0000-4000-8000-000000000102','{"role":"creator"}');
insert into public.creators(id,owner_id,published,profile)
values('test-youtube-profile','ad000000-0000-4000-8000-000000000101',true,'{"name":"Fixture creator","bio":"","handle":"fixture","categories":[],"vibes":[],"formats":[],"platforms":["youtube"],"price_min_krw":0,"price_max_krw":0,"followers":0,"is_available":false,"is_demo":false}');
insert into adme_ops.channels(channel_id,title,review)
values('UC_x5XG1OV2P6uZZ5FSM9Ttw','Fixture YouTube','accepted');
update adme_ops.settings set worker_hash=sha256(convert_to(repeat('a',64),'UTF8')) where singleton=true;
set local role authenticated;
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000101',true);
select public.ops_channel_owner('create','UC_x5XG1OV2P6uZZ5FSM9Ttw');
select public.ops_channel_owner('check','UC_x5XG1OV2P6uZZ5FSM9Ttw');
do $$
begin
  assert public.ops_own_channels()->0->>'challenge' is not null;
  assert public.ops_public_channels('Fixture')='[]'::jsonb;
  begin
    perform public.ops_channel_owner('publish','UC_x5XG1OV2P6uZZ5FSM9Ttw');
    raise exception 'unverified channel was publishable';
  exception when insufficient_privilege then null; end;
end;
$$;
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000102',true);
do $$ begin assert public.ops_own_channels()='[]'::jsonb; end; $$;
reset role;
do $$
declare j jsonb;
begin
  j := public.ops_worker_claim(repeat('a',64));
  assert j->>'kind'='youtube_claim';
  assert public.ops_worker_finish(repeat('a',64),(j->>'id')::uuid,(j->>'lease')::uuid,'{"verified":true}',null,12);
  assert (select verified_at is not null from adme_ops.channel_claims limit 1);
  assert (select output is null and strpos(input,':')=0 from adme_ops.jobs where kind='youtube_claim');
  assert public.ops_public_channels() = '[]'::jsonb;
end;
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000101',true);
select public.ops_channel_owner('publish','UC_x5XG1OV2P6uZZ5FSM9Ttw');
set local role anon;
do $$ begin
  assert public.ops_public_channels('Fixture')->0->>'creator_id'='test-youtube-profile';
  assert public.ops_public_channels('unknown')='[]'::jsonb;
end; $$;
set local role authenticated;
select public.ops_channel_owner('hide','UC_x5XG1OV2P6uZZ5FSM9Ttw');
set local role anon;
do $$ begin assert public.ops_public_channels()='[]'::jsonb; end; $$;
rollback;
