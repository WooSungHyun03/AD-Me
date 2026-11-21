"""Prepare USER-reviewed54→57 SQL; no external connection or deployment."""
from pathlib import Path
import subprocess,hashlib,json,re
ROOT=Path(__file__).resolve().parents[1];TARGET=ROOT/'deliverables/dev-a-publication-20261121';TARGET.mkdir(parents=True,exist_ok=True)
git=lambda *a:subprocess.check_output(['git',*a],cwd=ROOT,text=True).strip()
base=git('rev-parse','0a2be26');old=git('ls-tree','-r','--name-only',base,'supabase/migrations').splitlines();assert len(old)==54
versions=','.join("'"+Path(p).name.split('_')[0]+"'"for p in old)
gate=f"""-- STOP on unknown/modified/partial baseline. Never edit history to force this gate.
do $$begin
 if(select count(*) from supabase_migrations.schema_migrations)<>54 or exists(select 1 from supabase_migrations.schema_migrations where version not in({versions}))
 or to_regclass('adme_consent.publication_boundary') is not null or to_regclass('adme_consent.publication_requests') is not null
 or md5(replace(pg_get_functiondef('adme_consent.record_optional(text,text,boolean,uuid)'::regprocedure),E'\\r\\n',E'\\n'))<>'b072d31073d9e9fb7d247e468594d127'
 or md5(replace(pg_get_functiondef('public.save_brand_account(text,text,text,text,boolean,text,text,text)'::regprocedure),E'\\r\\n',E'\\n'))<>'5a39e0feef70d6d1433859865e5f7082'
 then raise exception 'STOP: expected reviewed54 baseline; developer inspection required';end if;
end$$;
"""
sources=[];body="begin;\nset local lock_timeout='5s';\nset local statement_timeout='60s';\nselect pg_advisory_xact_lock(hashtext('adme-publication-20261121'));\n"+gate+"set local adme.publication_staging='on';\n"
for version in ['202611210055','202611210056','202611210057']:
 paths=list((ROOT/'supabase/migrations').glob(version+'_*.sql'));assert len(paths)==1;path=paths[0];value=path.read_text(encoding='utf-8').replace('\r\n','\n');_,name=path.stem.split('_',1)
 assert len(re.findall(r'(?mi)^begin;\s*$',value))==1 and '$publication_source$'not in value
 stripped=re.sub(r'(?mi)^begin;\s*\n?','',value,count=1);stripped=re.sub(r'(?mi)^commit;\s*$','',stripped,count=1)
 body+='\n-- SOURCE '+path.name+'\n'+stripped+f"\ninsert into supabase_migrations.schema_migrations(version,name,statements)values('{version}','{name}',array[$publication_source${value}$publication_source$]);\n"
 sources.append(dict(path=path.relative_to(ROOT).as_posix(),sha256_lf=hashlib.sha256(value.encode()).hexdigest()))
body+='commit;\n';head=git('rev-parse','HEAD')
(TARGET/'00_preflight.sql').write_text(gate,encoding='utf-8',newline='\n');(TARGET/'01_apply_current_54.sql').write_text(body,encoding='utf-8',newline='\n')
(TARGET/'02_verify.sql').write_text("""-- Read-only:57 / false /0 new requests initially / RLS missing0; prior policy/billing settings preserved.
select count(*) application_migrations from supabase_migrations.schema_migrations;
select enabled,release_ref,activated_at from adme_consent.publication_boundary;
select count(*) from adme_consent.publication_requests;
select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='adme_consent' and c.relkind='r' and not c.relrowsecurity;
select version,active from adme_consent.policies;
select enabled test_billing from adme_release.billing_boundary;
""",encoding='utf-8',newline='\n')
(TARGET/'03_activate_after_source_review.sql').write_text(f"""-- USER only after source {head} coordination/review and actual URL validation.
-- Disables legacy publication bypass, not privacy restrictions. No policy approval/provider activation.
begin;
do $$begin if(select count(*) from supabase_migrations.schema_migrations)<>57 then raise exception 'STOP: expected57';end if;end$$;
select adme_consent.activate_publication('{head}');
commit;
""",encoding='utf-8',newline='\n')
files=[dict(path=p.name,sha256_lf=hashlib.sha256(p.read_bytes()).hexdigest())for p in sorted(TARGET.glob('*.sql'))]
(TARGET/'MANIFEST.json').write_text(json.dumps(dict(baseline_head=base,source_head=head,from_migrations=54,to_migrations=57,sources=sources,files=files,external_applied=False,stage_is_publication_consent_completion=False),indent=2)+'\n',encoding='utf-8')
print('Prepared1 incremental USER packet54→57,3 immutable sources; external_applied=false')
