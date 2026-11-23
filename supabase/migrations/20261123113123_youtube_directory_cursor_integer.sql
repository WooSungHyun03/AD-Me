-- D033 forward fix: epoch numeric scale must not produce fractional JSON cursors.
begin;
do $$declare definition text;previous text := $fragment$-(extract(epoch from fetched_at)*1000000)::numeric$fragment$;
begin
 definition:=pg_get_functiondef('adme_ops.youtube_directory_page(jsonb,text,integer)'::regprocedure);
 if strpos(definition,previous)=0 then raise exception 'Expected directory timestamp sort is missing';end if;
 execute replace(definition,previous,'-((extract(epoch from fetched_at)*1000000)::bigint)::numeric');
end;$$;
notify pgrst,'reload schema';
commit;
