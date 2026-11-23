"""Static reviewed source/LF/old artifact integrity, not hosted verification."""
from pathlib import Path
from datetime import datetime,timezone
import hashlib
import json
import subprocess
ROOT=Path(__file__).resolve().parents[1]
BASE='5044f459d31c1199b48b5079970d633644ae465a'
TARGET=ROOT/'deliverables/dev-a-recommendations-20261120'
git=lambda *args:subprocess.check_output(['git',*args],cwd=ROOT)
lf=lambda value:value.replace(b'\r\n',b'\n')
sha=lambda value:hashlib.sha256(value).hexdigest()
manifest=json.loads((TARGET/'MANIFEST.json').read_text(encoding='utf-8'))
head=manifest['source_head']
assert head and len(head)==40 and manifest['external_applied'] is False
git('merge-base','--is-ancestor',head,'HEAD')
for item in manifest['files']:
    value=lf((TARGET/item['path']).read_bytes());assert sha(value)==item['sha256_lf'] and len(value)==item['bytes_lf']
assert len(manifest['files'])==3
for item in manifest['sources']:
    value=lf((ROOT/item['path']).read_bytes())
    assert sha(value)==item['sha256_lf'] and value==lf(git('show',head+':'+item['path']))
    assert value in lf((TARGET/'01_apply_current_31.sql').read_bytes())
assert len(manifest['sources'])==3
old=git('ls-tree','-r','--name-only',BASE,'supabase/migrations').decode().splitlines()
assert len(old)==31
for path in old:assert lf((ROOT/path).read_bytes())==lf(git('show',BASE+':'+path)),path
previous_sql=git('ls-tree','-r','--name-only',BASE,'deliverables').decode().splitlines()
previous_sql=[p for p in previous_sql if p.endswith('.sql')]
for path in previous_sql:assert lf((ROOT/path).read_bytes())==lf(git('show',BASE+':'+path)),path
archives=[]
for path in (ROOT/'deliverables').glob('*/DELIVERY.json'):
    item=json.loads(path.read_text(encoding='utf-8'));value=(ROOT/item['archive']).read_bytes()
    assert sha(value)==item['sha256'] and len(value)==item['bytes'];archives.append(item['archive'])
assert len(archives)==6
result=dict(at=datetime.now(timezone.utc).isoformat(),result='PASS',source_head=head,source_migrations=manifest['sources'],sql_files=manifest['files'],preserved_previous_migrations=len(old),preserved_previous_delivered_sql=len(previous_sql),preserved_archives=sorted(archives),scope='Static Git/LF integrity only; actual31→34 SQL and rollback proof is recommendation-upgrade-20261120.json; not hosted execution.')
(ROOT/'harness/evidence/D045/packet-integrity-20261120.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(dict(result='PASS',source_head=head,sql_files=3,old_migrations=31,old_delivered_sql=len(previous_sql),archives=6)))
