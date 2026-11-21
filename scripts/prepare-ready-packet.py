"""Prepare one USER-owned 60->67 SQL packet. No network, approval or deployment."""
from pathlib import Path
import subprocess, json, hashlib, re, sys
ROOT=Path(__file__).resolve().parents[1]
TARGET=ROOT/'deliverables/dev-a-ready-20261122';TARGET.mkdir(parents=True,exist_ok=True)
base='80e8d1e6b13df7d81e13ed52bfd4c1cf03194b73'
old=subprocess.check_output(['git','ls-tree','-r','--name-only',base,'supabase/migrations'],cwd=ROOT,text=True).splitlines();assert len(old)==60
versions=','.join("'"+Path(p).name.split('_')[0]+"'"for p in old)
gate=f"""-- Reviewed exact60 baseline; custom functions/history/hooks require developer review.
do $$begin
 if(select count(*)from supabase_migrations.schema_migrations)<>60 or exists(select 1 from supabase_migrations.schema_migrations where version not in({versions}))then raise exception 'STOP: expected reviewed60 baseline';end if;
 if to_regclass('adme_review.competitors')is not null or to_regclass('adme_ops.support_audit')is not null then raise exception 'STOP: new tables already exist';end if;
 if md5(replace(pg_get_functiondef('adme_creator.normalized_public(text)'::regprocedure),E'\\r\\n',E'\\n'))<>'f6ba6a24d1e83dccc2de56df0777165d' or md5(replace(pg_get_functiondef('adme_creator.filtered_page(jsonb,text,int,boolean)'::regprocedure),E'\\r\\n',E'\\n'))<>'a9cd3a1679f52c54d865cdb86c53bd8e' or md5(replace(pg_get_functiondef('public.moderate_entity(text,text,boolean,text)'::regprocedure),E'\\r\\n',E'\\n'))<>'9e9063fa5473631b216394246fce9617' then raise exception 'STOP: reviewed baseline functions required';end if;
 if not exists(select 1 from pg_db_role_setting s join pg_roles r on r.oid=s.setrole cross join lateral unnest(s.setconfig)cfg(value)where r.rolname='authenticator'and cfg.value='pgrst.db_pre_request=adme_privacy.enforce_actor')or exists(select 1 from pg_db_role_setting s cross join lateral unnest(s.setconfig)cfg(value)where cfg.value like 'pgrst.db_pre_request=%'and cfg.value<>'pgrst.db_pre_request=adme_privacy.enforce_actor')then raise exception 'STOP: preserve and review DataAPI hook';end if;
end$$;
"""
body="begin;\nset local lock_timeout='5s';\nset local statement_timeout='60s';\nselect pg_advisory_xact_lock(hashtext('adme-ready-p1-20261122'));\n"+gate
sources=[]
for p in sorted((ROOT/'supabase/migrations').glob('2026112200*.sql')):
 value=p.read_text(encoding='utf-8').replace('\r\n','\n');version,name=p.stem.split('_',1)
 assert len(re.findall(r'(?mi)^begin;\s*$',value))==1 and '$ready_source$'not in value
 sql=re.sub(r'(?mi)^begin;\s*\n?','',value,count=1);sql=re.sub(r'(?mi)^commit;\s*$','',sql,count=1)
 body+='\n-- SOURCE '+p.name+'\n'+sql+f"\ninsert into supabase_migrations.schema_migrations(version,name,statements)values('{version}','{name}',array[$ready_source${value}$ready_source$]);\n"
 sources.append(dict(path=p.relative_to(ROOT).as_posix(),sha256_lf=hashlib.sha256(value.encode()).hexdigest()))
assert len(sources)==7
body+='commit;\n'
(TARGET/'00_preflight.sql').write_text(gate,encoding='utf-8',newline='\n')
(TARGET/'01_apply_current_60.sql').write_text(body,encoding='utf-8',newline='\n')
(TARGET/'02_verify.sql').write_text("""-- Expected67, two private RLS tables, denied direct probes, unchanged intake OFF.
select count(*)from supabase_migrations.schema_migrations;
select enabled from adme_privacy.intake;
select n.nspname,c.relname,c.relrowsecurity,has_table_privilege('authenticated',c.oid,'select')as app_direct_select from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname,c.relname)in(('adme_review','competitors'),('adme_ops','support_audit'));
select has_function_privilege('authenticated','adme_creator.engagement_value(text)','execute')as private_probe; -- false
select tgname,tgenabled from pg_trigger where tgrelid='adme_ops.support_audit'::regclass and not tgisinternal;
select provider,policy_version,enabled,derived_allowed,history_allowed,history_window_seconds from adme_creator.publication_policies; -- no new approvals
""",encoding='utf-8',newline='\n')
source=sys.argv[1]if len(sys.argv)>1 else 'PENDING_TICKET_COMMITS'
manifest=dict(source_head=source,baseline_head=base,from_migrations=60,to_migrations=67,sources=sources,files=[dict(path=p.name,sha256_lf=hashlib.sha256(p.read_bytes()).hexdigest())for p in sorted(TARGET.glob('*.sql'))],intake_activation_included=False,policy_or_provider_approval_included=False,external_applied=False)
(TARGET/'MANIFEST.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print('Prepared one USER60->67 packet; no approvals or deployment')
