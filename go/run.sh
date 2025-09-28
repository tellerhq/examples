#!/usr/bin/env bash
set -euo pipefail

# --- ensure Go is installed ---
if ! command -v go >/dev/null 2>&1; then
  echo "Installing Go..."
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update && sudo apt-get install -y golang
  elif command -v brew >/dev/null 2>&1; then
    brew install go
  else
    echo "ERROR: cannot auto-install Go on this system"
    exit 1
  fi
fi

# --- initialize module & fetch deps ---
if [ ! -f go.mod ]; then
  go mod init teller-example
fi
go mod tidy   # always refresh deps to be safe

# --- validate required env vars ---
: "${APP_ID:?must set APP_ID}"

# --- run the app ---
exec go run teller.go "$@"