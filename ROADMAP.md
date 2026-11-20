# Roadmap

Context Engine has its core deliberation, SBT, worker, encryption, and deployment workflows in place. The roadmap below focuses on scale, operator polish, agent access, and maintainability.

## Recently Completed Foundations

- **Public release hygiene**: the public release flow now includes strip/surface checks, PII scanning, branch push allowlisting, and split CI jobs for wiring, workers, contracts, client coverage, and root/node tests.
- **Session setup**: `/new` is one page. A new draft starts on a Session Worker on Cloudflare, with unencrypted answers that the session's signed-in members see, and each option is checked against the session mode rules as you choose it.
- **Chipotle runtime**: supported sessions use worker-mediated Chipotle execution for Lit key release.
- **Client modernization baseline**: the client is on React 18 and TypeScript 5.8, with production component surfaces moved to TSX and a growing set of helper-level tests.
- **Protected SBT mint modes**: SBT contracts now expose explicit mint modes so protected password, group-signature, and invite-signature flows do not fall through to public `claim()` minting.
- **Worker auth coordination and revocation**: the mandatory Session coordinator serializes nonce consumption and route counters across isolates, while server-managed authorization epochs and current-policy revalidation invalidate stale permissions after config or gate changes.
- **Agent access**: Session Workers serve a scoped `/api/agent/*` HTTP contract
  with scoped credentials and Session Wrapped. The MCP server lets a local agent
  take part as its own participant, and an agent given only a public session's
  link can draft answers for a person to review.
- **Voice interviews**: a voice interviewer asks a session's questions and drafts answers the person reviews before submitting.
- **Results views and the Session Agent**: Results include a report, a debate atlas and a risk matrix, and a Session Agent answers questions about them.
- **Names, groups and backups on Session Workers**: passkey sign-in, groups joined by link or code, per-session user-names and admin backups.
- **Group recording**: a breakout discussion recorded on one phone becomes draft questions and context.

## Current Engineering Priorities

- **Scaling**: current public/on-chain defaults target hundreds to low thousands of users per session; larger deployments use the planned scaling profiles and architecture variations.
- **Runtime decomposition**: large orchestration surfaces such as `AppShell.tsx`, `SessionWizard.tsx`, and the survey runtime still need decomposition. Shrink top-level coordination state, clarify module boundaries, and keep behavior covered by focused tests as it moves into typed submodules.
- **Chipotle operational polish**: continue hardening worker-mediated Lit provisioning, status reporting, recovery paths, and deployment documentation around the supported Chipotle model.
- **Frontend/toolchain modernization**: continue tightening the Vite/Jest/ESLint toolchain after the React 18 and TypeScript baselines, consolidate SCSS, and reduce remaining warning noise.
- **Supply-chain maintenance**: resolve the blocked wallet-stack upgrade, group routine dependency updates, and keep the npm audit disposition ledger current.
- **Worker auth operations**: continue expanding coordinator telemetry, compromise-response guidance, and concurrency regression coverage around the implemented nonce, rate-limit, authorization-epoch, and current-policy controls.
- **At-rest secret hardening**: browser passkey wallet storage uses WebAuthn PRF-backed wrapping, and Worker KV secret fields use a versioned AES-GCM envelope. Remaining work covers encryption-key continuity, recovery, and migration procedures.

## In Progress

- **Agent-first use**: agents take part through MCP and Agent HTTP today, read a private session from its group's link, and can give their person a sign-in link to the account they used where the session's admins allow it. Still open: an agent signing in on the website itself. Canonical handoffs for settings, SBT, decrypt and storage actions also remain. The [Session Worker Agent HTTP README](workers/sessionCorsWorker/agent/README.md) describes the routes.
- **Voice-only use**: spoken interviews have shipped; driving the whole site by voice has not.
- **Documents and context**: context cards, the document library and the debate atlas have shipped; knowledge maps have not.
- **Storage options**: Cloudflare storage sits beside Arweave, with optional R2; IPFS has not shipped.
- **Turnkey deployment**: a Deploy to Cloudflare template and a deploy helper create a session's Worker; bundles for Arweave, Lit, EVM gas and AI access have not shipped.

## Future Development

Longer-term product directions include:

- AI Lab Whistleblower tools with zero-knowledge proofs.
- Private evaluation of encrypted predictions.
- Group-specific and group-private AI model training spaces.
- Enhanced privacy features using ZK-SNARKs.
- Integration with additional AI APIs.

## Contributing

For contribution workflow and repo expectations, see [CONTRIBUTING.md](CONTRIBUTING.md).
