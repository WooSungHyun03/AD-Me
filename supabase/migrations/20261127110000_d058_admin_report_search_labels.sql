-- DEV-B D058 (coexistence with D057, user decision 2026-11-27): the D060 operations search listed every
-- request in the `reports` scope with the fixed label '이전 접수 신고' and no details, so staff could not
-- tell a correction from an impersonation report or see the deadline. The reports branch of
-- adme_ops.support_search now labels each row with its ticket number and request kind (so a ticket number
-- is searchable) and returns the kind, deadline and interim-hide flag. Reason text, reporter and target
-- ids stay out of the result. Only that one branch changes; roles, quota, audit and paging are untouched.
begin;
do $$
declare
  body text;
  needle text := $n$select id::text,'이전 접수 신고',status,created_at,'{}'::jsonb from public.reports where p_kind='reports'$n$;
begin
  body := pg_get_functiondef('adme_ops.support_search(text,text,jsonb,int,text,uuid)'::regprocedure);
  if position(needle in body) = 0 then
    raise exception 'STOP: reviewed support_search reports branch required';
  end if;
  body := replace(body, needle, $r$select id::text,left(ticket_no||' · '||case kind when 'report' then '신고' when 'correction' then '정보 정정' when 'deletion' then '삭제 요청' when 'impersonation' then '사칭 신고' when 'appeal' then '재심 요청' else kind end,100),status,created_at,jsonb_build_object('ticketNo',ticket_no,'requestKind',kind,'dueAt',due_at,'interimHidden',interim_hidden) from public.reports where p_kind='reports'$r$);
  execute body;
end$$;
commit;
