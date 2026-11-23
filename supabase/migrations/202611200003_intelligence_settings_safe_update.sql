begin;
create or replace function public.ops_admin_command(p_action text, p_value text, p_extra text default '')
returns void language plpgsql security definer set search_path='' as $$
declare r text := adme_ops.staff_role();
begin
  if r is null then raise insufficient_privilege; end if;
  case p_action
    when 'channel' then
      if r not in ('super','content') then raise insufficient_privilege; end if;
      if p_value is null or p_value !~ '^UC[A-Za-z0-9_-]{22}$' then raise invalid_parameter_value; end if;
      perform pg_catalog.pg_advisory_xact_lock(71200);
      if (select count(*) from adme_ops.jobs where kind='youtube_channel'
          and created_at>now()-interval '1 day') >= 20 then raise program_limit_exceeded; end if;
      insert into adme_ops.jobs(kind,owner_id,input)
      select 'youtube_channel',auth.uid(),p_value
      where not exists(select 1 from adme_ops.jobs where kind='youtube_channel'
        and input=p_value and status in ('queued','running'));
    when 'review' then
      if r not in ('super','content') then raise insufficient_privilege; end if;
      if p_extra not in ('accepted','rejected','pending') then raise invalid_parameter_value; end if;
      update adme_ops.channels set review=p_extra where channel_id=p_value and fetched_at>now()-interval '30 days';
      if not found then raise no_data_found; end if;
    when 'discovery' then
      if r <> 'super' then raise insufficient_privilege; end if;
      if p_extra not in ('true','false') or char_length(p_value) not between 2 and 80 then raise invalid_parameter_value; end if;
      update adme_ops.settings set discovery_enabled=p_extra::boolean,discovery_keyword=p_value where singleton=true;
    when 'staff' then
      if r <> 'super' then raise insufficient_privilege; end if;
      if p_extra not in ('super','content','campaign','finance','support','remove') then raise invalid_parameter_value; end if;
      if p_extra='remove' then
        delete from adme_ops.staff where user_id=p_value::uuid;
      else
        insert into adme_ops.staff(user_id,role) values(p_value::uuid,p_extra)
        on conflict(user_id) do update set role=excluded.role;
      end if;
    else raise invalid_parameter_value;
  end case;
  insert into public.audit_log(actor_id,entity_id,action)
  values(auth.uid(),left(p_value,100),'ops:'||p_action||':'||left(p_extra,40));
end;
$$;
commit;
