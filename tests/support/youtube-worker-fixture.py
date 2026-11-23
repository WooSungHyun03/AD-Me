"""Return real worker projection from synthetic responses; all network access replaced."""
import importlib.util
import json
from pathlib import Path
import re
import sys
from unittest.mock import patch

channel = sys.argv[1]
if not re.fullmatch(r"UC[A-Za-z0-9_-]{22}", channel):
    raise ValueError("fixture channel required")
spec = importlib.util.spec_from_file_location("fixture_worker", Path(__file__).resolve().parents[2] / "scripts/intelligence_worker.py")
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)
ids = ["fixture%04d" % i for i in range(50)]
replies = [
    {"items": [{"id": channel, "snippet": {"title": "가상 수집 계약 QA"}, "statistics": {"subscriberCount": "0"}, "contentDetails": {"relatedPlaylists": {"uploads": "fictional"}}}]},
    {"items": [{"contentDetails": {"videoId": video}} for video in ids]},
    {"items": [{"id": video, "snippet": {"title": "가상 원본 영상", "publishedAt": "2026-11-01T00:00:00Z", "channelId": channel}, "statistics": {"viewCount": "0"}, "status": {"privacyStatus": "public"}} for video in ids]},
]
with patch.object(worker, "youtube", side_effect=replies):
    rows = worker.channels([channel])
rows[0]["metadata"].update({"handle": "@fictional-qa", "private_canary": "MUST_NOT_PERSIST"})
print(json.dumps(rows))
