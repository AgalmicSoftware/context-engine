# Testing

Context Engine testing spans the root repo, the React client, and the E2E workflow suite.

## Runtime Requirements

- Root scripts and CI-style test runs use Node.js 20+
- Client workflows use Node.js 16.14.2 and npm 9.2.0
- Install client dependencies with `npm install`; the `--legacy-peer-deps`
  contract is carried automatically via `client/.npmrc`
- Contract and local-chain test flows require Foundry (`forge` / `anvil`)

## Common Commands

### Root CI Gate

```bash
nvm use 20
npm test
```

This runs the canonical root gate (`npm run test:ci`), which includes wiring
checks, the release-sanity gate, contract tests, client coverage, Node-side
tests, and cache guards.

### Client-Only Tests

```bash
cd client
nvm use 16
npm test -- --watchAll=false
npm run lint
```

Use the client workflow when you are working only in `client/` and do not need the full root test gate.
The client test runner is standalone Jest configured by `client/jest.config.cjs`.
Babel-Jest uses explicit Babel presets, and jsdom setup lives under
`client/scripts/jest/`.

### Targeted Root Commands

```bash
nvm use 20
npm run test:contracts
npm run test:node
npm run test:client
```

## E2E Workflows

The repo also ships deterministic E2E and workflow commands from the root:

```bash
nvm use 20
npm run test:e2e
npm run ai:test-gates:any-all
npm run ai:test-gated-decrypt:all-types
npm run ai:test-survey-response:encryption-matrix
```

For required env setup, wallet flows, and the full command catalog, use:

- [docs/e2e-setup.md](e2e-setup.md)
- [docs/e2e-commands.md](e2e-commands.md)
- [docs/porto-information.md](porto-information.md)
