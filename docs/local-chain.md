# Local Blockchain Setup (Foundry)

This repository uses **Foundry** for local blockchain development: **Anvil** runs the local node, and `forge` builds, tests, and deploys the contracts.

## Prerequisites

You must have Foundry installed. Run the following command:

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

Forge uses OpenZeppelin contracts. Run `npm install` first so `@openzeppelin/contracts` is present for Foundry builds and `npm run test:contracts`.

## Solidity Version

This workflow compiles the four contracts in `contracts/`:
`SessionRegistry.sol`, `Surveys.sol`, `CustomSBT.sol`, and `SBTFactory.sol`,
with solc 0.8.24 as pinned in `foundry.toml`.

## Architecture

*   **Node:** `anvil` (spins up a local RPC at `http://127.0.0.1:8545`).
*   **Deploy:** `forge script` (compiles contracts and deploys them to Anvil). The local deploy script lives at `foundry/script/DeployLocal.s.sol`.
*   **Bridge:** The deployment script writes addresses to `client/src/variables/local-contracts.json` (Surveys, SBTFactory, SessionRegistry).
*   **Client:** The React app imports this JSON file and uses the local chain's (31337) registry and contracts only on loopback hosts, unless `globalThis.CE_INCLUDE_LOCAL_SESSION_REGISTRY` overrides that.

## Running Tests

To run the full integration suite (Node start -> Deploy -> Client Tests):

```bash
npm run test:local
```

You can run the public contract and client suites separately:

```bash
npm run test:contracts
npm run test:client
```

`npm run test:contracts` runs the unit, fuzz, and invariant suites for Surveys, CustomSBT, and SessionRegistry in `foundry/test/`.

For the canonical PR gate (`npm test`) and the release profile (`npm run verify:release`), see [testing.md](testing.md).

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
    npm run dev
    ```
