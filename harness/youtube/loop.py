#!/usr/bin/env python3
"""Persistent CLI for ChatGPT Desktop's implementation queue.

This CLI does NOT invoke ChatGPT or a model API. It manages declared task
states and dependency ordering; 'done' requires a human/agent-supplied evidence
path/description, which must still be verified separately.
"""
from __future__ import annotations
import argparse
import datetime as dt
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TASKS = ROOT / 'tasks.json'
LOG = ROOT / 'session_log.md'
P_ORDER = {'P0': 0, 'P1': 1, 'P2': 2}
STATES = {'pending', 'in_progress', 'blocked', 'done'}


def load():
    return json.loads(TASKS.read_text(encoding='utf-8'))


def save(data):
    temp = TASKS.with_suffix('.json.tmp')
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temp.replace(TASKS)


def lookup(data, tid):
    return next((x for x in data['tasks'] if x['id'] == tid), None)


def validate(data):
    errors = []
    tasks = data.get('tasks', [])
    ids = [t.get('id') for t in tasks]
    if not tasks or len(set(ids)) != len(ids):
        errors.append('empty tasks or duplicate ids')
    mapping = {t['id']: t for t in tasks}
    for t in tasks:
        tid = t['id']
        if t.get('priority') not in P_ORDER:
            errors.append(f'{tid}: invalid priority')
        if t.get('status') not in STATES:
            errors.append(f'{tid}: invalid status')
        if not isinstance(t.get('acceptance'), list) or not t['acceptance']:
            errors.append(f'{tid}: missing acceptance')
        if t['status'] == 'done' and not t.get('evidence'):
            errors.append(f'{tid}: done has no evidence')
        if t['status'] == 'blocked' and not t.get('blocker'):
            errors.append(f'{tid}: blocked has no reason')
        for dep in t.get('dependencies', []):
            if dep not in mapping or dep == tid:
                errors.append(f'{tid}: invalid dependency {dep}')
        if t['status'] == 'done' and any(mapping.get(d, {}).get('status') != 'done' for d in t['dependencies']):
            errors.append(f'{tid}: done while prerequisite not done')
    visit = set()
    stack = set()
    def dfs(node):
        if node in stack:
            errors.append(f'cyclic dependency at {node}')
            return
        if node in visit or node not in mapping:
            return
        stack.add(node)
        for dep in mapping[node].get('dependencies', []):
            dfs(dep)
        stack.remove(node)
        visit.add(node)
    for id_ in ids:
        dfs(id_)
    return errors


def ready(data):
    mapping = {t['id']: t for t in data['tasks']}
    return sorted((t for t in data['tasks'] if t['status'] == 'pending'
                   and all(mapping[dep]['status'] == 'done' for dep in t['dependencies'])),
                  key=lambda t: (P_ORDER[t['priority']], t['id']))


def log(message):
    stamp = dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')
    with LOG.open('a', encoding='utf-8') as f:
        f.write(f'\n- {stamp} — {message}\n')


def main(argv=None):
    p = argparse.ArgumentParser(description='AD Me Desktop Harness queue (no AI API calls)')
    subs = p.add_subparsers(dest='action', required=True)
    for name in ('validate','status','next','report'):
        subs.add_parser(name)
    start = subs.add_parser('start')
    start.add_argument('id')
    done = subs.add_parser('done')
    done.add_argument('id')
    done.add_argument('--evidence', required=True)
    blocked = subs.add_parser('block')
    blocked.add_argument('id')
    blocked.add_argument('--reason', required=True)
    retry = subs.add_parser('reopen')
    retry.add_argument('id')
    args = p.parse_args(argv)
    data = load()
    errs = validate(data)
    if errs:
        print('INVALID QUEUE:\n- ' + '\n- '.join(errs), file=sys.stderr)
        return 2
    tasks = data['tasks']
    if args.action == 'validate':
        print(f'PASS: {len(tasks)} tasks, no duplicate/cycle/invariant errors')
        return 0
    if args.action in ('status','report'):
        print('Tasks:', len(tasks))
        for prio in P_ORDER:
            group = [t for t in tasks if t['priority'] == prio]
            done_count = sum(t['status'] == 'done' for t in group)
            print(f' {prio}: {done_count}/{len(group)} done')
        for state in ('in_progress','blocked'):
            group = [t for t in tasks if t['status'] == state]
            if group:
                print(state.upper(), len(group))
                for t in group[:12]:
                    print(' ',t['id'],t['title'], t.get('blocker') or '')
        if args.action == 'report':
            print('READY:',[(t['id'],t['title']) for t in ready(data)[:8]])
        return 0
    if args.action == 'next':
        if any(t['status'] == 'in_progress' for t in tasks):
            active=[t for t in tasks if t['status'] == 'in_progress']
            print('Resume active:',[(t['id'],t['title']) for t in active]); return 0
        queue=ready(data)
        if not queue:
            print('No ready tasks; check blockers/dependencies'); return 1
        t=queue[0]
        print(f'{t["id"]} [{t["priority"]}] {t["title"]}\nDependencies: {t["dependencies"]}')
        for criterion in t['acceptance']:
            print(' -',criterion)
        return 0
    t=lookup(data,args.id)
    if t is None:
        print('Unknown task',args.id,file=sys.stderr); return 2
    now=dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')
    if args.action == 'start':
        if t not in ready(data):
            print('Task not ready (dependencies or status)',file=sys.stderr);return 2
        t['status']='in_progress';t['started_at']=now;t['blocker']=None
        log(f'START {t["id"]}: {t["title"]}')
    elif args.action == 'done':
        evidence=args.evidence.strip()
        if t['status']!='in_progress' or len(evidence)<30:
            print('Task must be in_progress, evidence >=30 chars; include actual file/test reference',file=sys.stderr);return 2
        t['status']='done';t['evidence']=evidence;t['completed_at']=now;t['blocker']=None
        log(f'DONE {t["id"]}: {evidence}')
    elif args.action == 'block':
        reason=args.reason.strip()
        if t['status'] not in ('pending','in_progress') or len(reason)<12:
            print('Block requires pending/in_progress task and detailed reason >=12 characters',file=sys.stderr);return 2
        t['status']='blocked';t['blocker']=reason
        log(f'BLOCKED {t["id"]}: {reason}')
    elif args.action == 'reopen':
        if t['status'] not in ('blocked','done'):
            print('Only blocked/done may reopen',file=sys.stderr);return 2
        dependents=[x['id'] for x in tasks if x['status']=='done' and t['id'] in x['dependencies']]
        if dependents:
            print('Cannot reopen with completed direct dependents:',dependents,file=sys.stderr);return 2
        t.update(status='pending',blocker=None,evidence=None,completed_at=None)
        log(f'REOPEN {t["id"]}')
    save(data)
    print(f'{args.action.upper()}: {t["id"]}: {t["status"]}')
    return 0

if __name__=='__main__':
    raise SystemExit(main())
