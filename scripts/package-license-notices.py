"""Ship existing exact notices without replacing old evidence or inventing missing rights."""
from pathlib import Path
import hashlib,json,subprocess
ROOT=Path(__file__).resolve().parents[1];TARGET=ROOT/'docs/licenses/20261121-shipping';TARGET.mkdir(parents=True,exist_ok=True)
sources=[ROOT/'docs/licenses/THIRD_PARTY_NOTICES.md',ROOT/'docs/licenses/20261121/ARTIFACT_NOTICES.md'];summary=json.loads((ROOT/'docs/licenses/20261121/summary.json').read_text(encoding='utf-8'))
lock_bytes=(ROOT/'package-lock.json').read_bytes();lock_hash=hashlib.sha256(lock_bytes).hexdigest();lock_lf=hashlib.sha256(lock_bytes.replace(b'\r\n',b'\n')).hexdigest()
baseline=subprocess.check_output(['git','show','aab0be9:package-lock.json'],cwd=ROOT);assert hashlib.sha256(baseline.replace(b'\r\n',b'\n')).hexdigest()==lock_lf
parts=['AD Me — Third-party software notices\n\nExact bundled notices from the existing reviewed lock inventory. Missing notices and asset redistribution rights remain review gates; this file is not a blanket rights approval.\n']
for p in sources:parts.append('\n\n===== '+p.relative_to(ROOT).as_posix()+' =====\n\n'+p.read_text(encoding='utf-8').replace('\r\n','\n'))
body=''.join(parts).encode();path=ROOT/'public/legal/third-party-notices.txt';path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(body)
manifest=dict(lockfile_sha256=lock_hash,lockfile_sha256_lf=lock_lf,prior_inventory_lockfile_sha256=summary['lockfile_sha256'],sources=[dict(path=p.relative_to(ROOT).as_posix(),sha256_lf=hashlib.sha256(p.read_bytes().replace(b'\r\n',b'\n')).hexdigest())for p in sources],shipped_path=path.relative_to(ROOT).as_posix(),sha256=hashlib.sha256(body).hexdigest(),bytes=len(body),existing_exact_installed=summary['exact_installed'],existing_exact_archive=summary['exact_archive'],unresolved_archive_notices=len(summary['unresolved']),source_notice_documents_unchanged=True,rights_approval=False,scope='Ship known exact notices in public/ so Next hosting can serve them. Runtime trace / actual Linux build proof is separate. No missing notice inferred from SPDX alone. Lock/source comparison normalizes CRLF only.')
(TARGET/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8');print(json.dumps({k:manifest[k]for k in ['bytes','unresolved_archive_notices','rights_approval']}))
