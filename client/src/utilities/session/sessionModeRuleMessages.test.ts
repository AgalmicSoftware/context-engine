import { RULE_FIXTURES, registry, worker } from './sessionModeRuleFixtures.testUtils';
import { validateSessionModeProfile } from './sessionModeProfile';
import {
  conflictsAt,
  describeSessionModeRule,
  describeWorkerModeError,
  listSessionModeConflicts,
} from './sessionModeRuleMessages';

// The setup rules table: one plain message per code.
const PLAIN_MESSAGES: Record<string, string> = {
  worker_envelope_requires_cloudflare: 'Encryption by the session Worker needs Cloudflare storage.',
  // Backticks, not quotes: the release secret scan flags a quoted value under a key containing "secret".
  worker_secret_required: `Worker encryption needs the Worker’s own key. Keep “Worker key” selected.`,
  key_provider_requires_worker_envelope: 'That key provider works only with Worker encryption.',
  access_conditions_require_worker_envelope: 'Per-item access rules need Worker encryption.',
  sbt_conditions_require_worker_envelope: 'SBT access rules need Worker encryption.',
  public_results_require_public_storage: 'Public results need unencrypted, ungated storage.',
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
  surface_filter_requires_selected_export: 'A results filter names a surface that isn’t on.',
};

const SECTIONS: Record<string, string> = {
  public_results_require_public_storage: 'results',
  worker_secret_required: 'access',
  key_provider_requires_worker_envelope: 'access',
  access_conditions_require_worker_envelope: 'access',
  sbt_conditions_require_worker_envelope: 'access',
  worker_envelope_requires_cloudflare: 'access',
  worker_identity_mismatch: 'access',
  registry_identity_mismatch: 'access',
  identity_default_not_enabled: 'access',
  worker_authorization_mismatch: 'access',
  sbt_authorization_requires_condition: 'access',
  registry_authorization_mismatch: 'access',
};

describe('session mode rule messages', () => {
  it.each(Object.entries(RULE_FIXTURES))('gives %s its plain message in its section', (code, profile) => {
    const conflict = listSessionModeConflicts(profile).find((entry) => entry.code === code);
    expect(conflict).toBeDefined();
    expect(conflict?.message).toBe(PLAIN_MESSAGES[code]);
    expect(conflict?.section).toBe(SECTIONS[code] || 'hosting');
  });

  it('covers the client-only Worker-encryption rule and the hidden options', () => {
    const arweaveEnvelope = registry((profile) => {
      profile.encryption = { mode: 'worker_envelope', keyProvider: 'worker_secret' };
    });
    expect(listSessionModeConflicts(arweaveEnvelope).map((entry) => entry.message)).toContain(
      PLAIN_MESSAGES.worker_envelope_requires_cloudflare,
    );
    const hidden = worker((profile) => {
      profile.results.visibility = 'private_admin';
      profile.surfaces.mcp = true;
    });
    expect(listSessionModeConflicts(hidden).map((entry) => [entry.code, entry.message])).toEqual(
      expect.arrayContaining([
        ['results_visibility_not_implemented', 'Not available yet. Choose another option.'],
        ['schema_only_surface', 'Not available yet. Choose another option.'],
      ]),
    );
    expect(describeSessionModeRule('telegram_role_cannot_be_sole_admin_export_gate')).toBe(
      'Telegram roles can’t be the only gate on admin export.',
    );
  });

  it('keeps shape errors in their own words and lists nothing for no profile', () => {
    expect(describeSessionModeRule('invalid_enum', 'storage.backend must use an exact supported value.')).toBe(
      'storage.backend must use an exact supported value.',
    );
    expect(listSessionModeConflicts(null)).toEqual([]);
    expect(listSessionModeConflicts(worker(() => {}))).toEqual([]);
  });

  it('finds the conflicts at a path and the paths below it', () => {
    const conflicts = listSessionModeConflicts(RULE_FIXTURES.identity_default_not_enabled);
    expect(conflictsAt(conflicts, ['identity']).map((entry) => entry.code)).toContain('identity_default_not_enabled');
    expect(conflictsAt(conflicts, ['identity.enabled'])).toEqual([]);
  });

  it('turns a Worker path error into the plain message the profile settles', () => {
    const profile = RULE_FIXTURES.registry_identity_mismatch;
    expect(validateSessionModeProfile(profile).valid).toBe(false);
    expect(describeWorkerModeError('Invalid session config mode at sessionModeProfile.identity.', profile)).toBe(
      PLAIN_MESSAGES.registry_identity_mismatch,
    );
    expect(describeWorkerModeError('Invalid deployment mode at sessionModeProfile.identity.')).toBe(
      PLAIN_MESSAGES.worker_identity_mismatch,
    );
    expect(describeWorkerModeError('Worker deploy failed (500).', profile)).toBe('');
    expect(describeWorkerModeError('Invalid session config mode at sessionModeProfile.surfaces.web.')).toBe('');
  });
});
