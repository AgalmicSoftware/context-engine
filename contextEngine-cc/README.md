# contextEngine-cc

Claude Code extension for [Context Engine](../README.md) — surfaces passkey-gated survey questions inside your terminal while you work, plus a live status line dashboard.

## Quick Setup

```bash
cd contextEngine-cc
npm install
./install.sh
npm start
```

Then open `http://localhost:7391` to authenticate. Run `npm test` for the local `contextEngine-cc` test suite.
Responses submitted through the CC extension now attempt on-chain submission immediately by default, fall back to local pending storage when submission is not possible (for example no worker token or insufficient funds), and can be kept pending-only by setting `{"autoSubmitResponses":false}` on `/api/settings`. The legacy `submitMode` field is still accepted for backward compatibility.

Current checkout note: CE-CC source is privately version-controlled on this
branch and is stripped from public release/public-history exports. This checkout
contains the local runtime files needed for server-level `/api/agent/*` route
tests. From the repo root, `npm run test:cc` runs the private agent contract,
router harness, and runtime import tests that are meaningful in this package
shape.

## Private Agent Runtime Contracts

This private branch includes contract-only agent runtime helpers for Telegram,
OpenClaw, worker setup, and session storage profile coordination. `/worker-setup`
models bridge readiness checks, write-only secret save state, and display-only
session storage status. Session storage profile selection remains in `/new`
Advanced: `arweave` is default, `cloudflare` is explicit and uses worker-enforced
SBT gates for Cloudflare docs/context unless the payload itself is Lit/client
encrypted. Mock OpenClaw forwarding emits safe envelopes only; no real OpenClaw
transport or production signing authority is added here.

## How It Works

1. A **local server** (port 7391) authenticates you via passkey, loads survey questions from on-chain session data (currently OP Sepolia), and serves them over a local API.
2. A **Claude Code hook** fires on every non-trivial tool use (Bash, Task) and fetches the next unseen question from the server.
3. Claude presents the question to you via `AskUserQuestion` and submits your response plus field-level audience choices back to the server for later on-chain submission.
4. A Claude Code `statusLine` command renders Context Engine progress, cooldown, pending answers, and a manual `press q for question` hint in the terminal footer.

```
Claude Code ──PreToolUse──▸ hook.mjs ──GET──▸ localhost:7391/api/hook/question
                                                    │
                                              ┌─────▼─────┐
                                              │  on-chain  │
                                              │  question  │
                                              │  scanner   │
                                              └─────┬─────┘
                                                    │
Claude Code ◂──additionalContext──── hook.mjs ◂─────┘
     │
     ▼
AskUserQuestion → user answers → submit.mjs → POST /api/respond → stored locally
```

## Response Audiences

`contextEngine-cc` now stores response audiences per field instead of only boolean `encrypt` flags.

- Answer fields accept `answerEncryptionAudience` + optional `answerEncryptionGateId`
- Additional comments accept `additionalEncryptionAudience` + optional `additionalEncryptionGateId`
- Additional comments also support `additionalEncryptionAudience: "follow"` to inherit the answer audience

Accepted audience values:

- `"none"`: plaintext
- `"self"`: encrypt for the responding wallet
- `"gate"`: tag the field to a specific session gate
- `"follow"`: additional comments only; keeps comments aligned to the answer audience until explicitly changed

Gate-audience response encryption uses the session worker's Chipotle Lit route. CE-CC no longer imports `@lit-protocol/*` or `viem` from the sibling client, and it does not run a direct browser/Naga Lit SDK path. If a selected gate needs Lit but the session worker lacks Chipotle credentials, Lit scope, or session sign-in, CE-CC fails closed before uploading plaintext.

## Prerequisites

- **Node.js** 18+ for local development and test runs (`npm install`, `npm run dev`, local server/runtime, `npm test`) because this package relies on `node --watch`, the built-in `node --test` runner, and native `fetch`
- **Claude Code** with hooks support
- A Context Engine session deployed on OP Sepolia (chain 11155420)

Chain defaults:
- CE-CC now defaults to OP Sepolia (`11155420`).
- Base Sepolia RPC support remains available in the codebase, but no CE contracts are configured there right now, so it is not an active runtime target.
- `CE_CHAIN_ID` and `CE_RPC_URL` are the preferred runtime overrides.
- For future private / POA deployments, you can also set `CE_CHAIN_NAME` and `CE_TX_EXPLORER_BASE_URL` so the PWA and status output use the correct chain label and transaction links once that deployment's contract addresses are configured.
- CE-CC intentionally ignores ambient `CHAIN_ID` / `RPC_URL` values from other repo tools or shell sessions; use the `CE_*` names when you want to override its chain or RPC.
- Chain overrides only activate when `client/src/variables/contracts.json` includes both SessionRegistry and Surveys addresses for that chain.

## Monorepo-only Support

`contextEngine-cc` is currently supported only inside this repository layout. It is not a standalone package yet.

- `lib/constants.mjs` reads ABI and chain configuration from sibling `client/src/...`
- `lib/litNodeHooks.mjs` calls the session worker's `/lit/chipotle-action` endpoint for SBT-gated response encryption; it does not depend on sibling `client/node_modules`
- `lib/litChipotleActionCatalog.mjs` mirrors the canonical Chipotle Lit Action source from `client/src/utilities/crypto/litChipotleCatalog.ts`; tests guard this mirror against drift
- `lib/shared/` mirrors or symlinks utilities from the sibling `client/` tree
- `public/ethers.umd.min.js` is a vendored browser bundle for `ethers@5.7.2`, matching `contextEngine-cc/package.json`; regenerate it from the repo root with `node scripts/vendor-cecc-ethers-bundle.js` and update the guarded SHA-256 only after reviewing the minified diff

Standalone extraction is out of scope for this cleanup. Publishing `contextEngine-cc` outside the monorepo would require dependency and shared-module extraction work first.

## Install

```bash
cd contextEngine-cc
./install.sh
```

This does three things:
1. Runs `npm install` (only dependency: `ethers@5`)
2. Copies the full CE-CC runtime bundle to `~/.claude/plugins/contextEngine-cc/`
3. Registers CE-CC activation in the target project's `.claude/settings.local.json` by default
4. Creates or updates a managed survey-hooks block in the target project's `CLAUDE.md`

Local installs also scrub legacy CE-CC-owned hook and status-line entries from `~/.claude/settings.json` so old global installs stop affecting unrelated Claude Code sessions.

### Install options

```bash
./install.sh --hook-only     # Only install the hook (skip npm install)
./install.sh --server-only   # Only install dependencies (skip hook registration)
./install.sh --claude-md-only # Only install or refresh the managed CLAUDE.md block
./install.sh --hook-only --global-hooks # Opt into ~/.claude/settings.json activation
```

### Custom server URL

```bash
SERVER_URL=http://192.168.1.5:7391 ./install.sh
```

Re-running the installer with an explicit `SERVER_URL=...` updates the stored plugin server URL without wiping existing hook session selections.

By default, activation is written to:

```text
<project>/.claude/settings.local.json
```

If you want CE-CC active across all Claude Code sessions, opt in explicitly with:

```bash
./install.sh --global-hooks
```

`install.sh` manages only the block between these markers in the target `CLAUDE.md`:

```md
<!-- contextengine-cc:survey-hooks:start -->
...
<!-- contextengine-cc:survey-hooks:end -->
```

If the target `CLAUDE.md` already exists, the installer replaces only that managed block and leaves unrelated content alone. If no `CLAUDE.md` exists, it creates one. When the file already has a leading Markdown heading, the managed block is inserted immediately after that heading; otherwise the block is prepended.

When you run `./install.sh` from inside `contextEngine-cc/`, the installer targets the parent repo by default for both `CLAUDE.md` and `.claude/settings.local.json`, even on a first install before that parent repo has its own `CLAUDE.md`. Use `PROJECT_DIR=/path/to/project` to target a different repo explicitly.

If you already use a custom Claude Code `statusLine`, the installer leaves it alone. You can enable the Context Engine dashboard manually later by pointing `statusLine.command` at:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node ~/.claude/plugins/contextEngine-cc/status/entry.mjs"
  }
}
```

## Start the Server

```bash
cd contextEngine-cc
npm start
# or with file watching:
npm run dev
```

`npm start` now keeps the output intentionally short:

- if CE-CC is not running yet, it starts the local server and prints one sign-in line
- if CE-CC is already running on `127.0.0.1:7391`, it exits cleanly and prints the same passkey sign-in URL instead of throwing `EADDRINUSE`
- if some other process owns port `7391`, it prints a short conflict message telling you which URL to check

The sign-in URL is `http://localhost:7391`.
The browser frontend stays build-free inside `public/`: `index.html` is the DOM shell, `styles.css` holds the shared page styling, and `js/*.mjs` contains the browser modules served directly by the local server.
Verbose runtime tracing is off by default. Set `CE_CC_DEBUG=1` when you want debug logs from the server, router, question scanning, and submission pipeline:

```bash
CE_CC_DEBUG=1 npm start
```

Security defaults:
- The server binds to loopback by default (`HOST=127.0.0.1`).
- CORS `Access-Control-Allow-Origin` is only reflected for loopback origins (`localhost`, `127.0.0.1`, `::1`).

## Authenticate

1. Open `http://localhost:7391` in your browser
2. Create or use a passkey (WebAuthn), then sign into the sessions you want to submit through
3. Your JWT token is saved to `~/.claude/plugins/contextEngine-cc/.state/token.jwt`

If your token expires, the hook will open the browser automatically and show a macOS notification.

Passkey wallet derivation matches the main client’s passkey PRF -> HKDF-SHA256 EOA path. Reusing the same wallet across the client and `contextEngine-cc` still requires both apps to run on the same hostname because WebAuthn passkeys are scoped by RP ID.

### Local JWT endpoint safeguards

`POST /api/auth/local-jwt` is restricted to trusted local requests:
- Remote address must be loopback.
- `Host` header must be loopback.
- If provided, `Origin`/`Referer` must also be loopback.

Optional `privateKey` storage is validated:
- `privateKey` must be a 32-byte hex value (`0x...`).
- The derived wallet address must match `walletAddress`.

All authenticated API calls require a server-signed local JWT. Stored worker tokens are used for Arweave worker calls, not as API auth credentials.

## Agent-Native Delegation Boundary

The canonical agent-native surface is `/api/agent/*`. MCP, Telegram, and
OpenClaw wrappers are thin clients of those routes; they are not authority
stores and must not store CE-CC JWTs, private keys, worker tokens, long-lived
bearer tokens, private deployment config, or equivalent signing authority.

Default risky actions remain approval-required. The private
`scoped_delegated_execute` mode lets a human explicitly delegate a narrow action
to a specific agent for a specific session, action id, risk ceiling, expiry, and
audit requirement. `trusted_local_auto_submit` remains local-only and stronger
than scoped remote delegation.

Current grant management routes are connect-request create/read/approve/deny
plus grant read/revoke:

Private Telegram demo worker note: `workers/agentBridgeWorker/` now carries the
isolated bridge worker skeleton for the group-lobby/private-account lane. It is
not part of CE-CC runtime, does not modify `workers/sessionCorsWorker/`, and is
stripped from public release/public-history exports while private.

- `POST /api/agent/connect-requests`
- `GET /api/agent/connect-requests/:id`
- `POST /api/agent/connect-requests/approve`
- `POST /api/agent/connect-requests/deny`
- `GET /api/agent/grants`
- `GET /api/agent/grants/:id`
- `POST /api/agent/grants/revoke`
- `POST /api/agent/accounts/create`
- `POST /api/agent/accounts/link-request`

Connect requests are the only current grant-creation path. They bind the human
principal, delegated agent, explicit session slugs, allowed action ids, risk
ceiling, expiry, execution policy, audit requirement, idempotency key, and
fingerprint. Reads are side-effect free. Approval requires local human auth and
creates only scoped grant metadata; denial closes the request without creating a
grant. Approval rejects body fields that would widen scope.

`POST /api/agent/responses/delegated-execute` validates a scoped grant and
writes an audit lifecycle record, but it is contract-only right now:
`executed:false` with `contract_only_deferred`. Actual signing or
worker-mediated execution still requires an approved CE-owned execution path and
a product/security decision.

The private `agentBridgeWorker` primitives under `lib/agent/bridgePrimitives.mjs`
are contract-only: principal summaries, preference profiles, opaque action
records, idempotency records, safe bridge events, grant cache summaries, and
agent-created account metadata. V1 agent-created accounts are modeled as managed
testnet/account-runtime metadata only; Durable Object isolated signer is the
preferred future signer boundary, and no raw keys, seeds, JWTs, worker tokens,
or signing authority are returned.

Telegram group-to-private helpers in `lib/agent/telegramContracts.mjs` are also
contract-only. Group deep links carry opaque action ids, private chat resolves
group/session/question context server-side, unknown participants route to
managed account setup, and group-safe summaries omit private account state and
answers.

The private bridge worker screen contract records launch metadata for every
Telegram state. Current commands are `/start`, `/ce_join`, `/ce_questions`,
`/ce_pose_question`, `/q`, deprecated `/ce_drop_question`, `/ce_docs`,
`/ce_generate_questions`, `/ce_account`,
`/ce_sbt <sbt-address-or-group-id-or-link>`,
`/ce_join_sbt <sbt-address-or-invite-code-or-link>`,
`/ce_create_sbt_group [session-slug]`, `/ce_onboarding`, `/ce_export_key`, and `/ce_recover_key`,
with opaque callback actions, `callback:<pose_question_action>`, or
`t.me/<bot>?start=<opaque-action-id>` used where commands are not enough. The
group session-linked card says `Context Engine session linked: <session>` and
shows `Join Session`, `View Questions`, `View / Add Docs`, and policy-allowed
`Pose Question`; it does not add a default `Answer Privately` button. `View
Questions` reads existing session questions through `GET /api/agent/questions`.
`Pose Question` posts one
public-safe existing or generated question to the group; locked private/gated
questions stay locked in group and route eligible accounts to private chat or
Mini App. `Join Session` routes missing configured accounts to private account
setup. Question cards keep CE control parity:
agree/unsure/disagree, rating `0` through `10`, single-select vs multi-select
multichoice state, freeform type/voice, additional comments, microphone where
supported, and docs/context only when docs exist or are relevant.

SBT/account Telegram screens are contract-only helpers over canonical CE agent
routes. Public/password joins and create-group requests target planned
`/api/agent/sbt-groups/*` contracts; `My Account` shows managed address, joined
sessions, joined SBT summaries, and private export/restore controls. Private
question decrypt requests target the planned `/api/agent/decrypt/request` route
and do not implement Lit decrypt inside Telegram.

SBT command parsing allows public SBT addresses, group ids, and share links in
group commands. Passwords, invite credentials, wallet proofs, and private
eligibility checks are private chat or Mini App only. Required SBT gates on
`Join Session` list safe group summaries, prompt public/open joins when eligible,
route password/invite input privately, route wallet/passkey/non-public gates to
full CE account linking, and retry the session join after the gate is satisfied.

Storage profile selection belongs to session config in `/new`, not Telegram.
`arweave` remains the default/current profile; `lit-arweave` remains supported
for encrypted Arweave payloads; `cloudflare` is an explicit profile where the
session/general worker enforces SBT gates for uploads, lists, reads, snippets,
short-lived reads, and downloads. Agent-facing question/response shapes now add
`storageRef` while preserving `arweaveTxId` for Arweave-backed compatibility.
Readers prefer `storageRef` and fall back to `arweaveTxId`; Cloudflare payloads
do not get fake Arweave ids. If a legacy on-chain Surveys pointer must carry a
Cloudflare payload pointer, it carries an opaque bytes32-compatible Cloudflare
storage ID and relies on `storageRef.backend`/session config for interpretation.
Cloudflare storage is CE payload storage for session context, docs, media,
questions, surveys, responses, and generated artifacts, not user
preference/profile storage. Backend selection happens in `/new` at session
creation time; mutation/migration is out of scope. Lit is required only for
payloads that are intentionally Lit/client encrypted.
Telegram/OpenClaw/CE-CC/MCP receive safe metadata or permission states, not
Cloudflare credentials, bucket names, worker tokens, raw storage paths, or
long-lived signed URLs.

`lib/agent/workerSetupContracts.mjs` defines the private `/worker-setup`
planning surface and default-off onboarding config. The contextengine.sh domain
cutover is planned separately and is not implemented here.

See [Agent Native Contract](../docs/agent-native-contract.md) for the scoped
grant fields, action inventory, and current web UX parity gaps.

## Configure a Session

Edit `~/.claude/plugins/contextEngine-cc/.state/config.json`:

```json
{
  "serverUrl": "http://localhost:7391",
  "defaultSession": "YOUR-SESSION-UUID-HERE"
}
```

The `defaultSession` is the session slug/UUID from your Context Engine deployment. You can find available sessions at `http://localhost:7391` after authenticating, or via the API:

```bash
curl -s http://localhost:7391/api/sessions \
  -H "Authorization: Bearer $(cat ~/.claude/plugins/contextEngine-cc/.state/token.jwt)"
```

## Hook Behavior

The hook fires as a `PreToolUse` hook on `Bash|Write|Edit|Read|Glob|Grep|Task` tool calls and as a `Notification` hook for idle prompts. It filters for long-running operations to avoid interrupting fast commands:

- **Always triggers**: `Task` (agent) calls, Bash commands without an explicit short timeout
- **Skips**: Fast commands (`echo`, `ls`, `cat`, `head`, `tail`, `pwd`, etc.), Bash with `timeout < 30s`
- **Cooldown**: 45 seconds between questions (prevents flooding)
- **Seen tracking**: Questions are marked as seen after being fetched to avoid repeats
- **Surfacing mode**: `questionSurfacingMode` defaults to `manual`, which keeps `q` as the ask trigger and allows redacted statusline hints. `idle` lets idle notifications ask. `ambient` can prepare questions during tool use, and only interrupts tool use when `ambientInterruptions` is enabled.

Manual `q` should use the compact helper instead of raw curl output:

```bash
node ~/.claude/plugins/contextEngine-cc/hook/manual-question.mjs
```

The helper tries the configured sessions and returns compact JSON without the terminal box renderer. For debugging, the raw route remains available with `presentation=debug` or the default route output.

For Claude-facing manual `q` flows, the helper also returns a top-level `submitMeta` object containing the canonical `questionId`, `session`, `questionType`, and default encryption audiences to pass back to `/api/respond`. Consumers should reuse that `submitMeta` directly instead of reconstructing the session slug from config.

Normal Claude-side response submission should prefer the wrapper instead of raw `curl`:

```bash
node ~/.claude/plugins/contextEngine-cc/hook/submit.mjs --meta '{"questionId":"...","session":"...","questionType":"..."}'
```

That still does not make plaintext answers impossible for Claude to see, but it reduces how often answer text has to appear in shell command logs.

When `/api/respond` auto-submits successfully, the JSON response now includes `txExplorerUrl` whenever the active chain metadata has a transaction explorer base URL. CE-CC defaults to Blockscout links on supported public testnets, and private/corporate deployments can override that destination with `CE_TX_EXPLORER_BASE_URL` to surface internal explorer links instead.

### Hook timeout

The installer sets `timeout: 15000` (15 seconds). For local installs, adjust the timeout in your project's `.claude/settings.local.json`. For global installs, adjust `~/.claude/settings.json` instead:

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash|Write|Edit|Task",
      "hooks": [{
        "type": "command",
        "command": "node ~/.claude/plugins/contextEngine-cc/hook/entry.mjs",
        "timeout": 15000
      }]
    }]
  }
}
```

After the first question load, the server caches question data to disk (`.data/question-cache/`) so subsequent fetches are fast.

## Status Line Dashboard

The installer also configures a Claude Code `statusLine` command when no other status line is already present. The dashboard shows:

- Auth state and active wallet
- Selected session count
- Pending local responses
- Worker-auth gaps for selected sessions when immediate submit cannot push on-chain yet
- Aggregate question progress across selected sessions
- Current cooldown / readiness
- Manual `press q for question` guidance, plus optional phase hints only when explicitly enabled

The dashboard is driven by `GET /api/status` and keeps a short local cache so terminal redraws stay responsive even if the local server is busy.

## Troubleshooting

### No questions appearing

1. **Server not running**: Start it with `npm start` in the `contextEngine-cc/` directory
2. **No token**: Open `http://localhost:7391` and authenticate
3. **No session configured**: Set `defaultSession` in `.state/config.json`
4. **All questions seen**: Clear the seen list:
   ```bash
   echo '{}' > ~/.claude/plugins/contextEngine-cc/.state/seen.json
   ```
5. **Cooldown active**: The hook waits 45s between questions. Clear manually:
   ```bash
   rm ~/.claude/plugins/contextEngine-cc/.state/last-ts
   ```
6. **Hook timeout too short**: Increase `timeout` in your CE-CC activation settings file (see above)

### Verify the hook works

Test the hook manually:

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"sleep 60","timeout":120000}}' \
  | node ~/.claude/plugins/contextEngine-cc/hook/entry.mjs
```

You should see JSON with `hookSpecificOutput.additionalContext` containing the question. If you see no output, the hook is silently allowing (check the troubleshooting steps above).

### Check server health

```bash
# Check if server is running
curl -s http://localhost:7391/api/me \
  -H "Authorization: Bearer $(cat ~/.claude/plugins/contextEngine-cc/.state/token.jwt)"

# Fetch a question directly
curl -s "http://localhost:7391/api/hook/question?session=YOUR-SESSION-UUID" \
  -H "Authorization: Bearer $(cat ~/.claude/plugins/contextEngine-cc/.state/token.jwt)"
```

### Responses stay pending or session sign-in is still required

Auto-submit still needs a completed per-session sign-in so CE-CC can upload the payload to the session backend before writing on-chain. Gate-audience encrypted responses also use that worker token to call the worker-mediated Chipotle route, so missing session sign-in or missing Lit worker scope blocks encrypted upload rather than falling back to plaintext.

1. Open `http://localhost:7391`
2. Complete session sign-in for the affected session inside the PWA
3. Verify session sign-in readiness:
   ```bash
   curl -s http://localhost:7391/api/auth/check \
     -H "Authorization: Bearer $(cat ~/.claude/plugins/contextEngine-cc/.state/token.jwt)"
   ```
4. Retry `POST /api/responses/submit-onchain`, or just answer another question and let auto-submit retry pending responses if `autoSubmitResponses` is still enabled

## State Files

All state is stored in `~/.claude/plugins/contextEngine-cc/.state/`:

| File | Purpose |
|------|---------|
| `config.json` | Server URL and default session |
| `token.jwt` | Authentication token (passkey) |
| `seen.json` | Map of question IDs already shown (prevents repeats) |
| `last-ts` | Timestamp of last question shown (cooldown timer) |
| `last-auth-ts` | Timestamp of last auth prompt (5-min auth cooldown) |

Server data is stored in `contextEngine-cc/.data/`:

| Directory | Purpose |
|-----------|---------|
| `.data/question-cache/` | Cached question payloads from Arweave (per session) |
| `.data/responses/` | User responses stored locally before on-chain submission |
| `.data/confirmed-submissions/` | Per-session, per-wallet index of confirmed on-chain submissions used for local answered-state tracking |
| `.data/sessions/` | Cached session configs |
| `.data/settings.json` | Submission preferences such as `autoSubmitResponses` |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/local-jwt` | No (trusted local requests only) | Issue a local JWT for Claude Code |
| GET | `/api/me` | Yes | Return current user info |
| GET | `/api/auth/check` | Yes | Check per-session sign-in readiness for the selected sessions |
| GET | `/api/sessions` | Yes | List available sessions |
| GET | `/api/session/worker-url` | Yes | Get CORS worker URL for a session |
| GET | `/api/questions?session=&seen=` | Yes | Get random unseen question plus `gateOptions` / `defaultGateId` for response audiences |
| GET | `/api/hook/question?session=&seen=` | Yes | Get question formatted for terminal, raw data, and gate-aware audience defaults |
| GET | `/api/hook/question?session=&presentation=compact` | Yes | Get compact hook/manual question JSON without terminal box rendering or prior-response text |
| GET | `/api/status` | Yes | Get status line summary (sessions, pending, cooldown, latest question, session sign-in readiness) |
| GET | `/api/settings` | Yes | Get submission settings (`autoSubmitResponses` defaults to `true`) plus active chain metadata |
| POST | `/api/settings` | Yes | Update submission settings; POST `{"autoSubmitResponses":false}` to keep responses pending-only |
| POST | `/api/respond` | Yes | Submit a response; it is stored locally first and then auto-submitted on-chain when enabled, with `requiresWorkerAuth` surfaced when the session still lacks session sign-in and `txExplorerUrl` returned on successful on-chain submit when explorer metadata is configured |
| GET | `/api/responses/pending?session=` | Yes | List pending local responses for the authenticated wallet |
| POST | `/api/responses/submit-onchain` | Yes | Submit pending local responses on-chain |
| POST | `/api/responses/mark-submitted` | Yes | Mark a local response as submitted and persist confirmed local state |

## Agent-Native API

Canonical agent routes live under `/api/agent/*` and are documented in
[`docs/agent-native-contract.md`](../docs/agent-native-contract.md). They use
the same local JWT auth as the legacy CE-CC API.

Agent routes require explicit public session identity. Use `general` for the
general/default session; empty values such as `session: ""` or `?session=` are
rejected even though older browser/client internals may still use an empty
string for that local convention.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/agent/me` | Return local agent identity, auth mode, and capability metadata |
| GET | `/api/agent/sessions` | List agent-visible sessions using the existing scan scope |
| GET | `/api/agent/questions?session=` | Return the next question as `question` plus canonical `questions[]` |
| GET | `/api/agent/inbox` | Return pending-response and approval-request summaries |
| POST | `/api/agent/responses/draft` | Save a response draft locally without auto-submit |
| GET | `/api/agent/responses/drafts?session=` | List authenticated-wallet local response drafts |
| POST | `/api/agent/responses/submit-request` | Create an approval-required submit request instead of signing |
| POST | `/api/agent/accounts/create` | Create or recover managed demo account metadata only |
| POST | `/api/agent/accounts/link-request` | Create an approval-required account link request |
| GET | `/api/agent/requests/:id` | Read approval request status by opaque request id |

Submit requests may include an optional `idempotencyKey`. The key is normalized
inside the authenticated wallet scope so same-payload retries return the
existing pending approval request instead of creating duplicate work. Reusing a
key for a different session or question set returns a conflict.

MCP descriptors in `lib/agent/mcpTools.mjs` are thin wrappers over these
routes. Telegram and OpenClaw helpers in `lib/agent/` are pure contract helpers
only; they do not add webhook deployment, bot-token storage, OpenClaw transport
dependencies, or remote signing authority. Telegram callback data remains an
opaque action id, Mini App `initData` is HMAC-validated with freshness checks,
and OpenClaw envelopes must point back to canonical `/api/agent/*` routes.

## Uninstall

```bash
cd contextEngine-cc
./uninstall.sh

# Or target a different project explicitly
PROJECT_DIR=/path/to/project ./uninstall.sh

# Remove explicit global activation too
./uninstall.sh --global-hooks
```

By default, this removes CE-CC activation from the targeted project's `.claude/settings.local.json`, removes the managed survey-hooks block from that project's `CLAUDE.md`, and deletes `~/.claude/plugins/contextEngine-cc/` when no explicit global CE-CC activation remains. Server data in `.data/` is preserved.

If you installed CE-CC with `--global-hooks`, plain uninstall keeps the shared plugin bundle in place so unrelated Claude Code sessions do not break. Rerun uninstall with `--global-hooks` to remove CE-CC-owned entries from `~/.claude/settings.json` and then delete the shared plugin bundle too.

`uninstall.sh` also removes only the installer-managed survey-hooks block between the same `contextengine-cc:survey-hooks` markers from the targeted `CLAUDE.md`. If no managed block is present, unrelated file content is left untouched.

Like `install.sh`, `uninstall.sh` targets the parent repo when run from inside `contextEngine-cc/` and uses `PROJECT_DIR=/path/to/project` when you want to target a different project explicitly.

## License

`contextEngine-cc` is packaged as `CPAL-1.0`. See [LICENSE](LICENSE).
