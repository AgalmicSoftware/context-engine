# Tests Directory

This directory consolidates test entry points using symlinks to test files that remain co-located in their original locations.

## Path roles

- `script/` contains Foundry Solidity deploy scripts.
- `scripts/` contains JS/Python tooling, E2E runners, audits, and automation.
- `test/` remains the source-of-truth location for Foundry Solidity tests, alongside some root Node-side tests.
- `tests/` is the index/symlink surface exposed through entries such as `contracts/`, `e2e/`, and `e2e-lib/`.

If you are deciding where to add new files:

- add new Solidity deploy scripts to `script/`
- add new JS/Python automation to `scripts/`
- add new root-level Foundry / Node test sources to `test/`
- do not treat `tests/` as the primary source-of-truth home unless a specific workflow requires the indexed view

## How to run

- Canonical PR gate: `npm run test:ci`
- Same canonical gate via npm default: `npm test`
- Extended local gate with Anvil Surveys + SBT integration: `npm run tests`
- Local-chain Surveys + SBT integration only: `npm run test:surveys-sbt`
- Client Jest/RTL coverage gate: `npm run test:client`
- Root `node:test` suites: `npm run test:node`
- CE-CC tests: `npm run test:cc`
- Solidity: `npm run test:contracts`
- E2E: `npm run ai:test-*`

## Why files are not moved

- Co-location keeps E2E scripts near supporting automation code in `scripts/`.
- React unit tests stay co-located with client app code so components, fixtures, and helpers remain close to the behavior they cover.
- Forge convention keeps Solidity tests in `test/` as `.t.sol` files.
