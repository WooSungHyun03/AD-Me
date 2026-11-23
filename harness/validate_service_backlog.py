"""Validate planning integrity; this does not verify product implementation."""
from pathlib import Path
import json
from collections import Counter

p = json.loads((Path(__file__).parent / 'service_backlog_v2.json').read_text(encoding='utf-8'))
all_items = p['tickets'] + p['user_tickets'] + p['deferred']
ids = [x['id'] for x in all_items]
assert len(ids) == len(set(ids)), 'Duplicate ticket IDs'
lookup = {x['id']: x for x in all_items}
for t in p['tickets']:
    assert t['owner'] in ('DEV-A', 'DEV-B')
    assert t['points'] in (1, 2, 3, 5, 8)
    assert t['priority'] in ('P0', 'P1', 'P2')
    assert t['acceptance'] and t['verification']
    assert t['status'] == 'OPEN'
    for d in t['depends_on']:
        assert d in lookup and d != t['id'], (t['id'], d)
visited, active = set(), set()
def visit(key):
    assert key not in active, f'Dependency cycle: {key}'
    if key in visited:
        return
    active.add(key)
    for dep in lookup[key].get('depends_on', []):
        visit(dep)
    active.remove(key)
    visited.add(key)
for key in lookup:
    visit(key)
assert set(p['original_prd_coverage']) == {f'F{i:03}' for i in range(1,117)}
assert set(p['legacy_task_crosswalk']) == {f'T{i:03}' for i in range(1,41)}
for mapping in (p['original_prd_coverage'], p['legacy_task_crosswalk']):
    for refs in mapping.values():
        assert refs and all(ref in lookup for ref in refs)
counts = Counter()
for t in p['tickets']:
    counts[t['owner']] += t['points']
assert dict(counts) == p['allocation_points']
assert abs(counts['DEV-A'] - counts['DEV-B']) <= 1
for pr in ('P0', 'P1', 'P2'):
    values=[sum(t['points'] for t in p['tickets'] if t['owner']==o and t['priority']==pr) for o in ('DEV-A','DEV-B')]
    assert abs(values[0]-values[1])<=1, (pr, values)
assert all(t['owner']=='USER' and t['points'] is None for t in p['user_tickets'])
assert all(t['owner']=='DEFERRED' and t['points'] is None for t in p['deferred'])
print(f'PASS: {len(p["tickets"])} development, {len(p["user_tickets"])} user, {len(p["deferred"])} deferred; {dict(counts)}; PRD 116/116, legacy 40/40; acyclic dependencies.')
