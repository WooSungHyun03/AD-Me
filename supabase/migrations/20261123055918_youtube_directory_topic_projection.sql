begin;
-- Source-provided topics are already available on the public channel page.
-- Include them in the list projection so the same public scope can be filtered in one request.
do $$
declare
  definition text := pg_get_functiondef('adme_ops.featured_youtube(text,text,integer)'::regprocedure);
  previous text := $fragment$jsonb_build_object('avatar',ch.metadata->'avatar')$fragment$;
  replacement text := $fragment$jsonb_build_object('avatar',ch.metadata->'avatar','topics',ch.metadata->'topics')$fragment$;
begin
  if strpos(definition, previous) = 0 then
    raise exception 'Expected public YouTube list projection is missing';
  end if;
  execute replace(definition, previous, replacement);
end;
$$;
notify pgrst, 'reload schema';
commit;
