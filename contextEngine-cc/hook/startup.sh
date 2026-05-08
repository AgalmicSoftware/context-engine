#!/usr/bin/env bash
set -u

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_DIR="$(cd "$HOOK_DIR/.." && pwd)"
STATE_DIR="$PLUGIN_DIR/.state"
STARTUP_LOCK_DIR="${CE_CC_STARTUP_LOCK_DIR:-${TMPDIR:-/tmp}/contextengine-cc-startup-locks}"
PROTOCOL_PATH="$PLUGIN_DIR/CLAUDE_EXTENSION.md"

mkdir -p "$STATE_DIR"
mkdir -p "$STARTUP_LOCK_DIR"

discover_ce_dir() {
  if [ -n "${CE_DIR:-}" ] && [ -f "${CE_DIR}/server.mjs" ]; then
    printf '%s' "$CE_DIR"
    return
  fi

  local configured_ce_dir
  configured_ce_dir="$(read_config_field "ceDir" "")"
  if [ -n "$configured_ce_dir" ] && [ -f "$configured_ce_dir/server.mjs" ]; then
    printf '%s' "$configured_ce_dir"
    return
  fi

  local search_dir="${CE_DIR:-$PWD}"

  while [ -n "$search_dir" ]; do
    if [ -f "$search_dir/server.mjs" ] && [ "$(basename "$search_dir")" = "contextEngine-cc" ]; then
      printf '%s' "$search_dir"
      return
    fi
    if [ -f "$search_dir/contextEngine-cc/server.mjs" ]; then
      printf '%s' "$search_dir/contextEngine-cc"
      return
    fi

    local parent_dir
    parent_dir="$(dirname "$search_dir")"
    if [ "$parent_dir" = "$search_dir" ]; then
      break
    fi
    search_dir="$parent_dir"
  done
}

read_config_field() {
  local field_name="$1"
  local fallback_value="${2:-}"
  local config_path="$STATE_DIR/config.json"

  if [ -f "$config_path" ]; then
    local configured_url
    configured_url="$(node -e "
const fs = require('fs');
const [path, fieldName, fallbackValue] = process.argv.slice(1);
try {
  const raw = fs.readFileSync(path, 'utf8');
  const config = JSON.parse(raw);
  const value = typeof config[fieldName] === 'string' ? config[fieldName].trim() : '';
  process.stdout.write(value || fallbackValue || '');
} catch {
  process.stdout.write(fallbackValue || '');
}
" "$config_path" "$field_name" "$fallback_value" 2>/dev/null || true)"
    if [ -n "$configured_url" ]; then
      printf '%s' "$configured_url"
      return
    fi
  fi

  printf '%s' "$fallback_value"
}

read_server_url() {
  read_config_field "serverUrl" "http://localhost:7391"
}

is_local_server_url() {
  case "$SERVER_URL" in
    http://localhost:*|http://127.0.0.1:*|http://[::1]:*|https://localhost:*|https://127.0.0.1:*|https://[::1]:*)
      return 0
      ;;
  esac
  return 1
}

server_is_running() {
  curl -fsS -m 2 "${SERVER_URL%/}/" >/dev/null 2>&1
}

server_pid_path() {
  local scope_key
  # Regression guard: keep the startup lock scoped to SERVER_URL, not CE dir.
  # Multiple workspaces can intentionally point at different local URLs, but two
  # CE dirs targeting the same URL must still share one in-flight launch guard.
  scope_key="$(
    printf '%s' "$SERVER_URL" | cksum | awk '{print $1}'
  )"
  printf '%s/server.%s.pid' "$STARTUP_LOCK_DIR" "$scope_key"
}

read_server_pid() {
  local pid_path
  pid_path="$(server_pid_path)"
  if [ ! -f "$pid_path" ]; then
    return 0
  fi
  tr -dc '0-9' < "$pid_path"
}

server_pid_is_running() {
  local pid="${1:-}"
  if [ -z "$pid" ]; then
    return 1
  fi
  kill -0 "$pid" >/dev/null 2>&1
}

clear_server_pid() {
  rm -f "$(server_pid_path)"
}

server_start_in_flight() {
  local pid
  pid="$(read_server_pid)"
  if [ -z "$pid" ]; then
    return 1
  fi
  if server_pid_is_running "$pid"; then
    return 0
  fi
  clear_server_pid
  return 1
}

try_start_server() {
  if ! is_local_server_url; then
    return 0
  fi

  if server_is_running; then
    return 0
  fi

  local ce_dir
  ce_dir="$(discover_ce_dir)"
  if [ -z "$ce_dir" ] || [ ! -f "$ce_dir/server.mjs" ]; then
    return 0
  fi

  if server_start_in_flight; then
    return 0
  fi

  (
    cd "$ce_dir" &&
    nohup npm start >"$STATE_DIR/startup.log" 2>&1 &
    printf '%s\n' "$!" >"$(server_pid_path)"
  ) >/dev/null 2>&1 || true

  for _ in 1 2 3 4 5; do
    if server_is_running; then
      break
    fi
    sleep 0.5
  done

  local pid
  pid="$(read_server_pid)"
  if [ -n "$pid" ] && ! server_pid_is_running "$pid"; then
    clear_server_pid
  fi
}

emit_payload() {
  if [ -f "$PROTOCOL_PATH" ]; then
    node -e "
const fs = require('fs');
const path = process.argv[1];
const text = fs.readFileSync(path, 'utf8');
process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: text,
  },
}));
" "$PROTOCOL_PATH"
    return
  fi

  printf '{}'
}

SERVER_URL="${SERVER_URL:-$(read_server_url)}"

try_start_server
emit_payload
