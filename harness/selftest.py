#!/usr/bin/env python3
"""Self-tests for task harness, no app or API credentials required."""
from __future__ import annotations
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import loop

class HarnessTests(unittest.TestCase):
    def setUp(self): self.data = loop.load()

    def test_schema_and_dependencies(self):
        self.assertEqual([], loop.validate(self.data))

    def test_ready_sorted_and_dependencies_satisfied(self):
        ranks = [loop.PRIORITY[t['priority']] for t in loop.ready(self.data)]
        self.assertEqual(ranks, sorted(ranks))
        m = loop.task_map(self.data)
        for t in loop.ready(self.data):
            self.assertTrue(all(m[d]['status'] == 'done' for d in t['dependencies']))

    def test_cyclic_dependency_rejected(self):
        data = {'tasks':[{'id':'A','dependencies':['B'],'status':'pending','priority':'P0','acceptance':['x']}, {'id':'B','dependencies':['A'],'status':'pending','priority':'P0','acceptance':['x']}]}
        self.assertTrue(any('cycle' in e for e in loop.validate(data)))

    def test_done_without_evidence_rejected(self):
        self.data['tasks'][0]['status']='done'
        self.data['tasks'][0]['evidence']=None
        self.assertTrue(any('without evidence' in e for e in loop.validate(self.data)))

    def test_blocked_without_reason_rejected(self):
        self.data['tasks'][0]['status']='blocked'
        self.assertTrue(any('without reason' in e for e in loop.validate(self.data)))

if __name__ == '__main__': unittest.main(verbosity=2)
