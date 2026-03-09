#!/bin/zsh
# Load .env.local into shell and launch Claude Code
# Usage: ./dev.sh

set -a
source "$(dirname "$0")/.env.local"
set +a

exec claude "$@"
