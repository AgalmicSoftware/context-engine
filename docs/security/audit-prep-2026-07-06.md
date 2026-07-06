# Audit Prep - 2026-07-06

This is an input pack for a contracts and Web3 review. It uses only tracked
sources and built-in package-manager checks; no dependency updates are made
here.

## Commands Run

```bash
npm audit --json > /tmp/prd655-root-audit.json
npm audit --json > /tmp/prd655-client-audit.json
npm audit --json > /tmp/prd655-session-worker-audit.json
npm audit --json > /tmp/prd655-agent-worker-audit.json
```

The agent bridge worker audit could not run because
`workers/agentBridgeWorker/` has no tracked `package-lock.json`; npm returned
`ENOLOCK`.

## npm Audit Disposition

| Package root | Total | Critical | High | Moderate | Low | Disposition |
|---|---:|---:|---:|---:|---:|---|
| repo root | 26 | 2 | 3 | 21 | 0 | FOLLOW-UP |
| `client/` | 175 | 0 | 24 | 22 | 129 | FOLLOW-UP |
| `workers/sessionCorsWorker/` | 8 | 0 | 7 | 1 | 0 | FOLLOW-UP |
| `workers/agentBridgeWorker/` | n/a | n/a | n/a | n/a | n/a | OPERATOR-CONFIRM |

Root findings are concentrated around `ethers` v5 transitive dependencies
(`@ethersproject/*`, `bn.js`, `elliptic`, `ws`) and `arweave` transitive crypto
packages. The repo intentionally remains on ethers v5 because ethers v6 BigInt
behavior is not compatible with the current codebase.

Client findings are mostly Babel/Jest/dev-tooling transitive advisories plus
front-end dependency chains. They are not bumped in this lane because dependency
updates need a separate compatibility pass.

`workers/sessionCorsWorker/` findings center on `wrangler`, `miniflare`,
`undici`, `ws`, `defu`, `unenv`, and the worker's `ethers` dependency chain.
They need a worker dependency upgrade lane with worker tests and bundle-sync
verification.

## Secrets Sweep

A tracked-file pattern sweep searched for 64-hex private-key-like values,
mnemonic assignments, and long key/token/secret assignments. It produced 3,290
matches. Manual triage found the matches are dominated by:

- Published contract transaction hashes in `ARCHITECTURE.md`.
- Non-identifying fixture IDs and test hashes under `client/src/**`.
- Test-only token placeholders under `workers/agentBridgeWorker/*.test.mjs`.
- Placeholder names in `workers/**/.example` and `workers/**/wrangler.example.toml`.
- The public Hardhat/Anvil development mnemonic in `package.json` scripts.

Accepted exceptions:

- The Anvil mnemonic `test test test test test test test test test test test junk`
  is a public local-chain fixture.
- Deterministic Hardhat-style local keys and test hashes in unit tests are
  fixtures, not production secrets.
- Placeholder `sk-...`, `PASTE_*`, and `YOUR_*` values in example files are not
  usable credentials.

FOLLOW-UP: add a tuned repo secret-scan allowlist so new high-entropy literals
can fail automatically while fixture hashes remain documented.

## Worker Config Sweep

Tracked worker examples and code expose these operator-sensitive config groups:

- Session worker: `TOKEN_HMAC_SECRET`, `CE_STORAGE_ENVELOPE_KEK`, optional
  `CE_STORAGE_ENVELOPE_PREVIOUS_KEK`.
- Deploy helper: `DEPLOY_HELPER_KV`, `ALLOWED_ORIGINS`, `ADMIN_SECRET`,
  `WORKER_BUNDLE_URL`, `WORKER_COMPATIBILITY_DATE`, `DEFAULT_SESSION_SLUG`.
- Agent bridge: Cloudflare deploy token inputs, Telegram bot/webhook secrets,
  `DEMO_SIGNER_ROOT_SECRET`, `AGENT_BRIDGE_AGENT_API_TOKEN`, optional OpenAI key,
  session worker URL, chain/RPC config, client/Mini App origins, question scan
  bounds, optional R2/D1 bindings, optional queues, and analytics salt.

No dead config key is proven by this sweep. The main report-only risk is
operator drift: example files include many optional bridge and deploy-helper
vars that must stay aligned with deploy-plan validation and route code.

## Contract Inventory

Solidity contracts:

- `contracts/SessionRegistry.sol`: session metadata, slugs, worker/config
  pointers, resource gates, and registry reads used by client and workers.
- `contracts/Surveys.sol`: survey/question/response storage pointers and
  survey read/write entry points.
- `contracts/SBTFactory.sol`: group/SBT deployment and lookup factory.
- `contracts/CustomSBT.sol`: group-scoped SBT minting/ownership logic.

Deployment scripts:

- `foundry/script/DeployAll.s.sol`
- `foundry/script/DeployLocal.s.sol`
- `foundry/script/DeploySBTFactory.s.sol`
- `foundry/script/DeploySessionRegistry.s.sol`

Tests:

- Unit, fuzz, and invariant tests under `foundry/test/`.

## Worker Route Inventory

Session worker routes are documented in `docs/session-cors-worker.md` and
implemented under `workers/sessionCorsWorker/`. Important route groups include:

- Auth: `/auth/nonce`, `/auth/login`, authenticated route validation.
- Storage: `/storage/upload`, `/storage/read`, `/storage/list`, and compatible
  Arweave upload routes.
- Admin: config, secrets, origins, health, and recovery paths.
- Execution: AI, transcription, fetch, faucet, sponsored bundle, and deploy
  helper paths.

Deploy-helper routes in `workers/deploy-helper/worker.js` include:

- `GET|POST /admin/origins`
- `POST /account`
- `POST /deploy`

Agent bridge routes are cataloged in `workers/agentBridgeWorker/agentApiCatalog.mjs`
and the Telegram Mini App source. They are private to the full dev repo and are
stripped from public releases.

## Trust Model Summary

The session worker is the trust boundary for worker-held secrets, session
storage routes, AI/transcription proxying, faucet operations, and admin config.
`docs/adr/0002-worker-auth-revalidation.md` reduces stale-token exposure with
4-hour `jti` login tokens backed by KV markers.
`docs/adr/0004-worker-auth-consistency-risk-acceptance.md` explicitly accepts
the remaining cross-isolate KV consistency limits for nonce redemption and rate
limits. Worker envelope storage and group behavior are documented in
`docs/session-cors-worker.md`.

## Follow-Ups

- Dependency update lane for root/client/session-worker advisories.
- Decide whether to add dependency-update and license tooling.
- Add tuned secret scanning with a checked allowlist.
- Decide whether nonce/rate-limit abuse observability should become a product
  surface before the next external audit.
- Add a lockfile or an explicit audit policy for `workers/agentBridgeWorker/`.
