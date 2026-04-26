#!/usr/bin/env bash
set -euo pipefail

export LC_ALL=C
export LANG=C

PUBLIC_GIT_NAME="Agalmic"
PUBLIC_GIT_EMAIL="agalmicsoftware@protonmail.com"
DEFAULT_BRANCH_NAME="release-staging"

usage() {
  cat <<'EOF'
Usage: sync-public-history.sh [OPTIONS] [branch-name]

Replay local dev commits onto public main one-by-one while stripping private files.

Options:
  --dry-run    Show what would happen without creating replay commits
  --push       Push the resulting branch to origin after replay completes
  --source-branch <name>
               Replay commits from this local branch (default: dev)
  --force-with-lease
               Replace an existing local target branch safely
  -h, --help   Show this help text
EOF
}

log_info() {
  printf '%s\n' "$*" >&2
}

log_error() {
  printf '%s\n' "$*" >&2
}

fail() {
  local exit_code="${2:-1}"
  log_error "$1"
  exit "$exit_code"
}

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd -P)

# shellcheck source=./lib/public-release-strip-patterns.sh
source "$SCRIPT_DIR/lib/public-release-strip-patterns.sh"

STRIP_PATTERNS=()
while IFS= read -r pattern; do
  STRIP_PATTERNS+=("$pattern")
done < <(ce_public_release_strip_patterns)

TMP_ROOT=""
TEMP_CLONE=""
TARGET_BRANCH="$DEFAULT_BRANCH_NAME"
SOURCE_BRANCH="dev"
DRY_RUN=0
AUTO_PUSH=0
EXPLICIT_FORCE_WITH_LEASE=0
REPLAYED_COUNT=0
SKIPPED_COUNT=0
REMOTE_BRANCH_EXISTS=0
REMOTE_BRANCH_SHA=""

cleanup() {
  if [ -n "$TMP_ROOT" ] && [ -d "$TMP_ROOT" ]; then
    rm -rf "$TMP_ROOT"
  fi
}
trap cleanup EXIT

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

commit_is_empty_after_strip() {
  local commit_sha="$1"
  local changed_path

  while IFS= read -r changed_path; do
    [ -n "$changed_path" ] || continue
    if ! path_matches_strip_pattern "$changed_path"; then
      return 1
    fi
  done < <(git -C "$REPO_ROOT" diff-tree --no-commit-id --name-only -r --root "$commit_sha")

  return 0
}

strip_private_paths_from_clone() {
  local pattern
  local matches=()

  (
    cd "$TEMP_CLONE"
    shopt -s dotglob

    for pattern in "${STRIP_PATTERNS[@]}"; do
      git rm -rf --ignore-unmatch -- "$pattern" >/dev/null 2>&1 || true

      matches=()
      while IFS= read -r match; do
        matches+=("$match")
      done < <(compgen -G "$pattern" || true)

      if [ "${#matches[@]}" -gt 0 ]; then
        rm -rf -- "${matches[@]}"
      fi
    done

    git add -A
  )
}

verify_strip_patterns_absent() {
  local pattern
  local matches=()
  local found_any=0

  (
    cd "$TEMP_CLONE"
    shopt -s dotglob

    for pattern in "${STRIP_PATTERNS[@]}"; do
      matches=()
      while IFS= read -r match; do
        matches+=("$match")
      done < <(compgen -G "$pattern" || true)

      if [ "${#matches[@]}" -gt 0 ]; then
        found_any=1
        for path in "${matches[@]}"; do
          printf '%s\n' "$path"
        done
      fi
    done

    exit "$found_any"
  )
}

reset_clone_to_branch_head() {
  git -C "$TEMP_CLONE" reset --hard --quiet HEAD
  git -C "$TEMP_CLONE" clean -fdq
}

sync_branch_back_to_source_repo() {
  if git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$TARGET_BRANCH"; then
    if [ "$(git -C "$REPO_ROOT" branch --show-current)" = "$TARGET_BRANCH" ]; then
      fail "Local branch $TARGET_BRANCH is currently checked out. Check out another branch before rerunning sync-public-history.sh." 1
    fi

    git -C "$REPO_ROOT" fetch --quiet --force "$TEMP_CLONE" "$TARGET_BRANCH:$TARGET_BRANCH"
    return
  fi

  git -C "$REPO_ROOT" fetch --quiet "$TEMP_CLONE" "$TARGET_BRANCH:$TARGET_BRANCH"
}

push_branch_to_origin() {
  if [ "$AUTO_PUSH" -ne 1 ]; then
    return
  fi

  log_info "Pushing $TARGET_BRANCH to origin from the source repo."

  if [ "$REMOTE_BRANCH_EXISTS" -eq 1 ]; then
    git -C "$REPO_ROOT" push \
      --force-with-lease="refs/heads/$TARGET_BRANCH:$REMOTE_BRANCH_SHA" \
      -u origin "$TARGET_BRANCH"
    return
  fi

  git -C "$REPO_ROOT" push -u origin "$TARGET_BRANCH"
}

author_audit_output() {
  git -C "$TEMP_CLONE" log --format='%H %an <%ae> | %cn <%ce>' "origin/main..$TARGET_BRANCH" \
    | grep -Fv "$PUBLIC_GIT_NAME <$PUBLIC_GIT_EMAIL> | $PUBLIC_GIT_NAME <$PUBLIC_GIT_EMAIL>" || true
}

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      ;;
    --push)
      AUTO_PUSH=1
      ;;
    --source-branch)
      shift
      if [ $# -eq 0 ]; then
        fail "--source-branch requires a branch name." 1
      fi
      SOURCE_BRANCH="$1"
      ;;
    --force-with-lease)
      EXPLICIT_FORCE_WITH_LEASE=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      fail "Unknown option: $1" 1
      ;;
    *)
      if [ "$TARGET_BRANCH" != "$DEFAULT_BRANCH_NAME" ]; then
        fail "Only one branch name may be provided." 1
      fi
      TARGET_BRANCH="$1"
      ;;
  esac
  shift
done

if ! git -C "$REPO_ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  fail "Repository root is not a git repository: $REPO_ROOT" 1
fi

if git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$TARGET_BRANCH"; then
  if [ "$EXPLICIT_FORCE_WITH_LEASE" -ne 1 ]; then
    fail "Local branch $TARGET_BRANCH already exists in the source repo. Delete it, pick another name, or rerun with --force-with-lease." 1
  fi

  if [ "$(git -C "$REPO_ROOT" branch --show-current)" = "$TARGET_BRANCH" ]; then
    fail "Local branch $TARGET_BRANCH is currently checked out. Check out another branch before rerunning sync-public-history.sh." 1
  fi

  log_info "Local branch $TARGET_BRANCH already exists and will be refreshed with --force-with-lease."
fi

SOURCE_REMOTE_URL=$(git -C "$REPO_ROOT" remote get-url origin 2>/dev/null || true)
if [ -z "$SOURCE_REMOTE_URL" ]; then
  fail "Could not determine origin remote URL from $REPO_ROOT" 1
fi

if ! git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$SOURCE_BRANCH"; then
  fail "Local source branch $SOURCE_BRANCH was not found." 1
fi

git -C "$REPO_ROOT" fetch --quiet origin main

if ! git -C "$REPO_ROOT" merge-base --is-ancestor origin/main "$SOURCE_BRANCH"; then
  fail "origin/main is not an ancestor of $SOURCE_BRANCH. Rebase or merge $SOURCE_BRANCH before running sync-public-history.sh." 1
fi

MERGE_COUNT=$(git -C "$REPO_ROOT" rev-list --count --merges "origin/main..$SOURCE_BRANCH")
if [ "$MERGE_COUNT" -ne 0 ]; then
  fail "Merge commits were found in origin/main..$SOURCE_BRANCH. This script only supports a linear history." 1
fi

COMMITS=()
while IFS= read -r commit_sha; do
  COMMITS+=("$commit_sha")
done < <(git -C "$REPO_ROOT" rev-list --reverse "origin/main..$SOURCE_BRANCH")
if [ "${#COMMITS[@]}" -eq 0 ]; then
  printf 'Nothing to replay from origin/main..%s.\n' "$SOURCE_BRANCH"
  exit 0
fi

TMP_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/sync-public-history.XXXXXX")
TEMP_CLONE="$TMP_ROOT/replay"

log_info "Cloning source repo into temporary workspace: $TEMP_CLONE"
git clone --quiet "$REPO_ROOT" "$TEMP_CLONE"

log_info "Setting public git identity in temp clone."
git -C "$TEMP_CLONE" config user.name "$PUBLIC_GIT_NAME"
git -C "$TEMP_CLONE" config user.email "$PUBLIC_GIT_EMAIL"
git -C "$TEMP_CLONE" remote set-url origin "$SOURCE_REMOTE_URL"
git -C "$TEMP_CLONE" fetch --quiet origin main

if git -C "$TEMP_CLONE" ls-remote --exit-code --heads origin "$TARGET_BRANCH" >/dev/null 2>&1; then
  REMOTE_BRANCH_EXISTS=1
  REMOTE_BRANCH_SHA=$(git -C "$TEMP_CLONE" ls-remote --heads origin "$TARGET_BRANCH" | awk '{print $1}')
  if [ "$EXPLICIT_FORCE_WITH_LEASE" -eq 1 ]; then
    log_info "Remote branch origin/$TARGET_BRANCH already exists and will be refreshed with --force-with-lease."
  else
    log_info "Remote branch origin/$TARGET_BRANCH already exists and will be refreshed automatically with --force-with-lease."
  fi
fi

git -C "$TEMP_CLONE" checkout --quiet -B "$TARGET_BRANCH" origin/main
log_info "Prepared temp branch $TARGET_BRANCH from origin/main."

if [ "$DRY_RUN" -eq 1 ]; then
  for commit_sha in "${COMMITS[@]}"; do
    subject=$(git -C "$REPO_ROOT" log -1 --format='%s' "$commit_sha")
    if commit_is_empty_after_strip "$commit_sha"; then
      SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
      log_info "DRY RUN skip  $commit_sha | $subject"
    else
      REPLAYED_COUNT=$((REPLAYED_COUNT + 1))
      log_info "DRY RUN replay $commit_sha | $subject"
    fi
  done

  printf 'Dry run complete.\n'
  printf 'Would replay: %s\n' "$REPLAYED_COUNT"
  printf 'Would skip: %s\n' "$SKIPPED_COUNT"
  printf 'Source branch: %s\n' "$SOURCE_BRANCH"
  printf 'Branch name: %s\n' "$TARGET_BRANCH"
  exit 0
fi

for commit_sha in "${COMMITS[@]}"; do
  subject=$(git -C "$REPO_ROOT" log -1 --format='%s' "$commit_sha")
  author_date=$(git -C "$REPO_ROOT" log -1 --format='%aI' "$commit_sha")
  committer_date=$(git -C "$REPO_ROOT" log -1 --format='%cI' "$commit_sha")
  message_file="$TMP_ROOT/commit-message.txt"
  git -C "$REPO_ROOT" log -1 --format='%B' "$commit_sha" > "$message_file"

  log_info "Replaying $commit_sha | $subject"
  if ! git -C "$TEMP_CLONE" cherry-pick --no-commit "$commit_sha" >/dev/null 2>&1; then
    log_error "Cherry-pick failed for $commit_sha | $subject"
    git -C "$TEMP_CLONE" cherry-pick --abort >/dev/null 2>&1 || true
    reset_clone_to_branch_head
    log_error "Resolve the conflict manually by replaying this commit onto a branch based on origin/main."
    exit 1
  fi

  strip_private_paths_from_clone

  if git -C "$TEMP_CLONE" diff --cached --quiet; then
    SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    log_info "Skipped $commit_sha after stripping private-only changes."
    reset_clone_to_branch_head
    continue
  fi

  GIT_AUTHOR_NAME="$PUBLIC_GIT_NAME" \
  GIT_AUTHOR_EMAIL="$PUBLIC_GIT_EMAIL" \
  GIT_AUTHOR_DATE="$author_date" \
  GIT_COMMITTER_NAME="$PUBLIC_GIT_NAME" \
  GIT_COMMITTER_EMAIL="$PUBLIC_GIT_EMAIL" \
  GIT_COMMITTER_DATE="$committer_date" \
    git -C "$TEMP_CLONE" commit --quiet --file "$message_file"

  REPLAYED_COUNT=$((REPLAYED_COUNT + 1))
  replayed_head=$(git -C "$TEMP_CLONE" rev-parse HEAD)
  log_info "Replayed $commit_sha -> $replayed_head | $subject"
done

if strip_findings=$(verify_strip_patterns_absent); then
  :
else
  log_error "Strip verification failed; private paths are still present:"
  printf '%s\n' "$strip_findings" >&2
  exit 2
fi

offending_identities=$(author_audit_output)
if [ -n "$offending_identities" ]; then
  log_error "Identity audit failed; offending commits:"
  printf '%s\n' "$offending_identities" >&2
  exit 2
fi

sync_branch_back_to_source_repo

push_branch_to_origin

printf 'Replay complete.\n'
printf 'Source branch: %s\n' "$SOURCE_BRANCH"
printf 'Branch name: %s\n' "$TARGET_BRANCH"
printf 'Replayed commits: %s\n' "$REPLAYED_COUNT"
printf 'Skipped commits: %s\n' "$SKIPPED_COUNT"
printf 'Temp dir: %s\n' "$TMP_ROOT"
printf 'To verify: bash scripts/verify-public-branch.sh %s\n' "$TARGET_BRANCH"
if [ "$AUTO_PUSH" -eq 1 ]; then
  printf 'Pushed: yes\n'
else
  printf 'Pushed: no\n'
  if [ "$REMOTE_BRANCH_EXISTS" -eq 1 ]; then
    printf 'To push: git push --force-with-lease -u origin %s\n' "$TARGET_BRANCH"
  else
    printf 'To push: git push -u origin %s\n' "$TARGET_BRANCH"
  fi
fi
