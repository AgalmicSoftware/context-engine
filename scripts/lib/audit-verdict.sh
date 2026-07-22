#!/usr/bin/env bash

resolve_audit_report_verdict() {
  local report_file="$1"
  local terminal_line

  if [[ ! -r "$report_file" ]]; then
    echo "audit verdict: report is not readable: $report_file" >&2
    return 2
  fi

  terminal_line="$(awk 'NF { line=$0 } END { print line }' "$report_file" | tr -d '\r')"
  case "$terminal_line" in
    PASS|"Verdict: PASS"|"VERDICT: PASS"|"Final verdict: PASS"|"FINAL VERDICT: PASS")
      echo "audit verdict: PASS"
      return 0
      ;;
    FAIL|"Verdict: FAIL"|"VERDICT: FAIL"|"Final verdict: FAIL"|"FINAL VERDICT: FAIL")
      echo "audit verdict: FAIL" >&2
      return 1
      ;;
    *)
      echo "audit verdict: missing terminal PASS or FAIL; refusing to infer success" >&2
      return 2
      ;;
  esac
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  if [[ $# -ne 1 ]]; then
    echo "Usage: bash scripts/lib/audit-verdict.sh <report-file>" >&2
    exit 2
  fi
  resolve_audit_report_verdict "$1"
fi
