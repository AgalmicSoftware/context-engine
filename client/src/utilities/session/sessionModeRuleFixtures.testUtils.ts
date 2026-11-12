import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset, type SessionModeProfile } from './sessionModeProfile';

// Fixtures build profiles the page can only reach by editing, so some break its types on purpose.
type LooseProfile = Record<string, any>;

const custom = (
  presetId:
    | typeof SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE
    | typeof SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED,
  edit: (profile: LooseProfile) => void,
): SessionModeProfile => {
  const profile = cloneSessionModePreset(presetId) as unknown as LooseProfile;
  profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
  edit(profile);
  return profile as unknown as SessionModeProfile;
};
export const worker = (edit: (profile: LooseProfile) => void) =>
  custom(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE, edit);
export const registry = (edit: (profile: LooseProfile) => void) =>
  custom(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED, edit);
const sbtRule = (chainId: number) => ({
  kind: 'sbt_onchain',
  chainId,
  contract: '0x0000000000000000000000000000000000000001',
  anyOrAll: 'any',
});
const unencrypted = (profile: LooseProfile) => {
  profile.encryption = { mode: 'none' };
  profile.storage.payloadAccessControl = { gate: 'role_gate', encryption: 'none' };
};

// One profile per rules-table code the page can reach. telegram_role_* needs a
// schema-only mechanism, and surface_filter_required the unavailable
// selected-surface export; both options stay hidden.
export const RULE_FIXTURES: Record<string, SessionModeProfile> = {
  worker_secret_required: worker((profile) => {
    profile.encryption = { mode: 'worker_envelope' };
  }),
  key_provider_requires_worker_envelope: worker((profile) => {
    unencrypted(profile);
    profile.encryption.keyProvider = 'worker_secret';
  }),
  access_conditions_require_worker_envelope: worker((profile) => {
    unencrypted(profile);
    profile.encryption.accessConditions = { match: 'any', conditions: [{ kind: 'worker_role', role: 'admin' }] };
  }),
  sbt_conditions_require_worker_envelope: worker((profile) => {
    unencrypted(profile);
    profile.evm.registryChainId = 11155420;
    profile.storage.payloadAccessControl.accessConditions = { match: 'any', conditions: [sbtRule(11155420)] };
  }),
  public_results_require_public_storage: worker((profile) => {
    profile.results.visibility = 'public_full_if_storage_public';
  }),
  member_results_require_session_worker: registry((profile) => {
    profile.results.visibility = 'session_member_full';
  }),
  payload_access_mode_mismatch: worker((profile) => {
    profile.storage.payloadAccessControl.mode = 'public_read';
  }),
  cloudflare_payload_access_required: worker((profile) => {
    delete profile.storage.payloadAccessControl;
  }),
  payload_access_cloudflare_only: registry((profile) => {
    profile.storage.payloadAccessControl = { gate: 'none', encryption: 'none' };
  }),
  payload_encryption_mismatch: worker((profile) => {
    profile.storage.payloadAccessControl.encryption = 'none';
  }),
  lit_requires_registry_chain: worker((profile) => {
    profile.encryption = { mode: 'lit' };
    profile.storage.payloadAccessControl = { gate: 'none', encryption: 'lit' };
  }),
  sbt_condition_requires_registry_chain: worker((profile) => {
    profile.storage.payloadAccessControl.accessConditions = { match: 'any', conditions: [sbtRule(11155420)] };
  }),
  unexpected_registry_chain: worker((profile) => {
    profile.evm.registryChainId = 11155420;
  }),
  access_condition_chain_mismatch: worker((profile) => {
    profile.evm.registryChainId = 11155420;
    profile.storage.payloadAccessControl.accessConditions = { match: 'any', conditions: [sbtRule(10)] };
  }),
  worker_authority_requires_cloudflare: worker((profile) => {
    profile.encryption = { mode: 'none' };
    profile.storage = { backend: 'arweave' };
  }),
  worker_identity_mismatch: worker((profile) => {
    profile.identity = { default: 'wallet', enabled: ['wallet', 'passkey'] };
  }),
  worker_authorization_mismatch: worker((profile) => {
    profile.authorization.mechanisms = ['sbt_onchain'];
  }),
  sbt_authorization_requires_condition: worker((profile) => {
    profile.authorization.mechanisms = ['worker_roles', 'sbt_onchain'];
  }),
  registry_authority_requires_arweave: registry((profile) => {
    profile.storage = { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } };
  }),
  registry_identity_mismatch: registry((profile) => {
    profile.identity = { default: 'passkey', enabled: ['passkey'] };
  }),
  registry_authorization_mismatch: registry((profile) => {
    profile.authorization.mechanisms = ['worker_roles'];
  }),
  identity_default_not_enabled: worker((profile) => {
    profile.identity = { default: 'wallet', enabled: ['passkey'] };
  }),
  encrypted_export_requires_encryption: registry((profile) => {
    profile.export.scope = 'encrypted_envelopes_only';
  }),
  mini_app_requires_telegram: worker((profile) => {
    profile.surfaces.miniApp = true;
  }),
  surface_filter_requires_selected_export: worker((profile) => {
    profile.export.surfaceFilter = ['web'];
  }),
};
