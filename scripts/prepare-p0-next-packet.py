"""Prepare reviewed USER SQL only; never contacts hosted infrastructure."""
from pathlib import Path
import hashlib,json,re,subprocess
ROOT=Path(__file__).resolve().parents[1]
TARGET=ROOT/'deliverables/dev-a-p0-next-20261121'
TARGET.mkdir(parents=True,exist_ok=True)
git=lambda *a:subprocess.check_output(['git',*a],cwd=ROOT).decode().strip()
old=git('ls-tree','-r','--name-only','7b8fcdc','supabase/migrations').splitlines();assert len(old)==46
new=sorted(p for p in (ROOT/'supabase/migrations').glob('20261121*.sql') if p.name[:12]>='202611210047');assert len(new)==8
versions=','.join("'"+Path(p).name.split('_')[0]+"'" for p in old)
gate=f"""-- USER: exact reviewed46 baseline; no history editing or partial apply.
do $gate$ begin
 if (select count(*) from supabase_migrations.schema_migrations)<>46
 or exists(select 1 from supabase_migrations.schema_migrations where version not in({versions}))
 or to_regnamespace('adme_consent') is not null
 or to_regclass('adme_ops.source_runtime_policies') is not null
 or to_regprocedure('adme_creator.safe_public_text(text)') is not null
 or md5(pg_get_functiondef('adme_creator.catalog_dto(public.creators)'::regprocedure))<>'d46fff28525db21e7c7fd749cbe98657'
 or md5(pg_get_functiondef('adme_ops.ops_worker_claim(text)'::regprocedure))<>'4920091e80ed9c04d95f9542dd40d8ce'
 or md5(pg_get_functiondef('adme_ops.ops_public_channels(text)'::regprocedure))<>'af7bb1591609c61091ed716831d34acc'
 then raise exception 'STOP: expected reviewed46 baseline; developer must inspect actual state';end if;
end $gate$;
"""
body="begin;\nset local lock_timeout='5s';\nset local statement_timeout='60s';\nselect pg_advisory_xact_lock(hashtext('adme-p0-next-20261121'));\n"+gate+"\nset local adme.consent_staging='on';\n"
sources=[]
for path in new:
 value=path.read_text(encoding='utf-8').replace('\r\n','\n')
 assert len(re.findall(r'(?mi)^begin;\s*$',value))==1
 stripped=re.sub(r'(?mi)^begin;\s*\n?','',value,count=1);stripped=re.sub(r'(?mi)^commit;\s*$','',stripped,count=1)
 version,name=path.stem.split('_',1);assert '$next_source$' not in value
 body+='\n-- SOURCE '+path.name+'\n'+stripped+f"\ninsert into supabase_migrations.schema_migrations(version,name,statements) values('{version}','{name}',array[$next_source${value}$next_source$]);\n"
 sources.append(dict(path=path.relative_to(ROOT).as_posix(),sha256_lf=hashlib.sha256(value.encode()).hexdigest()))
body+='commit;\n'
(TARGET/'00_preflight.sql').write_text(gate,encoding='utf-8',newline='\n')
(TARGET/'01_apply_current_46.sql').write_text(body,encoding='utf-8',newline='\n')
(TARGET/'02_verify.sql').write_text("""-- Read-only expected54 / false /0 /false /false. Stage is not policy/security completion.
select count(*) application_migrations from supabase_migrations.schema_migrations;
select active,review_ref,approved_at from adme_consent.policies;
select count(*) source_runtime_policies from adme_ops.source_runtime_policies;
select enabled consent_boundary from adme_consent.boundary;
select enabled test_billing from adme_release.billing_boundary;
select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('adme_consent','adme_ops') and c.relkind='r' and not c.relrowsecurity;
-- Expected last query0 rows. Do not approve the draft policy or copy fictional QA approvals.
""",encoding='utf-8',newline='\n')
head=git('rev-parse','HEAD')
(TARGET/'03_activate_after_source_review.sql').write_text(f"""-- USER only, after source {head} is deployed/coordinated and real URL/steward review.
-- This closes legacy no-ack signup; it does not approve a policy or enable collection.
begin;
do $$begin if(select count(*) from supabase_migrations.schema_migrations)<>54 then raise exception 'STOP: expected54';end if;end$$;
select adme_consent.activate_boundary('{head}');
commit;
""",encoding='utf-8',newline='\n')
files=[dict(path=p.name,sha256_lf=hashlib.sha256(p.read_bytes()).hexdigest()) for p in sorted(TARGET.glob('*.sql'))]
(TARGET/'MANIFEST.json').write_text(json.dumps(dict(source_head=head,baseline_head=git('rev-parse','7b8fcdc'),from_migrations=46,to_migrations=54,sources=sources,files=files,external_applied=False,staging_is_policy_or_security_completion=False),indent=2)+'\n',encoding='utf-8')
print(json.dumps(dict(sql_files=len(files),new_sources=len(sources),external_applied=False)))
