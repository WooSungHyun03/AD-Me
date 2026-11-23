-- Integration fixtures for the disposable CI database. Never run against hosted Supabase.
update adme_ops.settings set worker_hash=sha256(convert_to(repeat('0',64),'UTF8'));
with channels as (
  select channel_id, case channel_id
    when 'UCfpaSruWW3S4dibonKXENjA' then 1
    when 'UCT-_4GqC-yLY1xtTHhwY0hA' then 2
    when 'UC9kmlDcqksaOnCkC_qzGacA' then 3
    else 3 + row_number() over (order by channel_id)
  end as ordinal from adme_ops.featured_channel_ids
)
insert into adme_ops.channels(channel_id,title,subscriber_count,metadata,videos)
select c.channel_id, 'QA YouTube 채널 ' || lpad(c.ordinal::text,2,'0'), 500000/c.ordinal,
  jsonb_build_object('avatar','https://yt3.googleusercontent.com/adme-e2e/avatar',
    'banner','https://yt3.googleusercontent.com/adme-e2e/banner',
    'views',1000000,'videoCount',30),
  (select jsonb_agg(jsonb_build_object('id',lpad(n::text,11,'0'),'title','QA 영상 ' || n,
    'views',1000,'likes',100,'publishedAt',now()-n*interval '1 day',
    'thumbnail','https://i.ytimg.com/adme-e2e/thumbnail') order by n)
   from generate_series(1,30) n)
from channels c;
