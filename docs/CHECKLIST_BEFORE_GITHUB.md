# GitHub Public Repo Preflight

- [ ] Git tracked files include no `.env.local`, secrets, tokens, billing key, phone/email of real people.
- [ ] `grep -R 'test_sk\|live_sk\|SUPABASE_SERVICE_ROLE_KEY=' --exclude-dir=.git .` manually inspect (never print real secrets to public logs).
- [ ] Permission/license of any third-party media, fonts, OSS libraries checked; copy necessary license/NOTICE.
- [ ] Real people/brands: obtain opt-in and permitted data evidence; synthetic fixtures marked DEMO.
- [ ] No competitor site assets or private creator datasets included.
- [ ] Test checkout only; live checkout code path disabled in demo.
- [ ] README says this is a non-commercial university demo and not actual verified endorsement/ads.
- [ ] No hardcoded demo auth bypass in deployed build.
- [ ] Database RLS and storage access reviewed.
- [ ] Security/rollback/limitations documented.
