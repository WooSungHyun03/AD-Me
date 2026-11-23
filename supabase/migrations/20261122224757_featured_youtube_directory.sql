begin;
create table adme_ops.featured_channel_ids (
  channel_id text primary key check (channel_id ~ '^UC[A-Za-z0-9_-]{22}$')
);
alter table adme_ops.featured_channel_ids enable row level security;
revoke all on adme_ops.featured_channel_ids from public,anon,authenticated;
insert into adme_ops.featured_channel_ids(channel_id) values
  ('UCfpaSruWW3S4dibonKXENjA'),('UCT-_4GqC-yLY1xtTHhwY0hA'),
  ('UC9kmlDcqksaOnCkC_qzGacA'),('UC1B6SalAoiJD7eHfMUA9QrA'),
  ('UCg-p3lQIqmhh7gHpyaOmOiQ'),('UChQ-VMvdGrYZxviQVMTJOHg'),
  ('UCoLQZ4ZClFqVPCvvjuiUSRA'),('UCk6bX-MZXdte_7kG8TbMkqg'),
  ('UCwx6n_4OcLgzAGdty0RWCoA'),('UCUj6rrhMTR9pipbAWBAMvUQ');

create function adme_ops.featured_youtube(p_query text,p_id text,p_limit int)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(channel) order by channel.subscriber_count desc nulls last, channel.channel_id),'[]')
  from (
    select ch.channel_id, ch.title, ch.subscriber_count, ch.fetched_at,
      case when p_id is not null then ch.videos else '[]'::jsonb end as videos
    from adme_ops.channels ch join adme_ops.featured_channel_ids f using(channel_id)
    where ch.review<>'rejected' and ch.fetched_at>now()-interval '30 days'
      and (p_id is null or ch.channel_id=p_id)
      and strpos(lower(ch.title),lower(left(coalesce(p_query,''),80)))>0
    order by ch.subscriber_count desc nulls last,ch.channel_id
    limit least(greatest(coalesce(p_limit,24),1),50)
  ) channel;
$$;
create function public.featured_youtube(p_query text default '',p_id text default null,p_limit int default 24)
returns jsonb language sql stable security invoker set search_path='' as $$
  select adme_ops.featured_youtube($1,$2,$3);
$$;
revoke all on function adme_ops.featured_youtube(text,text,int),public.featured_youtube(text,text,int)
  from public,anon,authenticated;
grant execute on function adme_ops.featured_youtube(text,text,int),public.featured_youtube(text,text,int)
  to anon,authenticated;

-- Preserve submitted reports and avoid deleting any owned creator or live collaboration.
alter table public.reports alter column creator_id drop not null;
alter table public.reports add column archived_creator_ref text;
alter table public.reports add constraint reports_target_present
  check (creator_id is not null or archived_creator_ref is not null);
revoke insert on public.reports from authenticated;
grant insert (reporter_id,creator_id,reason,source_url) on public.reports to authenticated;
create temporary table removed_demo_creators on commit drop as
  select id from public.creators where owner_id is null and profile->>'is_demo'='true';
do $$
begin
 if exists (select 1 from public.proposals where creator_id in (select id from removed_demo_creators))
 or exists (select 1 from public.ad_collaborations where not is_demo and creator_id in (select id from removed_demo_creators))
 then raise exception 'DEMO cleanup would affect live collaboration data';
 end if;
end;
$$;
update public.reports set archived_creator_ref=creator_id,creator_id=null
  where creator_id in (select id from removed_demo_creators);
delete from public.ad_collaborations where is_demo and creator_id in (select id from removed_demo_creators);
delete from public.creators where id in (select id from removed_demo_creators);
commit;
