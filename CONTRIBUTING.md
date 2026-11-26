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
   `spec.md`. If clients need to detect it, give it a feature flag (below).
   If it calls the session coordinator, see "A coordinator store" and "A
   request that is safe to retry".

### A session setting

A setting is a field of the session's config. `groupMemberCeiling` is a
recent one that reaches most steps below; `git grep -n groupMemberCeiling`
shows where.

1. Accept it. Add the key to `WORKER_CANONICAL_SET_CONFIG_KEYS` in
   `shared/sessionConfigEdits.mjs`; that is what `POST /admin/set-config`
   takes. Any change to a setting raises the session's `authzEpoch`, which
   signs participants out, unless the key is also in `CONTENT_FIELDS` there.
   Add it to `CONTENT_FIELDS` only if the Worker reads it on each request and
   never keeps it in a sign-in.
2. Check it. Add one `[check, refusal]` pair to `SETTINGS_CHECKS` in
   `workers/sessionCorsWorker/sessionConfigMutation.js`. Set-config runs the
   list on the settings sent, and every config change runs it again on the
   merged record; the first failing pair answers. (A few older settings,
   such as `sessionContext`, are still checked inline after the list.) If the site or the MCP
   needs the same check, put the check in `shared/` and import it.
3. Store it at deploy. Add the key to `DEPLOY_CANONICAL_CONFIG_KEYS` in
   `workers/shared/workerSessionConfig.mjs`. The deploy helper copies those
   keys into a new session's first config without the checks in step 2
   (only `agentHttp`, `agentInstructions` and `allowOrigins` are checked
   there); `/new` then saves the config through set-config, which runs them.
4. Serve it. Add the key to `PUBLIC_WORKER_CONFIG_FIELDS` in
   `shared/workerSessionPublicConfig.mjs`. The Worker's only config read is
   public and serves just those fields, so no client can read a setting left
   out, the Settings page included; only the Worker sees it.
5. If an older Worker would refuse or ignore the setting, give it a support
   field (see "A Worker feature flag") and have the site offer the setting
   only when the field is there.
6. Let admins set it. In `client/src/components/Sessions/`:
   - `/new`: the input under `setup/`, its value written in
     `sessionWizardWriteNormalization.ts`, and, if only some session profiles
     have it, its rule in `sessionWizardModeFieldPolicy.ts`.
   - Settings: the input in `settings/` (for a switch,
     `SettingsListFields.tsx`), and in `settings/sessionSettingsEdits.ts` its
     reading into the draft, its writing into the save, how two values
     compare, and its label in the list of changes.
   - Type it on `SessionConfig` in `client/src/utilities/session/sessionTypes.ts`
     if the session page reads it.
   - If session templates should carry it, give it a default in `DEFAULTS`
     and a check in `shared/sessionTemplate.mjs`, and add it to
     `TEMPLATE_FIELDS` in `settings/sessionSettingsEdits.ts`.
7. Use it where it applies: the Worker route that honours it, the session
   page, and `mcp/lib/` if agents need it.
8. Regenerate the Worker template (`npm run worker:cloudflare-template`).
   Document the setting in `docs/session-cors-worker.md` (under set-config,
   and in the list of settings that sign no one out if step 1 put it there),
   and in `docs/session-creation-guide.md` if `/new` shows it.

`workers/sessionCorsWorker/sessionConfigEdits.test.mjs` fails if a key in
step 1 is refused as unsupported, and `sessionSettingsWorkerSave.test.js`
fails if the Settings page saves a key step 1 lacks. Nothing checks steps 3,
4 or 6 for you.

### A Worker feature flag

A flag tells the site or the MCP that a session's Worker has something an
older Worker lacks. There are two kinds; use the first for a setting and the
second for anything else.

- A support field on the config read, for a setting an older Worker would
  refuse or ignore. In `shared/workerSessionPublicConfig.mjs`, export a named
  constant for the field with a comment saying what it promises (as
  `SESSION_AGENT_READY_FIELD` does), declare it in
  `workerSessionPublicConfig.d.mts`, and add it to `WORKER_SUPPORT_FIELDS`.
  The Worker then sets it to `true` on every config read, and `/new`'s
  check of the config it wrote skips it. Read it as `config[FIELD] === true`,
  as `settings/sessionSettingsEdits.ts` does for the Session Agent.
- A string in `/capabilities`, for a route, or for a setting saved through a
  route of its own (`ai_daily_limit_v1` goes with `/admin/set-limits`). Add
  it, ending in `_v1`, to `FEATURES` in
  `workers/sessionCorsWorker/workerCapabilities.js`, and list it where
  `GET /capabilities` is described in `docs/session-cors-worker.md`. The site
  reads it through `readWorkerCapabilities` in
  `client/src/utilities/worker/workerCapabilities.ts`, which keeps an answer
  for five minutes; give the string a constant and a small reader in
  `client/src/domains/worker/workerRelease.ts`, as `AI_DAILY_LIMIT_FEATURE`
  and `readWorkerCountsAiLimit` do. The MCP reads it through `readFeatures()` in
  `mcp/lib/workerClient.mjs`. Add it to `KNOWN_WORKER_FEATURES` in the site
  only if the admin page should ask for a Worker update when it is missing.
  Pin the string the site reads to `FEATURES` with a test that imports both,
  as `client/src/domains/worker/workerReleaseContract.test.js` does.

### A coordinator store

The session coordinator (`sessionWriteCoordinator.js`) is one Durable Object
per session. Newer stores in it live in their own file behind one function;
`sessionFeedback.js` is the one to copy.

1. Write `workers/sessionCorsWorker/<store>.js` exporting
   `dispatch<Store>Store(coordinator, operation, payload)`. Keep its keys
   under a prefix of its own in `coordinator.state.storage`. When a limit
   and a write must agree, read and write them in one
   `storage.transaction`, as feedback does with its daily cap.
2. Route it in the coordinator's `fetch`: one
   `if (url.pathname.startsWith('/session-config/<store>/'))` line next to
   the other `dispatch…Store` lines.
3. Call it from the Worker route with
   `callSessionConfigCoordinator({ env, slug, path: '<store>/<operation>', ...payload })`
   from `sessionConfigAuthority.js`.
4. If the store never changes the session's config, add `'<store>/'` to
   `KEEPS_CONFIG_PREFIXES` in `sessionConfigAuthority.js`. Without it every
   call drops the Worker's one-second copy of the config, and the next read
   goes back to the coordinator: correct, but slower when a room is busy.
5. Decide whether backups carry it. `exportCoordinatorBackup` in
   `sessionBackupCoordinator.js` carries the config, keys, secrets and
   Session Agent opt-outs only. To carry the store, add it there and to the
   import in `sessionBackupImport.js`; either way, say in the backup section
   of `docs/session-cors-worker.md` whether it is carried.
6. Test the dispatch function against a stand-in coordinator, as
   `sessionFeedback.test.mjs` does, and regenerate the Worker template.

### A request that is safe to retry

When the session coordinator is briefly overloaded, or its reply is lost,
the Worker answers `503` with `retryable: true` (described in
`docs/session-cors-worker.md` after group joins). The work may have been done anyway, so a
client sends a request again only if repeating it does no harm.
`shared/sessionCoordinatorBusy.mjs` holds the rule both clients share
(`isRetryableBusy`) and the delays (`coordinatorRetryDelayMs`).

1. Make the route safe to repeat: a read, an upsert per key, or a write the
   Worker recognises by a request id and doesn't store twice.
2. In the Worker, a busy coordinator answer is marked `retryable: true` on
   its way out (`retryableBusy.js`). Any other busy answer that may be
   repeated is built with `coordinatorBusyBody()`, or carries
   `retryable: true` and a `reason`. A busy answer that must not be repeated
   (such as a sign-in, whose nonce may be spent) carries `retryable: false`.
3. In the site, add the path to `READ_PATHS` or `REPEATABLE_WRITE_PATHS` in
   `client/src/utilities/worker/coordinatorRetry.ts`, and send it through a
   `fetch` wrapped in `withCoordinatorRetry`. `GET` requests, and uploads
   that carry a `requestId`, are retried without listing.
4. In the MCP, add the path to `replaySafe` in `mcp/lib/workerClient.mjs` if
   agents call it. That list is kept apart from the site's, so check both.
5. Add a case to `client/src/utilities/worker/coordinatorRetry.test.ts`,
   and to `mcp/lib/workerClientCoordinatorRetry.test.mjs` if step 4 applied.

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
- Encryption and SBT gates: sensitive fields can be encrypted with SBT-gated Lit key release, and SBT ownership is the unlock condition for gated reads. Each key passes through the session Worker, so the Worker operator and Lit account administrators can obtain it too, and it is not end-to-end encrypted; a Lit usage API key alone cannot request keys, because the Lit Action requires a Worker-signed authorization (see [SECURITY.md](SECURITY.md)). Avoid exposing gated plaintext in docs, screenshots, logs, or fixtures.
