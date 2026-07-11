# Run Modes

Context Engine can be used in three main modes depending on how much infrastructure you want to run, plus one advanced manual-fork E2E workaround.

## `core-local`

Frontend development and local client work only.

- Use the React client without chain, worker, or Arweave dependencies
- Client workflows support Node.js `^20.19.0` or `>=22.12.0` with
  npm `^10.0.0`; Node 16/npm 9 are no longer supported for client work
- Install client dependencies with plain `npm install`; strict peer resolution
  is the normal install contract
- Typical start command:

```bash
cd client
nvm use 20
npm install
npm run dev
```

Vite is the canonical client dev/build path:

```bash
cd client
npm run dev
npm run build
npm run preview
```

The Vite production build writes to `client/build/`, which is also what
`npm start` serves.

Client unit tests run through standalone Jest 30:

```bash
cd client
npm test -- --watchAll=false
```

## `local-chain`

Local blockchain development with Anvil and Foundry.

- Use this mode for contract work, local deploys, and chain-backed development flows
- Root scripts use Node.js 20.19+ or 22.12+
- See [docs/local-chain.md](local-chain.md) for chain startup, deploy flow, and local contract testing

## `manual-fork` verification (advanced)

Hybrid E2E verification when you want real deployed contracts and seeded live state, but do not want to spend live gas for repeated validation.

- Start Anvil in fork mode yourself against the target chain
- Point E2E `RPC_URL` at that local fork
- Keep `CHAIN` / `CHAIN_ID` / `SESSION_REGISTRY` / `SBT_FACTORY` aligned to the upstream chain you forked
- First-class fork orchestration is not part of the published command surface.

## `hosted/onchain`

Production-style hosted mode with the Cloudflare Worker and Arweave.

- Use this mode for public or hosted sessions that need worker-backed AI, uploads, auth, and gating
- The current OSS setup is bring-your-own-worker unless and until a project-hosted shared worker is explicitly published
- See [docs/session-creation-guide.md](session-creation-guide.md), [docs/session-cors-worker.md](session-cors-worker.md), and [docs/scaling.md](scaling.md) for setup and deployment variations
