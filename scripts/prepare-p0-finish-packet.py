"""Prepare SQL for USER review only. Never contacts a hosted environment."""
from pathlib import Path
import hashlib
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'deliverables/dev-a-p0-finish-20261121'
TARGET.mkdir(parents=True, exist_ok=True)
git = lambda *a: subprocess.check_output(['git', *a], cwd=ROOT).decode().strip()
head = git('rev-parse', 'HEAD')
old = sorted(git('ls-tree', '-r', '--name-only', 'a1e8080', 'supabase/migrations').splitlines())
assert len(old) == 34
versions = [Path(p).name.split('_')[0] for p in old]
new = sorted((ROOT / 'supabase/migrations').glob('20261121*.sql'))
assert len(new) == 12
quoted = ','.join("'" + v + "'" for v in versions)
preflight = f"""-- USER SQL Editor: STOP on any mismatch. Exact reviewed34 baseline only.
do $gate$ begin
 if (select count(*) from supabase_migrations.schema_migrations)<>34
 or exists(select 1 from supabase_migrations.schema_migrations where version not in ({quoted}))
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
"""
(TARGET / '00_preflight.sql').write_text(preflight, encoding='utf-8', newline='\n')
apply = "begin;\nset local lock_timeout='5s';\nset local statement_timeout='60s';\nselect pg_advisory_xact_lock(hashtext('adme-p0-finish-20261121'));\n" + preflight
apply += "-- Retain old-source public IDs during additive staging; this is not the final privacy boundary.\nset local adme.opaque_staging='on';\n"
sources = []
for path in new:
    value = path.read_text(encoding='utf-8').replace('\r\n', '\n')
    assert len(re.findall(r'(?mi)^begin;\s*$', value)) == 1
    assert re.search(r'(?mi)^commit;\s*$', value)
    body = re.sub(r'(?mi)^begin;\s*\n?', '', value, count=1)
    body = re.sub(r'(?mi)^commit;\s*$', '', body, count=1)
    apply += '\n-- SOURCE ' + path.name + '\n' + body
    version, name = path.stem.split('_', 1)
    assert '$p0_source$' not in value
    apply += f"\ninsert into supabase_migrations.schema_migrations(version,name,statements) values('{version}','{name}',array[$p0_source${value}$p0_source$]);\n"
    sources.append(dict(path=path.relative_to(ROOT).as_posix(), sha256_lf=hashlib.sha256(value.encode()).hexdigest()))
apply += '\ncommit;\n'
(TARGET / '01_apply_current_34.sql').write_text(apply, encoding='utf-8', newline='\n')
(TARGET / '02_verify.sql').write_text("""-- Read-only after stage, before activation. Expected46 / false / false /0 /false,4194304 / no rows.
select count(*) application_migrations from supabase_migrations.schema_migrations;
select enabled test_billing from adme_release.billing_boundary;
select enabled public_reference_read_switch from adme_creator.reference_boundary;
select count(*) source_publication_policies from adme_creator.publication_policies;
select public,file_size_limit from storage.buckets where id='adme-private-images';
select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname in('adme_upload','adme_release','adme_creator') and c.relkind='r' and not c.relrowsecurity;
-- Old read/delivery boundaries may already be active; preserve original activation evidence.
select enabled,release_ref from adme_creator.read_boundary;
select enabled,release_ref from adme_delivery.boundary;
""", encoding='utf-8', newline='\n')
(TARGET / '03_activate_after_source_review.sql').write_text(f"""-- USER only: after exact source {head} is deployed/coordinated and two-role URL QA + DEV-B review pass.
-- Never enables TEST billing or approves provider/source policy. Owner-only one-way gates.
begin;
set local lock_timeout='5s';
do $$begin if (select count(*) from supabase_migrations.schema_migrations)<>46 then raise exception 'STOP: expected46';end if;end$$;
select adme_creator.activate_read_boundary('{head}');
select adme_delivery.activate('{head}');
select adme_creator.activate_public_refs('{head}');
commit;
""", encoding='utf-8', newline='\n')
files = [dict(path=p.name, sha256_lf=hashlib.sha256(p.read_bytes()).hexdigest()) for p in sorted(TARGET.glob('*.sql'))]
manifest = dict(source_head=head, baseline_head=git('rev-parse', 'a1e8080'), from_migrations=34, to_migrations=46, sources=sources, files=files, external_applied=False, staging_is_privacy_completion=False)
(TARGET / 'MANIFEST.json').write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')
print(json.dumps(dict(files=len(files), sources=len(sources), external_applied=False)))
