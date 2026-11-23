#!/usr/bin/env python3
"""Secret scanner (D078). Never prints credential material — only file names, kinds and short fingerprints.

  python3 harness/secret_scan.py              tracked + untracked (not ignored) files
  python3 harness/secret_scan.py --history    every blob in every commit of the Git history
  python3 harness/secret_scan.py --bundle     built client bundle (.next/static) — must hold no server secret
  python3 harness/secret_scan.py --artifacts  Playwright reports/traces (zip) and harness/evidence
  python3 harness/secret_scan.py --logs F...  given log files
  python3 harness/secret_scan.py --all        all of the above that exist
  python3 harness/secret_scan.py --keys       key status for rotation checks: name, present, length, sha256[:8], JWT role/iat
Besides the patterns, the exact values of server-only variables in .env.local (when present) are searched for.
"""
import base64
import hashlib
import json
import pathlib
import re
import subprocess
import sys
import zipfile

root = pathlib.Path(__file__).resolve().parents[1]
patterns = {
    "github token": r"gh[pousr]_[A-Za-z0-9]{30,}",
    "supabase secret key": r"sb_secret_[A-Za-z0-9_-]{20,}",
    "toss secret key": r"(?:test|live)_(?:sk|gsk)_[A-Za-z0-9]{16,}",
    "toss live client key": r"live_ck_[A-Za-z0-9]{16,}",
    "google api key": r"AIza[0-9A-Za-z_-]{35}",
    "private key": r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
    "vercel token": r"\bvercel_[A-Za-z0-9]{20,}",
}
JWT = re.compile(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+")
PRIVATE_FILES = (".vercel/", ".accounts.", ".auth/")


def env_file():
    p = root / ".env.local"
    if not p.exists():
        return {}
    out = {}
    for line in p.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip()
    return out


ENV = env_file()
# Server-only values worth matching literally (public NEXT_PUBLIC_* values are allowed in bundles).
SERVER_VALUES = {k: v for k, v in ENV.items() if not k.startswith("NEXT_PUBLIC_") and len(v) >= 16}


def jwt_claims(token):
    try:
        payload = token.split(".")[1]
        return json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
    except (ValueError, UnicodeError, IndexError):
        return {}


def scan_text(text, where, findings):
    for kind, pattern in patterns.items():
        if re.search(pattern, text):
            findings.append((where, kind))
    for token in JWT.findall(text):
        if jwt_claims(token).get("role") == "service_role":
            findings.append((where, "service-role JWT"))
    for name, value in SERVER_VALUES.items():
        if value in text:
            findings.append((where, f"value of server-only {name}"))


def private_path(path):
    return path.startswith(PRIVATE_FILES) or (
        path.split("/")[-1].startswith(".env") and path.split("/")[-1] not in (".env.example", ".env.test.example")
    )


def git(*args):
    return subprocess.check_output(["git", *args], cwd=root)


def scan_worktree(findings):
    tracked = git("ls-files", "-z").decode().split("\0")
    untracked = git("ls-files", "-z", "-o", "--exclude-standard").decode().split("\0")
    paths = [p for p in tracked + untracked if p]
    for path in paths:
        if private_path(path):
            findings.append((path, "private environment/account file is not ignored"))
            continue
        try:
            scan_text((root / path).read_text(), path, findings)
        except (UnicodeError, IsADirectoryError, FileNotFoundError):
            pass
    return f"{len(paths)} tracked/untracked files"


def scan_history(findings):
    objs = git("rev-list", "--all", "--objects").decode().splitlines()
    blobs = {}
    for line in objs:
        sha, _, name = line.partition(" ")
        if name:
            blobs.setdefault(sha, name)
    if not blobs:
        return "0 history blobs"
    proc = subprocess.run(
        ["git", "cat-file", "--batch"], cwd=root, input="\n".join(blobs).encode(), capture_output=True, check=True
    )
    data, i, n = proc.stdout, 0, 0
    while i < len(data):
        header_end = data.index(b"\n", i)
        sha, kind, size = data[i:header_end].decode().split()
        body = data[header_end + 1 : header_end + 1 + int(size)]
        i = header_end + 1 + int(size) + 1
        if kind != "blob":
            continue
        n += 1
        name = blobs[sha]
        if private_path(name):
            findings.append((f"history:{name}", "private environment/account file was committed"))
        try:
            scan_text(body.decode(), f"history:{name}@{sha[:8]}", findings)
        except UnicodeError:
            pass
    return f"{n} history blobs"


def scan_tree(base, findings, label):
    base = root / base
    if not base.exists():
        return f"{label}: absent"
    n = 0
    for p in base.rglob("*"):
        if not p.is_file():
            continue
        rel = p.relative_to(root).as_posix()
        if p.suffix == ".zip":  # Playwright traces: scan every entry (network logs, storage state)
            try:
                with zipfile.ZipFile(p) as z:
                    for entry in z.namelist():
                        n += 1
                        scan_text(z.read(entry).decode("utf-8", "ignore"), f"{rel}!{entry}", findings)
            except zipfile.BadZipFile:
                pass
            continue
        n += 1
        scan_text(p.read_bytes().decode("utf-8", "ignore"), rel, findings)
    return f"{label}: {n} files"


def scan_artifacts(findings):
    parts = [scan_tree(d, findings, d) for d in ("playwright-report", "test-results", "harness/evidence")]
    # Authenticated traces or browser storage state must never be part of the published evidence.
    for p in (root / "harness/evidence").rglob("*"):
        if p.is_file() and (p.suffix in (".zip", ".har") or re.search(r"storage[-_]?state", p.name, re.I)):
            findings.append((p.relative_to(root).as_posix(), "trace/storage state in evidence"))
    return ", ".join(parts)


def scan_logs(files, findings):
    for f in files:
        scan_text(pathlib.Path(f).read_text(errors="ignore"), f, findings)
    return f"{len(files)} log files"


def key_status():
    required = [
        "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY",
        "NEXT_PUBLIC_TOSS_CLIENT_KEY", "YOUTUBE_API_KEY", "NEXT_PUBLIC_APP_URL", "SERVICE_MODE",
    ]
    import os

    source = {**ENV}
    source.update({k: v for k, v in os.environ.items() if k in required})
    for k in required:
        v = source.get(k, "")
        info = "absent" if not v else f"present len={len(v)} sha256={hashlib.sha256(v.encode()).hexdigest()[:8]}"
        if v.startswith("eyJ"):
            c = jwt_claims(v)
            info += f" jwt role={c.get('role')} iat={c.get('iat')}"
        if k == "NEXT_PUBLIC_TOSS_CLIENT_KEY" and v:
            info += " mode=" + ("TEST" if v.startswith("test_") else "NOT-TEST(refuse)")
        if k.endswith("_URL") or k == "SERVICE_MODE":
            info = f"{'absent' if not v else 'present'}" + (f" value={v}" if v and not k.endswith("KEY") else "")
        print(f"{k}: {info}")


def main(argv):
    if "--keys" in argv:
        key_status()
        return 0
    findings, parts = [], []
    everything = "--all" in argv
    parts.append(scan_worktree(findings))
    if everything or "--history" in argv:
        parts.append(scan_history(findings))
    if everything or "--bundle" in argv:
        parts.append(scan_tree(".next/static", findings, "client bundle"))
    if everything or "--artifacts" in argv:
        parts.append(scan_artifacts(findings))
    if "--logs" in argv:
        parts.append(scan_logs(argv[argv.index("--logs") + 1 :], findings))
    if findings:
        for where, kind in sorted(set(findings)):
            print(f"FAIL {where}: {kind}")
        return 1
    print("PASS: " + "; ".join(parts) + "; no configured secret patterns, server-only values or private files.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
