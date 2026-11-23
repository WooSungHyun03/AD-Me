"""Actual disposable loopback HTTP transport tests; the server is not Ollama."""
import importlib.util
import io
import json
import os
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import threading
import time
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('transport_worker',Path(__file__).resolve().parents[1]/'scripts/intelligence_worker.py')
worker=importlib.util.module_from_spec(spec);spec.loader.exec_module(worker)

class Handler(BaseHTTPRequestHandler):
    mode='success'
    count=0
    started=threading.Event()
    release=threading.Event()
    def log_message(self,*args):pass
    def do_POST(self):
        type(self).count+=1
        self.rfile.read(int(self.headers['Content-Length']))
        type(self).started.set()
        mode=type(self).mode
        if mode=='never':
            type(self).release.wait(1)
            return
        if mode=='blocking':type(self).release.wait(1)
        if mode=='redirect':
            self.send_response(302);self.send_header('Location','https://example.invalid/private');self.end_headers();return
        self.send_response(200)
        self.send_header('Content-Type','application/json')
        self.send_header('Content-Length','2097153'if mode=='large'else '3'if mode=='invalid'else '16')
        self.end_headers()
        if mode=='large':return
        body=b'bad'if mode=='invalid'else b'{"fixture":true}'
        # The normal fixture is16 bytes; no actual model or subject data.
        try:self.wfile.write(body)
        except (OSError,BrokenPipeError):pass

class Transport(unittest.TestCase):
    def setUp(self):
        worker._model_failures=0;worker._model_open_until=0
        Handler.mode='success';Handler.count=0;Handler.started.clear();Handler.release.clear()
        self.server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
        self.port=patch.object(worker,'MODEL_PORT',self.server.server_port);self.port.start()
    def tearDown(self):
        Handler.release.set();self.port.stop();self.server.shutdown();self.server.server_close();self.thread.join(1)
    def call(self,timeout=.3):return worker.model_request('/api/chat',{'model':'SYNTHETIC TRANSPORT SERVER'},timeout)
    def test_success_ignores_external_proxy_environment(self):
        with patch.dict(os.environ,{'HTTP_PROXY':'http://127.0.0.1:1','HTTPS_PROXY':'http://127.0.0.1:1','NO_PROXY':''}):
            self.assertEqual(self.call(),{'fixture':True})
        self.assertEqual(Handler.count,1)
    def test_wall_deadline_closes_a_never_responding_socket_and_recovers(self):
        Handler.mode='never';start=time.monotonic()
        with self.assertRaisesRegex(worker.WorkerError,'MODEL_TIMEOUT'):self.call(.05)
        self.assertLess(time.monotonic()-start,.5)
        Handler.release.set();Handler.mode='success'
        self.assertEqual(self.call(),{'fixture':True})
        self.assertEqual(worker._model_failures,0)
    def test_redirect_and_oversize_are_not_followed_or_retried(self):
        for mode,code in [('redirect','MODEL_HTTP_302'),('large','UPSTREAM_RESPONSE_TOO_LARGE')]:
            Handler.mode=mode
            with self.assertRaisesRegex(worker.WorkerError,code):self.call()
        self.assertEqual(Handler.count,2)
    def test_three_transport_failures_open_circuit_without_another_call_then_probe_recovers(self):
        Handler.mode='invalid'
        for _ in range(3):
            with self.assertRaisesRegex(worker.WorkerError,'MODEL_UNAVAILABLE'):self.call()
        with self.assertRaisesRegex(worker.WorkerError,'MODEL_CIRCUIT_OPEN'):self.call()
        self.assertEqual(Handler.count,3)
        worker._model_open_until=time.monotonic()-1
        Handler.mode='success';self.assertEqual(self.call(),{'fixture':True})
        self.assertEqual(worker._model_failures,0)
    def test_one_inflight_per_process_fails_fast_on_second_call(self):
        Handler.mode='blocking';result=[]
        thread=threading.Thread(target=lambda:result.append(self.call(1)),daemon=True);thread.start()
        self.assertTrue(Handler.started.wait(.5))
        with self.assertRaisesRegex(worker.WorkerError,'MODEL_BUSY'):self.call()
        self.assertEqual(Handler.count,1)
        Handler.release.set();thread.join(1)
        self.assertEqual(result,[{'fixture':True}])
    def test_bad_paths_payload_or_timeouts_fail_before_network(self):
        for path,payload,timeout in [('https://external.invalid',{},.1),('/api/pull',{},.1),('/api/chat',[],.1),('/api/chat',{'s':'x'*65537},.1),('/api/chat',{},True),('/api/chat',{},161),('/api/chat',{},float('nan'))]:
            with self.assertRaisesRegex(worker.WorkerError,'MODEL_INPUT_INVALID'):worker.model_request(path,payload,timeout)
        self.assertEqual(Handler.count,0)
    def test_benchmark_counts_failures_separately_and_requires_30_samples(self):
        for count in [3,29,101,True]:
            with self.assertRaisesRegex(worker.WorkerError,'BENCHMARK_INPUT_INVALID'):worker.benchmark(count)
        output=io.StringIO()
        replies=[{}]*29+[worker.WorkerError('SYNTHETIC_FAILURE')]
        with patch.object(worker,'draft',side_effect=replies),redirect_stdout(output):worker.benchmark(30)
        report=json.loads(output.getvalue())
        self.assertEqual(report['successes'],29)
        self.assertAlmostEqual(report['failureRate'],1/30)
        self.assertEqual(len(report['cases']),30)
        self.assertNotIn('concept',report)

if __name__=='__main__':unittest.main()
