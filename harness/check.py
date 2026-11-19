#!/usr/bin/env python3
"""Check harness integrity or run real project gates. Doesn't fake pass if no app exists."""
from __future__ import annotations
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = ['README.md', 'START_PROMPT.md', 'AGENTS.md', 'docs/PRD.md', 'docs/SCHEMA.md', 'docs/PAYMENTS.md', 'docs/QA.md', 'harness/tasks.json', 'public/brand/ad-me-logo.png']


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--mode', choices=['scaffold','all'], default='scaffold')
    args = p.parse_args()
    failures = []
    for name in REQUIRED:
        if not (ROOT / name).exists(): failures.append(f'Missing {name}')
    logo = ROOT / 'public/brand/ad-me-logo.png'
    if logo.exists() and logo.stat().st_size < 10000: failures.append('Logo unexpectedly small')
    if args.mode == 'scaffold':
        if failures: print('FAIL:', *failures, sep='\n- '); return 1
        print('PASS: starter files/logo exist. (This does NOT validate a built app.)'); return 0

    package = ROOT / 'package.json'
    if not package.exists():
        print('NOT READY: package.json absent. Agent must create Next.js app before full verification.'); return 3
    if failures: print('FAIL:', *failures, sep='\n- '); return 1
    if not shutil.which('npm'):
        print('BLOCKED: Node/npm not installed'); return 3
    try:
        scripts = json.loads(package.read_text(encoding='utf-8')).get('scripts',{})
    except (json.JSONDecodeError, OSError) as exc:
        print('INVALID package.json', exc); return 1
    required_scripts = ['lint','typecheck','test','build','test:e2e']
    missing = [s for s in required_scripts if s not in scripts]
    if missing:
        print('MISSING npm scripts:', ', '.join(missing)); return 1
    for command in [['npm','run',s] for s in required_scripts]:
        print('\nGATE:', ' '.join(command), flush=True)
        result = subprocess.run(command, cwd=ROOT)
        if result.returncode:
            print('FAIL:', ' '.join(command), 'exit', result.returncode)
            return result.returncode or 1
    print('PASS: all declared application gates executed successfully')
    return 0

if __name__ == '__main__': sys.exit(main())
