-- DEV-B D025: collected (ownerless / unverified) profiles are not presented as owner registrations.
-- The public catalog DTO labelled every non-demo row data_source='owner_registration' and passed the
-- collected quote/availability through, so a collected channel looked self-registered with an owner-stated
-- price. Ownerless non-demo rows (collected, or claim still pending) are now 'collected_unverified' with
-- quote and collaboration intent unknown (null). Rows with an owner (self-registration or an approved
-- claim, which sets owner_id) are unchanged. start_claim also resolves the public reference used by profile pages.
-- Both bodies are patched with line-ending agnostic STOP guards.
begin;

do $$declare body text;
 needle text:='''data_source'',case when p->''is_demo''=''true''::jsonb then ''generated fictional test fixture'' else ''owner_registration'' end';
 avail text:='''is_available'',p->''is_available''';
 price text:='''price_min_krw'',p->''price_min_krw'',''price_max_krw'',p->''price_max_krw''';
 collected text:='(p->''is_demo''=''false''::jsonb and p_row.owner_id is null)';
begin
 body:=pg_get_functiondef('adme_creator.catalog_dto_legacy_ref(public.creators)'::regprocedure);
 if position(needle in body)=0 or position(avail in body)=0 or position(price in body)=0 then
   raise exception 'STOP: reviewed catalog_dto_legacy_ref required';
 end if;
 body:=replace(body,needle,'''data_source'',case when p->''is_demo''=''true''::jsonb then ''generated fictional test fixture'' when '||collected||' then ''collected_unverified'' else ''owner_registration'' end');
 body:=replace(body,avail,'''is_available'',case when '||collected||' then ''null''::jsonb else p->''is_available'' end');
 body:=replace(body,price,'''price_min_krw'',case when '||collected||' then ''null''::jsonb else p->''price_min_krw'' end,''price_max_krw'',case when '||collected||' then ''null''::jsonb else p->''price_max_krw'' end');
 execute body;
end$$;

do $$declare body text;
 needle text:='declare c creators; v_code text; v_id uuid; v_exp timestamptz := now\(\) \+ interval ''72 hours'';\s*begin';
begin
 body:=pg_get_functiondef('public.start_claim(text)'::regprocedure);
 if body !~ needle then raise exception 'STOP: reviewed start_claim required'; end if;
 body:=regexp_replace(body,needle,'declare c creators; v_code text; v_id uuid; v_exp timestamptz := now() + interval ''72 hours'';
begin
  p_creator := coalesce(adme_creator.resolve_reference(p_creator), p_creator);');
 execute body;
end$$;

commit;
