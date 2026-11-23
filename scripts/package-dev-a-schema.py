"""D018 dated source/SQL packet. Never rewrites previous delivery archives."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'deliverables/dev-a-schema-20261120'
archive = TARGET.parent / 'AD-Me_DEV-A_SCHEMA_20261120_review.zip'
assert not archive.exists(), 'Existing packet is immutable; use a new versioned target'
SQL = TARGET / 'user-apply'
SQL.mkdir(parents=True, exist_ok=True)
BASE = ['202611190001', '202611190002', '202611190003', '202611200001',
        '202611200002', '202611200003', '202611200004', '202611200005']
OLD = ['202611190004', '202611190005', '202611190006', '202611190007']
PREVIOUS = ['202611200006', '202611200007', '202611200008', '202611200010']
TERMS = ['202611200011', '202611200012']
NEW = ['202611200013']
VARIANTS = {
    'main_8': (BASE, OLD + PREVIOUS + TERMS + NEW),
    'integrated_12': (BASE + OLD, PREVIOUS + TERMS + NEW),
    'previous_16': (BASE + OLD + PREVIOUS, TERMS + NEW),
    'terms_18': (BASE + OLD + PREVIOUS + TERMS, NEW),
}
sha = lambda content: hashlib.sha256(content).hexdigest()
records = []
for version in OLD + PREVIOUS + TERMS + NEW:
    path, = (ROOT / 'supabase/migrations').glob(version + '_*.sql')
    body = path.read_text(encoding='utf-8')
    assert body.rstrip().lower().endswith('commit;')
    marker = '$adme_schema_packet$'
    assert marker not in body
    name = path.stem.split('_', 1)[1]
    history = ("insert into supabase_migrations.schema_migrations(version,name,statements) values "
               f"('{version}','{name}',array[{marker}{body}{marker}]);\n")
    at = body.lower().rfind('commit;')
    prepared = f'-- Source SHA-256 (UTF-8, LF): {sha(body.encode("utf-8"))}\n' + body[:at] + history + body[at:]
    (SQL / path.name).write_text(prepared, encoding='utf-8', newline='\n')
    records.append(dict(version=version, name=name, source=path.relative_to(ROOT).as_posix(),
                        sha256_lf=sha(body.encode('utf-8')), apply_file=path.name))


def preflight(required):
    versions = ','.join("'" + v + "'" for v in required)
    return f"""-- USER console only. Never force past an unexpected/partial baseline.
do $preflight$ begin
  if to_regclass('supabase_migrations.schema_migrations') is null
     or to_regprocedure('public.ops_draft_get(uuid)') is null
     or to_regprocedure('adme_ops.ops_draft_get(uuid)') is null then
    raise exception 'STOP: supported main schema missing; agent must inspect';
  end if;
  if (select count(*) from supabase_migrations.schema_migrations where version in ({versions}))<>{len(required)}
     or exists(select 1 from supabase_migrations.schema_migrations where version not in ({versions}))
     or to_regnamespace('adme_creator') is not null then
    raise exception 'STOP: wrong, partial, unknown or already updated baseline; do not force SQL';
  end if;
  if (select prosecdef from pg_proc where oid='public.ops_draft_get(uuid)'::regprocedure) then
    raise exception 'STOP: expected public-invoker/private-implementation boundary missing';
  end if;
end $preflight$;
"""


for label, (required, pending) in VARIANTS.items():
    gate = preflight(required)
    (SQL / f'00_preflight_{label}.sql').write_text(gate, encoding='utf-8')
    body = gate + '\n' + '\n'.join((SQL / r['apply_file']).read_text(encoding='utf-8')
                                   for r in records if r['version'] in pending)
    (SQL / f'01_apply_{label}.sql').write_text(body, encoding='utf-8', newline='\n')

(SQL / '02_verify.sql').write_text("""-- Read-only. Expected: 19 application migrations; mappings cover every legacy row.
select version,name from supabase_migrations.schema_migrations order by version;
select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='adme_creator' and c.relkind='r' order by c.relname;
-- Three tables, all RLS true. No fabricated identities or observations are inserted.
select count(*) as missing_legacy_mapping from public.creators c left join adme_creator.records r on r.legacy_creator_id=c.id where r.id is null;
select has_table_privilege('anon','adme_creator.identities','select') as anon_read,
  has_table_privilege('authenticated','adme_creator.identities','insert') as client_write,
  has_table_privilege('service_role','adme_creator.identities','select') as service_read,
  has_function_privilege('anon','public.my_creator_identity_snapshot()','execute') as anon_rpc;
-- All false. Snapshot wrapper must be security invoker; only authenticated owner can read own snapshot.
select prosecdef from pg_proc where oid='public.my_creator_identity_snapshot()'::regprocedure;
""", encoding='utf-8')
(SQL / '03_pause_snapshot.sql').write_text("""-- Optional USER containment: stop the new owner-only snapshot without deleting data.
revoke execute on function public.my_creator_identity_snapshot() from authenticated;
revoke execute on function adme_creator.my_snapshot() from authenticated;
-- Existing catalog uses the original DTO. Retain tables, triggers and history for forward fix.
""", encoding='utf-8')
(TARGET / 'README_KO.md').write_text("""# DEV-A 정규화 저장소 1단계 — 2026-11-20C

로컬 검토 산출물이다. USER가 대상·백업·릴리스 시점을 확인하고 SQL Editor와 배포 콘솔을 사용한다. 키 발급/등록, 터미널 실행, 코드 수정은 필요하지 않다. 이전 ZIP3개는 변경하지 않았다.

1. 현재 migration 이력을 에이전트가 읽어 선택한 기준을 사용한다. main65063c8만 적용됐으면 main_8(11개 추가), 초기DEV-A4개+main이면 integrated_12(7개), 직전955bf8c 패킷이면 previous_16(3개), TERMS 패킷까지면 terms_18(1개)이다. 해당00_preflight를 SQL Editor에서 실행한다. 알 수 없는/부분 적용/중복 기준이면 중단하고 결과를 에이전트에게 전달한다.
2. 성공한 기준의01_apply 파일 전체를 실행한다. preflight와 각 migration별 트랜잭션/이력 기록을 포함한다. 중간 실패 시 반복 실행하거나 SQL을 직접 고치지 않는다. 에이전트가 실제 상태에 맞춰 복구안을 준비한다.
3.02_verify로 전체19개, 신규013, 세 테이블 RLS=true, missing_legacy_mapping=0, 권한 네 값=false, 공개 wrapper prosecdef=false를 확인한다. 18개 기준은 기존 feature flags를 유지하고, main/12개 기준은 이전 패킷과 같이 provider 기본OFF다.
4. 이번 단계는 legacy JSON을 그대로 두고 내부 UUID 연결만 backfill한다. 가상48개에서 SNS ID·지표·동의·정책 승인을 발명하지 않는다. 현재 운영 YouTube 저장소도 자동 복사하지 않는다. 새 snapshot은 본인 전용이며 공개 catalog/매칭 read source는 바꾸지 않는다.

D017 정책 승인·허용 필드/보존/재배포 계약, D019 실제 수집 write adapter, 공개 read switch와 DEV-B 교차 리뷰는 미완료다. 이 패킷을 적용해도 실제 공급자 검증이나 D018 DONE이 아니다. 원래 JSON과 정규화 관측을 분리하는 TypeScript 호환 adapter를 제공하며 결측을0이나 가상followers로 채우지 않는다.

복구: 새 snapshot만 중단하려면03_pause_snapshot.sql을 사용한다. 원본 JSON·identity·지표·migration 이력은 삭제하지 않는다. 원래 catalog 동작은 유지된다. 데이터 형식/권한 문제가 있으면 USER가 외부 적용을 중단하고 개발자가 additive forward fix를 준비한다. 배포 후 실제 URL 확인도 개발자가 수행한다. 실제 외부 콘솔/키/배포는 이번 로컬 검증에 포함하지 않았다.
""", encoding='utf-8')

if '--sql-only' in sys.argv:
    print('Prepared SQL for four exact baselines; no archive created.')
    sys.exit(0)

# Capture committed Git bytes, avoiding local CRLF conversions and private/untracked files.
head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT).decode().strip()
paths = subprocess.check_output(['git', 'ls-tree', '-rz', '--name-only', head], cwd=ROOT).decode().split('\0')
selected = []
for relative in filter(None, paths):
    path = Path(relative)
    if relative.startswith(('deliverables/', 'dev-a-local/', 'output/')):
        continue
    if relative.startswith('harness/evidence/') and path.name != 'README.md' and not relative.startswith(('harness/evidence/D018/', 'harness/evidence/DEV-A-SCHEMA-20261120/')):
        continue
    if (path.name.startswith('.env') and path.name != '.env.example') or path.name.startswith('.accounts') or path.suffix in ('.key', '.pem', '.log', '.zip'):
        continue
    selected.append(relative)
contents = {p: subprocess.check_output(['git', 'show', f'{head}:{p}'], cwd=ROOT) for p in selected}
for record in records:
    working = (ROOT / record['source']).read_text(encoding='utf-8').replace('\r\n', '\n')
    assert working == contents[record['source']].decode().replace('\r\n', '\n'), 'Uncommitted SQL refused'
manifest = dict(source_head=head, branch='codex/dev-a-p0-continue', upstream_main='65063c8',
                scope='local schema stage 1; no provider approval, public read switch or deployment',
                variants={k: dict(required=required, pending=pending) for k, (required, pending) in VARIANTS.items()},
                migrations=records, files=[dict(path=p, sha256=sha(contents[p])) for p in selected])
(TARGET / 'MANIFEST.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
    for p in selected:
        bundle.writestr('source/'+p, contents[p])
    for path in TARGET.rglob('*'):
        if path.is_file() and path.name != 'DELIVERY.json':
            bundle.write(path, path.relative_to(TARGET).as_posix())
with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    for p in selected:
        assert sha(bundle.read('source/'+p)) == sha(contents[p])
    assert not any('runtime.local' in n or 'accounts.local' in n or 'tls.local' in n or n.endswith('.env.local') for n in bundle.namelist())
delivery = dict(archive=archive.relative_to(ROOT).as_posix(), sha256=sha(archive.read_bytes()),
                bytes=archive.stat().st_size, source_files=len(selected), source_head=head, external_applied=False)
(TARGET / 'DELIVERY.json').write_text(json.dumps(delivery, indent=2)+'\n', encoding='utf-8')
print(json.dumps(delivery))
