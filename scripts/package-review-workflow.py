"""One reviewed SQL handoff, preserving old packets; no network or deployment."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
TARGET=ROOT/'deliverables/dev-a-evidence-20261120'
TARGET.mkdir(exist_ok=True)
manifest_path=TARGET/'MANIFEST.json'
if manifest_path.exists():
    assert json.loads(manifest_path.read_text(encoding='utf-8'))['source_head'] is None, 'Released packet is immutable'
paths=sorted((ROOT/'supabase/migrations').glob('*.sql'))
old=[p.stem.split('_',1)[0] for p in paths if p.stem.split('_',1)[0]<'202611200019']
assert len(old)==24
def gate(versions, extra):
    literal=','.join("'"+v+"'" for v in versions)
    return f"""do $gate$ begin
 if (select count(*) from supabase_migrations.schema_migrations)<>{len(versions)}
 or exists(select 1 from supabase_migrations.schema_migrations where version not in ({literal}))
 or to_regnamespace('adme_review') is not null or {extra} then
 raise exception 'STOP: expected exact reviewed{len(versions)} baseline; agent must inspect'; end if;
end $gate$;
"""
guard=gate(old,"to_regnamespace('adme_messaging') is null")
body="begin;\nset local lock_timeout='5s';\nset local statement_timeout='60s';\nselect pg_advisory_xact_lock(hashtext('adme-review-workflow'));\n"+guard
records=[]
for version in ['202611200019','202611200020','202611200021','202611200022','202611200023','202611200024']:
    p,=(ROOT/'supabase/migrations').glob(version+'_*.sql')
    source=p.read_text(encoding='utf-8');start=source.lower().index('begin;');end=source.lower().rindex('commit;')
    assert '$review_source$' not in source
    body+=source[:start]+source[start+6:end]
    body+=f"\ninsert into supabase_migrations.schema_migrations(version,name,statements) values('{version}','{p.stem.split('_',1)[1]}',array[$review_source${source}$review_source$]);\n"
    records.append(dict(path=p.relative_to(ROOT).as_posix(),sha256_lf=hashlib.sha256(source.encode()).hexdigest()))
body+='commit;\n'
(TARGET/'00_preflight_current_24.sql').write_text('begin;\n'+guard+'rollback;\n',encoding='utf-8')
old23=[v for v in old if v<'202611200018']
guard23=gate(old23,"to_regnamespace('adme_messaging') is not null")
(TARGET/'00_preflight_previous_23.sql').write_text('begin;\n'+guard23+'rollback;\n',encoding='utf-8')
(TARGET/'01_apply_current_24.sql').write_text(body,encoding='utf-8')
prefix=(ROOT/'deliverables/dev-a-messages-20261120.sql').read_bytes()
(TARGET/'01_apply_previous_23.sql').write_bytes(prefix+b'\n'+body.encode())
(TARGET/'02_verify.sql').write_text("""-- DB owner, read-only. Expected30 migration rows; both publication switches false on first application.
select version,name from supabase_migrations.schema_migrations order by version;
select enabled,version,ad_enabled,ad_version from adme_review.policy;
select c.relname,c.relrowsecurity,has_table_privilege('anon',c.oid,'select') anon_select,
has_table_privilege('authenticated',c.oid,'select') authenticated_select
from pg_class c where c.relnamespace='adme_review'::regnamespace and c.relkind='r';
select proname,prosecdef,provolatile from pg_proc where pronamespace='public'::regnamespace and proname in
('review_submit','review_revise','review_respond','review_decide','review_withdraw','review_inbox','public_review_records');
""",encoding='utf-8')
head=None
if '--prepare-only' not in sys.argv:
    head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT).decode().strip()
    for record in records:
        committed=subprocess.check_output(['git','show',head+':'+record['path']],cwd=ROOT).replace(b'\r\n',b'\n')
        assert hashlib.sha256(committed).hexdigest()==record['sha256_lf']
files=[dict(path=p.name,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),bytes=p.stat().st_size) for p in sorted(TARGET.glob('*.sql'))]
manifest=dict(source_head=head,migration_count=30,new_migrations=records,files=files,policy_defaults={'issue':False,'advertising':False},external_applied=False)
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'source_head':head,'sql_files':len(files),'from_migrations':[23,24],'to_migrations':30}))
