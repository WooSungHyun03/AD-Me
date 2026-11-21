-- D012/D051: immutable normalized PNGs; participants rechecked on every access.
begin;
create schema adme_upload;
revoke all on schema adme_upload from public,anon,authenticated,service_role;
grant usage on schema adme_upload to authenticated,service_role;
create table adme_upload.files(
 id uuid primary key,owner_id uuid not null references public.profiles(id),purpose text not null check(purpose in('brand_logo','message_image')),
 proposal_id uuid references public.proposals(id),name text not null check(length(name) between 1 and 120 and name !~ '[[:cntrl:]/\\]'),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),bytes int not null check(bytes between 1 and 5242880),
 state text not null default 'pending' check(state in('pending','verified')),message_id uuid unique references public.messages(id),
 object_path text generated always as(owner_id::text||'/'||id::text||'.png') stored,created_at timestamptz not null default now(),
 check((purpose='brand_logo' and proposal_id is null)or(purpose='message_image' and proposal_id is not null))
);
create table adme_upload.brand_logos(owner_id uuid primary key references public.profiles(id),file_id uuid not null references adme_upload.files(id));
create index upload_room_files on adme_upload.files(proposal_id,created_at desc,id desc);
alter table adme_upload.files enable row level security;alter table adme_upload.brand_logos enable row level security;
revoke all on all tables in schema adme_upload from public,anon,authenticated,service_role;
create function adme_upload.room_allowed(p_room uuid,p_write boolean) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.proposals p where p.id=p_room and auth.uid() in(p.brand_id,p.creator_user_id) and p.status<>'rejected'
 and (not p_write or (p.status in('accepted','submitted','revision_requested') and adme_delivery.writable(p))));
$$;
create function adme_upload.attempt() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or public.my_role() not in('brand','creator') then raise insufficient_privilege; end if;
 perform adme_ops.require_quota('upload_attempt_minute',auth.uid()::text,20,60);
 perform adme_ops.require_quota('upload_attempt_hour',auth.uid()::text,100,3600);
end;
$$;
create function adme_upload.reserve(p_id uuid,p_purpose text,p_proposal uuid,p_name text,p_sha256 text,p_bytes int) returns jsonb language plpgsql security definer set search_path='' as $$
declare f adme_upload.files;
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 if p_id is null or p_name is null or length(p_name) not between 1 and 120 or p_name ~ '[[:cntrl:]/\\]' or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' or p_bytes is null or p_bytes not between 1 and 5242880 then raise invalid_parameter_value; end if;
 if not ((p_purpose='brand_logo' and p_proposal is null and public.my_role()='brand') or(p_purpose='message_image' and adme_upload.room_allowed(p_proposal,true))) then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into f from adme_upload.files where id=p_id;
 if found then
 if f.owner_id<>auth.uid() then raise insufficient_privilege; end if;
 if (f.purpose,f.proposal_id,f.name,f.sha256,f.bytes) is distinct from (p_purpose,p_proposal,p_name,p_sha256,p_bytes) then raise unique_violation; end if;
 else
 perform adme_ops.require_quota('upload_new',auth.uid()::text,20,3600);
 insert into adme_upload.files(id,owner_id,purpose,proposal_id,name,sha256,bytes) values(p_id,auth.uid(),p_purpose,p_proposal,p_name,p_sha256,p_bytes) returning * into f;
 end if;
 return jsonb_build_object('id',f.id,'path',f.object_path,'state',f.state,'sha256',f.sha256);
end;
$$;
create function adme_upload.verify_file(p_id uuid,p_owner uuid,p_hash text,p_bytes int) returns void language plpgsql security definer set search_path='' as $$
begin
 update adme_upload.files set state='verified' where id=p_id and owner_id=p_owner and sha256=p_hash and bytes=p_bytes;
 if not found then raise invalid_parameter_value; end if;
end;
$$;
create function adme_upload.publish_message(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare f adme_upload.files; result uuid;
begin
 select * into f from adme_upload.files where id=p_id for update;
 if auth.uid() is null or f.id is null or f.owner_id<>auth.uid() or f.purpose<>'message_image' or f.state<>'verified' or not adme_upload.room_allowed(f.proposal_id,true) then raise insufficient_privilege; end if;
 if f.message_id is not null then return f.message_id; end if;
 result:=adme_messaging.send(f.proposal_id,f.id,'이미지 첨부: '||f.name,'message',null);
 update adme_upload.files set message_id=result where id=f.id;
 return result;
end;
$$;
create function adme_upload.access_file(p_id uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare f adme_upload.files;
begin
 select * into f from adme_upload.files where id=p_id;
 if auth.uid() is null or f.id is null or f.state<>'verified' or not((f.purpose='brand_logo' and f.owner_id=auth.uid() and public.my_role()='brand')or(f.purpose='message_image' and f.message_id is not null and adme_upload.room_allowed(f.proposal_id,false) and exists(select 1 from public.proposals p where p.id=f.proposal_id and adme_delivery.writable(p)))) then raise insufficient_privilege; end if;
 perform adme_ops.require_quota('upload_download',auth.uid()::text,60,60);
 return jsonb_build_object('id',f.id,'path',f.object_path,'name',f.name,'bytes',f.bytes,'sha256',f.sha256);
end;
$$;
create function adme_upload.room_files(p_room uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
 if not adme_upload.room_allowed(p_room,false) then raise insufficient_privilege; end if;
 perform adme_ops.require_quota('upload_list',auth.uid()::text,60,60);
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'bytes',bytes,'messageId',message_id) order by created_at desc,id desc) from(select * from adme_upload.files where proposal_id=p_room and state='verified' and message_id is not null order by created_at desc,id desc limit 20) f),'[]'::jsonb);
end;
$$;
create function adme_upload.save_brand(p_name text,p_brand_name text,p_industry text,p_introduction text,p_published boolean,p_contact_name text,p_contact_email text,p_contact_visibility text,p_logo uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null or public.my_role() is distinct from 'brand' then raise insufficient_privilege; end if;
 if p_logo is not null and not exists(select 1 from adme_upload.files where id=p_logo and owner_id=auth.uid() and purpose='brand_logo' and state='verified') then raise insufficient_privilege; end if;
 result:=public.save_brand_account(p_name,p_brand_name,p_industry,p_introduction,p_published,p_contact_name,p_contact_email,p_contact_visibility);
 if p_logo is null then delete from adme_upload.brand_logos where owner_id=auth.uid();
 else insert into adme_upload.brand_logos(owner_id,file_id) values(auth.uid(),p_logo) on conflict(owner_id) do update set file_id=excluded.file_id; end if;
 return result;
end;
$$;
create function adme_upload.brand_logo(p_brand uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare result jsonb;
begin
 perform adme_ops.require_quota('brand_logo',coalesce(auth.uid()::text,'anonymous'),case when auth.uid() is null then 300 else 60 end,60);
 select jsonb_build_object('id',f.id,'path',f.object_path,'name',f.name) into result from public.brand_profiles b join adme_upload.brand_logos l on l.owner_id=b.owner_id join adme_upload.files f on f.id=l.file_id where b.id=p_brand and (b.published or b.owner_id=auth.uid()) and f.state='verified';
 return result;
end;
$$;
-- Descriptor helpers are callable only through guarded API RPCs. Public logo
-- descriptors are service-only to keep object paths/owner IDs out of public DTOs.
create function adme_upload.storage_write(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from adme_upload.files f where f.object_path=p_name and f.owner_id=auth.uid() and f.state='pending' and f.created_at>now()-interval '30 minutes' and ((f.purpose='brand_logo' and public.my_role()='brand')or(f.purpose='message_image' and adme_upload.room_allowed(f.proposal_id,true))));
$$;
create function adme_upload.storage_read(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from adme_upload.files f where f.object_path=p_name and ((f.purpose='brand_logo' and f.owner_id=auth.uid() and public.my_role()='brand')or(f.purpose='message_image' and (f.owner_id=auth.uid() or(f.state='verified' and f.message_id is not null)) and adme_upload.room_allowed(f.proposal_id,false) and exists(select 1 from public.proposals p where p.id=f.proposal_id and adme_delivery.writable(p)))));
$$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('adme-private-images','adme-private-images',false,5242880,array['image/png']);
create policy private_image_insert on storage.objects for insert to authenticated with check(bucket_id='adme-private-images' and adme_upload.storage_write(name));
create policy private_image_read on storage.objects for select to authenticated using(bucket_id='adme-private-images' and adme_upload.storage_read(name));
-- No client UPDATE/DELETE: verified bytes cannot be replaced or removed behind a reference.
create function public.image_upload_attempt() returns void language sql volatile security invoker set search_path='' as $$ select adme_upload.attempt(); $$;
create function public.image_upload_reserve(p_id uuid,p_purpose text,p_proposal uuid,p_name text,p_sha256 text,p_bytes int) returns jsonb language sql volatile security invoker set search_path='' as $$ select adme_upload.reserve($1,$2,$3,$4,$5,$6); $$;
create function public.image_upload_verify(p_id uuid,p_owner uuid,p_hash text,p_bytes int) returns void language sql volatile security invoker set search_path='' as $$ select adme_upload.verify_file($1,$2,$3,$4); $$;
create function public.image_message_publish(p_id uuid) returns uuid language sql volatile security invoker set search_path='' as $$ select adme_upload.publish_message($1); $$;
create function public.image_file_access(p_id uuid) returns jsonb language sql volatile security invoker set search_path='' as $$ select adme_upload.access_file($1); $$;
create function public.image_room_files(p_room uuid) returns jsonb language sql volatile security invoker set search_path='' as $$ select adme_upload.room_files($1); $$;
create function public.save_brand_account_logo(p_name text,p_brand_name text,p_industry text,p_introduction text,p_published boolean,p_contact_name text,p_contact_email text,p_contact_visibility text,p_logo uuid) returns uuid language sql volatile security invoker set search_path='' as $$ select adme_upload.save_brand($1,$2,$3,$4,$5,$6,$7,$8,$9); $$;
create function public.image_brand_logo(p_brand uuid) returns jsonb language sql volatile security definer set search_path='' as $$ select adme_upload.brand_logo($1); $$;
revoke all on all functions in schema adme_upload from public,anon,authenticated,service_role;
grant execute on function adme_upload.attempt(),adme_upload.reserve(uuid,text,uuid,text,text,int),adme_upload.publish_message(uuid),adme_upload.access_file(uuid),adme_upload.room_files(uuid),adme_upload.save_brand(text,text,text,text,boolean,text,text,text,uuid),adme_upload.storage_write(text),adme_upload.storage_read(text) to authenticated;
grant execute on function adme_upload.verify_file(uuid,uuid,text,int) to service_role;
revoke all on function public.image_upload_attempt(),public.image_upload_reserve(uuid,text,uuid,text,text,int),public.image_upload_verify(uuid,uuid,text,int),public.image_message_publish(uuid),public.image_file_access(uuid),public.image_room_files(uuid),public.save_brand_account_logo(text,text,text,text,boolean,text,text,text,uuid),public.image_brand_logo(uuid) from public,anon,authenticated,service_role;
grant execute on function public.image_upload_attempt(),public.image_upload_reserve(uuid,text,uuid,text,text,int),public.image_message_publish(uuid),public.image_file_access(uuid),public.image_room_files(uuid),public.save_brand_account_logo(text,text,text,text,boolean,text,text,text,uuid) to authenticated;
grant execute on function public.image_upload_verify(uuid,uuid,text,int),public.image_brand_logo(uuid) to service_role;
notify pgrst,'reload schema';
commit;
