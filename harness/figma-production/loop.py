#!/usr/bin/env python3
"""Dependency-aware, resumable manual-agent loop; no model API or auto-deploy."""
import argparse,json,os,tempfile,hashlib,re
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parent
p=argparse.ArgumentParser();p.add_argument('--state-dir',type=Path,default=ROOT/'run');s=p.add_subparsers(dest='cmd',required=True)
for name in ['validate','status','next','report']:s.add_parser(name)
for name in ['start','reopen','block','done']:
 a=s.add_parser(name);a.add_argument('id')
 if name in ['reopen','block']:a.add_argument('--reason',required=True)
 if name=='done':a.add_argument('--evidence',type=Path,required=True)
a=s.add_parser('add-frame');a.add_argument('id');a.add_argument('--title',required=True);a.add_argument('--node',required=True);a.add_argument('--owner',choices=['DEV-A','DEV-B'],required=True);a.add_argument('--depends-on',nargs='*',default=[])
args=p.parse_args(); D=args.state_dir.resolve(); D.mkdir(parents=True,exist_ok=True); sf=D/'state.json'
def fail(msg):raise SystemExit(msg)
def load(path,default):return json.loads(path.read_text()) if path.exists() else default
def save(path,val):
 with tempfile.NamedTemporaryFile('w',dir=path.parent,delete=False,encoding='utf-8') as f:json.dump(val,f,ensure_ascii=False,indent=2);f.write('\n');tmp=f.name
 os.replace(tmp,path)
base=load(ROOT/'tasks.json',{})['tasks']; st=load(sf,{'states':{},'extra':[],'events':[]}); rows=base+st['extra']; T={t['id']:t for t in rows}
T['QA']['depends_on']+= [t['id'] for t in st['extra']]
def validate():
 assert len(T)==len(rows),'duplicate ID'; visited=set(); active=set()
 def dfs(x):
  assert x in T,'unknown dependency '+x
  assert x not in active,'cycle '+x
  if x in visited:return
  active.add(x)
  for d in T[x]['depends_on']:dfs(d)
  active.remove(x);visited.add(x)
 for x in T:dfs(x)
 assert set(st['states'])<=T.keys(),'unknown state ID'
 assert all(v['status'] in ['IN_PROGRESS','VERIFIED','BLOCKED','TODO'] for v in st['states'].values())
def state(x):return st['states'].get(x,{}).get('status','TODO')
def ready(x):return all(state(d)=='VERIFIED' for d in T[x]['depends_on'])
def event(x,status,**kw):
 rec=dict(status=status,time=datetime.now(timezone.utc).isoformat(),**kw);st['states'][x]=rec;st['events'].append(dict(id=x,**rec));save(sf,st)
validate()
if args.cmd=='validate':print(f'OK: {len(T)} tasks, unique IDs and acyclic dependencies')
elif args.cmd in ['status','report','next']:
 data=[dict(id=x,title=t['title'],gate=t['gate'],owner=t['owner'],status=state(x),ready=ready(x),waiting=[d for d in t['depends_on'] if state(d)!='VERIFIED']) for x,t in T.items()]
 if args.cmd=='next':data=[r for r in data if r['ready'] and r['status'] in ['TODO','IN_PROGRESS'] and r['gate']!='excluded']
 print(json.dumps(data,ensure_ascii=False,indent=2))
elif args.cmd=='add-frame':
 if args.id in T or not re.fullmatch(r'X-[A-Z0-9-]+',args.id):fail('Use unique X-... ID')
 if not re.fullmatch(r'\d+[:-]\d+',args.node):fail('Use real Figma node ID')
 row=dict(id=args.id,title=args.title,kind='frame',owner=args.owner,gate='core',node_id=args.node,depends_on=list(dict.fromkeys(['TOKENS']+args.depends_on)),checks=T['F01-D']['checks']);st['extra'].append(row);rows.append(row);T[args.id]=row;T['QA']['depends_on'].append(args.id);validate()
 # Newly discovered scope invalidates downstream signoffs.
 for x in ['QA','HANDOFF','PREVIEW','LIVE','PAID-LIVE']:
  if state(x)!='TODO':st['states'][x]={'status':'TODO','reason':'new frame '+args.id}
 save(sf,st);print('Added',args.id)
else:
 x=args.id
 if x not in T:fail('unknown ID')
 if args.cmd=='start':
  if state(x) not in ['TODO','IN_PROGRESS'] or not ready(x):fail('not ready; reopen blocked work explicitly')
  event(x,'IN_PROGRESS')
 elif args.cmd=='block':event(x,'BLOCKED',reason=args.reason)
 elif args.cmd=='reopen':
  event(x,'TODO',reason=args.reason); changed={x}; again=True
  while again:
   again=False
   for y,t in T.items():
    if y not in changed and changed.intersection(t['depends_on']):changed.add(y);again=True
  for y in sorted(changed-{x}):
   if state(y) in ['VERIFIED','IN_PROGRESS']:event(y,'TODO',reason='upstream reopened: '+x)
 elif args.cmd=='done':
  if state(x)!='IN_PROGRESS' or not ready(x):fail('start ready task first')
  f=args.evidence.resolve(); e=load(f,{})
  if e.get('id')!=x or not e.get('scope') or not e.get('result_summary') or not e.get('reviewer') or not e.get('basis_sha'):fail('missing evidence metadata')
  checks=e.get('checks',{})
  for k in T[x]['checks']:
   c=checks.get(k,{})
   if c.get('result')!='PASS' or not c.get('detail'):fail('missing PASS detail: '+k)
   paths=c.get('artifacts',[])
   if not paths:fail('missing artifact: '+k)
   for a in paths:
    z=(f.parent/a).resolve()
    if not z.is_file() or z.stat().st_size==0:fail('missing/nonempty artifact: '+str(z))
  event(x,'VERIFIED',evidence=str(f),sha256=hashlib.sha256(f.read_bytes()).hexdigest(),scope=e['scope'])
 print(x,state(x))
