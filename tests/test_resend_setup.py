import importlib.util
import unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('setup_resend',Path(__file__).resolve().parents[1]/'scripts/setup_resend.py')
setup=importlib.util.module_from_spec(spec);spec.loader.exec_module(setup)
class DnsSafetyTests(unittest.TestCase):
    def test_rejects_apex_and_other_domain(self):
        for name in ['be-celeb.org','attacker.be-celeb.org','other.invalid.be-celeb.org']:
            with self.assertRaises(setup.SetupError):
                setup.dns_plan([{'record':'DKIM','name':name,'type':'TXT','value':'publickey'}])
    def test_rejects_web_address_mutation(self):
        with self.assertRaises(setup.SetupError):
            setup.dns_plan([{'record':'DKIM','name':'resend._domainkey','type':'A','value':'1.2.3.4'}])
    def test_only_dkim_and_spf_under_mail_domain(self):
        plan=setup.dns_plan([{'record':'DKIM','name':'resend._domainkey','type':'TXT','value':'publickey'},{'record':'SPF','name':'send.mail.be-celeb.org','type':'MX','value':'feedback.provider.example','priority':10},{'record':'Tracking','name':'links','type':'CNAME','value':'tracker.example'}])
        self.assertEqual(len(plan),2)
        self.assertEqual(plan[0]['name'],'resend._domainkey.mail.be-celeb.org')
        self.assertTrue(all(x['name'].endswith('.mail.be-celeb.org') for x in plan))
    def test_preserves_exact_records_but_rejects_conflicting_existing_spf(self):
        item={'name':'send.mail.be-celeb.org','type':'TXT','content':'v=spf1 include:provider.example ~all'}
        self.assertEqual(setup.existing_action(item,[item]),'preserve')
        with self.assertRaises(setup.SetupError):setup.existing_action(item,[dict(item,content='v=spf1 -all')])
    def test_cname_conflict_is_not_overwritten(self):
        with self.assertRaises(setup.SetupError):setup.existing_action({'name':'send.mail.be-celeb.org','type':'TXT','content':'spf'},[{'name':'send.mail.be-celeb.org','type':'CNAME','content':'other.example'}])
if __name__=='__main__':unittest.main()
