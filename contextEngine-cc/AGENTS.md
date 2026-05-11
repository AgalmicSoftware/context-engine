# AGENTS.md — contextEngine-cc

Claude Code extension for Context Engine. Surfaces passkey-gated survey questions in the terminal.

## Quick commands
```bash
npm run test:cc                         # from repo root; runs the full CE-CC suite when runtime files are present
node --test contextEngine-cc/lib/agent/*.test.mjs
node --test contextEngine-cc/test/agent-router.integration.test.mjs contextEngine-cc/test/agent-router-contract.test.mjs contextEngine-cc/test/router.route-inventory.test.mjs
```

This integration checkout tracks the full `contextEngine-cc` runtime, including
`server.mjs`, `package.json`, and `public/js/sessionSlugs.mjs`. Package-local
`npm install`, `npm start`, and server-level HTTP tests are available when the
local Node/npm environment is prepared.

## Stack
- Node.js 18+ for install, `npm start`, `npm run dev`, and `npm test` because this package relies on `node --watch`, `node --test`, and native `fetch`
- ethers v5.7.2 (same constraint as parent repo — MUST NOT upgrade to v6)
- No framework — raw `http.createServer` with custom router
- WebAuthn/passkey auth via browser, SIWE as alternative

## Project map
| Path | What it is |
|------|------------|
| `server.mjs` | HTTP server entry point (port 7391) |
| `hook/hook.mjs` | Claude Code PreToolUse hook — fetches next question from local server |
| `status/statusline.mjs` | Claude Code status line dashboard renderer |
| `lib/router.mjs` | API route handler (all endpoints) |
| `lib/questions.mjs` | Question fetching, caching, Arweave resolution |
| `lib/sessions.mjs` | Session listing and config |
| `lib/submit.mjs` | Response submission and local storage |
| `lib/jwt.mjs` | Local JWT issuance and verification |
| `lib/localRequest.mjs` | Loopback request validation |
| `lib/constants.mjs` | Shared constants (contract addresses, chain config) |
| `lib/shared/` | Utilities shared with parent `client/` (symlinked or mirrored) |
| `public/` | Browser UI for auth (passkey/SIWE login page) |
| `install.sh` | Hook installer (copies to ~/.claude/plugins/) |
| `test/` | Integration tests |
| `.data/` | Server runtime data (question-cache, responses, sessions) |

## Monorepo scope
- Supported only inside this repo layout for now; do not treat `contextEngine-cc` as a standalone package yet
- `lib/constants.mjs` reads ABI/config data from sibling `client/src/...`
- `lib/litNodeHooks.mjs` routes SBT-gated response encryption through the session worker's worker-mediated Chipotle Lit route
- CE-CC must not import `@lit-protocol/*` or `viem` from sibling `client/node_modules`; clean installs only own `ethers@5`
- `lib/shared/` stays coupled to sibling `client/` code
- Standalone extraction is deferred and would require moving those dependencies into package-local ownership

## State files
All user state in `~/.claude/plugins/contextEngine-cc/.state/`:
- `config.json` — server URL, default session
- `token.jwt` — auth token
- `seen.json` — seen question IDs
- `last-ts` — cooldown timestamp

## Conventions
- All source files use `.mjs` extension (ES modules)
- Tests use Node.js built-in test runner (`node --test`)
- Test files: `*.test.mjs` (co-located in `lib/` or in `test/`)
- Server binds to loopback only by default
- CORS only reflected for loopback origins

## Guardrails
- **MUST NOT**: store private keys in plain text (use encrypted storage)
- **MUST NOT**: allow non-loopback origins in CORS
- **MUST NOT**: expose JWT signing key
- **MUST**: validate loopback on all auth endpoints
- **MUST**: keep ethers on v5 (matches parent repo constraint)
