#!/usr/bin/env bash
set -euo pipefail

export LC_ALL=C
export LANG=C

usage() {
  cat <<'EOF'
Usage: restore-private-pack.sh [--dry-run] <source-repo-dir> <target-public-dir>

Restore files listed in private-pack.manifest.json from a full dev repo into a
stripped public copy. The script prefers a manifest in the source repo and
falls back to the target copy when the source does not include one.

Options:
  --dry-run  Print planned actions without copying anything.
  -h, --help Show this help text.
EOF
}

abs_path() {
  (cd "$1" && pwd -P)
}

json_unescape() {
  printf '%s' "$1" | sed 's/\\"/"/g; s/\\\\/\\/g'
}

sha256sum_line() {
  local repo_root="$1"
  local rel_path="$2"
  (cd "$repo_root" && shasum -a 256 "$rel_path")
}

sha256_text() {
  printf '%s' "$1" | shasum -a 256 | awk '{print $1}'
}

require_manifest() {
  if [ -f "$1/private-pack.manifest.json" ]; then
    printf '%s/private-pack.manifest.json\n' "$1"
    return
  fi
  if [ -f "$2/private-pack.manifest.json" ]; then
    printf '%s/private-pack.manifest.json\n' "$2"
    return
  fi

  printf 'private-pack.manifest.json not found in %s or %s\n' "$1" "$2" >&2
  exit 1
}

DRY_RUN=0
POSITIONAL_COUNT=0
SOURCE_DIR=""
TARGET_DIR=""

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
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
      POSITIONAL_COUNT=$((POSITIONAL_COUNT + 1))
      if [ "$POSITIONAL_COUNT" -eq 1 ]; then
        SOURCE_DIR="$1"
      elif [ "$POSITIONAL_COUNT" -eq 2 ]; then
        TARGET_DIR="$1"
      else
        printf 'Expected exactly two positional arguments.\n' >&2
        usage >&2
        exit 1
      fi
      ;;
  esac
  shift
done

if [ "$POSITIONAL_COUNT" -ne 2 ]; then
  usage >&2
  exit 1
fi

SOURCE_ABS=$(abs_path "$SOURCE_DIR")
TARGET_ABS=$(abs_path "$TARGET_DIR")

if [ ! -d "$SOURCE_ABS" ]; then
  printf 'Source repo directory does not exist: %s\n' "$SOURCE_ABS" >&2
  exit 1
fi

if [ ! -d "$TARGET_ABS" ]; then
  printf 'Target directory does not exist: %s\n' "$TARGET_ABS" >&2
  exit 1
fi

MANIFEST_PATH=$(require_manifest "$SOURCE_ABS" "$TARGET_ABS")
ENTRY_COUNT=0
RESTORED_COUNT=0
SKIPPED_COUNT=0

while IFS= read -r line; do
  case "$line" in
    *'"type":"file"'*|*'"type":"symlink"'*)
      type=$(printf '%s\n' "$line" | sed -n 's/^[[:space:]]*{"type":"\([^"]*\)".*$/\1/p')
      checksum_encoded=$(printf '%s\n' "$line" | sed -n 's/.*"sha256sum":"\([^"]*\)".*/\1/p')
      link_target_encoded=$(printf '%s\n' "$line" | sed -n 's/.*"linkTarget":"\([^"]*\)".*/\1/p')

      checksum_line=$(json_unescape "$checksum_encoded")
      link_target=$(json_unescape "$link_target_encoded")
      entry_hash=${checksum_line%%  *}
      rel_path=${checksum_line#*  }
      source_path="$SOURCE_ABS/$rel_path"
      target_path="$TARGET_ABS/$rel_path"
      ENTRY_COUNT=$((ENTRY_COUNT + 1))

      if [ "$type" = "file" ]; then
        if [ ! -f "$source_path" ]; then
          printf 'Missing source file: %s\n' "$source_path" >&2
          exit 1
        fi

        if [ "$(sha256sum_line "$SOURCE_ABS" "$rel_path")" != "$checksum_line" ]; then
          printf 'Checksum mismatch for source file: %s\n' "$source_path" >&2
          exit 1
        fi

        if [ -e "$target_path" ] || [ -L "$target_path" ]; then
          if [ -f "$target_path" ] && [ "$(sha256sum_line "$TARGET_ABS" "$rel_path")" = "$checksum_line" ]; then
            SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
            continue
          fi

          printf 'Target path already exists with different content: %s\n' "$target_path" >&2
          exit 1
        fi

        if [ "$DRY_RUN" -eq 1 ]; then
          printf 'Would restore file %s\n' "$rel_path"
          RESTORED_COUNT=$((RESTORED_COUNT + 1))
          continue
        fi

        mkdir -p "$(dirname "$target_path")"
        cp -p "$source_path" "$target_path"

        if [ "$(sha256sum_line "$TARGET_ABS" "$rel_path")" != "$checksum_line" ]; then
          printf 'Checksum mismatch after restoring file: %s\n' "$target_path" >&2
          exit 1
        fi

        RESTORED_COUNT=$((RESTORED_COUNT + 1))
        continue
      fi

      if [ ! -L "$source_path" ]; then
        printf 'Missing source symlink: %s\n' "$source_path" >&2
        exit 1
      fi

      source_link_target=$(readlink "$source_path")
      if [ "$source_link_target" != "$link_target" ]; then
        printf 'Symlink target mismatch for source path: %s\n' "$source_path" >&2
        exit 1
      fi

      if [ "$(sha256_text "$source_link_target")" != "$entry_hash" ]; then
        printf 'Checksum mismatch for source symlink: %s\n' "$source_path" >&2
        exit 1
      fi

      if [ -L "$target_path" ]; then
        existing_target=$(readlink "$target_path")
        if [ "$existing_target" = "$link_target" ] && [ "$(sha256_text "$existing_target")" = "$entry_hash" ]; then
          SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
          continue
        fi

        printf 'Target symlink already exists with different target: %s\n' "$target_path" >&2
        exit 1
      fi

      if [ -e "$target_path" ]; then
        printf 'Target path already exists and is not a matching symlink: %s\n' "$target_path" >&2
        exit 1
      fi

      if [ "$DRY_RUN" -eq 1 ]; then
        printf 'Would restore symlink %s -> %s\n' "$rel_path" "$link_target"
        RESTORED_COUNT=$((RESTORED_COUNT + 1))
        continue
      fi

      mkdir -p "$(dirname "$target_path")"
      ln -s "$link_target" "$target_path"

      if [ "$(readlink "$target_path")" != "$link_target" ]; then
        printf 'Symlink target mismatch after restore: %s\n' "$target_path" >&2
        exit 1
      fi

      if [ "$(sha256_text "$(readlink "$target_path")")" != "$entry_hash" ]; then
        printf 'Checksum mismatch after restoring symlink: %s\n' "$target_path" >&2
        exit 1
      fi

      RESTORED_COUNT=$((RESTORED_COUNT + 1))
      ;;
  esac
done < "$MANIFEST_PATH"

if [ "$DRY_RUN" -eq 1 ]; then
  printf 'Dry run complete: %s entries would be restored into %s using %s\n' \
    "$RESTORED_COUNT" "$TARGET_ABS" "$MANIFEST_PATH"
  exit 0
fi

printf 'Restore complete: %s entries restored, %s skipped, target at %s\n' \
  "$RESTORED_COUNT" "$SKIPPED_COUNT" "$TARGET_ABS"
