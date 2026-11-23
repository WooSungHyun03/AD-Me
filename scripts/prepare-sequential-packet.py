"""Immutable reviewed SQL packet: exact 105-source baseline to109, never a cloud action."""
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

root = Path(__file__).resolve().parents[1]
target = root / 'deliverables/dev-a-sequential-20261123-v2'
assert not target.exists(), 'Do not overwrite a reviewed packet'
target.mkdir(parents=True)
new = {'20261123112401', '20261123113123', '20261123114341', '20261123114636'}
sources = []
for path in sorted((root / 'supabase/migrations').glob('*.sql')):
    version, name = path.stem.split('_', 1)
    body = path.read_text(encoding='utf-8').replace('\r\n', '\n')
    sources.append(dict(version=version, name=name, sha256=hashlib.sha256(body.encode()).hexdigest(), body=body))
baseline = [r for r in sources if r['version'] not in new]
pending = [r for r in sources if r['version'] in new]
assert len(baseline) == 105 and len(pending) == 4
values = ',\n'.join(f"('{r['version']}','{r['name']}')" for r in baseline)
# A CLI stores parsed statements, whereas console packets store the whole source.
# Pin the actual baseline functions as well as every history version/name; never rewrite history to fit.
signatures = ['adme_ops.featured_youtube(text,text,integer)', 'adme_creator.saved_catalog()',
              'adme_creator.toggle_saved(text)', 'public.ensure_default_list()',
              'public.serve_promotion_slots(boolean)', 'adme_ops.channel_fresh(text)',
              'adme_creator.catalog_dto(public.creators)']
query = "select jsonb_object_agg(signature,encode(sha256(convert_to(pg_get_functiondef(signature::regprocedure),'UTF8')),'hex'))from unnest(array[" + ','.join("'"+s+"'" for s in signatures) + "])signature;"
config = (root / 'output/dev-a-packet-db/supabase/config.toml').read_text(encoding='utf-8')
assert 'project_id = "dev-a-packet-db"' in config
fingerprints = json.loads(subprocess.check_output(['docker','exec','-i','supabase_db_dev-a-packet-db','psql','-U','postgres','-d','postgres','-At'], input=query, text=True, encoding='utf-8', cwd=root))
function_values = ',\n'.join(f"('{signature}','{fingerprints[signature]}')" for signature in signatures)
preflight = f"""-- Exact reviewed 105 baseline versions/names and critical function definitions. Unknown/partial/old41 STOP.
do $preflight$ begin
 if to_regclass('supabase_migrations.schema_migrations') is null
 or to_regclass('public.saved_list_items') is null or to_regclass('public.saved_creators') is not null then
  raise exception 'STOP: reviewed 105 baseline missing; request an inspected application packet';end if;
 if (select count(*)from supabase_migrations.schema_migrations)<>105 or exists(
  select 1 from(values {values})expected(version,name)left join supabase_migrations.schema_migrations m using(version)
  where m.version is null or m.name is distinct from expected.name
 )then raise exception 'STOP: history/source mismatch, partial or unknown baseline; do not force SQL';end if;
 if exists(select 1 from(values {function_values})expected(signature,hash)
 where to_regprocedure(expected.signature)is null or encode(sha256(convert_to(pg_get_functiondef(to_regprocedure(expected.signature)),'UTF8')),'hex')is distinct from expected.hash)
 then raise exception 'STOP: reviewed baseline function definition mismatch';end if;
end $preflight$;
"""
(target / '00_preflight_105.sql').write_text(preflight, encoding='utf-8', newline='\n')
combined = "begin;\nset local lock_timeout='5s';\nset local statement_timeout='120s';\n" + preflight
for record in pending:
    body = record['body']
    # Outer source transactions become one atomic reviewed batch; original sources stay immutable.
    import re
    body, count = re.subn(r'(?im)^begin;\s*', '', body, count=1)
    assert count == 1 and body.rstrip().lower().endswith('commit;')
    body = body.rstrip()[:-7]
    marker = '$adme_sequential_source$'
    assert marker not in record['body']
    combined += f"\n-- {record['version']} {record['name']} SHA256 {record['sha256']}\n" + body
    combined += f"\ninsert into supabase_migrations.schema_migrations(version,name,statements)values('{record['version']}','{record['name']}',array[{marker}{record['body']}{marker}]);\n"
combined += "notify pgrst,'reload schema';\ncommit;\n"
(target / '01_apply_105_to_109.sql').write_text(combined, encoding='utf-8', newline='\n')
(target / '02_verify.sql').write_text("""-- Read-only receipt. No keys/user records.
select count(*)as migration_count from supabase_migrations.schema_migrations; --109
select has_function_privilege('anon','public.youtube_directory_page(jsonb,text,integer)','execute')as directory,
has_function_privilege('anon','public.toggle_saved_creator(text)','execute')as anonymous_save,
has_function_privilege('authenticated','public.serve_promotion_slots(boolean)','execute')as client_hot,
has_function_privilege('service_role','public.serve_promotion_slots(boolean)','execute')as service_hot; --true,false,false,true
select to_regclass('public.saved_creators')is null as retired_table,
(select bool_and(relrowsecurity)from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r'and(n.nspname='public'or n.nspname like 'adme_%'))as all_rls; --true,true
select indexname from pg_indexes where schemaname='adme_ops'and indexname in('youtube_directory_subscribers106','youtube_directory_updated106'); --2
select enabled as test_billing from adme_release.billing_boundary; --must match the user's approved prior state
""", encoding='utf-8', newline='\n')
(target / 'README_KO.md').write_text("""# DEV-A 순차 작업 적용 패키지 · 2026-11-23

코드 main 푸시는 운영 배포 승인이 아닙니다. Git 기반 자동배포 보류를 유지합니다. 이 패키지는 정확히 검토한105개 마이그레이션 이력에서109개로 전진할 때만 사용합니다. 운영41개 이력에 직접 실행하지 마세요.41→105 선행 통합은 DEV-B D085와 조율하고 해당 DB 이력에 맞는 패키지를 별도로 검토해야 합니다. 사용자는 콘솔 적용·배포를 담당하며, 소스 수정이나 패키지 설치를 할 필요가 없습니다.

1. 사용자가 백업/복구 지점과 배포 시간을 확인한 뒤 DB SQL 콘솔에서00_preflight_105.sql을 검토·실행합니다.105개 버전·이름과 핵심7개 함수 정의 해시가 검토 기준과 일치해야 합니다. CLI의 분할 저장과 콘솔의 전체 소스 저장을 모두 수용하며 이력을 수정하지 않습니다. 이전 v1은 분할 이력과 호환되지 않아 사용하지 않습니다. 불일치하면 중단하고 안전한 이력 확인 결과를 전달하면 에이전트가 맞는 패키지를 준비합니다.
2. 성공한 동일 DB에01_apply_105_to_109.sql을 실행합니다.105개 선행 버전·이름/함수 정의를 다시 검사하며4개 변경과 이력 기록이 한 트랜잭션으로 커밋됩니다. 실패/잠금 시간초과이면 전부 롤백됩니다. 기존 적용 SQL을 편집하지 않습니다.
3.02_verify.sql의109개·권한/인덱스/RLS 결과를 확인합니다. 정책 승인, 수집/모델, TEST 결제 플래그나 키를 자동으로 활성화하지 않습니다. prior TEST 상태도 임의 변경하지 않습니다.
4. 이후 사용자가 DB와 동일 소스의 앱 배포를 조율합니다. 공개 채널 필터/다음·첫 페이지, 기본 저장/CSV, TEST 스폰서의 불투명ID/검토·동의 철회, 로그인/OTP/파일 권한을 실제 URL에서 회귀합니다. 실제 공급자·소유권·광고 근거 검토/법적 정책 승인은 이번 로컬 fixture 검증으로 대체할 수 없습니다.

변경: D033 서버 공개 채널 필터/키셋 페이지와107 정수 커서 수정, D075 새 저장 목록 테이블 호환성, 서비스 전용 HOT의 공개참조·동의/TTL·TEST 경계. D019 워커 응답/소유 증명과 D0215개 영상 계약, D044 조건·결측 점수는 앱/워커 코드 변경입니다. 워커는 사용자가 기존 실행기를 업데이트하며 새 외부 cron/계정/유료 자원은 만들지 않습니다.

문제 발생 시 앱 승격을 중단하고 전진 수정 또는 승인된 복구 지점을 사용합니다. 새 테이블/기존 이력/데이터를 삭제하는 역방향 SQL은 제공하지 않습니다. B D036/D038 명명 목록/import의 공개 DTO 통합, D049 전체 경로와 대규모 성능/운영 수용은 별도입니다. 배치 증거는 harness/evidence/DEV-A-SEQUENTIAL-20261123/에서 확인합니다.
""", encoding='utf-8')
manifest = dict(source_commit=subprocess.check_output(['git','rev-parse','HEAD'], cwd=root, text=True).strip(), baseline_count=105, target_count=109, baseline_function_hashes=fingerprints, baseline=[{k:r[k]for k in ('version','name','sha256')}for r in baseline], pending=[{k:r[k]for k in ('version','name','sha256')}for r in pending])
manifest['files'] = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in target.iterdir()}
(target / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
archive = target.parent / 'AD-Me_DEV-A_SEQUENTIAL_20261123_v2_review.zip'
assert not archive.exists()
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED)as z:
    for path in sorted(target.iterdir()): z.write(path, arcname=path.name)
print('Prepared immutable105→109 packet; not a deployment')
