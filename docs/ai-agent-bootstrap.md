# AI Agent Bootstrap

This is the fastest repo-local starting point for AI agents and automation working in Context Engine.

Companion roadmap asset:
- `TODO/PRDs/assets/ai_agent_usability_roadmap_prd_v1.png`

It does two things:

1. points at the current supported agent surfaces that already exist
2. maps those surfaces to the active PRDs that extend them

## Current Supported Surfaces

- Public discovery assets:
  - `client/public/discoverability.html`
  - `client/public/llms.txt`
- Canonical repo docs:
  - `AGENTS.md`
  - `README.md`
  - `ARCHITECTURE.md`
  - `docs/run-modes.md`
  - `docs/e2e-setup.md`
  - `docs/e2e-testid-api.md`
- Stable UI automation contract:
  - `docs/e2e-testid-api.md`
  - `client/src/utilities/e2eTestIds.ts`
- Dev/E2E browser agent bridge:
  - `client/src/utilities/ceAgent.js`
  - `client/src/components/Agent/AgentPage.tsx`
  - activation: `/agent?agent=1` or `localStorage["ce-agent-enabled"]="1"`
  - current methods: `getState()`, `describe()`, `perform(action)`, `run(actions[])`
- Local Claude Code companion:
  - `contextEngine-cc/README.md`
  - `contextEngine-cc/lib/routeInventory.mjs`
- Canonical local agent HTTP contract:
  - `docs/agent-native-contract.md`
  - `GET /api/agent/me`
  - `GET /api/agent/sessions`
  - `GET /api/agent/questions?session=<slug>`
  - `POST /api/agent/responses/draft`
  - `POST /api/agent/responses/submit-request`
  - `contextEngine-cc/lib/agent/mcpTools.mjs`

## Recommended Current Path

1. Bootstrap against `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, and `docs/run-modes.md` before making assumptions about runtime mode.
2. Prefer the documented TestID API for deterministic browser interaction instead of ad hoc selectors.
3. If you are driving the dev browser surface, inspect `window.__ceAgent.describe()` first so the supported actions and higher-level tools are explicit.
4. If you are integrating through `contextEngine-cc`, prefer canonical `/api/agent/*` routes. Treat `contextEngine-cc/lib/routeInventory.mjs` as route inventory, not the long-term agent contract.
5. Keep live-vs-mock and chain-runtime intent explicit in E2E work; decide upfront whether a run is `onchain`, `local`, or today’s manual-fork workaround, and do not rely on silent fallback sessions, workers, or credentials.

## OpenClaw And Telegram Runbook

OpenClaw:

- Use MCP when available; its tools must wrap `/api/agent/*`.
- Direct HTTP fallback works and should be equivalent.
- Surface `requestId` and `approvalUrl` to the user when submission requires approval.
- Reuse idempotency keys for retried submit requests so the same authenticated wallet sees the same pending request instead of duplicate approval work.
- Treat thread forwarding as an optional adapter, not a hard dependency.

Telegram:

- Prefer private DM and Mini App flows for v1.
- Never put CE-CC JWTs, worker tokens, private keys, long-lived bearer tokens, or signing authority in chat state, callback data, CloudStorage, or Mini App handoff payloads.
- Use opaque short callback action IDs.
- Validate Mini App `initData` server-side before trusting Telegram identity.
- Use SecureStorage only for short-lived scoped grants or refresh handles when feature-detected; use CloudStorage only for non-sensitive preferences.

## PRD Map

| PRD | Why it matters for agent usability | Current repo anchor |
| --- | --- | --- |
| [PRD 305](../TODO/PRDs/305_supported-first-install-guarantee-and-safe-public-defaults.md) | Defines the supported first-install promise and safe default behavior so agents can bootstrap without stale public infra assumptions. | `README.md`, `docs/run-modes.md`, env/default hygiene work |
| [PRD 209](../TODO/PRDs/209_e2e-harness-config-drift-env-real-run-integrity.md) | Makes E2E config, env loading, and mock-vs-real behavior trustworthy instead of fallback-heavy. | `scripts/run-e2e-suite.js`, `docs/e2e-setup.md`, `.env.e2e.example` |
| [PRD 236](../TODO/PRDs/236_e2e-first-class-local-fork-mode.md) | Adds a reproducible “real contracts, local gas” verification lane for agent-driven validation. | `docs/run-modes.md`, `docs/e2e-setup.md`, `.env.e2e.example`, and future E2E chain-runtime support |
| [PRD 015](../TODO/PRDs/015_mcp-server-contextengine-cc.md) | Adds MCP read/respond tools to `contextEngine-cc` so agents can query sessions and submit responses without the hook path. | `contextEngine-cc/lib/routeInventory.mjs`, current local server + hook |
| [PRD 075](../TODO/PRDs/075_json-api-and-mcp-resource-creation.md) | Adds headless create-session / create-SBT / create-survey surfaces plus JSON-prefill flows for agents. | current SessionWizard / authoring UI payloads and future create APIs |
| [PRD 509](../TODO/PRDs/509_coordinated-shell-cleanup-for-remaining-jsx-shells.md) | Removes the last high-risk JSX controller shells so agents can edit the app shell more safely. | `MainSite.tsx`, `SurveyTool.tsx`, `DeferredCommitSlider.tsx` |
| [PRD 204](../TODO/PRDs/204_contextengine-cc-native-terminal-panel.md) | Tracks an optional future native Claude terminal panel, while keeping the current hook/statusline/PWA path as the supported default. | `contextEngine-cc/status/statusline.mjs`, `contextEngine-cc/hook/hook.mjs` |

## Practical Rule Of Thumb

Today, Context Engine is already agent-aware, but not yet fully agent-native.

The current safe path is:

- bootstrap from the canonical docs
- automate through stable TestIDs or `window.__ceAgent`
- use canonical `/api/agent/*` routes for local companion agent flows
- use MCP as a thin wrapper over `/api/agent/*` when available
- verify with explicit E2E mode choices

The PRDs above are the roadmap for turning that into a fuller MCP + JSON + deterministic-local-verification platform.
