#!/usr/bin/env bash
set -euo pipefail

# Initialize module only once
if [ ! -f go.mod ]; then
  go mod init teller-example
  go mod tidy
fi

APP_ID=${APP_ID:?must set APP_ID} \
go run teller.go