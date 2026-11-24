#!/usr/bin/env python3
"""Local state checker only; never invokes an LLM, deployment or provider API."""
import argparse,json,os,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parent; MAN=ROOT/'tasks.json'; STATE=ROOT/'state.json'
def load():
    tasks=json.loads(MAN.read_text())['tasks']; records={r['id']:r for r in tasks}
    assert len(records)==len(tasks),'duplicate IDs'
    active=set(); done=set()
    def visit(i):
        assert i in records,f'unknown dependency: {i}'
        assert i not in active,f'cycle: {i}'
        if i in done:return
        active.add(i)
        for d in records[i]['deps']:visit(d)
        active.remove(i);done.add(i)
    for i in records:visit(i)
    state=json.loads(STATE.read_text()) if STATE.exists() else {}
    assert set(state)<=set(records),'unknown saved task'
    return records,state

def status(r,s):return s.get(r['id'],{}).get('state',r['state'])
def save(s):
    fd,p=tempfile.mkstemp(dir=STATE.parent);os.close(fd)
    Path(p).write_text(json.dumps(s,ensure_ascii=False,indent=2)+'\n');os.replace(p,STATE)
def main():
    p=argparse.ArgumentParser();p.add_argument('cmd',choices=['validate','status','next','start','verify','block','reopen']);p.add_argument('id',nargs='?');p.add_argument('--evidence',action='append',default=[]);p.add_argument('--reason');p.add_argument('--canonical-checked',action='store_true',help='confirm actual repo dependencies and scope checked; not a proof of external approval');a=p.parse_args();r,s=load()
    if a.cmd=='validate':print(f'OK: {len(r)} IDs; acyclic overlay');return
    if a.cmd=='status':
        for k,t in r.items():print(k,status(t,s),t['scope'],t['title'])
        return
    def ready(t):return t['scope']=='ACTIVE' and status(t,s)=='TODO' and all(status(r[d],s)=='VERIFIED' for d in t['deps'])
    if a.cmd=='next':
        for t in r.values():
            if ready(t):print(t['id'],t['priority'],t['title'],'canonical prerequisites:',','.join(t['original_dependencies']) or 'none')
        return
    if a.id not in r:p.error('valid task ID required')
    t=r[a.id]; st=status(t,s)
    if t['scope']!='ACTIVE':p.error('GATED/ARCHIVED: no automatic execution; review canonical scope first')
    if a.cmd=='start':
        if not ready(t) or not a.canonical_checked:p.error('not ready or actual canonical prerequisites not checked')
        s[a.id]={'state':'IN_PROGRESS','canonical_checked':True}
    elif a.cmd=='verify':
        if st!='IN_PROGRESS' or not a.evidence:p.error('start first and supply actual evidence file(s)')
        paths=[Path(x).expanduser().resolve() for x in a.evidence]
        if not all(x.is_file() and x.stat().st_size>0 for x in paths):p.error('missing or empty evidence file')
        s[a.id]={'state':'VERIFIED','evidence':[os.path.relpath(x, ROOT) for x in paths],'note':'local tracking only; review evidence and update canonical separately'}
    elif a.cmd=='block':
        if st=='VERIFIED' or not a.reason:p.error('reopen verified tasks first; reason required')
        s[a.id]={'state':'BLOCKED','reason':a.reason}
    elif a.cmd=='reopen':
        if not a.reason:p.error('reason required')
        # Downstream attestations must be rechecked after reopening.
        affected={a.id};changed=True
        while changed:
            old=len(affected);affected|={k for k,v in r.items() if set(v['deps'])&affected};changed=len(affected)>old
        for k in affected:
            if r[k]['scope']=='ACTIVE':s[k]={'state':'TODO','reason':a.reason if k==a.id else f'upstream {a.id} reopened'}
    save(s);print(a.id,status(t,s))
if __name__=='__main__':main()
