#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

MANAGED_NAMESPACE_REGISTRY="client/src/utilities/cache/managedCacheNamespaces.json"
if [[ ! -f "${MANAGED_NAMESPACE_REGISTRY}" ]]; then
  echo "cache-guard: missing canonical managed namespace registry: ${MANAGED_NAMESPACE_REGISTRY}"
  exit 1
fi
MANAGED_NAMESPACE_PATTERN="$(node -e 'const fs = require("node:fs"); const registry = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(registry.managedNamespaces.map((name) => String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"));' "${MANAGED_NAMESPACE_REGISTRY}")"
if [[ -z "${MANAGED_NAMESPACE_PATTERN}" ]]; then
  echo "cache-guard: canonical managed namespace registry is empty."
  exit 1
fi

search_tree() {
  local pattern="$1"
  local root="$2"

  if command -v rg >/dev/null 2>&1; then
    rg -n "${pattern}" "${root}" --glob '!**/*.test.*'
  else
    grep -RInE "${pattern}" "${root}" --exclude='*.test.*'
  fi
}

search_file() {
  local pattern="$1"
  local file="$2"

  if command -v rg >/dev/null 2>&1; then
    rg -n "${pattern}" "${file}"
  else
    grep -nE "${pattern}" "${file}"
  fi
}

filter_matches() {
  local pattern="$1"

  if command -v rg >/dev/null 2>&1; then
    rg -n "${pattern}"
  else
    grep -nE "${pattern}"
  fi
}

DOT_MATCHES="$(search_tree "localStorage\\??\\.(getItem|setItem|removeItem)[[:space:]]*\\(" client/src || true)"
BRACKET_MATCHES="$(search_tree "localStorage(\\?\\.)?\\[[[:space:]]*['\"](getItem|setItem|removeItem)['\"][[:space:]]*\\][[:space:]]*\\(" client/src || true)"
RAW_MATCHES="${DOT_MATCHES}"
if [[ -n "${BRACKET_MATCHES}" ]]; then
  RAW_MATCHES+="${RAW_MATCHES:+$'\n'}${BRACKET_MATCHES}"
fi

if [[ -z "${RAW_MATCHES}" ]]; then
  echo "cache-guard: no localStorage calls found in client/src."
  exit 0
fi

VIOLATIONS="$(printf "%s\n" "${RAW_MATCHES}" | filter_matches "dg:(${MANAGED_NAMESPACE_PATTERN}):|\\b(bookmarksCache|questionFilterState_questions|questionFilterState_results|bookmarkedFilters)\\b" || true)"

DYNAMIC_VIOLATIONS=""
CANDIDATE_FILES="$(printf "%s\n" "${RAW_MATCHES}" | cut -d: -f1 | sort -u)"
while IFS= read -r file; do
  [[ -z "${file}" ]] && continue

  HAS_DYNAMIC_DG_KEY="$(search_file 'dg:\$\{[A-Za-z_][A-Za-z0-9_]*\}:\$\{[A-Za-z_][A-Za-z0-9_]*\}' "${file}" || true)"
  [[ -z "${HAS_DYNAMIC_DG_KEY}" ]] && continue

  HAS_DYNAMIC_DOT_CALL="$(search_file "localStorage\\??\\.(getItem|setItem|removeItem)[[:space:]]*\\([[:space:]]*[A-Za-z_][A-Za-z0-9_]*" "${file}" || true)"
  HAS_DYNAMIC_BRACKET_CALL="$(search_file "localStorage(\\?\\.)?\\[[[:space:]]*['\"](getItem|setItem|removeItem)['\"][[:space:]]*\\][[:space:]]*\\([[:space:]]*[A-Za-z_][A-Za-z0-9_]*" "${file}" || true)"
  HAS_DYNAMIC_LOCALSTORAGE_CALL="${HAS_DYNAMIC_DOT_CALL}${HAS_DYNAMIC_BRACKET_CALL}"
  [[ -z "${HAS_DYNAMIC_LOCALSTORAGE_CALL}" ]] && continue

  HAS_MANAGED_GUARD="$(search_file 'is[A-Za-z0-9_]*ManagedDgCacheName\(' "${file}" || true)"
  if [[ -z "${HAS_MANAGED_GUARD}" ]]; then
    DYNAMIC_VIOLATIONS+="${file}: dynamic dg:* localStorage usage without managed namespace guard"$'\n'
  fi
done <<< "${CANDIDATE_FILES}"

if [[ -n "${VIOLATIONS}" || -n "${DYNAMIC_VIOLATIONS}" ]]; then
  echo "cache-guard: direct localStorage usage detected for managed cache namespaces/legacy keys."
  echo "Migrate these calls to client/src/utilities/cache/cacheScripts.js APIs."
  echo
  if [[ -n "${VIOLATIONS}" ]]; then
    printf "%s\n" "${VIOLATIONS}"
  fi
  if [[ -n "${DYNAMIC_VIOLATIONS}" ]]; then
    printf "%s\n" "${DYNAMIC_VIOLATIONS}"
  fi
  exit 1
fi

echo "cache-guard: passed (no direct localStorage usage for managed cache namespaces)."
