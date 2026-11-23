"""Create a secret-free source snapshot and console-ready SQL; never push or deploy."""
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

root = Path(__file__).resolve().parents[1]
target = root / "deliverables/dev-a-p0-20261119"
apply_dir = target / "user-apply"
apply_dir.mkdir(parents=True, exist_ok=True)
hash_bytes = lambda data: hashlib.sha256(data).hexdigest()
migrations = []
for version, name in [("202611190004", "admin_security"), ("202611190005", "moderation_locks"),
                      ("202611190006", "brand_profiles"), ("202611190007", "brand_projection")]:
    path = root / f"supabase/migrations/{version}_{name}.sql"
    data = path.read_bytes()
    body = data.decode("utf-8")
    digest = hash_bytes(data)
    marker = "$adme_packet_migration$"
    assert marker not in body
    history = (f"insert into supabase_migrations.schema_migrations(version,name,statements) values "
               f"('{version}','{name}',array[{marker}{body}{marker}]);\n")
    assert body.rstrip().lower().endswith("commit;")
    index = body.lower().rfind("commit;")
    prepared = f"-- Source SHA-256: {digest}\n" + body[:index] + history + body[index:]
    filename = f"{version}_{name}.sql"
    (apply_dir / filename).write_text(prepared, encoding="utf-8", newline="\n")
    migrations.append({"version": version, "name": name, "source": path.relative_to(root).as_posix(),
                       "source_sha256": digest, "apply_file": f"user-apply/{filename}",
                       "apply_sha256": hash_bytes(prepared.encode())})
preflight = """-- USER console read/check only. No secrets or personal account fields.
select version,name from supabase_migrations.schema_migrations order by version;
select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' order by c.relname;
do $$ begin
  if to_regclass('public.profiles') is null or to_regclass('public.creators') is null
     or to_regprocedure('public.valid_campaign_dto(jsonb)') is null
     or to_regprocedure('public.moderate_entity(text,text,boolean)') is null then
    raise exception 'STOP: expected core/operations/JSON baseline is missing';
  end if;
  if to_regclass('public.administrator_grants') is not null or to_regclass('public.brand_profiles') is not null
     or exists(select 1 from supabase_migrations.schema_migrations where version in ('202611190004','202611190005','202611190006','202611190007')) then
    raise exception 'STOP: target changes exist; developer must inspect partial/already-applied state';
  end if;
end $$;
"""
(apply_dir / "00_preflight.sql").write_text(preflight, encoding="utf-8")
(apply_dir / "01_apply_all.sql").write_text("-- Apply only after 00_preflight.sql succeeds. Stop at the first SQL error.\n" +
    "\n".join((target / m["apply_file"]).read_text(encoding="utf-8") for m in migrations), encoding="utf-8", newline="\n")
(apply_dir / "02_verify.sql").write_text("""-- Read-only structural check. A USER application result is not pre-filled.
select version,name from supabase_migrations.schema_migrations
where version in ('202611190004','202611190005','202611190006','202611190007') order by version;
select relname,relrowsecurity from pg_class where oid in
('public.administrator_grants'::regclass,'public.moderation_events'::regclass,'public.brand_profiles'::regclass,'public.brand_contacts'::regclass);
select has_function_privilege('anon','public.provision_administrator(uuid,text,timestamptz)','execute') as anon_provision,
has_function_privilege('authenticated','public.provision_administrator(uuid,text,timestamptz)','execute') as member_provision,
has_function_privilege('service_role','public.provision_administrator(uuid,text,timestamptz)','execute') as service_provision;
-- Expected: 4 migration rows, 4 RLS=true rows, and 3 privilege=false values.
""", encoding="utf-8")
helper = """<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AD Me 콘솔 적용 도우미</title>
<style>body{max-width:760px;margin:40px auto;padding:20px;background:#f5f5f0;color:#111312;font-family:system-ui}label{display:block;margin:18px 0}input,select,textarea,button{font:inherit;padding:10px;box-sizing:border-box}input,textarea{width:100%}button{background:#d7ff45;border:1px solid #111312;cursor:pointer}textarea{min-height:170px;margin-top:20px}</style>
<h1>관리자 승인·철회 SQL 준비</h1><p>이 파일은 오프라인으로 입력값을 SQL로 변환합니다. 계정 접속·외부 통신·SQL 실행을 하지 않습니다. 대상 계정 본인 확인과 승인 판단은 사용자 담당입니다. 먼저 제공된 004~007 마이그레이션과 TOTP 설정을 적용하세요.</p>
<form id="form"><label>작업 <select id="action"><option value="grant">유효 기간을 정해 승인</option><option value="revoke">승인 철회</option></select></label><label>확정한 운영자 계정 UUID<input id="user" required pattern="[0-9a-fA-F-]{36}" autocomplete="off"></label><label>승인 문서·접수 참조 (5~300자)<input id="reference" minlength="5" maxlength="300"></label><label>승인 유효 일수 (1~90일)<input id="days" type="number" min="1" max="90" step="1" value="30"></label><button>검토할 SQL 만들기</button></form>
<label>선택한 QA/운영 대상 콘솔에서 검토할 SQL<textarea id="sql" readonly></textarea></label><p id="status" role="status"></p><p>비밀번호·API 키·OTP·메일 증표를 이 양식에 입력하지 마세요. 실제 적용 결과와 UUID 등 개인 식별 자료는 공개 증빙에 포함하지 않습니다.</p>
<script>document.querySelector('#form').addEventListener('submit',function(event){event.preventDefault();const id=document.querySelector('#user').value.trim();const reference=document.querySelector('#reference').value.trim();const days=Number(document.querySelector('#days').value);const action=document.querySelector('#action').value;const status=document.querySelector('#status');if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)){status.textContent='유효한 UUID를 입력해주세요.';return;}if(action==='grant'&&(!(reference.length>=5&&reference.length<=300)||!Number.isInteger(days)||days<1||days>90)){status.textContent='승인 참조와 유효 일수를 확인해주세요.';return;}document.querySelector('#sql').value=action==='revoke'?"select public.revoke_administrator('"+id+"'::uuid);":"select public.provision_administrator('"+id+"'::uuid, '"+reference.replaceAll("'","''")+"', '"+new Date(Date.now()+days*86400000).toISOString()+"'::timestamptz);";status.textContent='실행하지 않았습니다. 대상 환경과 계정을 확인한 뒤 SQL Editor에 그대로 복사해 적용하세요.';});</script></html>"""
(target / "console-actions.html").write_text(helper, encoding="utf-8")
(target / "README_KO.md").write_text("""# DEV-A P0 검토·사용자 적용 자료

전체 실제 데이터 베타 NO-GO. 이번 로컬 소스/SQL은 DEV-B 교차 리뷰 및 격리 QA 적용용입니다. 실제 계정 설정·키 발급/등록·push/배포를 실행하지 않았습니다.

- 상세 구현·검증·남은 조건: source/docs/handoff/DEV-A_P0_CONTINUATION_PACKET.md
- 실제 실행 증빙: source/harness/evidence/DEV-A-P0-CONTINUE/verification.json
- 콘솔 적용: user-apply/00_preflight.sql → 01_apply_all.sql (또는 번호별 파일) → 02_verify.sql. 오류가 있으면 다음 단계를 중단합니다.
- 관리자 승인/철회: console-actions.html을 브라우저로 열고 사용자가 결정한 계정·승인 참조·기한을 입력하면 SQL이 자동 생성됩니다. 외부 통신이나 실행은 하지 않습니다.
- MANIFEST.json은 누적 미커밋 소스와 SQL의 해시 목록입니다. 과거 변경도 포함하며 전부 이번 세션 신규 구현으로 주장하지 않습니다.

사용자에게 터미널/설치/수동 소스 편집을 요구하지 않습니다. 개발 담당이 통합 소스를 준비하고, 조율된 릴리스 시점에 사용자가 외부 적용·배포합니다. 로컬 TLS/계정/키/메일 원문/trace/외부 provider 증거 원문은 포함하지 않습니다. 로고 업로드와 전체 수집·삭제·동의·환경 격리 등 남은 P0는 미완료입니다.
""", encoding="utf-8")
paths = subprocess.check_output(["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"], cwd=root).decode().split("\0")
selected = []
for relative in sorted(set(filter(None, paths))):
    path = root / relative
    if relative.startswith(("deliverables/", "dev-a-local/", "output/", ".git/")):
        continue
    if relative.startswith("harness/evidence/") and not relative.startswith("harness/evidence/DEV-A-P0-CONTINUE/"):
        continue
    if (path.name.startswith(".env") and path.name != ".env.example") or path.name.startswith(".accounts") or path.suffix in (".key", ".pem", ".log", ".zip"):
        continue
    if path.is_file() and path.resolve().is_relative_to(root) and not path.is_symlink():
        selected.append(relative)
manifest = {"baseline_head": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root).decode().strip(),
    "branch": subprocess.check_output(["git", "branch", "--show-current"], cwd=root).decode().strip(),
    "scope": "Accumulated uncommitted source, local evidence, console SQL. No deployment or launch claim.",
    "migrations": migrations, "files": [{"path": relative, "sha256": hash_bytes((root / relative).read_bytes())} for relative in selected]}
(target / "MANIFEST.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
archive = target.parent / "AD-Me_DEV-A_P0_20261119_review.zip"
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as bundle:
    for relative in selected:
        bundle.write(root / relative, "source/" + relative)
    for path in target.rglob("*"):
        if path.is_file() and path.name != "DELIVERY.json":
            bundle.write(path, path.relative_to(target).as_posix())
with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    assert not any("runtime.local" in name or "accounts.local" in name or "tls.local" in name or name.endswith(".env.local") for name in bundle.namelist())
delivery = {"archive": archive.relative_to(root).as_posix(), "sha256": hash_bytes(archive.read_bytes()), "bytes": archive.stat().st_size,
            "source_files": len(selected), "migrations": 4, "external_applied": False}
(target / "DELIVERY.json").write_text(json.dumps(delivery, indent=2) + "\n", encoding="utf-8")
print(json.dumps(delivery))
