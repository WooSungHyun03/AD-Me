#!/usr/bin/env python3
"""Operator-authorized Resend/Cloudflare setup. Secrets stay local; no email is sent.
Default: inspect only. --apply adds only provider-required DNS under mail.be-celeb.org.
Does not touch apex/web/MX records or purchase/upgrade a service.
"""
from pathlib import Path
import argparse
import json
import os
import sys
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parents[1]
DOMAIN = 'mail.be-celeb.org'
ZONE = 'be-celeb.org'
class SetupError(Exception):
    pass

def load_secrets(path):
    values = {}
    for line in path.read_text().splitlines():
        if line.strip() and not line.lstrip().startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values

def request(base, path, token, method='GET', body=None):
    req = urllib.request.Request(base + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'User-Agent': 'AD-Me-operator-setup/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=25) as response:
            data = json.load(response)
    except urllib.error.HTTPError as error:
        # Never print remote payloads, request headers, or credential values.
        raise SetupError(f'{method} {path.split("?")[0]}: HTTP {error.code}') from None
    except (OSError, ValueError):
        raise SetupError(f'{method} {path.split("?")[0]}: network/response error') from None
    if isinstance(data, dict) and data.get('success') is False:
        raise SetupError(f'{method} {path.split("?")[0]}: provider rejected request')
    return data

def dns_plan(records):
    """Reject attempts to replace web records, apex mail, or third-party hosts."""
    plan = []
    for record in records:
        if record.get('record') not in ('SPF', 'DKIM'):
            continue  # no tracking/receiving records requested
        kind = record.get('type')
        name = str(record.get('name', '')).rstrip('.')
        if name == '@':
            name = DOMAIN
        elif not name.endswith('.' + ZONE) and name != ZONE:
            name = name + '.' + DOMAIN
        if not (name == DOMAIN or name.endswith('.' + DOMAIN)):
            raise SetupError('DNS response escaped mail subdomain')
        if kind not in ('TXT', 'MX', 'CNAME') or not record.get('value'):
            raise SetupError('Unexpected DNS record type/content')
        item = {'type': kind, 'name': name, 'content': record['value'], 'ttl': 1}
        if kind == 'MX':
            item['priority'] = int(record.get('priority', 10))
        if kind == 'CNAME':
            item['proxied'] = False
        plan.append(item)
    if not any(x['type'] == 'TXT' and '_domainkey' in x['name'] for x in plan):
        raise SetupError('Provider did not return a DKIM verification record')
    return plan

def existing_action(item, existing):
    same = [x for x in existing if x.get('type') == item['type'] and x.get('name', '').rstrip('.') == item['name']]
    for current in same:
        if current.get('content', '').strip('"').rstrip('.') == item['content'].strip('"').rstrip('.') and (item['type'] != 'MX' or current.get('priority') == item.get('priority')):
            return 'preserve'
    if same:
        raise SetupError('Conflicting existing DNS; no overwrite performed')
    # CNAME cannot coexist with any other record at its name.
    siblings = [x for x in existing if x.get('name', '').rstrip('.') == item['name']]
    if any(x.get('type') == 'CNAME' for x in siblings) or (item['type'] == 'CNAME' and siblings):
        raise SetupError('Existing CNAME conflict; no overwrite performed')
    return 'create'

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    secret_path = ROOT / '.external-setup.local.env'
    values = load_secrets(secret_path) if secret_path.exists() else {}
    missing = [k for k in ('RESEND_API_KEY', 'CLOUDFLARE_API_TOKEN') if not values.get(k)]
    if not values.get('RESEND_API_KEY'):
        print(json.dumps({'status': 'BLOCKED_MISSING_CREDENTIALS', 'missing_names': missing, 'mutations': 0}))
        return 2
    resend = lambda path, method='GET', body=None: request('https://api.resend.com', path, values['RESEND_API_KEY'], method, body)
    domains = resend('/domains').get('data', [])
    matching = [d for d in domains if d.get('name') == DOMAIN]
    if matching:
        domain = resend('/domains/' + matching[0]['id'])
    elif not args.apply:
        print(json.dumps({'status': 'PLAN_NEW_DOMAIN', 'domain': DOMAIN, 'missing_names': missing, 'mutations': 0}))
        return 3
    else:
        domain = resend('/domains', 'POST', {'name': DOMAIN, 'region': 'ap-northeast-1', 'tls': 'enforced', 'capabilities': {'sending': 'enabled', 'receiving': 'disabled'}})
    if domain.get('status') == 'verified':
        private = ROOT / 'output/external-setup'
        private.mkdir(parents=True, exist_ok=True); private.chmod(0o700)
        key_path = private / 'resend-smtp.private.json'
        if args.apply and not key_path.exists():
            key = resend('/api-keys', 'POST', {'name': 'AD Me Supabase SMTP', 'permission': 'sending_access', 'domain_id': domain['id']})
            if not key.get('token'):
                raise SetupError('No SMTP token returned; nothing printed')
            key_path.write_text(json.dumps({'domain_id': domain['id'], 'domain': DOMAIN, 'key_id': key['id'], 'token': key['token']})); key_path.chmod(0o600)
        print(json.dumps({'status': 'DOMAIN_VERIFIED', 'domain': DOMAIN, 'region': domain.get('region'), 'dns_mutations': 0, 'cloudflare_token_required': False, 'smtp_sending_key_ready': key_path.exists()}))
        return 0
    records = dns_plan(domain['records'])
    if not values.get('CLOUDFLARE_API_TOKEN'):
        private = ROOT / 'output/external-setup'
        private.mkdir(parents=True, exist_ok=True); private.chmod(0o700)
        path = private / 'resend-domain-plan.json'
        path.write_text(json.dumps({'domain_id': domain['id'], 'domain': DOMAIN, 'status': domain.get('status'), 'dns_plan': records}, indent=2)); path.chmod(0o600)
        print(json.dumps({'status': 'BLOCKED_DNS_ACCESS', 'domain': DOMAIN, 'domain_status': domain.get('status'), 'missing_names': ['CLOUDFLARE_API_TOKEN'], 'dns_mutations': 0, 'records_prepared': len(records)}))
        return 2
    cloudflare = lambda path, method='GET', body=None: request('https://api.cloudflare.com/client/v4', path, values['CLOUDFLARE_API_TOKEN'], method, body)
    zones = cloudflare('/zones?name=' + ZONE)['result']
    if len(zones) != 1 or zones[0].get('name') != ZONE:
        raise SetupError('Expected exactly the authorized be-celeb.org zone')
    zone_id = zones[0]['id']
    # Fetch paginated full zone before considering a mutation; never ignore later conflicts.
    existing, page = [], 1
    while True:
        result = cloudflare(f'/zones/{zone_id}/dns_records?per_page=100&page={page}')
        existing.extend(result['result'])
        if page >= result.get('result_info', {}).get('total_pages', 1):
            break
        page += 1
    actions = [(item, existing_action(item, existing)) for item in records]
    private = ROOT / 'output/external-setup'
    private.mkdir(parents=True, exist_ok=True); private.chmod(0o700)
    backup = private / 'cloudflare-before.json'
    if not backup.exists():
        backup.write_text(json.dumps(existing, indent=2)); backup.chmod(0o600)
    created = 0
    if args.apply:
        for item, action in actions:
            if action == 'create':
                cloudflare(f'/zones/{zone_id}/dns_records', 'POST', item)
                created += 1
        resend('/domains/' + domain['id'] + '/verify', 'POST')
    current = resend('/domains/' + domain['id'])
    status = current.get('status')
    # Create a sending-only, domain-restricted SMTP credential once verification completes.
    smtp_path = private / 'resend-smtp.private.json'
    if args.apply and status == 'verified' and not smtp_path.exists():
        smtp_key = resend('/api-keys', 'POST', {'name': 'ADMe Auth SMTP', 'permission': 'sending_access', 'domain_id': domain['id']})
        if not smtp_key.get('token'):
            raise SetupError('SMTP key creation did not return credential; check provider before retry')
        smtp_path.write_text(json.dumps(smtp_key)); smtp_path.chmod(0o600)
    print(json.dumps({'status': status, 'domain': DOMAIN, 'dns_records_created': created, 'dns_records_preserved': sum(action == 'preserve' for _,action in actions), 'smtp_credential_ready': smtp_path.exists(), 'receiving_enabled': False, 'secret_values_printed': False}))
    return 0 if status == 'verified' else 3

if __name__ == '__main__':
    try:
        sys.exit(main())
    except SetupError as error:
        print(json.dumps({'status':'BLOCKED','reason':str(error),'secret_values_printed':False}))
        sys.exit(1)
