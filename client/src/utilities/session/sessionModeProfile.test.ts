import {
  SESSION_MODE_PRESET_IDS,
  SESSION_MODE_PRESETS,
  cloneSessionModePreset,
  compileSessionModeProfile,
  hasLegacyTelegramFirstSessionFlags,
  isSessionModeProfileTelegramFirst,
  profileFromLegacyConfig,
  validateSessionModeProfile,
  type SessionModeProfile,
} from './sessionModeProfile';

describe('sessionModeProfile', () => {
  it('compiles the Cloudflare preset to the existing worker storage contract', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    const compiled = compileSessionModeProfile(profile);

    expect(profile).toEqual(SESSION_MODE_PRESETS.fast_cheap_cloudflare);
    expect(profile.storage.payloadAccessControl).toEqual({
      gate: 'role_gate',
      encryption: 'worker_envelope',
      accessConditions: {
        match: 'any',
        conditions: [
          { kind: 'worker_role', role: 'admin' },
          { kind: 'agent_grant_scope', scope: 'storage' },
        ],
      },
    });
    expect(compiled.storageProfile).toEqual(
      expect.objectContaining({
        backend: 'cloudflare',
        payloadAccessControl: {
          gate: 'role_gate',
          encryption: 'worker_envelope',
          accessConditions: {
            match: 'any',
            conditions: [
              { kind: 'worker_role', role: 'admin' },
              { kind: 'agent_grant_scope', scope: 'storage' },
            ],
          },
        },
        resources: expect.objectContaining({
          questions: 'active',
          responses: 'active',
        }),
      }),
    );
    expect(compiled.payloadAccessControl).toEqual({
      gate: 'role_gate',
      encryption: 'worker_envelope',
      accessConditions: {
        match: 'any',
        conditions: [
          { kind: 'worker_role', role: 'admin' },
          { kind: 'agent_grant_scope', scope: 'storage' },
        ],
      },
    });
    expect(compiled.payloadAccessMode).toBe('worker_sbt_gate');
    expect(compiled.resultsExposure).toEqual({
      aggregateResultsEnabled: true,
      anonymizedGroupsEnabled: false,
      minGroupSize: 2,
    });
    expect(compiled.exportScope).toBe('admin_raw');
    expect(compiled.telegramBridgeEnabled).toBe(false);
  });

  it('compiles the public decentralized preset without changing enforcement enums', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
    const compiled = compileSessionModeProfile(profile);

    expect(profile.evm.registryChainId).toBe(11155420);
    expect(compiled.storageProfile).toEqual(
      expect.objectContaining({
        backend: 'arweave',
        resources: expect.objectContaining({
          docsContext: 'active',
          questions: 'staged',
        }),
      }),
    );
    expect(compiled.storageProfile).not.toHaveProperty('payloadAccessControl');
    expect(compiled.payloadAccessMode).toBe('worker_sbt_gate');
    expect(compiled.exportScope).toBe('all_session');
  });

  it('validates reserved and invalid profile combinations', () => {
    const reserved = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    reserved.authority.mode = 'org_private_chain';
    reserved.encryption = { mode: 'worker_envelope', keyProvider: 'cloudflare_secrets_store' };
    expect(validateSessionModeProfile(reserved).issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['reserved']),
    );

    const litWithoutChain = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    litWithoutChain.encryption = { mode: 'lit' };
    expect(validateSessionModeProfile(litWithoutChain).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'lit_requires_registry_chain' })]),
    );

    const encryptedExportWithoutEncryption = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    encryptedExportWithoutEncryption.encryption = { mode: 'none' };
    encryptedExportWithoutEncryption.export.scope = 'encrypted_envelopes_only';
    expect(validateSessionModeProfile(encryptedExportWithoutEncryption).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'encrypted_export_requires_encryption' })]),
    );

    const telegramOnlyExportGate = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    telegramOnlyExportGate.authorization.mechanisms = ['telegram_account_role'];
    expect(validateSessionModeProfile(telegramOnlyExportGate).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'telegram_role_cannot_be_sole_admin_export_gate' })]),
    );
  });

  it('rejects a Telegram Mini App without Telegram and options that are not yet enforced', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.surfaces.miniApp = true;
    profile.surfaces.telegram = false;
    profile.results.visibility = 'private_admin';
    profile.export.scope = 'selected_surfaces';
    profile.export.surfaceFilter = ['web'];

    const result = validateSessionModeProfile(profile);

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'mini_app_requires_telegram' }),
        expect.objectContaining({ code: 'results_visibility_not_implemented' }),
        expect.objectContaining({ code: 'selected_surface_export_not_implemented' }),
      ]),
    );
  });

  it('accepts worker envelope for Cloudflare without a feature flag', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.encryption = { mode: 'worker_envelope', keyProvider: 'worker_secret' };
    expect(validateSessionModeProfile(profile).valid).toBe(true);

    const compiled = compileSessionModeProfile(profile);
    expect(compiled.storageProfile).toEqual(
      expect.objectContaining({
        backend: 'cloudflare',
        payloadAccessControl: {
          gate: 'role_gate',
          encryption: 'worker_envelope',
          accessConditions: {
            match: 'any',
            conditions: [
              { kind: 'worker_role', role: 'admin' },
              { kind: 'agent_grant_scope', scope: 'storage' },
            ],
          },
        },
        cloudflare: { payloadAccessMode: 'worker_sbt_gate' },
      }),
    );
    expect(compiled.payloadAccessControl).toEqual({
      gate: 'role_gate',
      encryption: 'worker_envelope',
      accessConditions: {
        match: 'any',
        conditions: [
          { kind: 'worker_role', role: 'admin' },
          { kind: 'agent_grant_scope', scope: 'storage' },
        ],
      },
    });
    expect(compiled.payloadAccessMode).toBe('worker_sbt_gate');
  });

  it('rejects worker envelope outside Cloudflare and compiles default conditions where the worker reads them', () => {
    const invalid = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
    invalid.encryption = { mode: 'worker_envelope', keyProvider: 'worker_secret' };
    expect(validateSessionModeProfile(invalid).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'worker_envelope_requires_cloudflare' })]),
    );

    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.evm.registryChainId = 11155420;
    profile.encryption = {
      mode: 'worker_envelope',
      keyProvider: 'worker_secret',
      accessConditions: {
        match: 'all',
        conditions: [
          { kind: 'worker_role', role: 'reviewer' },
          {
            kind: 'sbt_onchain',
            chainId: 11155420,
            contract: '0x00000000000000000000000000000000000000aa',
            anyOrAll: 'any',
          },
          { kind: 'agent_grant_scope', scope: 'storage' },
        ],
      },
    };
    const compiled = compileSessionModeProfile(profile);

    expect(compiled.storageProfile).toEqual(
      expect.objectContaining({
        payloadAccessControl: {
          gate: 'role_gate',
          encryption: 'worker_envelope',
          accessConditions: profile.encryption.accessConditions,
        },
      }),
    );
    expect(compiled.payloadAccessControl.accessConditions).toEqual(profile.encryption.accessConditions);
    expect(validateSessionModeProfile(profile).valid).toBe(true);
  });

  it('lets explicit Cloudflare access override the default gate', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    profile.encryption = { mode: 'none' };
    profile.storage.payloadAccessControl = { gate: 'none', encryption: 'none' };

    const compiled = compileSessionModeProfile(profile);

    expect(compiled.storageProfile).toEqual(
      expect.objectContaining({
        backend: 'cloudflare',
        payloadAccessControl: { gate: 'none', encryption: 'none' },
        cloudflare: { payloadAccessMode: 'public_read' },
      }),
    );
    expect(compiled.payloadAccessControl).toEqual({ gate: 'none', encryption: 'none' });
    expect(compiled.payloadAccessMode).toBe('public_read');
  });

  it('normalizes legacy Telegram and storage configs into profiles', () => {
    const telegramProfile = profileFromLegacyConfig({
      sessionMode: 'telegram_only',
      storageProfile: { backend: 'cloudflare' },
    });
    expect(telegramProfile).toEqual(
      expect.objectContaining({
        preset: 'custom',
        authority: { mode: 'worker_canonical' },
        storage: expect.objectContaining({ backend: 'cloudflare' }),
      }),
    );
    expect(telegramProfile.surfaces).toEqual(
      expect.objectContaining({
        telegram: true,
        miniApp: true,
        web: true,
      }),
    );
    expect(compileSessionModeProfile(telegramProfile).storageProfile.backend).toBe('cloudflare');

    const litArweaveProfile = profileFromLegacyConfig({
      networkChainId: 84532,
      storageProfile: { backend: 'lit-arweave' },
    });
    expect(litArweaveProfile).toEqual(
      expect.objectContaining({
        storage: { backend: 'arweave' },
        encryption: { mode: 'lit' },
        evm: { registryChainId: 84532 },
      }),
    );
  });

  it('detects profile-first Telegram mode while preserving legacy variants', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.surfaces.telegram = true;
    expect(isSessionModeProfileTelegramFirst({ sessionModeProfile: profile })).toBe(true);
    expect(hasLegacyTelegramFirstSessionFlags({ telegram: { mode: 'telegram_only' } })).toBe(true);
  });

  it('keeps compile pure', () => {
    const profile: SessionModeProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    const before = JSON.stringify(profile);
    compileSessionModeProfile(profile);
    expect(JSON.stringify(profile)).toBe(before);
  });
});
