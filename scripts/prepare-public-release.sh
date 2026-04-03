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

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

sha256sum_line() {
  local repo_root="$1"
  local rel_path="$2"
  (cd "$repo_root" && shasum -a 256 "$rel_path")
}

sha256_text() {
  printf '%s' "$1" | shasum -a 256 | awk '{print $1}'
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
MANIFEST_PATH="$STAGING_ROOT/private-pack.manifest.json"

mkdir -p "$STAGING_ROOT"

(
  cd "$REPO_ROOT"
  tar -cf - \
    --exclude='./.git' \
    --exclude='./*/.git' \
    --exclude='./node_modules' \
    --exclude='./*/node_modules' \
    --exclude='./build' \
    --exclude='./*/build' \
    .
) | (
  cd "$STAGING_ROOT"
  tar -xf -
)

STRIP_PATTERNS=(
  "contextEngine-cc"
  "TODO"
  "CLAUDE.md"
  ".claude"
  ".codex"
  # Hold back the full repo-level E2E workflow layer from the public OSS copy for now.
  "scripts/test-*.js"
  "scripts/test-*.ui.js"
  "scripts/lib/e2e"
  "scripts/run-e2e-*"
  "scripts/run-ux-*"
  "scripts/capture-ux-*"
  "scripts/build_external_llm_prompt.py"
  ".env.e2e*"
  "artifacts"
  "Demo Integration Package"
  "whitepaper/Slides.pdf"
  "whitepaper/IdeasMap.md"
  "client/src/components/MainSite/MainSite.module.test.js"
  "client/src/utilities/worker/sessionCorsWorker.*.proxy.test.js"
  "client/src/utilities/web3/contractScripts.*.proxy.test.js"
)

STRIP_ASSERT_ABSENT=(
  "CLAUDE.md"
  ".claude"
  "scripts/test-*.js"
  "scripts/test-*.ui.js"
  "scripts/lib/e2e"
  "whitepaper/Slides.pdf"
  "whitepaper/IdeasMap.md"
)

(
  cd "$STAGING_ROOT"
  shopt -s dotglob nullglob
  for pattern in "${STRIP_PATTERNS[@]}"; do
    for path in $pattern; do
      if [ -e "$path" ] || [ -L "$path" ]; then
        printf '%s\n' "$path"
      fi
    done
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
entry_index=0

{
  printf '{\n'
  printf '  "manifest_version": 1,\n'
  printf '  "sha256_format": "sha256sum",\n'
  printf '  "entries": [\n'

  while IFS= read -r path; do
    [ -n "$path" ] || continue

    if [ "$entry_index" -gt 0 ]; then
      printf ',\n'
    fi

    if [ -L "$STAGING_ROOT/$path" ]; then
      link_target=$(readlink "$STAGING_ROOT/$path")
      checksum_line="$(sha256_text "$link_target")  $path"
      printf '    {"type":"symlink","sha256sum":"%s","linkTarget":"%s"}' \
        "$(json_escape "$checksum_line")" \
        "$(json_escape "$link_target")"
    else
      checksum_line=$(sha256sum_line "$STAGING_ROOT" "$path")
      printf '    {"type":"file","sha256sum":"%s"}' "$(json_escape "$checksum_line")"
    fi

    entry_index=$((entry_index + 1))
  done < "$STRIP_ENTRIES_FILE"

  printf '\n  ]\n'
  printf '}\n'
} > "$MANIFEST_PATH"

while IFS= read -r path; do
  [ -n "$path" ] || continue
  rm -rf "$STAGING_ROOT/$path"
done < "$MATCHED_PATHS_FILE"

(
  cd "$STAGING_ROOT"
  shopt -s dotglob nullglob
  for pattern in "${STRIP_ASSERT_ABSENT[@]}"; do
    for path in $pattern; do
      if [ -e "$path" ] || [ -L "$path" ]; then
        printf 'Expected stripped path still present in public release copy: %s\n' "$path" >&2
        exit 1
      fi
    done
  done
)

mv "$STAGING_ROOT" "$OUTPUT_ABS"

printf '%s files stripped, output at %s\n' "$stripped_count" "$OUTPUT_ABS"
