#!/usr/bin/env bash
set -euo pipefail

# Ensure Node
if ! command -v node >/dev/null 2>&1; then
  echo "Installing Node.js..."
  if command -v apt-get >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  elif command -v brew >/dev/null 2>&1; then
    brew install node
  else
    echo "ERROR: cannot auto-install Node.js on this system"
    exit 1
  fi
fi

# Install dependencies if missing
if [ ! -d node_modules ]; then
  npm install
fi

# Run the app
exec node teller.js "$@"