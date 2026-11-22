#!/usr/bin/env python3
"""Migration safety checks (D085).

  python3 harness/migration_check.py                 static rules (CI): naming/order, RLS on every new table,
                                                     SECURITY DEFINER pins search_path, destructive SQL only in
                                                     migrations the release manifest marks as contract, manifest
                                                     lists every migration exactly once
  python3 harness/migration_check.py --rollback-sim  local isolated Supabase only: reset to N-1, prove migration N
                                                     is atomic (rollback leaves schema identical, an injected
                                                     failure leaves nothing behind), then apply it for real
"""
import hashlib
import os
import pathlib
import re
import subprocess
import sys

root = pathlib.Path(__file__).resolve().parents[1]
MIG = root / "supabase/migrations"
MANIFEST = root / "docs/handoff/RELEASE_MANIFEST.md"
NAME = re.compile(r"^(\d{12})_[a-z0-9_]+\.sql$")
DESTRUCTIVE = re.compile(
    r"^\s*(drop\s+table|truncate|alter\s+table\s+[\w.]+\s+(drop\s+column|alter\s+column\s+\w+\s+type|rename))",
    re.I | re.M,
)


def manifest_rows():
    rows = {}
    if not MANIFEST.exists():
        return rows
    for line in MANIFEST.read_text().splitlines():
        m = re.match(r"^\|\s*`?(\d{12})`?\s*\|([^|]*)\|([^|]*)\|", line)
        if m:
            rows.setdefault(m.group(1), []).append(m.group(2).strip().lower())
    return rows


def strip_comments(sql):
    return re.sub(r"--[^\n]*", "", sql)


def static_check(files=None, manifest=None):
    errors = []
    files = files if files is not None else sorted(p.name for p in MIG.glob("*.sql"))
    manifest = manifest if manifest is not None else manifest_rows()
    versions = []
    for f in files:
        m = NAME.match(f)
        if not m:
            errors.append(f"{f}: name must be <12-digit version>_<snake>.sql")
            continue
        versions.append(m.group(1))
    if versions != sorted(versions) or len(set(versions)) != len(versions):
        errors.append("migration versions must be unique and increasing")
    for f in files:
        m = NAME.match(f)
        if not m:
            continue
        v = m.group(1)
        sql = strip_comments((MIG / f).read_text() if (MIG / f).exists() else "")
        for t in re.findall(r"create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)", sql, re.I):
            if not re.search(rf"alter\s+table\s+(?:public\.)?{t}\s+enable\s+row\s+level\s+security", sql, re.I):
                errors.append(f"{f}: table {t} has no RLS")
        for fn in re.finditer(r"create\s+(?:or\s+replace\s+)?function\s+([\w.]+)\s*\((.*?)\$\$", sql, re.I | re.S):
            if re.search(r"security\s+definer", fn.group(2), re.I) and not re.search(r"set\s+search_path", fn.group(2), re.I):
                errors.append(f"{f}: SECURITY DEFINER {fn.group(1)} must pin search_path")
        if v not in manifest:
            errors.append(f"{f}: missing from {MANIFEST.relative_to(root)}")
        elif len(manifest[v]) > 1:
            errors.append(f"{f}: listed more than once in the manifest")
        elif DESTRUCTIVE.search(sql) and "contract" not in manifest[v][0]:
            errors.append(f"{f}: destructive statement but manifest phase is not 'contract'")
    for v in manifest:
        if v not in versions:
            errors.append(f"manifest lists {v} but no such migration file")
    return errors


def psql(sql, check=True):
    return subprocess.run(
        ["docker", "exec", "-i", "supabase_db_AD-Me", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-qtA"],
        input=sql.encode(), capture_output=True, check=check,
    )


def schema_hash():
    out = subprocess.run(
        ["docker", "exec", "supabase_db_AD-Me", "pg_dump", "-U", "postgres", "--schema-only", "-n", "public", "-n", "storage"],
        capture_output=True, check=True,
    ).stdout
    # pg_dump emits a random \restrict token per run; ignore it.
    out = b"\n".join(l for l in out.splitlines() if not l.startswith((b"\\restrict", b"\\unrestrict")))
    return hashlib.sha256(out).hexdigest()


def rollback_sim():
    env = (root / ".env.local").read_text()
    if not re.search(r"^NEXT_PUBLIC_SUPABASE_URL=http://(127\.0\.0\.1|localhost):", env, re.M):
        sys.exit("refusing: --rollback-sim runs only against the local isolated Supabase")
    files = sorted(MIG.glob("*.sql"))
    last, prev = files[-1], files[-2]
    prev_v = NAME.match(prev.name).group(1)
    subprocess.run(["npx", "supabase@2", "db", "reset", "--version", prev_v], cwd=root, check=True, capture_output=True)
    before = schema_hash()
    body = last.read_text()
    psql(f"begin;\n{body}\nrollback;")
    assert schema_hash() == before, "rolled-back migration changed the schema"
    failed = psql(f"begin;\n{body}\nselect 1/0;\ncommit;", check=False)
    assert failed.returncode != 0, "injected failure did not fail"
    assert schema_hash() == before, "failed migration left partial changes"
    psql(body)  # forward apply (the CLI also runs each file in one transaction)
    v = NAME.match(last.name).group(1)
    psql(f"insert into supabase_migrations.schema_migrations(version, name) values ('{v}', '{last.stem[13:]}')")
    after = schema_hash()
    assert after != before, "migration had no effect"
    print(f"PASS rollback-sim: {last.name} atomic (rollback = identical schema {before[:8]}, injected failure = no partial change), applied → {after[:8]}")


if __name__ == "__main__":
    if "--rollback-sim" in sys.argv:
        rollback_sim()
        sys.exit(0)
    errs = static_check()
    for e in errs:
        print("FAIL", e)
    if errs:
        sys.exit(1)
    print(f"PASS: {len(list(MIG.glob('*.sql')))} migrations — naming/order, RLS, definer search_path, contract phases, manifest complete")
