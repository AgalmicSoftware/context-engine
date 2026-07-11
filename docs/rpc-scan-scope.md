# RPC Scan Scope, Profile Scans, and Guardrails

This doc covers the runtime flags that shape cross-session RPC fanout, profile deep-scan
behavior, and related debugging/testing controls.

For PATH/Pocket endpoint defaults and provider ordering, see
[`docs/path-rpc.md`](path-rpc.md).

## Session scan scope

The app now treats session selection as a two-layer model:

- `primary/default session`: the inherited single-session context used by tools and views that operate on one session at a time.
- `selected-session scope + list`: the multi-session scan/discovery scope used by cross-session reads (`all`, `active`, `general`, `list`).

Authority order:

1. explicit route/session pins still win for route-bound views
2. explicit local component overrides win after user interaction
3. the global session settings become the inherited default everywhere else

Important:

- `list` scope does not collapse into the primary/default session
- multi-session consumers must keep using the full selected list in `list` mode
- single-session consumers should inherit the primary/default session unless explicitly pinned or locally overridden

`CE_SESSION_SCAN_SCOPE` controls which session slugs are eligible for cross-session,
RPC-heavy scans.

Scope values:

- `all`: cross-session scans may fan out across every known session
- `active`: cross-session scans are clamped to the active session slug
- `general`: cross-session scans are clamped to the default/general session (`slug === ""`)
- `list`: cross-session scans are clamped to an explicit slug list

Exceptions:

- In `list`, explicitly loaded `/session/<slug>` routes are still allowed even if the slug is off-list.
- In `general`, explicitly loaded `/session/<slug>` routes are allowed and MainSite may backfill the
  general session in the background.

Precedence:

1. URL param: `?ceSessionScanScope=active|general|list|all`
2. localStorage: `ce:sessionScanScope`
3. runtime flag: `globalThis.CE_SESSION_SCAN_SCOPE`
4. repo default from `client/src/variables/appConfig.ts`

Slug list input (`CE_SESSION_SCAN_SLUGS`) precedence:

1. URL param: `?ceSessionScanSlugs=general,my-session`
2. localStorage: `ce:sessionScanSlugs`
3. runtime flag: `globalThis.CE_SESSION_SCAN_SLUGS`
4. repo default from `client/src/variables/appConfig.ts`

Slug normalization:

- Non-alias session slugs are preserved exactly as entered.
- Only reserved aliases are canonicalized automatically:
  - `general` -> `""`
  - `debate` -> `rxc`
- Optional demo alias resolution can still rewrite list entries when
  `CE_SESSION_SCAN_RESOLVE_DEMO_SESSION_ALIASES` is enabled.

Current repo default in this checkout:

- `scope = "list"`
- `slugs = []`

Set `REACT_APP_CE_SESSION_SCAN_SLUGS` in your env file when you want a non-empty
default list for this checkout.

## Demo-session alias resolution

Optional list-mode alias resolution is controlled by `CE_SESSION_SCAN_RESOLVE_DEMO_SESSION_ALIASES`.

When enabled, `list` values can resolve through `client/src/variables/demo/demo_sessions.json` by:

- demo session key
- canonical slug
- session name

Runtime override:

- `globalThis.CE_SESSION_SCAN_RESOLVE_DEMO_SESSION_ALIASES = true|false`

## Settings UI

The Account modal now exposes the canonical session model under `AI Settings` -> `Session`:

- `Primary session`
- `Selected-session scope`
- multi-select session chips used for `list` scope and stored global defaults

The RPC summary remains visible under `AI Settings` -> `Session subscriptions (RPC)`.

Scope modes exposed in the modal:

- `All sessions`
- `Primary session`
- `General only`
- `Session list`

## Block-window behavior

- Session configs are expected to provide a positive `blockLimits.start`.
- Missing/invalid `blockLimits.start` is treated as a configuration error; there is no implicit
  scan-from-zero fallback in current code.
- When a slug is out of scope, `getRelevantBlockWindowForFilter()` returns an empty window
  (`fromBlock > toBlock`) and callers short-circuit.

## Profile deep-scan defaults

Current defaults from `client/src/variables/appConfig.ts`:

- `CE_USER_PROFILE_SCAN_ALL_SESSIONS = false`
- `CE_USER_PROFILE_SCAN_ALL_SESSIONS_SBTS = false`
- `CE_USER_PROFILE_SCAN_ALL_SESSIONS_SURVEYS = false`
- `CE_USER_PROFILE_SCAN_ALL_SESSIONS_QUESTIONS = false`

This means:

- list-scoped profile scans stay on the selected session list by default
- SBT, survey, and question fanout can each be enabled independently when needed

These flags apply only to per-user deep scans such as `/u/:address` and compare-address scans.

Runtime precedence:

1. `globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS_SBTS`
2. `globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS_SURVEYS`
3. `globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS_QUESTIONS`
4. `globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS` as the legacy fallback
5. defaults from `appConfig.ts`

## Important list-scope nuance

`list` scope can optionally widen profile scans per resource:

- `CE_USER_PROFILE_SCAN_ALL_SESSIONS_SBTS === true` allows off-list SBT discovery
- `CE_USER_PROFILE_SCAN_ALL_SESSIONS_SURVEYS === true` allows off-list survey activity discovery
- `CE_USER_PROFILE_SCAN_ALL_SESSIONS_QUESTIONS === true` allows off-list question activity discovery

Each resource stays independently toggleable. `attemptedSlugs` remain list-scoped even when one
or more of these off-list fanout paths are enabled.

## Profile deep-scan planning

When all-session profile fanout is enabled:

- on-chain mode uses authoritative registry-cache slugs (`sessionRegistryStore`)
- legacy demo fallback slugs are not treated as authoritative
- execution order prefers:
  - active-session slug first when present
  - then `general`
  - then remaining slugs

Coverage behavior:

- if registry hydration is incomplete or timed out, profile scan results are marked uncertain
- a retry is scheduled after registry hydration settles

## Profile deep-scan timeouts and concurrency

Current defaults:

- `CE_PROFILE_SCAN_SBT_TIMEOUT_MS = 30000`
- `CE_PROFILE_SCAN_ACTIVITY_TIMEOUT_MS = 12000`
- `CE_PROFILE_SCAN_REGISTRY_TIMEOUT_MS = 45000`
- `CE_PROFILE_SCAN_SBT_BURST_SIZE = 4`
- `CE_PROFILE_SCAN_COLD_DIAG = false`

Runtime overrides:

- `globalThis.CE_PROFILE_SCAN_SBT_TIMEOUT_MS`
- `globalThis.CE_PROFILE_SCAN_ACTIVITY_TIMEOUT_MS`
- `globalThis.CE_PROFILE_SCAN_REGISTRY_TIMEOUT_MS`
- `globalThis.CE_PROFILE_SCAN_SBT_BURST_SIZE`
- `globalThis.CE_PROFILE_SCAN_COLD_DIAG`
- backward-compat fallback: `globalThis.CE_PROFILE_SCAN_SLUG_TIMEOUT_MS`

Burst behavior:

- `1` = fully sequential SBT slug scans
- `>1` = bounded burst batches

## Profile deep-scan loading hold

`UserPage` supports an optional master override:

- `globalThis.CE_USER_PROFILE_DEEP_SCAN_LOADING`

Behavior:

- `false`: disable deep-scan loading hold and allow empty sections to resolve sooner
- unset / `true`: keep the loading hold enabled

## Question discovery checkpoint resume

Question discovery uses two watermarks:

- `questionsLatestBlock`: stable completed watermark
- `questionsDiscoveryCheckpointBlock`: in-progress checkpoint

Resume start is:

- `max(questionsLatestBlock, questionsDiscoveryCheckpointBlock) + 1`

On successful completion:

- `questionsLatestBlock` is advanced
- `questionsDiscoveryCheckpointBlock` is cleared

## RPC diagnostics

Enable before reload when you need demand-shaping or scope diagnostics:

- `window.ENABLE_RPC_DEBUG_STATS = true`
- optional: `window.ENABLE_RPC_DEBUG_TRACE = true`
- `window.CE_RPC_LOG_PROVIDER_SUCCESS = true`
- `window.CE_RPC_VERBOSE_ERRORS = true`

Useful APIs:

- `window.__CE_RPC_DEBUG__.snapshot()`
- `window.__CE_RPC_DEBUG__.startRun()`
- `window.__CE_RPC_DEBUG__.scanSummary()`
- `window.__RPC_STATS__`

## Additional RPC guardrails

### SBT instance listener clamp

Mode:

- URL: `?ceSbtInstanceListenersMode=auto|on|off`
- localStorage: `ce:sbtInstanceListenersMode`
- runtime: `globalThis.CE_SBT_INSTANCE_LISTENERS_MODE`
- default: `auto`

Behavior:

- `auto`: suppress per-instance listeners when `CE_SESSION_SCAN_SCOPE !== "all"`
- `on`: keep listeners enabled
- `off`: always disable listeners

Also:

- `window.MAX_SBT_INSTANCE_LISTENERS <= 0` disables instance listeners entirely

### Full SBT scan policy

Policy:

- URL: `?ceSbtFullScanPolicy=auto|sbts|manual`
- localStorage: `ce:sbtFullScanPolicy`
- runtime: `globalThis.CE_SBT_FULL_SCAN_POLICY`
- default: `auto`

Policies:

- `auto`: current behavior
- `sbts`: autorun full scans only on `/sbts` and `/sbt/:address`
- `manual`: never autorun full scans

### One-shot RPC testing mode

Enable:

- URL: `?ceRpcTestingMode=1`
- localStorage: `ce:rpcTestingMode`
- runtime: `globalThis.CE_RPC_TESTING_MODE = true`

When enabled, the app forces:

- `CE_USE_INFURA_RPC = false`
- `CE_SESSION_SCAN_SCOPE = "general"` when no slugs are configured
- `CE_SESSION_SCAN_SCOPE = "list"` when scan slugs are configured

## getLogs shaping knobs

- `globalThis.CE_GETLOGS_MAX_CONCURRENCY` default `1`
- `globalThis.CE_GETLOGS_MAX_RETRIES` default `2`
