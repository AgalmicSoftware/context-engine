# Context Engine — Client

This directory contains the React single-page application for Context Engine.
It is the browser frontend for session setup, surveys, gating, SBT flows, and
other user-facing web3 interactions.

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
