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

Repo-level scripts, CI, and the client package target Node `^20.19.0` or `>=22.12.0` with npm `^10.0.0`. Client installs are expected to pass with npm's normal strict peer resolution.
To run the root test gate (`npm test`), also install the Session Worker and MCP dependencies (`npm --prefix workers/sessionCorsWorker install` and `npm --prefix mcp install`) and Foundry, since the gate includes Solidity suites via `forge test`. Foundry setup instructions live in [docs/local-chain.md](docs/local-chain.md).

If you need public client environment overrides, use [`client/.env.example`](client/.env.example).
OP Sepolia is the active/default OSS chain. Base Sepolia is a best-effort
legacy/development compatibility target, not an actively supported runtime, and
the canonical client manifest does not currently contain its CE contract set.
Historical Base addresses are not active configuration.
Worker, Arweave, and on-chain development flows may also require a funded test wallet, an Arweave JWK, and Cloudflare credentials depending on the path under test.

## Running Tests

- Fast repository wiring gate: `npm run test:wiring`
- Type-debt ratchet: `npm run type-debt:check`
- Client typecheck: `npm run typecheck:client`
- Root CI-equivalent test flow: `npm test`
- Client-only tests (no Foundry required): `cd client && npm test -- --watchAll=false` (Jest 30)
- Client lint: `cd client && npm run lint` (ESLint 9 flat config)
- Client format check: `cd client && npm run format:check`
- Contract tests: `forge test`
- Public route/style smoke: `npm run test:e2e`

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

Contributions to project-authored code use `MPL-2.0`. Preserve the existing rights and notices for third-party material and the `CC0-1.0` dedication for project-authored corpus annotations. See [LICENSING.md](LICENSING.md).

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

## How To Add Common Things

Each recipe lists the files to touch, in order. Run tests with
`node --test <explicit paths>` for root and Worker files, and
`cd client && npx jest --findRelatedTests <files>` for client files.

### A Session Worker route

1. Route it. `workers/sessionCorsWorker/topLevelRouteSelection.js` sorts every
   request into a kind.
   - Admin actions are `POST /admin/<action>`. Add an `if (action === '…')`
     branch in `adminRequestDispatch.js`. The signed admin check runs first.
   - Signed-in participant routes fall through to `kind: 'authenticated'`.
     Path routes such as storage and groups are matched in
     `authenticatedSecretPathRouteDispatch.js`, which also checks scopes and
     refuses writes once a session has ended.
   - A new top-level kind needs its own branch in `workerRouteShellBinding.js`.
2. Test it in the module's `.test.mjs`. If the route changes who may do what,
   also add a case to `sessionWorkerHardening.test.mjs`, which runs the real
   Worker entry.
3. Run `npm run worker:cloudflare-template` to regenerate
   `deploy/cloudflare/session-worker/`. CI fails if the template is stale.
4. Document it in `docs/session-cors-worker.md` and the endpoint list in
   `spec.md`. If clients need to detect it, add a feature to `FEATURES` in
   `workerCapabilities.js`.

### A session config field

1. Add the key to `WORKER_CANONICAL_SET_CONFIG_KEYS` in
   `shared/sessionConfigEdits.mjs`, which is what `POST /admin/set-config`
   accepts. Add it to `CONTENT_FIELDS` there only if changing it should sign no
   one out.
2. Validate it in `workers/sessionCorsWorker/sessionConfigMutation.js` and,
   for the first deploy, `workers/shared/deployHelperCore.mjs`. Share one
   validator from `shared/` between them.
3. Add it to `DEPLOY_CANONICAL_CONFIG_KEYS` in
   `workers/shared/workerSessionConfig.mjs`. Add it to
   `PUBLIC_WORKER_CONFIG_FIELDS` in `shared/workerSessionPublicConfig.mjs` only
   if signed-out visitors may read it.
4. In `client/src/components/Sessions/`, add the input under `setup/`, send it
   from `sessionWizardWriteNormalization.ts`, show or hide it per profile in
   `sessionWizardModeFieldPolicy.ts`, and let admins edit it later in
   `settings/sessionSettingsEdits.ts`.
5. Regenerate the Worker template and document the field in
   `docs/session-cors-worker.md`, `spec.md`, and
   `docs/session-creation-guide.md`.

### A question type

There is no single registry yet; each layer lists the types it handles.

1. Add the type to `QUESTION_TYPES` in `shared/questions/answerValue.mjs`, and
   teach `normalizeAnswerValue` its answer shape.
2. ``git grep -lE "[\"'\`]quadratic[\"'\`]"`` lists every file that names an
   existing type, across the client, Worker agent modules, MCP server, AI
   setup prompts, and encryption envelope. Add the new type wherever a sibling
   type has its own branch.
3. Add tests next to each changed module.
4. Add it to the question types under Features in `README.md`. If authors need
   guidance, give it a page like `docs/quadratic-allocation.md`.

## Architecture Notes

- Runtime and deployment overview: [docs/architecture-overview.md](docs/architecture-overview.md)
- Session creation workflow: [docs/session-creation-guide.md](docs/session-creation-guide.md)
- Survey, question, and storage schemas: [docs/arweave-payloads.md](docs/arweave-payloads.md)
- Encryption and SBT gates: sensitive fields can be encrypted with SBT-gated Lit key release, and SBT ownership is the unlock condition for gated reads. The session Worker operator and anyone holding the session's Lit API key can also read gated data, so it is not end-to-end encrypted. Avoid exposing gated plaintext in docs, screenshots, logs, or fixtures.
