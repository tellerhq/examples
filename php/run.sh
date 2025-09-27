#!/usr/bin/env bash
set -euo pipefail

exec php -S localhost:${PORT:-8001} teller.php