-- D057: repeated withdrawal is an idempotent no-op, not unbounded audit storage.
begin;
create or replace function adme_review.withdraw(p_id uuid,p_expected int) returns boolean
language plpgsql security definer set search_path='' as $$
declare c adme_review.cases;
begin
  select * into c from adme_review.cases where id=p_id for update;
  if auth.uid() is null or c.id is null or (c.submitter_id<>auth.uid() and not public.is_admin()) then raise exception 'withdrawal not allowed' using errcode='42501'; end if;
  if p_expected is null or c.version<>p_expected then raise exception 'revision conflict' using errcode='40001'; end if;
  if c.status='withdrawn' then return true; end if;
  perform adme_ops.require_quota('review_withdraw',auth.uid()::text,30,60);
  update adme_review.cases set status='withdrawn',public_visible=false,updated_at=statement_timestamp() where id=c.id;
  insert into public.audit_log(actor_id,entity_id,action) values(auth.uid(),c.id::text,'review:withdraw:'||c.version);
  return true;
end;
$$;
notify pgrst,'reload schema';
commit;
