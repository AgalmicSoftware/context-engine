# Context Engine — Client

This directory contains the React single-page application for Context Engine.
It is the browser frontend for session setup, surveys, gating, SBT flows, and
other user-facing web3 interactions.

## Setup

Current client workflows support Node.js `^20.19.0` or `>=22.12.0` with
npm `^10.0.0`. Node 16/npm 9 are no longer supported for client work.

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
# Run ESLint 9 with the flat config in `eslint.config.mjs`.
# Includes JS/JSX, `src/utilities/ui`, shared UI, informational UI, MainContent, auxiliary page, shell support, dev/E2E support, Telegram demo setup, gate UI, CommunityTab, PolisReport, DebateMap, Navbar, and ContractPage components.

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
