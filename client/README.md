# Context Engine — Client

This directory contains the React single-page application for Context Engine.
It is the browser frontend for session setup, surveys, gating, SBT flows, and
other user-facing web3 interactions.

## Setup

Client workflows support Node.js `^20.19.0` or `>=22.12.0` with
npm `^10.0.0`.

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

npm run lint
# Run ESLint 9 with the flat config in `eslint.config.mjs` over every
# JS, JSX, TS, and TSX file under `src/`.

npm start
# Preview the existing production build locally with Vite.

npm run analyze
# Build and write deterministic build/bundle-report.json and .html reports.
```

## Docs

See the root [README](../README.md) for repository-wide setup and workflows.

See [ARCHITECTURE.md](../ARCHITECTURE.md) for system design, contracts,
workers, storage, and data flow details.

## Stack

- React
- Vite
- Jest 30
- ESLint 9 flat config
- SCSS Modules / Sass
- ethers and viem for web3 interactions
