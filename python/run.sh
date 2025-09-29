#!/usr/bin/env bash
set -euo pipefail

VENV_DIR="${VENV_DIR:-.venv}"
PY="${PYTHON:-python3}"

# --- Ensure Python is available ---
if ! command -v "$PY" >/dev/null 2>&1; then
  echo "Installing Python..."
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update
    # full toolchain: python, venv, ensurepip, distutils, setuptools, pip
    sudo apt-get install -y python3-full python3-venv python3-distutils python3-setuptools python3-pip
    PY=python3
  elif command -v brew >/dev/null 2>&1; then
    brew install python@3.11
    PY="$(brew --prefix)/opt/python@3.11/bin/python3"
  else
    echo "Could not auto-install Python. Please install manually."
    exit 1
  fi
fi

# --- Ensure venv support ---
if ! "$PY" -m venv --help >/dev/null 2>&1; then
  echo "python3-venv missing. Installing..."
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get install -y python3-venv python3-distutils python3-setuptools
  elif command -v brew >/dev/null 2>&1; then
    brew install python@3.11   # brew python always bundles venv + ensurepip
  else
    echo "Could not auto-install python3-venv."
    exit 1
  fi
fi

# --- Create venv ---
if [ ! -d "$VENV_DIR" ]; then
  echo "Creating virtual environment..."
  if ! "$PY" -m venv "$VENV_DIR"; then
    echo "venv failed (likely no ensurepip). Falling back..."
    # Make sure distutils + setuptools are available
    if command -v apt-get >/dev/null 2>&1; then
      sudo apt-get update
      sudo apt-get install -y python3-distutils python3-setuptools
    fi
    "$PY" -m venv --without-pip "$VENV_DIR"
    if ! command -v curl >/dev/null 2>&1; then
      echo "Installing curl..."
      if command -v apt-get >/dev/null 2>&1; then
        sudo apt-get install -y curl ca-certificates
      elif command -v brew >/dev/null 2>&1; then
        brew install curl
      else
        echo "curl missing and cannot auto-install."
        exit 1
      fi
    fi
    curl -sS https://bootstrap.pypa.io/get-pip.py | "$VENV_DIR/bin/python"
  fi
fi

VEPY="$VENV_DIR/bin/python"
if [ ! -x "$VEPY" ]; then
  echo "ERROR: $VEPY not found or not executable"
  exit 1
fi

# --- Ensure pip in venv ---
if ! "$VEPY" -m pip --version >/dev/null 2>&1; then
  echo "Bootstrapping pip..."
  if "$VEPY" -m ensurepip --upgrade >/dev/null 2>&1; then
    echo "ensurepip succeeded."
  else
    echo "ensurepip not available, falling back to get-pip.py..."
    curl -sS https://bootstrap.pypa.io/get-pip.py | "$VEPY"
  fi
fi

# --- Upgrade pip/setuptools/wheel and install deps ---
"$VEPY" -m pip install -q --upgrade pip setuptools wheel
[ -f requirements.txt ] && "$VEPY" -m pip install -r requirements.txt

# --- Run app ---
exec "$VEPY" teller.py "$@"