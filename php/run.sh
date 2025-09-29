#!/usr/bin/env bash
set -euo pipefail

# --- Ensure PHP is installed ---
if ! command -v php >/dev/null 2>&1; then
  echo "Installing PHP..."
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update
    # php-cli is the minimal package with the PHP binary,
    # php-curl provides curl_init()
    sudo apt-get install -y php-cli php-curl
    echo "Finished installing PHP."
  elif command -v brew >/dev/null 2>&1; then
    brew install php
    echo "Finished installing PHP."
  else
    echo "ERROR: cannot auto-install PHP on this system"
    exit 1
  fi
fi

# --- Run the app ---
echo "Running PHP built-in server..."
exec php -S "localhost:${PORT:-8001}" teller.php