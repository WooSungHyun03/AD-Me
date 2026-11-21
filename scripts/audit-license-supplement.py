"""Read integrity-pinned npm archives as data; do not install or execute packages.

README disclosures and license declarations are NOT equivalent to a complete notice.
Existing inventories and shipped files remain immutable. New output must not exist.
"""
from pathlib import Path, PurePosixPath
import argparse, base64, csv, hashlib, io, json, re, tarfile, urllib.parse, urllib.request

ROOT = Path(__file__).resolve().parents[1]
MAX_ARCHIVE = 64 * 1024 * 1024
MAX_UNPACKED = 256 * 1024 * 1024
MAX_TEXT = 4 * 1024 * 1024
NOTICE = re.compile(r'^(licen[cs]e|notice|copying|copyright)([._-].*)?$', re.I)

def digest(data):
    return hashlib.sha256(data).hexdigest()

def package_name(path):
    return path.rsplit('node_modules/', 1)[-1]

def verify_integrity(data, integrity):
    if len(data) > MAX_ARCHIVE:
        raise ValueError('archive size limit')
    algorithm, encoded = integrity.split('-', 1)
    if algorithm not in ('sha512', 'sha256'):
        raise ValueError('strong pinned integrity required')
    expected = base64.b64decode(encoded, validate=True)
    if hashlib.new(algorithm, data).digest() != expected:
        raise ValueError('archive integrity mismatch')

def registry_url(url):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != 'https' or parsed.hostname != 'registry.npmjs.org' or parsed.username or parsed.password or parsed.port not in (None, 443) or parsed.fragment or parsed.query:
        raise ValueError('unapproved registry URL')
    return url

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('registry redirects are not accepted')

def archive_bytes(item, cache):
    url = registry_url(item['resolved'])
    path = cache / (digest(url.encode()) + '.tgz')
    if path.exists():
        if path.stat().st_size > MAX_ARCHIVE:
            raise ValueError('cached archive size limit')
        value = path.read_bytes()
    else:
        request = urllib.request.Request(url, headers={'User-Agent': 'AD-Me-license-data-review'})
        with urllib.request.build_opener(NoRedirect).open(request, timeout=30) as response:
            registry_url(response.geturl())
            value = response.read(MAX_ARCHIVE + 1)
        verify_integrity(value, item['integrity'])
        cache.mkdir(parents=True, exist_ok=True)
        path.write_bytes(value)
    verify_integrity(value, item['integrity'])
    return value

def carrier_for(path, packages):
    current = path
    while not packages[current].get('resolved'):
        if not packages[path].get('inBundle') or '/node_modules/' not in current:
            raise ValueError('missing reviewed archive carrier')
        current = current.rsplit('/node_modules/', 1)[0]
        if current not in packages:
            raise ValueError('unknown archive carrier')
    return current

def inspect_archive(data, carrier, target_path, packages):
    verify_integrity(data, packages[carrier]['integrity'])
    target = packages[target_path]
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as archive:
        members, seen, total = {}, set(), 0
        for member in archive:
            parts = PurePosixPath(member.name).parts
            if len(seen) >= 100000 or member.name in seen or not parts or member.name.startswith('/') or '\\' in member.name or '..' in parts or ':' in parts[0]:
                raise ValueError('unsafe/duplicate archive path')
            seen.add(member.name)
            if member.isdir():
                continue
            if not member.isfile():
                raise ValueError('archive links or special entries are not accepted')
            total += member.size
            if member.size < 0 or total > MAX_UNPACKED:
                raise ValueError('expanded archive size limit')
            members[member.name] = member

        def read(name):
            member = members[name]
            if member.size > MAX_TEXT:
                raise ValueError('text size limit')
            value = archive.extractfile(member).read(MAX_TEXT + 1)
            if len(value) != member.size:
                raise ValueError('invalid archive text size')
            value.decode('utf-8')
            return value

        roots = []
        # npm archives are not required to use package/; @types/json5 uses json5/.
        for name in members:
            if name.count('/') != 1 or not name.endswith('/package.json'):
                continue
            meta = json.loads(read(name))
            if meta.get('name') == package_name(carrier) and meta.get('version') == packages[carrier]['version']:
                roots.append(name.rsplit('/', 1)[0])
        if len(roots) != 1:
            raise ValueError('carrier package name/version mismatch')
        prefix = roots[0] + ('/' + target_path[len(carrier) + 1:] if target_path != carrier else '')
        meta = json.loads(read(prefix + '/package.json'))
        if meta.get('name') != package_name(target_path) or meta.get('version') != target['version']:
            raise ValueError('target package name/version mismatch')
        files = []
        for name in sorted(members):
            if not name.startswith(prefix + '/'):
                continue
            local = name[len(prefix) + 1:]
            if local.startswith('node_modules/'):
                continue
            kind = 'LICENSE_OR_NOTICE_TEXT' if NOTICE.match(PurePosixPath(local).name) else None
            if local.lower() == 'readme.md':
                value = read(name)
                if re.search(rb'(?im)^#{1,3}\s+licen[cs]ing\s*$', value):
                    kind = 'README_LICENSING_DISCLOSURE'
            elif local == 'versions.json':
                value = read(name)
                parsed = json.loads(value)
                if not isinstance(parsed, dict) or not all(isinstance(k, str) and isinstance(v, str) for k, v in parsed.items()):
                    raise ValueError('invalid component version map')
                kind = 'BINARY_COMPONENT_VERSIONS'
            if kind:
                value = read(name)
                files.append(dict(path=name, kind=kind, sha256=digest(value), bytes=len(value), text=value.decode('utf-8')))
        return meta, files

def collect(root, output, cache):
    if output.exists():
        raise ValueError('choose a new output; prior evidence is immutable')
    lock_bytes = (root / 'package-lock.json').read_bytes()
    lock = json.loads(lock_bytes)
    old = json.loads((root / 'docs/licenses/20261121/summary.json').read_text(encoding='utf-8'))
    results, sections = [], []
    for prior in old['unresolved']:
        path = prior['path']
        row = dict(path=path, version=lock['packages'][path]['version'], previous_review=prior['reason'], notice_complete=False)
        try:
            carrier = carrier_for(path, lock['packages'])
            item = lock['packages'][carrier]
            data = archive_bytes(item, cache)
            metadata, files = inspect_archive(data, carrier, path, lock['packages'])
            row.update(carrier=carrier, source=item['resolved'], archive_integrity=item['integrity'], archive_sha256=digest(data), package_metadata_verified=True, declared_license=metadata.get('license', 'UNKNOWN'), files=[{k: v for k, v in f.items() if k != 'text'} for f in files])
            kinds = {f['kind'] for f in files}
            if 'LICENSE_OR_NOTICE_TEXT' in kinds:
                row['review'] = 'EXACT_ARCHIVE_NOTICE_TEXT_RECOVERED'
            elif 'README_LICENSING_DISCLOSURE' in kinds:
                row['review'] = 'EXACT_README_DISCLOSURE_REVIEW_REQUIRED'
            else:
                row['review'] = 'DECLARATION_ONLY_NOTICE_UNRESOLVED'
            # Capturing exact material is not approval of all terms or static dependencies.
            for f in files:
                sections.append(f"\n===== {path}@{row['version']} / {f['path']} =====\nSource: {row['source']}\nIntegrity: {row['archive_integrity']}\nMaterial: {f['kind']}\nSHA256 (original bytes): {f['sha256']}\n\n{f['text']}\n")
        except (ValueError, KeyError, OSError, tarfile.TarError) as error:
            row.update(review='ARTIFACT_REVIEW_BLOCKED', package_metadata_verified=False, failure=type(error).__name__)
        results.append(row)
    body = ('AD Me — supplemental exact distribution materials\n\nThis file preserves licensing disclosures/version maps recovered from integrity-pinned npm archives. README summaries and declared SPDX identifiers do not replace complete copyright/permission texts, source or relinking obligations, or rights review. Unresolved packages remain unresolved; no legal approval is asserted.\n' + ''.join(sections)).encode('utf-8')
    public = root / 'public/legal/third-party-supplement-20261122.txt'
    if public.exists():
        raise ValueError('supplement output already exists')
    output.mkdir(parents=True)
    public.write_bytes(body)
    summary = dict(total_previous_unresolved=len(results),metadata_verified=sum(r['package_metadata_verified'] for r in results),archive_blocked=sum(r['review']=='ARTIFACT_REVIEW_BLOCKED' for r in results),notice_text_recovered=sum(r['review']=='EXACT_ARCHIVE_NOTICE_TEXT_RECOVERED' for r in results),readme_disclosures=sum(r['review']=='EXACT_README_DISCLOSURE_REVIEW_REQUIRED' for r in results),declaration_only=sum(r['review']=='DECLARATION_ONLY_NOTICE_UNRESOLVED' for r in results),notice_complete_claims=0,rights_approval=False)
    for name, value in [('inventory.json', results), ('summary.json', summary)]:
        (output / name).write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8', newline='\n')
    manifest = dict(lockfile_sha256_lf=digest(lock_bytes.replace(b'\r\n', b'\n')),shipped_path=public.relative_to(root).as_posix(),sha256=digest(body),bytes=len(body),inventory_sha256_lf=digest((output/'inventory.json').read_bytes()),source_scope='Exact npm archives and bundled carrier; no package installation/execution or third-party outreach',rights_approval=False)
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8', newline='\n')
    return summary

if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--output', default='docs/licenses/20261122-supplement')
    args = parser.parse_args()
    target = (ROOT / args.output).resolve()
    if not target.is_relative_to(ROOT / 'docs/licenses'):
        raise ValueError('output must stay within docs/licenses')
    print(json.dumps(collect(ROOT, target, ROOT / 'output/license-artifacts-20261121')))
