// The Worker's mode validator reports only the first failing path. These are
// the rules-table codes (validateSessionModeProfile) each path can stand for.
export const WORKER_MODE_PATH_RULE_CODES = Object.freeze({
  'sessionModeProfile.encryption.mode': Object.freeze(['sbt_conditions_require_worker_envelope']),
  'sessionModeProfile.encryption.keyProvider': Object.freeze([
    'worker_secret_required',
    'key_provider_requires_worker_envelope',
  ]),
  'sessionModeProfile.encryption.accessConditions': Object.freeze(['access_conditions_require_worker_envelope']),
  'sessionModeProfile.storage.backend': Object.freeze([
    'worker_authority_requires_cloudflare',
    'registry_authority_requires_arweave',
  ]),
  'sessionModeProfile.storage.payloadAccessControl': Object.freeze([
    'cloudflare_payload_access_required',
    'payload_access_cloudflare_only',
  ]),
  'sessionModeProfile.storage.payloadAccessControl.mode': Object.freeze(['payload_access_mode_mismatch']),
  'sessionModeProfile.storage.payloadAccessControl.encryption': Object.freeze(['payload_encryption_mismatch']),
  'sessionModeProfile.evm.registryChainId': Object.freeze([
    'lit_requires_registry_chain',
    'sbt_condition_requires_registry_chain',
    'unexpected_registry_chain',
    'access_condition_chain_mismatch',
  ]),
  'sessionModeProfile.identity': Object.freeze(['worker_identity_mismatch', 'registry_identity_mismatch']),
  'sessionModeProfile.identity.default': Object.freeze(['identity_default_not_enabled']),
  'sessionModeProfile.authorization.mechanisms': Object.freeze([
    'worker_authorization_mismatch',
    'sbt_authorization_requires_condition',
    'registry_authorization_mismatch',
  ]),
  'sessionModeProfile.results.visibility': Object.freeze([
    'public_results_require_public_storage',
    'member_results_require_session_worker',
  ]),
  'sessionModeProfile.export.scope': Object.freeze(['encrypted_export_requires_encryption']),
  'sessionModeProfile.export.surfaceFilter': Object.freeze(['surface_filter_requires_selected_export']),
  'sessionModeProfile.surfaces.miniApp': Object.freeze(['mini_app_requires_telegram']),
});

const WORKER_MODE_ERROR = /^Invalid (?:session config|deployment) mode at (\S+)\.$/;

// "Invalid session config mode at <path>." (set-config) or "Invalid deployment
// mode at <path>." (deploy helper) -> <path>; anything else -> ''.
export const parseWorkerModeErrorPath = (message) =>
  (typeof message === 'string' && WORKER_MODE_ERROR.exec(message)?.[1]) || '';

// One code for a Worker path: the client issue at the same path settles which
// of several codes applies; without one, the path's first code; '' if none.
export const ruleCodeForWorkerModePath = (path, issues = []) => {
  const codes = Object.hasOwn(WORKER_MODE_PATH_RULE_CODES, path) ? WORKER_MODE_PATH_RULE_CODES[path] : [];
  const profilePath = String(path).replace(/^sessionModeProfile\./, '');
  const match = issues.find((issue) => issue?.path === profilePath && codes.includes(issue.code));
  return match?.code || codes[0] || '';
};
