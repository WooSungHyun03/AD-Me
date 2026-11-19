#!/usr/bin/env python3
"""One quota-unit API connectivity probe; never imports creator data or prints keys."""
from pathlib import Path
import json
import urllib.request
import urllib.error
from setup_resend import load_secrets

def main():
    values = load_secrets(Path(__file__).resolve().parents[1] / '.external-setup.local.env')
    key = values.get('YOUTUBE_API_KEY')
    if not key:
        print(json.dumps({'verified': False, 'reason': 'MISSING_YOUTUBE_API_KEY'}))
        return 2
    req = urllib.request.Request(
        'https://www.googleapis.com/youtube/v3/channels?part=id&id=UC_x5XG1OV2P6uZZ5FSM9Ttw',
        headers={'X-Goog-Api-Key': key})
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            result = json.load(response)
        ok = len(result.get('items', [])) == 1
        print(json.dumps({'verified': ok, 'channel_results': len(result.get('items', [])), 'creator_imported': False}))
        return 0 if ok else 1
    except urllib.error.HTTPError as error:
        print(json.dumps({'verified': False, 'http_status': error.code}))
        return 1
    except (OSError, ValueError):
        print(json.dumps({'verified': False, 'reason': 'NETWORK_OR_RESPONSE_ERROR'}))
        return 1

if __name__ == '__main__':
    raise SystemExit(main())
