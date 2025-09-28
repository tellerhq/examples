#!/usr/bin/env bash
set -euo pipefail

# --- ensure Elixir is installed ---
if ! command -v elixir >/dev/null 2>&1; then
  echo "Installing Elixir..."
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update && sudo apt-get install -y elixir
  elif command -v brew >/dev/null 2>&1; then
    brew install elixir
  else
    echo "ERROR: cannot auto-install Elixir on this system"
    exit 1
  fi
fi

# --- run the app ---
exec elixir teller.exs "$@"