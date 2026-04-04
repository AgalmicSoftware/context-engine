# Roadmap

Context Engine has its core deliberation, SBT, worker, encryption, and deployment workflows in place. The roadmap below focuses on scale, operator polish, agent access, and maintainability.

## Recently Completed Foundations

- **Scaling**: the initial on-chain mode may only support hundreds of users per session; scaling to hundreds of thousands will require architectural optimizations and variations which are already planned.
- **God component decomposition**: `MainSite.jsx`, `SurveyTool.jsx`, and `SessionWizard.jsx` still carry 5,000–15,000+ line responsibilities and need to be split into smaller, more maintainable units.
- **Lit Protocol `naga-dev` → `chipotle`/v3 migration**: the current Lit integration still depends on legacy network infrastructure and needs to move onto the supported stack. Lit is currently deploying their next-generation stack.
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
