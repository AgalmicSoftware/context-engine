# tests/

This is the source-of-truth home for root-level JavaScript test harnesses that
are not practical to colocate with client, worker, or script sources.

## Path roles

- `foundry/script/` contains Foundry Solidity deploy scripts.
- `foundry/test/` contains Forge Solidity suites.
- `scripts/` contains JS/Python tooling, audits, and supported automation.
- `tests/root/` contains root Node/Jest tests for workers, deploy helpers, and compatibility harnesses.
- `tests/helpers/` contains helper modules shared by `tests/root/`.

If you are deciding where to add new files:

- add new Solidity deploy scripts to `foundry/script/`
- add new Forge tests to `foundry/test/`
- add new JS/Python automation to `scripts/`
- add new root-level Node/Jest test sources to `tests/root/`
- add shared root test helpers to `tests/helpers/`

## How to run

- Canonical PR gate: `npm run test:ci` (serial `ci` profile from
  `scripts/ci-gates.json`)
- One named manifest gate: `npm run ci:gate -- <gate-name>`
- Same canonical gate via npm default: `npm test`
- Client Jest/RTL coverage gate: `npm run test:client`
- Root `node:test` suites: `npm run test:node`
- Solidity: `npm run test:contracts`
- Public route/style smoke: `npm run test:e2e`

## Why Foundry still has singular names

- Co-location keeps E2E scripts near supporting automation code in `scripts/`.
- React unit tests stay co-located with client app code so components, fixtures, and helpers remain close to the behavior they cover.
- Forge convention keeps Solidity tests in `test/` as `.t.sol` files.
