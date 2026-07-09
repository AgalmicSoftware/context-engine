# Contributing to Context Engine

This repository is the open-source home for Context Engine. For system design, data flow, and major subsystems, start with [ARCHITECTURE.md](ARCHITECTURE.md).
Be constructive in issues and PRs.

## Setup

1. Clone the repo:
   `git clone https://github.com/AgalmicSoftware/context-engine.git`
2. Enter the project:
   `cd context-engine`
3. Use the project Node version:
   `nvm use 20`
4. Install root dependencies:
   `npm install`
5. Install client dependencies:
   `cd client && npm install`

The local React dev server runs with:

`cd client && npm run dev`

Repo-level scripts, CI, and the client package target Node `^20.19.0` or `>=22.12.0` with npm `^10.0.0`; Node 16/npm 9 are no longer supported for client work. Client installs are expected to pass with npm's normal strict peer resolution.
Install Foundry as well if you plan to run the root test gate (`npm test`), since it includes Solidity suites via `forge test`. Setup instructions live in [docs/local-chain.md](docs/local-chain.md).

If you need public client environment overrides, use [`client/.env.example`](client/.env.example). Root-level script and E2E variables are documented in [`.env.example`](.env.example).
OP Sepolia is the active/default OSS chain. Base Sepolia should continue to work for legacy/dev compatibility, but it is best-effort rather than actively supported; only use chain `84532` when the workflow you are testing explicitly targets it or depends on its deployed addresses.
Worker, Arweave, and on-chain E2E flows may also require a funded test wallet, an Arweave JWK, and Cloudflare credentials depending on the path under test.

## Running Tests

- Fast repository wiring gate: `npm run test:wiring`
- Type-debt ratchet: `npm run type-debt:check`
- Client typecheck: `npm run typecheck:client`
- Root CI-equivalent test flow: `npm test`
- Client-only tests (no Foundry required): `cd client && npm test -- --watchAll=false` (Jest 30)
- Client lint: `cd client && npm run lint` (ESLint 9 flat config)
- Client format check: `cd client && npm run format:check`
- Contract tests: `forge test`
- Gate E2E smoke: `npm run ai:test-gates:any-all`
- Gated decrypt E2E: `npm run ai:test-gated-decrypt:all-types`
- Survey response encryption matrix: `npm run ai:test-survey-response:encryption-matrix`
- Seed question-type survey fixtures: `npm run ai:seed-survey:question-types`

Before opening a PR, run the smallest relevant test set for your change plus `npm run test:wiring`, `npm run type-debt:check`, and `npm run typecheck:client`. `npm run verify:release` is the release-quality local gate for client lint, typecheck, full client Jest, public release surface verification, worker bundle sync, and production build. `npm test` is the full root CI-equivalent gate and requires Foundry; for client-only work, the client test command above is the lighter prerequisite path. UI, worker, gating, encryption, or Arweave changes should also update or extend automation when practical.

## Pull Requests

- Branch from the current default branch.
- Keep PRs scoped to one change or closely related set of changes.
- Describe user-visible behavior changes clearly.
- Keep public PR text free of internal planning IDs, private paths, and private operational notes.
- Keep changelog entries public-facing. Do not include internal planning identifiers in any `CHANGELOG.md`; rewrite entries as release notes that describe the shipped behavior or technical change directly.
- Include screenshots, logs, or repro notes for UI, web3, worker, or encryption-flow changes when they help review.
- Update docs and tests when behavior, config, or workflows change.

## Licensing Contributions

By contributing, you agree that your contributions are licensed under the license applicable to the files you modify. For most public core files, that license is `MPL-2.0`; files or directories with their own license notices keep those terms.

## Commits

- Use concise conventional commit messages such as `fix: guard empty response payload` or `docs: clarify client tooling`.

## Code Style

- This is a mixed JavaScript and TypeScript React repo. Prefer the existing local style, use TypeScript for typed boundaries when it reduces risk, and avoid churn-only conversions.
- Follow the existing SCSS module pattern for component styling.
- Use `data-testid="ce-<area>-<control>"` for new stable UI hooks.

## Good First Issues

- Documentation clarifications and workflow cleanup
- Stable test hooks and focused E2E coverage improvements
- Small UI polish tasks that stay within the current design language
- Isolated bug fixes that do not change contract interfaces or add dependencies

## Architecture Notes

- App shell and route/runtime orchestration map: [docs/MainSite.MAP.md](docs/MainSite.MAP.md)
- Survey/question runtime map: [docs/SurveyTool.MAP.md](docs/SurveyTool.MAP.md)
- Session creation/runtime map: [docs/SessionWizard.MAP.md](docs/SessionWizard.MAP.md)
- Encryption and SBT gates: sensitive fields can be encrypted behind Lit access-control conditions, and SBT ownership is the unlock condition for gated reads. Avoid exposing gated plaintext in docs, screenshots, logs, or fixtures.
