# Context Engine

![License: MPL-2.0](https://img.shields.io/badge/License-MPL--2.0-blue.svg)

<p align="center">
  <img src="client/src/assets/img/readme-header.png" alt="Context Engine interface showing a survey card asking whether humans and agents need better tools for debate, negotiation, and sensemaking, with Agree selected." />
</p>

**Live demo:** [contextengine.sh](https://contextengine.sh)

Context Engine is a toolkit for AI-enhanced deliberation, decision-making, and negotiation in large groups. It supports public and private questions and responses, AI-assisted input and analysis, permanent records, and cryptographic access control. It allows for no-code deployment of [Soulbound Tokens](https://www.radicalxchange.org/wiki/social-identity/) for Groups. Designed for use cases such as public discourse, organizational decision-making, preference-related dataset creation, and turning stakeholder feedback into company-specific AI evaluations.

## Architecture At A Glance

<p align="center">
  <img src="client/src/assets/img/readme-architecture-deployment-modes.png" alt="Context Engine deployment diagram showing Web App and AI Agent access to shared sessions across Hosted and Fast, Trustless and Slower, and planned Company-Operated infrastructure modes." />
</p>

Context Engine separates how the web app is hosted from how each session establishes authority and stores data. **EVM and Arweave are profile-specific options, not baseline dependencies.** The current Hosted & Fast profile uses a per-session Cloudflare Worker and Cloudflare storage as its canonical backend, so it can run public or private sessions without an EVM transaction, RPC endpoint, gas, Arweave, or Lit. The Trustless & Slower profile deliberately opts into public EVM contracts and Arweave, with Lit required only when that encryption path is selected. The planned Company-Operated edition is intended to connect internal identity and key management, storage, networking, AI, and observability services, and can be entirely off-chain. For current profile requirements and publish behavior, see the [session creation guide](docs/session-creation-guide.md).

## Deployment Modes

| Mode | Availability | Infrastructure and setup |
| --- | --- | --- |
| **Hosted & Fast** | Available; default/recommended path after selection in `/new` | Public or private sessions use a per-session Cloudflare Worker and Cloudflare storage. Native setup uses a Cloudflare account/dashboard login and one AI-provider key; it does not ask for a Cloudflare API token. No EVM network or transaction, RPC endpoint, gas, Arweave, or Lit is required by default. |
| **Trustless & Slower** | Available; opt-in | Public or private sessions use Arweave plus an EVM registry and contracts. Setup requires an Arweave wallet/JWK, an EVM RPC URL and gas, and one AI-provider key; add Lit credentials only when Lit encryption is selected. |
| **Company-Operated** | Planned; not yet generally available | Existing hardware, private clouds, or internal networks connect through adapters for company identity and key management, storage, AI gateways, and observability. Public EVM and Arweave are not architectural requirements, so this mode can be entirely off-chain. |

[contextengine.sh](https://contextengine.sh) is the hosted public web interface, and the static client can also be self-hosted. The former `.xyz` address redirects to this canonical site. App hosting, public/private session access, and the session infrastructure profile are separate choices. Participants never need deployer API keys.

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
- [docs/public-client-config.md#netlify-static-deploy](docs/public-client-config.md#netlify-static-deploy) for Netlify/custom-domain static frontend deploys

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
- Export deliberation snapshots and consensus statistics as evaluation / preference datasets for AI benchmarking and training
- OpenAI, Anthropic, OpenRouter, and custom provider paths

### Agent and Telegram Access

- Optional Agent Bridge Worker with scoped `/api/agent/*` credentials and a
  machine-readable action catalog
- Optional Telegram bot and Mini App adapters over the same session boundaries
- Delegated membership, gate, storage, and chain authority rather than a second
  copy of canonical session state
- Setup and endpoint reference in
  [workers/agentBridgeWorker/README.md](workers/agentBridgeWorker/README.md)

### User and Deployer UX: Passkey Sign-On

- Users log in with a simple passkey / biometric flow (native PIN, fingerprint, or Face ID on phones)
- Login supplies a signing account for session identity; EVM-backed profiles can also use it as a chain account
- Hosted & Fast does not submit an EVM transaction, and its users do not need Ethereum, a wallet balance, or gas

### Deployer UX: Sponsored Bundles

- Setup requirements follow the selected profile: the default Cloudflare profile needs a Cloudflare account/dashboard login and one AI-provider key; a Cloudflare API token is used only by Agent Session Wrapped or the explicit legacy deploy-helper fallback
- Sponsored bundles and advanced configuration can supply Arweave, EVM/RPC, Lit, or other credentials only when the selected decentralized or encrypted profile needs them; planned company-operated adapters will connect internal services instead

## AI Discourse Corpus

The top-level [`ai-discourse-corpus/`](ai-discourse-corpus/) directory contains reusable JSON sub-corpuses curated from AI policy, safety, governance, science fiction, practitioner interviews, evaluation work, debates, and enriched social-media discussion. Rights for that directory are described separately in [ai-discourse-corpus/LICENSE.md](ai-discourse-corpus/LICENSE.md): no ownership is claimed over upstream source material, and project-authored annotations are dedicated under CC0.

## AI Opinions Benchmark

The top-level [`ai-discourse-bench/`](ai-discourse-bench/) package turns source-grounded question banks into repeated, polarity-reversed model runs and static Context Engine results reports. The client serves its bundled report index at [`/benchmarks`](http://localhost:3000/benchmarks), where each model is treated as one participant and the report exposes agreement, disagreement, repeat stability, opinion groups, and model-trait comparisons.

Bundled reports declare their publication status. Development previews are useful for inspecting the method and interface, but a released result additionally requires a reviewed question bank, the configured repeats for both original and reversed wording, and complete valid model coverage. See the [benchmark README](ai-discourse-bench/README.md) and [methodology](ai-discourse-bench/docs/methodology.md) for local-model, OpenRouter, question-bank, and release-gate details.

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
- Agent Bridge worker docs: [workers/agentBridgeWorker/README.md](workers/agentBridgeWorker/README.md)
- Session registry and gate model: [docs/session-registry.md](docs/session-registry.md)
- Scaling reference: [docs/scaling.md](docs/scaling.md)
- Public roadmap: [ROADMAP.md](ROADMAP.md)
- AI Opinions Benchmark: [ai-discourse-bench/README.md](ai-discourse-bench/README.md)

## Licensing

This repo is intentionally multi-license. The public open-source core is licensed under `MPL-2.0`. Files and directories with their own license notices remain under those notices, including MIT worker-side code, files with explicit MIT notices, and the CC0 project-authored annotations in [`ai-discourse-corpus/`](ai-discourse-corpus/). Third-party dependencies retain their own licenses. See [LICENSING.md](LICENSING.md) for the current boundary map and shared-file rules.

## Roadmap

Current priorities and future development directions live in [ROADMAP.md](ROADMAP.md).
