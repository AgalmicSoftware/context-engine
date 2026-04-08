# Context Engine — Client

This directory contains the React single-page application for Context Engine.
It is the browser frontend for session setup, surveys, gating, SBT flows, and
other user-facing web3 interactions.

## Setup

Current client workflows use Node.js `16.14.2` and npm `9.2.0`.

Install client dependencies with `npm i --force` for now. This is a temporary
workaround until the current install conflict is fixed.

```bash
cd client
nvm use 16
npm i --force
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
- Vite
- Jest
- SCSS Modules / Sass
- ethers and viem for web3 interactions
