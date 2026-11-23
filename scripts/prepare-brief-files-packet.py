"""D042 immutable USER packet from exact reviewed109 baseline; never applies hosted changes."""
from pathlib import Path
import hashlib
import json
import re
import subprocess
import zipfile

root = Path(__file__).resolve().parents[1]
target = root / 'deliverables/dev-a-brief-files-20261123'
assert not target.exists(), 'Reviewed artifacts are immutable'
assert 'project_id = "dev-a-packet-db"' in (root / 'output/dev-a-packet-db/supabase/config.toml').read_text(encoding='utf-8')

def sql(query):
    return subprocess.check_output(['docker','exec','-i','supabase_db_dev-a-packet-db','psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],input=query,text=True,encoding='utf-8',cwd=root).strip()

assert sql('select count(*)from supabase_migrations.schema_migrations') == '109'
new = {'20261123121526','20261123122650','20261123123531'}
records = []
for path in sorted((root / 'supabase/migrations').glob('*.sql')):
    version, name = path.stem.split('_',1)
    body = path.read_text(encoding='utf-8').replace('\r\n','\n')
    records.append(dict(version=version,name=name,sha256=hashlib.sha256(body.encode()).hexdigest(),body=body))
baseline = [r for r in records if r['version']not in new]
pending = [r for r in records if r['version']in new]
assert len(baseline)==109 and len(pending)==3
signatures = ['public.account_access()','adme_privacy.actor_active(uuid)',
              'public.valid_campaign_dto(jsonb)','public.admin_mfa_recent()',
              'adme_creator.catalog_dto(public.creators)','public.create_creator_proposal(uuid,text,text,text)',
              'public.serve_promotion_slots(boolean)']
values = ','.join("'"+s+"'"for s in signatures)
fingerprints = json.loads(sql("select jsonb_object_agg(s,encode(sha256(convert_to(pg_get_functiondef(s::regprocedure),'UTF8')),'hex'))from unnest(array["+values+"])s;"))
history = ',\n'.join(f"('{r['version']}','{r['name']}')"for r in baseline)
functions = ',\n'.join(f"('{s}','{fingerprints[s]}')"for s in signatures)
preflight=f"""-- Reviewed109 baseline only. CLI/console history formats supported; no history rewrite.
do $preflight$ begin
 if to_regnamespace('adme_brief')is not null or exists(select 1 from storage.buckets where id='adme-campaign-briefs')then raise exception 'STOP: brief namespace/bucket already exists; inspect partial application';end if;
 if(select count(*)from supabase_migrations.schema_migrations)<>109 or exists(select 1 from(values {history})e(version,name)left join supabase_migrations.schema_migrations m using(version)where m.version is null or m.name is distinct from e.name)then raise exception 'STOP: unsupported or partial baseline';end if;
 if exists(select 1 from(values {functions})e(signature,hash)where to_regprocedure(e.signature)is null or encode(sha256(convert_to(pg_get_functiondef(to_regprocedure(e.signature)),'UTF8')),'hex')is distinct from e.hash)then raise exception 'STOP: baseline permission/DTO contract mismatch';end if;
end $preflight$;
"""
target.mkdir(parents=True)
(target/'00_preflight_109.sql').write_text(preflight,encoding='utf-8',newline='\n')
apply="begin;\nset local lock_timeout='5s';\nset local statement_timeout='120s';\n"+preflight
for record in pending:
    body,count=re.subn(r'(?im)^begin;\s*','',record['body'],count=1)
    assert count==1 and body.rstrip().lower().endswith('commit;')
    marker='$adme_brief_source$';assert marker not in record['body']
    apply+='\n-- '+record['version']+' SHA256 '+record['sha256']+'\n'+body.rstrip()[:-7]
    apply+=f"\ninsert into supabase_migrations.schema_migrations(version,name,statements)values('{record['version']}','{record['name']}',array[{marker}{record['body']}{marker}]);\n"
apply+="notify pgrst,'reload schema';\ncommit;\n"
(target/'01_apply_109_to_112.sql').write_text(apply,encoding='utf-8',newline='\n')
(target/'02_verify.sql').write_text("""-- Read-only; no actor records, object paths or keys.
select count(*)as migrations from supabase_migrations.schema_migrations; --112
select enabled,policy_ref is null as pending_policy,retention_days is null as pending_period from adme_brief.controls; --false,true,true after this packet
select count(*)as tables,bool_and(relrowsecurity)as all_rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='adme_brief'and c.relkind='r'; --4,true
select public,file_size_limit from storage.buckets where id='adme-campaign-briefs'; --false,4194304
select has_function_privilege('authenticated','public.campaign_brief_change(uuid,uuid,integer,uuid,text,uuid,jsonb)','execute')as client_write,
has_function_privilege('service_role','public.campaign_brief_change(uuid,uuid,integer,uuid,text,uuid,jsonb)','execute')as server_write,
has_table_privilege('authenticated','adme_brief.files','select')as raw_read; --false,true,false
""",encoding='utf-8',newline='\n')
(target/'README_KO.md').write_text("""# D042 캠페인 brief 첨부 버전 · 검토용109→112

이 패키지는 기존109개 이력의 정확한 버전·이름과 핵심7개 권한/DTO 함수 정의를 검사합니다. 다른 DB/부분 적용/이미 적용된 DB에서는 중단합니다. 먼저 이전105→109 v2 인계를 통과한 기준 또는 동등한 검토된109 기준을 맞춰야 합니다. 운영의 더 오래된 이력에는 직접 적용하지 않습니다. 기존 패킷·적용 SQL·이력을 고치거나 강제 실행하지 마세요.

USER가 백업·복구 지점을 확인하고 DB SQL 콘솔에서00_preflight_109.sql을 검사한 뒤01_apply_109_to_112.sql을 실행합니다.3개 소스와 이력 기록은 한 트랜잭션이며 실패하면 모두 롤백됩니다.02_verify.sql로112개·RLS·서비스 전용 쓰기·4MB 비공개 버킷 및 기본OFF를 확인합니다. 이후 같은 소스 앱의 배포와 실제 URL 회귀는 USER가 조율합니다. 에이전트는 콘솔 변경이나 배포/키 작업을 하지 않았습니다.

기능: 본인 캠페인의 불변 파일/변경 이력/활성 포인터, 새 파일·복원·해제, expected revision과 request key, 동일 요청 재전송,64자리 내용 해시, 업로드 권리 진술과 정책 참조의 스냅샷,4MB·계정 전체20파일·캠페인200동작 제한. 포트폴리오 데이터/권한과 분리되며 캠페인을 복제해도 파일·참여자·메시지·개인 메모의 권한을 복제하지 않습니다. 이전110행의 권리 진술은 NULL로 보존하며 추정 동의를 만들지 않습니다.

중요한 적용 조건: 새 수집은 adme_brief.controls.enabled=false,policy_ref=NULL,retention_days=NULL로 유지합니다. U001 최종 정책과 B D079의 새 버킷/파일 메타데이터 보존·만료·고아 객체/계정 삭제 물리 정리 통합이 검토되기 전 활성화하지 않습니다. 현재 parent 삭제는 DB 이력/메타데이터를 제거하고 Storage 읽기를 차단하지만, 객체 자체의 물리 삭제를 대신하지 않습니다. 실제 보존 항목·기간·예외/처리 검증 결과가 확정되면 전달해 주세요. 에이전트가 확정 값과 정리 경로를 반영한 별도 활성화 패키지를 작성하므로 사용자에게 소스 편집/설치를 요구하지 않습니다. 정책값과 보존기간을 임의로 넣지 않습니다. 정리·정책 게이트가 없는 새 cron/유료 자원은 만들지 않습니다.

검증은 격리 Auth/PostgREST/Storage와 명시적인 가상 actor/파일/정책으로 수행합니다. 로컬 권리 체크박스와 정책 fixture는 실제 저작권·법적 승인·운영 검증이 아닙니다. 파일은 짧은 첨부 다운로드만 제공하며 inline PDF 미리보기는 하지 않습니다. 전체112 새 설치/운영 수용을 단정하지 않습니다. 증거: harness/evidence/D042/FILES_20261123.md 및 DEV-A-BRIEF-FILES-20261123/verification.json.
""",encoding='utf-8')
manifest=dict(source_commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),baseline_count=109,target_count=112,baseline_function_hashes=fingerprints,baseline=[{k:r[k]for k in ('version','name','sha256')}for r in baseline],pending=[{k:r[k]for k in ('version','name','sha256')}for r in pending])
manifest['files']={p.name:hashlib.sha256(p.read_bytes()).hexdigest()for p in target.iterdir()}
(target/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
archive=target.parent/'AD-Me_DEV-A_BRIEF_FILES_20261123_review.zip';assert not archive.exists()
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED)as z:
    for p in sorted(target.iterdir()):z.write(p,arcname=p.name)
print('Prepared immutable109→112 reviewed packet; collection stays OFF')
