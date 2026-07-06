#!/usr/bin/env bash
# Full codebase security audit via Codex
# Usage: bash scripts/audit-full.sh [--domain <worker|crypto|client|cecc|rpc|arweave|userpage|sbts|wallet|contracts|ai|survey|all>]
set -euo pipefail

CODEX="${CODEX_PATH:-codex}"
DOMAIN="all"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    worker|crypto|client|cecc|rpc|arweave|userpage|sbts|wallet|contracts|ai|survey|all) DOMAIN="$1"; shift ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done
REPORT_DIR="artifacts/audit-reports"
mkdir -p "$REPORT_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Domain → file sets
declare -A DOMAINS
DOMAINS[worker]="workers/sessionCorsWorker/worker.js workers/deploy-helper/worker.js"
DOMAINS[crypto]="client/src/utilities/crypto/ client/src/utilities/web3/contractScripts.impl.ts client/src/utilities/web3/sessionRegistry.ts"
DOMAINS[client]="client/src/reducers/ client/src/utilities/session/ client/src/utilities/worker/ client/src/components/SBTs/SBTPage.tsx client/src/components/SurveyTool/SurveyTool.tsx"
DOMAINS[cecc]="contextEngine-cc/lib/ contextEngine-cc/hook/"
DOMAINS[rpc]="client/src/utilities/web3/rpcReadCache.ts client/src/utilities/web3/rpcSelection.ts client/src/utilities/web3/rpcDebugStats.ts"
DOMAINS[arweave]="client/src/utilities/arweave/"
DOMAINS[userpage]="client/src/components/UserPage/ client/src/utilities/cache/"
DOMAINS[sbts]="client/src/components/SBTs/ client/src/utilities/sbt/"
DOMAINS[wallet]="client/src/wallet/ client/src/utilities/web3/sponsoredAccess.ts"
DOMAINS[contracts]="contracts/CustomSBT.sol contracts/SessionRegistry.sol contracts/Surveys.sol contracts/SBTFactory.sol"
DOMAINS[ai]="client/src/utilities/ai/ client/src/components/Shared/AudioInput/AudioInput.tsx"
DOMAINS[survey]="client/src/components/SurveyTool/ client/src/utilities/survey/"

if [ "$DOMAIN" = "all" ]; then
  TARGETS="${DOMAINS[worker]} ${DOMAINS[crypto]} ${DOMAINS[client]} ${DOMAINS[cecc]} ${DOMAINS[rpc]} ${DOMAINS[arweave]} ${DOMAINS[userpage]} ${DOMAINS[sbts]} ${DOMAINS[wallet]} ${DOMAINS[contracts]} ${DOMAINS[ai]} ${DOMAINS[survey]}"
elif [ -n "${DOMAINS[$DOMAIN]+x}" ]; then
  TARGETS="${DOMAINS[$DOMAIN]}"
else
  echo "Unknown domain: $DOMAIN (use: worker, crypto, client, cecc, rpc, arweave, userpage, sbts, wallet, contracts, ai, survey, all)"
  exit 1
fi

AUDIT_FILE="/tmp/ce-full-audit-${DOMAIN}-${TIMESTAMP}.txt"

echo "Collecting source files for domain: $DOMAIN"
for target in $TARGETS; do
  if [ -d "$target" ]; then
    find "$target" \( -name '*.js' -o -name '*.mjs' -o -name '*.jsx' -o -name '*.ts' -o -name '*.tsx' \) \
      ! -name '*.test.*' ! -name '*.spec.*' ! -path '*/node_modules/*' \
      -print0 | sort -z | while IFS= read -r -d '' f; do
        echo "===== $f =====" >> "$AUDIT_FILE"
        cat "$f" >> "$AUDIT_FILE"
        echo "" >> "$AUDIT_FILE"
      done
  elif [ -f "$target" ]; then
    echo "===== $target =====" >> "$AUDIT_FILE"
    cat "$target" >> "$AUDIT_FILE"
    echo "" >> "$AUDIT_FILE"
  fi
done

TOTAL_LINES=$(wc -l < "$AUDIT_FILE" | tr -d ' ')
echo "Collected: $TOTAL_LINES lines → $AUDIT_FILE"

DEFERRED_FILE="$(dirname "$0")/audit-deferred-findings.txt"
if [ -f "$DEFERRED_FILE" ]; then
  DEFERRED_NOTE=$'Known deferred findings (do NOT re-flag unless code changed to make them worse):\n'"$(cat "$DEFERRED_FILE")"
else
  DEFERRED_NOTE=""
fi

FOCUS=""
case "$DOMAIN" in
  worker) FOCUS="Focus: SSRF, CORS, auth token lifecycle, nonce atomicity, egress restrictions, redirect safety, slug validation" ;;
  crypto) FOCUS="Focus: Lit Protocol gate policies, encryption envelope integrity, password derivation, key management, SBT mint authorization" ;;
  client) FOCUS="Focus: Redux state isolation, wallet address handling, XSS vectors, async lifecycle, unmount safety" ;;
  cecc) FOCUS="Focus: JWT claims, hook injection, submission integrity, config validation, rate limiting" ;;
  rpc) FOCUS="Focus: RPC endpoint trust, cache invalidation, chain selection correctness, stale reads, debug data leakage" ;;
  arweave) FOCUS="Focus: payload integrity, metadata parsing, gateway trust, malformed content handling, upload/download failure modes" ;;
  userpage) FOCUS="Focus: cache scoping, stale user/session data, privacy leaks, XSS in rendered profile content, persistence correctness" ;;
  sbts) FOCUS="Focus: mint/claim authorization, gate evaluation, wallet ownership assumptions, race conditions, sensitive metadata exposure" ;;
  wallet) FOCUS="Focus: passkey RP-ID validation, encrypted EOA keystore, signer trust boundaries, replay protection, chain mismatch handling, fallback safety" ;;
  contracts) FOCUS="Focus: access control, reentrancy, signature validation, upgrade/migration assumptions, event/state consistency" ;;
  ai) FOCUS="Focus: prompt/data leakage, unsafe model input handling, audio upload abuse, output sanitization, quota/performance abuse" ;;
  survey) FOCUS="Focus: response isolation, async lifecycle safety, stale hydration, encryption/gating correctness, submission integrity" ;;
  all) FOCUS="Focus areas (priority order): 1) Worker auth & egress 2) Crypto & encryption 3) Client state 4) contextEngine-cc 5) RPC/read consistency 6) Arweave integrity 7) UserPage/cache safety 8) SBT flows 9) Passkey wallet 10) Contracts 11) AI/audio paths 12) Survey state & submissions" ;;
esac

REPORT_FILE="$REPORT_DIR/audit-full-${DOMAIN}-${TIMESTAMP}.txt"

echo "Running Codex full audit (domain: $DOMAIN)..."
$CODEX exec --full-auto "You are performing a full security audit of the Context Engine project.
Source files are in $AUDIT_FILE ($TOTAL_LINES lines).
Domain: $DOMAIN

$FOCUS

DO NOT explore or read files beyond what is provided.

Audit for:
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
