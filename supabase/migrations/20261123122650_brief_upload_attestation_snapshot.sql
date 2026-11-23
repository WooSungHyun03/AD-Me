-- D042 forward addition: store the server-validated upload attestation and policy reference.
-- Existing110 rows remain unknown (NULL); never invent historical consent.
begin;
alter table adme_brief.files add column rights_confirmed boolean,add column policy_ref text,
 add constraint brief_attestation111 check(rights_confirmed is not true or(policy_ref is not null and length(btrim(policy_ref))between 8 and 200));
do $$declare definition text;needle text:='name,sha256,expires_at)values';ending text:='statement_timestamp()+make_interval(days=>p.retention_days));';begin
 definition:=pg_get_functiondef('adme_brief.change(uuid,uuid,integer,uuid,text,uuid,jsonb)'::regprocedure);
 if strpos(definition,needle)=0 or strpos(definition,ending)=0 then raise exception 'Expected reviewed brief upload writer missing';end if;
 definition:=replace(definition,needle,'name,sha256,expires_at,rights_confirmed,policy_ref)values');
 execute replace(definition,ending,'statement_timestamp()+make_interval(days=>p.retention_days),true,p.policy_ref);');
end;$$;
notify pgrst,'reload schema';
commit;
