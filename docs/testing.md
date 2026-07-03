# Testing

Context Engine testing spans the root repo, the React client, and the E2E workflow suite.

## Runtime Requirements

- Root scripts, CI-style test runs, and client workflows use Node.js
  `^20.19.0` or `>=22.12.0` with npm `^10.0.0`
- Install client dependencies with plain `npm install`; strict peer resolution
  is the normal install contract
- Contract and local-chain test flows require Foundry (`forge` / `anvil`)

## Common Commands

### Root CI Gate

```bash
nvm use 20
npm test
```

This runs the canonical root gate (`npm run test:ci`), which includes wiring
checks, the release-sanity gate, contract tests, client coverage, public-safe
root Jest tests, public `sessionCorsWorker` module tests, Node-side tests, and
cache guards.

### Client-Only Tests

```bash
cd client
nvm use 20
npm test -- --watchAll=false
npm run lint
npm run typecheck
```

Use the client workflow when you are working only in `client/` and do not need the full root test gate.
The client test runner is standalone Jest 30 configured by `client/jest.config.cjs`.
Babel-Jest uses explicit Babel presets, and jsdom setup lives under
`client/scripts/jest/`.
Client linting runs ESLint 9 through `client/eslint.config.mjs`; the flat
config preserves the existing JavaScript/JSX lint surface plus React, React
Hooks, and parser rule intent. TypeScript lint coverage starts with the
`client/src/utilities/ui` utility boundary and shared UI components under
`client/src/components/Shared`, then extends to informational UI components
under `client/src/components/About`, `client/src/components/Footer`,
`client/src/components/InformationModals`, and `client/src/components/Onboarding`,
plus the home-tab surface under `client/src/components/MainContent` and
auxiliary pages under `client/src/components/Agent`,
`client/src/components/Bookmarks`, and `client/src/components/Sponsor`.
Shell support coverage also includes `client/src/components/ErrorBoundary` and
`client/src/components/RightSidebar`, and dev/E2E support coverage includes
`client/src/components/E2E`. Gate UI coverage includes
`client/src/components/Gates`. Community tab coverage includes
`client/src/components/CommunityTab`, Polis report coverage includes
`client/src/components/PolisReport`, and DebateMap coverage includes
`client/src/components/DebateMap`. Navbar coverage includes
`client/src/components/Navbar`, and ContractPage coverage includes
`client/src/components/ContractPage`. Broad TS/TSX lint expansion should be
handled as separate rule-tightening changes. `npm run typecheck` runs the
production client TypeScript project with `tsc --noEmit`; Jest/spec helper files
remain covered by the Jest command rather than the release typecheck gate.

### Targeted Root Commands

```bash
nvm use 20
npm run test:contracts
npm run test:root:jest
npm run test:worker:session-cors
npm run test:node
npm run test:client
npm run coverage-floor:check
npm run typecheck:client-tests
npm run ci:gate -- workers
```

`npm run test:wiring` also runs `scripts/verify-test-inventory.js`. That
inventory check keeps root `tests/root/*.test.*` files classified as one of:

- public-safe Node tests run by `npm run test:node`
- public-safe Jest tests run by `npm run test:root:jest`
- local-chain tests run by dedicated chain-backed commands such as
  `npm run test:surveys-sbt`
- private/stripped Node tests named `*.private.test.*`; these run in private
  checkouts through `npm run test:node` and are stripped from public releases

Do not add non-public worker package paths, live credentials, private deployment
names, or identifying fixtures to root `package.json` scripts. Private and
stripped surfaces should stay behind their own package-local commands or
release-strip rules so the public branch does not gain new references to
private implementation details.

## E2E Workflows

The published source tree provides a deterministic route and style smoke from
the root:

```bash
nvm use 20
npm run test:e2e
```

For required env setup, wallet flows, and the full command catalog, use:

- [docs/e2e-setup.md](e2e-setup.md)
- [docs/e2e-commands.md](e2e-commands.md)
- [docs/passkey-wallet.md](passkey-wallet.md)
