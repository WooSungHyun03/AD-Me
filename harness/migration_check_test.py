#!/usr/bin/env python3
"""Negative tests for migration_check static rules (D085). No database needed."""
import pathlib
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import migration_check as mc


class StaticRules(unittest.TestCase):
    def run_with(self, files, manifest):
        with tempfile.TemporaryDirectory() as d:
            mc.MIG = pathlib.Path(d)
            for name, sql in files.items():
                (mc.MIG / name).write_text(sql)
            return mc.static_check(sorted(files), manifest)

    def test_repository_passes(self):
        mc.MIG = mc.root / "supabase/migrations"
        self.assertEqual([], mc.static_check())

    def test_table_without_rls(self):
        e = self.run_with({"202601010001_a.sql": "create table public.t(id int);"}, {"202601010001": ["expand"]})
        self.assertTrue(any("no RLS" in x for x in e))

    def test_definer_without_search_path(self):
        sql = "create function public.f() returns int language sql security definer as $$ select 1 $$;"
        e = self.run_with({"202601010001_a.sql": sql}, {"202601010001": ["expand"]})
        self.assertTrue(any("search_path" in x for x in e))

    def test_destructive_needs_contract(self):
        files = {"202601010001_a.sql": "drop table old_things;"}
        self.assertTrue(any("contract" in x for x in self.run_with(files, {"202601010001": ["expand"]})))
        self.assertEqual([], self.run_with(files, {"202601010001": ["contract"]}))

    def test_destructive_in_comment_ignored(self):
        self.assertEqual([], self.run_with({"202601010001_a.sql": "-- drop table x;\nselect 1;"}, {"202601010001": ["expand"]}))

    def test_manifest_drift_and_naming(self):
        e = self.run_with({"202601010001_a.sql": "select 1;", "bad.sql": "select 1;"}, {"202601010009": ["expand"]})
        self.assertTrue(any("missing from" in x for x in e))
        self.assertTrue(any("no such migration" in x for x in e))
        self.assertTrue(any("bad.sql" in x for x in e))


if __name__ == "__main__":
    unittest.main()
