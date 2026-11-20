"""Verify SQL hashes/committed sources and preserve prior artifacts, without hosted access."""
from pathlib import Path
from datetime import datetime,timezone
import hashlib
import json
import subprocess

ROOT=Path(__file__).resolve().parents[1]
TARGET=ROOT/'deliverables/dev-a-evidence-20261120'
m=json.loads((TARGET/'MANIFEST.json').read_text(encoding='utf-8'))
assert m['source_head'] and m['migration_count']==30 and len(m['new_migrations'])==6
sha=lambda data:hashlib.sha256(data).hexdigest()
for row in m['files']:
    data=(TARGET/row['path']).read_bytes()
    assert len(data)==row['bytes'] and sha(data)==row['sha256'],row['path']
for row in m['new_migrations']:
    data=subprocess.check_output(['git','show',m['source_head']+':'+row['path']],cwd=ROOT).replace(b'\r\n',b'\n')
    assert sha(data)==row['sha256_lf']
    for mode in ('previous_23','current_24'):
        body=(TARGET/f'01_apply_{mode}.sql').read_text(encoding='utf-8')
        assert data.decode() in body
prefix=(ROOT/'deliverables/dev-a-messages-20261120.sql').read_bytes()
assert (TARGET/'01_apply_previous_23.sql').read_bytes().startswith(prefix+b'\n')
old=[]
for p in sorted((ROOT/'deliverables').glob('*/DELIVERY.json')):
    d=json.loads(p.read_text(encoding='utf-8'));archive=ROOT/d['archive']
    assert archive.stat().st_size==d['bytes'] and sha(archive.read_bytes())==d['sha256']
    old.append(dict(archive=d['archive'],sha256=d['sha256']))
assert len(old)==6
baseline='0a20b21'
paths=subprocess.check_output(['git','ls-tree','-r','--name-only',baseline,'--','supabase/migrations'],cwd=ROOT).decode().splitlines()
assert len(paths)==24
for name in paths:
    assert subprocess.check_output(['git','show',baseline+':'+name],cwd=ROOT).replace(b'\r\n',b'\n')==(ROOT/name).read_bytes().replace(b'\r\n',b'\n')
result=dict(at=datetime.now(timezone.utc).isoformat(),result='PASS',source_head=m['source_head'],migration_count=30,all_sql_file_hashes=True,
            six_new_migration_git_blobs_match=True,previous_message_SQL_prefix_unchanged=True,old24_migrations_unchanged=True,
            prior_archives_unchanged=old,external_applied=False)
(ROOT/'harness/evidence/DEV-A-EVIDENCE-20261120/package-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'result':'PASS','source_head':m['source_head'],'sql_files':len(m['files']),'new_migrations':6,'old_migrations_preserved':24,'old_archives_preserved':6}))
