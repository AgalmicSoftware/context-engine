#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

RAW_MATCHES="$(rg -n "localStorage\\??\\.(getItem|setItem|removeItem)\\(" client/src --glob '!**/*.test.*' --glob '!**/utilities/cacheScripts.js' || true)"

if [[ -z "${RAW_MATCHES}" ]]; then
  echo "cache-guard: no localStorage calls found in client/src."
  exit 0
fi

VIOLATIONS="$(printf "%s\n" "${RAW_MATCHES}" | rg -n "dg:(questionsCache|surveysCache|bookmarksCache|filters|sbtCache|userCache):|\\b(bookmarksCache|questionFilterState_questions|questionFilterState_results|bookmarkedFilters)\\b" || true)"

DYNAMIC_VIOLATIONS=""
CANDIDATE_FILES="$(printf "%s\n" "${RAW_MATCHES}" | cut -d: -f1 | sort -u)"
while IFS= read -r file; do
  [[ -z "${file}" ]] && continue

  HAS_DYNAMIC_DG_KEY="$(rg -n 'dg:\$\{[A-Za-z_][A-Za-z0-9_]*\}:\$\{[A-Za-z_][A-Za-z0-9_]*\}' "${file}" || true)"
  [[ -z "${HAS_DYNAMIC_DG_KEY}" ]] && continue

  HAS_DYNAMIC_LOCALSTORAGE_CALL="$(rg -n "localStorage\\??\\.(getItem|setItem|removeItem)\\(\\s*[A-Za-z_][A-Za-z0-9_]*" "${file}" || true)"
  [[ -z "${HAS_DYNAMIC_LOCALSTORAGE_CALL}" ]] && continue

  HAS_MANAGED_GUARD="$(rg -n 'is[A-Za-z0-9_]*ManagedDgCacheName\(' "${file}" || true)"
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
