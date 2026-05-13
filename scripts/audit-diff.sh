#!/usr/bin/env bash
# Diff-based security audit via Codex
# Usage: bash scripts/audit-diff.sh [--base <commit>]
#   Default base: merge-base with main, falling back to master
set -euo pipefail

CODEX="${CODEX_PATH:-codex}"
BASE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --base) BASE="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [ -z "$BASE" ]; then
  BASE=$(git merge-base HEAD main 2>/dev/null || git merge-base HEAD master 2>/dev/null || echo "HEAD~10")
fi

LEGACY_WORKER_HITS=$(
  grep -RIn \
    --include='*.js' \
    --include='*.jsx' \
    --include='*.mjs' \
    --include='*.ts' \
    --include='*.tsx' \
    'LEGACY_WORKER' client/src workers 2>/dev/null || true
)
if [ -n "$LEGACY_WORKER_HITS" ]; then
  echo "WARN: LEGACY_WORKER references detected in client/src or workers source files:"
  echo "$LEGACY_WORKER_HITS"
fi

DIFF_FILE="/tmp/ce-audit-diff-$(date +%Y%m%d-%H%M%S).txt"
REPORT_DIR="artifacts/audit-reports"
mkdir -p "$REPORT_DIR"
REPORT_FILE="$REPORT_DIR/audit-$(date +%Y%m%d-%H%M%S).txt"

echo "Generating diff: $BASE..HEAD"
git diff "$BASE"..HEAD -- '*.js' '*.jsx' '*.mjs' '*.ts' '*.tsx' ':!*.test.*' ':!*.spec.*' ':!*node_modules*' > "$DIFF_FILE"

DIFF_LINES=$(wc -l < "$DIFF_FILE" | tr -d ' ')
echo "Diff: $DIFF_LINES lines → $DIFF_FILE"

if [ "$DIFF_LINES" -eq 0 ]; then
  echo "No source changes to audit."
  exit 0
fi

DEFERRED_FILE="$(dirname "$0")/audit-deferred-findings.txt"
if [ -f "$DEFERRED_FILE" ]; then
  DEFERRED_NOTE=$'Known deferred findings (do NOT re-flag unless code changed to make them worse):\n'"$(cat "$DEFERRED_FILE")"
else
  DEFERRED_NOTE=""
fi

echo "Running Codex audit..."
$CODEX exec --full-auto "You are auditing a security-focused git diff for the Context Engine project.
The diff is in $DIFF_FILE ($DIFF_LINES lines, source files only — no tests).

DO NOT explore or read files beyond the diff. DO NOT spend time browsing the codebase.

Audit ALL changed files for:
- Security vulnerabilities (OWASP top 10, SSRF, XSS, injection, auth bypass)
- Bugs (logic errors, race conditions, null/undefined handling)
- React anti-patterns (state mutation, missing cleanup, unsafe lifecycle)
- Performance issues (unbounded loops, memory leaks, blocking operations)
- Edge cases (empty arrays, missing fields, type coercion)

For each finding:
- Severity: HIGH / MEDIUM / LOW
- File:line
- Description
- Suggested fix

$DEFERRED_NOTE

End with a single verdict: PASS or FAIL.
If FAIL, list the findings that must be fixed before PASS." 2>&1 | tee "$REPORT_FILE"

echo ""
echo "Report saved: $REPORT_FILE"
