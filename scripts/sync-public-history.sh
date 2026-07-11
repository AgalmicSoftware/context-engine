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
  --source-base <rev>
               Replay commits after this source revision instead of origin/main
  --target-base <rev>
               Start the public target branch from this revision instead of origin/main
  --allow-diverged-source
               Allow a source branch that does not contain origin/main by
               replaying patch-new non-merge commits from git cherry
  --sanitize-private-replay-messages
               Rewrite known private tokens in replayed commit messages instead
               of refusing otherwise-public commits
  --release-version <MAJOR.MINOR.PATCH>
               Use an explicit operator-selected public application version
               instead of the automatic next patch
  --acknowledge-patch
               Keep a patch bump after reviewing a major/minor suggestion
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
PRIVATE_BRANCH_GUARD_INSTALLER="$SCRIPT_DIR/install-private-branch-guard.sh"

# shellcheck source=./lib/public-release-strip-patterns.sh
source "$SCRIPT_DIR/lib/public-release-strip-patterns.sh"

STRIP_PATTERNS=()
while IFS= read -r pattern; do
  STRIP_PATTERNS+=("$pattern")
done < <(ce_public_release_strip_patterns)

AGENT_BRIDGE_PUBLIC_CUTOVER_MARKER="workers/agentBridgeWorker/PUBLIC_RELEASE_CUTOVER"
AGENT_BRIDGE_PUBLIC_CUTOVER_HEADER="context-engine-agent-bridge-public-cutover-v1"
AGENT_BRIDGE_PUBLIC_HISTORY_PATHS=(
  "workers/agentBridgeWorker"
  "scripts/run-agent-bridge-worker-tests.js"
)
AGENT_BRIDGE_PUBLIC_CUTOVER_REQUIRED_PATHS=(
  "$AGENT_BRIDGE_PUBLIC_CUTOVER_MARKER"
  "workers/agentBridgeWorker/worker.js"
  "scripts/run-agent-bridge-worker-tests.js"
)
AGENT_BRIDGE_PUBLIC_CUTOVER_COMMIT=""

PRIVATE_REPLAY_MESSAGE_TOKENS=(
  "contextEngine-cc"
  "docs/agent-native"
  "agent-native"
  "workers/agentBridgeWorker"
  "client/public/skill.md"
  "scripts/e2e"
  "scripts/lib/e2e"
  "scripts/test-"
  "scripts/seed-"
  "artifacts/"
  ".claude"
  ".codex"
  "CLAUDE.md"
  "AGENTS.md"
  "release-staging"
  "private branch"
  "dev branch"
  "OpenClaw"
  "TODO/"
)

TMP_ROOT=""
TEMP_CLONE=""
TARGET_BRANCH="$DEFAULT_BRANCH_NAME"
SOURCE_BRANCH="dev"
SOURCE_BASE_REF=""
TARGET_BASE_REF=""
DRY_RUN=0
AUTO_PUSH=0
EXPLICIT_FORCE_WITH_LEASE=0
ALLOW_DIVERGED_SOURCE=0
SANITIZE_PRIVATE_REPLAY_MESSAGES=0
EXPLICIT_RELEASE_VERSION=""
ACKNOWLEDGE_PATCH=0
REPLAYED_COUNT=0
SKIPPED_COUNT=0
LATEST_REPLAYED_SOURCE_COMMIT=""
REMOTE_BRANCH_EXISTS=0
REMOTE_BRANCH_SHA=""
RELEASE_VERSION=""
RELEASE_IMPACT=""
RELEASE_CHANGED_PATHS_FILE=""
RELEASE_SUBJECTS_FILE=""
RELEASE_PLAN_FILE=""
RELEASE_VERSIONING_ENABLED=0

cleanup() {
  if [ "${SYNC_PUBLIC_HISTORY_KEEP_TMP:-0}" = "1" ]; then
    return
  fi

  if [ -n "$TMP_ROOT" ] && [ -d "$TMP_ROOT" ]; then
    rm -rf "$TMP_ROOT"
  fi
}
trap cleanup EXIT

is_agent_bridge_public_history_path() {
  local relative_path="$1"

  case "$relative_path" in
    workers/agentBridgeWorker|workers/agentBridgeWorker/*|scripts/run-agent-bridge-worker-tests.js)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

agent_bridge_is_public_for_source_commit() {
  local commit_sha="$1"

  [ -n "$AGENT_BRIDGE_PUBLIC_CUTOVER_COMMIT" ] &&
    git -C "$REPO_ROOT" merge-base --is-ancestor "$AGENT_BRIDGE_PUBLIC_CUTOVER_COMMIT" "$commit_sha"
}

path_matches_strip_pattern() {
  local relative_path="$1"
  local commit_sha="${2:-}"
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

  if [ -n "$commit_sha" ] && is_agent_bridge_public_history_path "$relative_path"; then
    if ! agent_bridge_is_public_for_source_commit "$commit_sha"; then
      return 0
    fi
  fi

  return 1
}

commit_is_empty_after_strip() {
  local commit_sha="$1"
  local changed_path

  while IFS= read -r changed_path; do
    [ -n "$changed_path" ] || continue
    if ! path_matches_strip_pattern "$changed_path" "$commit_sha"; then
      return 1
    fi
  done < <(git -C "$REPO_ROOT" diff-tree --no-commit-id --name-only -r --root "$commit_sha")

  return 0
}

private_replay_message_token() {
  local message_file="$1"
  local token

  for token in "${PRIVATE_REPLAY_MESSAGE_TOKENS[@]}"; do
    if grep -Fiq -- "$token" "$message_file"; then
      printf '%s\n' "$token"
      return 0
    fi
  done

  if grep -Eiq -- '[Pp][Rr][Dd][Ss]?[[:space:]#:_-]*[0-9]+' "$message_file"; then
    printf '%s\n' "internal planning identifier"
    return 0
  fi

  return 1
}

sanitize_private_replay_message() {
  local message_file="$1"

  node - "$message_file" <<'NODE'
const fs = require('node:fs');

const messagePath = process.argv[2];
let message = fs.readFileSync(messagePath, 'utf8');

const replacements = [
  [/contextEngine-cc/gi, 'private companion tooling'],
  [/docs\/agent-native/gi, 'private integration docs'],
  [/agent-native/gi, 'private integration'],
  [/OpenClaw/gi, 'external agent'],
  [/private agent/gi, 'private integration'],
  [/TODO\//gi, 'private planning/'],
  [/workers\/agentBridgeWorker/gi, 'private integration'],
  [/client\/public\/skill\.md/gi, 'private integration asset'],
  [/scripts\/(?:lib\/)?e2e/gi, 'private test tooling'],
  [/scripts\/(?:test|seed)-[^\s`'")]+/gi, 'private test tooling'],
  [/artifacts\//gi, 'generated output/'],
  [/\.claude/gi, 'private agent settings'],
  [/\.codex/gi, 'private agent settings'],
  [/CLAUDE\.md/gi, 'private agent instructions'],
  [/AGENTS\.md/gi, 'private agent instructions'],
  [/release-staging[\w-]*/gi, 'public release branch'],
  [/\b(?:private|dev) branch\b/gi, 'source branch'],
  [/\bPRDs?\s*(?:[#:_-]\s*)?\d+\b/gi, 'internal planning item'],
];

for (const [pattern, replacement] of replacements) {
  message = message.replace(pattern, replacement);
}

fs.writeFileSync(messagePath, message);
NODE
}

ensure_public_replay_message() {
  local commit_sha="$1"
  local subject="$2"
  local message_file="$3"
  local token

  if token=$(private_replay_message_token "$message_file"); then
    if [ "$SANITIZE_PRIVATE_REPLAY_MESSAGES" -eq 1 ]; then
      sanitize_private_replay_message "$message_file"
      if ! token=$(private_replay_message_token "$message_file"); then
        log_info "Sanitized private replay message tokens for $commit_sha | $subject"
        return 0
      fi
    fi

    log_error "Refusing to replay $commit_sha | $subject"
    log_error "Commit message mentions private release token: $token"
    log_error "Split the private-only changes into a stripped commit or rewrite the replayed public commit message."
    exit 2
  fi
}

bind_public_replay_to_source() {
  local commit_sha="$1"
  local message_file="$2"

  git interpret-trailers \
    --in-place \
    --if-exists replace \
    --if-missing add \
    --trailer "CE-Private-Source: $commit_sha" \
    "$message_file"
}

sync_agent_bridge_public_package_wiring() {
  local commit_sha="$1"
  local target_package="$TEMP_CLONE/package.json"
  local source_package="$TMP_ROOT/agent-bridge-source-package.json"

  if [ ! -f "$target_package" ]; then
    fail "Agent Bridge public cutover requires package.json in replay output." 2
  fi

  if ! git -C "$REPO_ROOT" show "${commit_sha}:package.json" > "$source_package"; then
    fail "Agent Bridge public cutover source is missing package.json at $commit_sha." 2
  fi

  node - "$target_package" "$source_package" <<'NODE'
const fs = require('node:fs');

const targetPath = process.argv[2];
const sourcePath = process.argv[3];
const targetPackage = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
const sourcePackage = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const scriptName = 'test:worker:agent-bridge';
const command = sourcePackage.scripts?.[scriptName];

if (typeof command !== 'string' || !command.includes('scripts/run-agent-bridge-worker-tests.js')) {
  throw new Error(`Agent Bridge public cutover source is missing ${scriptName}`);
}

targetPackage.scripts ||= {};
targetPackage.scripts[scriptName] = command;
fs.writeFileSync(targetPath, `${JSON.stringify(targetPackage, null, 2)}\n`);
NODE
}

apply_agent_bridge_public_history_policy() {
  local commit_sha="$1"
  local path

  (
    cd "$TEMP_CLONE"

    # Always clear the replay checkout first. At the cutover commit this turns
    # the reviewed source tree into one complete public snapshot instead of
    # exposing the formerly private file-by-file development history.
    for path in "${AGENT_BRIDGE_PUBLIC_HISTORY_PATHS[@]}"; do
      git rm -rf --ignore-unmatch -- "$path" >/dev/null 2>&1 || true
      rm -rf -- "$path"
    done

    if agent_bridge_is_public_for_source_commit "$commit_sha"; then
      for path in "${AGENT_BRIDGE_PUBLIC_HISTORY_PATHS[@]}"; do
        if git -C "$REPO_ROOT" cat-file -e "${commit_sha}:${path}" 2>/dev/null; then
          git checkout "$commit_sha" -- "$path"
        fi
      done

      if [ ! -f "$AGENT_BRIDGE_PUBLIC_CUTOVER_MARKER" ]; then
        printf 'Agent Bridge public cutover marker is missing from source commit %s.\n' "$commit_sha" >&2
        exit 2
      fi

      sync_agent_bridge_public_package_wiring "$commit_sha"
    fi
  )
}

strip_private_paths_from_clone() {
  local commit_sha="$1"
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

    apply_agent_bridge_public_history_policy "$commit_sha"
    git -C "$REPO_ROOT" show "${commit_sha}:package.json" > "$TMP_ROOT/public-package-source.json"
    node \
      "$REPO_ROOT/scripts/scrub-public-package-json.js" \
      "$TEMP_CLONE/package.json" \
      "$TMP_ROOT/public-package-source.json"

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

verify_private_planning_paths_absent() {
  local findings

  findings=$(
    cd "$TEMP_CLONE"
    git ls-files |
      grep -Ei '(^|/)TODO(/|$)|(^|/)[^/]*prds?[^/]*(/|$)' || true
  )

  if [ -n "$findings" ]; then
    printf '%s\n' "$findings"
    return 1
  fi

  return 0
}

reset_clone_to_branch_head() {
  git -C "$TEMP_CLONE" cherry-pick --abort >/dev/null 2>&1 || true
  git -C "$TEMP_CLONE" reset --hard --quiet HEAD
  git -C "$TEMP_CLONE" clean -fdq
}

resolve_private_cherry_pick_conflicts() {
  local path
  local found_conflict=0

  while IFS= read -r path; do
    [ -n "$path" ] || continue
    found_conflict=1
    if ! path_matches_strip_pattern "$path"; then
      return 1
    fi
  done < <(git -C "$TEMP_CLONE" diff --name-only --diff-filter=U)

  if [ "$found_conflict" -ne 1 ]; then
    return 1
  fi

  strip_private_paths_from_clone

  if git -C "$TEMP_CLONE" diff --name-only --diff-filter=U | grep -q .; then
    return 1
  fi

  return 0
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

verify_public_release_surface() {
  local verifier="$TEMP_CLONE/scripts/verify-public-release-surface.js"

  if [ ! -f "$verifier" ]; then
    fail "Public release surface verifier was not found in replay output: scripts/verify-public-release-surface.js" 1
  fi

  log_info "Verifying public release surface imports."
  node "$verifier" "$TEMP_CLONE" >&2
}

verify_public_docs() {
  local verifier="$TEMP_CLONE/scripts/verify-public-docs.js"

  if [ ! -f "$verifier" ]; then
    fail "Public documentation verifier was not found in replay output: scripts/verify-public-docs.js" 1
  fi

  # Regression guard: replay strips private files commit by commit; validating
  # the finished public tree prevents retained docs from naming what was removed.
  log_info "Verifying public documentation content and references."
  node "$verifier" "$TEMP_CLONE" >&2
}

verify_public_assets() {
  local verifier="$TEMP_CLONE/scripts/verify-public-assets.js"

  if [ ! -f "$verifier" ]; then
    fail "Public asset verifier was not found in replay output: scripts/verify-public-assets.js" 1
  fi

  log_info "Verifying public asset ownership references."
  node "$verifier" "$TEMP_CLONE" >&2
}

verify_public_text() {
  local verifier="$TEMP_CLONE/scripts/verify-public-text.js"

  if [ ! -f "$verifier" ]; then
    fail "Public text verifier was not found in replay output: scripts/verify-public-text.js" 1
  fi

  log_info "Verifying retained public text for private references."
  node "$verifier" "$TEMP_CLONE" >&2
}

ensure_public_node_modules_link() {
  local node_path="$REPO_ROOT/node_modules"
  local temp_node_path="$TEMP_CLONE/node_modules"

  if [ ! -f "$TEMP_CLONE/package.json" ]; then
    fail "Cannot run public Node tests; package.json was not found in replay output." 1
  fi

  if [ -d "$node_path" ] && [ ! -e "$temp_node_path" ]; then
    log_info "Linking source node_modules into public test checkout."
    ln -s "$node_path" "$temp_node_path"
  fi

  log_info "Running public release Node tests."
  (
    cd "$TEMP_CLONE"
    if [ -d "$node_path" ]; then
      NODE_PATH="$node_path${NODE_PATH:+:$NODE_PATH}" npm run test:node
    else
      npm run test:node
    fi
  )
}

ensure_private_branch_guard() {
  if [ ! -f "$PRIVATE_BRANCH_GUARD_INSTALLER" ]; then
    fail "Private branch guard installer was not found: $PRIVATE_BRANCH_GUARD_INSTALLER" 1
  fi

  log_info "Ensuring the local private branch push guard is installed."
  bash "$PRIVATE_BRANCH_GUARD_INSTALLER" >/dev/null
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
    --source-base)
      shift
      if [ $# -eq 0 ]; then
        fail "--source-base requires a revision." 1
      fi
      SOURCE_BASE_REF="$1"
      ;;
    --target-base)
      shift
      if [ $# -eq 0 ]; then
        fail "--target-base requires a revision." 1
      fi
      TARGET_BASE_REF="$1"
      ;;
    --allow-diverged-source)
      ALLOW_DIVERGED_SOURCE=1
      ;;
    --sanitize-private-replay-messages)
      SANITIZE_PRIVATE_REPLAY_MESSAGES=1
      ;;
    --release-version)
      shift
      if [ $# -eq 0 ]; then
        fail "--release-version requires MAJOR.MINOR.PATCH." 1
      fi
      EXPLICIT_RELEASE_VERSION="$1"
      ;;
    --acknowledge-patch)
      ACKNOWLEDGE_PATCH=1
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

case "$TARGET_BRANCH" in
  release-staging*)
    RELEASE_VERSIONING_ENABLED=1
    ;;
esac

if ! git -C "$REPO_ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  fail "Repository root is not a git repository: $REPO_ROOT" 1
fi

ensure_private_branch_guard

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

AGENT_BRIDGE_PUBLIC_CUTOVER_COMMIT=$(
  git -C "$REPO_ROOT" log \
    --diff-filter=A \
    --format='%H' \
    "$SOURCE_BRANCH" \
    -- "$AGENT_BRIDGE_PUBLIC_CUTOVER_MARKER" |
    sed -n '1p'
)

if git -C "$REPO_ROOT" cat-file -e "${SOURCE_BRANCH}:${AGENT_BRIDGE_PUBLIC_CUTOVER_MARKER}" 2>/dev/null; then
  if [ -z "$AGENT_BRIDGE_PUBLIC_CUTOVER_COMMIT" ]; then
    fail "Agent Bridge public cutover marker exists, but its introducing commit could not be resolved." 2
  fi

  cutover_header=$(
    git -C "$REPO_ROOT" show \
      "${AGENT_BRIDGE_PUBLIC_CUTOVER_COMMIT}:${AGENT_BRIDGE_PUBLIC_CUTOVER_MARKER}" |
      sed -n '1p'
  )
  if [ "$cutover_header" != "$AGENT_BRIDGE_PUBLIC_CUTOVER_HEADER" ]; then
    fail "Agent Bridge public cutover marker has an unsupported header." 2
  fi

  for required_path in "${AGENT_BRIDGE_PUBLIC_CUTOVER_REQUIRED_PATHS[@]}"; do
    if ! git -C "$REPO_ROOT" cat-file -e \
      "${AGENT_BRIDGE_PUBLIC_CUTOVER_COMMIT}:${required_path}" 2>/dev/null; then
      fail "Agent Bridge public cutover commit is missing required path: $required_path" 2
    fi
  done

  log_info "Agent Bridge public history cutover: $AGENT_BRIDGE_PUBLIC_CUTOVER_COMMIT"
elif [ -n "$AGENT_BRIDGE_PUBLIC_CUTOVER_COMMIT" ]; then
  fail "Agent Bridge public cutover marker was removed from the source branch." 2
else
  log_info "Agent Bridge public history remains stripped; no cutover marker is present."
fi

git -C "$REPO_ROOT" fetch --quiet origin main

SOURCE_BASE="${SOURCE_BASE_REF:-origin/main}"
TARGET_BASE="${TARGET_BASE_REF:-origin/main}"

if ! git -C "$REPO_ROOT" rev-parse --verify --quiet "$SOURCE_BASE^{commit}" >/dev/null; then
  fail "Source base revision was not found: $SOURCE_BASE" 1
fi

if ! git -C "$REPO_ROOT" rev-parse --verify --quiet "$TARGET_BASE^{commit}" >/dev/null; then
  fail "Target base revision was not found: $TARGET_BASE" 1
fi

SOURCE_CONTAINS_ORIGIN_MAIN=0
if git -C "$REPO_ROOT" merge-base --is-ancestor origin/main "$SOURCE_BRANCH"; then
  SOURCE_CONTAINS_ORIGIN_MAIN=1
fi

if [ "$SOURCE_BASE_REF" != "" ]; then
  if ! git -C "$REPO_ROOT" merge-base --is-ancestor "$SOURCE_BASE" "$SOURCE_BRANCH"; then
    fail "$SOURCE_BASE is not an ancestor of $SOURCE_BRANCH." 1
  fi
  log_info "Using explicit source base $SOURCE_BASE for replay."
elif [ "$SOURCE_CONTAINS_ORIGIN_MAIN" -ne 1 ] && [ "$ALLOW_DIVERGED_SOURCE" -ne 1 ]; then
  fail "origin/main is not an ancestor of $SOURCE_BRANCH. Rebase or merge $SOURCE_BRANCH before running sync-public-history.sh, or pass --allow-diverged-source to replay patch-new non-merge commits." 1
elif [ "$SOURCE_CONTAINS_ORIGIN_MAIN" -ne 1 ]; then
  log_info "origin/main is not an ancestor of $SOURCE_BRANCH; using git cherry to replay patch-new non-merge commits."
fi

if [ "$TARGET_BASE_REF" != "" ]; then
  log_info "Using explicit target base $TARGET_BASE for $TARGET_BRANCH."
fi

MERGE_COUNT=$(git -C "$REPO_ROOT" rev-list --count --merges "$SOURCE_BASE..$SOURCE_BRANCH")
if [ "$MERGE_COUNT" -ne 0 ] && [ "$ALLOW_DIVERGED_SOURCE" -ne 1 ]; then
  fail "Merge commits were found in $SOURCE_BASE..$SOURCE_BRANCH. This script only supports a linear history." 1
elif [ "$MERGE_COUNT" -ne 0 ]; then
  log_info "Merge commits were found in $SOURCE_BASE..$SOURCE_BRANCH; replaying non-merge patch commits only."
fi

COMMITS=()
if [ "$SOURCE_BASE_REF" != "" ]; then
  while IFS= read -r commit_sha; do
    COMMITS+=("$commit_sha")
  done < <(git -C "$REPO_ROOT" rev-list --reverse --no-merges "$SOURCE_BASE..$SOURCE_BRANCH")
elif [ "$ALLOW_DIVERGED_SOURCE" -eq 1 ]; then
  while IFS= read -r commit_sha; do
    COMMITS+=("$commit_sha")
  done < <(git -C "$REPO_ROOT" cherry -v origin/main "$SOURCE_BRANCH" | awk '$1 == "+" {print $2}')
else
  while IFS= read -r commit_sha; do
    COMMITS+=("$commit_sha")
  done < <(git -C "$REPO_ROOT" rev-list --reverse "$SOURCE_BASE..$SOURCE_BRANCH")
fi
if [ "${#COMMITS[@]}" -eq 0 ]; then
  printf 'Nothing to replay from %s..%s.\n' "$SOURCE_BASE" "$SOURCE_BRANCH"
  exit 0
fi

TMP_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/sync-public-history.XXXXXX")
TEMP_CLONE="$TMP_ROOT/replay"
RELEASE_CHANGED_PATHS_FILE="$TMP_ROOT/release-changed-paths.txt"
RELEASE_SUBJECTS_FILE="$TMP_ROOT/release-subjects.txt"
RELEASE_PLAN_FILE="$TMP_ROOT/release-plan.json"
REPLAY_HOOKS_DIR="$TMP_ROOT/replay-hooks"
mkdir -p "$REPLAY_HOOKS_DIR"

log_info "Cloning source repo into temporary workspace: $TEMP_CLONE"
# Avoid Git's local hardlink/copy optimization. The source repository can gain
# objects while release checks run, and a local clone may race with that object
# database on CI. The upload-pack transport produces one consistent snapshot.
git clone --quiet --no-local "$REPO_ROOT" "$TEMP_CLONE"

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
  git -C "$TEMP_CLONE" fetch --quiet origin \
    "refs/heads/$TARGET_BRANCH:refs/remotes/origin/$TARGET_BRANCH"
fi

git -C "$TEMP_CLONE" checkout --quiet -B "$TARGET_BRANCH" "$TARGET_BASE"
log_info "Prepared temp branch $TARGET_BRANCH from $TARGET_BASE."

if [ "$DRY_RUN" -eq 1 ]; then
  for commit_sha in "${COMMITS[@]}"; do
    subject=$(git -C "$REPO_ROOT" log -1 --format='%s' "$commit_sha")
    if commit_is_empty_after_strip "$commit_sha"; then
      SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
      log_info "DRY RUN skip  $commit_sha | $subject"
    else
      message_file="$TMP_ROOT/commit-message.txt"
      git -C "$REPO_ROOT" log -1 --format='%B' "$commit_sha" > "$message_file"
      ensure_public_replay_message "$commit_sha" "$subject" "$message_file"
      REPLAYED_COUNT=$((REPLAYED_COUNT + 1))
      log_info "DRY RUN replay $commit_sha | $subject"
    fi
  done

  if [ "$RELEASE_VERSIONING_ENABLED" -eq 1 ]; then
    collect_source_release_evidence
    plan_release_candidate_version 1
  fi

  printf 'Dry run complete.\n'
  printf 'Would replay: %s\n' "$REPLAYED_COUNT"
  printf 'Would skip: %s\n' "$SKIPPED_COUNT"
  printf 'Source branch: %s\n' "$SOURCE_BRANCH"
  printf 'Source base: %s\n' "$SOURCE_BASE"
  printf 'Target base: %s\n' "$TARGET_BASE"
  printf 'Branch name: %s\n' "$TARGET_BRANCH"
  if [ "$RELEASE_VERSIONING_ENABLED" -eq 1 ]; then
    printf 'Release impact suggestion: %s\n' "$RELEASE_IMPACT"
    printf 'Proposed release version: %s\n' "$RELEASE_VERSION"
  fi
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
    if resolve_private_cherry_pick_conflicts; then
      log_info "Resolved stripped-path cherry-pick conflicts for $commit_sha | $subject"
    else
      log_error "Cherry-pick failed for $commit_sha | $subject"
      reset_clone_to_branch_head
      log_error "Resolve the conflict manually by replaying this commit onto a branch based on origin/main."
      exit 1
    fi
  fi

  strip_private_paths_from_clone "$commit_sha"

  if ! verify_agent_bridge_public_replay_pii "$commit_sha"; then
    exit 2
  fi

  if git -C "$TEMP_CLONE" diff --cached --quiet; then
    SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    log_info "Skipped $commit_sha after stripping private-only changes."
    reset_clone_to_branch_head
    continue
  fi

  ensure_public_replay_message "$commit_sha" "$subject" "$message_file"
  bind_public_replay_to_source "$commit_sha" "$message_file"

  GIT_AUTHOR_NAME="$PUBLIC_GIT_NAME" \
  GIT_AUTHOR_EMAIL="$PUBLIC_GIT_EMAIL" \
  GIT_AUTHOR_DATE="$author_date" \
  GIT_COMMITTER_NAME="$PUBLIC_GIT_NAME" \
  GIT_COMMITTER_EMAIL="$PUBLIC_GIT_EMAIL" \
  GIT_COMMITTER_DATE="$committer_date" \
    git -C "$TEMP_CLONE" \
      -c "core.hooksPath=$REPLAY_HOOKS_DIR" \
      commit --quiet --no-gpg-sign --file "$message_file"

  REPLAYED_COUNT=$((REPLAYED_COUNT + 1))
  LATEST_REPLAYED_SOURCE_COMMIT="$commit_sha"
  replayed_head=$(git -C "$TEMP_CLONE" rev-parse HEAD)
  log_info "Replayed $commit_sha -> $replayed_head | $subject"
done

if [ "$RELEASE_VERSIONING_ENABLED" -eq 1 ]; then
  collect_replayed_release_evidence
  plan_release_candidate_version 0
  stamp_release_candidate_version
fi

if strip_findings=$(verify_strip_patterns_absent); then
  :
else
  log_error "Strip verification failed; private paths are still present:"
  printf '%s\n' "$strip_findings" >&2
  exit 2
fi

if planning_findings=$(verify_private_planning_paths_absent); then
  :
else
  log_error "Private planning path verification failed; public branch still contains:"
  printf '%s\n' "$planning_findings" >&2
  exit 2
fi

offending_identities=$(author_audit_output)
if [ -n "$offending_identities" ]; then
  log_error "Identity audit failed; offending commits:"
  printf '%s\n' "$offending_identities" >&2
  exit 2
fi

if ! verify_public_release_surface; then
  exit 2
fi

if ! verify_public_docs; then
  exit 2
fi

if ! verify_public_assets; then
  exit 2
fi

if ! verify_public_text; then
  exit 2
fi

if ! verify_public_test_wiring; then
  exit 2
fi

if ! verify_public_type_debt; then
  exit 2
fi

if ! verify_public_node_tests; then
  exit 2
fi

sync_branch_back_to_source_repo

push_branch_to_origin

printf 'Replay complete.\n'
printf 'Source branch: %s\n' "$SOURCE_BRANCH"
printf 'Source base: %s\n' "$SOURCE_BASE"
printf 'Target base: %s\n' "$TARGET_BASE"
printf 'Branch name: %s\n' "$TARGET_BRANCH"
printf 'Replayed commits: %s\n' "$REPLAYED_COUNT"
printf 'Skipped commits: %s\n' "$SKIPPED_COUNT"
if [ "$RELEASE_VERSIONING_ENABLED" -eq 1 ]; then
  printf 'Release impact suggestion: %s\n' "$RELEASE_IMPACT"
  printf 'Release version: %s\n' "$RELEASE_VERSION"
fi
printf 'Temp dir: %s\n' "$TMP_ROOT"
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
