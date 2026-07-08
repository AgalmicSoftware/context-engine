# Repo Structure Contract

This document is the canonical naming and placement contract for the repository.
Use it for new files, refactors, and cleanup PRs.

## 1. Root Layout

- `client/` holds the React SPA, frontend assets, and frontend-adjacent tests.
- `workers/` holds Cloudflare Worker source and worker-specific support files.
- `contracts/` holds Solidity contracts, interfaces, and contract-focused tests.
- `scripts/` holds automation, seeding, audits, migration helpers, and E2E entrypoints.
- `foundry/` holds Foundry-specific Solidity entry points; `foundry/script/` and `foundry/test/` intentionally keep Foundry's singular directory names one level below repo root.
- `docs/` holds canonical implementation and operations documentation.
- `posts/` holds public Markdown posts and the `/posts` route manifest.
- `TODO/` is an ignored local area for private planning notes and unshipped work items.
- `contextEngine-cc/` holds the local Claude Code companion integration.
- `tests/` holds source-of-truth root Node/Jest test harnesses that are not practical to colocate elsewhere; shared helpers live under `tests/helpers/`.
- `artifacts/`, `broadcast/`, `cache/`, `dist/`, `out/`, and `tmp/` are generated or runtime output locations and are not canonical homes for new source files.
- New top-level directories are rare. Reuse an existing root area unless the new code has a clearly separate runtime, deployment surface, or ownership boundary.

## 2. React Component Structure

- Under `client/src/components/`, directories that represent UI features or shared component groups use PascalCase.
- Keep feature directories concise and let the component filename carry the full screen name when useful; for example, use `client/src/components/About/` with `AboutPage.tsx` inside it.
- Account/login/settings UI belongs under `client/src/components/Account/`; avoid vague compound legacy directory names for new work.
- Session creation UI belongs under `client/src/components/Sessions/`; keep `SessionWizard.tsx` and its helper/test modules co-located there.
- Session page shell UI belongs under `client/src/components/OnePageSession/`; keep `OnePageSession.tsx` and its helper/test modules co-located there.
- Demo-only route views belong under `client/src/components/DemoViews/`; keep reusable demo subareas grouped there instead of under generic catch-all names.
- Session doc-library UI belongs under `client/src/components/DocumentLibrary/`; keep `SessionDocumentsPage.tsx` and `DocumentLibraryPanel.tsx` together there.
- Rendered React component files use PascalCase filenames and `.tsx` extensions. All production components are now TypeScript.
- Component-specific styles are co-located as `<ComponentName>.module.scss`.
- Component-specific tests are co-located beside the source component.
- Preferred component test naming is `<ComponentName>.test.jsx` for JavaScript tests and `<ComponentName>.test.tsx` once the test itself is converted.
- Prefer purpose-led component names over legacy tab-label placeholders; for example, `client/src/components/MainContent/ToolExplorer.tsx` and `OnboardingWalkthrough.tsx` are clearer than generic `*Tab` filenames.
- Descriptive test qualifiers are allowed before `.test` when needed: `<ComponentName>.render.test.jsx`, `<ComponentName>.routes.test.jsx`.
- Cross-workflow reusable UI extracted from feature folders belongs under `client/src/components/Shared/` (for example `client/src/components/Shared/AudioInput/` and `client/src/components/Shared/Json/`).
- Do not create new lowercase component directories under `client/src/components/`.
- Avoid adding new files directly under `client/src/components/` unless they are true app-shell entry points or app-shell support modules.

## 3. Non-Component Modules

- Utilities, helpers, adapters, config modules, and data loaders use camelCase filenames.
- This applies under `client/src/utilities/` and to helper-only files that live beside a component.
- Utility directory buckets are lowercase by domain: `ai/`, `crypto/`, `session/`, `web3/`, etc.
- Use `.ts` for non-JSX TypeScript modules. Reserve `.js`/`.mjs` for compatibility barrels, scripts, or modules that must stay plain JavaScript for non-TypeScript consumers.
- Keep JSON fixtures or static data source-adjacent when they only support one feature.

## 4. Test Naming

- Tests live beside the source they exercise whenever practical.
- Valid test suffixes are `.test.js`, `.test.jsx`, `.test.ts`, `.test.tsx`, and `.test.mjs`.
- Optional middle qualifiers are allowed before `.test`: `.render`, `.cache`, `.proxy`, `.ui`, `.api`, `.module`, `.routes`, `.component`.
- Use `.test.jsx` or `.test.tsx` for React-rendering and component behavior tests.
- Use `.test.js`, `.test.ts`, or `.test.mjs` for pure helpers, data modules, Node-only code, and script tests.
- If a test targets a helper module inside a component folder, the helper may stay camelCase and the test may stay `.test.js`.

## 5. Script Naming

- Files under `scripts/` use kebab-case basenames.
- Script support files under `scripts/lib/` also use kebab-case.
- Dotted execution qualifiers are allowed before the final extension: `.ui`, `.api`, `.stub`, `.test`.
- Avoid camelCase and snake_case in script filenames.
- Keep script filenames shell-friendly; lowercase kebab-case wins inside `scripts/`.

## 6. Canonical Acronyms

- Canonical acronyms in this repo are `SBT`, `AI`, `RPC`, and `UX`.
- In PascalCase names, keep the acronym uppercase: `SBTSelector.tsx`, `DebateMap.tsx`.
- In camelCase module names, a leading acronym may be lowercase to satisfy camelCase: `sbtDisplayNames.js`, `sbtCreateFormCache.js`, `rpcSelection.js`.
- In lowercase-only naming schemes such as kebab-case script filenames, use lowercase segments: `test-sbt-auto-mint.ui.js`, `run-ux-workflows.js`, `rpc-errors.js`.
- Do not mix title-cased acronym fragments such as `Sbt`, `Ai`, `Rpc`, or `Ux` inside mixed-case filenames.

## 7. Reuse Vs. New Directory

- Reuse an existing feature directory when the new file extends the same user workflow or owner.
- Reuse an existing utility domain when the module shares the same runtime concern.
- Create a new directory only when the code introduces a distinct feature surface, a new technical domain, or a folder is becoming too large to navigate comfortably.
- Do not create a new directory for a single helper if an existing folder already owns that helper.
- Shared UI still belongs under `client/src/components/` in a PascalCase directory.
- Cross-cutting non-UI code belongs under `client/src/utilities/<domain>/`.

## Exceptions

Public source should follow this contract. Private operator-only compatibility
tools, when present in the development tree, are tracked separately and are not
part of the public naming contract.
