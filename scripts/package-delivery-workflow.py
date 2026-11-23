"""Guarded old30 expansion; USER alone performs deployment and final activation."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[1]
TARGET=ROOT/'deliverables/dev-a-deliverables-20261120'
TARGET.mkdir(exist_ok=True)
manifest_path=TARGET/'MANIFEST.json'
if manifest_path.exists():
    assert json.loads(manifest_path.read_text(encoding='utf-8'))['source_head'] is None, 'Released packet is immutable'
write=lambda name,text:(TARGET/name).write_bytes(text.encode('utf-8'))
paths=sorted((ROOT/'supabase/migrations').glob('*.sql'))
versions=[p.stem.split('_',1)[0] for p in paths if p.stem.split('_',1)[0]<'202611200025']
assert len(versions)==30
literal=','.join("'"+v+"'" for v in versions)
gate=f"""set local search_path=public,pg_catalog;
do $gate$ begin
 if (select count(*) from supabase_migrations.schema_migrations)<>30
 or exists(select 1 from supabase_migrations.schema_migrations where version not in ({literal}))
 or to_regnamespace('adme_delivery') is not null or to_regprocedure('public.delivery_page(uuid,integer,integer)') is not null then
 raise exception 'STOP: expected exact reviewed30 baseline; agent must inspect'; end if;
 if md5(pg_get_functiondef('public.transition_proposal(uuid,text)'::regprocedure)) is distinct from 'd9dec4be6abea4dc06430bc9d442f856'
 or (select pg_get_userbyid(proowner) from pg_proc where oid='public.transition_proposal(uuid,text)'::regprocedure)<>'postgres'
 or not has_function_privilege('authenticated','public.transition_proposal(uuid,text)','execute')
 or has_function_privilege('anon','public.transition_proposal(uuid,text)','execute') then
 raise exception 'STOP: custom/hardened transition contract requires review, never overwrite blindly'; end if;
end $gate$;
"""
source_path=ROOT/'supabase/migrations/202611200025_deliverable_versions.sql'
source=source_path.read_text(encoding='utf-8');start=source.lower().index('begin;');end=source.lower().rindex('commit;')
assert '$delivery_source$' not in source
body="begin;\nset local lock_timeout='5s';\nset local statement_timeout='60s';\nselect pg_advisory_xact_lock(hashtext('adme-delivery-versions'));\n"+gate+"set local adme.delivery_staging='on';\n"
body+=source[:start]+source[start+6:end]+"\ninsert into supabase_migrations.schema_migrations(version,name,statements) values('202611200025','deliverable_versions',array[$delivery_source$"+source+"$delivery_source$]);\ncommit;\n"
write('00_preflight_current_30.sql','begin;\n'+gate+'rollback;\n')
write('01_stage_current_30.sql',body)
write('02_verify.sql',"""-- DB owner, read-only:31 application migrations; staging=false is NOT version enforcement.
select version,name from supabase_migrations.schema_migrations order by version;
select enabled,release_ref,activated_at from adme_delivery.boundary;
select c.relname,c.relrowsecurity,has_table_privilege('authenticated',c.oid,'select') authenticated_select
from pg_class c where c.relnamespace='adme_delivery'::regnamespace and c.relkind='r';
select proname,prosecdef,provolatile from pg_proc where pronamespace='public'::regnamespace
and proname in ('delivery_create','delivery_attest','delivery_transition','delivery_page','transition_proposal');
-- All private5 tables RLS/no-client-select; public gateways invoker and volatile.
""")
head=None
if '--prepare-only' in sys.argv:
    write('03_activate.sql','-- Not ready for external execution: generated after reviewed source commit and actual URL verification.\n')
else:
    head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT).decode().strip()
    assert subprocess.check_output(['git','show',head+':'+source_path.relative_to(ROOT).as_posix()],cwd=ROOT).replace(b'\r\n',b'\n')==source.encode()
    write('03_activate.sql',"-- USER only after actual source URL/workflows are verified.\nbegin;\ndo $$ begin if (select count(*) from supabase_migrations.schema_migrations)<>31 then raise exception 'STOP: expected31 migrations'; end if; end $$;\n"+f"select adme_delivery.activate('{head}');\ncommit;\n")
files=[]
for p in sorted(TARGET.glob('*.sql')):
    value=p.read_bytes().replace(b'\r\n',b'\n');files.append(dict(path=p.name,sha256_lf=hashlib.sha256(value).hexdigest(),bytes_lf=len(value)))
manifest=dict(source_head=head,migration_count=31,new_migration=dict(path=source_path.relative_to(ROOT).as_posix(),sha256_lf=hashlib.sha256(source.encode()).hexdigest()),files=files,
              staging='old30 compatibility only; not version enforcement; managed rooms always enforced',default_raw_migration='strict',external_applied=False)
write('MANIFEST.json',json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'source_head':head,'from_migrations':30,'to_migrations':31,'sql_files':len(files),'hash_normalization':'UTF-8 LF'}))
