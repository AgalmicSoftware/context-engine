# Roadmap

Context Engine has its core deliberation, SBT, worker, encryption, and deployment workflows in place. The roadmap below focuses on scale, operator polish, agent access, and maintainability.

## Recently Completed Foundations

- **Public release hygiene**: the public release flow now includes strip/surface checks, PII scanning, branch push allowlisting, and split CI jobs for wiring, workers, contracts, client coverage, and root/node tests.
- **Session setup entry flow**: new session creation starts with a mode choice before revealing the existing advanced setup flow, and mode presets prefill storage, AI, worker, and chain defaults.
- **Chipotle runtime cutover**: supported sessions now use worker-mediated Chipotle execution, and new session flows no longer invent legacy hosted Lit defaults.
- **Client modernization baseline**: the client is on React 18 and TypeScript 5.8, with production component surfaces moved to TSX and a growing set of helper-level tests.
- **Protected SBT mint modes**: SBT contracts now expose explicit mint modes so protected password, group-signature, and invite-signature flows do not fall through to public `claim()` minting.

## Current Engineering Priorities

- **Scaling**: current public/on-chain defaults target hundreds to low thousands of users per session; larger deployments use the planned scaling profiles and architecture variations.
- **Runtime decomposition**: large orchestration surfaces such as `AppShell.tsx`, `SessionWizard.tsx`, and the survey runtime still deserve continued decomposition, but they now delegate substantial behavior into typed, tested route/helper/submodules rather than standing as unstructured monoliths. The next work should shrink top-level coordination state, clarify module boundaries, and keep behavior covered by focused tests as it moves.
- **Chipotle operational polish**: continue hardening worker-mediated Lit provisioning, status reporting, recovery paths, and deployment documentation around the supported Chipotle model.
- **Frontend/toolchain modernization**: continue tightening the Vite/Jest/ESLint toolchain after the React 18 and TypeScript baselines, consolidate SCSS, and reduce remaining warning noise.
- **Supply-chain maintenance**: resolve the blocked wallet-stack upgrade, group routine dependency updates, and keep the npm audit disposition ledger current.
- **Worker auth trust-boundary hardening**: browser login to the session worker still needs durable nonce/rate-limit state plus scope revalidation / revocation boundaries so auth stays correct under concurrency and gate changes.
- **At-rest secret hardening**: browser passkey wallet storage uses WebAuthn PRF-backed wrapping; worker KV secret-field encryption still needs explicit key-management and migration decisions before implementation.

## AI Agent Interface

A near-term priority is making Context Engine usable by AI agents, not just humans in a browser. The goal is to let people interact with sessions, answer surveys, and manage SBTs through their own AI assistants and custom tool clients. This includes exposing a machine-readable API layer, a tool-access server, and workflow definitions that agents can discover and invoke autonomously.

## Future Development

Longer-term product directions include:

- AI Lab Whistleblower tools with zero-knowledge proofs.
- Private evaluation of encrypted predictions.
- Group-specific and group-private AI model training spaces.
- Enhanced privacy features using ZK-SNARKs.
- Integration with additional AI APIs.

## Contributing

For contribution workflow and repo expectations, see [CONTRIBUTING.md](CONTRIBUTING.md).
