-- A cursor issued before the public-ID read switch must fail, never skip rows.
begin;
do $$declare body text; needle text:='signature:=md5(jsonb_build_array(f,p_demo)::text);';begin
 body:=pg_get_functiondef('adme_creator.filtered_page(jsonb,text,integer,boolean)'::regprocedure);
 if position(needle in body)=0 then raise exception 'STOP: filtered catalogue function needs review';end if;
 execute replace(body,needle,'signature:=md5(jsonb_build_array(f,p_demo,(select enabled from adme_creator.reference_boundary where singleton))::text);');
end;$$;
notify pgrst,'reload schema';
commit;
