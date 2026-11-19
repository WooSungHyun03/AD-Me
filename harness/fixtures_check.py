#!/usr/bin/env python3
"""Verify all bundled seed fixtures are fictional/test-only and internally consistent."""
import json
from pathlib import Path
p = Path(__file__).resolve().parents[1] / 'fixtures'
creators=json.loads((p/'creators.demo.json').read_text(encoding='utf-8'))
campaigns=json.loads((p/'campaigns.demo.json').read_text(encoding='utf-8'))
ads=json.loads((p/'ads.demo.json').read_text(encoding='utf-8'))
issues=json.loads((p/'issues.demo.json').read_text(encoding='utf-8'))
assert len(creators) == 48 and len(campaigns) == 8 and len(ads) >= 20
assert all(item['is_demo'] is True for group in (creators,campaigns,ads,issues) for item in group)
assert all(item['metrics_source'] == 'synthetic_demo_not_verified' for item in creators)
assert all(item['source_url'] is None for item in ads + issues)
assert all(item['public_visible'] is False for item in issues)
creator_ids={item['seed_id'] for item in creators}
assert len(creator_ids)==len(creators)
assert all(ad['creator_seed_id'] in creator_ids for ad in ads)
assert all(issue['creator_seed_id'] in creator_ids for issue in issues)
print(f'PASS: fictional fixtures {len(creators)} creators / {len(campaigns)} campaigns / {len(ads)} ads / {len(issues)} reviews')
