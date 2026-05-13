# AI Agent Bootstrap

This is the fastest repo-local starting point for AI agents and automation working in Context Engine.

It does two things:

1. points at the current supported agent surfaces that already exist
2. identifies where future agent work should connect without linking private planning files

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
- Telegram agent bridge scaffold:
  - `workers/agentBridgeWorker/agentApiCatalog.mjs`
  - `workers/agentBridgeWorker/telegramCommands.mjs`
  - `workers/agentBridgeWorker/telegramMiniApp.mjs`
  - commands: `/actions`, `/create_agent`, `/settings`, `/join`, `/questions`, `/q`, `/attachments`, `/me`
  - Mini App APIs: `GET /telegram/mini-app/api/state`, `POST /telegram/mini-app/api/draft`, `POST /telegram/mini-app/api/settings`
  - canonical boundary: cataloged `/api/agent/*` request envelopes; no secrets or private inputs in callback data, deep links, logs, or group messages
- Local Claude Code companion:
  - `contextEngine-cc/README.md`
  - `contextEngine-cc/lib/routeInventory.mjs`

## Recommended Current Path

1. Bootstrap against `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, and `docs/run-modes.md` before making assumptions about runtime mode.
2. Prefer the documented TestID API for deterministic browser interaction instead of ad hoc selectors.
3. If you are driving the dev browser surface, inspect `window.__ceAgent.describe()` first so the supported actions and higher-level tools are explicit.
4. If you are driving Telegram, inspect the agent bridge catalog first; add new Telegram/Mini App capabilities by registering catalog entries instead of hard-coding request shapes in command handlers.
5. If you are integrating through `contextEngine-cc`, treat `contextEngine-cc/lib/routeInventory.mjs` as the canonical local HTTP route inventory until the MCP surface lands.
6. Keep live-vs-mock and chain-runtime intent explicit in E2E work; decide upfront whether a run is `onchain`, `local`, or today’s manual-fork workaround, and do not rely on silent fallback sessions, workers, or credentials.

## Practical Rule Of Thumb

Today, Context Engine is already agent-aware, but not yet fully agent-native.

The current safe path is:

- bootstrap from the canonical docs
- automate through stable TestIDs or `window.__ceAgent`
- use the Telegram bridge catalog for bot/Mini App `/api/agent/*` envelopes
- use `contextEngine-cc` for local companion flows
- verify with explicit E2E mode choices

Private planning tracks the roadmap for turning that into a fuller MCP, JSON, and deterministic-local-verification platform.
