"""Ensure the real delivery verifier accepts Git CRLF conversion but rejects SQL edits."""
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
PACKET = Path("deliverables/dev-a-independent-20261122")


class IndependentPacketIntegrity(unittest.TestCase):
    def test_crlf_is_portable_and_body_tampering_is_denied_without_database(self):
        manifest = json.loads((ROOT / PACKET / "MANIFEST.json").read_text(encoding="utf-8"))
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory)
            paths = [PACKET / "MANIFEST.json"] + [PACKET / row["path"] for row in manifest["files"]] + [Path(row["path"]) for row in manifest["sources"]]
            for path in paths:
                content = (ROOT / path).read_text(encoding="utf-8").replace("\r\n", "\n")
                (target / path).parent.mkdir(parents=True, exist_ok=True)
                (target / path).write_bytes(content.replace("\n", "\r\n").encode("utf-8"))
            def run():
                return subprocess.run(["node", str(ROOT / "scripts/verify-independent-packet.mjs"), "--integrity"], cwd=target, capture_output=True, text=True, encoding="utf-8")
            result = run()
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("no database accessed", result.stdout)
            with (target / PACKET / "01_apply_current_67.sql").open("ab") as stream:
                stream.write(b"select 1;\r\n")
            self.assertNotEqual(run().returncode, 0)
