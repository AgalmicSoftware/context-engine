# Documentation Index

Primary product and system specification:
- `spec.md` (repo root)

Canonical reference set:
- root docs: `README.md`, `ARCHITECTURE.md`, `AGENTS.md`, `spec.md`
- the `docs/` reference docs listed below
- `docs/architecture-overview.md` is the first-read architecture and verification
  map for new engineers and auditors

Non-canonical / historical planning material:
- private planning files under ignored local paths
- one-off debug prompts or migration notes unless they are explicitly linked below as current reference

Private planning docs should stay in ignored local paths, not in public docs.

## How To Keep Docs Updated

When you add or change a feature, update documentation in the same PR:
- Add or update a doc in `docs/` when the change introduces new workflows, endpoints, config keys, schemas, or operational steps.
- Update `spec.md` to reflect new capabilities and any new surface area (routes, Worker endpoints, contracts, config keys).
- Add your new/updated doc link to this index so others can discover it.

## Core Docs

Code navigation maps:
- `docs/ai-agent-bootstrap.md`: current AI-agent entry points and supported contracts.
- `docs/MainSite.MAP.md`: app-shell route/runtime orchestration map.
- `docs/SurveyTool.MAP.md`: survey/question runtime and encryption flow map.
- `docs/SessionWizard.MAP.md`: session creation, worker deploy, and publish-flow map.
- `docs/contractScripts.MAP.md`: web3 integration/navigation map for the `chainGateway` / legacy `contractScripts` surface.

Session, gates, and the Worker:
- `docs/session-creation-guide.md`: End-to-end setup guide for creating a session from `/new`, including the "what a new session needs" checklist, sponsored bundle handoff, worker deploy paths, on-chain registration, and `/admin` verification.
- `docs/posts.md`: Public `/posts` route, root `posts/` Markdown authoring, and `ce-viz` exhibit blocks.
- `docs/session-listening-mode.md`: `?mode=listening` pile-adjacent microphone workflow, rolling 3-minute transcription, local recovery metadata, and question-generation output.
- `docs/standard-sponsored-links-fixture.md`: Temporary tracked fixture for publishing a small set of public sponsored setup links with minimal onboarding friction.
- `docs/session-registry.md`: SessionRegistry migration and on-chain gate authority model.
- `docs/session-cors-worker.md`: Cloudflare `sessionCorsWorker` behavior, endpoints, KV layouts, and wizard flow.
- `docs/scaling.md`: Public scaling reference covering write-path settlement, indexed reads, private compute modes, and deployment profiles.

Keys and RPCs:
- `docs/public-client-config.md`: public `REACT_APP_*` client config, fallback behavior, `.env.example` reference, and Netlify static deploy notes.
- `docs/resource-keys.md`: Where AI/Arweave/RPC/faucet keys live and the resolution order (local overrides vs worker secrets).
- `docs/path-rpc.md`: PATH (Pocket) endpoint defaults, client/provider ordering, and legacy PATH override behavior.
- `docs/rpc-scan-scope.md`: scan-scope flags, profile deep-scan defaults, RPC guardrails, and testing-mode controls.

Encryption:
- `docs/lit-protocol-information.md`: Lit protocol wiring and current runtime status (v8).
- `docs/lit-v3-design.md`: Worker-mediated Chipotle runtime design, provisioning flow, and migration notes.
- `docs/doc-library.md`: Doc Library for Sessions + SBT groups (tag schema, listing queries, encryption UX).

Payload schemas:
- `docs/arweave-payloads.md`: Example Arweave payload shapes for surveys, questions, and SBT tokenURI JSON.

Local development:
- `docs/client-build-assets.md`: Vite build outputs over 500 KB, source ownership, and safe follow-up actions.
- `docs/local-chain.md`: Foundry/Anvil local chain setup, deploy flow, and test commands.
- `docs/run-modes.md`: repo run modes (`core-local`, `local-chain`, `hosted/onchain`) plus the current manual-fork verification note.
- `docs/testing.md`: centralized test commands and runtime requirements across root, client, and E2E flows.

Release:
- `docs/dependency-audit-hotspots.md`: dependency audit remediations, accepted residuals, and package-specific audit commands.
- `docs/dependency-audit.md`: current client npm audit disposition ledger and blocked/deferred package-family decisions.
- `docs/release-runbook.md`: operator release checklist, gates, public strip policy, worker bundle publishing, and rollback notes.
- `docs/releasing.md`: Public-history replay, stripped artifact export, and release hygiene checks.
- `docs/security/at-rest-hardening-decision-note.md`: current passkey at-rest evidence and required decisions before worker KV secret encryption.
- `docs/security/audit-prep-2026-07-06.md`: built-in audit-prep snapshot covering npm audit disposition, secrets/config sweeps, and contracts/worker inventory.
- `docs/security-sweeps.md`: full-history secret-sweep commands, raw match counts, and dispositions.
- `docs/testing-budget.md`: full client/test:node runtime budget, coverage snapshot, and slowest-suite report.
- `docs/typescript-strictness-plan.md`: plan for moving from count ratchets toward directory-level compiler strictness.

Wallets:
- `docs/passkey-wallet.md`: passkey-unlocked EOA wallet wiring and deterministic test wallet workflow.
- `docs/forking-wallet.md`: RP ID and wallet setup checklist for forks.
- `docs/security-model.md`: embedded wallet and soft-session security model.
- `docs/passkey-wallet-migration-audit.md`: Porto migration audit and remaining risks.

E2E workflows:
- `docs/e2e-setup.md`: End-to-end workflow scripts, chain runtime modes, and the current manual-fork workflow for repeated verification against live deployments.
- `docs/e2e-cadence.md`: operator cadence for nightly, pre-release, and per-lane E2E runs plus the E2E-BLOCKED protocol.
- `docs/e2e-testid-api.md`: Stable `data-testid` hooks used by Playwright runners (TestID API).

Public discovery:
- `docs/discoverability.md`: Static crawl assets, live GitHub branch links, and the Google Search Console checklist.

## Runtime Telemetry

Opt-in diagnostics API (no production UI surface). Disabled unless explicitly enabled.

- Auto-start flag: set `globalThis.ENABLE_CE_RUNTIME_STATS = true` before app boot.
- Console API:
  - `window.__CE_RUNTIME_STATS__.start(opts?)`
  - `window.__CE_RUNTIME_STATS__.stop()`
  - `window.__CE_RUNTIME_STATS__.reset()`
  - `window.__CE_RUNTIME_STATS__.snapshot()`
  - `window.__CE_RUNTIME_STATS__.status()`
- Lag triage snippet (run in browser console on the main app page):
```js
(() => {
  window.ENABLE_CE_UI_PERF_STATS = true;
  window.ENABLE_CE_RUNTIME_STATS = true;
  window.__CE_DEBUG_COUNTERS__ = true;

  if (!window.__CE_RUNTIME_STATS__) {
    throw new Error('__CE_RUNTIME_STATS__ not found on window. Open the main app page first, then run again.');
  }

  window.__CE_UI_PERF__?.reset?.();
  window.__CE_RUNTIME_STATS__.reset();
  window.__CE_RUNTIME_STATS__.start({ sampleIntervalMs: 2000 });

  const status = window.__CE_RUNTIME_STATS__.status();
  console.log('runtime status:', status); // should show running: true, enabledByFlag: true
})();
```
- After reproducing lag for about 10-20 seconds:
```js
window.__CE_RUNTIME_STATS__.snapshot()
```
- Defaults:
  - `sampleIntervalMs = 5000`
  - `retentionMinutes = 30` (ring buffer: `360` samples)

How to interpret top signals:
- Heap growth: `snapshot().latestSample.memory.heap.usedJSHeapSize` trends up and does not release after idle periods.
- Main-thread jank/blocking: spikes in `longTasks` and `frame.sinceLast.stalledFrames`.
- Cache pressure: bursts in `cachePressure.perMinute.questionsCache|surveysCache|sbtCache` alongside nonce/revision churn.
- Render churn: accelerating `perfCounterDelta` and high-cost labels in `uiPerf`.

## Cache Reference Docs

Shared cache runtime model:
- `docs/cache/README.md`

Client cache structures (managed via `cacheScripts` with IndexedDB primary backend):
- `docs/cache/surveys-and-questions-cache-structure.md`
- `docs/cache/sbts-cache-structure.md`
- `docs/cache/bookmarks-cache-structure.md`
- `docs/cache/user-cache-structure.md`
