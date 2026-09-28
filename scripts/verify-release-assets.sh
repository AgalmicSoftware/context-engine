#!/usr/bin/env bash
set -euo pipefail

ASSET_URL="${CE_RELEASE_ASSET_URL:-https://github.com/AgalmicSoftware/context-engine/releases/latest/download/sessionCorsWorker.bundle.js}"

curl -fsIL "$ASSET_URL" >/dev/null
printf 'release asset reachable: %s\n' "$ASSET_URL"
