# Teller Examples

This project contains a simple front-end and multiple back-end implementations
for proxying requests to Teller’s API.

---

## Quick Start

Run the Python back-end (default):

```sh
make APP_ID=app_xxx
```

Visit [http://localhost:8001](http://localhost:8001).

---

## Other Languages

If you want to try a different back-end, specify the language:

```sh
make run node APP_ID=app_xxx
make run ruby APP_ID=app_xxx
make run go APP_ID=app_xxx
make run elixir APP_ID=app_xxx
make run php APP_ID=app_xxx
make run dotnet APP_ID=app_xxx
make run java APP_ID=app_xxx
```

Each implementation lives under `examples/<language>/` with a `run.sh`.

---

## Environment

- `APP_ID` (required) — your Teller application ID  
- `ENV` (optional, default: `sandbox`) — set to `development` or `production` for live data  
- `CERT` and `CERT_KEY` (required only for `development` or `production`)  

Example:

```sh
make run java APP_ID=app_xxx ENV=development CERT=cert.pem CERT_KEY=key.pem
```

---

## Usage

1. Start a back-end with `make run …` as shown above.  
2. Open [http://localhost:8001](http://localhost:8001) in your browser.  
3. Click **Connect** (top right) to enroll a user with Teller Connect.  
4. After connecting, you’ll see a list of accounts.  
   - Use the buttons to fetch **Details**, **Balances**, and **Transactions**.  
   - For checking accounts, you can also manage **Payees** and create **Payments**.  
5. At the bottom bar, you’ll see the enrolled **User ID** and the **Access Token** being used for API calls.  

---

## Sandbox Credentials

To enroll an account use the username `username` and the password `password`.

See the [Sandbox Guide](https://teller.io/docs/guides/sandbox) to learn about the other types of sandbox credential for triggering flows like OTP and knowledge-based MFA.