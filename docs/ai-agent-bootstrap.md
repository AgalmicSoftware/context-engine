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

## Recommended Current Path

1. Bootstrap against `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, and `docs/run-modes.md` before making assumptions about runtime mode.
2. Prefer the documented TestID API for deterministic browser interaction instead of ad hoc selectors.
3. If you are driving the dev browser surface, inspect `window.__ceAgent.describe()` first so the supported actions and higher-level tools are explicit.
4. Keep live-vs-mock and chain-runtime intent explicit in E2E work; decide upfront whether a run is `onchain`, `local`, or today’s manual-fork workaround, and do not rely on silent fallback sessions, workers, or credentials.

## Practical Rule Of Thumb

Today, Context Engine is already agent-aware, but not yet fully agent-native.

The current safe path is:

- bootstrap from the canonical docs
- automate through stable TestIDs or `window.__ceAgent`
- verify with explicit E2E mode choices

Private planning tracks the roadmap for turning that into a fuller MCP, JSON, and deterministic-local-verification platform.
