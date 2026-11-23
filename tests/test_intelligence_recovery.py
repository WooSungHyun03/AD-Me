"""Provider-free worker contract tests; never makes outbound requests."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('adme_worker',Path(__file__).resolve().parents[1]/'scripts/intelligence_worker.py')
worker=importlib.util.module_from_spec(spec);spec.loader.exec_module(worker)
A='UC'+'a'*22;B='UC'+'b'*22

class Recovery(unittest.TestCase):
 def test_invalid_counts_are_missing_and_never_coerced_to_fake_numbers(self):
  for value in [None,True,False,-1,1.5,'-1','1.5','9007199254740992','not-count']:
   self.assertIsNone(worker.optional_count({'n':value},'n'))
  self.assertEqual(worker.optional_count({'n':'0'},'n'),0)
  self.assertEqual(worker.optional_count({'n':'345'},'n'),345)
 def test_foreign_video_cannot_be_joined_to_requested_channel(self):
  replies=[{'items':[{'id':A,'snippet':{'title':'fictional'},'contentDetails':{'relatedPlaylists':{'uploads':'fictional'}}}]},{'items':[{'contentDetails':{'videoId':'fictional01'}}]},{'items':[{'id':'fictional01','snippet':{'title':'fictional','publishedAt':'2026-01-01T00:00:00Z','channelId':B},'status':{'privacyStatus':'public'}}]}]
  with patch.object(worker,'youtube',side_effect=replies)as api:
   with self.assertRaisesRegex(worker.WorkerError,'UPSTREAM_INVALID_RESPONSE'):worker.channels([A])
   self.assertEqual(api.call_count,3)
 def test_invalid_playlist_id_stops_before_video_fetch(self):
  replies=[{'items':[{'id':A,'snippet':{'title':'fictional'},'contentDetails':{'relatedPlaylists':{'uploads':'fictional'}}}]},{'items':[{'contentDetails':{'videoId':'bad'}}]}]
  with patch.object(worker,'youtube',side_effect=replies)as api:
   with self.assertRaisesRegex(worker.WorkerError,'UPSTREAM_INVALID_RESPONSE'):worker.channels([A])
   self.assertEqual(api.call_count,2)
 def test_refresh_only_does_not_spend_search_quota(self):
  job={'id':'fixture','lease':'fixture-lease','kind':'youtube_daily','input':'fictional','policyVersion':'fixture','refresh':[A]}
  def rpc(name,**kwargs):
   if name=='ops_worker_heartbeat':return True
   return {'version':1,'candidates':[A],'completed':[A] if kwargs.get('p_result') else []}
  with patch.object(worker,'rpc',side_effect=rpc),patch.object(worker,'channels',return_value=[{'id':A}]) as channels,patch.object(worker,'youtube') as api:
   self.assertEqual(worker.process(job),[]);channels.assert_called_once_with([A]);api.assert_not_called()
 def test_wrong_channel_response_rejected_before_followup_requests(self):
  with patch.object(worker,'youtube',return_value={'items':[{'id':B,'snippet':{'title':'fictional'}}]}) as api:
   with self.assertRaisesRegex(worker.WorkerError,'UPSTREAM_INVALID_RESPONSE'):worker.channels([A])
   self.assertEqual(api.call_count,1)
 def test_resume_only_uncommitted_channel(self):
  job={'id':'fixture','lease':'fixture-lease','kind':'youtube_daily','input':'fictional','policyVersion':'fixture','checkpoint':{'version':1,'candidates':[A,B],'completed':[A]}}
  def rpc(name,**kwargs):
   if name=='ops_worker_heartbeat':return True
   return {'version':1,'candidates':[A,B],'completed':[A,B]}
  with patch.object(worker,'rpc',side_effect=rpc),patch.object(worker,'channels',return_value=[{'id':B}]) as channels,patch.object(worker,'youtube') as api:
   self.assertEqual(worker.process(job),[]);channels.assert_called_once_with([B]);api.assert_not_called()
 def test_saved_checkpoint_survives_lost_ack(self):
  checkpoint={'version':1,'candidates':[A],'completed':[]};calls=[]
  job={'id':'fixture','lease':'fixture-lease','kind':'youtube_channel','input':A,'policyVersion':'fixture','checkpoint':checkpoint}
  def rpc(name,**kwargs):
   if name=='ops_worker_heartbeat':return True
   checkpoint['completed']=[A];raise worker.WorkerError('SIMULATED_LOST_ACK')
  with patch.object(worker,'rpc',side_effect=rpc),patch.object(worker,'channels',side_effect=lambda ids:calls.append(ids) or [{'id':A}]):
   with self.assertRaises(worker.WorkerError):worker.process(job)
   job['checkpoint']=checkpoint.copy();self.assertEqual(worker.process(job),[])
  self.assertEqual(calls,[[A]])
 def test_lost_lease_prevents_provider_call(self):
  job={'id':'fixture','lease':'old-lease','kind':'youtube_channel','input':A,'policyVersion':'fixture','checkpoint':{'version':1,'candidates':[A],'completed':[]}}
  with patch.object(worker,'rpc',return_value=False),patch.object(worker,'channels') as channels:
   with self.assertRaisesRegex(worker.WorkerError,'LEASE_LOST'):worker.process(job)
   channels.assert_not_called()

if __name__=='__main__':unittest.main()
