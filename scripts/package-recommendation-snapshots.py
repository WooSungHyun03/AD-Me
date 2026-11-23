"""Additive D045 USER SQL packet; never links to or changes hosted services."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[1]
TARGET=ROOT/'deliverables/dev-a-recommendations-20261120'
TARGET.mkdir(exist_ok=True)
manifest_path=TARGET/'MANIFEST.json'
if manifest_path.exists():
    assert json.loads(manifest_path.read_text(encoding='utf-8'))['source_head'] is None,'Released packet is immutable'
paths=sorted((ROOT/'supabase/migrations').glob('*.sql'))
previous=[p for p in paths if p.name[:12]<'202611200026']
new=[p for p in paths if '202611200026'<=p.name[:12]<='202611200028']
assert len(previous)==31 and len(new)==3
literal=','.join("'"+p.name.split('_',1)[0]+"'" for p in previous)
gate=f"""do $gate$ begin
 if (select count(*) from supabase_migrations.schema_migrations)<>31
 or exists(select 1 from supabase_migrations.schema_migrations where version not in ({literal}))
 or to_regnamespace('adme_recommendation') is not null
 or to_regprocedure('public.recommendation_create(uuid,uuid)') is not null
 or to_regprocedure('adme_creator.catalog_dto(public.creators)') is null
 or to_regprocedure('adme_ops.require_quota(text,text,integer,integer,integer)') is null then
 raise exception 'STOP: expected exact reviewed31 baseline; developer review required'; end if;
end $gate$;
"""
write=lambda name,value:(TARGET/name).write_bytes(value.encode('utf-8'))
write('00_preflight_current_31.sql','begin;\n'+gate+'rollback;\n')
body="begin;\nset local lock_timeout='5s';\nset local statement_timeout='60s';\nselect pg_advisory_xact_lock(hashtext('adme-recommendation-snapshots'));\n"+gate
sources=[]
head=None if '--prepare-only' in sys.argv else subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT).decode().strip()
for path in new:
    source=path.read_text(encoding='utf-8')
    assert '$recommendation_source$' not in source
    if head:
        assert subprocess.check_output(['git','show',head+':'+path.relative_to(ROOT).as_posix()],cwd=ROOT).replace(b'\r\n',b'\n')==source.encode()
    start=source.lower().index('begin;');end=source.lower().rindex('commit;')
    body+=source[:start]+source[start+6:end]+'\n'
    version,name=path.stem.split('_',1)
    body+=f"insert into supabase_migrations.schema_migrations(version,name,statements) values('{version}','{name}',array[$recommendation_source$"+source+"$recommendation_source$]);\n"
    sources.append(dict(path=path.relative_to(ROOT).as_posix(),sha256_lf=hashlib.sha256(source.encode()).hexdigest()))
write('01_apply_current_31.sql',body+'commit;\n')
write('02_verify.sql',"""-- DB owner, read-only:34 application migrations; no feature activation/key required.
select count(*) migration_count from supabase_migrations.schema_migrations;
select c.relname,c.relrowsecurity,has_table_privilege('authenticated',c.oid,'select') authenticated_select
from pg_class c where c.relnamespace='adme_recommendation'::regnamespace and c.relkind='r';
select proname,prosecdef,provolatile from pg_proc where pronamespace='public'::regnamespace
and proname in ('recommendation_create','recommendation_page');
select confdeltype from pg_constraint where conrelid='adme_recommendation.snapshots'::regclass and conname='snapshots_campaign_id_fkey';
-- Expected34, snapshots RLS=true/clientSELECT=false, gateways invoker/volatile, confdeltype=c(cascade).
""")
files=[]
for path in sorted(TARGET.glob('*.sql')):
    value=path.read_bytes().replace(b'\r\n',b'\n');files.append(dict(path=path.name,sha256_lf=hashlib.sha256(value).hexdigest(),bytes_lf=len(value)))
write('MANIFEST.json',json.dumps(dict(source_head=head,from_migrations=31,to_migrations=34,sources=sources,files=files,external_applied=False),ensure_ascii=False,indent=2)+'\n')
print(json.dumps(dict(source_head=head,from_migrations=31,to_migrations=34,sql_files=len(files))))
