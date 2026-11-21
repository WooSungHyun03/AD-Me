-- USER SQL Editor: STOP on any mismatch. Exact reviewed34 baseline only.
do $gate$ begin
 if (select count(*) from supabase_migrations.schema_migrations)<>34
 or exists(select 1 from supabase_migrations.schema_migrations where version not in ('202611190001','202611190002','202611190003','202611190004','202611190005','202611190006','202611190007','202611200001','202611200002','202611200003','202611200004','202611200005','202611200006','202611200007','202611200008','202611200010','202611200011','202611200012','202611200013','202611200014','202611200015','202611200016','202611200017','202611200018','202611200019','202611200020','202611200021','202611200022','202611200023','202611200024','202611200025','202611200026','202611200027','202611200028'))
 or to_regnamespace('adme_release') is not null
 or to_regnamespace('adme_upload') is not null
 or to_regclass('adme_creator.public_refs') is not null
 or to_regclass('adme_creator.publication_policies') is not null
 or md5(pg_get_functiondef('adme_creator.catalog_dto(public.creators)'::regprocedure))<>'6c6f240a0cd71028dedb0a8790393783'
 or md5(pg_get_functiondef('public.create_test_order(text)'::regprocedure))<>'fa52a9c01f90f02e10e902592320fa57'
 or md5(pg_get_functiondef('public.finalize_test_order(uuid,uuid,text,integer)'::regprocedure))<>'267ea2666c37fa33f758943243faa593'
 or md5(pg_get_functiondef('public.recommendation_page(uuid,uuid)'::regprocedure))<>'342b9b105d11543a48132ec79ada6b18'
 then raise exception 'STOP: expected reviewed34 source/DB baseline; developer review required';end if;
end $gate$;
