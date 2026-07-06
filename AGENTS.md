# AGENTS.md

## Quick commands
```bash
# Client (from client/)
cd client && npm install  # install client dependencies with strict peer resolution
npm run dev                       # dev server (port 3000, hot reload)

# Worker bundle (from repo root; use Node 20.19+ for root scripts)
nvm use 20
npm run worker:bundle            # generate local dist/sessionCorsWorker.bundle.js fallback bundles

# E2E tests & seeding (from repo root)
npm run ai:test-gates:any-all                    # E2E gate verification
npm run ai:test-gated-decrypt:all-types          # E2E gated decrypt
npm run ai:test-survey-response:encryption-matrix # E2E survey response suite
npm run ai:seed-survey:question-types            # seed question type data
```

## Client
- Run frontend package commands from `client/`.
- Root worker/test scripts are standardized on Node `^20.19.0` or `>=22.12.0` (`nvm use 20`).
- The frontend package supports Node `^20.19.0` or `>=22.12.0` with npm `^10.0.0`; Node 16/npm 9 are no longer supported for client work.
- Fresh `client/` installs use the standard `npm install` with strict peer resolution. Do not add `--legacy-peer-deps` or restore a package-level npm config shim for normal installs.
- When upgrading peer-sensitive `client/` dependencies (Lit Protocol packages, `reactstrap`, `react-popper`, Testing Library, or anything else declaring a React / TypeScript peer), re-run `cd client && npm install --legacy-peer-deps=false` and `cd client && npm ci --legacy-peer-deps=false --dry-run` before committing to catch lockfile or peer-regression drift.
- `npm run dev` is the hot-reload frontend dev server; `npm start` serves the existing production build from `build/`.
- Useful frontend scripts: `npm test` (Jest 30), `npm test -- --watchAll=false`, `npm run lint` (ESLint 9 flat config), `npm run build`, `npm run analyze`.
- Codex targeted Jest runs should use the approval-friendly form from `client/`: `npm test -- --watchAll=false --runTestsByPath <paths...>`. Do not prefix targeted Jest commands with `CI=true`; shell env assignments make sandbox auto-approval less reliable and trigger repeated prompts for Jest's temp-dir haste-map cache.
- Frontend logging is off by default. In the browser console, run `window.CE_LOGGING.enabled = true`, then `window.CE_LOGGING_HELP()` for categories and usage.

## Stack
- React 18 SPA (Vite, mix of class + functional components)
- Solidity on OP Sepolia (chain 11155420) by default; Base Sepolia (84532) should continue to work for legacy/dev compatibility but is best-effort, not actively supported
- Cloudflare Workers (`sessionCorsWorker`) — CORS proxy, encryption, gating
- Arweave (metadata/payloads and most uploaded images); some token/image reads still accept IPFS URLs
- Lit Protocol v3 (SBT-gated field encryption via access control conditions on configured EVM chains)
- ethers v5.7.2 — **MUST stay on v5; v6 BigInt changes break the entire codebase**

## Project map
| Path | What it is |
|------|------------|
| `client/src/components/MainSite/AppShell.tsx` | See [`docs/MainSite.MAP.md`](docs/MainSite.MAP.md) for the app shell section index |
| `client/src/components/MainContent/` | Home tab surface: `MainAreaTabs.tsx`, `ToolExplorer.tsx`, `OnboardingWalkthrough.tsx`, `RiskMatrix.tsx` |
| `client/src/components/Account/` | Account/login/settings surface: `LoginAndSettingsModal.tsx`, `LoginButton.tsx` |
| `client/src/components/SurveyTool/SurveyTool.tsx` | See [`docs/SurveyTool.MAP.md`](docs/SurveyTool.MAP.md) for the SurveyTool component hierarchy |
| `client/src/components/About/` | About page components |
| `client/src/components/OnePageSession/` | Session page shell: `OnePageSession.tsx` plus its co-located styles/tests |
| `client/src/components/DemoViews/` | Demo-only route surfaces: `CorpusViewer.tsx`, `DemosIndex.tsx`, `RiskMatrixDemo.tsx`, `DemoAnalysis/`, `DebateHUD/` |
| `client/src/components/DocumentLibrary/` | Session document library surfaces: `SessionDocumentsPage.tsx`, `DocumentLibraryPanel.tsx` |
| `client/src/components/Shared/` | Shared reusable UI: `AudioInput/`, `Json/`, `CETooltip.tsx`, `LazyFallback.tsx`, `SessionChipSelector.tsx` |
| `client/src/components/Sessions/SessionWizard.tsx` | Session creation wizard |
| `client/src/components/Admin/AdminPage.tsx` | Admin page |
| `client/src/components/SBTs/` | SBT management components |
| `client/src/components/Gates/` | Gate/encryption components |
| `client/src/utilities/` | Utilities organized into subdirs: `web3/`, `crypto/`, `arweave/`, `session/`, `worker/`, `cache/`, `ai/`, `sbt/`, `ui/`, `survey/`, `docLibrary/` |
| `client/src/utilities/web3/contractScripts.js` | See [`docs/contractScripts.MAP.md`](docs/contractScripts.MAP.md) for contract helpers navigation |
| `workers/sessionCorsWorker/` | Cloudflare Worker source (canonical) |
| `dist/sessionCorsWorker.bundle.js` | Generated local/manual worker bundle fallback used by the client build and E2E upload flows when rebuilt locally |
| `client/src/contractsABI/` | Contract ABI JSON files |
| `contracts/` | Solidity smart contracts |
| `foundry/script/` | Foundry Solidity deploy scripts |
| `foundry/test/` | Foundry Solidity tests |
| `tests/root/` | Root Node/Jest tests for workers, deploy helpers, and compatibility harnesses |
| `scripts/test-*.ui.js` | Playwright E2E tests |
| `contextEngine-cc/` | Claude Code integration (hook + passkey auth) |
| `ARCHITECTURE.md` | System diagram, data flows, contract addresses |

### Generated / do-not-edit
`node_modules/`, `build/`, `dist/`, `client/src/artifacts/`

## Documentation
| Doc | What it is |
|-----|------------|
| [`README.md`](README.md) | Entry point and quick start |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | System diagram, data flows, contract addresses |
| [`docs/MainSite.MAP.md`](docs/MainSite.MAP.md) | MainSite section index |
| [`docs/SurveyTool.MAP.md`](docs/SurveyTool.MAP.md) | SurveyTool component hierarchy |
| [`docs/contractScripts.MAP.md`](docs/contractScripts.MAP.md) | Contract helpers navigation |
| [`docs/repo-structure.md`](docs/repo-structure.md) | Repo naming contract |
| [`docs/session-creation-guide.md`](docs/session-creation-guide.md) | End-to-end session setup |
| [`docs/session-cors-worker.md`](docs/session-cors-worker.md) | Worker docs |
| [`docs/session-registry.md`](docs/session-registry.md) | Registry docs |
| [`docs/e2e-commands.md`](docs/e2e-commands.md) | E2E test guide |
| [`docs/cache/README.md`](docs/cache/README.md) | Frontend cache docs index |
| [`docs/public-client-config.md`](docs/public-client-config.md) | Env config |
| [`docs/lit-protocol-information.md`](docs/lit-protocol-information.md) | Lit Protocol docs |
| [`LICENSING.md`](LICENSING.md) | MPL/MIT/CC0 license map |
| [`CHANGELOG.md`](CHANGELOG.md) | Shipped changes |
| [`ROADMAP.md`](ROADMAP.md) | Public roadmap |

## Conventions
- Default testnet: OP Sepolia (`11155420`)
- Test IDs: `data-testid="ce-<area>-<control>"`
- Playwright selectors: prefer `getByTestId()` > `getByRole()` > `getByLabel()` > CSS
- Tooltip pattern: `<FontAwesomeIcon icon={faQuestionCircle}/>` + `<UncontrolledTooltip>` (reactstrap)

## Workflow
- Create any new git worktrees for this repo under the repo-local scratch area,
  typically `.codex/scratch/<descriptive-name>`. Do not create sibling worktree
  directories directly beside the repository root.
- Commit convention for automated changes: `<type>: <short imperative summary>` (for example, `fix: guard empty response payload`). Use `feat`, `fix`, `refactor`, `test`, `docs`, or `chore` as the type.
- Keep commit messages concise: imperative subject, no trailing period, no internal planning identifiers, and an optional body capped at 0-3 short lines when helpful.
- Commit messages must describe the change by what it does, not by internal planning IDs or tracking names. Planning IDs churn and referencing them ties public commit history to internal bookkeeping.
- Keep fixture/test data non-identifying (no real names, emails, API keys)
- New user-facing workflow/features should add or update related automated E2E smoke coverage when relevant, especially for UI, encryption, gating, worker, or Arweave flows
- Keep internal planning writeups local under ignored private paths such as `TODO/`; do not stage or force-add them. Public docs should describe shipped behavior and active public contracts without linking to internal planning files.

## Guardrails
- **MUST NOT**: commit secrets, API keys, or private keys to the repo
- **MUST NOT**: upgrade ethers to v6 (breaks BigNumber->BigInt across entire codebase)
- **MUST NOT**: modify worker KV secrets or production config
- **MUST**: use environment variables or worker KV for sensitive config
- **MUST**: validate user input before cryptographic operations
- **MUST**: fund test wallets with testnet ETH only
- **Ask before**: adding new dependencies, changing public contract interfaces, modifying smart contracts
