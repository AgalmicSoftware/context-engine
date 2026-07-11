# Context Engine

![License: MPL-2.0](https://img.shields.io/badge/License-MPL--2.0-blue.svg)

<p align="center">
  <img src="client/src/assets/img/readme-header.png" alt="Context Engine interface showing a survey card asking whether humans and agents need better tools for debate, negotiation, and sensemaking, with Agree selected." />
</p>

**Live demo:** [contextengine.sh](https://contextengine.sh)

Context Engine is a decision-memory system for groups, organizations, and AI agents.

It helps teams capture the context behind important decisions: assumptions, predictions, tradeoffs, confidence levels, disagreement, and outcomes. Instead of losing that context across meetings, chats, documents, and slide decks, Context Engine turns it into a structured record that humans and AI agents can revisit later.

<p align="center">
  <img src="client/src/assets/img/readme-architecture-deployment-modes.png" alt="Context Engine deployment modes diagram showing Web App and AI Agent access to a shared session, then Hosted and Fast, Trustless and Slower, and company-operated infrastructure options with their setup credentials." />
</p>

Context Engine is designed to keep workflows and product-facing capability boundaries consistent while deployment adapters determine where identity, keys, compute, coordination, and records live. Current public/hosted profiles combine supported managed services and public networks; future company-operated profiles are intended to connect existing organizational infrastructure without changing session and survey semantics. The hosted public deployment currently uses Cloudflare Workers, Cloudflare or Arweave storage, optional Lit/Chipotle encryption paths, and EVM contracts. For the concrete runtime topology, see [docs/architecture-overview.md](docs/architecture-overview.md).

## Deployment Modes

- **Hosted public app — available:** use Context Engine at [contextengine.xyz](https://contextengine.xyz).
- **Operator-managed public deployment — available:** host the static client, operate the Cloudflare worker in your account, and connect it to supported Arweave and public-EVM services.
- **Company-operated edition — planned, with design work underway:** planning and adapter design are in progress for a packaged edition that runs on existing company hardware, on-premises environments, and private clouds. It will be made available after the adapter, packaging, security, and conformance work is complete, with support for connecting approved storage, identity and access, key-management, AI, and observability services. It is not yet generally available.

## Why Context Engine?

Organizations make high-stakes decisions with incomplete memory.

The final decision may be documented, but the reasoning behind it often disappears:

- What did people believe before the outcome was known?
- Which assumptions mattered most?
- Where did people disagree?
- Who was confident, uncertain, or dissenting?
- Which predictions later proved accurate?
- What should future teams and AI agents learn from the decision?

Context Engine captures this missing layer of organizational context. It records beliefs, predictions, disagreement, and confidence in a format that can later be searched, summarized, compared, and exported.

## Example: Strategy Decision Review

Before a major roadmap decision, a team creates a private Context Engine session.

Participants submit expected outcomes, key assumptions, risks and failure modes, confidence levels, and dissenting views. Responses can stay private during collection, then be reviewed later alongside the actual outcome.

The result is a decision record that captures not only what the organization decided, but what it believed at the time.

## Quick Start

### Prerequisites
- Root scripts, worker bundling, contract tooling, and client workflows: Node.js 20.19+ or 22.12+ with npm 10
- Foundry (`forge` / `anvil`) for local-chain and root contract test workflows

The client install contract is tracked via `client/.npmrc`
(`legacy-peer-deps=true`), so no manual CLI flag is needed even though
`react-scripts@4.0.3`'s optional TypeScript peer still conflicts with
`@lit-protocol/contracts@0.9.1`'s strict peer requirement.

### Clone and Install

```bash
git clone https://github.com/AgalmicSoftware/context-engine.git
cd context-engine

nvm use 20
npm install

cd client
nvm use 20
npm install
npm run dev
```

The React app runs on `http://localhost:3000`.

For testing, run modes, and deeper setup:
- [docs/testing.md](docs/testing.md)
- [docs/run-modes.md](docs/run-modes.md)
- [docs/e2e-setup.md](docs/e2e-setup.md)
- [docs/session-creation-guide.md](docs/session-creation-guide.md)
- [docs/public-client-config.md#static-frontend-deploy](docs/public-client-config.md#static-frontend-deploy) for Netlify/custom-domain static frontend deploys

## Core Features

### Decision Memory
- Multiple question types: freeform, multiple choice, binary, and rating scales
- Optional encryption of responses and results
- Optional decentralized and permanent response storage in the public Arweave-backed profile
- Statistical / AI analysis and visualization of results
- Export results as `.json`, `.csv`, `.pdf`

### Private and Organizational Sessions
- Public or private questions, responses, and results
- Optional encryption of responses and results
- Supports both public-record workflows and more private organizational use cases
- Architecture and scaling docs outline more private/local deployment paths for environments that need tighter infrastructure control

### AI-Assisted Sensemaking
- Question generation from file, URL, or text input
- Voice-to-text input
- Summaries and analysis of survey results and response clusters
- OpenAI, Anthropic, OpenRouter, and custom provider paths

### User and Deployer UX: Passkey Sign-On
- Users log in with a simple passkey / biometric flow (native PIN, fingerprint, or Face ID on phones)
- Login flow generates or handles an Ethereum account, which can be used easily with cryptography features
   - Users do not need to know anything about Ethereum or crypto (or take any additional steps) to use the app

### Group Access Control
- No-code creation of [Soulbound Tokens for Groups](https://www.radicalxchange.org/wiki/social-identity/) (SBTs)
- Session and resource gating based on SBT ownership
- Public minting, password-protected minting, time-limited minting, limited-number minting, and auto-claim URLs
- Role-based burn authorization (admin, minter, both, neither)

## Deployment Modes

| Mode | Best for | Visibility | Notes |
| --- | --- | --- | --- |
| Public deliberation | Civic discourse, public AI policy, open communities | Public or selectively encrypted | Default public web app, durable records, AI analysis |
| Private organization | Companies, labs, nonprofits, internal strategy, risk review | Private or selectively shared | Passkey login, encrypted responses, and documented private/local deployment directions |
| Event / conference | Retreats, workshops, conferences, pop-up communities | Participant-only or public summary | Gated sessions, exports, AI summaries |
| Research / dataset creation | Preference datasets, discourse corpuses, evaluation studies | Configurable | Structured exports and reusable records |

### Deployer UX: Sponsored Bundles
- Deployers can use and set up sponsored bundles of API keys (for storage, EVM transactions, encryption network, AI API)
- Sensitive and organizational deployments can plug in existing AI keys and combine currently supported Cloudflare, Arweave, and public-EVM components; broader company-operated infrastructure adapters are planned

## AI Discourse Corpus

The top-level [`ai-discourse-corpus/`](ai-discourse-corpus/) directory contains reusable JSON sub-corpuses curated from AI policy, safety, governance, science fiction, practitioner interviews, evaluation work, debates, and enriched social-media discussion. Rights for that directory are described separately in [ai-discourse-corpus/LICENSE.md](ai-discourse-corpus/LICENSE.md): no ownership is claimed over upstream source material, and project-authored annotations are dedicated under CC0.

## Scaling

The default public deployment supports hundreds to low thousands of concurrent participants per session. For larger deployments, see [docs/scaling.md](docs/scaling.md).

## Technical Architecture

Context Engine uses cryptographic infrastructure for identity, access control, encryption, timestamps, and optional data permanence.

The default public deployment combines a React SPA, EVM contracts, Arweave, Lit Protocol, and Cloudflare workers. The broader architecture also outlines more private/local deployment paths for organizations that need tighter control over storage, workers, or encryption backends. For most users, those details stay behind a normal web interface with passkey login.

For a deeper system map, see [ARCHITECTURE.md](ARCHITECTURE.md), [docs/session-cors-worker.md](docs/session-cors-worker.md), and [docs/scaling.md](docs/scaling.md).

## Documentation

- Project framing: [whitepaper/whitepaper.md](whitepaper/whitepaper.md)
- System design, data flows, and file map: [ARCHITECTURE.md](ARCHITECTURE.md)
- Docs index: [docs/README.md](docs/README.md)
- Agent bootstrap and PRD map: [docs/ai-agent-bootstrap.md](docs/ai-agent-bootstrap.md)
- User guide / end-to-end session setup: [docs/session-creation-guide.md](docs/session-creation-guide.md)
- Public posts authoring: [docs/posts.md](docs/posts.md)
- Testing guide: [docs/testing.md](docs/testing.md)
- Run modes: [docs/run-modes.md](docs/run-modes.md)
- E2E workflow guide: [docs/e2e-setup.md](docs/e2e-setup.md)
- Public client config, current defaults, and static deploy notes: [docs/public-client-config.md](docs/public-client-config.md)
- PATH / RPC behavior: [docs/path-rpc.md](docs/path-rpc.md)
- Cloudflare worker docs: [docs/session-cors-worker.md](docs/session-cors-worker.md)
- Session registry and gate model: [docs/session-registry.md](docs/session-registry.md)
- Scaling reference: [docs/scaling.md](docs/scaling.md)
- Public roadmap: [ROADMAP.md](ROADMAP.md)

## Licensing

This repo is intentionally multi-license. The public open-source core is licensed under `MPL-2.0`. Files and directories with their own license notices remain under those notices, including MIT worker-side code, files with explicit MIT notices, and the CC0 project-authored annotations in [`ai-discourse-corpus/`](ai-discourse-corpus/). Third-party dependencies retain their own licenses. See [LICENSING.md](LICENSING.md) for the current boundary map and shared-file rules.

## Roadmap

Current priorities and future development directions live in [ROADMAP.md](ROADMAP.md).
