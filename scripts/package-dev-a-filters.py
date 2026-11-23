"""Immutable source review packet; reuse already verified SQL bytes without a new migration."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'deliverables/dev-a-filters-20261120'
ARCHIVE = TARGET.parent / 'AD-Me_DEV-A_FILTERS_20261120_review.zip'
assert not ARCHIVE.exists(), 'Existing packet is immutable; use a new versioned target'
SQL_SOURCE = ROOT / 'deliverables/dev-a-schema-20261120/user-apply'
(TARGET / 'user-apply').mkdir(parents=True, exist_ok=True)
sha = lambda value: hashlib.sha256(value).hexdigest()
sql_files = []
for source in sorted(SQL_SOURCE.glob('*.sql')):
    destination = TARGET / 'user-apply' / source.name
    shutil.copyfile(source, destination)
    assert source.read_bytes() == destination.read_bytes()
    sql_files.append(dict(path='user-apply/'+source.name, sha256=sha(source.read_bytes()),
                          tested_source=source.relative_to(ROOT).as_posix()))
(TARGET / 'README_KO.md').write_text("""# DEV-A 지시서 검토·필터·공개 앱 DTO — 2026-11-20D

로컬 검토 산출물이다. USER가 외부 콘솔/계정/배포를 수행한다. 코드 편집·터미널 실행·패키지 설치를 요구하지 않는다. 이전 ZIP4개는 그대로 보존했다.

1. 이번 변경에는 새 migration이 없다. 이미 이전 SCHEMA 패킷의19개까지 적용됐으면 SQL을 반복 적용하지 않고02_verify.sql의 읽기 전용 검증만 한다. 현재 DB가 무엇인지 모르면 에이전트가 실제 이력을 확인해 적용안을 준비한다.
2. main8 / integrated12 / previous16 / terms18 기준이라면 이전 SCHEMA 패킷에서 네 가지 실제 로컬 적용 검증을 마친 SQL을 **바이트 그대로 복사**해 제공한다. 현재 이력에 맞는00_preflight와01_apply만 사용한다. 다른/부분/알 수 없는 기준이면 중단하고 결과를 에이전트에게 전달한다. 임의 SQL 수정이나 재실행을 요구하지 않는다. 전체19개, 세 private RLS 테이블과 권한을02_verify로 확인한다.
3. source에는 다중 OR/AND 필터·URL restore/back/forward/reset·0/결측·범위 오류·안정 정렬과 공개 앱 DTO allowlist가 포함된다. actual owner-registration 지표는 미확보(null)이며 DEMO만 가상 수치다. 클라이언트에 raw profile/owner_id/owner_consent/연락처/OAuth/내부 메모를 전달하지 않는다. D033 취소/늦은 응답 계약은 독립 테스트이며 실제 서버 검색 연결 완료가 아니다.
4. **출시 차단 유지:** 기존 직접 REST published creators 읽기의 owner_id/raw JSON, user-<Auth UUID> legacy 주소는 별도 D018/D033/D075 read/opaque-ID 이관이 필요하다. 앱 DTO 보수만으로 전 경로 노출을 막았다고 주장하지 않는다. D017 정책/수집 계약·기타 P0/USER 게이트와 대상 환경/교차 리뷰도 미완료다. 이 패킷을 실제 제공자 검증 또는 실서비스 준비 완료로 해석하지 않는다.

복구: 이번 변경은 DB를 바꾸지 않는다. 문제가 생기면 공개 화면 적용을 중단하고 에이전트가 forward fix를 준비한다. 원본 JSON/identity/관측/migration 이력을 삭제하거나 보수 전 raw JSON 공개 경로로 단순 롤백하지 않는다. 기존03_pause_snapshot.sql은 선택적으로 새 본인 snapshot만 중단하며 검색이나 전체 DB 권한 문제를 해결하는 SQL이 아니다. 새 API 키/유료 기능/실제 결제가 필요하지 않다.

검토 보고서 docs/handoff/DEV-A_DOCUMENT_AUDIT_20261120.md, 상세 결과 harness/evidence/DEV-A-FILTERS-20261120/verification.json. source_head 이후 산출물 커밋은 ZIP/SQL 복사/메타데이터이며 소스 기준을 별도로 명시한다.
""", encoding='utf-8')
if '--prepare-only' in sys.argv:
    print('Prepared review instructions and byte-identical previously tested SQL; no source archive yet.')
    sys.exit(0)

head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT).decode().strip()
paths = subprocess.check_output(['git', 'ls-tree', '-rz', '--name-only', head], cwd=ROOT).decode().split('\0')
contents = {}
for relative in filter(None, paths):
    path = Path(relative)
    if relative.startswith(('deliverables/', 'output/', 'dev-a-local/')):
        continue
    if relative.startswith('harness/evidence/') and path.name != 'README.md' and not relative.startswith(('harness/evidence/D018/', 'harness/evidence/D034/', 'harness/evidence/DEV-A-FILTERS-20261120/', 'harness/evidence/DEV-A-DOCUMENT-AUDIT-20261120/')):
        continue
    if (path.name.startswith('.env') and path.name != '.env.example') or path.name.startswith('.accounts') or path.suffix in ('.key', '.pem', '.log', '.zip'):
        continue
    contents[relative] = subprocess.check_output(['git', 'show', f'{head}:{relative}'], cwd=ROOT)
manifest = dict(source_head=head, branch='codex/dev-a-p0-continue', upstream_main='65063c8',
                scope='local document audit/filter/app projection; no new SQL/provider approval/deployment',
                new_migrations=0, migration_count=19, sql_files=sql_files,
                previous_verified_sql_receipts=[f'harness/evidence/D018/packet-{label}-20261120.json' for label in ('main_8', 'integrated_12', 'previous_16', 'terms_18')],
                files=[dict(path=p, sha256=sha(value)) for p, value in contents.items()])
(TARGET / 'MANIFEST.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
with zipfile.ZipFile(ARCHIVE, 'w', zipfile.ZIP_DEFLATED) as bundle:
    for path, value in contents.items(): bundle.writestr('source/'+path, value)
    for path in TARGET.rglob('*'):
        if path.is_file() and path.name != 'DELIVERY.json': bundle.write(path, path.relative_to(TARGET).as_posix())
with zipfile.ZipFile(ARCHIVE) as bundle:
    assert bundle.testzip() is None
    for path, value in contents.items(): assert sha(bundle.read('source/'+path)) == sha(value)
    assert not any('runtime.local' in n or 'accounts.local' in n or 'tls.local' in n or n.endswith('.env.local') for n in bundle.namelist())
delivery = dict(archive=ARCHIVE.relative_to(ROOT).as_posix(), sha256=sha(ARCHIVE.read_bytes()),
                bytes=ARCHIVE.stat().st_size, source_files=len(contents), source_head=head,
                new_migrations=0, external_applied=False)
(TARGET / 'DELIVERY.json').write_text(json.dumps(delivery, indent=2)+'\n', encoding='utf-8')
print(json.dumps(delivery))
