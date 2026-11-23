begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
-- Exact reviewed 105-source history only. Unknown/partial/old41 histories STOP.
do $preflight$ begin
 if to_regclass('supabase_migrations.schema_migrations') is null
 or to_regclass('public.saved_list_items') is null or to_regclass('public.saved_creators') is not null then
  raise exception 'STOP: reviewed 105 baseline missing; request an inspected application packet';end if;
 if (select count(*)from supabase_migrations.schema_migrations)<>105 or exists(
  select 1 from(values ('202611190001','bed3dc299b04240ea5dee0328f931211d5c9c50451974a25185dd31182c1ad9f'),
('202611190002','9dc67ca96c9fd7b7365fbbcc9191e3de6daa7d9a98b83ca1b9b7e6399c9bae59'),
('202611190003','2db0c0144c657581efee123827f05c89309c90e2433a633b5d13e5b7354ee5fe'),
('202611190004','09373c91a5fe7b415aa23d56a96dc9c23b5d9fe4e8fca3ac25c946563168919c'),
('202611190005','2d94f26f37e1804301b18c1143f24bc4cb151a711ddc8b3372d4232f95a62e2d'),
('202611190006','315f1ba58ebc1eefb8907be44498a604626cf35f75cba3e8b7a4755260a85233'),
('202611190007','6a97a7a086bfc5407b94108336e31b03472f0014a37a618ab15ef5f32ab92cad'),
('202611200001','bab89f22cf28f6ae3640b576f11833b377121ba50b8ee2ddd6019267ab179815'),
('202611200002','4075812d9544cece190f89652d9e5f19e5c6a1521539d68a61a23710d55c76bc'),
('202611200003','b759f1c9914914cc6d9b22f08dfa655821ebdabc72290925a25b4037d30f0fbc'),
('202611200004','36f2181d2dee7e3bd87b8348cced0513d8135cfcbcb155533facb065e6ad7cec'),
('202611200005','1f878303403612c47ce7aecc84b28b579301773decd153f43da8c58edc12c20c'),
('202611200006','91363ca7a0fb5b7a4229b2bca407f07685f728ea3c3fa90aaca3c38e435cf39a'),
('202611200007','a12d3f449afe6d38077ef45cd3aa5d42dc75e5982edc43b06a418c776e4ba90f'),
('202611200008','b55fbc756ebd7637df109b29d30468d1c9f07ffdf5d3ed1850c13aca493d139d'),
('202611200010','93bfd5d3804fc7ada4f7d41e19f92873a21c111aafc9332f18784969f4bdba48'),
('202611200011','318a327824a503c95bfb3d9d093f2d1fd4c498fa5eddf2b8e1b4c9b591efb80b'),
('202611200012','85c5e16ce63d0c359c71e48c485f7323fd38ccdec627106959749bd1fad06eca'),
('202611200013','4f83186fdb220a6723ee85bd5035e635644aa6aa6f7f31265f222a95589c0ca1'),
('202611200014','dba948d49d9f95fd769eb00d93525492f3b56f3e10ec0dbb4f1edbca5f0bd69f'),
('202611200015','d09f1427dc46538d3d74adeab5f5b5976ef0e3bcba886261d410878bdace2f81'),
('202611200016','412e832dc0fbfb9fee2bcb0a386c18ca8a43fe32f6cd4162fb7492b4850212bb'),
('202611200017','34094003787a3e4e13ef37ffa5b11a617a4dcf4409fb32993a0f9d8f54cc2a5e'),
('202611200018','8447da0aa123d8cd158459f999ab2406496d398e13c1aeb2d7ad96026e2d9d09'),
('202611200019','bd9f9df5a2be58a5158ebfe9ad5b353cdf521869be3e6645c979d9f79d786eaf'),
('202611200020','41a5c2a2e7acfd5090f24a665493d88896f611ac80afa28b8168d2e4d2c7ab00'),
('202611200021','0730856b73fe1ecd196ee00864675f8432363f4a1a669e8f6a0cf6526c599d48'),
('202611200022','f6ef2706770a06dd42727425106f6c48d2beaaf64f22418c3c0f9bb293d7f1ec'),
('202611200023','48336c3a7e8b59593dd71e3f307c191854f0b9267cf6d3778863bba67300ddef'),
('202611200024','d8bed1e192cd020c643b9035fbdb3800b9dbc5ab710199523af09ff56a941a89'),
('202611200025','a30a0c532e127e0166c90c819451898e8abfd47945b2f3b280d2977bd2b8260f'),
('202611200026','bebd251c8f0b0d632a0a87230db20d683b77aa40697319278b0d6ad8a7653e99'),
('202611200027','2c48c1d0dab0ee5acdd3927b199ff4d23a1ddd40a96748dbef13c77f7dacfd79'),
('202611200028','b60203eb7c75ac90c413e1dda3d9d188770b4f698b8533e8ecde36473d82798a'),
('202611210035','4d4a94dfa7b91a99d5e96334b443662e98f23bc2336a7f006b546d32e4587b01'),
('202611210036','4664fc48fb8b21c1952330d6d4f98b5e4e42d5f7f319c25420d9dc52d77512ec'),
('202611210037','9acf5d1f488863f22d4eb0291f0814abb8c8e819279ae11ae3e53e95aacfff7d'),
('202611210038','e416b743f5eef504cf46615e75f276bbc4cbf241136fe09e45770fdef57d96fb'),
('202611210039','2bebdbf857ae088ca986c271eb9a941aed61ccd4cfb425dab200591bdbdc46aa'),
('202611210040','0dfd30313dd6a2124b9bcdfa6a80c686b127b2b5f44208cbf2f223441829cb62'),
('202611210041','0a6ee06c7f2ec4cc575cd69fdddad8aae2a227a885b8940e281c4e3512585bb6'),
('202611210042','6b8e098c7e13a5377b26326fae727cecf9c8e8a2e39659e174f863cd1345edbf'),
('202611210043','b7c839ff8b4a0b9ebdbb4c2b0dd73b5991cb0db713b4bd480b7efa292830deb2'),
('202611210044','d79edd683ab526c023a132e8bcda78b28f2e21fc58b2f17c51b8abf2f51b1512'),
('202611210045','e88d5cff0f24b8e3a23f556a1293d182722d3be0aa57a1c5dc56c3a151c93306'),
('202611210046','0e2d88674fb8e63cb97531892c53b4d217010966f870ca5ce21ffcaf5d77b9f0'),
('202611210047','3d46f4170d2cb4bff332ff4d2478b212f001f619771dfc37d19b06cc585afa71'),
('202611210048','1508b7c68f56b804ab536cef76c3c29df7f6a1f57164c63fbe11af960d0b82c9'),
('202611210049','32cd45a234e476bea15ef2bf6cf6cf4a987c2ca6e32bf782bb6f279e98ad5b2a'),
('202611210050','2eb18cc1732e44a599ca48827b6d8a855aefd108167a9d67f103efdf3a9ef37c'),
('202611210051','4c9dcdf274073f3ea79692be8cfbacd81fd18abf5d8334e47a73f82110bc15a4'),
('202611210052','5dfdf0e17a9620b67c9d6ecfb008ef410be6516d96eadcb2fa65661c24c41cf1'),
('202611210053','bb61c6b11268467b39d8eee7269fc19c137293ec7b20686d467c104307532a72'),
('202611210054','28b6c1fc725137bae74693e30b8fe8e7c11ac84fd72943495b7f0c65d932d923'),
('202611210055','439b75ace598ae8b3ce762b7e54628046186379d96e114b9155bb8b421190e69'),
('202611210056','562bf777ce07e11f73232cba999afa9c29dfa8c959b997ee89a044c5fb0f1560'),
('202611210057','e55f629ebe2947c12a0242031c1f2f63ce607afe6fe9a64cd6240ed3f92cf84d'),
('202611210058','d87fb4234fce9c0a194303b30122c9cc99837d042cfeccfb09400be2435180f9'),
('202611210059','89627736d9354a3b5fe5f779a9c79e7a6ce88547194ac5b63b0937a872473207'),
('202611210060','ed21ab4b0ca46c022b9c8420721664dcccc2db459f99cb1dcc5398c8699fc95f'),
('202611220061','10fea74d7b056768c30a5e7192fdeae6a0faa526117ba43fc84d3633749d510b'),
('202611220062','d7deee730abc97a97b65333dbab9783dd462563f185f43d576cd81bd8206c329'),
('202611220063','d8ae4a6c51440291a72e4989515f8cea83e3a13f578588888140092188a4ddaf'),
('202611220064','2551ee5ac001dfef6e1f684c4bd80def0ae6dae0e91f6c0bea71f916cfa53b8d'),
('202611220065','fde1a82c5c19a03541b3c5051972274b29022e8ccd762ba0e389843d8a298483'),
('202611220066','bd67a5c2b515b986fa814b1dc23295baf5bbb3d3debe53728b7aa45831a32261'),
('202611220067','4962d9ef4ae87cd5f081f980f81fc23b27ca71aac504443dfe762d1ad910004e'),
('202611220068','6d4f33e03ab934db98cfb6c1c30095fd56aa1de425b63922f94714c093720abe'),
('20261122115249','2e40d46d9783735224bf9178f0fd511018e6be933ea989aa12e9098649744da5'),
('20261122115930','0f0ee70fb2c16907498fa044d614492d7efe95e296face2b76e364cedc3e8c90'),
('20261122224757','e51687956aa8f2ea841b5823203f0aa5b34567b191ebc1ee2ef30ae5f7865e4b'),
('20261122231018','d5f76766e31ba400e873b912100fc07391091e737f7ddd6cf8313b2d61dcf30e'),
('20261122231403','12ea833081432dcc1be7ec3ca35f7af7faeae54be2be067d1abf11b1f1be7a01'),
('20261122231628','877fbaaff446e19e611c97acc10474ee0b7d33d4fb11b37246b60f1a9a7d88c3'),
('202611230075','1375775ec5820f0b63586d3b9ea262165a3c26a36d67ea67f5f40168b22af356'),
('202611230076','0607bd356f1fb17a20e488d36e53e615c961e380ee949cf00916331c275467a7'),
('202611230077','dd81b028b3732971cb338746ad0933906f319af62031b9b39b9692189e668bd3'),
('20261123055918','10346a2b380e278bab9a7f874d82d075f721d8bfea1bc762c36ab24854483809'),
('20261123100004','1ca9ec962dd570eb8450d7d2bd6caedc05020b1082c4652abb62b83f1b8ee7ee'),
('20261123100005','d65af38b969391928af5ce0925529bb07643e2d3bbdffd69f9dbe24bad2e2a54'),
('20261123100006','628ea82db4ffc7c2e49b261e73538efc746cfa9bf0c97a82766d5af871d69d36'),
('20261123100007','4555db4fd14483d23a907e0d651183917ef441843c820fb10f201fe7fbbf94a5'),
('20261123100008','cc694e7e2fc303c1fedd9c19b9d0ef39f7959d2d1ba9b2c0a38ceb54fed8c435'),
('20261123100009','887fbef2995a70e86d8a15eae5d6be652d40e2e68d33053f49fbf4e4c5319e5d'),
('20261123100010','6d1a25f655a24cc7090ab99bc25d177dc13973b508be785a3193f93726eec1ab'),
('20261123100011','c8d54a6ad9a04f7a3cd93957707af23aa7e4d570bb926273e2d734b5fa2df5bc'),
('20261123100012','17af78671896cfe2a30b67243c1c2694116a9098b5911a1826fa0b2af3e72887'),
('20261123100013','d9f312ec980661d7a7ea13f264c56b91f49b51196cb3d77883a260701eadbe0f'),
('20261123100014','7acb2aafe38bdfd0e502ceefc72cff2da245332d50fe93fda195b1316d2bfa75'),
('20261123100015','1466b0e647cf674e129b4147b6fd90f770095c950b68c031f2f63a3d33acf2ac'),
('20261123100016','9c0b959755b36a369528ad36281913ff0a891123d016cbc68e2e0ab3d348a444'),
('20261123100017','d4b1d64b79bb6b74e6dc7c66a719f36374db3cda1926b9a3c5dd602e4f610c25'),
('20261123100018','231ee062e402357463559dd4d2e16237e4418e26cadda3ebb6e70722faf6f715'),
('20261123100019','d254f6842a86f94c45d5629ec9453d7bca3189f29af99da46e48410e0e370edf'),
('20261123100020','29644e6dba9f115366c9ca153141e8fcb08c2515a7e376510f3ed0e31482cdca'),
('20261123100021','8bbc15ca8411108ad61cbbd37efdd8ff359834aede1d8a53b9236bf301c61f30'),
('20261123100022','63b6fcbc30fd18acb48ec223878af3b439ae509799a356a9ea1470be2c2a0bb0'),
('20261123100023','3ac63113bce16b15583b985c1b5d2f9c0f7f2830147bdab81accf6850094472d'),
('20261123100024','cc81e3d165437045efdbac850f0fa70e4830d16fe5f198e45c06ef84ff6b8b7b'),
('20261123100025','99800cb1a593dc9e70d1e9798e8eb440205f5f8f884507b5b54edadc1240dfa6'),
('20261123100026','53a1f3f0dad484c4a5c780cd3d9b138d6dd42da9c13c4a991c2ef3e192a6f417'),
('20261123100027','c08837577599885444b9a7371951fd8020bb976ff2cfd6dc1b3ab55331a4451a'),
('20261123100028','7c936dc1d2848637f3dc7ffc273b95c89cff7c134354a0d9fa8c9fe4a42d3028'),
('20261123100029','991105b727e74d2aa0f228e3e5d67d5c8085b40976a3f5be29d7b3b1d1e5ae7a'),
('20261123110001','c272e2cd0c0f19649c9407cd828c87c49d3f4064bdd128f8d65de953a139fa37'))expected(version,hash)left join supabase_migrations.schema_migrations m using(version)
  where m.version is null or encode(sha256(convert_to(replace(array_to_string(m.statements,chr(10)),chr(13),''),'UTF8')),'hex')is distinct from expected.hash
 )then raise exception 'STOP: history/source mismatch, partial or unknown baseline; do not force SQL';end if;
end $preflight$;

-- 20261123112401 youtube_directory_pagination SHA256 ac8327b004ccc7ece78128df2755a49ceed2247e5df7e47faeda04b6d777a73c
-- D033: public YouTube filtering before bounded keyset pagination. No provider/network work.
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

insert into supabase_migrations.schema_migrations(version,name,statements)values('20261123112401','youtube_directory_pagination',array[$adme_sequential_source$-- D033: public YouTube filtering before bounded keyset pagination. No provider/network work.
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
$adme_sequential_source$]);

-- 20261123113123 youtube_directory_cursor_integer SHA256 6d03a94c183573583611db22085e9cb72f9f5356f00f97d895c27b2d3c4f18ad
-- D033 forward fix: epoch numeric scale must not produce fractional JSON cursors.
do $$declare definition text;previous text := $fragment$-(extract(epoch from fetched_at)*1000000)::numeric$fragment$;
begin
 definition:=pg_get_functiondef('adme_ops.youtube_directory_page(jsonb,text,integer)'::regprocedure);
 if strpos(definition,previous)=0 then raise exception 'Expected directory timestamp sort is missing';end if;
 execute replace(definition,previous,'-((extract(epoch from fetched_at)*1000000)::bigint)::numeric');
end;$$;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements)values('20261123113123','youtube_directory_cursor_integer',array[$adme_sequential_source$-- D033 forward fix: epoch numeric scale must not produce fractional JSON cursors.
begin;
do $$declare definition text;previous text := $fragment$-(extract(epoch from fetched_at)*1000000)::numeric$fragment$;
begin
 definition:=pg_get_functiondef('adme_ops.youtube_directory_page(jsonb,text,integer)'::regprocedure);
 if strpos(definition,previous)=0 then raise exception 'Expected directory timestamp sort is missing';end if;
 execute replace(definition,previous,'-((extract(epoch from fetched_at)*1000000)::bigint)::numeric');
end;$$;
notify pgrst,'reload schema';
commit;
$adme_sequential_source$]);

-- 20261123114341 saved_catalog_list_compatibility SHA256 533969f74d45584cc460969f6875e508671f383197f50556e54e30cb6a8aba79
-- D075: preserve safe public-reference gateways after main retires saved_creators.
create or replace function adme_creator.saved_catalog()returns jsonb language plpgsql stable security definer set search_path=''as $$
begin
 if auth.uid()is null or not public.account_access()then raise insufficient_privilege;end if;
 return coalesce((select jsonb_agg(jsonb_build_object('creator_id',adme_creator.public_reference(c.id),'creator',adme_creator.catalog_dto(c))order by c.id collate "C")
 from public.saved_list_items s join public.saved_lists l on l.id=s.list_id and l.owner_id=s.owner_id join public.creators c on c.id=s.creator_id
 where s.owner_id=auth.uid()and l.is_default),'[]'::jsonb);
end;$$;
create or replace function adme_creator.toggle_saved(p_ref text)returns boolean language plpgsql security definer set search_path=''as $$
declare id_value text;existed boolean;list_value uuid;
begin
 if auth.uid()is null or not public.account_access()then raise insufficient_privilege;end if;
 if p_ref is null or length(p_ref)not between 1 and 100 then raise invalid_parameter_value;end if;
 id_value:=adme_creator.resolve_reference(p_ref);if id_value is null then raise insufficient_privilege;end if;
 perform adme_ops.require_quota('saved_toggle',auth.uid()::text,60,60);
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||id_value,0));
 select id into list_value from public.saved_lists where owner_id=auth.uid()and is_default;
 if list_value is not null then
  delete from public.saved_list_items where list_id=list_value and owner_id=auth.uid()and creator_id=id_value returning true into existed;
  if coalesce(existed,false)then return false;end if;
 end if;
 if not exists(select 1 from public.creators c where c.id=id_value and adme_creator.catalog_dto(c)is not null)then raise insufficient_privilege;end if;
 list_value:=public.ensure_default_list();if list_value is null then raise check_violation using message='default list unavailable';end if;
 insert into public.saved_list_items(list_id,owner_id,creator_id)values(list_value,auth.uid(),id_value);return true;
end;$$;
revoke all on function adme_creator.saved_catalog(),adme_creator.toggle_saved(text)from public,anon,authenticated,service_role;
grant execute on function adme_creator.saved_catalog(),adme_creator.toggle_saved(text)to authenticated;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements)values('20261123114341','saved_catalog_list_compatibility',array[$adme_sequential_source$-- D075: preserve safe public-reference gateways after main retires saved_creators.
begin;
create or replace function adme_creator.saved_catalog()returns jsonb language plpgsql stable security definer set search_path=''as $$
begin
 if auth.uid()is null or not public.account_access()then raise insufficient_privilege;end if;
 return coalesce((select jsonb_agg(jsonb_build_object('creator_id',adme_creator.public_reference(c.id),'creator',adme_creator.catalog_dto(c))order by c.id collate "C")
 from public.saved_list_items s join public.saved_lists l on l.id=s.list_id and l.owner_id=s.owner_id join public.creators c on c.id=s.creator_id
 where s.owner_id=auth.uid()and l.is_default),'[]'::jsonb);
end;$$;
create or replace function adme_creator.toggle_saved(p_ref text)returns boolean language plpgsql security definer set search_path=''as $$
declare id_value text;existed boolean;list_value uuid;
begin
 if auth.uid()is null or not public.account_access()then raise insufficient_privilege;end if;
 if p_ref is null or length(p_ref)not between 1 and 100 then raise invalid_parameter_value;end if;
 id_value:=adme_creator.resolve_reference(p_ref);if id_value is null then raise insufficient_privilege;end if;
 perform adme_ops.require_quota('saved_toggle',auth.uid()::text,60,60);
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||id_value,0));
 select id into list_value from public.saved_lists where owner_id=auth.uid()and is_default;
 if list_value is not null then
  delete from public.saved_list_items where list_id=list_value and owner_id=auth.uid()and creator_id=id_value returning true into existed;
  if coalesce(existed,false)then return false;end if;
 end if;
 if not exists(select 1 from public.creators c where c.id=id_value and adme_creator.catalog_dto(c)is not null)then raise insufficient_privilege;end if;
 list_value:=public.ensure_default_list();if list_value is null then raise check_violation using message='default list unavailable';end if;
 insert into public.saved_list_items(list_id,owner_id,creator_id)values(list_value,auth.uid(),id_value);return true;
end;$$;
revoke all on function adme_creator.saved_catalog(),adme_creator.toggle_saved(text)from public,anon,authenticated,service_role;
grant execute on function adme_creator.saved_catalog(),adme_creator.toggle_saved(text)to authenticated;
notify pgrst,'reload schema';
commit;
$adme_sequential_source$]);

-- 20261123114636 promotion_public_reference_boundary SHA256 fa6d0d076b7da1cd83fc76826ad1929e3807c25dd435192b9a3b5608368cacba
-- D075: retain DEV-B's service-only HOT slots with DEV-A publication/opaque-reference gates.
create or replace function public.serve_promotion_slots(p_record boolean default false)
returns table(slot int,creator_id text,name text,category text,starts_at timestamptz,expires_at timestamptz)
language plpgsql security definer set search_path=''as $$
begin
 if not adme_release.billing_enabled()then return;end if;
 return query
 with active as(
  select distinct on(c.id)c.id cid,adme_creator.catalog_dto(c)dto,e.id eid,e.starts_at s,e.expires_at x
  from public.creators c join public.entitlements e on e.owner_id=c.owner_id and e.sku='creator_hot'
  left join public.orders o on o.id=e.order_id
  where c.published and c.claim_status='verified'and adme_creator.catalog_dto(c)is not null and public.entitlement_active(e)and(e.order_id is null or o.status='paid')
  and(coalesce(c.profile->>'is_demo','false')='true'or exists(select 1 from adme_ops.channel_claims claim join adme_ops.channels ch using(channel_id)
   where claim.owner_id=c.owner_id and claim.verified_at is not null and claim.consent_at is not null and ch.review='accepted'and adme_ops.channel_fresh(ch.channel_id)))
  order by c.id,e.starts_at,e.id
 ),picked as(
  select row_number()over(order by s,cid)::int pos,*from active order by s,cid limit 3
 ),counted as(
  insert into public.promotion_impressions as pi(entitlement_id,n)select eid,1 from picked where coalesce(p_record,false)
  on conflict(day,entitlement_id)do update set n=pi.n+1 returning 1
 )select p.pos,adme_creator.public_reference(p.cid),p.dto->>'name',p.dto->'categories'->>0,p.s,p.x from picked p cross join(select count(*)from counted)q order by p.pos;
end;$$;
revoke all on function public.serve_promotion_slots(boolean)from public,anon,authenticated,service_role;
grant execute on function public.serve_promotion_slots(boolean)to service_role;
-- The retired full-profile client endpoint remains unavailable.
revoke all on function public.active_hot_creators()from public,anon,authenticated;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements)values('20261123114636','promotion_public_reference_boundary',array[$adme_sequential_source$-- D075: retain DEV-B's service-only HOT slots with DEV-A publication/opaque-reference gates.
begin;
create or replace function public.serve_promotion_slots(p_record boolean default false)
returns table(slot int,creator_id text,name text,category text,starts_at timestamptz,expires_at timestamptz)
language plpgsql security definer set search_path=''as $$
begin
 if not adme_release.billing_enabled()then return;end if;
 return query
 with active as(
  select distinct on(c.id)c.id cid,adme_creator.catalog_dto(c)dto,e.id eid,e.starts_at s,e.expires_at x
  from public.creators c join public.entitlements e on e.owner_id=c.owner_id and e.sku='creator_hot'
  left join public.orders o on o.id=e.order_id
  where c.published and c.claim_status='verified'and adme_creator.catalog_dto(c)is not null and public.entitlement_active(e)and(e.order_id is null or o.status='paid')
  and(coalesce(c.profile->>'is_demo','false')='true'or exists(select 1 from adme_ops.channel_claims claim join adme_ops.channels ch using(channel_id)
   where claim.owner_id=c.owner_id and claim.verified_at is not null and claim.consent_at is not null and ch.review='accepted'and adme_ops.channel_fresh(ch.channel_id)))
  order by c.id,e.starts_at,e.id
 ),picked as(
  select row_number()over(order by s,cid)::int pos,*from active order by s,cid limit 3
 ),counted as(
  insert into public.promotion_impressions as pi(entitlement_id,n)select eid,1 from picked where coalesce(p_record,false)
  on conflict(day,entitlement_id)do update set n=pi.n+1 returning 1
 )select p.pos,adme_creator.public_reference(p.cid),p.dto->>'name',p.dto->'categories'->>0,p.s,p.x from picked p cross join(select count(*)from counted)q order by p.pos;
end;$$;
revoke all on function public.serve_promotion_slots(boolean)from public,anon,authenticated,service_role;
grant execute on function public.serve_promotion_slots(boolean)to service_role;
-- The retired full-profile client endpoint remains unavailable.
revoke all on function public.active_hot_creators()from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
$adme_sequential_source$]);
notify pgrst,'reload schema';
commit;
