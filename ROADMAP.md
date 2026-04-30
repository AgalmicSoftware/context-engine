# Roadmap

Context Engine has its core deliberation, SBT, worker, encryption, and deployment workflows in place. The roadmap below focuses on scale, operator polish, agent access, and maintainability.

## Recently Completed Foundations

- **Scaling**: the initial on-chain mode may only support hundreds of users per session; scaling to hundreds of thousands will require architectural optimizations and variations which are already planned.
- **God component decomposition**: all production components are now TSX; `MainSite.tsx` is still a ~6,294 line orchestrator that needs runtime decomposition (PRD 449); `SessionWizard.tsx` is still a 5,000+ line orchestrator that needs further decomposition.
- **Lit Protocol Naga-era runtime → Chipotle re-platform**: CE still ships a legacy Naga-shaped Lit integration even though Naga sunset on April 1, 2026 and Chipotle is now GA. Moving onto the supported stack is a re-platform from SDK/auth-context/PaymentManager/network selection to Chipotle's REST/API-key/account/group model, not a simple dependency bump.
- **Frontend modernization**: migrate remaining class components to functional React, upgrade React 17 → 18 with Vite, and consolidate SCSS into a standardized design system.
- **Worker auth trust-boundary hardening**: browser login to the session worker still needs stricter trusted-origin / SIWE audience binding so off-origin or originless token redemption is not possible.


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
