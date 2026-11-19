#!/usr/bin/env python3
"""Scan Git-indexed content without printing credential material."""
import base64
import json
import pathlib
import re
import subprocess
import sys
root=pathlib.Path(__file__).resolve().parents[1]
paths=sorted(set(subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=root).decode().split('\0')))
patterns=[r'gh[pousr]_[A-Za-z0-9]{30,}',r'sb_secret_[A-Za-z0-9_-]{20,}',r'(?:test|live)_(?:sk|gsk)_[A-Za-z0-9]{16,}',r'-----BEGIN (?:RSA |EC )?PRIVATE KEY-----']
findings=[]
for path in filter(None,paths):
 if path.startswith(('.vercel/','.accounts.')) or (path.startswith('.env') and path!='.env.example'):
  findings.append((path,'private environment/account file'))
 try:text=(root/path).read_text()
 except (UnicodeError,IsADirectoryError,FileNotFoundError):continue
 if any(re.search(pattern,text) for pattern in patterns):findings.append((path,'credential-like content'))
 for token in re.findall(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+',text):
  try:
   payload=token.split('.')[1];claims=json.loads(base64.urlsafe_b64decode(payload+'='*(-len(payload)%4)))
   if claims.get('role')=='service_role':findings.append((path,'service-role JWT'))
  except (ValueError,UnicodeError):pass
if findings:
 for path,kind in findings:print(f'FAIL {path}: {kind}')
 sys.exit(1)
print(f'PASS: {sum(bool(p) for p in paths)} tracked and untracked non-ignored files; no configured secret patterns or private account/env files.')
