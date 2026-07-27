#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
TMP_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/verify-prepared-public-text.XXXXXX")

cleanup() {
  rm -rf "$TMP_ROOT"
}
trap cleanup EXIT

# The canonical release builder scrubs the copied manifest and runs the strict
# byte-for-byte public-text verifier before publishing the prepared artifact.
bash "$SCRIPT_DIR/prepare-public-release.sh" --force "$TMP_ROOT/release-public"
