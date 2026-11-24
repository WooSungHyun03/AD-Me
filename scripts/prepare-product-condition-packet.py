"""Prepare one immutable113→116 packet against the marked secondary local DB."""
from pathlib import Path
import hashlib
import json
import re
import subprocess
import zipfile

root = Path(__file__).resolve().parents[1]
target = root / 'deliverables/dev-a-product-conditions-20261124'
assert not target.exists(), 'Reviewed packet is immutable'
assert 'project_id = "dev-a-packet-db"' in (root/'output/dev-a-packet-db/supabase/config.toml').read_text(encoding='utf-8')

def sql(query):
    return subprocess.check_output(['docker','exec','-i','supabase_db_dev-a-packet-db','psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],input=query,text=True,encoding='utf-8',cwd=root).strip()

assert sql('select count(*)from supabase_migrations.schema_migrations') == '113'
pending_versions = {'20261124020115','20261124021507','20261124022829'}
records = []
for path in sorted((root/'supabase/migrations').glob('*.sql')):
    version,name = path.stem.split('_',1)
    body = path.read_text(encoding='utf-8').replace('\r\n','\n')
    records.append(dict(version=version,name=name,sha256=hashlib.sha256(body.encode()).hexdigest(),body=body))
baseline = [r for r in records if r['version'] not in pending_versions]
pending = [r for r in records if r['version'] in pending_versions]
assert len(baseline) == 113 and len(pending) == 3
signatures = ['adme_ops.ops_worker_claim(text)', 'adme_ops.ops_worker_finish(text,uuid,uuid,jsonb,text,integer)',
              'adme_ops.worker_heartbeat(text,uuid,uuid)', 'public.ops_draft_create(text)',
              'adme_privacy.enforce_actor()', 'public.valid_campaign_dto(jsonb)', 'adme_creator.catalog_dto(public.creators)']
values = ','.join("'"+s+"'" for s in signatures)
fingerprints = json.loads(sql("select jsonb_object_agg(s,encode(sha256(convert_to(pg_get_functiondef(s::regprocedure),'UTF8')),'hex'))from unnest(array["+values+"])s"))
history = ',\n'.join(f"('{r['version']}','{r['name']}')" for r in baseline)
functions = ',\n'.join(f"('{s}','{fingerprints[s]}')" for s in signatures)
preflight = f"""-- Strict113 baseline; never edit history/hashes to bypass a mismatch.
do $preflight$ begin
 if to_regnamespace('adme_product_conditions')is not null then raise exception 'STOP: product workflow already/partially exists';end if;
 if(select count(*)from supabase_migrations.schema_migrations)<>113 or exists(select 1 from(values {history})e(version,name)left join supabase_migrations.schema_migrations m using(version)where m.version is null or m.name is distinct from e.name)then raise exception 'STOP: unsupported or partial baseline';end if;
 if exists(select 1 from(values {functions})e(signature,hash)where to_regprocedure(e.signature)is null or encode(sha256(convert_to(pg_get_functiondef(to_regprocedure(e.signature)),'UTF8')),'hex')is distinct from e.hash)then raise exception 'STOP: baseline worker/access contract mismatch';end if;
end $preflight$;
"""
target.mkdir(parents=True)
(target/'00_preflight_113.sql').write_text(preflight,encoding='utf-8',newline='\n')
apply="begin;\nset local lock_timeout='5s';\nset local statement_timeout='120s';\n"+preflight
for i,r in enumerate(pending):
    body,count = re.subn(r'(?im)^begin;\s*','',r['body'],count=1)
    assert count == 1 and body.rstrip().lower().endswith('commit;')
    marker=f'$product_source_{i}$'
    assert marker not in r['body']
    apply+=body.rstrip()[:-7]+f"\ninsert into supabase_migrations.schema_migrations(version,name,statements)values('{r['version']}','{r['name']}',array[{marker}{r['body']}{marker}]);\n"
apply+='commit;\n'
(target/'01_apply_113_to_116.sql').write_text(apply,encoding='utf-8',newline='\n')
(target/'02_verify.sql').write_text("""-- Read-only; compare legacy row counts/hashes and existing flags with backup separately.
select count(*)as migrations from supabase_migrations.schema_migrations; --116
select enabled,policy_ref,retention_seconds from adme_product_conditions.controls; --false,NULL,NULL
select active from cron.job where jobname='adme-product-conditions-cleanup'; --true
select has_function_privilege('authenticated','public.product_conditions_create(uuid,text,uuid)','execute'),
has_function_privilege('anon','public.product_conditions_create(uuid,text,uuid)','execute'),
has_function_privilege('authenticated','adme_product_conditions.valid_result(jsonb,adme_product_conditions.requests)','execute'),
has_table_privilege('authenticated','adme_product_conditions.requests','select'); --true,false,false,false
select count(*)as product_operations from adme_ops.jobs where operation='product_conditions_v1'; --0 before activation
""",encoding='utf-8',newline='\n')
(target/'README_KO.md').write_text("""# PR-001 상품 추천 조건 ·113→116 검토 패키지

이 패키지는 검토된113개 버전·이름과 핵심7개 함수 정의가 일치하는 DB만 지원합니다. 기존 패키지를 대체하거나 오래된 DB의 중간 마이그레이션을 생략하지 않습니다. OPERATOR/B D085가 대상 이력·백업·복구 지점과 기존 플래그/행 수를 확인한 뒤00_preflight_113.sql,01_apply_113_to_116.sql,02_verify.sql 순으로 적용합니다. 소스·이력·cron·신규 필드는 한 트랜잭션입니다. 같은 패키지 재적용 또는 부분 적용은 거부합니다. 실패 시 전체 롤백 후 원인을 검토하며 이력/함수 해시를 고쳐 강행하지 않습니다.

DB 확장→동일 계약의 앱/worker 교체→권한·재시도·원본 변경·삭제·만료 회귀 확인 순서입니다. collection은 기본OFF이며 policy_ref/retention_seconds도 미설정입니다. U001 승인, B D079 내보내기/삭제/복구 범위 검토, OPERATOR PR-003 실제 모델·worker 호스트의 운영 수용 후에만 별도 검토된 활성화를 수행합니다. 활성화 SQL이나 보존기간을 임의로 제공하지 않습니다. 운영/유료 리소스·키·계정·디자인·기존 기능 플래그는 변경하지 않습니다. 에이전트는 클라우드 적용·배포·모델 호스트 가동을 하지 않았습니다.

소유 상품과 타깃의 최소화된 버전을 기존 marketing_draft 큐/한도/lease/retry에 묶습니다. 내부 operation 필드는 기존 일반 초안의 텍스트와 분리됩니다. 연락처·링크를 제거하고 서버에서 허용 어휘/인용/출처 버전을 검사합니다. 상품 변경·삭제·정지·만료·늦은 lease는 결과 사용을 거부합니다. 요청과 결정은 각각 동일 key 재전송을 지원하며 확인 전 자동 검색/적용이 없습니다. 별도 확인 후 명시적으로 검색하며 수동 추천은 계속 이용할 수 있습니다. 주문·결제·메시지·이용권을 생성하지 않습니다.

신규 소스/결과는 승인된 보존기간과 분 단위 cleanup으로 삭제됩니다. 기존 운영 정책이나 백업 보존을 대신하지 않습니다. 비공개 테이블은 클라이언트/서비스 역할의 직접 읽기를 막고 소유자 RPC만 허용합니다. 계정·캠페인·기존 추천 스냅샷·초안과 권한 계약은 보존합니다. 롤백 시 collection을 중단하고 앱/worker를 호환 버전으로 돌린 후 B D085가 백업 복구를 조율하며 적용된 SQL을 수정하거나 신규 데이터만 임의 삭제하지 않습니다.

로컬 증빙: harness/evidence/PR-001/WORKFLOW_20261124.md, harness/evidence/D075/PRODUCT_OPERATION_20261124.md, harness/evidence/DEV-A-PRODUCT-CONDITIONS-20261124/. 실제 로컬 SQL/Auth/REST/큐/cron과 명시적인 합성 모델 응답·가상 입력으로 검증했습니다. 실제 공급자/모델 운영 수용·법적 승인·공개 배포의 완료를 의미하지 않습니다. 테스트 및 적용 소스는 manifest.json의 SHA256으로 특정합니다.
""",encoding='utf-8',newline='\n')
manifest=dict(base_commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),baseline_count=113,target_count=116,baseline_function_hashes=fingerprints,baseline=[{k:r[k] for k in ('version','name','sha256')}for r in baseline],pending=[{k:r[k]for k in ('version','name','sha256')}for r in pending])
manifest['files']={p.name:hashlib.sha256(p.read_bytes()).hexdigest()for p in target.iterdir()}
(target/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
archive=target.parent/'AD-Me_DEV-A_PRODUCT_CONDITIONS_20261124_review.zip'
assert not archive.exists()
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED)as z:
    for p in sorted(target.iterdir()):z.write(p,arcname=p.name)
print('Prepared immutable113→116 packet; collectionOFF and no external actions')
