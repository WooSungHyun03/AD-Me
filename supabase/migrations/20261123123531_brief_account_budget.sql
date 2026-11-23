-- D042 forward budget alignment: all brand brief files share the existing20-file account cap.
begin;
do $$declare definition text;old_lock text:='perform 1 from public.campaigns where id=p_campaign and owner_id=p_actor for update;';old_count text:='from adme_brief.files where campaign_id=p_campaign)>=20';begin
 definition:=pg_get_functiondef('adme_brief.change(uuid,uuid,integer,uuid,text,uuid,jsonb)'::regprocedure);
 if strpos(definition,old_lock)=0 or strpos(definition,old_count)=0 then raise exception 'Expected reviewed brief writer/budget missing';end if;
 definition:=replace(definition,old_lock,'perform pg_advisory_xact_lock(hashtextextended(''brief-owner:''||p_actor::text,0));'||chr(10)||' '||old_lock);
 execute replace(definition,old_count,'from adme_brief.files where owner_id=p_actor)>=20');
end;$$;
notify pgrst,'reload schema';
commit;
