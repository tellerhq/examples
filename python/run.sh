#!/usr/bin/env bash
set -euo pipefail

# Bootstrap venv if not already
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi

. .venv/bin/activate

# Install requirements if present
pip install -q --upgrade pip
[ -f requirements.txt ] && pip install -r requirements.txt || true

# Delegate to Python (which now does all validation)
exec python teller.py "$@"