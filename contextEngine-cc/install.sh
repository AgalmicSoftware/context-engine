#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_NAME="contextEngine-cc"
PLUGIN_DIR="$HOME/.claude/plugins/$PLUGIN_NAME"
REQUESTED_PROJECT_DIR="${PROJECT_DIR:-}"
USER_SETTINGS_FILE="$HOME/.claude/settings.json"
SERVER_URL_WAS_SET=0
if [ "${SERVER_URL+x}" = "x" ]; then
  SERVER_URL_WAS_SET=1
fi
SERVER_URL="${SERVER_URL:-http://localhost:7391}"
MODE="both"
GLOBAL_HOOKS=0
CLAUDE_PROTOCOL_PATH="$SCRIPT_DIR/CLAUDE_EXTENSION.md"
CLAUDE_MARKER_START="<!-- contextengine-cc:survey-hooks:start -->"
CLAUDE_MARKER_END="<!-- contextengine-cc:survey-hooks:end -->"

echo "=== Context Engine CC Installer ==="
echo ""

print_usage() {
  cat <<'EOF'
Usage: ./install.sh [--hook-only | --server-only | --claude-md-only] [--global-hooks]

Options:
  --hook-only       Install/refresh the CE-CC runtime bundle and Claude activation only
  --server-only     Install server dependencies only
  --claude-md-only  Install or refresh the managed CLAUDE.md block only
  --global-hooks    Write CE-CC activation to ~/.claude/settings.json instead of
                    <project>/.claude/settings.local.json
  --help            Show this help text
EOF
}

fail() {
  echo "[install] $1" >&2
  exit 1
}

parse_args() {
  local mode_set=0
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --hook-only)
        if [ "$mode_set" -eq 1 ]; then
          fail "Choose only one mode: --hook-only, --server-only, or --claude-md-only"
        fi
        MODE="hook-only"
        mode_set=1
        ;;
      --server-only)
        if [ "$mode_set" -eq 1 ]; then
          fail "Choose only one mode: --hook-only, --server-only, or --claude-md-only"
        fi
        MODE="server-only"
        mode_set=1
        ;;
      --claude-md-only)
        if [ "$mode_set" -eq 1 ]; then
          fail "Choose only one mode: --hook-only, --server-only, or --claude-md-only"
        fi
        MODE="claude-md-only"
        mode_set=1
        ;;
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

  if [ "$GLOBAL_HOOKS" -eq 1 ] && { [ "$MODE" = "server-only" ] || [ "$MODE" = "claude-md-only" ]; }; then
    fail "--global-hooks can only be used with the default install or --hook-only"
  fi
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

resolve_project_shared_settings_path() {
  printf '%s/.claude/settings.json' "$(resolve_target_project_dir)"
}

write_plugin_config() {
  local config_file="$PLUGIN_DIR/.state/config.json"
  CONFIG_FILE="$config_file" \
  SERVER_URL="$SERVER_URL" \
  SERVER_URL_WAS_SET="$SERVER_URL_WAS_SET" \
  CE_DIR="$SCRIPT_DIR" \
  node - <<'NODE'
const fs = require('fs');

const path = process.env.CONFIG_FILE;
const explicitServerUrl = process.env.SERVER_URL_WAS_SET === '1';
let current = {};
try {
  if (path && fs.existsSync(path)) {
    current = JSON.parse(fs.readFileSync(path, 'utf8'));
  }
} catch {
  current = {};
}
if (!current || typeof current !== 'object' || Array.isArray(current)) {
  current = {};
}

const next = {
  ...current,
  ceDir: process.env.CE_DIR || current.ceDir || '',
};
if (explicitServerUrl || !next.serverUrl) {
  next.serverUrl = process.env.SERVER_URL || next.serverUrl || 'http://localhost:7391';
}
if (typeof next.defaultSession !== 'string') {
  next.defaultSession = '';
}

fs.writeFileSync(path, JSON.stringify(next, null, 2));
NODE
}

install_runtime_bundle() {
  echo "[hook] Installing runtime bundle to $PLUGIN_DIR"
  mkdir -p "$PLUGIN_DIR" "$PLUGIN_DIR/.state" "$PLUGIN_DIR/public"
  cp -R "$SCRIPT_DIR/hook" "$PLUGIN_DIR/"
  cp -R "$SCRIPT_DIR/status" "$PLUGIN_DIR/"
  cp -R "$SCRIPT_DIR/lib" "$PLUGIN_DIR/"
  cp -R "$SCRIPT_DIR/public/js" "$PLUGIN_DIR/public/"
  cp "$CLAUDE_PROTOCOL_PATH" "$PLUGIN_DIR/CLAUDE_EXTENSION.md"
  chmod 755 "$PLUGIN_DIR/hook/startup.sh"
  write_plugin_config
}

configure_hooks() {
  local settings_target="$1"
  local install_scope="$2"
  local clean_global="$3"
  local project_shared_settings_file="$4"

  SETTINGS_TARGET="$settings_target" \
  INSTALL_SCOPE="$install_scope" \
  CLEAN_GLOBAL="$clean_global" \
  PROJECT_SHARED_SETTINGS_FILE="$project_shared_settings_file" \
  USER_SETTINGS_FILE="$USER_SETTINGS_FILE" \
  PLUGIN_DIR="$PLUGIN_DIR" \
  node - <<'NODE'
const fs = require('fs');
const path = require('path');

const targetPath = process.env.SETTINGS_TARGET;
const installScope = process.env.INSTALL_SCOPE;
const cleanGlobal = process.env.CLEAN_GLOBAL === '1';
const projectSharedPath = process.env.PROJECT_SHARED_SETTINGS_FILE || '';
const userSettingsPath = process.env.USER_SETTINGS_FILE || '';
const pluginDir = process.env.PLUGIN_DIR;

function readSettings(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, 'utf8');
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Settings file must contain an object: ${filePath}`);
  }
  return parsed;
}

function writeSettings(filePath, settings) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2));
}

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

function hasForeignStatusLine(settings) {
  return !!settings?.statusLine && !isOwnedStatusLine(settings.statusLine);
}

function stripCeHooks(settings) {
  let changed = false;
  if (!settings?.hooks || typeof settings.hooks !== 'object') return changed;
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
  return changed;
}

function stripCeActivation(settings) {
  let changed = stripCeHooks(settings);
  if (isOwnedStatusLine(settings?.statusLine)) {
    delete settings.statusLine;
    changed = true;
  }
  return changed;
}

function ensureEvent(settings, event, matcher, entry) {
  if (!settings.hooks || typeof settings.hooks !== 'object' || Array.isArray(settings.hooks)) {
    settings.hooks = {};
  }
  if (!Array.isArray(settings.hooks[event])) {
    settings.hooks[event] = [];
  }
  settings.hooks[event] = settings.hooks[event].filter((hookConfig) => !(
    hookConfig?.hooks
    && hookConfig.hooks.some((hookEntry) => isCeCommand(hookEntry?.command))
  ));
  settings.hooks[event].push({
    matcher,
    hooks: [entry],
  });
}

const startupCmd = `bash ${path.resolve(pluginDir, 'hook', 'startup.sh')}`;
const hookCmd = `node ${path.resolve(pluginDir, 'hook', 'entry.mjs')}`;
const statusCmd = `node ${path.resolve(pluginDir, 'status', 'entry.mjs')}`;
const startupEntry = { type: 'command', command: startupCmd, timeout: 15000 };
const hookEntry = { type: 'command', command: hookCmd, timeout: 15000 };

let userSettings = userSettingsPath === targetPath ? readSettings(targetPath) : readSettings(userSettingsPath);
if (cleanGlobal && userSettingsPath && userSettingsPath !== targetPath && fs.existsSync(userSettingsPath)) {
  const globalChanged = stripCeActivation(userSettings);
  if (globalChanged) {
    writeSettings(userSettingsPath, userSettings);
    console.info('[hook] Removed legacy global Context Engine activation from ' + userSettingsPath);
  }
}

const targetSettings = targetPath === userSettingsPath ? userSettings : readSettings(targetPath);
const projectSharedSettings = (
  projectSharedPath && projectSharedPath !== targetPath
) ? readSettings(projectSharedPath) : {};

ensureEvent(targetSettings, 'SessionStart', 'startup|resume|clear|compact', startupEntry);
ensureEvent(targetSettings, 'PreToolUse', 'Bash|Write|Edit|Read|Glob|Grep|Task', hookEntry);
ensureEvent(targetSettings, 'Notification', 'idle_prompt', hookEntry);

const statusSources = installScope === 'local'
  ? [targetSettings, projectSharedSettings, userSettings]
  : [targetSettings];
const shouldInstallStatusLine = !statusSources.some((settings) => hasForeignStatusLine(settings));

if (shouldInstallStatusLine) {
  targetSettings.statusLine = {
    type: 'command',
    command: statusCmd,
  };
  console.info('[statusline] Installed Context Engine status line');
} else {
  if (isOwnedStatusLine(targetSettings.statusLine)) {
    delete targetSettings.statusLine;
  }
  console.info('[statusline] Existing statusLine preserved; configure Context Engine manually if you want it active');
}

writeSettings(targetPath, targetSettings);
console.info('[hook] Updated ' + targetPath);
NODE
}

install_hook() {
  local install_scope="local"
  local settings_target
  local clean_global="1"
  local project_shared_settings_file

  install_runtime_bundle

  if [ "$GLOBAL_HOOKS" -eq 1 ]; then
    install_scope="global"
    settings_target="$USER_SETTINGS_FILE"
    clean_global="0"
    project_shared_settings_file=""
  else
    settings_target="$(resolve_project_local_settings_path)"
    project_shared_settings_file="$(resolve_project_shared_settings_path)"
  fi

  configure_hooks "$settings_target" "$install_scope" "$clean_global" "$project_shared_settings_file"
  echo "[hook] Hooks installed successfully"
}

inject_claude_md() {
  local CLAUDE_MD
  CLAUDE_MD="$(resolve_project_claude_md_path)"

  if [ ! -f "$CLAUDE_PROTOCOL_PATH" ]; then
    echo "[claude.md] Missing protocol template: $CLAUDE_PROTOCOL_PATH" >&2
    return 1
  fi

  CLAUDE_MD_PATH="$CLAUDE_MD" \
  CLAUDE_PROTOCOL_PATH="$CLAUDE_PROTOCOL_PATH" \
  CLAUDE_MARKER_START="$CLAUDE_MARKER_START" \
  CLAUDE_MARKER_END="$CLAUDE_MARKER_END" \
  node - <<'NODE'
const fs = require('fs');

const claudePath = process.env.CLAUDE_MD_PATH;
const protocolPath = process.env.CLAUDE_PROTOCOL_PATH;
const startMarker = process.env.CLAUDE_MARKER_START;
const endMarker = process.env.CLAUDE_MARKER_END;

if (!claudePath || !protocolPath || !startMarker || !endMarker) process.exit(1);
if (!fs.existsSync(protocolPath)) {
  console.error(`[claude.md] Missing protocol template: ${protocolPath}`);
  process.exit(1);
}

const normalizeNewlines = (value) => String(value || '').replace(/\r\n/g, '\n');
const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const currentProtocol = normalizeNewlines(fs.readFileSync(protocolPath, 'utf8')).trim();
const markedBlockPattern = new RegExp(
  `\\n?${escapeRegExp(startMarker)}\\n?[\\s\\S]*?\\n?${escapeRegExp(endMarker)}\\n?`,
  'g'
);

function stripExistingHookBlock(source) {
  return source.replace(markedBlockPattern, '\n').replace(/\n{3,}/g, '\n\n');
}

const existingRaw = fs.existsSync(claudePath) ? fs.readFileSync(claudePath, 'utf8') : '';
const hadWindowsNewlines = existingRaw.includes('\r\n');
const existing = normalizeNewlines(existingRaw);
const stripped = stripExistingHookBlock(existing);
const wrappedProtocol = `${startMarker}\n${currentProtocol}\n${endMarker}`;

let updated;
if (!stripped.trim()) {
  updated = `${wrappedProtocol}\n`;
} else {
  const headingMatch = stripped.match(/^# .*(?:\n|$)/m);
  if (headingMatch && headingMatch.index !== undefined) {
    const insertAt = headingMatch.index + headingMatch[0].length;
    const before = stripped.slice(0, insertAt);
    const after = stripped.slice(insertAt).replace(/^\n+/, '');
    updated = `${before}\n${wrappedProtocol}\n${after}`;
  } else {
    updated = `${wrappedProtocol}\n\n${stripped.replace(/^\n+/, '')}`;
  }
}

updated = updated.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
if (hadWindowsNewlines) {
  updated = updated.replace(/\n/g, '\r\n');
}

if (existingRaw === updated) {
  console.info(`[claude.md] Survey hooks section already current in ${claudePath}`);
  process.exit(0);
}

fs.writeFileSync(claudePath, updated);
console.info(`[claude.md] Installed survey hooks section in ${claudePath}`);
NODE
}

install_server() {
  echo "[server] Installing server dependencies..."
  cd "$SCRIPT_DIR"
  npm install
  echo "[server] Dependencies installed"
}

parse_args "$@"

case "$MODE" in
  hook-only)
    install_hook
    inject_claude_md
    ;;
  server-only)
    install_server
    ;;
  claude-md-only)
    inject_claude_md
    ;;
  both)
    install_server
    install_hook
    inject_claude_md
    ;;
esac

echo ""
echo "=== Installation Complete ==="
echo ""
if [ "$GLOBAL_HOOKS" -eq 1 ]; then
  echo "Activation: global (~/.claude/settings.json)"
else
  echo "Activation: project-local ($(resolve_project_local_settings_path))"
fi
echo "Start CE-CC: cd $SCRIPT_DIR && npm start"
echo "Sign in: http://localhost:7391"
echo ""
