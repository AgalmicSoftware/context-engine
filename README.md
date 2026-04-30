# Context Engine

![License: MPL-2.0](https://img.shields.io/badge/License-MPL--2.0-blue.svg)

<p align="center">
  <img src="client/src/assets/img/readme-header.png" alt="Context Engine interface showing a survey card with Agree, Unsure, and Disagree options." />
</p>

**Live demo:** [contextengine.xyz](https://contextengine.xyz)


Context Engine is a toolkit for AI-enhanced deliberation, decision-making, and negotiation in large groups. It supports public and private questions and responses, AI-assisted input and analysis, permanent records, and cryptographic access control. It allows for no-code deployment of [Soulbound Tokens](https://www.radicalxchange.org/wiki/social-identity/) for Groups. Designed for use cases such as public discourse, organizational decision-making, and preference-related dataset creation.

## Deployment Modes

- Public version: the hosted public app is available at [contextengine.xyz](https://contextengine.xyz).
- Private mode: organizations can run Context Engine on their own infrastructure with self-hosted deployment options and the [`contextEngine-cc`](contextEngine-cc/README.md) Claude Code companion integration. See [docs/scaling.md](docs/scaling.md) for deployment profiles.



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

cd client
nvm use 16
npm install
npm run dev
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
- Decentralized and permanent storage of responses
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

### User and Deployer UX: Passkey sign-on UX
- Users log in with a simple Passkey / Biometric flow (native pin, fingerprint, or faceID on phones)
- Login flow generates or handles an Ethereum account, which can be used easily with cryptography features
   - Users do not need to know anything about Ethereum or crypto (or take any additional steps) to use the app


### Deployer UX: Sponsored Bundles
- Deployers can use and set up sponsored bundles of API keys (for storage, EVM transactions, encryption network, AI API)
  - Senstive and organiztional deployments can plug in existing AI Keys, and use local or custom options for storage, encryption, and EVM network functionalities

## AI Discourse Corpus

The top-level [`ai-discourse-corpus/`](ai-discourse-corpus/) directory contains reusable JSON sub-corpuses curated from AI policy, safety, governance, science fiction, practitioner interviews, evaluation work, debates, and enriched social-media discussion. Rights for that directory are described separately in [ai-discourse-corpus/LICENSE.md](ai-discourse-corpus/LICENSE.md): no ownership is claimed over upstream source material, and project-authored annotations are dedicated under CC0.

## Video Production Notes

For local Context Engine video work, use the shared VideoFactory tooling in
`xoCortex/projects/video-factory` for ElevenLabs voice-over generation. Keep
`ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` in VideoFactory's gitignored
`secrets/.env`, then call `scripts/voice-generation/generate_voice.py` from
that repo or source `scripts/load_env.sh` before running custom assembly
scripts. Do not use macOS `say` voices for review cuts that are intended to
match the Jeanette/Jane ElevenLabs voice.

## Scaling

The default public deployment supports hundreds to low thousands of concurrent participants per session. For larger deployments, see [docs/scaling.md](docs/scaling.md).

## Documentation

- Project framing: [whitepaper/whitepaper.md](whitepaper/whitepaper.md)
- System design, data flows, and file map: [ARCHITECTURE.md](ARCHITECTURE.md)
- Docs index: [docs/README.md](docs/README.md)
- User guide / end-to-end session setup: [docs/session-creation-guide.md](docs/session-creation-guide.md)
- Testing guide: [docs/testing.md](docs/testing.md)
- Run modes: [docs/run-modes.md](docs/run-modes.md)
- Public client config and current defaults: [docs/public-client-config.md](docs/public-client-config.md)
- PATH / RPC behavior: [docs/path-rpc.md](docs/path-rpc.md)
- Cloudflare worker docs: [docs/session-cors-worker.md](docs/session-cors-worker.md)
- Session registry and gate model: [docs/session-registry.md](docs/session-registry.md)
- Scaling reference: [docs/scaling.md](docs/scaling.md)
- Public roadmap: [ROADMAP.md](ROADMAP.md)

## Licensing

This repo is intentionally multi-license. The public open-source core is licensed under `MPL-2.0`. Files and directories with their own license notices remain under those notices, including MIT worker-side code, files with explicit MIT notices, the CPAL-licensed `contextEngine-cc/` add-on, and the CC0 project-authored annotations in [`ai-discourse-corpus/`](ai-discourse-corpus/). Third-party dependencies retain their own licenses. See [LICENSING.md](LICENSING.md) for the current boundary map and shared-file rules.

## Roadmap

Current priorities and future development directions live in [ROADMAP.md](ROADMAP.md).
