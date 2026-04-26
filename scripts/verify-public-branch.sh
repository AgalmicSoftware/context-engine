#!/usr/bin/env bash
set -euo pipefail

export LC_ALL=C
export LANG=C

usage() {
  cat <<'EOF'
Usage: verify-public-branch.sh [git-ref]

Verify that a branch or commit does not still track files matched by the
public-release strip list. Defaults to HEAD when no ref is provided.
EOF
}

fail() {
  printf '%s\n' "$1" >&2
  exit "${2:-1}"
}

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd -P)

# shellcheck source=./lib/public-release-strip-patterns.sh
source "$SCRIPT_DIR/lib/public-release-strip-patterns.sh"

if [ $# -gt 1 ]; then
  fail "Only one git ref may be provided." 1
fi

case "${1:-}" in
  -h|--help)
    usage
    exit 0
    ;;
esac

TARGET_REF="${1:-HEAD}"

if ! git -C "$REPO_ROOT" rev-parse --verify "${TARGET_REF}^{commit}" >/dev/null 2>&1; then
  fail "Git ref not found: $TARGET_REF" 1
fi

STRIP_PATTERNS=()
while IFS= read -r pattern; do
  STRIP_PATTERNS+=("$pattern")
done < <(ce_public_release_strip_patterns)

path_matches_strip_pattern() {
  local relative_path="$1"
  local pattern

  for pattern in "${STRIP_PATTERNS[@]}"; do
    case "$pattern" in
      *'*'*|*'?'*|*'['*)
        if [[ "$relative_path" == $pattern ]]; then
          return 0
        fi
        ;;
      *)
        if [[ "$relative_path" == "$pattern" || "$relative_path" == "$pattern/"* ]]; then
          return 0
        fi
        ;;
    esac
  done

  return 1
}

MATCHED_PATHS=()
while IFS= read -r tracked_path; do
  [ -n "$tracked_path" ] || continue
  if path_matches_strip_pattern "$tracked_path"; then
    MATCHED_PATHS+=("$tracked_path")
  fi
done < <(git -C "$REPO_ROOT" ls-tree -r --name-only "$TARGET_REF")

if [ "${#MATCHED_PATHS[@]}" -gt 0 ]; then
  printf 'Tracked paths in %s still match the public strip list:\n' "$TARGET_REF" >&2
  for path in "${MATCHED_PATHS[@]}"; do
    printf ' - %s\n' "$path" >&2
  done
  exit 1
fi

printf 'No tracked strip-pattern matches found in %s.\n' "$TARGET_REF"
