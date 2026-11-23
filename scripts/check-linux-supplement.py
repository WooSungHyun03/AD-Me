"""Isolated Linux build and notice HTTP probe from an explicit Git tree."""
from pathlib import Path
import json,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
tree=sys.argv[1]
assert len(tree)==40 and all(c in '0123456789abcdef'for c in tree)
target=ROOT/'harness/evidence/D007/supplement-runtime-linux-20261122.json'
assert not target.exists(),'Prior proof is immutable'
out=ROOT/('output/license-supplement-linux-'+tree[:12]);out.mkdir(parents=True,exist_ok=True)
image='node:22-bookworm-slim';volume='adme-license-linux-20261121';run='/work/run-supplement-'+tree[:12]
archive=subprocess.Popen(['git','-c','core.autocrlf=false','-c','core.eol=lf','archive','--format=tar',tree],cwd=ROOT,stdout=subprocess.PIPE)
command=f"test ! -e {run} && mkdir -p {run} && cd {run} && tar -xf - && npm ci --cache /work/npm-cache --prefer-offline --no-audit --no-fund > install.log 2>&1 && npm run build > build.log 2>&1 && node scripts/audit-shipped-notices.mjs --target linux --probe --output runtime-notices-linux.json"
with(out/'run.local.log').open('wb')as log:
 result=subprocess.run(['docker','run','--rm','--name','adme-notice-supplement-'+tree[:12],'--cpus=2','--memory=4g','-e','NODE_OPTIONS=--max-old-space-size=2048','-i','-v',volume+':/work','-w','/work',image,'sh','-c',command],stdin=archive.stdout,stdout=log,stderr=subprocess.STDOUT)
archive.stdout.close();archive_result=archive.wait()
assert result.returncode==0 and archive_result==0,'Inspect ignored Linux build log'
proof=json.loads(subprocess.check_output(['docker','run','--rm','-v',volume+':/work',image,'cat',run+'/runtime-notices-linux.json']))
proof['source_tree']=tree
proof['image_id']=subprocess.check_output(['docker','image','inspect',image,'--format','{{.Id}}'],text=True).strip()
proof['isolation']='Git tree only; no host home, env, keys or ports. Actual local Linux build, not cloud deployment.'
target.write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(dict(result=proof['result'],traced_packages=proof['traced_packages'],notice_gaps=len(proof['unresolved_runtime_packages']),exact_disclosures=proof['runtime_with_exact_archive_disclosure'],http=proof['http_notice_and_korean_page_verified'])))
