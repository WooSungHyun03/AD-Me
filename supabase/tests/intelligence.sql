\set ON_ERROR_STOP on
begin;
update adme_ops.resource_controls set ingestion_enabled=true,llm_enabled=true where singleton=true;
insert into auth.users(id,raw_user_meta_data) values
  ('ad000000-0000-4000-8000-000000000001','{"name":"Integration Admin"}'),
  ('ad000000-0000-4000-8000-000000000002','{"name":"Integration Brand"}'),
  ('ad000000-0000-4000-8000-000000000003','{"name":"Integration Finance"}');
select public.provision_administrator('ad000000-0000-4000-8000-000000000001','Local integration fixture',now()+interval '1 day');
select adme_ops.provision_staff('ad000000-0000-4000-8000-000000000003','finance','Local integration fixture',now()+interval '1 day');

set local role authenticated;
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims',jsonb_build_object('aal','aal2','amr',jsonb_build_array(jsonb_build_object('method','totp','timestamp',floor(extract(epoch from now())))))::text,true);
do $$
begin
  assert public.ops_current_role()='finance';
  -- Other QA flows may have TEST orders; finance must receive an array, not null.
  assert jsonb_typeof(public.ops_dashboard()->'orders')='array';
  assert public.ops_dashboard()->'members'='null'::jsonb;
  begin
    perform public.ops_admin_command('channel','UC_x5XG1OV2P6uZZ5FSM9Ttw');
    raise exception 'finance can enqueue a channel';
  exception when insufficient_privilege then null; end;
end;
$$;
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000001',true);
select public.ops_admin_command('discovery','뷰티 리뷰','true');
select public.ops_admin_command('channel','UC_x5XG1OV2P6uZZ5FSM9Ttw');
select public.ops_admin_command('channel','UC_x5XG1OV2P6uZZ5FSM9Ttw');
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000002',true);
select public.ops_draft_create('선크림 광고 통합 테스트용 초안') as draft_id \gset
select set_config('adme.test_draft', :'draft_id', true);
do $$
begin
  assert public.ops_current_role() is null;
  assert public.ops_draft_get(current_setting('adme.test_draft')::uuid)->>'status'='queued';
  begin
    perform public.ops_dashboard();
    raise exception 'ordinary brand can read operations data';
  exception when insufficient_privilege then null; end;
end;
$$;
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000003',true);
do $$ begin assert public.ops_draft_get(current_setting('adme.test_draft')::uuid) is null; end; $$;
reset role;
-- Both inserts share transaction now(); make the intended queue order explicit.
update adme_ops.jobs set created_at=now()-interval '2 minutes'
where kind='youtube_channel' and owner_id='ad000000-0000-4000-8000-000000000001';

do $$
declare v_token text := repeat('a',64); j jsonb;
begin
  update adme_ops.settings set worker_hash=sha256(convert_to(v_token,'UTF8'));
  assert (select discovery_enabled from adme_ops.settings);
  assert (select count(*) from adme_ops.jobs where kind='youtube_channel')=1;
  begin
    perform public.ops_worker_claim(repeat('b',64));
    raise exception 'invalid worker token accepted';
  exception when insufficient_privilege then null; end;
  j := public.ops_worker_claim(v_token);
  assert j->>'kind'='youtube_channel';
  assert not public.ops_worker_finish(v_token,(j->>'id')::uuid,gen_random_uuid(),null,null,1);
  assert public.ops_worker_finish(v_token,(j->>'id')::uuid,(j->>'lease')::uuid,null,'QUOTA',1);
  assert (select status='queued' and available_at>=now()+interval '12 hours' from adme_ops.jobs where id=(j->>'id')::uuid);
  j := public.ops_worker_claim(v_token);
  assert j->>'kind'='marketing_draft';
  assert public.ops_worker_finish(v_token,(j->>'id')::uuid,(j->>'lease')::uuid,'{"concept":"광고 기획","outline":["시작"],"proposal":"협업 제안","model":"fixture"}',null,1);
  assert public.ops_worker_claim(v_token) is null;
end;
$$;
rollback;
