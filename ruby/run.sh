#!/usr/bin/env bash
set -euo pipefail

# --- ensure Ruby is installed ---
if ! command -v ruby >/dev/null 2>&1; then
  echo "Installing Ruby..."
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update && sudo apt-get install -y ruby-full build-essential
  elif command -v brew >/dev/null 2>&1; then
    brew install ruby
  else
    echo "ERROR: cannot auto-install Ruby"
    exit 1
  fi
fi

# --- ensure Bundler is installed ---
if ! command -v bundle >/dev/null 2>&1; then
  echo "Installing Bundler..."
  gem install bundler --no-document
fi

# --- install project deps locally into vendor/bundle ---
bundle install --path vendor/bundle --quiet

# --- run the app with locked deps ---
exec bundle exec ruby teller.rb "$@"