begin;
do $gate$ begin
 if (select count(*) from supabase_migrations.schema_migrations)<>23
 or exists(select 1 from supabase_migrations.schema_migrations where version not in ('202611190001','202611190002','202611190003','202611190004','202611190005','202611190006','202611190007','202611200001','202611200002','202611200003','202611200004','202611200005','202611200006','202611200007','202611200008','202611200010','202611200011','202611200012','202611200013','202611200014','202611200015','202611200016','202611200017'))
 or to_regnamespace('adme_review') is not null or to_regnamespace('adme_messaging') is not null then
 raise exception 'STOP: expected exact reviewed23 baseline; agent must inspect'; end if;
end $gate$;
rollback;
