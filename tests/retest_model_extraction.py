"""Explicit actual-model extraction regression after a prompt fix, with no persistence/publication."""
import argparse
import json
from pathlib import Path
import sys
import time
from actual_model_acceptance import fixture
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import product_conditions as product
import content_tags as tags
from intelligence_worker import WorkerError

def run():
    fixture()
    report={'scope':'actual local CPU model on fictional text/reference only; no account/source approval or public writes',
            'productPromptVersion':product.PROMPT_VERSION,'tagPromptVersion':tags.PROMPT_VERSION,'products':[],'tags':[]}
    target=ROOT/'output/model-extraction-retest.local.json'
    def save():target.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    save()
    for index,topic in enumerate(['뷰티·패션','음식','테크·게임','건강·운동','라이프스타일'],1):
        started=time.monotonic()
        try:
            value=product.propose_product_conditions('가상 테스트 상품',f'{topic} 분야의 가상 상품을 제품 리뷰로 소개하고 싶습니다.','명시적 가상 성인 고객')
            pairs={(row['kind'],row['value'])for row in value['suggestions']}
            supported=('category',topic)in pairs and('format','제품 리뷰')in pairs
            item={'result':'PASS'if supported else 'FAIL','schemaValid':True,'expectedExplicitConditionsFound':supported,'suggestions':len(pairs),'omitted':value['omitted'],'sourceVersion':value['sourceVersion'],'usage':value['usage']}
        except WorkerError as error:item={'result':'FAIL','error':str(error)}
        item.update(index=index,ms=round((time.monotonic()-started)*1000));report['products'].append(item);save();print(f"product {index}/5 {item['result']}",flush=True)
    for source in ['creator_provided','licensed']:
        started=time.monotonic()
        try:
            value=tags.generate_content_tags(source,'FICTIONAL synthetic QA rights reference',['요리와 운동 이야기를 제품 리뷰로 소개합니다.','자연스러움 분위기로 카메라 사용 장면을 담았습니다.'])
            item={'sourceAssertion':source,'result':'PASS'if value['tags']else'FAIL','tags':len(value['tags']),'review':value['review'],'usage':value['usage'],'sourceVersion':value['sourceVersion']}
        except WorkerError as error:item={'sourceAssertion':source,'result':'FAIL','error':str(error)}
        item['ms']=round((time.monotonic()-started)*1000);report['tags'].append(item);save();print(f"tags {source} {item['result']}",flush=True)
    report['result']='PASS'if all(row['result']=='PASS'for row in report['products']+report['tags'])else'FAIL'
    save()
    return 0 if report['result']=='PASS'else 1

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--run',action='store_true');args=p.parse_args()
    if not args.run:raise SystemExit('Explicit --run and labeled disposable CPU container required')
    raise SystemExit(run())
