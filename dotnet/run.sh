#!/usr/bin/env bash
set -euo pipefail

# --- detect privilege helper ---
SUDO=""
if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
  SUDO="sudo"
fi

DOTNET_DIR="${DOTNET_DIR:-$HOME/.dotnet}"
DOTNET_BIN="$DOTNET_DIR/dotnet"
PATH="$DOTNET_DIR:$DOTNET_DIR/tools:$PATH"
export DOTNET_ROOT="$DOTNET_DIR"
export PATH

# --- ensure .NET 9 SDK is installed ---
need_dotnet9() {
  if ! command -v dotnet >/dev/null 2>&1; then
    return 0
  fi
  if ! dotnet --list-sdks | grep -q "^9\."; then
    return 0
  fi
  return 1
}

install_dotnet9() {
  mkdir -p "$DOTNET_DIR"
  echo "Installing .NET 9 SDK into $DOTNET_DIR..."
  curl -fsSL https://dotnet.microsoft.com/download/dotnet/scripts/v1/dotnet-install.sh -o /tmp/dotnet-install.sh
  chmod +x /tmp/dotnet-install.sh
  /tmp/dotnet-install.sh --channel 9.0 --install-dir "$DOTNET_DIR" --no-path
  rm -f /tmp/dotnet-install.sh
}

if need_dotnet9; then
  if [[ "$(uname -s)" == "Darwin" ]]; then
    if command -v brew >/dev/null 2>&1; then
      echo "Installing .NET 9 with Homebrew..."
      brew install --cask dotnet-sdk
    else
      install_dotnet9
    fi
  elif command -v apt-get >/dev/null 2>&1; then
    install_dotnet9
  else
    install_dotnet9
  fi
fi

echo "Using dotnet: $(dotnet --version)"

# --- restore and run ---
dotnet restore teller.csproj
exec dotnet run --project teller.csproj -- "$@"