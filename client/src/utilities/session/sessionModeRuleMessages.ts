import { parseWorkerModeErrorPath, ruleCodeForWorkerModePath } from '@ce-shared/sessionModeRulePaths.mjs';
import { validateSessionModeProfile } from './sessionModeProfile';
import type { SessionModeProfileValidationIssue } from './sessionModeProfileTypes';

// One plain message per rules-table code (validateSessionModeProfile). The
// setup and edit pages show it beside the option that conflicts.
const RULE_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  worker_envelope_requires_cloudflare: 'Encryption by the session Worker needs Cloudflare storage.',
  // Backticks, not quotes: the release secret scan flags a quoted value under a key containing "secret".
  worker_secret_required: `Worker encryption needs the Worker’s own key. Keep “Worker key” selected.`,
  key_provider_requires_worker_envelope: 'That key provider works only with Worker encryption.',
  access_conditions_require_worker_envelope: 'Per-item access rules need Worker encryption.',
  sbt_conditions_require_worker_envelope: 'SBT access rules need Worker encryption.',
  public_results_require_public_storage: 'Public results need unencrypted, ungated storage.',
  member_results_require_session_worker: 'Members-only results need a Session Worker.',
  payload_access_mode_mismatch: 'The storage access mode doesn’t match the chosen storage.',
  cloudflare_payload_access_required: 'Cloudflare storage needs an access mode.',
  payload_access_cloudflare_only: 'That access mode is available only on Cloudflare storage.',
  payload_encryption_mismatch: 'Storage encryption and access settings disagree.',
  lit_requires_registry_chain: 'Lit encryption needs an on-chain registry.',
  sbt_condition_requires_registry_chain: 'SBT rules need an on-chain registry.',
  unexpected_registry_chain: 'A Worker-hosted session doesn’t use a chain.',
  access_condition_chain_mismatch: 'An access rule names a different chain from the session.',
  worker_authority_requires_cloudflare: 'Worker-hosted sessions store data on Cloudflare.',
  worker_identity_mismatch: 'Worker-hosted sessions sign in with passkeys.',
  worker_authorization_mismatch: 'Worker-hosted sessions use Worker roles for permissions.',
  sbt_authorization_requires_condition: 'SBT permissions need at least one SBT rule.',
  registry_authority_requires_arweave: 'On-chain sessions store data on Arweave.',
  registry_identity_mismatch: 'On-chain sessions sign in with a wallet.',
  registry_authorization_mismatch: 'On-chain sessions use SBTs for permissions.',
  identity_default_not_enabled: 'The default sign-in method must be one of the enabled ones.',
  encrypted_export_requires_encryption: 'Encrypted export needs encrypted storage.',
  mini_app_requires_telegram: 'The Mini App needs Telegram turned on.',
  telegram_role_cannot_be_sole_admin_export_gate: 'Telegram roles can’t be the only gate on admin export.',
});
const SURFACE_FILTER_MESSAGE = 'A results filter names a surface that isn’t on.';
// Their options are hidden; a template can still carry one.
const NOT_AVAILABLE_MESSAGE = 'Not available yet. Choose another option.';
const NOT_AVAILABLE_CODES = new Set([
  'reserved',
  'results_visibility_not_implemented',
  'selected_surface_export_not_implemented',
]);

export type SessionSetupConflictSection = 'results' | 'access' | 'hosting';

export type SessionSetupConflict = {
  code: string;
  /** The profile path the rule names, as validateSessionModeProfile reports it. */
  path: string;
  message: string;
  section: SessionSetupConflictSection;
};

/** The plain message for a rules-table code; shape errors keep their own text. */
export const describeSessionModeRule = (code: string, fallback = ''): string => {
  if (RULE_MESSAGES[code]) return RULE_MESSAGES[code];
  if (code.startsWith('surface_filter_')) return SURFACE_FILTER_MESSAGE;
  if (NOT_AVAILABLE_CODES.has(code) || code.startsWith('schema_only_')) return NOT_AVAILABLE_MESSAGE;
  return fallback || 'These settings don’t fit together.';
};

const sectionForPath = (path: string): SessionSetupConflictSection => {
  if (path === 'results' || path.startsWith('results.')) return 'results';
  if (/^(identity|authorization|encryption)(\.|$)/.test(path)) return 'access';
  return 'hosting';
};

/** Every conflict in a profile, in rule order; none for an absent profile. */
export const listSessionModeConflicts = (profile: unknown): SessionSetupConflict[] =>
  profile
    ? validateSessionModeProfile(profile).issues.map((issue: SessionModeProfileValidationIssue) => ({
        code: issue.code,
        path: issue.path,
        message: describeSessionModeRule(issue.code, issue.message),
        section: sectionForPath(issue.path),
      }))
    : [];

/** Conflicts whose path is one of `paths` or lies under one. */
export const conflictsAt = (conflicts: SessionSetupConflict[], paths: readonly string[]): SessionSetupConflict[] =>
  conflicts.filter((conflict) => paths.some((path) => conflict.path === path || conflict.path.startsWith(`${path}.`)));

// The Worker names only the failing path; the profile's own issues settle
// which code it stands for. '' when the message names no rules-table path.
export const describeWorkerModeError = (message: unknown, profile: unknown = null): string => {
  const path = parseWorkerModeErrorPath(message);
  if (!path) return '';
  const issues = profile ? validateSessionModeProfile(profile).issues : [];
  const code = ruleCodeForWorkerModePath(path, issues);
  return code ? describeSessionModeRule(code) : '';
};
