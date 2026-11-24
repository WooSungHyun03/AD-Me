-- Free-beta campaign actions use the existing board and collaboration records.
-- Credits remain required when the database enables the isolated billing catalog.
begin;

create or replace function adme_ops.marketplace_action(p_action text,p_campaign uuid,p_pitch text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid();
 job record;
 response jsonb;
 proposal uuid;
 creator text;
 billing boolean;

begin
 perform adme_privacy.enforce_actor();
 if actor is null then raise insufficient_privilege; end if;
 billing := adme_release.billing_enabled();
 select c.owner_id,c.status,j.published_at,j.expires_at into job from adme_ops.job_posts j
 join public.campaigns c on c.id=j.campaign_id where j.campaign_id=p_campaign for update of c,j;
 if not found then raise no_data_found; end if;
 if p_action in ('publish','close') then
   if job.owner_id<>actor or public.my_role() is distinct from 'brand' then raise insufficient_privilege; end if;
   if p_action='close' then
     update public.campaigns set status='closed' where id=p_campaign;
     return jsonb_build_object('id',p_campaign,'status','closed');
   end if;
   if job.published_at is not null and job.status='published' and job.expires_at>now() then
     return jsonb_build_object('id',p_campaign,'status','published');
   end if;
   if job.status<>'draft' then raise invalid_parameter_value; end if;
   response := jsonb_build_object('id',p_campaign,'status','published');
   if billing then
     perform adme_ops.marketplace_credit(actor,'job_post',p_campaign::text,response);
   else
     perform adme_ops.require_quota('marketplace_publish',actor::text,10,86400);
   end if;
   update adme_ops.job_posts set published_at=now(),expires_at=now()+interval '30 days' where campaign_id=p_campaign;
   update public.campaigns set status='published' where id=p_campaign;
   return response;
 end if;
 if p_action is distinct from 'apply' then raise invalid_parameter_value; end if;
 if public.my_role() is distinct from 'creator' or job.owner_id=actor then raise insufficient_privilege; end if;
 select p.id into proposal from public.proposals p
 where p.campaign_id=p_campaign and p.creator_user_id=actor and p.kind='application';
 if found then
   return jsonb_build_object('id',proposal,'status','submitted');
 end if;
 if job.status<>'published' or job.expires_at<=now() or job.expires_at is null then raise invalid_parameter_value; end if;
 select c.id into creator from public.creators c where c.owner_id=actor and c.published and c.claim_status='verified'
 and c.profile->>'is_available'='true' and c.profile->'platforms' ? 'youtube'
 and exists(select 1 from adme_ops.channel_claims cl where cl.owner_id=actor and cl.verified_at is not null)
 order by c.id limit 1 for share;
 if not found then raise insufficient_privilege; end if;
 if p_pitch is null or char_length(btrim(p_pitch)) not between 10 and 2000 then raise invalid_parameter_value; end if;
 if not billing then
   perform adme_ops.require_quota('marketplace_apply',actor::text,30,86400);
 end if;
 insert into public.proposals(campaign_id,creator_id,brand_id,creator_user_id,brief,kind)
 values(p_campaign,creator,job.owner_id,actor,btrim(p_pitch),'application') returning id into proposal;
 response := jsonb_build_object('id',proposal,'status','submitted');
 if billing then
   perform adme_ops.marketplace_credit(actor,'job_application',p_campaign::text,response);
 end if;
 return response;
end;
$$;

commit;
