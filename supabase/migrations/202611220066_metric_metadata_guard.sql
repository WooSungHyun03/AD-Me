-- D031/D035: derived periods and metadata obey observation time, including facets.
begin;
do $$declare body text; signature text;begin
 foreach signature in array array['adme_creator.metric_history(text,integer)','adme_creator.normalized_public(text)']loop
  select pg_get_functiondef(signature::regprocedure)into body;
  if position('m.period_start is not null' in body)=0 then raise exception 'STOP: reviewed derived metadata required';end if;
  execute replace(body,'m.period_start is not null','m.period_start is not null and m.period_end<=m.observed_at');
 end loop;
 select pg_get_functiondef('adme_creator.metric_filter_meta(boolean)'::regprocedure)into body;
 if position('i.moderation_status=''allowed'''in body)=0 then raise exception 'STOP: reviewed metric facets required';end if;
 execute replace(body,'i.moderation_status=''allowed''','i.moderation_status=''allowed''and i.observed_at<=statement_timestamp()and i.collected_at<=statement_timestamp()');
end;$$;
notify pgrst,'reload schema';
commit;
