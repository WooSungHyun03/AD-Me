-- USER: exact reviewed46 baseline; no history editing or partial apply.
do $gate$ begin
 if (select count(*) from supabase_migrations.schema_migrations)<>46
 or exists(select 1 from supabase_migrations.schema_migrations where version not in('202611190001','202611190002','202611190003','202611190004','202611190005','202611190006','202611190007','202611200001','202611200002','202611200003','202611200004','202611200005','202611200006','202611200007','202611200008','202611200010','202611200011','202611200012','202611200013','202611200014','202611200015','202611200016','202611200017','202611200018','202611200019','202611200020','202611200021','202611200022','202611200023','202611200024','202611200025','202611200026','202611200027','202611200028','202611210035','202611210036','202611210037','202611210038','202611210039','202611210040','202611210041','202611210042','202611210043','202611210044','202611210045','202611210046'))
 or to_regnamespace('adme_consent') is not null
 or to_regclass('adme_ops.source_runtime_policies') is not null
 or to_regprocedure('adme_creator.safe_public_text(text)') is not null
 or md5(pg_get_functiondef('adme_creator.catalog_dto(public.creators)'::regprocedure))<>'d46fff28525db21e7c7fd749cbe98657'
 or md5(pg_get_functiondef('adme_ops.ops_worker_claim(text)'::regprocedure))<>'4920091e80ed9c04d95f9542dd40d8ce'
 or md5(pg_get_functiondef('adme_ops.ops_public_channels(text)'::regprocedure))<>'af7bb1591609c61091ed716831d34acc'
 then raise exception 'STOP: expected reviewed46 baseline; developer must inspect actual state';end if;
end $gate$;
