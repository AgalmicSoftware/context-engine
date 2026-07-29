import {
  SESSION_MODE_PRESET_IDS,
  SESSION_MODE_PRESETS,
  classifySessionModeProfileSupport,
  cloneSessionModePreset,
  compileSessionModeProfile,
  hasLegacyTelegramFirstSessionFlags,
  isSessionModeProfileTelegramFirst,
  mergeSessionModeProfileStorageAccess,
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

  it('round-trips the exact Cloudflare preset through its compiled storage profile', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    const compiled = compileSessionModeProfile(profile);

    const restored = mergeSessionModeProfileStorageAccess(profile, compiled.storageProfile);

    expect(restored).toEqual(profile);
    expect(validateSessionModeProfile(restored)).toEqual({ valid: true, issues: [] });
    expect(() => compileSessionModeProfile(restored)).not.toThrow();
  });

  it('compiles the public decentralized preset with a derived legacy access string', () => {
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
    expect(compiled.payloadAccessControl).toEqual({ gate: 'sbt_gate', encryption: 'none' });
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

  it('rejects unknown or blank mode enums instead of normalizing them to defaults', () => {
    const cases: Array<{ path: string; profile: unknown }> = [
      {
        path: 'preset',
        profile: { ...cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE), preset: '' },
      },
      {
        path: 'authority.mode',
        profile: {
          ...cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
          authority: { mode: 'registry' },
        },
      },
      {
        path: 'storage.backend',
        profile: {
          ...cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
          storage: { backend: 'r2' },
        },
      },
      {
        path: 'storage.payloadAccessControl.gate',
        profile: {
          ...cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
          storage: { backend: 'cloudflare', payloadAccessControl: { gate: 'public', encryption: 'none' } },
        },
      },
      {
        path: 'storage.payloadAccessControl.encryption',
        profile: {
          ...cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
          storage: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'plaintext' } },
        },
      },
      {
        path: 'encryption.mode',
        profile: {
          ...cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
          encryption: { mode: 'plaintext' },
        },
      },
      {
        path: 'encryption.keyProvider',
        profile: {
          ...cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
          encryption: { mode: 'worker_envelope', keyProvider: 'browser_local' },
        },
      },
    ];

    for (const { path, profile } of cases) {
      expect(validateSessionModeProfile(profile as SessionModeProfile).issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ path, code: 'invalid_enum' })]),
      );
    }
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
    profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
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

  it('accepts every reachable custom storage and encryption family', () => {
    const cloudflareNone = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    cloudflareNone.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    cloudflareNone.encryption = { mode: 'none' };
    cloudflareNone.storage.payloadAccessControl = { gate: 'none', encryption: 'none' };

    const cloudflareLit = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    cloudflareLit.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    cloudflareLit.evm.registryChainId = 11155420;
    cloudflareLit.encryption = { mode: 'lit' };
    cloudflareLit.storage.payloadAccessControl = {
      ...cloudflareLit.storage.payloadAccessControl!,
      encryption: 'lit',
    };

    const cloudflareSbtHybrid = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    cloudflareSbtHybrid.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    cloudflareSbtHybrid.evm.registryChainId = 11155420;
    cloudflareSbtHybrid.encryption.accessConditions = {
      match: 'all',
      conditions: [
        { kind: 'worker_role', role: 'reviewer' },
        {
          kind: 'sbt_onchain',
          chainId: 11155420,
          contract: '0x00000000000000000000000000000000000000aa',
          anyOrAll: 'any',
        },
      ],
    };

    const arweaveLit = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
    arweaveLit.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    arweaveLit.encryption = { mode: 'lit' };
    arweaveLit.results.visibility = 'participant_aggregate';

    const workerReadbackCompatibility = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    workerReadbackCompatibility.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    workerReadbackCompatibility.encryption = { mode: 'none' };
    workerReadbackCompatibility.storage.payloadAccessControl = { gate: 'none', encryption: 'none' };
    workerReadbackCompatibility.results.visibility = 'public_full_if_storage_public';
    workerReadbackCompatibility.export.scope = 'all_session';

    for (const profile of [
      cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
      cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED),
      cloudflareNone,
      cloudflareLit,
      cloudflareSbtHybrid,
      arweaveLit,
      workerReadbackCompatibility,
    ]) {
      expect(classifySessionModeProfileSupport(profile)).toEqual(
        expect.objectContaining({
          status: 'reachable',
          validation: expect.objectContaining({ valid: true, issues: [] }),
        }),
      );
      expect(() => compileSessionModeProfile(profile)).not.toThrow();
    }
  });

  it('rejects public stored-results visibility when Cloudflare payloads are gated', () => {
    const gatedPublicResults = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    gatedPublicResults.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    gatedPublicResults.results.visibility = 'public_full_if_storage_public';

    const result = validateSessionModeProfile(gatedPublicResults);
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'results.visibility', code: 'public_results_require_public_storage' }),
      ]),
    );
    expect(classifySessionModeProfileSupport(gatedPublicResults).status).toBe('invalid');

    const publicReadResults = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    publicReadResults.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    publicReadResults.encryption = { mode: 'none' };
    publicReadResults.storage.payloadAccessControl = { gate: 'none', encryption: 'none' };
    publicReadResults.results.visibility = 'public_full_if_storage_public';
    expect(classifySessionModeProfileSupport(publicReadResults).status).toBe('reachable');

    const conditionGatedPublicResults = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    conditionGatedPublicResults.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    conditionGatedPublicResults.encryption = { mode: 'none' };
    conditionGatedPublicResults.storage.payloadAccessControl = {
      gate: 'none',
      encryption: 'none',
      accessConditions: {
        match: 'any',
        conditions: [{ kind: 'worker_role', role: 'reviewer' }],
      },
    };
    conditionGatedPublicResults.results.visibility = 'public_full_if_storage_public';
    expect(validateSessionModeProfile(conditionGatedPublicResults).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'results.visibility', code: 'public_results_require_public_storage' }),
      ]),
    );

    const encryptedPublicResults = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
    encryptedPublicResults.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    encryptedPublicResults.encryption = { mode: 'lit' };
    expect(validateSessionModeProfile(encryptedPublicResults).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'results.visibility', code: 'public_results_require_public_storage' }),
      ]),
    );
  });

  it('classifies schema-only and unavailable profiles separately while all fail compilation', () => {
    const publicAnchor = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    publicAnchor.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    publicAnchor.authority.mode = 'worker_with_public_anchor';
    publicAnchor.evm.registryChainId = 11155420;

    const mcp = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    mcp.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    mcp.surfaces.mcp = true;

    const unavailableResults = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    unavailableResults.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    unavailableResults.results.visibility = 'private_admin';

    expect(classifySessionModeProfileSupport(publicAnchor).status).toBe('schema_only');
    expect(classifySessionModeProfileSupport(mcp).status).toBe('schema_only');
    expect(classifySessionModeProfileSupport(unavailableResults).status).toBe('unavailable');
    for (const profile of [publicAnchor, mcp, unavailableResults]) {
      expect(() => compileSessionModeProfile(profile)).toThrow(/unsupported session mode profile/i);
    }
  });

  it('rejects raw malformed access documents before normalization can repair or drop them', () => {
    const cases: Array<{ path: string; mutate: (profile: SessionModeProfile) => void }> = [
      {
        path: 'encryption.accessConditions.match',
        mutate: (profile) => {
          profile.encryption.accessConditions = {
            match: 'some' as 'any',
            conditions: [{ kind: 'worker_role', role: 'admin' }],
          };
        },
      },
      {
        path: 'encryption.accessConditions.conditions.0.role',
        mutate: (profile) => {
          profile.encryption.accessConditions = {
            match: 'any',
            conditions: [{ kind: 'worker_role', role: '   ' }],
          };
        },
      },
      {
        path: 'encryption.accessConditions.conditions.0.kind',
        mutate: (profile) => {
          profile.encryption.accessConditions = {
            match: 'any',
            conditions: [{ kind: 'wallet_balance' } as never],
          };
        },
      },
      {
        path: 'encryption.accessConditions.conditions.0.contract',
        mutate: (profile) => {
          profile.evm.registryChainId = 11155420;
          profile.encryption.accessConditions = {
            match: 'any',
            conditions: [{ kind: 'sbt_onchain', chainId: 11155420, contract: '0x1234', anyOrAll: 'any' }],
          };
        },
      },
    ];

    for (const { path, mutate } of cases) {
      const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
      profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
      mutate(profile);
      expect(validateSessionModeProfile(profile).issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ path })]),
      );
      expect(classifySessionModeProfileSupport(profile).status).toBe('invalid');
    }
  });

  it('validates identity, authorization, EVM, result, export, surface, and resource boundaries', () => {
    const cases: Array<{ path: string; mutate: (profile: SessionModeProfile) => void }> = [
      {
        path: 'identity',
        mutate: (profile) => {
          profile.identity = { default: 'wallet', enabled: ['wallet', 'passkey'] };
        },
      },
      {
        path: 'authorization.mechanisms',
        mutate: (profile) => {
          profile.authorization.mechanisms = ['sbt_onchain'];
        },
      },
      {
        path: 'evm.registryChainId',
        mutate: (profile) => {
          profile.evm.registryChainId = 11155420;
        },
      },
      {
        path: 'results.exposure.minGroupSize',
        mutate: (profile) => {
          profile.results.exposure!.minGroupSize = 1;
        },
      },
      {
        path: 'export.scope',
        mutate: (profile) => {
          profile.encryption = { mode: 'none' };
          profile.storage.payloadAccessControl = { gate: 'none', encryption: 'none' };
          profile.export.scope = 'encrypted_envelopes_only';
        },
      },
      {
        path: 'surfaces.miniApp',
        mutate: (profile) => {
          profile.surfaces.miniApp = true;
          profile.surfaces.telegram = false;
        },
      },
      {
        path: 'storage.resources',
        mutate: (profile) => {
          profile.storage.resources = { questions: { stage: 'active' } };
        },
      },
    ];

    for (const { path, mutate } of cases) {
      const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
      profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
      mutate(profile);
      expect(validateSessionModeProfile(profile).issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ path })]),
      );
      expect(validateSessionModeProfile(profile).valid).toBe(false);
    }
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
