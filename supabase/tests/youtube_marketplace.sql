\set ON_ERROR_STOP on
begin;
insert into auth.users(id, raw_user_meta_data) values
 ('ad000000-0000-4000-8000-000000000201','{"role":"brand","name":"QA Brand"}'),
 ('ad000000-0000-4000-8000-000000000202','{"role":"creator","name":"QA Creator"}'),
 ('ad000000-0000-4000-8000-000000000203','{"role":"brand","name":"Other Brand"}');
insert into public.creators(id,owner_id,published,profile) values
 ('test-youtube-market-creator','ad000000-0000-4000-8000-000000000202',true,
 '{"name":"Market creator","bio":"","handle":"test","categories":["뷰티"],"vibes":[],"formats":[],"platforms":["youtube"],"price_min_krw":100000,"price_max_krw":200000,"followers":0,"is_available":true,"is_demo":false}');
insert into adme_ops.channels(channel_id,title,subscriber_count,review) values ('UC_x5XG1OV2P6uZZ5FSM9Ttw','Market fixture',15000,'accepted');
insert into adme_ops.channel_claims(channel_id,owner_id,verified_at,consent_at)
values ('UC_x5XG1OV2P6uZZ5FSM9Ttw','ad000000-0000-4000-8000-000000000202',now(),now());

set local role authenticated;
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000201',true);
insert into public.brand_products(name,description) values('QA 상품','비공개 QA 상품 설명입니다') returning id as product \gset
select public.marketplace_create(:'product','{"title":"YouTube test job","category":"뷰티","vibes":["자연스러움"],"format":"리뷰","goal":"상품 소개","target_audience":"성인","budget_krw":100000,"secret":"strip this"}') as job \gset
select set_config('market.job', :'job',true);
select set_config('market.product', :'product',true);
do $$ declare id uuid:=current_setting('market.job')::uuid; begin
 assert public.marketplace_board(id)->0->>'status'='draft';
 assert not ((public.marketplace_board(id)->0->'brief') ? 'secret');
 update public.campaigns set status='published' where campaigns.id=current_setting('market.job')::uuid;
 assert not found;
 begin
  perform public.marketplace_action('publish',id);
  raise exception 'no-credit post succeeded';
 exception when raise_exception then
  if sqlerrm<>'MARKETPLACE_CREDIT_REQUIRED' then raise; end if;
 end;
 assert public.marketplace_search('존재하지 않는 태그',0,10000000000,0,0)='[]'::jsonb;
 assert (public.create_test_order('job_post')).id=(public.create_test_order('job_post')).id;
end $$;
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000203',true);
do $$ begin
 assert public.marketplace_board(current_setting('market.job')::uuid)='[]'::jsonb;
 assert not exists(select 1 from public.brand_products where id=current_setting('market.product')::uuid);
end $$;

reset role;
insert into public.orders(owner_id,sku,amount) values
 ('ad000000-0000-4000-8000-000000000201','search_run',3000),
 ('ad000000-0000-4000-8000-000000000202','job_application',1000);
select public.finalize_test_order(id,owner_id,id::text,amount)
 from public.orders where sku in ('search_run','job_post','job_application');
set local role authenticated;
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000201',true);
do $$ declare j uuid:=current_setting('market.job')::uuid; begin
 assert public.marketplace_action('publish',j)->>'status'='published';
 assert public.marketplace_action('publish',j)->>'status'='published';
 assert jsonb_array_length(public.marketplace_search('뷰티',10000,20000,0,200000))=1;
 assert jsonb_array_length(public.marketplace_search('  뷰티  ',10000,20000,0,200000))=1;
end $$;
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000202',true);
do $$ declare j uuid:=current_setting('market.job')::uuid; draft jsonb; begin
 draft := public.marketplace_action('apply',j,'제품 리뷰 영상으로 참여하고 싶습니다.');
 assert draft->>'status'='submitted';
 perform set_config('market.proposal',draft->>'id',true);
 assert public.marketplace_action('apply',j,'두 번째 요청으로 바뀌면 안됩니다.')=draft;
end $$;
reset role;
do $$ begin
 assert (select count(*) from adme_ops.credit_uses)=3;
 assert (select count(*) from public.proposals where campaign_id=current_setting('market.job')::uuid)=1;
 update adme_ops.channel_claims set consent_at=null where owner_id='ad000000-0000-4000-8000-000000000202';
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000201',true);
do $$ begin assert public.marketplace_search('뷰티',10000,20000,0,200000)='[]'::jsonb; end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000203',true);
do $$ begin
 begin
  perform public.chat_control(current_setting('market.proposal')::uuid,'block');
  raise exception 'outsider blocked someone else’s thread';
 exception when insufficient_privilege then null; end;
 begin
  perform public.chat_report_queue();
  raise exception 'outsider read moderation queue';
 exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000201',true);
do $$ begin
 assert not adme_ops.chat_allowed(current_setting('market.proposal')::uuid);
 perform public.transition_proposal(current_setting('market.proposal')::uuid,'accepted');
 assert adme_ops.chat_allowed(current_setting('market.proposal')::uuid);
 perform public.chat_control(current_setting('market.proposal')::uuid,'report','테스트로 운영 담당자에게 대화 검토 요청');
 perform public.chat_control(current_setting('market.proposal')::uuid,'block');
end $$;
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000202',true);
do $$ begin
 assert not adme_ops.chat_allowed(current_setting('market.proposal')::uuid);
 perform public.chat_control(current_setting('market.proposal')::uuid,'unblock');
 assert not adme_ops.chat_allowed(current_setting('market.proposal')::uuid);
 begin
  insert into public.messages(proposal_id,sender_id,body,kind)
  values(current_setting('market.proposal')::uuid,auth.uid(),'should be blocked','message');
  raise exception 'blocked user sent message';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000201',true);
select public.chat_control(current_setting('market.proposal')::uuid,'unblock');
do $$ begin assert adme_ops.chat_allowed(current_setting('market.proposal')::uuid); end $$;
reset role;
do $$ begin assert (select count(*) from adme_ops.chat_safety where action='report')=1; end $$;
-- A one-time, active HOT entitlement cannot expose a withdrawn creator.
insert into public.orders(owner_id,sku,amount)
values('ad000000-0000-4000-8000-000000000202','creator_hot',9900)
returning id as hot_order \gset
select public.finalize_test_order(id,owner_id,id::text,amount)
from public.orders where id=:'hot_order';
do $$ begin
 assert not exists(select 1 from public.active_hot_creators());
 update adme_ops.channel_claims set consent_at=now() where owner_id='ad000000-0000-4000-8000-000000000202';
 assert (select count(*) from public.active_hot_creators())=1;
 update public.entitlements set starts_at=now()-interval '31 days',expires_at=now()-interval '1 day' where sku='creator_hot';
 assert not exists(select 1 from public.active_hot_creators());
end $$;
rollback;
