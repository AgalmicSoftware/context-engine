# Roadmap

Context Engine is a beta release, with core workflows in place and a clear set of improvements ahead.

## Known Refactors & Code Quality

- **Scaling**: the initial on-chain mode may only support hundreds of users per session; scaling to hundreds of thousands will require architectural optimizations and variations which are already planned.
- **God component decomposition**: `MainSite.jsx` is now the last remaining production JSX shell, and controller extraction has reduced it from ~11,400 lines to ~6,274; `SessionWizard.tsx` is still a 5,000+ line orchestrator that needs further decomposition.
- **Lit Protocol Naga-era runtime → Chipotle re-platform**: CE still ships a legacy Naga-shaped Lit integration even though Naga sunset on April 1, 2026 and Chipotle is now GA. Moving onto the supported stack is a re-platform from SDK/auth-context/PaymentManager/network selection to Chipotle's REST/API-key/account/group model, not a simple dependency bump.
- **Frontend modernization**: migrate remaining class components to functional React, upgrade React 17 → 18 with Vite, and consolidate SCSS into a standardized design system.
- **Protected SBT mint-mode hardening**: SBT mint policy still needs an explicit on-chain mode model so protected group-password/signature collections cannot accidentally expose public `claim()` minting.
- **Worker auth trust-boundary hardening**: browser login to the session worker still needs durable nonce/rate-limit state plus scope revalidation / revocation boundaries so auth stays correct under concurrency and gate changes.
- **Browser secret-storage hardening**: SBT invite/recovery secrets should move to export-only defaults with optional encrypted local recovery instead of silent plaintext browser persistence.


## AI Agent Interface

A near-term priority is making Context Engine usable by AI agents — not just humans in a browser. The goal is to let people interact with sessions, answer surveys, and manage SBTs through their own AI assistants (Claude Code, OpenClaw instances, custom MCP clients, etc.). This includes exposing a machine-readable API layer, an MCP server for tool-based access, and skill definitions that agents can discover and invoke autonomously.

## Future Development

Longer-term product directions include:

- AI Lab Whistleblower tools with zero-knowledge proofs.
- Private evaluation of encrypted predictions.
- Group-specific and group-private AI model training spaces.
- Enhanced privacy features using ZK-SNARKs.
- Integration with additional AI APIs.

## Contributing

For contribution workflow and repo expectations, see [CONTRIBUTING.md](CONTRIBUTING.md).
