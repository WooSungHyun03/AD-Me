-- D076: committed attempt reservations before Auth/provider calls. Hashes only.
begin;
create function adme_ops.auth_budget(p_action text,p_ip text,p_account text) returns jsonb language plpgsql security definer set search_path='' as $$
declare retry int; wait_seconds int:=0; ip_limit int; account_limit int; seconds int;
begin
 if p_action is null or p_action not in('login','signup','resend','recovery','search') then raise invalid_parameter_value; end if;
 if (p_ip is not null and p_ip !~ '^[a-f0-9]{64}$') or(p_account is not null and p_account !~ '^[a-f0-9]{64}$') then raise invalid_parameter_value; end if;
 seconds:=case when p_action in('login','search') then 60 else 3600 end;
 ip_limit:=case p_action when 'login' then 20 when 'search' then 60 else 10 end;
 account_limit:=case p_action when 'login' then 10 when 'search' then 60 else 5 end;
 if p_ip is null and p_account is null then
 retry:=adme_ops.take_quota('auth_shared_'||p_action,'untrusted-edge',100,60);
 return jsonb_build_object('allowed',retry=0,'retryAfter',retry,'mode','shared'); end if;
 if p_ip is not null then retry:=adme_ops.take_quota('auth_ip_'||p_action,p_ip,ip_limit,seconds);wait_seconds:=greatest(wait_seconds,retry); end if;
 if p_account is not null then retry:=adme_ops.take_quota('auth_account_'||p_action,p_account,account_limit,seconds);wait_seconds:=greatest(wait_seconds,retry); end if;
 return jsonb_build_object('allowed',wait_seconds=0,'retryAfter',wait_seconds,'mode','trusted');
end;
$$;
create function public.auth_edge_budget(p_action text,p_ip text,p_account text) returns jsonb language sql volatile security invoker set search_path='' as $$ select adme_ops.auth_budget($1,$2,$3); $$;
create function public.auth_shared_budget(p_action text) returns jsonb language sql volatile security definer set search_path='' as $$ select adme_ops.auth_budget($1,null,null); $$;
revoke all on function adme_ops.auth_budget(text,text,text),public.auth_edge_budget(text,text,text),public.auth_shared_budget(text) from public,anon,authenticated,service_role;
grant execute on function adme_ops.auth_budget(text,text,text) to service_role;
grant execute on function public.auth_shared_budget(text) to anon,authenticated;
grant execute on function public.auth_edge_budget(text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
