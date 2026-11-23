begin;
create function adme_ops.sync_verified_channel() returns trigger language plpgsql
set search_path='' as $$
begin
  if new.verified_at is not null and old.verified_at is null then
    perform pg_catalog.pg_advisory_xact_lock(71200);
    insert into adme_ops.jobs(kind,owner_id,input)
    select 'youtube_channel',new.owner_id,new.channel_id
    where not exists(select 1 from adme_ops.jobs where kind='youtube_channel'
      and input=new.channel_id and status in ('queued','running'));
  end if;
  return new;
end;
$$;
revoke all on function adme_ops.sync_verified_channel() from public,anon,authenticated;
create trigger adme_sync_verified_channel after update of verified_at on adme_ops.channel_claims
  for each row execute function adme_ops.sync_verified_channel();
commit;
