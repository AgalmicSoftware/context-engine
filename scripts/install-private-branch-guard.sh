#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd -P)
HOOKS_DIR_REL=".githooks"
HOOKS_DIR="$REPO_ROOT/$HOOKS_DIR_REL"
PRE_PUSH_HOOK="$HOOKS_DIR/pre-push"

log_info() {
  printf '%s\n' "$*"
}

fail() {
  printf '%s\n' "$1" >&2
  exit "${2:-1}"
}

if ! git -C "$REPO_ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  fail "Repository root is not a git repository: $REPO_ROOT" 1
fi

if [ ! -f "$PRE_PUSH_HOOK" ]; then
  fail "Expected pre-push hook was not found: $PRE_PUSH_HOOK" 1
fi

chmod +x "$PRE_PUSH_HOOK"
git -C "$REPO_ROOT" config --local core.hooksPath "$HOOKS_DIR_REL"
log_info "Installed repo-local hooks from $HOOKS_DIR_REL."

if git -C "$REPO_ROOT" show-ref --verify --quiet refs/heads/dev; then
  if git -C "$REPO_ROOT" rev-parse --abbrev-ref --symbolic-full-name dev@{upstream} >/dev/null 2>&1; then
    git -C "$REPO_ROOT" branch --unset-upstream dev
    log_info "Unset upstream for local dev."
  else
    log_info "Local dev already has no upstream."
  fi
fi
