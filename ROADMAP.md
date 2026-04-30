# Roadmap

Context Engine has its core deliberation, SBT, worker, encryption, and deployment workflows in place. The roadmap below focuses on scale, operator polish, agent access, and maintainability.

## Recently Completed Foundations

- **Scaling**: the initial on-chain mode may only support hundreds of users per session; scaling to hundreds of thousands will require architectural optimizations and variations which are already planned.
- **God component decomposition**: all production components are now TSX; `MainSite.tsx` is still a ~6,294 line orchestrator that needs runtime decomposition (PRD 449); `SessionWizard.tsx` is still a 5,000+ line orchestrator that needs further decomposition.
- **Lit Protocol Naga-era runtime → Chipotle re-platform**: CE still ships a legacy Naga-shaped Lit integration even though Naga sunset on April 1, 2026 and Chipotle is now GA. Moving onto the supported stack is a re-platform from SDK/auth-context/PaymentManager/network selection to Chipotle's REST/API-key/account/group model, not a simple dependency bump.
- **Frontend modernization**: migrate remaining class components to functional React, upgrade React 17 → 18 with Vite, and consolidate SCSS into a standardized design system.
- **Worker auth trust-boundary hardening**: browser login to the session worker still needs stricter trusted-origin / SIWE audience binding so off-origin or originless token redemption is not possible.

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
