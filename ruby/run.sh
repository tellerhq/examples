#!/usr/bin/env bash
set -euo pipefail

# --- ensure Ruby ≥3.2 is installed ---
if ! command -v ruby >/dev/null 2>&1; then
  echo "Installing Ruby..."
  if command -v apt-get >/devnull 2>&1; then
    sudo apt-get update
    sudo apt-get install -y software-properties-common
    sudo add-apt-repository -y ppa:brightbox/ruby-ng
    sudo apt-get update
    sudo apt-get install -y ruby3.2 ruby3.2-dev build-essential
  elif command -v brew >/dev/null 2>&1; then
    brew install ruby
  else
    echo "ERROR: cannot auto-install Ruby"
    exit 1
  fi
fi

# Prefer ruby3.2/gem3.2 if available (Ubuntu 22.04 keeps ruby=3.0 as default)
RUBY_CMD="$(command -v ruby3.2 || true)"
GEM_CMD="$(command -v gem3.2 || true)"
if [ -z "${RUBY_CMD}" ]; then RUBY_CMD="$(command -v ruby)"; fi
if [ -z "${GEM_CMD}" ]; then GEM_CMD="$(command -v gem)"; fi

# --- ensure Bundler is installed and invokable ---
if ! command -v bundle >/dev/null 2>&1; then
  echo "Installing Bundler..."
  if ! "${GEM_CMD}" install bundler --no-document >/dev/null 2>&1; then
    echo "Falling back to user-local Bundler install..."
    "${GEM_CMD}" install --user-install bundler --no-document
  fi
fi

# Ensure the gem user bin dir is on PATH (handles ~/.local/share/gem vs ~/.gem)
USER_GEM_BIN="$("${RUBY_CMD}" -e 'require "rubygems"; print Gem.user_dir + "/bin"')"
export PATH="${USER_GEM_BIN}:$PATH"

# Resolve bundle executable explicitly in case PATH was odd
BUNDLE_BIN="$(command -v bundle || true)"
if [ -z "${BUNDLE_BIN}" ]; then
  BUNDLE_BIN="${USER_GEM_BIN}/bundle"
fi
if [ ! -x "${BUNDLE_BIN}" ]; then
  echo "ERROR: bundler not found after install"
  exit 1
fi

# --- configure Bundler install path once ---
"${BUNDLE_BIN}" config set --local path 'vendor/bundle'

# --- install project deps ---
"${BUNDLE_BIN}" install --quiet

# --- run the app with locked deps ---
exec "${BUNDLE_BIN}" exec "${RUBY_CMD}" teller.rb "$@"