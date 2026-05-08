#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REQUESTED_PROJECT_DIR="${PROJECT_DIR:-}"
PLUGIN_NAME="contextEngine-cc"
PLUGIN_DIR="$HOME/.claude/plugins/$PLUGIN_NAME"
USER_SETTINGS_FILE="$HOME/.claude/settings.json"
GLOBAL_HOOKS=0
CLAUDE_MARKER_START="<!-- contextengine-cc:survey-hooks:start -->"
CLAUDE_MARKER_END="<!-- contextengine-cc:survey-hooks:end -->"

echo "=== Context Engine CC Uninstaller ==="
echo ""

print_usage() {
  cat <<'EOF'
Usage: ./uninstall.sh [--global-hooks]

Options:
  --global-hooks  Also remove CE-CC activation from ~/.claude/settings.json
  --help          Show this help text
EOF
}

fail() {
  echo "[uninstall] $1" >&2
  exit 1
}

parse_args() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --global-hooks)
        GLOBAL_HOOKS=1
        ;;
      --help|-h)
        print_usage
        exit 0
        ;;
      *)
        fail "Unknown option: $1"
        ;;
    esac
    shift
  done
}

resolve_target_project_dir() {
  local project_dir="${REQUESTED_PROJECT_DIR:-$(pwd)}"
  if [ -z "$REQUESTED_PROJECT_DIR" ]; then
    case "$project_dir" in
      "$SCRIPT_DIR"|"$SCRIPT_DIR"/*)
        printf '%s' "$(dirname "$SCRIPT_DIR")"
        return
        ;;
    esac
  fi
  printf '%s' "$project_dir"
}

resolve_project_claude_md_path() {
  printf '%s/CLAUDE.md' "$(resolve_target_project_dir)"
}

resolve_project_local_settings_path() {
  printf '%s/.claude/settings.local.json' "$(resolve_target_project_dir)"
}

remove_activation() {
  local settings_file="$1"
  local label="$2"

  SETTINGS_FILE="$settings_file" LABEL="$label" node - <<'NODE'
const fs = require('fs');
const path = process.env.SETTINGS_FILE;
const label = process.env.LABEL;

if (!path || !fs.existsSync(path)) process.exit(0);

const raw = fs.readFileSync(path, 'utf8');
const settings = raw.trim() ? JSON.parse(raw) : {};

function isCeCommand(command) {
  return typeof command === 'string' && command.includes('contextEngine-cc');
}

function isOwnedStatusLine(statusLine) {
  return !!(
    statusLine
    && statusLine.type === 'command'
    && typeof statusLine.command === 'string'
    && statusLine.command.includes('contextEngine-cc/status/')
  );
}

let changed = false;
if (settings.hooks && typeof settings.hooks === 'object') {
  for (const event of ['SessionStart', 'PreToolUse', 'Notification']) {
    if (!Array.isArray(settings.hooks[event])) continue;
    const filtered = settings.hooks[event].filter((hookConfig) => !(
      hookConfig?.hooks
      && hookConfig.hooks.some((hookEntry) => isCeCommand(hookEntry?.command))
    ));
    if (filtered.length !== settings.hooks[event].length) {
      changed = true;
    }
    if (filtered.length > 0) settings.hooks[event] = filtered;
    else delete settings.hooks[event];
  }
  if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }
}

if (isOwnedStatusLine(settings.statusLine)) {
  delete settings.statusLine;
  changed = true;
}

if (!changed) {
  console.info(`[uninstall] No Context Engine activation found in ${label}`);
  process.exit(0);
}

fs.writeFileSync(path, JSON.stringify(settings, null, 2));
console.info(`[uninstall] Cleaned ${label}`);
NODE
}

has_activation() {
  local settings_file="$1"

  SETTINGS_FILE="$settings_file" node - <<'NODE'
const fs = require('fs');
const path = process.env.SETTINGS_FILE;

if (!path || !fs.existsSync(path)) process.exit(1);

const raw = fs.readFileSync(path, 'utf8');
const settings = raw.trim() ? JSON.parse(raw) : {};

function isCeCommand(command) {
  return typeof command === 'string' && command.includes('contextEngine-cc');
}

function isOwnedStatusLine(statusLine) {
  return !!(
    statusLine
    && statusLine.type === 'command'
    && typeof statusLine.command === 'string'
    && statusLine.command.includes('contextEngine-cc/status/')
  );
}

if (isOwnedStatusLine(settings.statusLine)) {
  process.exit(0);
}

for (const event of ['SessionStart', 'PreToolUse', 'Notification']) {
  if (!Array.isArray(settings?.hooks?.[event])) continue;
  const ownsEvent = settings.hooks[event].some((hookConfig) => (
    hookConfig?.hooks
    && hookConfig.hooks.some((hookEntry) => isCeCommand(hookEntry?.command))
  ));
  if (ownsEvent) {
    process.exit(0);
  }
}

process.exit(1);
NODE
}

clean_claude_md() {
  local claude_md_path
  claude_md_path="$(resolve_project_claude_md_path)"

  if [ ! -f "$claude_md_path" ]; then
    return
  fi

  CLAUDE_MD_PATH="$claude_md_path" \
  CLAUDE_MARKER_START="$CLAUDE_MARKER_START" \
  CLAUDE_MARKER_END="$CLAUDE_MARKER_END" \
  node - <<'NODE'
const fs = require('fs');

const claudePath = process.env.CLAUDE_MD_PATH;
const startMarker = process.env.CLAUDE_MARKER_START;
const endMarker = process.env.CLAUDE_MARKER_END;
if (!claudePath || !fs.existsSync(claudePath)) process.exit(0);

const normalizeNewlines = (value) => String(value || '').replace(/\r\n/g, '\n');
const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const originalRaw = fs.readFileSync(claudePath, 'utf8');
const hadWindowsNewlines = originalRaw.includes('\r\n');
let updated = normalizeNewlines(originalRaw);

if (startMarker && endMarker) {
  const markedBlockPattern = new RegExp(
    `\\n?${escapeRegExp(startMarker)}\\n?[\\s\\S]*?\\n?${escapeRegExp(endMarker)}\\n?`,
    'g'
  );
  updated = updated.replace(markedBlockPattern, '\n');
}

updated = updated.replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '').trimEnd() + '\n';
if (hadWindowsNewlines) {
  updated = updated.replace(/\n/g, '\r\n');
}

if (updated === originalRaw) {
  console.info('[uninstall] No CLAUDE.md survey block matched in ' + claudePath);
  process.exit(0);
}

fs.writeFileSync(claudePath, updated);
console.info('[uninstall] Cleaned ' + claudePath);
NODE
}

parse_args "$@"

remove_activation "$(resolve_project_local_settings_path)" "project-local Claude settings"
if [ "$GLOBAL_HOOKS" -eq 1 ]; then
  remove_activation "$USER_SETTINGS_FILE" "global Claude settings"
fi
clean_claude_md

if [ "$GLOBAL_HOOKS" -eq 0 ] && has_activation "$USER_SETTINGS_FILE"; then
  echo "[uninstall] Global CE-CC activation is still present in $USER_SETTINGS_FILE; keeping $PLUGIN_DIR so other Claude Code sessions do not break."
  echo "[uninstall] Rerun with --global-hooks when you want to remove the shared plugin bundle too."
elif [ -d "$PLUGIN_DIR" ]; then
  rm -rf "$PLUGIN_DIR"
  echo "[uninstall] Removed $PLUGIN_DIR"
fi

echo ""
echo "=== Uninstall Complete ==="
echo "Note: Passkeys remain on your device (managed by your OS)."
echo "Note: Server data (.data/) in the repo is untouched."
if [ "$GLOBAL_HOOKS" -eq 0 ]; then
  echo "Note: If you installed CE-CC with --global-hooks, rerun uninstall with --global-hooks to remove global activation and the shared plugin bundle."
fi
echo ""
