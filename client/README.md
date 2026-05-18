# Context Engine — Client

This directory contains the React single-page application for Context Engine.
It is the browser frontend for session setup, surveys, gating, SBT flows, and
other user-facing web3 interactions.

## Setup

Current client workflows support Node.js `16.14.2` with npm `9.2.0`, and
Node.js `20.x` with npm `10.x`. Use Node 20/npm 10 for repo-wide work unless
you are intentionally checking client-only Node 16 compatibility.

Install client dependencies with plain `npm install`. The lockfile is expected
to resolve under npm's normal strict peer behavior.

```bash
cd client
nvm use 20
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
- Vite
- Jest
- SCSS Modules / Sass
- ethers and viem for web3 interactions
