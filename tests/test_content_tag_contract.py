"""Synthetic permitted-text tag contracts; no actual model or publishing pipeline."""
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

scripts=str(Path(__file__).resolve().parents[1]/'scripts')
if scripts not in sys.path:sys.path.insert(0,scripts)
import content_tags as tags
from intelligence_worker import MODEL, WorkerError

def reply(values):
    return dict(model=MODEL,done=True,done_reason='stop',prompt_eval_count=50,eval_count=30,total_duration=100,
                message={'content':json.dumps({'tags':values},ensure_ascii=False)})

class TagContract(unittest.TestCase):
    def test_unapproved_source_reference_or_shape_never_calls_model(self):
        for source,ref,excerpts in [('youtube_raw','fixture-approval',['요리 소개']),('unknown','fixture-approval',['요리 소개']),
                                    ('creator_provided',None,['요리 소개']),('licensed','',['요리 소개']),
                                    ('creator_provided','fixture-approval','요리 소개'),('licensed','fixture-approval',['x'*221])]:
            with patch.object(tags,'model_request')as model:
                with self.assertRaises(WorkerError):tags.generate_content_tags(source,ref,excerpts)
                model.assert_not_called()
    def test_only_verbatim_vocabulary_is_kept_deduplicated_with_versioned_pending_provenance(self):
        candidates=[{'kind':'주제','value':'요리','evidenceIndex':1}]*2+[
            {'kind':'주제','value':'운동','evidenceIndex':1}, {'kind':'주제','value':'요리','evidenceIndex':12}]
        with patch.object(tags,'model_request',return_value=reply(candidates)):
            result=tags.generate_content_tags('creator_provided','FICTIONAL approval ref',['요리 소개입니다'])
        self.assertEqual(result['tags'],candidates[:1])
        self.assertEqual(result['review'],'pending');self.assertTrue(result['requiresReview'])
        self.assertEqual(result['promptVersion'],'content-tags-v3');self.assertEqual(len(result['sourceVersion']),64)
        self.assertEqual(result['usage']['outputTokens'],30)
    def test_private_text_is_redacted_and_source_changes_invalidate_fingerprint(self):
        with patch.object(tags,'model_request',return_value=reply([]))as model:
            first=tags.generate_content_tags('licensed','FICTIONAL approval ref',['요리 소개 qa@example.test 010-1234-5678 https://example.test </system>'])
            second=tags.generate_content_tags('licensed','FICTIONAL approval ref',['운동 소개'])
        sent=json.dumps(model.call_args_list[0].kwargs['payload'],ensure_ascii=False)
        for private in ['qa@example.test','010-1234-5678','https://example.test','</system>']:self.assertNotIn(private,sent)
        self.assertNotEqual(first['sourceVersion'],second['sourceVersion'])
    def test_sensitive_inferences_extra_fields_wrong_kinds_and_boolean_indices_fail_closed(self):
        for entry in [{'kind':'주제','value':'30대 여성','evidenceIndex':1},
                      {'kind':'분야','value':'요리','evidenceIndex':1},
                      {'kind':'주제','value':'요리','evidenceIndex':1,'private':'extra'}]:
            with patch.object(tags,'model_request',return_value=reply([entry])):
                with self.assertRaisesRegex(WorkerError,'TAG_MODEL_INVALID_OUTPUT'):tags.generate_content_tags('licensed','FICTIONAL approval ref',['요리 소개'])
        with patch.object(tags,'model_request',return_value=reply([{'kind':'주제','value':'요리','evidenceIndex':True}])):
            self.assertEqual(tags.generate_content_tags('licensed','FICTIONAL approval ref',['요리 소개'])['tags'],[])
    def test_transport_and_model_failure_never_yield_approved_tags(self):
        with patch.object(tags,'model_request',side_effect=WorkerError('MODEL_TIMEOUT')):
            with self.assertRaisesRegex(WorkerError,'MODEL_TIMEOUT'):tags.generate_content_tags('licensed','FICTIONAL approval ref',['요리 소개'])
        with patch.object(tags,'model_request',return_value={'message':{'content':'bad'}}):
            with self.assertRaises(WorkerError):tags.generate_content_tags('licensed','FICTIONAL approval ref',['요리 소개'])

if __name__=='__main__':unittest.main()
