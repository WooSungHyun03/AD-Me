"""USER-only57→60 deployment input; does not approve policy or enable deletion intake."""
from pathlib import Path
import subprocess,json,hashlib,re
ROOT=Path(__file__).resolve().parents[1];TARGET=ROOT/'deliverables/dev-a-p0-all-20261121';TARGET.mkdir(parents=True,exist_ok=True)
git=lambda *a:subprocess.check_output(['git',*a],cwd=ROOT,text=True).strip()
base=git('rev-parse','aab0be9');old=git('ls-tree','-r','--name-only',base,'supabase/migrations').splitlines();assert len(old)==57
versions=','.join("'"+Path(p).name.split('_')[0]+"'"for p in old)
gate=f"""-- Exact57 baseline; an existing custom DataAPI hook requires developer review.
do $$begin
 if(select count(*) from supabase_migrations.schema_migrations)<>57 or exists(select 1 from supabase_migrations.schema_migrations where version not in({versions}))or to_regnamespace('adme_privacy')is not null then raise exception 'STOP: expected reviewed57 baseline';end if;
 if exists(select 1 from pg_db_role_setting s cross join lateral unnest(s.setconfig)cfg(value)where cfg.value like 'pgrst.db_pre_request=%' and cfg.value<>'pgrst.db_pre_request=')then raise exception 'STOP: preserve and review existing DataAPI hook';end if;
 if md5(replace(pg_get_functiondef('adme_upload.room_allowed(uuid,boolean)'::regprocedure),E'\\r\\n',E'\\n'))<>'52ac1d28f0872916090c5fea707edf01' or md5(replace(pg_get_functiondef('adme_upload.brand_logo(uuid)'::regprocedure),E'\\r\\n',E'\\n'))<>'a93337dcb5186011ba9ac7b02e1232d1' then raise exception 'STOP: reviewed file access helpers required';end if;
end$$;
"""
body="begin;\nset local lock_timeout='5s';\nset local statement_timeout='60s';\nselect pg_advisory_xact_lock(hashtext('adme-erasure-quarantine-20261121'));\n"+gate;sources=[]
for version in ['202611210058','202611210059','202611210060']:
 paths=list((ROOT/'supabase/migrations').glob(version+'_*.sql'));assert len(paths)==1;p=paths[0];value=p.read_text(encoding='utf-8').replace('\r\n','\n');_,name=p.stem.split('_',1)
 assert len(re.findall(r'(?mi)^begin;\s*$',value))==1 and '$erasure_source$'not in value
 source=re.sub(r'(?mi)^begin;\s*\n?','',value,count=1);source=re.sub(r'(?mi)^commit;\s*$','',source,count=1)
 body+='\n-- SOURCE '+p.name+'\n'+source+f"\ninsert into supabase_migrations.schema_migrations(version,name,statements)values('{version}','{name}',array[$erasure_source${value}$erasure_source$]);\n"
 sources.append(dict(path=p.relative_to(ROOT).as_posix(),sha256_lf=hashlib.sha256(value.encode()).hexdigest()))
body+='commit;\n';head=git('rev-parse','HEAD')
(TARGET/'00_preflight.sql').write_text(gate,encoding='utf-8',newline='\n');(TARGET/'01_apply_current_57.sql').write_text(body,encoding='utf-8',newline='\n')
(TARGET/'02_verify.sql').write_text("""-- Expected60 / enabled=false / requests0 / quarantine bucket public=false / hook configured.
select count(*)from supabase_migrations.schema_migrations;
select enabled,review_ref from adme_privacy.intake;
select count(*)from adme_privacy.requests;
select id,public from storage.buckets where id='adme-privacy-quarantine';
select cfg.value from pg_db_role_setting s join pg_roles r on r.oid=s.setrole cross join lateral unnest(s.setconfig)cfg(value)where r.rolname='authenticator' and cfg.value like 'pgrst.db_pre_request=%';
select has_function_privilege('authenticated','adme_privacy.actor_active(uuid)','execute') arbitrary_actor_probe; -- false
""",encoding='utf-8',newline='\n')
(TARGET/'03_release-gates.json').write_text(json.dumps(dict(source_head=head,online_intake_enabled=False,permanent_erasure_implemented=False,policy_user_answer='아직 미확정 — 구현 계속',policy_retention_basis_period_exceptions=None,processors_regions_overseas=None,rights_process=None,dev_b_D079_retention_backup_replay='OPEN',SMTP_U007_U008='EXTERNAL_VERIFICATION_REQUIRED',license_rights='UNRESOLVED; see target runtime inventories',activation_sql_included=False,developer_will_prepare_activation_after_actual_review=True),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
files=[dict(path=p.name,sha256_lf=hashlib.sha256(p.read_bytes()).hexdigest())for p in sorted(TARGET.glob('*.sql'))]
(TARGET/'MANIFEST.json').write_text(json.dumps(dict(source_head=head,baseline_head=base,from_migrations=57,to_migrations=60,sources=sources,files=files,intake_default_off=True,permanent_erasure=False,external_applied=False),indent=2)+'\n',encoding='utf-8');print('Prepared1 USER57→60 packet; no intake/policy activation SQL')
