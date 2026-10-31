import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset, validateSessionModeProfile } from './sessionModeProfile';
import { validateWorkerConfigModeValues } from '../../../../workers/shared/workerConfigModeValidation.mjs';
import {
  WORKER_MODE_PATH_RULE_CODES,
  parseWorkerModeErrorPath,
  ruleCodeForWorkerModePath,
} from '@ce-shared/sessionModeRulePaths.mjs';

const custom = (presetId, edit) => {
  const profile = cloneSessionModePreset(presetId);
  profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
  edit(profile);
  return profile;
};
const worker = (edit) => custom(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE, edit);
const registry = (edit) => custom(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED, edit);
const sbtRule = (chainId) => ({
  kind: 'sbt_onchain',
  chainId,
  contract: '0x0000000000000000000000000000000000000001',
  anyOrAll: 'any',
});
const unencrypted = (profile) => {
  profile.encryption = { mode: 'none' };
  profile.storage.payloadAccessControl = { gate: 'role_gate', encryption: 'none' };
};

// One profile per rules-table code the page can reach. telegram_role_* needs a
// schema-only mechanism, and surface_filter_required the unavailable
// selected-surface export; both options stay hidden.
const RULE_FIXTURES = {
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

const workerPath = (profile) =>
  validateWorkerConfigModeValues({ sessionModeProfile: profile }, { allowPartialProfileStorage: true }).path;

describe('Worker mode paths map to rules-table codes', () => {
  it.each(Object.entries(RULE_FIXTURES))('%s', (code, profile) => {
    const { issues } = validateSessionModeProfile(profile);
    const issue = issues.find((entry) => entry.code === code);
    expect(issue).toBeDefined();
    const path = workerPath(profile);
    expect(path).toBe(`sessionModeProfile.${issue.path}`);
    expect(WORKER_MODE_PATH_RULE_CODES[path]).toContain(code);
    expect(ruleCodeForWorkerModePath(path, issues)).toBe(code);
  });

  it('maps only observed paths to known codes and falls back to the first code', () => {
    const observed = Object.values(RULE_FIXTURES).map(workerPath);
    expect(Object.keys(WORKER_MODE_PATH_RULE_CODES).sort()).toEqual([...new Set(observed)].sort());
    expect(Object.values(WORKER_MODE_PATH_RULE_CODES).flat().sort()).toEqual(Object.keys(RULE_FIXTURES).sort());
    expect(ruleCodeForWorkerModePath('sessionModeProfile.storage.backend')).toBe(
      'worker_authority_requires_cloudflare',
    );
    expect(ruleCodeForWorkerModePath('sessionModeProfile.surfaces.web')).toBe('');
  });

  it('reads the path from both Worker error messages', () => {
    expect(parseWorkerModeErrorPath('Invalid session config mode at sessionModeProfile.identity.')).toBe(
      'sessionModeProfile.identity',
    );
    expect(parseWorkerModeErrorPath('Invalid deployment mode at sessionModeProfile.evm.registryChainId.')).toBe(
      'sessionModeProfile.evm.registryChainId',
    );
    expect(parseWorkerModeErrorPath('Unsupported worker-canonical session config field: ai.')).toBe('');
    expect(parseWorkerModeErrorPath(undefined)).toBe('');
  });

  it('keeps the client-only Cloudflare rule for Worker encryption', () => {
    const profile = registry((entry) => {
      entry.encryption = { mode: 'worker_envelope', keyProvider: 'worker_secret' };
      entry.results.visibility = 'participant_aggregate';
    });
    expect(validateSessionModeProfile(profile).issues.map((issue) => issue.code)).toContain(
      'worker_envelope_requires_cloudflare',
    );
    expect(
      validateWorkerConfigModeValues({ sessionModeProfile: profile }, { allowPartialProfileStorage: true }),
    ).toEqual({
      ok: true,
    });
  });
});
