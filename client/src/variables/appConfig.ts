//  this file: GLOBAL VARIABLE(S) and settings USED BY FRONT-END
//  contains: env-backed deploy/runtime config plus semantic UI constants
import { readPublicBoolEnv, readPublicEnv, readPublicIntEnv, readPublicListEnv } from './publicEnv.js';
import {
  DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED,
  DEFAULT_SHARED_WORKER_URL,
  DEPLOY_HELPER_URL,
  HEALTHCHECK_WORKER_URL,
  WORKER_BUNDLE_URL,
  WORKER_RELEASE_MANIFEST_URL,
} from './publicDeploymentConfig.js';

const DEFAULT_SESSION_SCAN_SCOPE = 'list';
// Demo-like sessions that should receive public demo UI affordances. The first
// entry is the About-page CTA target; keep older slugs in the list while links migrate.
const DEFAULT_DEMO_SESSION_SLUGS = Object.freeze(['demo-sh', 'demo-1', 'demo-3', 'demo-2', 'demo']);
// Default cross-session scans follow the active public demo while legacy slugs
// remain demo-like for direct links during migration.
const DEFAULT_SESSION_SCAN_SLUGS = Object.freeze([DEFAULT_DEMO_SESSION_SLUGS[0]]);

// ****************************************** BOOLEAN OPTIONS ******************************************* //

// Default account-modal auto-funding toggle. If true, request testnet ETH via the Cloudflare Worker faucet
// when the connected wallet is logged in and its balance is at or below TESTNET_AUTO_SEND_THRESHOLD_ETH.
export const DEFAULT_AUTO_REQUEST_TESTNET_FUNDS = readPublicBoolEnv(
  'REACT_APP_DEFAULT_AUTO_REQUEST_TESTNET_FUNDS',
  true,
);
// Default first-run value of `state.demoSurfaceMode`. If a user has a
// stored `ce:demoSurfaceMode` preference in localStorage, that wins;
// fresh installs / no-storage cases honor this env default.
export const DEFAULT_DEMO_SURFACE_MODE = readPublicBoolEnv('REACT_APP_CE_DEMO_SURFACE_MODE_DEFAULT', false);
// MetaMask/RainbowKit is excluded from the default passkey-only client bundle.
// Deployments that need browser-wallet login must opt in at build time.
export const CE_ENABLE_METAMASK_CONNECTOR = readPublicBoolEnv('REACT_APP_CE_ENABLE_METAMASK_CONNECTOR', false);
// RainbowKit's MetaMask wallet falls back to WalletConnect when MetaMask is not injected.
// Keep that external bridge opt-in so local startup does not open WalletConnect sockets.
export const CE_ENABLE_WALLETCONNECT_FALLBACK = readPublicBoolEnv('REACT_APP_CE_ENABLE_WALLETCONNECT_FALLBACK', false);
// Animate CE logo on first page load before swapping to static image
export const ENABLE_CE_LOGO_ANIMATION = readPublicBoolEnv('REACT_APP_ENABLE_CE_LOGO_ANIMATION', true);
// Options: "forward" (play once) | "pingpong" (play forward then backward)
export const CE_LOGO_ANIMATION_MODE = 'pingpong';
// Matches context_engine_logo_animation.gif duration (ms)
export const CE_LOGO_ANIMATION_DURATION_MS_FORWARD = 12870;
// Matches context_engine_logo_animation_pingpong.gif duration (ms)
export const CE_LOGO_ANIMATION_DURATION_MS_PINGPONG = 25750;

// Debug flags (defaults). Override in dev console (window.*), e.g. window.ENABLE_RPC_DEBUG_STATS = true.
// Flags: ENABLE_RPC_DEBUG_LOGGING (RPC logs), ENABLE_RPC_DEBUG_STATS (counts+recent), ENABLE_RPC_DEBUG_TRACE (stack snippets),
// CE_RPC_VERBOSE_ERRORS (expanded error tree logging), CE_RPC_LOG_PROVIDER_SUCCESS (log which RPC URL served),
// DISABLE_SBT_INSTANCE_LISTENERS (skip per-SBT polling), MAX_SBT_INSTANCE_LISTENERS (cap count),
// SBT_INSTANCE_LISTENER_GROUPS (allowlist by slug), ENABLE_SBT_HISTORY_SCAN (mint/burn history scans).
// TODO: extend this pattern for other log categories so we can toggle logs globally or by area.
export const ENABLE_RPC_DEBUG_LOGGING = readPublicBoolEnv('REACT_APP_ENABLE_RPC_DEBUG_LOGGING', false);
export const ENABLE_RPC_DEBUG_STATS = readPublicBoolEnv('REACT_APP_ENABLE_RPC_DEBUG_STATS', false);
export const ENABLE_RPC_DEBUG_TRACE = readPublicBoolEnv('REACT_APP_ENABLE_RPC_DEBUG_TRACE', false);
export const CE_RPC_VERBOSE_ERRORS = readPublicBoolEnv('REACT_APP_CE_RPC_VERBOSE_ERRORS', false);
export const CE_RPC_LOG_PROVIDER_SUCCESS = readPublicBoolEnv('REACT_APP_CE_RPC_LOG_PROVIDER_SUCCESS', false);
export const DISABLE_SBT_INSTANCE_LISTENERS = readPublicBoolEnv('REACT_APP_DISABLE_SBT_INSTANCE_LISTENERS', false);
export const MAX_SBT_INSTANCE_LISTENERS = readPublicIntEnv('REACT_APP_MAX_SBT_INSTANCE_LISTENERS', 25);
// Per-instance SBT listeners are enabled only for these group slugs (use "general" for the default group).
export const SBT_INSTANCE_LISTENER_GROUPS = readPublicListEnv('REACT_APP_SBT_INSTANCE_LISTENER_GROUPS', ['general']);
// When false, skip mint/burn history scans during SBT cache initialization.
export const ENABLE_SBT_HISTORY_SCAN = readPublicBoolEnv('REACT_APP_ENABLE_SBT_HISTORY_SCAN', false);
// Toggle the Conviction/Importance slider swap UI (SurveyTool)
export const ENABLE_IMPORTANCE_SLIDER_TOGGLE = readPublicBoolEnv('REACT_APP_ENABLE_IMPORTANCE_SLIDER_TOGGLE', true);
// When true, unresolved SBT labels can trigger targeted metadata lookups (cache-first fallback path).
export const ENABLE_TARGETED_SBT_METADATA_LOOKUP = readPublicBoolEnv(
  'REACT_APP_ENABLE_TARGETED_SBT_METADATA_LOOKUP',
  true,
);
// Prefer PATH/Pocket RPC defaults for supported chains.
export const PREFER_PATH_RPC = readPublicBoolEnv('REACT_APP_PREFER_PATH_RPC', true);
// Debug-only: include a configured paid Base Sepolia HTTP RPC in the chain RPC list
// (requires reload; chains are built at module init).
export const CE_USE_INFURA_RPC = readPublicBoolEnv('REACT_APP_CE_USE_INFURA_RPC', false);
// Provider composition mode for read RPCs:
// - "fallback" (default): keep existing fallback ordering
// - "infura_only": Base Sepolia providers use the configured paid RPC only (diagnostics)
export const CE_RPC_PROVIDER_MODE = readPublicEnv('REACT_APP_CE_RPC_PROVIDER_MODE', 'fallback');
export const TERMINOLOGY_MODE = readPublicEnv('REACT_APP_TERMINOLOGY_MODE', 'plain');
// Bounded concurrency for getLogs split scans (lower is safer against RPC storms).
export const CE_GETLOGS_MAX_CONCURRENCY = readPublicIntEnv('REACT_APP_CE_GETLOGS_MAX_CONCURRENCY', 1);
// Retry cap for eth_getLogs requests (separate from the generic retry wrapper).
export const CE_GETLOGS_MAX_RETRIES = readPublicIntEnv('REACT_APP_CE_GETLOGS_MAX_RETRIES', 2);

// RPC guardrails (defaults). Most are runtime-toggleable via URL/localStorage/globalThis; see docs/path-rpc.md.
export const CE_SESSION_SCAN_SCOPE = readPublicEnv('REACT_APP_CE_SESSION_SCAN_SCOPE', DEFAULT_SESSION_SCAN_SCOPE); // all|active|general|list
export const CE_SESSION_SCAN_SLUGS = readPublicListEnv('REACT_APP_CE_SESSION_SCAN_SLUGS', [
  ...DEFAULT_SESSION_SCAN_SLUGS,
]); // used when CE_SESSION_SCAN_SCOPE="list" (array of session slugs, use "general" or "" for default; can also use demoSession keys/names when demo-alias toggle is enabled)
// When true, initial "/" loads auto-open About, and cached session document loads can migrate there.
export const CE_FIRST_VISIT_ROOT_REDIRECT_ENABLED = readPublicBoolEnv(
  'REACT_APP_CE_FIRST_VISIT_ROOT_REDIRECT_ENABLED',
  true,
);
// Shows the public /posts route and the About-page Posts link. Root-level
// posts live under /posts in the repository and are served as static assets.
export const CE_ABOUT_POSTS_ENABLED = readPublicBoolEnv('REACT_APP_CE_ABOUT_POSTS_ENABLED', true);
// Profile deep scans (/u/:address and compare) can optionally bypass CE_SESSION_SCAN_SCOPE and scan every known session.
// Legacy all-session override is off by default; per-resource scan flags below can still enable fanout.
export const CE_USER_PROFILE_SCAN_ALL_SESSIONS = readPublicBoolEnv(
  'REACT_APP_CE_USER_PROFILE_SCAN_ALL_SESSIONS',
  false,
);
// Profile deep-scan all-session override for SBT discovery.
// Default-off so list-scoped profile scans stay on-list unless explicitly widened.
export const CE_USER_PROFILE_SCAN_ALL_SESSIONS_SBTS = readPublicBoolEnv(
  'REACT_APP_CE_USER_PROFILE_SCAN_ALL_SESSIONS_SBTS',
  CE_USER_PROFILE_SCAN_ALL_SESSIONS,
);
// Profile deep-scan all-session override for survey activity discovery.
// Default-off so list-scoped profile scans stay on-list unless explicitly widened.
export const CE_USER_PROFILE_SCAN_ALL_SESSIONS_SURVEYS = readPublicBoolEnv(
  'REACT_APP_CE_USER_PROFILE_SCAN_ALL_SESSIONS_SURVEYS',
  CE_USER_PROFILE_SCAN_ALL_SESSIONS,
);
// Profile deep-scan all-session override for question activity discovery.
// Default-off so list-scoped profile scans stay on-list unless explicitly widened.
export const CE_USER_PROFILE_SCAN_ALL_SESSIONS_QUESTIONS = readPublicBoolEnv(
  'REACT_APP_CE_USER_PROFILE_SCAN_ALL_SESSIONS_QUESTIONS',
  CE_USER_PROFILE_SCAN_ALL_SESSIONS,
);
// Burst size for profile deep-scan slug workers (1 = fully sequential).
// Higher values can improve time-to-first-results but increase RPC load/timeouts.
export const CE_PROFILE_SCAN_SBT_BURST_SIZE = readPublicIntEnv('REACT_APP_CE_PROFILE_SCAN_SBT_BURST_SIZE', 4);
// Per-slug timeout for SBT fetch steps during profile deep scans (milliseconds).
export const CE_PROFILE_SCAN_SBT_TIMEOUT_MS = readPublicIntEnv('REACT_APP_CE_PROFILE_SCAN_SBT_TIMEOUT_MS', 30000);
// Per-slug timeout for survey/question activity fetch steps during profile deep scans (milliseconds).
export const CE_PROFILE_SCAN_ACTIVITY_TIMEOUT_MS = readPublicIntEnv(
  'REACT_APP_CE_PROFILE_SCAN_ACTIVITY_TIMEOUT_MS',
  12000,
);
// How long profile scan planning waits for registry hydration before fallback/retry mode (milliseconds).
export const CE_PROFILE_SCAN_REGISTRY_TIMEOUT_MS = readPublicIntEnv(
  'REACT_APP_CE_PROFILE_SCAN_REGISTRY_TIMEOUT_MS',
  45000,
);
// Optional: emit verbose cold-load profile scan diagnostics into CE profile telemetry.
// Disabled by default to avoid noisy logs during normal usage.
export const CE_PROFILE_SCAN_COLD_DIAG = readPublicBoolEnv('REACT_APP_CE_PROFILE_SCAN_COLD_DIAG', false);
// Minimum block progress delta before SBT chip latest-block research rechecks in list mode.
export const CE_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP = readPublicIntEnv(
  'REACT_APP_CE_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP',
  50,
);
export const CE_SBT_INSTANCE_LISTENERS_MODE = readPublicEnv('REACT_APP_CE_SBT_INSTANCE_LISTENERS_MODE', 'auto'); // auto|on|off
export const CE_SBT_FULL_SCAN_POLICY = readPublicEnv('REACT_APP_CE_SBT_FULL_SCAN_POLICY', 'auto'); // auto|sbts|manual
// When true, selectors with explicit session-source browsing can offer other known sessions
// outside the directly invoked scan scope as opt-in manual buttons.
export const CE_SBT_SELECTOR_AUTO_SEARCH_OTHER_SESSIONS = readPublicBoolEnv(
  'REACT_APP_CE_SBT_SELECTOR_AUTO_SEARCH_OTHER_SESSIONS',
  true,
);
// Show shipped demo sessions from demo_sessions.json in SBT session universe chips.
export const SHOW_DEMO_SESSIONS = readPublicBoolEnv('REACT_APP_SHOW_DEMO_SESSIONS', false);
// Public/demo session slugs that should use demo presentation affordances.
export const CE_DEMO_SESSION_SLUGS = readPublicListEnv('REACT_APP_CE_DEMO_SESSION_SLUGS', [
  ...DEFAULT_DEMO_SESSION_SLUGS,
]);
// PolisReport auto-enables fixture-backed demo data for these canonical session slugs.
export const POLIS_DEMO_DATA_AUTOLOAD_SLUGS = readPublicListEnv('REACT_APP_POLIS_DEMO_DATA_AUTOLOAD_SLUGS', [
  ...CE_DEMO_SESSION_SLUGS,
]);
// One-shot testing flag: clamps cross-session fanout defaults to general/list.
export const CE_RPC_TESTING_MODE = readPublicBoolEnv('REACT_APP_CE_RPC_TESTING_MODE', false);
// On-chain session registry (kept off by default during the migration).
export const USE_ONCHAIN_SESSION_REGISTRY = readPublicBoolEnv('REACT_APP_USE_ONCHAIN_SESSION_REGISTRY', true);
// When true, CE_SESSION_SCAN_SLUGS list entries can resolve through demoSessions aliases
// (session key, session slug, or sessionName) before scope checks.
export const CE_SESSION_SCAN_RESOLVE_DEMO_SESSION_ALIASES = readPublicBoolEnv(
  'REACT_APP_CE_SESSION_SCAN_RESOLVE_DEMO_SESSION_ALIASES',
  !USE_ONCHAIN_SESSION_REGISTRY,
);
// Canonical default session slug in client state/config.
export const DEFAULT_SESSION_SLUG = readPublicEnv('REACT_APP_DEFAULT_SESSION_SLUG', '');
// URL/on-chain alias used when the slug is empty.
export const DEFAULT_SESSION_SLUG_ALIAS = readPublicEnv('REACT_APP_DEFAULT_SESSION_SLUG_ALIAS', 'general');
export const SERVER = readPublicEnv('REACT_APP_SERVER', 'http://localhost:5000');

export const ARWEAVE_ACTIVE = readPublicBoolEnv('REACT_APP_ARWEAVE_ACTIVE', true);
// Preferred Arweave gateway for user-facing links and normalized tx URLs.
// Override at runtime with `window.CE_ARWEAVE_GATEWAY_URL`.
export const ARWEAVE_GATEWAY_URL = readPublicEnv('REACT_APP_ARWEAVE_GATEWAY_URL', 'https://ar-io.dev');
// Troubleshooting mode: force Arweave reads through ar.io only and spend retries there before failing.
// Keep this strict until other gateways are reliable enough to opt back in intentionally.
// Override at runtime with `window.CE_ARWEAVE_DIRECT_TO_AR_IO`.
export const CE_ARWEAVE_DIRECT_TO_AR_IO = readPublicBoolEnv('REACT_APP_CE_ARWEAVE_DIRECT_TO_AR_IO', true);
// Default ar.io gateway base when troubleshooting mode is enabled.
// Override at runtime with `window.CE_ARWEAVE_AR_IO_URL`.
export const CE_ARWEAVE_AR_IO_URL = readPublicEnv('REACT_APP_CE_ARWEAVE_AR_IO_URL', 'https://ar-io.dev');
// Display-critical metadata should prefer gateway readability over GraphQL visibility.
// Response payloads keep the existing conservative preflight default unless a caller overrides it.
export const CE_ARWEAVE_PREFLIGHT_SESSION_METADATA = readPublicBoolEnv(
  'REACT_APP_CE_ARWEAVE_PREFLIGHT_SESSION_METADATA',
  false,
);
export const CE_ARWEAVE_PREFLIGHT_SBT_METADATA = readPublicBoolEnv(
  'REACT_APP_CE_ARWEAVE_PREFLIGHT_SBT_METADATA',
  false,
);
export const CE_ARWEAVE_PREFLIGHT_RESPONSE_PAYLOADS = readPublicBoolEnv(
  'REACT_APP_CE_ARWEAVE_PREFLIGHT_RESPONSE_PAYLOADS',
  true,
);
// ****************************************** BLOCKCHAIN CONFIG ****************************************** //
// Canonical default chain id for wallet/network fallbacks across the app.
// Keep the literal fallback in this file so Node E2E source parsing still works.
const DEFAULT_CHAIN_ID_FALLBACK = 11155420;
export const DEFAULT_CHAIN_ID = readPublicIntEnv('REACT_APP_DEFAULT_CHAIN_ID', DEFAULT_CHAIN_ID_FALLBACK);

// TESTNET FUNDS (faucet is handled by the Cloudflare Worker)
// Client-side auto-send threshold (UI hint). Keep in sync with the Worker TESTNET_BALANCE_THRESHOLD.
export const TESTNET_AUTO_SEND_THRESHOLD_ETH = readPublicEnv('REACT_APP_TESTNET_AUTO_SEND_THRESHOLD_ETH', '0.001');
// NOTE: TESTNET_AMOUNT is a legacy/UI-only hint and has no client consumers today.
// export const TESTNET_AMOUNT = "0.001";
// Optional manual faucet/RPC link shown in UI; auto-funding uses the Worker.
export const ETH_FAUCET_LINK = readPublicEnv('REACT_APP_ETH_FAUCET_LINK', 'http://127.0.0.1:8545');

// Shared worker fallback defaults to the project-hosted demo worker and remains env-overridable.
// Set `REACT_APP_CE_SHARED_WORKER_URL` to replace that fallback for a deployment.
export const CLOUDFLARE_CORS_WORKER_URL = readPublicEnv('REACT_APP_CE_SHARED_WORKER_URL', DEFAULT_SHARED_WORKER_URL);
export const CLOUDFLARE_DEPLOY_HELPER_URL = DEPLOY_HELPER_URL;
export const CLOUDFLARE_HEALTHCHECK_WORKER_URL = HEALTHCHECK_WORKER_URL;
export const CLOUDFLARE_WORKER_BUNDLE_URL = WORKER_BUNDLE_URL;
export const CLOUDFLARE_WORKER_RELEASE_MANIFEST_URL = WORKER_RELEASE_MANIFEST_URL;
export const CE_DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED = DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED;
// WALLECT CONNECT PROJECT ID (ReOwn - needed if upgrading rainbowkit / wagmi)
// export const WALLETCONNECT_PROJECT_ID = "13b8465ab2e356ef5cf655f6a9061738";
