#!/usr/bin/env bash
set -euo pipefail

# Ensure Python 3 is available
if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: Python 3 is not installed."
  echo "Attempting to install..."
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update && sudo apt-get install -y python3 python3-venv python3-pip python3-distutils
  elif command -v brew >/dev/null 2>&1; then
    brew install python@3.11
  else
    echo "Could not auto-install Python. Please install manually."
    exit 1
  fi
fi

# Ensure pip is available
if ! python3 -m pip --version >/dev/null 2>&1; then
  echo "Bootstrapping pip..."
  if python3 -m ensurepip --upgrade >/dev/null 2>&1; then
    echo "ensurepip succeeded."
  else
    echo "ensurepip not available, falling back to get-pip.py..."
    if ! command -v curl >/dev/null 2>&1; then
      echo "Installing curl..."
      if command -v apt-get >/dev/null 2>&1; then
        sudo apt-get update && sudo apt-get install -y curl
      elif command -v brew >/dev/null 2>&1; then
        brew install curl
      else
        echo "Could not auto-install curl. Please install manually."
        exit 1
      fi
    fi
    curl -sS https://bootstrap.pypa.io/get-pip.py | python3
  fi
fi

# Ensure venv is available
if ! python3 -m venv --help >/dev/null 2>&1; then
  echo "python3-venv package missing. Trying to install..."
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get install -y python3-venv
  else
    echo "Could not auto-install python3-venv. Please install manually."
    exit 1
  fi
fi

# Bootstrap venv
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
. .venv/bin/activate

# Upgrade pip and install project deps
pip install -q --upgrade pip
[ -f requirements.txt ] && pip install -r requirements.txt

# Run the app
exec python teller.py "$@"