#!/usr/bin/env bash

# Shared strip patterns for public release workflows.
# Keep release-export and public-history sync scripts aligned by sourcing this file.

ce_public_release_strip_patterns() {
  cat <<'EOF'
contextEngine-cc
docs/agent-native*.md
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
.env.local
.env.*.local
.env.e2e
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
}

ce_public_release_manifest_exclude_patterns() {
  cat <<'EOF'
TODO
contextEngine-cc/TODO
.env
.env.local
.env.*.local
.env.e2e
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
.env.local
.env.*.local
.env.e2e
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
scripts/start-playwright-server.js
scripts/run-agent-bridge-worker-tests.js
scripts/vendor-cecc-ethers-bundle.js
tests/root/*.private.test.*
whitepaper/Slides.pdf
whitepaper/IdeasMap.md
ai-discourse-corpus/corpuses/_*.js
EOF
}
