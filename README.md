# Teller Examples

This project contains a simple front-end and multiple back-end implementations
for enrolling bank accounts and experimenting with the Teller API

---

## Quick Start

Run the Python back-end (default):

```sh
make APP_ID=app_xxx
```

Visit http://localhost:8001.

---

## Other Languages

If you want to try a different back-end, specify the language:

```sh
make run node   APP_ID=app_xxx
make run ruby   APP_ID=app_xxx
make run go     APP_ID=app_xxx
make run elixir APP_ID=app_xxx
make run php    APP_ID=app_xxx
make run dotnet APP_ID=app_xxx
make run java   APP_ID=app_xxx
```

Each implementation lives under `$REPO_ROOT/<language_name>/` with a `run.sh`.

---

## Requirements

The only system-level requirements are:
- macOS: Homebrew must be installed
- Linux: apt must be available (Debian/Ubuntu based distributions)

The `run.sh` scripts will use Homebrew on macOS and apt on Linux to install any
missing runtimes automatically on first run.

---

## Environment
-	`APP_ID` (required) — your Teller application ID
-	`ENV` (optional, default: `sandbox`) — set to `development` or `production` for live data
-	`CERT` and `CERT_KEY` - your Teller Application certificate and private key (required only when `ENV` is development or production)

Example (Java with mTLS in development):

```sh
make run java APP_ID=app_xxx ENV=development CERT=/path/to/cert.pem CERT_KEY=/path/to/key.pem
```


---

## Usage

1.	Start a back-end with make run … as shown above.
2.	Open http://localhost:8001 in your browser.
3.	Click Connect (top right) to enroll a user with Teller Connect.
4.	After connecting, you’ll see accounts. Use the buttons to fetch Details, Balances, Transactions, and (for checking) manage Payees and Payments.
5.	The bottom bar shows the enrolled User ID and the Access Token used for API calls.

---

## Sandbox Credentials

Use username `username` and password `password` to enroll a sandbox account.

See the Sandbox Guide: https://teller.io/docs/guides/sandbox for additional test credentials and flows (OTP, knowledge-based MFA, etc.).

