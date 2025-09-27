import os
import sys
import argparse
import requests
from base64 import b64encode
from flask import Flask, request, Response, render_template
from flask_cors import CORS

BASE_TELLER_URL = "https://api.teller.io"


# ---------------- Config Parsing ---------------- #

def parse_config():
    parser = argparse.ArgumentParser(description="Teller example Flask proxy")

    parser.add_argument(
        "--application-id",
        default=os.getenv("APP_ID"),
        help="Teller Application ID (or set APP_ID env var)",
    )
    parser.add_argument(
        "--environment",
        default=os.getenv("ENV", "sandbox"),
        choices=["sandbox", "development", "production"],
        help="Target environment (defaults to sandbox, or set ENV env var)",
    )
    parser.add_argument(
        "--cert",
        default=os.getenv("CERT"),
        help="Path to TLS certificate (or set CERT env var)",
    )
    parser.add_argument(
        "--cert-key",
        default=os.getenv("CERT_KEY"),
        help="Path to TLS private key (or set CERT_KEY env var)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.getenv("PORT", "8001")),
        help="Port to bind (default from PORT env var, fallback 8001)",
    )

    args = parser.parse_args()

    # validation
    if not args.application_id:
        sys.stderr.write(
            "Error: application-id is required.\n"
            "Provide with --application-id or APP_ID env var.\n"
        )
        sys.exit(1)

    needs_cert = args.environment in ("development", "production")
    if needs_cert and (not args.cert or not args.cert_key):
        sys.stderr.write(
            f"Error: cert and cert-key required when ENV is {args.environment}.\n"
            "Provide with --cert/--cert-key or CERT/CERT_KEY env vars.\n"
        )
        sys.exit(1)

    return args


# ---------------- Flask App ---------------- #

def create_app(app_id: str, environment: str, cert_tuple=None) -> Flask:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    static_dir = os.path.join(base_dir, "..", "static")

    app = Flask(
        __name__,
        static_folder=static_dir,
        template_folder=static_dir,
    )

    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

    @app.route("/api/<path:path>", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"])
    def proxy(path: str):
        upstream_url = f"{BASE_TELLER_URL}/{path}"

        # Forward headers except Host
        fwd_headers = {k: v for k, v in request.headers if k.lower() != "host"}

        # Fix Authorization: Browser sends raw token, Teller expects Basic <base64(token:)>
        raw_auth = request.headers.get("Authorization")
        if raw_auth:
            token = raw_auth.strip()
            basic = b64encode(f"{token}:".encode()).decode()
            fwd_headers["Authorization"] = f"Basic {basic}"

        body = request.get_data()
        cert = cert_tuple if cert_tuple and all(cert_tuple) else None

        try:
            resp = requests.request(
                method=request.method,
                url=upstream_url,
                headers=fwd_headers,
                data=body,
                cert=cert,
                verify=True,
            )
        except requests.RequestException as e:
            return Response(f"Upstream error: {e}", status=502)

        # Strip hop-by-hop/problematic headers
        excluded = {"content-encoding", "transfer-encoding", "connection"}
        safe_headers = [(k, v) for k, v in resp.headers.items() if k.lower() not in excluded]

        return Response(resp.content, status=resp.status_code, headers=safe_headers)

    @app.route("/")
    def index():
        return render_template("index.html", app_id=app_id, environment=environment)

    @app.route("/healthz")
    def healthz():
        return {"status": "ok", "env": environment}, 200

    return app


# ---------------- Entrypoint ---------------- #

def main():
    args = parse_config()

    cert_tuple = (args.cert, args.cert_key) if args.cert and args.cert_key else None
    app = create_app(args.application_id, args.environment, cert_tuple)

    print(
        f"Listening on http://localhost:{args.port} "
        f"(ENV={args.environment}, APP_ID={args.application_id})\n"
    )
    app.run(host="0.0.0.0", port=args.port)


if __name__ == "__main__":
    main()