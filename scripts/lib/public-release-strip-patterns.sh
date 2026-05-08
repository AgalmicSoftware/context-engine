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
video-clickthrough-local
.tmp-review
scripts/test-*.js
scripts/test-*.ui.js
scripts/lib/e2e
scripts/run-e2e-*
scripts/run-ux-*
scripts/capture-ux-*
scripts/build_external_llm_prompt.py
.env.e2e*
artifacts
tests/artifacts
private-pack.manifest.json
Demo Integration Package
whitepaper/Slides.pdf
whitepaper/IdeasMap.md
client/src/components/MainSite/MainSite.module.test.js
client/src/utilities/worker/sessionCorsWorker.*.proxy.test.js
client/src/utilities/web3/contractScripts.*.proxy.test.js
EOF
}

ce_public_release_strip_assert_absent_patterns() {
  cat <<'EOF'
contextEngine-cc
CLAUDE.md
.claude
docs/agent-native*.md
client/public/skill.md
workers/agentBridgeWorker
video-clickthrough-local
local-private-version
scripts/test-*.js
scripts/test-*.ui.js
scripts/lib/e2e
whitepaper/Slides.pdf
whitepaper/IdeasMap.md
EOF
}
