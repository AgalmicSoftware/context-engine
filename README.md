# Context Engine

![License: MPL-2.0](https://img.shields.io/badge/License-MPL--2.0-blue.svg)

<p align="center">
  <img src="client/src/assets/img/readme-header.png" alt="Context Engine interface showing a survey card asking whether humans and agents need better tools for debate, negotiation, and sensemaking, with Agree selected." />
</p>

**Live demo:** [contextengine.xyz](https://contextengine.xyz)

Context Engine is a toolkit for AI-enhanced deliberation, decision-making, and negotiation in large groups. It supports public and private questions and responses, AI-assisted input and analysis, permanent records, and cryptographic access control. It allows for no-code deployment of [Soulbound Tokens](https://www.radicalxchange.org/wiki/social-identity/) for Groups. Designed for use cases such as public discourse, organizational decision-making, and preference-related dataset creation.

## Architecture At A Glance

<p align="center">
  <img src="client/src/assets/img/readme-architecture-deployment-modes.png" alt="Context Engine deployment modes diagram showing Web App and AI Agent access to a shared session, then Hosted and Fast, Trustless and Slower, and company-operated infrastructure options with their setup credentials." />
</p>

Context Engine is designed to keep workflows and product-facing capability boundaries consistent while deployment adapters determine where identity, keys, compute, coordination, and records live. Current public/hosted profiles combine supported managed services and public networks; future company-operated profiles are intended to connect existing organizational infrastructure without changing session and survey semantics. The hosted public deployment currently uses Cloudflare Workers, Cloudflare or Arweave storage, optional Lit/Chipotle encryption paths, and EVM contracts. For the concrete runtime topology, see [docs/architecture-overview.md](docs/architecture-overview.md).

## Deployment Modes

- **Hosted public app — available:** use Context Engine at [contextengine.xyz](https://contextengine.xyz).
- **Operator-managed public deployment — available:** host the static client, operate the Cloudflare worker in your account, and connect it to supported Arweave and public-EVM services.
- **Company-operated edition — planned, with design work underway:** planning and adapter design are in progress for a packaged edition that runs on existing company hardware, on-premises environments, and private clouds. It will be made available after the adapter, packaging, security, and conformance work is complete, with support for connecting approved storage, identity and access, key-management, AI, and observability services. It is not yet generally available.

## Quick Start

### Prerequisites

- Root scripts, worker bundling, contract tooling, and client workflows: Node.js 20.19+ or 22.12+ with npm 10
- Foundry (`forge` / `anvil`) for local-chain and root contract test workflows

### Clone and Install

```bash
git clone https://github.com/AgalmicSoftware/context-engine.git
cd context-engine

nvm use 20
npm install
npm --prefix client install
npm --prefix client run dev
```

The React app runs on `http://localhost:3000`.

For testing, run modes, and deeper setup:
- [docs/testing.md](docs/testing.md)
- [docs/run-modes.md](docs/run-modes.md)
- [docs/session-creation-guide.md](docs/session-creation-guide.md)
- [docs/public-client-config.md#static-frontend-deploy](docs/public-client-config.md#static-frontend-deploy) for Netlify/custom-domain static frontend deploys

## Features

### Survey and Response Management
- Multiple question types: freeform, multiple choice, binary, and rating scales
- Optional encryption of responses and results
- Optional decentralized and permanent response storage in the public Arweave-backed profile
- Statistical / AI analysis and visualization of results
- Export results as `.json`, `.csv`, `.pdf`

### SBT-Gated Groups
- No-code creation of Soulbound tokens ([SBTs](https://www.radicalxchange.org/wiki/social-identity/)) for groups
- Public minting, password-protected minting, time-limited minting, limited-number minting, and auto-claim URLs
- Role-based burn authorization (admin, minter, both, neither)
- Session and resource gating based on SBT ownership (encrypted titles, information, docURLs, tags)

### AI-Assisted Tooling
- Voice-to-text input
- Question generation from file, URL, or text input
- Summaries and analysis of survey results and response clusters
- OpenAI, Anthropic, OpenRouter, and custom provider paths

### User and Deployer UX: Passkey Sign-On

- Users log in with a simple passkey / biometric flow (native PIN, fingerprint, or Face ID on phones)
- Login flow generates or handles an Ethereum account, which can be used easily with cryptography features
- Users do not need to know anything about Ethereum or crypto to use the app

### Deployer UX: Sponsored Bundles

- Deployers can use and set up sponsored bundles of API keys (for storage, EVM transactions, encryption network, AI API)
- Sensitive and organizational deployments can plug in existing AI keys and combine currently supported Cloudflare, Arweave, and public-EVM components; broader company-operated infrastructure adapters are planned

## AI Discourse Corpus

The top-level [`ai-discourse-corpus/`](ai-discourse-corpus/) directory contains reusable JSON sub-corpuses curated from AI policy, safety, governance, science fiction, practitioner interviews, evaluation work, debates, and enriched social-media discussion. Rights for that directory are described separately in [ai-discourse-corpus/LICENSE.md](ai-discourse-corpus/LICENSE.md): no ownership is claimed over upstream source material, and project-authored annotations are dedicated under CC0.

## Scaling

The default public deployment supports hundreds to low thousands of concurrent participants per session. For larger deployments, see [docs/scaling.md](docs/scaling.md).

## Documentation

- Project framing: [whitepaper/whitepaper.md](whitepaper/whitepaper.md)
- System design, data flows, and file map: [ARCHITECTURE.md](ARCHITECTURE.md)
- Docs index: [docs/README.md](docs/README.md)
- User guide / end-to-end session setup: [docs/session-creation-guide.md](docs/session-creation-guide.md)
- Public posts authoring: [docs/posts.md](docs/posts.md)
- Testing guide: [docs/testing.md](docs/testing.md)
- Run modes: [docs/run-modes.md](docs/run-modes.md)
- Public client config and current defaults: [docs/public-client-config.md](docs/public-client-config.md)
- PATH / RPC behavior: [docs/path-rpc.md](docs/path-rpc.md)
- Cloudflare worker docs: [docs/session-cors-worker.md](docs/session-cors-worker.md)
- Session registry and gate model: [docs/session-registry.md](docs/session-registry.md)
- Scaling reference: [docs/scaling.md](docs/scaling.md)
- Public roadmap: [ROADMAP.md](ROADMAP.md)

## Licensing

This repo is intentionally multi-license. The public open-source core is licensed under `MPL-2.0`. Files and directories with their own license notices remain under those notices, including MIT worker-side code, files with explicit MIT notices, and the CC0 project-authored annotations in [`ai-discourse-corpus/`](ai-discourse-corpus/). Third-party dependencies retain their own licenses. See [LICENSING.md](LICENSING.md) for the current boundary map and shared-file rules.

## Roadmap

Current priorities and future development directions live in [ROADMAP.md](ROADMAP.md).
