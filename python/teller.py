import os
from wsgiref import simple_server

import argparse
import falcon
import requests


class TellerClient:

    _BASE_URL = 'https://api.teller.io'

    def __init__(self, cert, access_token=None):
        self.cert = cert
        self.access_token = access_token

    def for_user(self, access_token):
        return TellerClient(self.cert, access_token)

    def list_accounts(self):
        return self._get('/accounts')

    def get_account_details(self, account_id):
        return self._get(f'/accounts/{account_id}/details')

    def get_account_balances(self, account_id):
        return self._get(f'/accounts/{account_id}/balances')

    def list_account_transactions(self, account_id):
        return self._get(f'/accounts/{account_id}/transactions')

    def _get(self, path):
        url = self._BASE_URL + path
        auth = (self.access_token, '')
        return requests.get(url, cert=self.cert, auth=auth)


class AccountsResource:

    def __init__(self, client):
        self._client = client

    def on_get(self, req, resp):
        self._proxy(req, resp, lambda client: client.list_accounts())

    def on_get_details(self, req, resp, account_id):
        self._proxy(req, resp, lambda client: client.get_account_details(account_id))

    def on_get_balances(self, req, resp, account_id):
        self._proxy(req, resp, lambda client: client.get_account_balances(account_id))

    def on_get_transactions(self, req, resp, account_id):
        self._proxy(req, resp, lambda client: client.list_account_transactions(account_id))

    def _proxy(self, req, resp, fun):
        user_client = self._client.for_user(req.auth)
        teller_response = fun(user_client)

        resp.media = teller_response.json()
        resp.status = falcon.code_to_http_status(teller_response.status_code)


def _parse_args():
    parser = argparse.ArgumentParser(description='Interact with Teller')

    parser.add_argument('--environment',
            default='development',
            choices=['sandbox', 'development', 'production'],
            help='API environment to target')
    parser.add_argument('--cert', type=str,
            help='path to the TLS certificate')
    parser.add_argument('--cert-key', type=str,
            help='path to the TLS certificate private key')

    args = parser.parse_args()

    needs_cert = args.environment in ['development', 'production']
    has_cert = args.cert and args.cert_key
    if needs_cert and not has_cert:
        parser.error('--cert and --cert-key are required when --environment is not sandbox')

    return args


def main():
    args = _parse_args()
    cert = (args.cert, args.cert_key)
    client = TellerClient(cert)

    accounts = AccountsResource(client)

    cors = falcon.CORSMiddleware(
            allow_origins='localhost:8000', allow_credentials='*')
    application = falcon.App(cors_enable=True)
    application.add_route('/api/accounts', accounts)
    application.add_route('/api/accounts/{account_id}/details', accounts,
            suffix='details')
    application.add_route('/api/accounts/{account_id}/balances', accounts,
            suffix='balances')
    application.add_route('/api/accounts/{account_id}/transactions', accounts,
            suffix='transactions')

    httpd = simple_server.make_server('', 8001, application)
    httpd.serve_forever()


if __name__ == '__main__':
    main()
