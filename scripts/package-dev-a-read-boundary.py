"""Atomic old-code-compatible expansion, followed by owner-only one-way activation."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'deliverables/dev-a-read-boundary-20261120'
ARCHIVE = TARGET.parent / 'AD-Me_DEV-A_READ_BOUNDARY_20261120_review.zip'
assert not ARCHIVE.exists(), 'Existing packet is immutable'
SQL = TARGET / 'user-apply'
SQL.mkdir(parents=True, exist_ok=True)
OLD = ROOT / 'deliverables/dev-a-filters-20261120/user-apply'
sha = lambda b: hashlib.sha256(b).hexdigest()
paths = sorted((ROOT / 'supabase/migrations').glob('*.sql'))
required = [p.stem.split('_', 1)[0] for p in paths if p.stem.split('_', 1)[0] < '202611200014']
assert len(required) == 19
versions = ','.join("'"+v+"'" for v in required)
gate = f"""set local search_path=public,pg_catalog;
do $gate$ begin
 if (select count(*) from supabase_migrations.schema_migrations)<>{len(required)}
    or exists(select 1 from supabase_migrations.schema_migrations where version not in ({versions}))
    or to_regclass('adme_creator.read_boundary') is not null
    or to_regprocedure('public.creator_catalog_page(text,integer)') is not null then
   raise exception 'STOP: unsupported, partial or updated baseline; agent must inspect'; end if;
 if not has_table_privilege('anon','public.creators','select')
    or (select count(*) from pg_policy where polrelid='public.creators'::regclass and polcmd in ('r','*'))<>1
    or not exists(select 1 from pg_policy where polrelid='public.creators'::regclass and polname='creators_read'
      and polroles='{{0}}'::oid[] and md5(pg_get_expr(polqual,polrelid))='126eaf6938f7be842702b67048e0c867') then
   raise exception 'STOP: custom/hardened read policy must never be reopened by staging'; end if;
 if exists(select 1 from public.creators where length(id) not between 1 and 100)
    or (select count(*) from public.creators where published and moderation_status='allowed')>1000 then
   raise exception 'STOP: legacy IDs or catalog size require a reviewed compatibility/search migration'; end if;
end $gate$;
"""
body = "begin;\nset local lock_timeout='5s';\nselect pg_advisory_xact_lock(hashtext('adme-creator-boundary'));\n"+gate+"set local adme.creator_boundary_staging='on';\n"
records = []
for version in ('202611200014', '202611200015', '202611200016', '202611200017'):
    path, = (ROOT / 'supabase/migrations').glob(version+'_*.sql')
    source = path.read_text(encoding='utf-8')
    start, end = source.lower().find('begin;'), source.lower().rfind('commit;')
    assert start >= 0 and end > start
    marker = '$boundary_source$'
    assert marker not in source
    body += source[:start]+source[start+len('begin;'):end]
    name = path.stem.split('_',1)[1]
    body += f"\ninsert into supabase_migrations.schema_migrations(version,name,statements) values('{version}','{name}',array[{marker}{source}{marker}]);\n"
    records.append(dict(source=path.relative_to(ROOT).as_posix(), sha256_lf=sha(source.encode()), version=version))
body += 'commit;\n'
(SQL / '00_preflight_current_19.sql').write_text('begin;\n'+gate+'rollback;\n',encoding='utf-8')
(SQL / '01_stage_current_19.sql').write_text(body,encoding='utf-8')
for variant in ('main_8','integrated_12','previous_16','terms_18'):
    prefix = (OLD/f'01_apply_{variant}.sql').read_bytes()
    (SQL/f'01_stage_{variant}.sql').write_bytes(prefix+b'\n'+body.encode())
    (SQL/f'00_preflight_{variant}.sql').write_bytes((OLD/f'00_preflight_{variant}.sql').read_bytes())
(SQL / '02_verify.sql').write_text("""-- DB owner, read-only. Expected23 migrations and staging enabled=false.
select version,name from supabase_migrations.schema_migrations order by version;
select enabled,activated_at,release_ref from adme_creator.read_boundary;
select has_table_privilege('anon','public.creators','select') as legacy_anon_select;
-- Before activation: true, exactly the old19 behavior. After activation: false.
select proname,prosecdef,provolatile from pg_proc where oid in ('public.creator_catalog_page(text,integer)'::regprocedure,'public.create_creator_proposal(uuid,text,text,text)'::regprocedure);
-- Both security invoker; catalog volatile. Safe public RPC works in either phase.
select jsonb_array_length(public.creator_catalog_page('',1)->'items') as safe_public_sample;
""",encoding='utf-8')
(TARGET / 'README_KO.md').write_text("""# DEV-A 공개 읽기 경계·호환 적용 — 2026-11-20E

USER가 외부 콘솔·배포를 수행한다. 개발자가 소스/SQL/테스트를 준비했으며 터미널·코드 편집·설치를 요구하지 않는다. 기존 ZIP5개와 SQL19개는 보존했다. 새014~017 네 migration을 추가한다.

1. 에이전트가 현재 이력/정책을 읽어 기준을 확인한다. 현재19이면 current_19, 기존8/12/16/18이면 각각 main_8/integrated_12/previous_16/terms_18의00_preflight를 SQL Editor에서 실행한다.20/21/22/이미23/사용자가 따로 강화한 정책은 자동 staging하지 않고 중단한다. 권한을 재개방하지 않도록 원래 정책 hash/anon grant도 검사한다.
2. 맞는01_stage 파일 전체를 SQL Editor에서 실행한다.014~017은 하나의 트랜잭션과 잠금 제한으로 적용되며 enabled=false 상태에서 기존19의 읽기 권한을 유지한다. 따라서 이 단계의 구버전 페이지를 갑자기 막지 않는다. 이 상태는 아직 원본 공개 읽기가 유지되므로 보안 완료가 아니다. 부분 실패 시 반복/수정하지 말고 에이전트가 상태를 읽어 복구안을 준비한다.
3. 새 source를 검토하고 USER가 적용한다. 에이전트가 실제 URL의 공개 목록/기존 프로필 주소/즐겨찾기/CSV/제안/지원/관리자·본인 설정을 검증한 후03_activate.sql을 SQL Editor에서 실행한다. 실제 소스 commit reference가 파일에 들어 있으므로 소스 편집이 필요 없다.23개 이력과 enabled=true/원본 anon SELECT=false를02_verify로 재확인한다.
4. 활성화는 owner SQL 전용이며 앱·서비스 role·관리자 JWT에는 권한이 없다. 한 번 켜면 false/삭제/activation 증거 변경을 거부한다. 문제가 생기면 공개 진입을 중단하고 forward fix하며 raw JSON 공개 권한을 다시 열거나 MFA/기존 데이터/이력을 삭제하지 않는다.

원본 테이블은 본인/승인 MFA 관리자만 읽고 공개 RPC/HOT/saved는 allowlist를 반환한다. 제안은 기존 API 입력/ID/201응답을 유지하는 원자 RPC이며 기존 직접 INSERT의 역할/실제 소유자 RLS도 유지한다. 원본 ID/FK/JSON/기존 링크를 변경하지 않았다. user-AuthUUID 공개 주소의 opaque-ID 이관, D033 실제 server search, 정책/수집·전체 권한/Storage/테넌트 검토는 여전히 미완료다.

직접 source migration/CLI 적용은 기본 strict이다. 이 패킷의 검증된 옛19 대상 atomic stage만 기존 읽기를 잠시 유지한다. 이미 strict인 DB의 경계를 끄는 패킷이 아니다. source_head 이후 전달 커밋은 산출물/메타데이터다. 실제 provider/결제/배포 검증을 fixture 통과로 주장하지 않는다.
""",encoding='utf-8')
if '--prepare-only' in sys.argv:
    (SQL/'03_activate.sql').write_text('-- Generated only after the reviewed source commit. Not ready for external execution.\n',encoding='utf-8')
    print('Prepared atomic staging SQL; release activation will be generated after source commit.')
    sys.exit(0)
head = subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT).decode().strip()
(SQL/'03_activate.sql').write_text("-- USER runs only after actual source URL/workflows are verified.\nbegin;\ndo $$ begin if (select count(*) from supabase_migrations.schema_migrations)<>23 then raise exception 'STOP: expected23 application migrations'; end if; end $$;\n"+f"select adme_creator.activate_read_boundary('{head}');\ncommit;\n",encoding='utf-8')
contents = {}
for name in subprocess.check_output(['git','ls-tree','-rz','--name-only',head],cwd=ROOT).decode().split('\0'):
    if not name or name.startswith(('deliverables/','output/','dev-a-local/')): continue
    p=Path(name)
    if name.startswith('harness/evidence/') and p.name!='README.md' and not name.startswith(('harness/evidence/D075/','harness/evidence/D076/','harness/evidence/DEV-A-READ-20261120/')): continue
    if (p.name.startswith('.env') and p.name!='.env.example') or p.name.startswith('.accounts') or p.suffix in ('.key','.pem','.log','.zip'): continue
    contents[name]=subprocess.check_output(['git','show',f'{head}:{name}'],cwd=ROOT)
manifest=dict(source_head=head,branch='codex/dev-a-p0-continue',new_migrations=records,migration_count=23,activation='USER after actual source verification; staging is not security completion',files=[dict(path=p,sha256=sha(v)) for p,v in contents.items()])
(TARGET/'MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
with zipfile.ZipFile(ARCHIVE,'w',zipfile.ZIP_DEFLATED) as z:
    for p,v in contents.items(): z.writestr('source/'+p,v)
    for p in TARGET.rglob('*'):
        if p.is_file() and p.name!='DELIVERY.json': z.write(p,p.relative_to(TARGET).as_posix())
with zipfile.ZipFile(ARCHIVE) as z: assert z.testzip() is None
delivery=dict(archive=ARCHIVE.relative_to(ROOT).as_posix(),sha256=sha(ARCHIVE.read_bytes()),bytes=ARCHIVE.stat().st_size,source_files=len(contents),source_head=head,external_applied=False)
(TARGET/'DELIVERY.json').write_text(json.dumps(delivery,indent=2)+'\n',encoding='utf-8'); print(json.dumps(delivery))
