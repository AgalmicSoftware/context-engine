# Run Modes

Context Engine can be used in three main modes depending on how much infrastructure you want to run, plus one advanced manual-fork E2E workaround.

## `core-local`

Frontend development and local client work only.

- Use the React client without chain, worker, or Arweave dependencies
- Client workflows use Node.js 16.14.2 and npm 9.2.0
- Install client dependencies with `npm i --force` for now until the current
  install conflict is fixed
- Typical start command:

```bash
cd client
nvm use 16
npm i --force
npm run dev
```

Vite is the canonical client dev/build path:

```bash
cd client
npm run dev
npm run build
npm run preview:vite
```

The Vite production build writes to `client/build/`, which is also what
`npm start` serves.

Client unit tests run through standalone Jest:

```bash
cd client
npm test -- --watchAll=false
```

## `local-chain`

Local blockchain development with Anvil and Foundry.

- Use this mode for contract work, local deploys, and chain-backed development flows
- Root scripts use Node.js 20+
- See [docs/local-chain.md](local-chain.md) for chain startup, deploy flow, and local contract testing

## `manual-fork` verification (advanced)

Hybrid E2E verification when you want real deployed contracts and seeded live state, but do not want to spend live gas for repeated validation.

- Start Anvil in fork mode yourself against the target chain
- Point E2E `RPC_URL` at that local fork
- Keep `CHAIN` / `CHAIN_ID` / `SESSION_REGISTRY` / `SBT_FACTORY` aligned to the upstream chain you forked
- See [docs/e2e-setup.md](e2e-setup.md) for the current manual-fork workflow
- First-class `E2E_CHAIN_MODE=fork` orchestration is not yet in the committed runners; track that follow-up in private planning.

## `hosted/onchain`

Production-style hosted mode with the Cloudflare Worker and Arweave.

- Use this mode for public or hosted sessions that need worker-backed AI, uploads, auth, and gating
- The current OSS setup is bring-your-own-worker unless and until a project-hosted shared worker is explicitly published
- See [docs/session-creation-guide.md](session-creation-guide.md), [docs/session-cors-worker.md](session-cors-worker.md), and [docs/scaling.md](scaling.md) for setup and deployment variations
