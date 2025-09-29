#!/usr/bin/env bash
set -euo pipefail

# Installs a working Erlang/OTP + Elixir (no dead ES repos), then runs teller.exs.
# Works on Ubuntu (arm64/amd64) and macOS.

OTP_VER="${OTP_VER:-27.0}"
OTP_TAG="${OTP_TAG:-OTP-27.0}"
ELIXIR_VER="${ELIXIR_VER:-1.18.0}"

SUDO=""
if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then SUDO="sudo"; fi

have() { command -v "$1" >/dev/null 2>&1; }

# --- Linux (apt) path: build Erlang from official source tarball; install Elixir precompiled zip ---
install_linux() {
  $SUDO apt-get update
  $SUDO apt-get install -y build-essential autoconf m4 \
    libssl-dev libncurses5-dev \
    wget curl unzip ca-certificates

  if ! have erl; then
    echo "Installing Erlang/OTP ${OTP_VER} from source…"
    rm -rf /tmp/otp_src_${OTP_VER} /tmp/otp.tgz
    curl -fsSL "https://github.com/erlang/otp/releases/download/${OTP_TAG}/otp_src_${OTP_VER}.tar.gz" -o /tmp/otp.tgz
    tar -C /tmp -xzf /tmp/otp.tgz
    (
      cd "/tmp/otp_src_${OTP_VER}"
      ./configure
      make -j"$(nproc)"
      $SUDO make install
    )
    rm -rf /tmp/otp_src_${OTP_VER} /tmp/otp.tgz
  fi

  if ! have elixir; then
    echo "Installing Elixir ${ELIXIR_VER}…"
    $SUDO mkdir -p "/opt/elixir-${ELIXIR_VER}"
    curl -fsSL "https://repo.hex.pm/builds/elixir/v${ELIXIR_VER}.zip" -o /tmp/elixir.zip
    $SUDO unzip -o /tmp/elixir.zip -d "/opt/elixir-${ELIXIR_VER}" >/dev/null
    rm -f /tmp/elixir.zip
    for b in elixir elixirc iex mix; do
      $SUDO ln -sf "/opt/elixir-${ELIXIR_VER}/bin/${b}" "/usr/local/bin/${b}"
    done
  fi
}

# --- macOS path (Homebrew) ---
install_macos() {
  if ! have brew; then
    echo "ERROR: Homebrew not found. Install Homebrew or run as Linux." >&2
    exit 1
  fi
  if ! have elixir; then
    brew install elixir
  fi
}

# --- main install gate ---
if ! have elixir; then
  if have apt-get; then
    install_linux
  elif [[ "$(uname -s)" == "Darwin" ]]; then
    install_macos
  else
    echo "ERROR: unsupported OS. Need apt (Debian/Ubuntu) or macOS with Homebrew." >&2
    exit 1
  fi
fi

# --- run the app ---
echo "Running app…"
exec elixir teller.exs "$@"