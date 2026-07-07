# tests/

This is the source-of-truth home for root-level JavaScript test harnesses that
are not practical to colocate with client, worker, or script sources.

## Path roles

- `foundry/script/` contains Foundry Solidity deploy scripts.
- `foundry/test/` contains Forge Solidity suites.
- `scripts/` contains JS/Python tooling, E2E runners, audits, and automation.
- `tests/root/` contains root Node/Jest tests for workers, deploy helpers, and compatibility harnesses.
- `tests/helpers/` contains helper modules shared by `tests/root/`.

If you are deciding where to add new files:

- add new Solidity deploy scripts to `foundry/script/`
- add new Forge tests to `foundry/test/`
- add new JS/Python automation to `scripts/`
- add new root-level Node/Jest test sources to `tests/root/`
- add shared root test helpers to `tests/helpers/`

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

## Why Foundry still has singular names

Foundry's default vocabulary is singular: `script/` for Solidity deploy scripts
and `test/` for Forge suites. This repo keeps those conventional names one
level down under `foundry/` while using plural root-level `scripts/` and
`tests/` for the broader JavaScript/tooling surface.
