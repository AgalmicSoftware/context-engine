# Context Engine

![License: MPL-2.0](https://img.shields.io/badge/License-MPL--2.0-blue.svg)

<p align="center">
  <img src="docs/assets/readme-feature-rotation.gif" alt="Context Engine feature animation: a question card answered as agreement, freeform with voice input, rating, multiple choice, and quadratic allocation; Groups for private access and data, result filtering, and centralized or decentralized options; and Results previews for Opinion Map, Breakdown, and Analysis." />
  <br />
  <a href="docs/assets/readme-header-overview.png">View the complete still image</a>
</p>

**Live demo:** [contextengine.sh](https://contextengine.sh)

Context Engine is a toolkit for AI-enhanced deliberation, decision-making, and negotiation in large groups. It supports public and private questions and responses, AI-assisted input and analysis, permanent records, and cryptographic access control. It allows for no-code deployment of [Soulbound Tokens](https://www.radicalxchange.org/wiki/social-identity/) for Groups. Designed for use cases such as public discourse, organizational decision-making, preference-related dataset creation, and turning stakeholder feedback into company-specific AI evaluations.

## Architecture At A Glance

<p align="center">
  <img src="docs/assets/readme-architecture-session-worker-mcp.png" alt="Context Engine architecture showing fingerprint passkey web sign-in and agent access to Session Worker services, an Access, Network, Data, and AI icon legend, and connector lines to bordered Hosted and Fast, Trustless and Slower, and planned Company-Operated deployment modes." />
</p>

Hosting the website is a separate decision: use [contextengine.sh](https://contextengine.sh) or serve the static client yourself, but choose first, because your passkey account belongs to the site's domain. The session profile decides who controls access and where the data lives. `/new` starts on **Hosted & Fast** (labeled `Session Worker`), with public results and unencrypted answers until you change them. Your passkey account becomes the session admin: it signs requests, and the session's own Cloudflare Worker verifies them and applies its roles and groups. A signature is not a blockchain transaction, so no gas, RPC endpoint, Arweave, or Lit is needed unless you add on-chain Soulbound Token (SBT) rules or Lit encryption. Data lives in the Cloudflare account that deploys the Worker, using an API token, which also trusts the deploy helper's operator with the session's secrets, or the token-free dashboard setup. Worker encryption protects data in storage only; that account's operator and Cloudflare's runtime can still reach the decrypted content. **Trustless & Slower** (`On-chain registry` under `Runs on`) does send wallet transactions to public EVM contracts, which cost gas plus a creation fee, and still needs a Session Worker for services such as AI. The wallet that registers the session becomes its on-chain admin and sets the SBT rules for those services. Data lives permanently on Arweave, where anyone can download it. Anyone can also read it unless you lock it with Lit: a locked field is public only as ciphertext, and Lit releases its key after an on-chain SBT check, though the Worker operator and Lit administrators stay trusted. Which wallet answered which question stays public either way. The planned **Company-Operated** edition will use an organization's own identity, key management, and storage to control access and hold data, and it will be able to run entirely off-chain. For current profile requirements and publish behavior, see the [session creation guide](docs/session-creation-guide.md).

## Deployment Modes

| Mode | Availability | Infrastructure and setup |
| --- | --- | --- |
| **Hosted & Fast** | Available; where `/new` starts | A per-session Cloudflare Worker and Cloudflare storage. Results start public with unencrypted answers; choosing encryption or another results visibility keeps them private. Setup needs a Cloudflare account, an AI-provider key (OpenAI by default), and either a Cloudflare API token or the token-free dashboard setup. No EVM network or transaction, RPC endpoint, gas, Arweave, or Lit is required by default. |
| **Trustless & Slower** | Available; opt-in under `Runs on` | Arweave plus an EVM registry and contracts. Data is publicly readable unless locked with Lit encryption. Setup requires a Session Worker, an Arweave wallet/JWK, an EVM RPC URL, a wallet with gas and the 0.0001 ETH creation fee, and an AI-provider key (OpenAI by default); add Lit credentials only when Lit encryption is selected. |
| **Company-Operated** | Planned; not yet generally available | Existing hardware, private clouds, or internal networks will connect through adapters for company identity and key management, storage, AI gateways, and observability. Public EVM and Arweave will not be required, so this mode will be able to run entirely off-chain. |

The former `.xyz` address redirects to [contextengine.sh](https://contextengine.sh). Participants never need deployer API keys.

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
- Multiple question types: freeform, single- and multi-select, binary, rating scales, and quadratic allocation
- Optional encryption of responses and results
- Optional decentralized and permanent response storage in the public Arweave-backed profile
- Statistical / AI analysis and visualization of results
- Export results as `.json`, `.csv`, `.html`, `.pdf`

### Groups
- Cloudflare Groups for membership, invitations, and response filtering in Worker-backed sessions
- Optional no-code creation of Soulbound tokens ([SBTs](https://www.radicalxchange.org/wiki/social-identity/)) for chain-backed groups
- Public minting, password-protected minting, time-limited minting, limited-number minting, and auto-claim URLs
- Role-based burn authorization (admin, minter, both, neither)
- Session and resource gating based on SBT ownership (encrypted titles, information, docURLs, tags)

### AI-Assisted Tooling
- Voice-to-text input
- Question generation from file, URL, or text input
- Summaries and analysis of survey results and response clusters
- Optional interview research metadata for comparing AI draft predictions with reviewed submitted responses; see [the interview research diagrams](docs/assets/interview-research/README.md) and [schema notes](docs/session-interview-research.md)
- Export deliberation snapshots and consensus statistics as evaluation / preference datasets for AI benchmarking and training
- OpenAI, Anthropic, OpenRouter, and custom provider paths

### Agent Access

- MCP server for AI agents that take part in hosted or unencrypted registry sessions as their own
  participants, answering, adding statements and claiming session SBTs with
  their own keys. Run the latest published package with `npx -y --prefer-online @agalmic/contextengine@latest`
  from an MCP host: [mcp/README.md](mcp/README.md). Pin an exact published version
  for reproducible runs. This installs a local tool
  server; it does not deploy or upgrade the web app or Session Workers.
- Optional Session Agent HTTP with scoped `/api/agent/*` credentials and
  versioned runtime instructions
- Agent token login in the browser, one-time invites, and Session Wrapped over HTTPS
- Delegated membership, gate, storage, and chain authority rather than a second
  copy of canonical session state
- Setup and endpoint reference in
  [workers/sessionCorsWorker/agent/README.md](workers/sessionCorsWorker/agent/README.md)

### User and Deployer UX: Passkey Sign-On

- Users log in with a simple passkey / biometric flow (native PIN, fingerprint, or Face ID on phones)
- Login supplies a signing account for session identity; EVM-backed profiles can also use it as a chain account
- By default, Hosted & Fast does not submit an EVM transaction, and its users do not need Ethereum, a wallet balance, or gas

### Deployer UX: Sponsored Bundles

- Setup requirements follow the selected profile: the default Cloudflare profile needs a Cloudflare account, an AI-provider key (OpenAI by default), and either a Cloudflare API token or the token-free dashboard setup
- Sponsored bundles and advanced configuration can supply Arweave, EVM/RPC, Lit, or other credentials only when the selected decentralized or encrypted profile needs them; planned company-operated adapters will connect internal services instead

## AI Discourse Corpus

The top-level [`ai-discourse-corpus/`](ai-discourse-corpus/) directory contains reusable JSON sub-corpuses curated from AI policy, safety, governance, science fiction, practitioner interviews, evaluation work, debates, and enriched social-media discussion. Rights for that directory are described separately in [ai-discourse-corpus/LICENSE.md](ai-discourse-corpus/LICENSE.md): no ownership is claimed over upstream source material, and project-authored annotations are dedicated under CC0.

## AI Opinions Benchmark

The top-level [`ai-discourse-bench/`](ai-discourse-bench/) package turns source-grounded question banks into repeated, polarity-reversed model runs and static Context Engine results reports. The client serves its bundled report index at `/benchmarks`, where each model is treated as one participant and the report exposes agreement, disagreement, repeat stability, opinion groups, and model-trait comparisons.

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
- Session interview research metadata: [docs/session-interview-research.md](docs/session-interview-research.md)
- PATH / RPC behavior: [docs/path-rpc.md](docs/path-rpc.md)
- Cloudflare worker docs: [docs/session-cors-worker.md](docs/session-cors-worker.md)
- Session Agent HTTP docs: [workers/sessionCorsWorker/agent/README.md](workers/sessionCorsWorker/agent/README.md)
- Agent participants (MCP server): [docs/agent-participants.md](docs/agent-participants.md)
- Session registry and gate model: [docs/session-registry.md](docs/session-registry.md)
- Scaling reference: [docs/scaling.md](docs/scaling.md)
- Public roadmap: [ROADMAP.md](ROADMAP.md)
- AI Opinions Benchmark: [ai-discourse-bench/README.md](ai-discourse-bench/README.md)

## Licensing

Project-authored code is licensed under `MPL-2.0`, including the client, Workers, contracts, deploy package and add-ons. Earlier releases keep the licenses they shipped with. Project-authored annotations in [`ai-discourse-corpus/`](ai-discourse-corpus/) remain `CC0-1.0`; upstream material and third-party dependencies, fonts and assets keep their own rights and notices. See [LICENSING.md](LICENSING.md).

## Roadmap

Current priorities and future development directions live in [ROADMAP.md](ROADMAP.md).
