"""Developer-only, read-only Git/LF/archive integrity checks for D054 delivery."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'deliverables/dev-a-deliverables-20261120'
BASE = '0abc1eeff47c004511ef3b5481f80e8629c637fe'

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)

def lf(value):
    return value.replace(b'\r\n', b'\n')

def digest(value):
    return hashlib.sha256(value).hexdigest()

manifest = json.loads((TARGET / 'MANIFEST.json').read_text(encoding='utf-8'))
head = manifest['source_head']
assert head and len(head) == 40 and manifest['external_applied'] is False
git('merge-base', '--is-ancestor', head, 'HEAD')
migration = manifest['new_migration']
source = lf((ROOT / migration['path']).read_bytes())
assert source == lf(git('show', head + ':' + migration['path']))
assert digest(source) == migration['sha256_lf']
checked = []
for item in manifest['files']:
    value = lf((TARGET / item['path']).read_bytes())
    assert digest(value) == item['sha256_lf'] and len(value) == item['bytes_lf']
    checked.append(item['path'])
assert len(checked) == 4
assert source in lf((TARGET / '01_stage_current_30.sql').read_bytes())
assert f"adme_delivery.activate('{head}')" in (TARGET / '03_activate.sql').read_text(encoding='utf-8')
old_paths = git('ls-tree', '-r', '--name-only', BASE, 'supabase/migrations').decode().splitlines()
assert len(old_paths) == 30
for path in old_paths:
    assert lf((ROOT / path).read_bytes()) == lf(git('show', BASE + ':' + path)), path
archives = []
for path in sorted((ROOT / 'deliverables').glob('*/DELIVERY.json')):
    item = json.loads(path.read_text(encoding='utf-8'))
    value = (ROOT / item['archive']).read_bytes()
    assert digest(value) == item['sha256'] and len(value) == item['bytes'], path
    archives.append(item['archive'])
assert len(archives) == 6
result = dict(at=datetime.now(timezone.utc).isoformat(), result='PASS', source_head=head,
              migration_sha256_lf=digest(source), sql_files=checked,
              preserved_previous_migrations=len(old_paths), preserved_archives=archives,
              scope='Static Git/LF integrity only. Actual old30 SQL upgrade proof is delivery-upgrade-20261120.json; no hosted execution.')
output = ROOT / 'harness/evidence/D054/packet-integrity-20261120.json'
output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(dict(result='PASS', source_head=head, sql_files=4, old_migrations=30, old_archives=6)))
