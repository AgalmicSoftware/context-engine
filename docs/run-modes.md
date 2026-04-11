# Run Modes

Context Engine can be used in three main modes depending on how much infrastructure you want to run.

## `core-local`

Frontend development and local client work only.

- Use the React client without chain, worker, or Arweave dependencies
- Client workflows use Node.js 16.14.2 and npm 9.2.0
- Install client dependencies with `npm install --legacy-peer-deps` for now
  until the current install conflict is fixed
- Typical start command:

```bash
cd client
nvm use 16
npm install --legacy-peer-deps
npm run dev
```

## `local-chain`

Local blockchain development with Anvil and Foundry.

- Use this mode for contract work, local deploys, and chain-backed development flows
- Root scripts use Node.js 20+
- See [docs/local-chain.md](local-chain.md) for chain startup, deploy flow, and local contract testing

## `hosted/onchain`

Production-style hosted mode with the Cloudflare Worker and Arweave.

- Use this mode for public or hosted sessions that need worker-backed AI, uploads, auth, and gating
- The current OSS setup is bring-your-own-worker unless and until a project-hosted shared worker is explicitly published
- See [docs/session-creation-guide.md](session-creation-guide.md), [docs/session-cors-worker.md](session-cors-worker.md), and [docs/scaling.md](scaling.md) for setup and deployment variations
