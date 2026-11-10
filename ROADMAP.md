# Roadmap

Context Engine has its core deliberation, SBT, worker, encryption, and deployment workflows in place. The roadmap below focuses on scale, operator polish, agent access, and maintainability.

## Recently Completed Foundations

- **Public release hygiene**: the public release flow now includes strip/surface checks, PII scanning, branch push allowlisting, and split CI jobs for wiring, workers, contracts, client coverage, and root/node tests.
- **Session setup**: `/new` is one page. A new draft starts on a Session Worker on Cloudflare with public results and unencrypted answers, and each option is checked against the session mode rules as you choose it.
- **Chipotle runtime**: supported sessions use worker-mediated Chipotle execution for Lit key release.
- **Client modernization baseline**: the client is on React 18 and TypeScript 5.8, with production component surfaces moved to TSX and a growing set of helper-level tests.
- **Protected SBT mint modes**: SBT contracts now expose explicit mint modes so protected password, group-signature, and invite-signature flows do not fall through to public `claim()` minting.
- **Worker auth coordination and revocation**: the mandatory Session coordinator serializes nonce consumption and route counters across isolates, while server-managed authorization epochs and current-policy revalidation invalidate stale permissions after config or gate changes.
- **Agent access foundation**: Session Workers can serve a scoped `/api/agent/*`
  HTTP contract, scoped credentials, agent token browser login, and Session
  Wrapped, and the MCP server lets a local agent take part as its own participant.

## Current Engineering Priorities

- **Scaling**: current public/on-chain defaults target hundreds to low thousands of users per session; larger deployments use the planned scaling profiles and architecture variations.
- **Runtime decomposition**: large orchestration surfaces such as `AppShell.tsx`, `SessionWizard.tsx`, and the survey runtime still need decomposition. Shrink top-level coordination state, clarify module boundaries, and keep behavior covered by focused tests as it moves into typed submodules.
- **Chipotle operational polish**: continue hardening worker-mediated Lit provisioning, status reporting, recovery paths, and deployment documentation around the supported Chipotle model.
- **Frontend/toolchain modernization**: continue tightening the Vite/Jest/ESLint toolchain after the React 18 and TypeScript baselines, consolidate SCSS, and reduce remaining warning noise.
- **Supply-chain maintenance**: resolve the blocked wallet-stack upgrade, group routine dependency updates, and keep the npm audit disposition ledger current.
- **Worker auth operations**: continue expanding coordinator telemetry, compromise-response guidance, and concurrency regression coverage around the implemented nonce, rate-limit, authorization-epoch, and current-policy controls.
- **At-rest secret hardening**: browser passkey wallet storage uses WebAuthn PRF-backed wrapping, and Worker KV secret fields use a versioned AES-GCM envelope. Remaining work covers encryption-key continuity, recovery, and migration procedures.

## AI Agent Interface

Agent HTTP is implemented in the Session Worker, and the MCP server covers local
agents. Remaining work is to expand canonical handoffs for settings, SBT,
decrypt, and storage actions, and harden operator setup and lifecycle
verification. The [Session Worker Agent HTTP README](workers/sessionCorsWorker/agent/README.md)
describes the routes.

## Future Development

Longer-term product directions include:

- AI Lab Whistleblower tools with zero-knowledge proofs.
- Private evaluation of encrypted predictions.
- Group-specific and group-private AI model training spaces.
- Enhanced privacy features using ZK-SNARKs.
- Integration with additional AI APIs.

## Contributing

For contribution workflow and repo expectations, see [CONTRIBUTING.md](CONTRIBUTING.md).
