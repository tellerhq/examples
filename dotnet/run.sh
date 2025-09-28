#!/usr/bin/env bash
set -euo pipefail

# --- ensure .NET SDK is installed ---
if ! command -v dotnet >/dev/null 2>&1; then
  echo "Installing .NET SDK..."
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update && sudo apt-get install -y dotnet-sdk-7.0
  elif command -v brew >/dev/null 2>&1; then
    brew install --cask dotnet-sdk
  else
    echo "ERROR: cannot auto-install .NET SDK on this system"
    exit 1
  fi
fi

# --- restore project dependencies ---
dotnet restore teller.csproj

# --- run the app ---
exec dotnet run --project teller.csproj -- "$@"