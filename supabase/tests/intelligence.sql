\set ON_ERROR_STOP on
begin;
insert into auth.users(id,raw_user_meta_data) values
  ('ad000000-0000-4000-8000-000000000001','{"name":"Integration Admin"}'),
  ('ad000000-0000-4000-8000-000000000002','{"name":"Integration Brand"}'),
  ('ad000000-0000-4000-8000-000000000003','{"name":"Integration Finance"}');
update public.profiles set role='admin' where id='ad000000-0000-4000-8000-000000000001';
insert into adme_ops.staff values ('ad000000-0000-4000-8000-000000000003','finance');

set local role authenticated;
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000003',true);
do $$
begin
  assert public.ops_current_role()='finance';
  assert public.ops_dashboard()->'orders'='[]'::jsonb;
  assert public.ops_dashboard()->'members'='null'::jsonb;
  begin
    perform public.ops_admin_command('channel','UC_x5XG1OV2P6uZZ5FSM9Ttw');
    raise exception 'finance can enqueue a channel';
  exception when insufficient_privilege then null; end;
end;
$$;
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000001',true);
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

do $$
declare v_token text := repeat('a',64); j jsonb;
begin
  update adme_ops.settings set worker_hash=sha256(convert_to(v_token,'UTF8'));
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
