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

# --- configure Bundler install path once ---
bundle config set --local path 'vendor/bundle'

# --- install project deps ---
bundle install --quiet

# --- run the app with locked deps ---
exec bundle exec ruby teller.rb "$@"