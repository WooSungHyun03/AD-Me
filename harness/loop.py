#!/usr/bin/env python3
"""AD Me task queue CLI. Persists state; does not invoke an AI agent."""
from __future__ import annotations
import argparse
import datetime as dt
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TASK_PATH = ROOT / 'harness' / 'tasks.json'
LOG_PATH = ROOT / 'harness' / 'session_log.md'
PRIORITY = {'P0': 0, 'P1': 1, 'P2': 2}
VALID_STATUSES = {'pending', 'in_progress', 'blocked', 'done'}


def load():
    return json.loads(TASK_PATH.read_text(encoding='utf-8'))


def save(data):
    TASK_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def task_map(data):
    return {t['id']: t for t in data['tasks']}


def ready(data):
    m = task_map(data)
    tasks = [t for t in data['tasks'] if t['status'] == 'pending' and all(m[d]['status'] == 'done' for d in t['dependencies'])]
    return sorted(tasks, key=lambda t: (PRIORITY[t['priority']], t['id']))


def validate(data):
    errors = []
    tasks = data.get('tasks', [])
    ids = [t.get('id') for t in tasks]
    if len(ids) != len(set(ids)): errors.append('duplicate task IDs')
    if not tasks: errors.append('empty task queue')
    m = task_map(data)
    for t in tasks:
        if t.get('priority') not in PRIORITY: errors.append(f'{t["id"]} invalid priority')
        if t.get('status') not in VALID_STATUSES: errors.append(f'{t["id"]} invalid status')
        if not t.get('acceptance'): errors.append(f'{t["id"]} no acceptance')
        if t.get('status') == 'done' and not t.get('evidence'): errors.append(f'{t["id"]} done without evidence')
        if t.get('status') == 'done' and any(m.get(d, {}).get('status') != 'done' for d in t['dependencies']): errors.append(f'{t["id"]} done while dependency undone')
        if t.get('status') == 'blocked' and not t.get('blocker'): errors.append(f'{t["id"]} blocked without reason')
        for d in t['dependencies']:
            if d not in m: errors.append(f'{t["id"]}: unknown dependency {d}')
            if d == t['id']: errors.append(f'{t["id"]}: self dependency')
    visited, active = set(), set()
    def walk(k):
        if k in active:
            errors.append(f'cycle at {k}'); return
        if k in visited or k not in m: return
        active.add(k)
        for d in m[k]['dependencies']: walk(d)
        active.remove(k); visited.add(k)
    for k in ids: walk(k)
    return errors


def log(event):
    stamp = dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')
    with LOG_PATH.open('a', encoding='utf-8') as f:
        f.write(f'\n- `{stamp}` {event}\n')


def lookup(data, id):
    m = task_map(data)
    if id not in m: raise ValueError(f'Unknown task: {id}')
    return m[id]


def run():
    p = argparse.ArgumentParser(description='AD Me persistent human/AI task harness')
    sub = p.add_subparsers(dest='command', required=True)
    for name in ('status', 'next', 'validate'): sub.add_parser(name)
    start = sub.add_parser('start'); start.add_argument('id')
    complete = sub.add_parser('complete'); complete.add_argument('id'); complete.add_argument('--evidence', required=True)
    block = sub.add_parser('block'); block.add_argument('id'); block.add_argument('--reason', required=True)
    reopen = sub.add_parser('reopen'); reopen.add_argument('id')
    a = p.parse_args()
    data = load()
    errors = validate(data)
    if errors:
        print('INVALID task queue:\n- ' + '\n- '.join(errors), file=sys.stderr)
        return 2
    if a.command == 'validate': print(f'OK: {len(data["tasks"])} tasks, acyclic dependencies'); return 0
    if a.command == 'status':
        totals = {s: sum(t['status'] == s for t in data['tasks']) for s in VALID_STATUSES}
        priorities = {pr: f"{sum(t['priority']==pr and t['status']=='done' for t in data['tasks'])}/{sum(t['priority']==pr for t in data['tasks'])}" for pr in PRIORITY}
        print('Status:', totals, '| Completed by priority:', priorities)
        active = [t for t in data['tasks'] if t['status'] == 'in_progress']
        if active: print('Active:', ', '.join(t['id']+' '+t['title'] for t in active))
        for t in ready(data)[:4]: print('READY:', t['id'], t['title'])
        return 0
    if a.command == 'next':
        r = ready(data)
        if not r: print('No ready pending task. Check blockers/dependencies.'); return 1
        t = r[0]; print(f'{t["id"]}: {t["title"]} [{t["priority"]}]\nDepends: {", ".join(t["dependencies"]) or "none"}\nAcceptance:')
        for test in t['acceptance']: print(' -', test)
        return 0
    try:
        t = lookup(data, a.id)
        if a.command == 'start':
            if t['status'] != 'pending': raise ValueError('Only pending task may start')
            if t not in ready(data): raise ValueError('Task dependencies incomplete')
            t['status'] = 'in_progress'; t['blocker'] = None
            log(f'START {t["id"]} {t["title"]}')
        elif a.command == 'complete':
            if t['status'] != 'in_progress': raise ValueError('Only in_progress task can complete')
            evidence = a.evidence.strip()
            if len(evidence) < 12: raise ValueError('Evidence must be meaningful (>=12 chars)')
            t['evidence'] = evidence; t['status'] = 'done'; t['blocker'] = None
            log(f'DONE {t["id"]} evidence: {evidence}')
        elif a.command == 'block':
            if t['status'] not in ('pending', 'in_progress'): raise ValueError('Only pending/in_progress can be blocked')
            reason = a.reason.strip()
            if len(reason) < 8: raise ValueError('Blocker reason too short')
            t['status'] = 'blocked'; t['blocker'] = reason
            log(f'BLOCKED {t["id"]}: {reason}')
        elif a.command == 'reopen':
            if t['status'] not in ('blocked', 'done'): raise ValueError('Only blocked/done can reopen')
            if any(t['id'] in other['dependencies'] and other['status']=='done' for other in data['tasks']):
                raise ValueError('Cannot reopen: completed dependent tasks exist. Reopen descendants in reverse order first')
            t['status'] = 'pending'; t['blocker'] = None; t['evidence'] = None
            log(f'REOPEN {t["id"]}')
        save(data)
        print(f'{a.command.upper()} {t["id"]}: {t["status"]}')
        return 0
    except ValueError as exc:
        print('ERROR:', exc, file=sys.stderr); return 2


if __name__ == '__main__': sys.exit(run())
