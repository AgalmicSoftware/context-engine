# Local Blockchain Setup (Foundry)

This repository uses **Foundry** for local blockchain development. Foundry is a blazing fast, portable, and modular toolkit for Ethereum application development written in Rust.

We specifically use **Anvil**, a local testnet node similar to Ganache or Hardhat Network, but significantly faster and more lightweight.

## Prerequisites

You must have Foundry installed. Run the following command:

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

Forge uses OpenZeppelin contracts. Run `npm install` first so `@openzeppelin/contracts` is present for Foundry builds and `npm run test:contracts`.

## Solidity Version

This workflow targets the current Solidity 0.8.x contracts in `contracts/`:
`SessionRegistry.sol`, `Surveys.sol`, `CustomSBT.sol`, and `SBTFactory.sol`.
`foundry.toml` currently uses `skip = []`, and the local deploy flow compiles the
active contracts directly.

## Architecture

*   **Node:** `anvil` (spins up a local RPC at `http://127.0.0.1:8545`).
*   **Deploy:** `forge script` (compiles contracts and deploys them to Anvil). The local deploy script lives at `foundry/script/DeployLocal.s.sol`.
*   **Bridge:** The deployment script writes addresses to `client/src/variables/local-contracts.json` (Surveys, SBTFactory, SessionRegistry).
*   **Client:** The React app detects this JSON file and overrides the production config when running in local mode.

## Running Tests

To run the full integration suite (Node start -> Deploy -> Client Tests):

```bash
npm run test:local
```

To run the canonical PR gate locally (wiring guard, release-sanity gate,
contracts, client, CE-CC, root node suites, and cache guard):

```bash
npm run test:ci
```

`npm test` is an alias for the same canonical PR gate.

To run only the release-sanity gate (lint, client typecheck, full client Jest
without coverage, worker bundle verification, and production build):

```bash
npm run verify:release
```

To run the extended local gate that adds the Anvil-backed Surveys + SBT integration on top of `test:ci`:

```bash
npm run tests
```

To run the Surveys + SBT contractScripts integration test against Anvil (in `tests/root/contractScripts.surveys-sbt.test.js`, proxied via `client/src/utilities/web3/contractScripts.surveys-sbt.proxy.test.js`):

```bash
npm run test:surveys-sbt
```

You can still run each suite separately:

```bash
npm run test:contracts
npm run test:surveys-sbt
npm run test:client
```

`npm run test:contracts` runs the Foundry suites for `foundry/test/Surveys.t.sol`, `foundry/test/CustomSBT.t.sol`, and `foundry/test/SessionRegistry.t.sol`.

## Manual Development

If you want to run the React app against a persistent local chain:

1.  **Start the node:**
    ```bash
    npm run chain:start
    ```
2.  **Deploy contracts:**
    ```bash
    npm run chain:deploy
    ```
3.  **Start Client:**
    ```bash
    cd client
    npm start
    ```
