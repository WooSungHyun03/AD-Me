-- D031: approval for a current value does not implicitly approve a history feed.
begin;
alter table adme_creator.publication_policies add column history_allowed boolean not null default false,add column history_window_seconds int not null default 86400 check(history_window_seconds between 3600 and 2592000),add column history_permission_ref text;
alter table adme_creator.publication_policies add constraint history_permission_required check(not history_allowed or(history_permission_ref is not null and length(btrim(history_permission_ref))between 7 and 200));
do $$declare body text;begin
 select pg_get_functiondef('adme_creator.metric_history(text,integer)'::regprocedure)into body;
 if position('p.enabled where' in body)=0 or position('make_interval(days=>p_days)'in body)=0 then raise exception 'STOP: reviewed metric history contract required';end if;
 body:=replace(body,'p.derived_allowed from','p.derived_allowed,p.history_window_seconds from');
 body:=replace(body,'p.enabled where','p.enabled and p.history_allowed where');
 body:=replace(body,'make_interval(days=>p_days)','make_interval(secs=>least(p_days*86400,i.history_window_seconds))');
 body:=replace(body,'''ttlSeconds'',i.ttl_seconds','''ttlSeconds'',i.ttl_seconds,''historyWindowSeconds'',i.history_window_seconds');
 execute body;
end;$$;
notify pgrst,'reload schema';
commit;
