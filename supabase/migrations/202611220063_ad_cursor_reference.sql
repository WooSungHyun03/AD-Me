-- D030: legacy lookups may not echo an actor-based ID in pagination metadata.
begin;
do $$declare body text;begin
 select pg_get_functiondef('adme_review.ad_page(text,text,text,date,date,jsonb,int)'::regprocedure)into body;
 if position('''creator'',p_creator' in body)=0 then raise exception 'STOP: ad cursor contract changed';end if;
 execute replace(body,'''creator'',p_creator','''creator'',adme_creator.public_reference(adme_creator.resolve_reference(p_creator))');
end;$$;
notify pgrst,'reload schema';
commit;
