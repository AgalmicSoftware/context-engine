import {
  CREATE_SBT_FORM_CACHE_LEGACY_POLICY,
  LEGACY_CREATE_SBT_FORM_CACHE_KEY,
  getScopedCreateSbtFormCacheKey,
  hasCachedCreateSbtForm,
  hasMeaningfulCreateSbtFormPayload,
} from './sbtCreateFormCache.js';

describe('createSbtFormCache helpers', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('returns false when no cache exists', () => {
    expect(hasCachedCreateSbtForm()).toBe(false);
  });

  it('documents the legacy migration policy in code', () => {
    expect(CREATE_SBT_FORM_CACHE_LEGACY_POLICY).toEqual({
      legacyKey: LEGACY_CREATE_SBT_FORM_CACHE_KEY,
      scopedKeyPrefix: 'dg:createSbtFormCache:',
      legacyWritesAllowed: false,
      migration: 'read-migrate-clear',
      removeAfter: 'one public release after scoped create-SBT draft writes are verified',
    });
  });

  it('detects meaningful legacy create cache payloads', () => {
    sessionStorage.setItem(
      'createSbtFormCache',
      JSON.stringify({
        sbtName: 'Alpha',
        sbtDescription: 'Cached draft details',
      }),
    );

    expect(hasCachedCreateSbtForm()).toBe(true);
  });

  it('migrates legacy cache to the group-aware key when asked', () => {
    const legacyPayload = {
      sbtName: 'Alpha',
      sbtDescription: 'Cached draft details',
    };
    sessionStorage.setItem(LEGACY_CREATE_SBT_FORM_CACHE_KEY, JSON.stringify(legacyPayload));

    const found = hasCachedCreateSbtForm({
      sessionSlug: 'edge',
      migrateLegacyToSessionKey: true,
      clearInvalid: true,
    });

    expect(found).toBe(true);
    expect(sessionStorage.getItem(LEGACY_CREATE_SBT_FORM_CACHE_KEY)).toBeNull();
    expect(sessionStorage.getItem(getScopedCreateSbtFormCacheKey('edge'))).toBe(JSON.stringify(legacyPayload));
  });

  it('purges claim credentials from legacy and scoped draft storage', () => {
    const scopedKey = getScopedCreateSbtFormCacheKey('edge');
    sessionStorage.setItem(
      scopedKey,
      JSON.stringify({
        sbtName: 'Alpha',
        sbtDescription: 'Cached draft details',
        groupPassword: 'group-secret',
        passwordList: ['claim-secret'],
        sbtInviteLinks: ['https://example.test/session?gp=group-secret'],
        sbtDistribution: {
          distributionOption: 'groupPassword',
          invitePayload: 'nested-invite-secret',
          nested: {
            claimCodes: ['nested-claim-secret'],
          },
        },
      }),
    );

    expect(hasCachedCreateSbtForm({ sessionSlug: 'edge' })).toBe(true);
    const stored = sessionStorage.getItem(scopedKey) || '';
    expect(stored).not.toContain('group-secret');
    expect(stored).not.toContain('claim-secret');
    expect(stored).not.toContain('nested-invite-secret');
    expect(stored).not.toContain('nested-claim-secret');
    expect(JSON.parse(stored)).not.toHaveProperty('groupPassword');
  });

  it('leaves a legacy cache entry untouched when its stored session slug targets another session', () => {
    const legacyPayload = {
      sbtName: 'Alpha',
      sbtDescription: 'Cached draft details',
      _sessionSlug: 'other-session',
    };
    sessionStorage.setItem(LEGACY_CREATE_SBT_FORM_CACHE_KEY, JSON.stringify(legacyPayload));

    const found = hasCachedCreateSbtForm({
      sessionSlug: 'edge',
      migrateLegacyToSessionKey: true,
      clearInvalid: true,
    });

    expect(found).toBe(false);
    expect(sessionStorage.getItem(LEGACY_CREATE_SBT_FORM_CACHE_KEY)).toBe(JSON.stringify(legacyPayload));
    expect(sessionStorage.getItem(getScopedCreateSbtFormCacheKey('edge'))).toBeNull();
  });

  it('normalizes the general session alias to the shared group-aware cache key', () => {
    sessionStorage.setItem(
      getScopedCreateSbtFormCacheKey(''),
      JSON.stringify({
        sbtName: 'Alpha',
        tags: ['alpha'],
      }),
    );

    expect(getScopedCreateSbtFormCacheKey('general')).toBe('dg:createSbtFormCache:');
    expect(hasCachedCreateSbtForm({ sessionSlug: 'general' })).toBe(true);
  });

  it('clears malformed scoped cache payloads when requested', () => {
    const scopedKey = getScopedCreateSbtFormCacheKey('edge');
    sessionStorage.setItem(scopedKey, '{bad json');

    expect(
      hasCachedCreateSbtForm({
        sessionSlug: 'edge',
        clearInvalid: true,
      }),
    ).toBe(false);
    expect(sessionStorage.getItem(scopedKey)).toBeNull();
  });

  it('clears non-object scoped cache payloads when requested', () => {
    const scopedKey = getScopedCreateSbtFormCacheKey('edge');
    sessionStorage.setItem(scopedKey, JSON.stringify('not-a-draft'));

    expect(
      hasCachedCreateSbtForm({
        sessionSlug: 'edge',
        clearInvalid: true,
      }),
    ).toBe(false);
    expect(sessionStorage.getItem(scopedKey)).toBeNull();
  });

  it('requires a name plus additional draft data before treating a cache payload as meaningful', () => {
    expect(hasMeaningfulCreateSbtFormPayload({ sbtName: 'Alpha' })).toBe(false);
    expect(hasMeaningfulCreateSbtFormPayload({ sbtName: 'Alpha', groupPassword: 'secret' })).toBe(false);
    expect(hasMeaningfulCreateSbtFormPayload({ tags: ['alpha'] })).toBe(false);
    expect(
      hasMeaningfulCreateSbtFormPayload({
        sbtName: 'Alpha',
        documentUrl: 'https://example.com/pending-doc.pdf',
      }),
    ).toBe(true);
    expect(
      hasMeaningfulCreateSbtFormPayload({
        sbtName: 'Alpha',
        documentURLs: ['https://example.com/doc.pdf'],
      }),
    ).toBe(true);
    expect(
      hasMeaningfulCreateSbtFormPayload({
        sbtName: 'Alpha',
        sbtDistribution: { isLimited: true },
      }),
    ).toBe(true);
    expect(
      hasMeaningfulCreateSbtFormPayload({
        sbtName: 'Alpha',
        metadataLockGateIds: { description: ['test-gate'] },
      }),
    ).toBe(true);
    expect(
      hasMeaningfulCreateSbtFormPayload({
        sbtName: 'Alpha',
        sbtDistribution: {
          distributionOption: 'anyoneCanMint',
          burnAuth: 'AdminOnly',
          network: 84532,
        },
      }),
    ).toBe(false);
    expect(hasMeaningfulCreateSbtFormPayload({})).toBe(false);
  });
});
