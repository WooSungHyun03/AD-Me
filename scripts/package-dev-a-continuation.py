"""Build a dated continuation packet; preserve all previous packages."""
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'deliverables/dev-a-terms-20261120'
TARGET.mkdir(parents=True, exist_ok=True)
SQL = TARGET / 'user-apply'
SQL.mkdir(exist_ok=True)
OLD = ['202611190004', '202611190005', '202611190006', '202611190007']
PREVIOUS = ['202611200006', '202611200007', '202611200008', '202611200010']
NEW = ['202611200011', '202611200012']
hash_bytes = lambda value: hashlib.sha256(value).hexdigest()
records = []
for version in OLD + PREVIOUS + NEW:
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

BASE = ['202611190001','202611190002','202611190003','202611200001','202611200002','202611200003','202611200004','202611200005']
VARIANTS = {'from_main':(BASE,OLD+PREVIOUS+NEW), 'from_integrated_dev_a':(BASE+OLD,PREVIOUS+NEW), 'from_955bf8c':(BASE+OLD+PREVIOUS,NEW)}

def preflight(label):
    required,pending=VARIANTS[label]
    required_sql=','.join("'"+v+"'" for v in required)
    return f"""-- USER console only. Stop on a wrong/unknown/partial/already-updated baseline.
do $preflight$ begin
  if to_regclass('supabase_migrations.schema_migrations') is null
    or to_regprocedure('adme_ops.ops_draft_get(uuid)') is null
    or to_regprocedure('public.valid_campaign_dto(jsonb)') is null then
    raise exception 'STOP: supported main schema is missing; ask agent to inspect';
  end if;
  if (select count(*) from supabase_migrations.schema_migrations where version in ({required_sql}))<>{len(required)}
     or exists(select 1 from supabase_migrations.schema_migrations where version not in ({required_sql}))
     or to_regprocedure('public.valid_campaign_terms(jsonb)') is not null then
    raise exception 'STOP: wrong, partial, unknown or updated baseline; do not edit/force SQL';
  end if;
  if (select prosecdef from pg_proc where oid='public.ops_draft_get(uuid)'::regprocedure) then
    raise exception 'STOP: expected private-schema/public-invoker boundary missing';
  end if;
end $preflight$;
"""

for label,(_,pending) in VARIANTS.items():
    gate=preflight(label)
    (SQL/f'00_preflight_{label}.sql').write_text(gate,encoding='utf-8')
    selected=[r for r in records if r['version'] in pending]
    (SQL/f'01_apply_{label}.sql').write_text(gate+'\n'+'\n'.join((SQL/r['apply_file']).read_text(encoding='utf-8') for r in selected),encoding='utf-8',newline='\n')

(SQL/'02_verify.sql').write_text("""-- Read-only. Expected18 application migration rows, both new versions and a validated terms constraint.
select version,name from supabase_migrations.schema_migrations order by version;
select conname,convalidated from pg_constraint where conrelid='public.campaigns'::regclass and conname='campaign_terms_valid';
select p.proname,p.provolatile,p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='ops_draft_get';
-- ops_draft_get: provolatile=v, prosecdef=false. Existing RLS unchanged.
select ingestion_enabled,llm_enabled from adme_ops.resource_controls;
-- From main/integrated: false/false. From955bf8c: pre-existing values preserved, never auto-enabled here.
""",encoding='utf-8')
(SQL / '03_pause.sql').write_text("""-- USER may pause new external work without deleting data or grants.
update adme_ops.resource_controls set ingestion_enabled=false,llm_enabled=false where singleton=true;
-- Also set ADME_FEATURE_INGESTION=off and ADME_FEATURE_LLM=off in the app environment.
-- Existing in-flight provider calls can still finish; new enqueue/leases are stopped.
""", encoding='utf-8')
(TARGET/'README_KO.md').write_text("""# DEV-A 캠페인 조건·조회 제한 계속 패키지 — 2026-11-20B

외부 미적용인 로컬 검토 산출물이다. USER가 대상/백업/릴리스 시점 확인, SQL Editor 적용, 환경 설정과 배포를 수행한다. 코드 수정·터미널·설치를 요구하지 않는다. 이전 패키지는 보존한다.

1. 현재 DB가 이전955bf8c 패킷까지 적용된16 migration이면 from_955bf8c(신규2개), main65063c8만 적용된8개면 from_main(10개), 이전DEV-A4개+main이 적용된12개면 from_integrated_dev_a(6개)를 선택한다. 해당00_preflight를 SQL Editor에서 실행한다. 모르는/부분 적용/다른 버전이면 중단하고 에이전트가 실제 상태를 읽어 적용안을 준비한다.
2. 성공한 변형의01_apply 파일 전체를 SQL Editor에서 실행한다. 파일에 preflight와 migration별 트랜잭션/이력 기록이 들어 있다. 중간 실패 시 재실행하거나 파일을 고치지 말고 결과를 에이전트에게 전달한다. 기존에 잘못된 terms 값이 있다면 검증에서 중단하며 임의 삭제하지 않는다.
3.02_verify 결과: 전체18개/신규011·012, campaign_terms_valid validated=true, public ops_draft_get volatile=v/security-definer=false. main/통합기준 신규 provider flag는 기본false;955bf8c기준은 기존 값을 유지한다. 새 키/비즈니스 가입/유료 기능은 필요하지 않다.
4. USER 배포 후 에이전트가 실제 URL을 재검증한다. 신규 UI는 KST 기간, 미정/현금/제품/혼합 제공, 여러 산출물과 사용권/독점 조건을 저장한다. 기존 v1 캠페인은 날짜/보상을 채우지 않고 표시하며 opt-in 업그레이드한다. v2의 조건을 누락하는 오래된 편집 요청은422로 거부한다.

정지/복구:03_pause.sql 및 앱 플래그off로 새 외부 작업을 중지할 수 있다. 이번 작업은 외부 worker/공급자를 실행하지 않았다. 조건/감사 기록을 DROP하거나 MFA를 해제하지 않는다. UI 문제 시 캠페인 편집을 중지하고 보존된 데이터와 적용 이력으로 개발자가 forward fix를 준비한다. 코드 롤백도 조건을 소거하지 못하며 USER가 검토한다.

이 검증은 격리 실제 로컬 Auth/DB와 명시적 fixture다. 실제 공급자/배포/전체 P0 완료가 아니다. D076의 가입·로그인 신뢰IP/계정 및 기존 카탈로그 검색은 미완료. 상세 증빙: harness/evidence/DEV-A-CONTINUE-20261120B/.
""",encoding='utf-8')

paths = subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'], cwd=ROOT).decode().split('\0')
selected = []
for relative in sorted(set(filter(None, paths))):
    path = ROOT / relative
    if relative.startswith(('deliverables/','dev-a-local/','output/','.git/')):
        continue
    if relative.startswith('harness/evidence/') and not (
        relative.startswith(('harness/evidence/DEV-A-CONTINUE-20261120B/','harness/evidence/DEV-A-MAIN-20261120/')) or path.name=='README.md'):
        continue
    if (path.name.startswith('.env') and path.name!='.env.example') or path.name.startswith('.accounts') or path.suffix in ('.key','.pem','.log','.zip'):
        continue
    if path.is_file() and not path.is_symlink() and path.resolve().is_relative_to(ROOT):
        selected.append(relative)
manifest = dict(source_head=subprocess.check_output(['git','rev-parse','HEAD'], cwd=ROOT).decode().strip(),
                upstream_main='65063c8', scope='local reviewed source and USER-only console migrations; no deployment',
                migrations=records, files=[dict(path=p,sha256=hash_bytes((ROOT/p).read_bytes())) for p in selected])
(TARGET/'MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
archive = TARGET.parent/'AD-Me_DEV-A_TERMS_20261120_review.zip'
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
