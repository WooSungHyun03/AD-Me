"""Verify the review artifact against committed Git blobs; never contacts hosted services."""
import base64
import hashlib
import json
from pathlib import Path
import re
import subprocess
import zipfile
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'deliverables/dev-a-read-boundary-20261120'
manifest = json.loads((TARGET / 'MANIFEST.json').read_text(encoding='utf-8'))
delivery = json.loads((TARGET / 'DELIVERY.json').read_text(encoding='utf-8'))
sha = lambda value: hashlib.sha256(value).hexdigest()
head = manifest['source_head']
assert delivery['source_head'] == head
assert re.fullmatch('[a-f0-9]{40}', head)
assert manifest['migration_count'] == 23 and len(manifest['new_migrations']) == 4
archive = ROOT / delivery['archive']
assert archive.stat().st_size == delivery['bytes']
assert sha(archive.read_bytes()) == delivery['sha256']
patterns = [r'gh[pousr]_[A-Za-z0-9]{30,}', r'sb_secret_[A-Za-z0-9_-]{20,}',
            r'(?:test|live)_(?:sk|gsk)_[A-Za-z0-9]{16,}', r'-----BEGIN (?:RSA |EC )?PRIVATE KEY-----']
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert len(z.namelist()) == len(set(z.namelist()))
    expected = {'source/' + row['path'] for row in manifest['files']}
    expected |= {p.relative_to(TARGET).as_posix() for p in TARGET.rglob('*')
                 if p.is_file() and p.name != 'DELIVERY.json'}
    assert set(z.namelist()) == expected
    for row in manifest['files']:
        value = z.read('source/' + row['path'])
        assert sha(value) == row['sha256'], row['path']
        assert value == subprocess.check_output(['git', 'show', head + ':' + row['path']], cwd=ROOT)
    for name in z.namelist():
        p = Path(name)
        assert '..' not in p.parts and not p.is_absolute()
        assert p.suffix not in ('.key', '.pem', '.log')
        assert not (p.name.startswith('.env') and p.name != '.env.example')
        assert not p.name.startswith(('.accounts', 'accounts.local', 'runtime.local'))
        try:
            text = z.read(name).decode('utf-8')
        except UnicodeDecodeError:
            continue
        assert not any(re.search(pattern, text) for pattern in patterns), name
        for token in re.findall(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', text):
            payload = token.split('.')[1]
            try:
                claims = json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))
            except (ValueError, UnicodeError):
                continue
            assert claims.get('role') != 'service_role', name
    for row in manifest['new_migrations']:
        value = z.read('source/' + row['source']).decode('utf-8')
        assert sha(value.replace('\r\n', '\n').encode()) == row['sha256_lf']
        for mode in ('current_19', 'main_8', 'integrated_12', 'previous_16', 'terms_18'):
            stage = z.read(f'user-apply/01_stage_{mode}.sql').decode('utf-8')
            assert value.replace('\r\n', '\n') in stage.replace('\r\n', '\n')
    activation = z.read('user-apply/03_activate.sql').decode('utf-8')
    assert head in activation and '<>23' in activation
    for p in TARGET.rglob('*'):
        if p.is_file() and p.name != 'DELIVERY.json':
            assert z.read(p.relative_to(TARGET).as_posix()) == p.read_bytes()
previous = []
for p in sorted((ROOT / 'deliverables').glob('*/DELIVERY.json')):
    if p.parent == TARGET:
        continue
    d = json.loads(p.read_text(encoding='utf-8'))
    old = ROOT / d['archive']
    assert old.stat().st_size == d['bytes'] and sha(old.read_bytes()) == d['sha256']
    previous.append({'archive': d['archive'], 'sha256': d['sha256']})
assert len(previous) == 5
result = dict(at=datetime.now(timezone.utc).isoformat(), result='PASS', source_head=head,
              archive=delivery['archive'], sha256=delivery['sha256'], bytes=delivery['bytes'],
              source_files=len(manifest['files']), crc_and_all_git_blobs=True,
              generated_sql_matches_committed_migrations=True, private_material_checks=True,
              previous_archives_unchanged=previous, external_applied=False)
out = ROOT / 'harness/evidence/DEV-A-READ-20261120/package-verification.json'
out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result))
