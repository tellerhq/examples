#!/usr/bin/env bash
set -euo pipefail

bundle install --path vendor/bundle --quiet

exec bundle exec ruby teller.rb