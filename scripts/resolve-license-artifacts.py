"""Read exact npm lock artifacts without installing or executing their code."""
from pathlib import Path
import base64,csv,hashlib,io,json,re,tarfile,urllib.request,urllib.parse
from concurrent.futures import ThreadPoolExecutor
ROOT=Path(__file__).resolve().parents[1]
TARGET=ROOT/'docs/licenses/20261121'
CACHE=ROOT/'output/license-artifacts-20261121'
TARGET.mkdir(exist_ok=True);CACHE.mkdir(exist_ok=True)
lock=json.loads((ROOT/'package-lock.json').read_text(encoding='utf-8'))
rows=list(csv.DictReader((ROOT/'docs/licenses/dependencies.csv').open(encoding='utf-8')))
def resolve(row):
    row=dict(row)
    name=row['lock_path'].rsplit('node_modules/',1)[-1]
    direct={**lock['packages'][''].get('dependencies',{}),**lock['packages'][''].get('devDependencies',{})}
    row['scope']=('direct' if name in direct else 'transitive')+(' dev' if lock['packages'][row['lock_path']].get('dev') else ' runtime')
    row['artifact_notice_ref']='../THIRD_PARTY_NOTICES.md';row['archive_integrity']='not downloaded; exact installed notices'
    if row['review']=='EXACT_INSTALLED_NOTICES':return row,[]
    item=lock['packages'][row['lock_path']];url=item.get('resolved','');expected=item.get('integrity','')
    try:
        assert urllib.parse.urlsplit(url).scheme=='https' and urllib.parse.urlsplit(url).hostname=='registry.npmjs.org'
        algorithm,encoded=expected.split('-',1);assert algorithm in ('sha512','sha256','sha1')
        cache=CACHE/(hashlib.sha256(url.encode()).hexdigest()+'.tgz')
        if cache.exists():data=cache.read_bytes()
        else:
            with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'AD-Me-license-review'}),timeout=40) as response:
                assert urllib.parse.urlsplit(response.geturl()).hostname=='registry.npmjs.org'
                data=response.read(64*1024*1024+1)
            assert len(data)<=64*1024*1024
            cache.write_bytes(data)
        assert hashlib.new(algorithm,data).digest()==base64.b64decode(encoded)
        files=[];metadata=None
        with tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as archive:
            members=archive.getmembers();assert len(members)<100000
            for member in members:
                if not member.isfile():continue
                if member.name=='package/package.json':
                    assert member.size<1024*1024;metadata=json.loads(archive.extractfile(member).read())
                if re.search(r'(?i)(^|/)(licen[cs]e|notice|copying|copyright)([.\-_]|$)',member.name) and member.size<=4*1024*1024:
                    value=archive.extractfile(member).read();files.append((member.name,hashlib.sha256(value).hexdigest(),value.decode('utf-8',errors='replace')))
        assert metadata and metadata['version']==item['version']
        row['archive_integrity']=expected
        row['artifact_notice_ref']='ARTIFACT_NOTICES.md'
        row['notice_files']=';'.join(f[0] for f in files)
        row['review']='EXACT_ARCHIVE_NOTICES' if files else 'EXACT_ARCHIVE_NOTICE_MISSING'
        return row,files
    except Exception as error:
        row['review']='ARCHIVE_REVIEW_BLOCKED';row['archive_integrity']='FAILED:'+type(error).__name__
        return row,[]
with ThreadPoolExecutor(max_workers=4) as pool:result=list(pool.map(resolve,rows))
with (TARGET/'dependencies.csv').open('w',encoding='utf-8',newline='') as output:
    writer=csv.DictWriter(output,fieldnames=list(result[0][0]),quoting=csv.QUOTE_ALL);writer.writeheader();writer.writerows(r for r,_ in result)
with (TARGET/'ARTIFACT_NOTICES.md').open('w',encoding='utf-8',newline='\n') as output:
    output.write('# Exact lock artifact notices\n\nDownloaded as data, verified against lock integrity; never installed/executed. Other notices remain in ../THIRD_PARTY_NOTICES.md. This is an inventory, not legal approval or proof of the final deployment bundle.\n\n')
    for row,files in result:
        for name,digest,value in files:
            output.write(f"## {row['lock_path']}@{row['version']} / {name}\n\nSource: {row['source']}\n\nSHA256: {digest}\n\n````text\n{value.rstrip()}\n````\n\n")
summary=dict(lockfile_sha256=hashlib.sha256((ROOT/'package-lock.json').read_bytes()).hexdigest(),lock_entries=len(rows),exact_installed=sum(r['review']=='EXACT_INSTALLED_NOTICES' for r,_ in result),exact_archive=sum(r['review']=='EXACT_ARCHIVE_NOTICES' for r,_ in result),unresolved=[dict(path=r['lock_path'],reason=r['review']) for r,_ in result if r['review'] not in ('EXACT_INSTALLED_NOTICES','EXACT_ARCHIVE_NOTICES')],scope='Exact host plus optional lock artifacts. Final deployment bundle/Edge Deno dependencies and brand redistribution rights remain separate review gates.')
(TARGET/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(summary))
