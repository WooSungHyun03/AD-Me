"""Build a value-free USER console packet for the integrated main baseline."""
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'deliverables/dev-a-main-20261120'
TARGET.mkdir(parents=True, exist_ok=True)
SQL = TARGET / 'user-apply'
SQL.mkdir(exist_ok=True)
OLD = ['202611190004', '202611190005', '202611190006', '202611190007']
NEW = ['202611200006', '202611200007', '202611200008', '202611200010']
hash_bytes = lambda value: hashlib.sha256(value).hexdigest()
records = []
for version in OLD + NEW:
    path, = (ROOT / 'supabase/migrations').glob(version + '_*.sql')
    body = path.read_text(encoding='utf-8')
    assert body.rstrip().lower().endswith('commit;')
    marker = '$adme_packet_body$'
    assert marker not in body
    name = path.stem.split('_', 1)[1]
    history = ("insert into supabase_migrations.schema_migrations(version,name,statements) values "
               f"('{version}','{name}',array[{marker}{body}{marker}]);\n")
    at = body.lower().rfind('commit;')
    prepared = '-- Source SHA-256: ' + hash_bytes(path.read_bytes()) + '\n' + body[:at] + history + body[at:]
    (SQL / path.name).write_text(prepared, encoding='utf-8', newline='\n')
    records.append(dict(version=version, name=name, source=path.relative_to(ROOT).as_posix(),
                        sha256=hash_bytes(path.read_bytes()), apply_file=path.name))

def preflight(integrated):
    pending = NEW if integrated else OLD + NEW
    versions = ','.join("'" + v + "'" for v in pending)
    approved = 'is null' if integrated else 'is not null'
    return f"""-- USER Supabase SQL Editor only. No account/secret values.
do $preflight$ begin
  if to_regclass('supabase_migrations.schema_migrations') is null
    or to_regprocedure('adme_ops.ops_worker_claim(text)') is null
    or to_regprocedure('public.ops_public_channels(text)') is null
    or to_regprocedure('public.valid_campaign_dto(jsonb)') is null then
    raise exception 'STOP: expected main65063c8 schema baseline is missing; ask agent to inspect';
  end if;
  if to_regclass('public.administrator_grants') {approved} then
    raise exception 'STOP: wrong baseline variant; do not edit SQL or force apply';
  end if;
  if to_regclass('adme_ops.resource_controls') is not null
    or exists(select 1 from information_schema.columns where table_schema='adme_ops' and table_name='staff' and column_name='approved_at')
    or exists(select 1 from supabase_migrations.schema_migrations where version in ({versions})) then
    raise exception 'STOP: new patches already/partially applied; ask agent to inspect';
  end if;
  if (select prosecdef from pg_proc where oid='public.ops_public_channels(text)'::regprocedure) then
    raise exception 'STOP: main private-wrapper migration is missing';
  end if;
end $preflight$;
"""

for integrated, label in [(False, 'from_main'), (True, 'from_integrated_dev_a')]:
    gate = preflight(integrated)
    (SQL / f'00_preflight_{label}.sql').write_text(gate, encoding='utf-8')
    selected = [r for r in records if r['version'] in (NEW if integrated else OLD + NEW)]
    (SQL / f'01_apply_{label}.sql').write_text(gate + '\n' + '\n'.join(
        (SQL / r['apply_file']).read_text(encoding='utf-8') for r in selected), encoding='utf-8', newline='\n')

(SQL / '02_verify.sql').write_text("""-- Read-only structural check after application. All control flags should be false.
select version,name from supabase_migrations.schema_migrations
where version in ('202611190004','202611190005','202611190006','202611190007',
 '202611200006','202611200007','202611200008','202611200010') order by version;
select ingestion_enabled,llm_enabled from adme_ops.resource_controls;
select discovery_enabled from adme_ops.settings;
select relname,relrowsecurity from pg_class where oid in
 ('adme_ops.rate_windows'::regclass,'adme_ops.resource_controls'::regclass);
select has_function_privilege('authenticated','adme_ops.provision_staff(uuid,text,text,timestamptz)','execute') as browser_provision,
 has_function_privilege('service_role','adme_ops.take_quota(text,text,int,int,int)','execute') as service_arbitrary_quota;
-- Expected: 8 history rows; flags false/false/false; RLS true/true; privileges false/false.
""", encoding='utf-8')
(SQL / '03_pause.sql').write_text("""-- USER may pause new external work without deleting data or grants.
update adme_ops.resource_controls set ingestion_enabled=false,llm_enabled=false where singleton=true;
-- Also set ADME_FEATURE_INGESTION=off and ADME_FEATURE_LLM=off in the app environment.
-- Existing in-flight provider calls can still finish; new enqueue/leases are stopped.
""", encoding='utf-8')
(TARGET / 'README_KO.md').write_text("""# DEV-A main 통합 적용 패키지 — 2026-11-20

사용자가 Supabase SQL Editor·설정·배포를 수행한다. 개발자가 검증한 완성 SQL이며 코드 수정/터미널 실행/설치를 요구하지 않는다. 외부 미적용, 출시 준비 완료 아님. 이전 20261119 패키지는 역사 자료로 보존한다.

1. USER가 대상 프로젝트·백업/복원 경로·릴리스 시점을 확인한다. 현재 DB가 main65063c8의 스키마인 경우 `00_preflight_from_main.sql`을 실행한다. 이전 DEV-A4개도 이미 적용했다면 `00_preflight_from_integrated_dev_a.sql`을 사용한다. 실패하면 SQL을 고치거나 강제로 재실행하지 말고 결과를 에이전트에게 전달한다.
2. 성공한 같은 변형의 `01_apply_*.sql`을 전체 실행한다. preflight를 내장했으며 migration별 트랜잭션·이력 기록을 포함한다. 중간 실패는 부분 적용 상태이므로 재실행 전 에이전트가 조사한다. 생성된 원본별 SQL은 검토용이다.
3. `02_verify.sql` 결과를 확인한다. 신규 자원 플래그는 false, 기존 자동 발굴도 중지된다. 기존 역할만 있던 운영자는 새 승인을 받기 전 접근할 수 없다. 새 코드는 OTP 등록 경로를 제공한다.
4. 앱 환경 이름/역할: docs/handoff/ENVIRONMENT_CONTRACT.md. `ADME_FEATURE_INGESTION`, `ADME_FEATURE_LLM` 기본 off. USER가 수집 허용/쿼터/worker/정책/릴리스 조건을 확인한 경우에만 DB resource_controls와 해당 앱 플래그를 켠다. 패키지는 키를 발급/등록하지 않는다.
5. USER 배포 후 에이전트가 실제 URL에서 권한·오류·기능 상태를 재검증한다. 본 패키지의 테스트는 격리 로컬 Auth/DB/fixture이며 실제 YouTube/모델/SMTP/Toss 검증을 대신하지 않는다.

정지/복구: `03_pause.sql`과 앱 플래그 off로 새 작업을 중지한다. 외부 호출이 이미 시작되었다면 완료될 수 있다. 추가 스키마/감사/데이터를 DROP하거나 MFA를 제거하지 않는다. 실패 시 백업과 정확한 적용 이력으로 개발자가 forward fix를 준비한다. 코드 롤백도 USER가 검토 후 실행한다.

남은 범위: D076의 가입/로그인 신뢰 IP·계정 제한과 기존 카탈로그 검색, D051 페이지/첨부/스팸 UX, 실제 공급자·호스팅 적용 및 전체 P0. 어떤 티켓도 이 패키지만으로 DONE이 아니다. 상세 결과는 harness/evidence/DEV-A-MAIN-20261120/verification.json.
""", encoding='utf-8')

paths = subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'], cwd=ROOT).decode().split('\0')
selected = []
for relative in sorted(set(filter(None, paths))):
    path = ROOT / relative
    if relative.startswith(('deliverables/','dev-a-local/','output/','.git/')):
        continue
    if relative.startswith('harness/evidence/') and not (
        relative.startswith('harness/evidence/DEV-A-MAIN-20261120/') or path.name=='README.md'):
        continue
    if (path.name.startswith('.env') and path.name!='.env.example') or path.name.startswith('.accounts') or path.suffix in ('.key','.pem','.log','.zip'):
        continue
    if path.is_file() and not path.is_symlink() and path.resolve().is_relative_to(ROOT):
        selected.append(relative)
manifest = dict(source_head=subprocess.check_output(['git','rev-parse','HEAD'], cwd=ROOT).decode().strip(),
                upstream_main='65063c8', scope='local reviewed source and USER-only console migrations; no deployment',
                migrations=records, files=[dict(path=p,sha256=hash_bytes((ROOT/p).read_bytes())) for p in selected])
(TARGET/'MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
archive = TARGET.parent/'AD-Me_DEV-A_MAIN_20261120_review.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as bundle:
    for p in selected:
        bundle.write(ROOT/p, 'source/'+p)
    for path in TARGET.rglob('*'):
        if path.is_file() and path.name!='DELIVERY.json':
            bundle.write(path,path.relative_to(TARGET).as_posix())
with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    assert not any('runtime.local' in n or 'accounts.local' in n or 'tls.local' in n or n.endswith('.env.local') for n in bundle.namelist())
delivery = dict(archive=archive.relative_to(ROOT).as_posix(), sha256=hash_bytes(archive.read_bytes()),
                bytes=archive.stat().st_size, source_files=len(selected), external_applied=False,
                source_head=manifest['source_head'])
(TARGET/'DELIVERY.json').write_text(json.dumps(delivery,indent=2)+'\n',encoding='utf-8')
print(json.dumps(delivery))
