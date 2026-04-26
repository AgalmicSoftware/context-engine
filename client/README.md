# Context Engine — Client

This directory contains the React single-page application for Context Engine.
It is the browser frontend for session setup, surveys, gating, SBT flows, and
other user-facing web3 interactions.

## Setup

Current client workflows use Node.js `16.14.2` and npm `9.2.0`.

Install client dependencies with `npm install`; the `--legacy-peer-deps`
contract is carried automatically via `client/.npmrc`. The contract is
durable because `react-scripts@4.0.3` declares an optional TypeScript
peer of `^3.2.1 || ^4` that npm still treats as a hard `ERESOLVE`
against the `@lit-protocol/contracts@0.9.1` strict peer `typescript@5.8.3`
we satisfy. Removing the contract entirely requires moving off
`react-scripts@4` / CRA (tracked as the `client` toolchain decision).

```bash
cd client
nvm use 16
npm install
npm run dev
```

## Commands

Run these from `client/`:

```bash
npm run dev
# Start the development server.

npm run build
# Build the production bundle into `build/`.

npm test
# Run the test suite.

npm start
# Serve the production build.
```

## Docs

See the root [README](../README.md) for repository-wide setup and workflows.

See [ARCHITECTURE.md](../ARCHITECTURE.md) for system design, contracts,
workers, storage, and data flow details.

## Stack

- React
- SCSS Modules / Sass
- ethers and viem for web3 interactions
