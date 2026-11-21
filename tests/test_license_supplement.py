import base64, hashlib, importlib.util, io, json, tarfile, unittest, tempfile
from pathlib import Path

spec=importlib.util.spec_from_file_location('license_supplement',Path(__file__).resolve().parents[1]/'scripts/audit-license-supplement.py')
audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)

def archive(files):
    data=io.BytesIO()
    with tarfile.open(fileobj=data,mode='w:gz')as t:
        for name,value in files:
            info=tarfile.TarInfo(name);info.size=len(value);t.addfile(info,io.BytesIO(value))
    return data.getvalue()

def entry(data, name='sample', version='1.0.0', **extra):
    return dict(version=version,integrity='sha512-'+base64.b64encode(hashlib.sha512(data).digest()).decode(),resolved='https://registry.npmjs.org/'+name+'/-/sample.tgz',**extra)

class LicenseSupplementTests(unittest.TestCase):
    def test_output_hash_is_canonical_lf_and_recovered_text_is_not_legal_approval(self):
        parent=Path(__file__).resolve().parents[1]/'output';parent.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='license-audit-test-',dir=parent)as directory:
            root=Path(directory);self.assertTrue(root.resolve().is_relative_to(parent.resolve()))
            (root/'docs/licenses/20261121').mkdir(parents=True);(root/'public/legal').mkdir(parents=True)
            value=archive([('package/package.json',b'{"name":"sample","version":"1.0.0","license":"MIT"}'),('package/LICENSE',b'Exact upstream fixture notice\r\n')]);item=entry(value)
            (root/'package-lock.json').write_text(json.dumps({'packages':{'node_modules/sample':item}}),encoding='utf-8')
            (root/'docs/licenses/20261121/summary.json').write_text(json.dumps({'unresolved':[{'path':'node_modules/sample','reason':'EXACT_ARCHIVE_NOTICE_MISSING'}]}),encoding='utf-8')
            cache=root/'cache';cache.mkdir();(cache/(audit.digest(item['resolved'].encode())+'.tgz')).write_bytes(value)
            target=root/'docs/licenses/new';summary=audit.collect(root,target,cache)
            self.assertEqual(summary['notice_complete_claims'],0);self.assertEqual(summary['notice_text_recovered'],1)
            manifest=json.loads((target/'manifest.json').read_text());data=(target/'inventory.json').read_bytes()
            self.assertNotIn(b'\r\n',data);self.assertEqual(audit.digest(data),manifest['inventory_sha256_lf']);self.assertFalse(manifest['rights_approval'])
            with self.assertRaises(ValueError):audit.collect(root,target,cache)

    def test_nonstandard_root_checks_identity_and_preserves_disclosure_separately(self):
        data=archive([('sample/package.json',json.dumps(dict(name='@types/sample',version='1.0.0',license='MIT')).encode()),('sample/README.md',b'# sample\n\n## Licensing\nMIT declaration only.\n'),('sample/versions.json',b'{"native":"2.0.0"}')])
        packages={'node_modules/@types/sample':entry(data)}
        meta,files=audit.inspect_archive(data,'node_modules/@types/sample','node_modules/@types/sample',packages)
        self.assertEqual(meta['name'],'@types/sample')
        self.assertEqual({f['kind']for f in files},{'README_LICENSING_DISCLOSURE','BINARY_COMPONENT_VERSIONS'})
        self.assertTrue(all(f['kind']!='LICENSE_OR_NOTICE_TEXT'for f in files))
        self.assertEqual(files[0]['sha256'],hashlib.sha256(b'# sample\n\n## Licensing\nMIT declaration only.\n').hexdigest())

    def test_bundled_child_uses_exact_parent_and_never_inherits_parent_notice(self):
        files=[('package/package.json',b'{"name":"parent","version":"1.0.0"}'),('package/LICENSE',b'Parent permission text'),('package/node_modules/child/package.json',b'{"name":"child","version":"2.0.0","license":"MIT"}'),('package/node_modules/child/LICENSE',b'Child exact copyright and permission')]
        data=archive(files);packages={'node_modules/parent':entry(data),'node_modules/parent/node_modules/child':dict(version='2.0.0',inBundle=True)}
        path='node_modules/parent/node_modules/child';carrier=audit.carrier_for(path,packages)
        self.assertEqual(carrier,'node_modules/parent')
        _,notices=audit.inspect_archive(data,carrier,path,packages)
        self.assertEqual([f['text']for f in notices],['Child exact copyright and permission'])
        packages[path]['version']='3.0.0'
        with self.assertRaises(ValueError):audit.inspect_archive(data,carrier,path,packages)

    def test_sri_mismatch_traversal_duplicate_or_links_are_rejected(self):
        original=archive([('package/package.json',b'{"name":"sample","version":"1.0.0"}')]);item=entry(original)
        with self.assertRaises(ValueError):audit.verify_integrity(original+b'x',item['integrity'])
        for name in['../LICENSE','/LICENSE','package/../LICENSE','C:/LICENSE','package\\LICENSE']:
            data=archive([('package/package.json',b'{"name":"sample","version":"1.0.0"}'),(name,b'unsafe')]);packages={'node_modules/sample':entry(data)}
            with self.assertRaises(ValueError):audit.inspect_archive(data,'node_modules/sample','node_modules/sample',packages)
        data=archive([('package/package.json',b'{}'),('package/package.json',b'{}')])
        with self.assertRaises(ValueError):audit.inspect_archive(data,'node_modules/sample','node_modules/sample',{'node_modules/sample':entry(data)})
        data=io.BytesIO()
        with tarfile.open(fileobj=data,mode='w:gz')as t:
            info=tarfile.TarInfo('package/LICENSE');info.type=tarfile.SYMTYPE;info.linkname='/etc/passwd';t.addfile(info)
        value=data.getvalue()
        with self.assertRaises(ValueError):audit.inspect_archive(value,'node_modules/sample','node_modules/sample',{'node_modules/sample':entry(value)})

    def test_missing_carrier_and_unsafe_registry_urls_fail_closed(self):
        for url in['http://registry.npmjs.org/x','https://registry.npmjs.org.evil.test/x','https://user:pw@registry.npmjs.org/x','https://registry.npmjs.org:8443/x','https://registry.npmjs.org/x?token=x','https://127.0.0.1/x']:
            with self.assertRaises(ValueError):audit.registry_url(url)
        with self.assertRaises(ValueError):audit.carrier_for('node_modules/a',{'node_modules/a':dict(version='1.0.0')})

if __name__=='__main__':unittest.main()
