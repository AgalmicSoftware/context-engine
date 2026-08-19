#!/usr/bin/env bash
set -euo pipefail

export LC_ALL=C
export LANG=C

usage() {
  cat <<'EOF'
Usage: prepare-public-release.sh [--force] [output-dir]

Create a public release copy of the repo with private/internal content stripped.

Options:
  --force    Remove an existing output path before writing the new copy.
  -h, --help Show this help text.

Defaults:
  output-dir defaults to ./release-public
EOF
}

abs_path() {
  local input="$1"
  case "$input" in
    /*)
      printf '%s\n' "$input"
      ;;
    *)
      printf '%s/%s\n' "$(pwd -P)" "$input"
      ;;
  esac
}

FORCE=0
OUTPUT_DIR="./release-public"

while [ $# -gt 0 ]; do
  case "$1" in
    --force)
      FORCE=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      printf 'Unknown option: %s\n' "$1" >&2
      usage >&2
      exit 1
      ;;
    *)
      if [ "$OUTPUT_DIR" != "./release-public" ]; then
        printf 'Only one output directory may be provided.\n' >&2
        usage >&2
        exit 1
      fi
      OUTPUT_DIR="$1"
      ;;
  esac
  shift
done

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd -P)
OUTPUT_ABS=$(abs_path "$OUTPUT_DIR")

# shellcheck source=./lib/public-release-strip-patterns.sh
source "$SCRIPT_DIR/lib/public-release-strip-patterns.sh"

STRIP_PATTERNS=()
while IFS= read -r pattern; do
  STRIP_PATTERNS+=("$pattern")
done < <(ce_public_release_strip_patterns)

STRIP_ASSERT_ABSENT=()
while IFS= read -r pattern; do
  STRIP_ASSERT_ABSENT+=("$pattern")
done < <(ce_public_release_strip_assert_absent_patterns)

verify_private_planning_paths_absent() {
  local findings

  findings=$(
    cd "$STAGING_ROOT"
    find . -path './.git' -prune -o -print |
      sed 's#^\./##' |
      grep -Ei '(^|/)TODO(/|$)|(^|/)[^/]*prds?[^/]*(/|$)' || true
  )

  if [ -n "$findings" ]; then
    printf 'Private planning paths are still visible in public release copy:\n%s\n' "$findings" >&2
    return 1
  fi

  return 0
}

scrub_public_package_json() {
  local package_json="$STAGING_ROOT/package.json"

  if [ ! -f "$package_json" ]; then
    return 0
  fi

  if ! command -v node >/dev/null 2>&1; then
    printf 'node is required to scrub public package.json metadata.\n' >&2
    return 1
  fi

  node "$SCRIPT_DIR/scrub-public-package-json.js" "$package_json"
}

scrub_public_pii_text() {
  if ! command -v node >/dev/null 2>&1; then
    printf 'node is required to scrub public PII text.\n' >&2
    return 1
  fi

  node "$SCRIPT_DIR/scrub-public-pii-text.mjs" "$STAGING_ROOT"
}

refresh_public_benchmark_source_hashes() {
  local refresher="$STAGING_ROOT/scripts/refresh-public-benchmark-source-hashes.mjs"

  if [ ! -f "$refresher" ]; then
    printf 'Public benchmark source-hash refresher is missing from release copy.\n' >&2
    return 1
  fi

  node "$refresher" "$STAGING_ROOT" >&2
}

if [ "$OUTPUT_ABS" = "$REPO_ROOT" ]; then
  printf 'Refusing to overwrite the repo root.\n' >&2
  exit 1
fi

case "$OUTPUT_ABS" in
  "/"|"")
    printf 'Refusing to write to an unsafe output path.\n' >&2
    exit 1
    ;;
esac

if [ -e "$OUTPUT_ABS" ]; then
  if [ "$FORCE" -ne 1 ]; then
    printf 'Output path already exists: %s\n' "$OUTPUT_ABS" >&2
    printf 'Pass --force to overwrite it.\n' >&2
    exit 1
  fi
  rm -rf "$OUTPUT_ABS"
fi

mkdir -p "$(dirname "$OUTPUT_ABS")"

TMP_ROOT=""
cleanup() {
  if [ -n "$TMP_ROOT" ] && [ -d "$TMP_ROOT" ]; then
    rm -rf "$TMP_ROOT"
  fi
}
trap cleanup EXIT

TMP_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/prepare-public-release.XXXXXX")
STAGING_ROOT="$TMP_ROOT/release"
MATCHED_PATHS_FILE="$TMP_ROOT/matched-paths.txt"
STRIP_ENTRIES_FILE="$TMP_ROOT/strip-entries.txt"
COPY_FILE_LIST="$TMP_ROOT/copy-file-list.txt"
mkdir -p "$STAGING_ROOT"

(
  cd "$REPO_ROOT"
  GIT_TOPLEVEL=$(git rev-parse --show-toplevel 2>/dev/null || true)
  if [ "$GIT_TOPLEVEL" = "$REPO_ROOT" ]; then
    git ls-files -z --cached --others --exclude-standard |
      while IFS= read -r -d '' path; do
        if [ -e "$path" ] || [ -L "$path" ]; then
          printf '%s\n' "$path"
        fi
      done > "$COPY_FILE_LIST"

    tar -cf - -T "$COPY_FILE_LIST"
  else
    tar -cf - \
      --exclude='./.git' \
      --exclude='./*/.git' \
      --exclude='./node_modules' \
      --exclude='./*/node_modules' \
      --exclude='./*/*/node_modules' \
      --exclude='./*/*/*/node_modules' \
      --exclude='./build' \
      --exclude='./*/build' \
      --exclude='./*/*/build' \
      --exclude='./*/*/*/build' \
      --exclude='./.codex-artifacts' \
      --exclude='./.codex-solc' \
      --exclude='./.codex-tmp' \
      --exclude='./.DS_Store' \
      --exclude='./*/.DS_Store' \
      --exclude='./.env' \
      --exclude='./.env.local' \
      --exclude='./.env.*.local' \
      --exclude='./.keys' \
      --exclude='./.e2e-secrets' \
      --exclude='./.e2e-cache' \
      --exclude='./.npm-cache' \
      --exclude='./.npm-cache-client*' \
      --exclude='./output' \
      --exclude='./release-public' \
      --exclude='./dist' \
      --exclude='./out' \
      --exclude='./cache' \
      --exclude='./broadcast' \
      --exclude='./coverage' \
      --exclude='./docs/codebase-*.md' \
      --exclude='./docs/assets/codebase-*' \
      .
  fi
) | (
  cd "$STAGING_ROOT"
  tar -xf -
)

(
  cd "$STAGING_ROOT"
  shopt -s dotglob nullglob
  for pattern in "${STRIP_PATTERNS[@]}"; do
    while IFS= read -r path; do
      if [ -e "$path" ] || [ -L "$path" ]; then
        printf '%s\n' "$path"
      fi
    done < <(compgen -G "$pattern" || true)
  done
) | sort -u > "$MATCHED_PATHS_FILE"

: > "$STRIP_ENTRIES_FILE"
while IFS= read -r path; do
  [ -n "$path" ] || continue

  if [ -d "$STAGING_ROOT/$path" ] && [ ! -L "$STAGING_ROOT/$path" ]; then
    (
      cd "$STAGING_ROOT"
      find "$path" \( -type f -o -type l \) | sort
    ) >> "$STRIP_ENTRIES_FILE"
    continue
  fi

  if [ -f "$STAGING_ROOT/$path" ] || [ -L "$STAGING_ROOT/$path" ]; then
    printf '%s\n' "$path" >> "$STRIP_ENTRIES_FILE"
  fi
done < "$MATCHED_PATHS_FILE"

sort -u "$STRIP_ENTRIES_FILE" -o "$STRIP_ENTRIES_FILE"

stripped_count=$(wc -l < "$STRIP_ENTRIES_FILE" | tr -d ' ')

while IFS= read -r path; do
  [ -n "$path" ] || continue
  rm -rf "$STAGING_ROOT/$path"
done < "$MATCHED_PATHS_FILE"

scrub_public_package_json
scrub_public_pii_text
refresh_public_benchmark_source_hashes

(
  cd "$STAGING_ROOT"
  shopt -s dotglob nullglob
  for pattern in "${STRIP_ASSERT_ABSENT[@]}"; do
    while IFS= read -r path; do
      if [ -e "$path" ] || [ -L "$path" ]; then
        printf 'Expected stripped path still present in public release copy: %s\n' "$path" >&2
        exit 1
      fi
    done < <(compgen -G "$pattern" || true)
  done
)

verify_private_planning_paths_absent

if [ ! -f "$STAGING_ROOT/scripts/verify-public-release-surface.js" ]; then
  printf 'Public release surface verifier is missing from release copy: scripts/verify-public-release-surface.js\n' >&2
  exit 1
fi

node "$STAGING_ROOT/scripts/verify-public-release-surface.js" "$STAGING_ROOT" >&2

if [ ! -f "$STAGING_ROOT/scripts/verify-public-docs.js" ]; then
  printf 'Public documentation verifier is missing from release copy: scripts/verify-public-docs.js\n' >&2
  exit 1
fi

# Regression guard: source-side private docs are allowed on dev, so validate
# Markdown only after the strip and package-script scrub have completed.
node "$STAGING_ROOT/scripts/verify-public-docs.js" "$STAGING_ROOT" >&2

if [ ! -f "$STAGING_ROOT/scripts/verify-public-assets.js" ]; then
  printf 'Public asset verifier is missing from release copy: scripts/verify-public-assets.js\n' >&2
  exit 1
fi

node "$STAGING_ROOT/scripts/verify-public-assets.js" "$STAGING_ROOT" >&2

if [ ! -f "$STAGING_ROOT/scripts/verify-public-text.js" ]; then
  printf 'Public text verifier is missing from release copy: scripts/verify-public-text.js\n' >&2
  exit 1
fi

node "$STAGING_ROOT/scripts/verify-public-text.js" "$STAGING_ROOT" >&2

mv "$STAGING_ROOT" "$OUTPUT_ABS"

printf '%s files stripped, output at %s\n' "$stripped_count" "$OUTPUT_ABS"
