#!/usr/bin/env bash

# Shared strip patterns for public release workflows.
# Keep release-export and public-history sync scripts aligned by sourcing this file.

ce_public_release_private_doc_patterns() {
  cat <<'EOF'
AGENTS.md
docs/agent-native*.md
docs/ai-agent-bootstrap.md
docs/*.MAP.md
docs/commonground-export.md
docs/dead-code-disposition.md
docs/dependency-audit*.md
docs/e2e-*.md
docs/passkey-wallet-migration-audit.md
docs/release-runbook.md
docs/releasing.md
docs/security/at-rest-hardening-decision-note.md
docs/security/audit-prep-*.md
docs/security-sweeps.md
docs/testing-budget.md
docs/typescript-strictness-plan.md
docs/worker-auth-phase*-options.md
EOF
}

ce_public_release_strip_patterns() {
  cat <<'EOF'
contextEngine-cc
client/public/skill.md
workers/agentBridgeWorker
TODO
local-private-version
CLAUDE.md
.claude
.codex
.codex-artifacts
.codex-solc
.codex-tmp
video-clickthrough-local
.tmp-review
.DS_Store
.secrets.baseline
.env
.env.example
.env.local
.env.*.local
.env.e2e
.env.e2e.example
.keys
.e2e-secrets
.e2e-cache
.npm-cache
.npm-cache-client*
output
release-public
dist
out
cache
broadcast
coverage
docs/codebase-*.md
docs/assets/codebase-*
docs/*PRD*.md
docs/*prd*.md
scripts/test-*.js
scripts/test-*.ui.js
scripts/seed-*.js
scripts/e2e
scripts/lib/e2e
scripts/lib/passkey-wallet-derivation.js
scripts/start-playwright-server.js
scripts/run-e2e-*
scripts/run-ux-*
scripts/capture-ux-*
scripts/run-agent-bridge-worker-tests.js
scripts/vendor-cecc-ethers-bundle.js
scripts/build_external_llm_prompt.py
tests/root/*.private.test.*
artifacts
private-pack.manifest.json
Demo Integration Package
whitepaper/Slides.pdf
whitepaper/IdeasMap.md
client/src/utilities/worker/sessionCorsWorker.*.proxy.test.js
client/src/utilities/web3/contractScripts.*.proxy.test.js
ai-discourse-corpus/corpuses/_*.js
EOF
  ce_public_release_private_doc_patterns
}

ce_public_release_manifest_exclude_patterns() {
  cat <<'EOF'
TODO
contextEngine-cc/TODO
.env
.env.example
.env.local
.env.*.local
.env.e2e
.env.e2e.example
.keys
.e2e-secrets
.e2e-cache
docs/codebase-*.md
docs/assets/codebase-*
docs/*PRD*.md
docs/*prd*.md
tests/root/*.private.test.*
ai-discourse-corpus/corpuses/_*.js
EOF
  # Private documentation names and checksums must not leak through the
  # reversible private-pack manifest that accompanies the public artifact.
  ce_public_release_private_doc_patterns
}

ce_public_release_strip_assert_absent_patterns() {
  cat <<'EOF'
TODO
contextEngine-cc
CLAUDE.md
.claude
.codex
.codex-artifacts
.codex-solc
.codex-tmp
.DS_Store
.secrets.baseline
.env
.env.example
.env.local
.env.*.local
.env.e2e
.env.e2e.example
.keys
.e2e-secrets
.e2e-cache
.npm-cache
.npm-cache-client*
output
release-public
dist
out
cache
broadcast
coverage
docs/codebase-*.md
docs/assets/codebase-*
docs/*PRD*.md
docs/*prd*.md
docs/agent-native*.md
client/public/skill.md
workers/agentBridgeWorker
video-clickthrough-local
local-private-version
scripts/test-*.js
scripts/test-*.ui.js
scripts/seed-*.js
scripts/e2e
scripts/lib/e2e
scripts/lib/passkey-wallet-derivation.js
scripts/start-playwright-server.js
scripts/run-agent-bridge-worker-tests.js
scripts/vendor-cecc-ethers-bundle.js
tests/root/*.private.test.*
whitepaper/Slides.pdf
whitepaper/IdeasMap.md
ai-discourse-corpus/corpuses/_*.js
EOF
  ce_public_release_private_doc_patterns
}
