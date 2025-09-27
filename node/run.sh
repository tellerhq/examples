#!/usr/bin/env bash
set -euo pipefail

# Require Node
if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js must be installed"
  exit 1
fi

# Bootstrap dependencies
if [ ! -d node_modules ]; then
  npm install
fi

# Run the Node server (validation lives inside server.js)
exec node teller.js