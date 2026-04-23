# contextEngine-cc

Claude Code extension for [Context Engine](../README.md) — surfaces passkey-gated survey questions inside your terminal while you work, plus a live status line dashboard.

## Quick Setup

```bash
cd contextEngine-cc
npm install
./install.sh
npm run dev
```

Then open `http://localhost:7391` to authenticate. Run `npm test` for the local `contextEngine-cc` test suite.
Responses submitted through the CC extension now attempt on-chain submission immediately by default, fall back to local pending storage when submission is not possible (for example no worker token or insufficient funds), and can be kept pending-only by setting `{"autoSubmitResponses":false}` on `/api/settings`. The legacy `submitMode` field is still accepted for backward compatibility.

## How It Works

1. A **local server** (port 7391) authenticates you via passkey/SIWE, loads survey questions from on-chain session data (currently OP Sepolia), and serves them over a local API.
2. A **Claude Code hook** fires on every non-trivial tool use (Bash, Task) and fetches the next unseen question from the server.
3. Claude presents the question to you via `AskUserQuestion` and submits your response plus field-level audience choices back to the server for later on-chain submission.
4. A Claude Code `statusLine` command renders Context Engine progress, cooldown, pending answers, and the latest surfaced prompt in the terminal footer.

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
AskUserQuestion → user answers → curl POST /api/respond → stored locally
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
- `lib/litNodeHooks.mjs` resolves `viem` and `@lit-protocol/*` from sibling `client/node_modules`
- `lib/shared/` mirrors or symlinks utilities from the sibling `client/` tree

Standalone extraction is out of scope for this cleanup. Publishing `contextEngine-cc` outside the monorepo would require dependency and shared-module extraction work first.

## Install

```bash
cd contextEngine-cc
./install.sh
```

This does three things:
1. Runs `npm install` (only dependency: `ethers@5`)
2. Copies the PreToolUse hook, SessionStart hook, protocol file, and status line scripts to `~/.claude/plugins/contextEngine-cc/` and registers them in `~/.claude/settings.json`
3. Creates or updates a managed survey-hooks block in the target project's `CLAUDE.md`

### Install options

```bash
./install.sh --hook-only     # Only install the hook (skip npm install)
./install.sh --server-only   # Only install dependencies (skip hook registration)
./install.sh --claude-md-only # Only install or refresh the managed CLAUDE.md block
```

### Custom server URL

```bash
SERVER_URL=http://192.168.1.5:7391 ./install.sh
```

Re-running the installer with an explicit `SERVER_URL=...` updates the stored plugin server URL without wiping existing hook session selections.

`install.sh` manages only the block between these markers in the target `CLAUDE.md`:

```md
<!-- contextengine-cc:survey-hooks:start -->
...
<!-- contextengine-cc:survey-hooks:end -->
```

If the target `CLAUDE.md` already exists, the installer replaces only that managed block and leaves unrelated content alone. If no `CLAUDE.md` exists, it creates one. When the file already has a leading Markdown heading, the managed block is inserted immediately after that heading; otherwise the block is prepended.

When you run `./install.sh` from inside `contextEngine-cc/`, the installer prefers the parent repo's `CLAUDE.md` if one exists. Use `PROJECT_DIR=/path/to/project` to target a different repo explicitly.

If you already use a custom Claude Code `statusLine`, the installer leaves it alone. You can enable the Context Engine dashboard manually later by pointing `statusLine.command` at:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node ~/.claude/plugins/contextEngine-cc/status/statusline.mjs"
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

The server starts on `http://localhost:7391`.
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
2. Create or use a passkey (WebAuthn) — or sign in with SIWE from the Context Engine PWA
3. Your JWT token is saved to `~/.claude/plugins/contextEngine-cc/.state/token.jwt`

If your token expires, the hook will open the browser automatically and show a macOS notification.

Passkey wallet derivation now matches the main client’s HKDF-SHA256 Porto path. Reusing the same wallet across the client and `contextEngine-cc` still requires both apps to run on the same hostname because WebAuthn passkeys are scoped by RP ID.

### Local JWT endpoint safeguards

`POST /api/auth/local-jwt` is restricted to trusted local requests:
- Remote address must be loopback.
- `Host` header must be loopback.
- If provided, `Origin`/`Referer` must also be loopback.

Optional `privateKey` storage is validated:
- `privateKey` must be a 32-byte hex value (`0x...`).
- The derived wallet address must match `walletAddress`.

All authenticated API calls require a server-signed local JWT. Stored worker tokens are used for Arweave worker calls, not as API auth credentials.

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

The hook fires as a `PreToolUse` hook on `Bash|Write|Edit|Task` tool calls and as a `Notification` hook for idle prompts. It filters for long-running operations to avoid interrupting fast commands:

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

### Hook timeout

The installer sets `timeout: 5000` (5 seconds) in `~/.claude/settings.json`. If your RPC or Arweave calls are slow on first load, increase this:

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash|Write|Edit|Task",
      "hooks": [{
        "type": "command",
        "command": "node ~/.claude/plugins/contextEngine-cc/hook/hook.mjs",
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
- The latest question surfaced by the hook, or a redacted ready-question hint when enabled

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
6. **Hook timeout too short**: Increase `timeout` in `~/.claude/settings.json` (see above)

### Verify the hook works

Test the hook manually:

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"sleep 60","timeout":120000}}' \
  | node ~/.claude/plugins/contextEngine-cc/hook/hook.mjs
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

### Responses stay pending or `submit-onchain` says "No worker token stored"

Auto-submit still needs a valid per-session worker token so CE-CC can upload the payload to the session worker before writing on-chain.

1. Open `http://localhost:7391`
2. Complete the worker-auth flow for the affected session inside the PWA
3. Verify token readiness:
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
| `token.jwt` | Authentication token (passkey/SIWE) |
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
| POST | `/api/auth/local-jwt` | No (trusted local requests only) | Issue a local JWT (skip-SIWE flow) |
| GET | `/api/me` | Yes | Return current user info |
| GET | `/api/auth/check` | Yes | Check per-session worker-token freshness for the selected sessions |
| GET | `/api/sessions` | Yes | List available sessions |
| GET | `/api/session/worker-url` | Yes | Get CORS worker URL for a session |
| GET | `/api/questions?session=&seen=` | Yes | Get random unseen question plus `gateOptions` / `defaultGateId` for response audiences |
| GET | `/api/hook/question?session=&seen=` | Yes | Get question formatted for terminal, raw data, and gate-aware audience defaults |
| GET | `/api/hook/question?session=&presentation=compact` | Yes | Get compact hook/manual question JSON without terminal box rendering or prior-response text |
| GET | `/api/status` | Yes | Get status line summary (sessions, pending, cooldown, latest question, worker-token readiness) |
| GET | `/api/settings` | Yes | Get submission settings (`autoSubmitResponses` defaults to `true`) plus active chain metadata |
| POST | `/api/settings` | Yes | Update submission settings; POST `{"autoSubmitResponses":false}` to keep responses pending-only |
| POST | `/api/respond` | Yes | Submit a response; it is stored locally first and then auto-submitted on-chain when enabled, with `requiresWorkerAuth` surfaced when the session still lacks worker auth |
| GET | `/api/responses/pending?session=` | Yes | List pending local responses for the authenticated wallet |
| POST | `/api/responses/submit-onchain` | Yes | Submit pending local responses on-chain |
| POST | `/api/responses/mark-submitted` | Yes | Mark a local response as submitted and persist confirmed local state |

## Uninstall

```bash
cd contextEngine-cc
./uninstall.sh

# Or target a different project CLAUDE.md explicitly
PROJECT_DIR=/path/to/project ./uninstall.sh
```

This removes the hook entries from `~/.claude/settings.json` and deletes `~/.claude/plugins/contextEngine-cc/`. Server data in `.data/` is preserved.

`uninstall.sh` also removes only the installer-managed survey-hooks block between the same `contextengine-cc:survey-hooks` markers from the targeted `CLAUDE.md`. If no managed block is present, unrelated file content is left untouched.

Like `install.sh`, `uninstall.sh` walks upward from the current directory to find the nearest project `CLAUDE.md` and, when run from inside `contextEngine-cc/`, skips the subproject copy in favor of the parent repo's `CLAUDE.md`. Use `PROJECT_DIR=/path/to/project` to target a different repo explicitly.

## License

`contextEngine-cc` is packaged as `CPAL-1.0`. See [LICENSE](LICENSE).
