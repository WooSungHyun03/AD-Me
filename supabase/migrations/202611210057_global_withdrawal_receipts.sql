-- An old successful global-withdrawal retry returns its receipt, never replays mutation.
begin;
do $$declare body text;needle text:='if found then if e.scope<>''global'' then raise invalid_parameter_value;end if; if e.version<>p_version or e.accepted<>p_accept or p_hash is distinct from(select document_hash from adme_consent.policies where version=e.version) then raise invalid_parameter_value;end if;';begin
 body:=pg_get_functiondef('adme_consent.record_optional(text,text,boolean,uuid)'::regprocedure);
 if position(needle in body)=0 then raise exception 'STOP: reviewed055 optional consent required';end if;
 execute replace(body,needle,needle||' return jsonb_build_object(''id'',e.id,''version'',e.version,''purpose'',e.purpose,''accepted'',e.accepted,''recordedAt'',e.recorded_at);');
end;$$;
create function public.record_publication_consent_v2(p_version text,p_hash text,p_accept boolean,p_key uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare result_value jsonb;latest uuid;begin
 result_value:=adme_consent.record_optional(p_version,p_hash,p_accept,p_key);
 select id into latest from adme_consent.events where actor_id=auth.uid() and purpose='profile_publication' order by recorded_at desc,id desc limit 1;
 return result_value||jsonb_build_object('currentWithdrawal',not p_accept and latest::text=result_value->>'id');
end;$$;
revoke all on function public.record_publication_consent_v2(text,text,boolean,uuid) from public,anon,authenticated,service_role;
grant execute on function public.record_publication_consent_v2(text,text,boolean,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
