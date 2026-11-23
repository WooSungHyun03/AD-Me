"""Developer-only isolated Linux target verification; no deployed account, key or port."""
from pathlib import Path
import subprocess,json,hashlib,sys
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'output/license-linux-20261121';OUT.mkdir(parents=True,exist_ok=True)
tree=sys.argv[1];assert len(tree)==40 and all(c in '0123456789abcdef'for c in tree)
image='node:22-bookworm-slim';volume='adme-license-linux-20261121';run='/work/run-'+tree[:12]
# Git tree input is explicit; no untracked env/account files or host home is mounted.
archive=subprocess.Popen(['git','-c','core.autocrlf=false','-c','core.eol=lf','archive','--format=tar',tree],cwd=ROOT,stdout=subprocess.PIPE)
command=f"mkdir -p {run} && cd {run} && tar -xf - && npm ci --cache /work/npm-cache --prefer-offline --no-audit --no-fund > install.log 2>&1 && npm run build > build.log 2>&1 && node scripts/audit-shipped-notices.mjs --target linux --probe --output runtime-notices-linux.json"
with(OUT/'run.local.log').open('wb')as log:
 result=subprocess.run(['docker','run','--rm','--name','adme-license-linux-check','--cpus=2','--memory=4g','-e','NODE_OPTIONS=--max-old-space-size=2048','-i','-v',volume+':/work','-w','/work',image,'sh','-c',command],stdin=archive.stdout,stdout=log,stderr=subprocess.STDOUT)
archive.stdout.close();archive.wait();assert result.returncode==0,'Inspect ignored Linux build log; no provider calls or deployment'
raw=subprocess.check_output(['docker','run','--rm','-v',volume+':/work',image,'cat',run+'/runtime-notices-linux.json']);proof=json.loads(raw);proof['source_tree']=tree;proof['image_id']=subprocess.check_output(['docker','image','inspect',image,'--format','{{.Id}}'],text=True).strip();proof['isolation']='Git archive only, no host env/keys/home/ports; local disposable Docker volume, not deployment.'
target=ROOT/'harness/evidence/DEV-A-P0-ALL-20261121/runtime-notices-linux.json';assert not target.exists();target.write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(dict(target='linux',traced_packages=proof['traced_packages'],notice_gaps=len(proof['unresolved_runtime_packages']),http=proof['http_notice_and_korean_page_verified'],result=proof['result'])))
