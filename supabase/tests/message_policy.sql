\set ON_ERROR_STOP on
begin;
insert into auth.users(id,raw_user_meta_data) values
('ad000000-0000-4000-8000-000000000201','{"role":"brand","name":"Fictional brand"}'),
('ad000000-0000-4000-8000-000000000202','{"role":"creator","name":"Fictional creator"}');
insert into public.creators(id,owner_id,published,profile)
select 'message-policy-fixture','ad000000-0000-4000-8000-000000000202',true,profile from public.creators limit 1;
insert into public.campaigns(id,owner_id,brief)
select 'ad000000-0000-4000-8000-000000000203','ad000000-0000-4000-8000-000000000201',brief from public.campaigns limit 1;
insert into public.proposals(id,campaign_id,creator_id,brand_id,creator_user_id,kind,brief) values
('ad000000-0000-4000-8000-000000000204','ad000000-0000-4000-8000-000000000203','message-policy-fixture',
'ad000000-0000-4000-8000-000000000201','ad000000-0000-4000-8000-000000000202','proposal','Fictional message policy fixture');
set local role authenticated;
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000201',true);
insert into public.messages(proposal_id,sender_id,kind,body) values
('ad000000-0000-4000-8000-000000000204','ad000000-0000-4000-8000-000000000201','message','Brand may send a normal message');
do $$ begin
  begin
    insert into public.messages(proposal_id,sender_id,kind,body,url) values
    ('ad000000-0000-4000-8000-000000000204','ad000000-0000-4000-8000-000000000201','deliverable','Brand cannot submit a creator deliverable','https://example.test');
    raise exception 'brand deliverable unexpectedly accepted';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000202',true);
insert into public.messages(proposal_id,sender_id,kind,body) values
('ad000000-0000-4000-8000-000000000204','ad000000-0000-4000-8000-000000000202','message','Creator may send a normal message while pending');
do $$ begin
  begin
    insert into public.messages(proposal_id,sender_id,kind,body,url) values
    ('ad000000-0000-4000-8000-000000000204','ad000000-0000-4000-8000-000000000202','deliverable','Pending creator cannot deliver','https://example.test');
    raise exception 'pending deliverable unexpectedly accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.proposals set status='accepted' where id='ad000000-0000-4000-8000-000000000204';
set local role authenticated;
insert into public.messages(proposal_id,sender_id,kind,body,url) values
('ad000000-0000-4000-8000-000000000204','ad000000-0000-4000-8000-000000000202','deliverable','Accepted creator can deliver','https://example.test');
rollback;
