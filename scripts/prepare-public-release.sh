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

MANIFEST_EXCLUDE_PATTERNS=()
while IFS= read -r pattern; do
  MANIFEST_EXCLUDE_PATTERNS+=("$pattern")
done < <(ce_public_release_manifest_exclude_patterns)

path_matches_manifest_exclude() {
  local relative_path="$1"
  local pattern

  for pattern in "${MANIFEST_EXCLUDE_PATTERNS[@]}"; do
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

  node - "$package_json" <<'NODE'
const fs = require('node:fs');

const packageJsonPath = process.argv[2];
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

if (packageJson.scripts && typeof packageJson.scripts === 'object') {
  const scripts = packageJson.scripts;
  const removed = new Set();
  const strippedRunnerPatterns = [
    /\bscripts\/test-[^\s'"]+\.js\b/,
    /\bscripts\/test-[^\s'"]+\.ui\.js\b/,
    /\bscripts\/seed-[^\s'"]+\.js\b/,
    /\bscripts\/e2e(?:\/|\b)/,
    /\bscripts\/lib\/e2e(?:\/|\b)/,
    /\bscripts\/run-e2e-[^\s'"]+\.js\b/,
    /\bscripts\/run-ux-[^\s'"]+\.js\b/,
    /\bscripts\/capture-ux-[^\s'"]+\.js\b/,
    /\bscripts\/run-agent-bridge-worker-tests\.js\b/,
    /\bscripts\/vendor-cecc-ethers-bundle\.js\b/,
  ];

  for (const [name, command] of Object.entries(scripts)) {
    if (strippedRunnerPatterns.some((pattern) => pattern.test(String(command)))) {
      removed.add(name);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, command] of Object.entries(scripts)) {
      if (removed.has(name)) continue;
      for (const removedName of removed) {
        const escapedName = removedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`\\bnpm\\s+run(?:\\s+-s)?\\s+${escapedName}\\b`).test(String(command))) {
          removed.add(name);
          changed = true;
          break;
        }
      }
    }
  }

  for (const name of removed) {
    delete scripts[name];
  }
}

fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
NODE
}

scrub_public_pii_text() {
  if ! command -v node >/dev/null 2>&1; then
    printf 'node is required to scrub public PII text.\n' >&2
    return 1
  fi

  node - "$STAGING_ROOT" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(process.argv[2]);
const skipDirs = new Set(['.git', 'node_modules', 'build', 'dist', 'coverage']);
const emailRe = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/ig;
// Intentionally public addresses that must survive the sweep (e.g. the
// SECURITY.md vulnerability-reporting contact). Keep in sync with the
// allowlist in scripts/verify-public-release-pii.sh.
const allowedPublicEmails = new Set(['contextengine@protonmail.com']);
const homePathRe = /(?:^|[\s"'(=:{])((?:\/Users|\/home)\/[A-Za-z0-9._-]+(?:\/[^\s"'`<>\\)]*)?)/g;

function isProbablyBinary(buffer) {
  if (buffer.includes(0)) return true;
  const sampleLength = Math.min(buffer.length, 4096);
  if (sampleLength === 0) return false;

  let controlBytes = 0;
  for (let index = 0; index < sampleLength; index += 1) {
    const byte = buffer[index];
    if ((byte < 8) || (byte > 13 && byte < 32)) controlBytes += 1;
  }
  return controlBytes > Math.max(8, sampleLength * 0.02);
}

function scrubFile(absolutePath) {
  const buffer = fs.readFileSync(absolutePath);
  if (isProbablyBinary(buffer)) return;

  const original = buffer.toString('utf8');
  const scrubbed = original
    .replace(emailRe, (match) => (allowedPublicEmails.has(match.toLowerCase()) ? match : '[redacted-email]'))
    .replace(homePathRe, (match, homePath) => match.replace(homePath, '/redacted-home'));

  if (scrubbed !== original) {
    fs.writeFileSync(absolutePath, scrubbed);
  }
}

function walk(absoluteDir) {
  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    const absolutePath = path.join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      walk(absolutePath);
      continue;
    }
    if (entry.isFile()) scrubFile(absolutePath);
  }
}

walk(rootDir);
NODE
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
MANIFEST_PATH="$STAGING_ROOT/private-pack.manifest.json"

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

    if path_matches_manifest_exclude "$path"; then
      continue
    fi

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
  if [ "$path" = "private-pack.manifest.json" ]; then
    continue
  fi
  rm -rf "$STAGING_ROOT/$path"
done < "$MATCHED_PATHS_FILE"

scrub_public_package_json
scrub_public_pii_text

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

mv "$STAGING_ROOT" "$OUTPUT_ABS"

printf '%s files stripped, output at %s\n' "$stripped_count" "$OUTPUT_ABS"
