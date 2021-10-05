#!/usr/bin/env bash
set -Eeuo pipefail

if egrep "APPLICATION_ID\s+=\s+'app_[a-zA-Z0-9]+'" static/index.js; then
  # Starts a simple HTTP server to serve static assets
  # available in the `static` directory.
  python3 -m http.server --directory static 8000
else
  echo
  echo "ERROR:"
  echo "APPLICATION_ID not found in static/index.js"
  echo
  echo "Did you forget to set it? See README.md for instructions."
  exit -1
fi