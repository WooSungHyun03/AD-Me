"""Explicit optional actual CPU model QA; synthetic text only, no hosted/queue writes.

Requires the specifically labeled disposable container created for this batch.
Never stops another model process, downloads a model, or operates a shared GPU.
"""
import argparse
from contextlib import redirect_stdout
import io
import json
from pathlib import Path
import subprocess
import sys
import threading
import time
from urllib.request import urlopen

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import intelligence_worker as worker
from product_conditions import propose_product_conditions
from content_tags import generate_content_tags

CONTAINER='adme-model-qa-20261123'
OUTPUT=ROOT/'output/isolated-model-acceptance.local.json'

def fixture():
    value=json.loads(subprocess.check_output(['docker','inspect',CONTAINER],text=True))[0]
    assert value['Config']['Labels'].get('adme.qa')=='dev-a-20261123'
    assert value['HostConfig']['DeviceRequests']is None
    assert value['HostConfig']['PortBindings']=={'11434/tcp':[{'HostIp':'127.0.0.1','HostPort':'11539'}]}
    assert value['HostConfig']['NanoCpus']==4_000_000_000
    return value

def database_counts():
    return subprocess.check_output(['docker','exec','supabase_db_dev-a-db','psql','-U','postgres','-d','postgres','-At','-c',
        "select jsonb_build_object('orders',(select count(*)from public.orders),'messages',(select count(*)from public.messages),'campaigns',(select count(*)from public.campaigns))"],text=True).strip()

def run():
    container=fixture()
    with urlopen('http://127.0.0.1:11539/api/version',timeout=3)as response:runtime=json.load(response)
    with urlopen('http://127.0.0.1:11539/api/tags',timeout=3)as response:models=json.load(response)['models']
    model=next(m for m in models if m['name']==worker.MODEL)
    report={'scope':'actual disposable CPU Ollama/Qwen inference; fictional inputs and rights references; no hosted actions',
            'container':CONTAINER,'image':container['Image'],'runtime':runtime,'model':{'name':model['name'],'digest':model['digest'],'size':model['size'],'details':model['details']},
            'limits':{'cpu':4,'memoryBytes':container['HostConfig']['Memory'],'gpu':False,'parallel':1,'host':'127.0.0.1:11539'},
            'products':[],'tags':[],'databaseBefore':database_counts()}
    def save():OUTPUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    save()
    for index,topic in enumerate(['뷰티·패션','음식','테크·게임','건강·운동','라이프스타일'],1):
        started=time.monotonic()
        try:
            value=propose_product_conditions('가상 테스트 상품',f'{topic} 분야의 가상 상품을 제품 리뷰로 소개하고 싶습니다.','명시적 가상 성인 고객')
            item={'result':'PASS','suggestions':len(value['suggestions']),'omitted':value['omitted'],'sourceVersion':value['sourceVersion'],'usage':value['usage'],'applied':value['applied']}
        except worker.WorkerError as error:item={'result':'FAIL','error':str(error)}
        item.update(index=index,ms=round((time.monotonic()-started)*1000));report['products'].append(item);save()
        print(f"product {index}/5 {item['result']}",flush=True)
    for source in ['creator_provided','licensed']:
        started=time.monotonic()
        try:
            value=generate_content_tags(source,'FICTIONAL synthetic QA rights reference',['요리와 운동 이야기를 제품 리뷰로 소개합니다.','자연스러움 분위기로 카메라 사용 장면을 담았습니다.'])
            item={'sourceAssertion':source,'result':'PASS','tags':len(value['tags']),'review':value['review'],'sourceVersion':value['sourceVersion'],'usage':value['usage']}
        except worker.WorkerError as error:item={'sourceAssertion':source,'result':'FAIL','error':str(error)}
        item['ms']=round((time.monotonic()-started)*1000);report['tags'].append(item);save()
        print(f"tags {source} {item['result']}",flush=True)
    def progress(index,row):
        report['benchmarkProgress']={'samples':index,'last':row};save()
        if index%5==0:print(f"actual benchmark {index}/30",flush=True)
    output=io.StringIO()
    with redirect_stdout(output):worker.benchmark(30,progress)
    # Callback status is also captured; the final line is the structured report.
    report['benchmark']=json.loads(output.getvalue().splitlines()[-1]);save()
    result={}
    def interrupted_call():
        try:worker.draft('가상 제품의 긴 YouTube 기획 초안입니다. 광고 표기와 권리 확인을 포함하고 효능 수치는 만들지 마세요.');result['outcome']='completed'
        except worker.WorkerError as error:result['outcome']=str(error)
    fixture()
    thread=threading.Thread(target=interrupted_call,daemon=True);thread.start();time.sleep(.5)
    running=thread.is_alive()
    subprocess.run(['docker','stop','--time','0',CONTAINER],check=True,stdout=subprocess.DEVNULL)
    thread.join(5)
    result.update(wasInFlight=running,terminated=not thread.is_alive(),isolatedContainerOnly=True)
    fixture()
    subprocess.run(['docker','start',CONTAINER],check=True,stdout=subprocess.DEVNULL)
    ready=False
    for _ in range(20):
        try:
            with urlopen('http://127.0.0.1:11539/api/version',timeout=.5):ready=True;break
        except OSError:time.sleep(.5)
    result['runtimeReady']=ready
    if ready:
        try:
            value=worker.draft('재시작 후의 가상 제품 YouTube 기획입니다. 실제 제품 효능과 계약을 지어내지 마세요.')
            result['recovered']=True;result['recoveredUsage']=value['usage']
        except worker.WorkerError as error:result['recovered']=False;result['recoveryError']=str(error)
    report['restart']=result;report['databaseAfter']=database_counts();report['databaseCountsUnchanged']=report['databaseBefore']==report['databaseAfter'];save()
    print('PASS actual CPU model measurement completed; inspect receipt for per-case acceptance',flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--run',action='store_true');args=parser.parse_args()
    if not args.run:raise SystemExit('Explicit --run required; only the labeled disposable CPU container is allowed')
    run()
