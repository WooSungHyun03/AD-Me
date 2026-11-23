-- D033: public YouTube filtering before bounded keyset pagination. No provider/network work.
begin;
create index youtube_directory_subscribers106 on adme_ops.channels(subscriber_count desc nulls last,title collate "C",channel_id)where review<>'rejected';
create index youtube_directory_updated106 on adme_ops.channels(fetched_at desc,title collate "C",channel_id)where review<>'rejected';
create function adme_ops.youtube_directory_page(p_filters jsonb,p_cursor text,p_limit integer)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare f jsonb:=p_filters;signature text;cursor_value jsonb;cursor_k numeric;cursor_name text;cursor_id text;sort_value text;topic_values text[];pattern text;result jsonb;
begin
 if f is null or jsonb_typeof(f)<>'object'or(select count(*)from jsonb_object_keys(f))<>4 or exists(select 1 from jsonb_object_keys(f)k where k not in('query','topic','subscribers','sort'))or exists(select 1 from jsonb_each(f)e where jsonb_typeof(e.value)<>'string')then raise invalid_parameter_value;end if;
 if length(f->>'query')>80 or f->>'subscribers'not in('','under-100k','100k-1m','over-1m')or f->>'sort'not in('subscribers','updated','name')or f->>'topic'not in('','뷰티·패션','음식','테크·게임','건강·운동','라이프스타일','엔터테인먼트')or p_limit is null or p_limit not between 1 and 50 then raise invalid_parameter_value;end if;
 signature:=md5(jsonb_build_array('youtube-directory-v1',f)::text);sort_value:=f->>'sort';
 topic_values:=case f->>'topic'when '뷰티·패션'then array['Fashion']when '음식'then array['Food']when '테크·게임'then array['Technology','Video_game']when '건강·운동'then array['Physical_fitness','Health','Sport']when '라이프스타일'then array['Lifestyle_(sociology)','Hobby','Tourism']when '엔터테인먼트'then array['Entertainment','Film','Music']else array[]::text[]end;
 pattern:='%'||replace(replace(replace(btrim(f->>'query'),E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%';
 if p_cursor is not null then
 if length(p_cursor)>1500 then raise invalid_parameter_value;end if;
 begin cursor_value:=convert_from(decode(p_cursor,'base64'),'UTF8')::jsonb;exception when others then raise invalid_parameter_value;end;
 if jsonb_typeof(cursor_value)<>'object'or cursor_value->>'h'is distinct from signature or cursor_value->>'v'is distinct from '1'or cursor_value->>'i'is null or cursor_value->>'i'!~'^UC[A-Za-z0-9_-]{22}$'or cursor_value->>'n'is null or length(cursor_value->>'n')not between 1 and 100 or cursor_value->>'k'is null or cursor_value->>'k'!~'^-?[0-9]{1,22}$'then raise invalid_parameter_value;end if;
 cursor_k:=(cursor_value->>'k')::numeric;cursor_name:=cursor_value->>'n';cursor_id:=cursor_value->>'i';
 end if;
 perform adme_ops.require_quota('youtube_directory',coalesce(auth.uid()::text,'anonymous'),case when auth.uid()is null then 300 else 60 end,60);
 with visible as materialized(
 select ch.channel_id,ch.title,case when ch.subscriber_count between 0 and 9007199254740991 then ch.subscriber_count else null end subscriber_count,ch.fetched_at,owner.creator_id,'[]'::jsonb videos,jsonb_build_object('avatar',ch.metadata->'avatar','topics',ch.metadata->'topics')metadata
 from adme_ops.channels ch left join lateral(
 select adme_creator.public_reference(c.id)creator_id from adme_ops.channel_claims claim join public.creators c on c.owner_id=claim.owner_id
 where claim.channel_id=ch.channel_id and claim.verified_at is not null and claim.consent_at is not null and ch.review='accepted'and c.published and coalesce(c.profile->>'is_demo','false')='false'and adme_creator.catalog_dto(c)is not null order by c.id limit 1
 )owner on true
 where ch.review<>'rejected'and adme_ops.channel_fresh(ch.channel_id)and(owner.creator_id is not null or exists(select 1 from adme_ops.featured_channel_ids fi where fi.channel_id=ch.channel_id))
 and ch.title ilike pattern escape E'\\'
 and(cardinality(topic_values)=0 or exists(select 1 from jsonb_array_elements_text(case when jsonb_typeof(ch.metadata->'topics')='array'then ch.metadata->'topics'else'[]'::jsonb end)t where regexp_replace(t,'^.*/','')=any(topic_values)))
 ),filtered as materialized(
 select v.*,case when sort_value='updated'then -(extract(epoch from fetched_at)*1000000)::numeric when sort_value='subscribers'then coalesce(-subscriber_count::numeric,10000000000000000000)else 0 end k from visible v
 where f->>'subscribers'=''or(f->>'subscribers'='under-100k'and subscriber_count<100000)or(f->>'subscribers'='100k-1m'and subscriber_count>=100000 and subscriber_count<1000000)or(f->>'subscribers'='over-1m'and subscriber_count>=1000000)
 ),page as(
 select *,row_number()over(order by k,title collate "C",channel_id collate "C")rn from filtered
 where p_cursor is null or(k,title collate "C",channel_id collate "C")>(cursor_k,cursor_name collate "C",cursor_id collate "C")order by k,title collate "C",channel_id collate "C"limit p_limit+1
 )select jsonb_build_object('version',1,'items',coalesce((select jsonb_agg(to_jsonb(p)-'k'-'rn'order by rn)from page p where rn<=p_limit),'[]'::jsonb),'total',(select count(*)from filtered),'nextCursor',case when exists(select 1 from page where rn>p_limit)then(select replace(encode(convert_to(jsonb_build_object('v',1,'h',signature,'i',channel_id,'n',title,'k',k)::text,'UTF8'),'base64'),chr(10),'')from page where rn=p_limit)else null end)into result;
 return result;
end;$$;
create function public.youtube_directory_page(p_filters jsonb,p_cursor text default null,p_limit integer default 24)returns jsonb language sql volatile security invoker set search_path=''as $$select adme_ops.youtube_directory_page($1,$2,$3);$$;
revoke all on function adme_ops.youtube_directory_page(jsonb,text,integer),public.youtube_directory_page(jsonb,text,integer)from public,anon,authenticated,service_role;
grant execute on function adme_ops.youtube_directory_page(jsonb,text,integer),public.youtube_directory_page(jsonb,text,integer)to anon,authenticated;
notify pgrst,'reload schema';
commit;
