-- Leave headroom below standard Vercel request/response limits.
begin;
alter table adme_upload.files drop constraint files_bytes_check;
alter table adme_upload.files add constraint files_bytes_check check(bytes between 1 and 4194304);
update storage.buckets set file_size_limit=4194304 where id='adme-private-images';
commit;
