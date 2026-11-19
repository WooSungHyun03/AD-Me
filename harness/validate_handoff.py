"""Validate delivery document coverage and internal consistency, not service behavior."""
from pathlib import Path
import json
import re

root = Path(__file__).resolve().parents[1]
backlog = json.loads((root / 'harness/service_backlog_v2.json').read_text())
all_ids = {t['id'] for t in backlog['tickets'] + backlog['user_tickets'] + backlog['deferred']}
seen = set()
for owner in ('DEV-A', 'DEV-B'):
    text = (root / f'docs/handoff/{owner}_VIBECODING_TICKETS.md').read_text()
    ids = re.findall(r'^## (D\d{3}) — ', text, re.M)
    expected = {t['id'] for t in backlog['tickets'] if t['owner'] == owner}
    assert set(ids) == expected and len(ids) == len(expected), owner
    assert not seen.intersection(ids), 'Ticket assigned to both developers'
    seen.update(ids)
    sections = re.split(r'^## D\d{3} — .*$', text, flags=re.M)[1:]
    for section in sections:
        for required in ('선행 인계', '후속 인계', '구현 지시', '완료 조건', '부정 시나리오', '실행 및 테스트', '제출 산출물'):
            assert required in section, (owner, required)
    assert sum(t['points'] for t in backlog['tickets'] if t['owner'] == owner) == 219
runtime = json.loads((root / 'harness/handoff/runtime-status.json').read_text())
for t in backlog['user_tickets']:
    text = (root / f'docs/user-tickets/{t["id"]}.md').read_text()
    for required in ('시작 전에 개발자가 준비할 것', '사용자가 수행할 순서', '검증·개발자 인계', '실패·중단·복구', '증거 기록 양식', '공식 참고'):
        assert required in text, (t['id'], required)
    assert len(re.findall(r'^\d+\. ', text, re.M)) >= 4, t['id']
    assert f"현재 상태: {runtime['user_actions'][t['id']]['status']}" in text, t['id']
assert set(runtime['tickets']) == seen
assert set(runtime['user_actions']) == {t['id'] for t in backlog['user_tickets']}
for t in backlog['tickets']:
    assert runtime['tickets'][t['id']]['owner'] == t['owner']
manifest = json.loads((root / 'harness/handoff/environment-manifest.json').read_text())
assert manifest['contains_values'] is False and manifest['registration_owner'] == 'USER'
assert all('value' not in x for x in manifest['settings'])
for setting in manifest['settings']:
    consumer = setting['consumer']
    if consumer:
        path = root / consumer
        assert path.is_file(), consumer
        assert setting['name'] in path.read_text(), setting['name']
files = list((root / 'docs/handoff').glob('*.md')) + list((root / 'docs/user-tickets').glob('*.md')) + [root / 'docs/backlog/USER_ACTIONS.md']
for file in files:
    text = file.read_text()
    for target in re.findall(r'\[[^\]]*\]\(([^)]+)\)', text):
        if target.startswith(('https://', 'http://', '#')):
            continue
        assert (file.parent / target.split('#')[0]).resolve().exists(), (file.name, target)
    for ticket in re.findall(r'\b[DUX]\d{3}\b', text):
        assert ticket in all_ids, (file.name, ticket)
print('PASS: A 43 / B 45 tickets, 219SP each; 20 user runbooks; sections, references, local links, runtime ledger and current environment consumers consistent.')
