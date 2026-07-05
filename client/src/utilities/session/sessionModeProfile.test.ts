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
    expect(compiled.storageProfile).toEqual(expect.objectContaining({
      backend: 'cloudflare',
      payloadAccessControl: { gate: 'sbt_gate', encryption: 'none' },
      resources: expect.objectContaining({
        questions: 'active',
        responses: 'active',
      }),
    }));
    expect(compiled.payloadAccessControl).toEqual({ gate: 'sbt_gate', encryption: 'none' });
    expect(compiled.payloadAccessMode).toBe('worker_sbt_gate');
    expect(compiled.resultsExposure).toEqual({
      aggregateResultsEnabled: true,
      anonymizedGroupsEnabled: false,
      minGroupSize: 2,
    });
    expect(compiled.exportScope).toBe('admin_raw');
    expect(compiled.telegramBridgeEnabled).toBe(false);
  });

  it('compiles the public decentralized preset with a derived legacy access string', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
    const compiled = compileSessionModeProfile(profile);

    expect(profile.evm.registryChainId).toBe(11155420);
    expect(compiled.storageProfile).toEqual(expect.objectContaining({
      backend: 'arweave',
      resources: expect.objectContaining({
        docsContext: 'active',
        questions: 'staged',
      }),
    }));
    expect(compiled.storageProfile).not.toHaveProperty('payloadAccessControl');
    expect(compiled.payloadAccessControl).toEqual({ gate: 'sbt_gate', encryption: 'none' });
    expect(compiled.payloadAccessMode).toBe('worker_sbt_gate');
    expect(compiled.exportScope).toBe('all_session');
  });

  it('validates reserved and invalid profile combinations', () => {
    const reserved = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    reserved.authority.mode = 'org_private_chain';
    reserved.encryption = { mode: 'worker_envelope', keyProvider: 'cloudflare_secrets_store' };
    expect(validateSessionModeProfile(reserved).issues.map((issue) => issue.code))
      .toEqual(expect.arrayContaining(['reserved']));

    const litWithoutChain = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    litWithoutChain.encryption.mode = 'lit';
    expect(validateSessionModeProfile(litWithoutChain).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'lit_requires_registry_chain' }),
      ]));

    const encryptedExportWithoutEncryption = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    encryptedExportWithoutEncryption.export.scope = 'encrypted_envelopes_only';
    expect(validateSessionModeProfile(encryptedExportWithoutEncryption).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'encrypted_export_requires_encryption' }),
      ]));

    const telegramOnlyExportGate = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    telegramOnlyExportGate.authorization.mechanisms = ['telegram_account_role'];
    expect(validateSessionModeProfile(telegramOnlyExportGate).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'telegram_role_cannot_be_sole_admin_export_gate' }),
      ]));
  });

  it('accepts worker envelope only behind the explicit feature flag', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.encryption = { mode: 'worker_envelope', keyProvider: 'worker_secret' };
    expect(validateSessionModeProfile(profile).issues)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'worker_envelope_feature_disabled' }),
      ]));
    expect(validateSessionModeProfile(profile, { enableWorkerEnvelope: true }).valid).toBe(true);

    const compiled = compileSessionModeProfile(profile);
    expect(compiled.storageProfile).toEqual(expect.objectContaining({
      backend: 'cloudflare',
      payloadAccessControl: { gate: 'sbt_gate', encryption: 'worker_envelope' },
      cloudflare: { payloadAccessMode: 'worker_sbt_gate' },
    }));
    expect(compiled.payloadAccessControl).toEqual({ gate: 'sbt_gate', encryption: 'worker_envelope' });
    expect(compiled.payloadAccessMode).toBe('worker_sbt_gate');
  });

  it('lets explicit Cloudflare access override the default gate', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    profile.storage.payloadAccessControl = { gate: 'none', encryption: 'none' };

    const compiled = compileSessionModeProfile(profile);

    expect(compiled.storageProfile).toEqual(expect.objectContaining({
      backend: 'cloudflare',
      payloadAccessControl: { gate: 'none', encryption: 'none' },
      cloudflare: { payloadAccessMode: 'public_read' },
    }));
    expect(compiled.payloadAccessControl).toEqual({ gate: 'none', encryption: 'none' });
    expect(compiled.payloadAccessMode).toBe('public_read');
  });

  it('normalizes legacy Telegram and storage configs into profiles', () => {
    const telegramProfile = profileFromLegacyConfig({
      sessionMode: 'telegram_only',
      storageProfile: { backend: 'cloudflare' },
    });
    expect(telegramProfile).toEqual(expect.objectContaining({
      preset: 'custom',
      authority: { mode: 'worker_canonical' },
      storage: { backend: 'cloudflare' },
    }));
    expect(telegramProfile.surfaces).toEqual(expect.objectContaining({
      telegram: true,
      miniApp: true,
      web: true,
    }));
    expect(compileSessionModeProfile(telegramProfile).storageProfile.backend).toBe('cloudflare');

    const litArweaveProfile = profileFromLegacyConfig({
      networkChainId: 84532,
      storageProfile: { backend: 'lit-arweave' },
    });
    expect(litArweaveProfile).toEqual(expect.objectContaining({
      storage: { backend: 'arweave' },
      encryption: { mode: 'lit' },
      evm: { registryChainId: 84532 },
    }));
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
