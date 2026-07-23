import {
  SESSION_WIZARD_DRAFT_CACHE_MAX_BYTES,
  SESSION_WIZARD_CACHE_KEY,
  clearSessionWizardDraftCache,
  readSessionWizardDraftCache,
  writeSessionWizardDraftCache,
} from './sessionWizardDraftCache.js';

type MemoryStorage = {
  getItem: jest.Mock<any, any>;
  setItem: jest.Mock<any, any>;
  removeItem: jest.Mock<any, any>;
};

const createMemoryStorage = (): MemoryStorage => {
  const data = new Map<string, string>();
  return {
    getItem: jest.fn((key) => (data.has(key) ? data.get(key) : null)),
    setItem: jest.fn((key, value) => {
      data.set(key, String(value));
    }),
    removeItem: jest.fn((key) => {
      data.delete(key);
    }),
  };
};

describe('sessionWizardDraftCache', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('preserves the legacy SessionWizard draft key', () => {
    expect(SESSION_WIZARD_CACHE_KEY).toBe('ce:sessionWizardDraft:v1');
  });

  it('uses a wizard-sized cache budget instead of the generic JSON helper default', () => {
    expect(SESSION_WIZARD_DRAFT_CACHE_MAX_BYTES).toBe(4 * 1024 * 1024);
    const storage = createMemoryStorage();
    const payload = {
      draft: {
        slug: 'large-draft',
        sessionName: 'Large Draft',
        sessionInfo: 'x'.repeat(256 * 1024 + 1),
      },
    };

    const result = writeSessionWizardDraftCache(payload, { storage });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        key: SESSION_WIZARD_CACHE_KEY,
      }),
    );
    expect(readSessionWizardDraftCache({ storage })).toEqual(payload);
  });

  it('reads and writes draft payloads through JSON storage helpers', () => {
    const storage = createMemoryStorage();
    const payload = {
      draft: { slug: 'edge', sessionName: 'Edge Session' },
      encryptionGates: [{ id: 'gate-1' }],
    };

    expect(writeSessionWizardDraftCache(payload, { storage })).toEqual(
      expect.objectContaining({
        ok: true,
        key: SESSION_WIZARD_CACHE_KEY,
      }),
    );
    expect(readSessionWizardDraftCache({ storage })).toEqual(payload);
  });

  it('never writes Worker credentials or live deployment proof into browser storage', () => {
    const storage = createMemoryStorage();

    expect(
      writeSessionWizardDraftCache(
        {
          persistWorkerSecrets: true,
          workerSecrets: {
            openaiKey: 'sk-browser-secret',
            faucetPrivateKey: '0xprivate',
            litApiBase: 'https://lit.example',
            litGroupId: 'group-1',
          },
          deployForm: {
            apiToken: 'cloudflare-token',
            workerName: 'safe-name',
          },
          workerRequirementProof: {
            secretFingerprintSalt: 'secret-salt',
          },
          sponsoredBundleKey: 'bundle-secret',
        },
        { storage },
      ),
    ).toEqual(expect.objectContaining({ ok: true }));

    const stored = JSON.parse(storage.getItem(SESSION_WIZARD_CACHE_KEY) || '{}');
    expect(stored).toEqual({
      persistWorkerSecrets: false,
      workerSecrets: {
        litApiBase: 'https://lit.example',
        litGroupId: 'group-1',
      },
      deployForm: {
        workerName: 'safe-name',
      },
    });
    expect(JSON.stringify(stored)).not.toContain('secret');
    expect(JSON.stringify(stored)).not.toContain('0xprivate');
    expect(JSON.stringify(stored)).not.toContain('cloudflare-token');
  });

  it('writes ordinary drafts to tab-scoped storage without recreating the shared key', () => {
    const payload = { sessionId: 'tab-id', draft: { slug: 'tab-session' } };

    expect(writeSessionWizardDraftCache(payload)).toEqual(expect.objectContaining({ ok: true }));
    expect(JSON.parse(sessionStorage.getItem(SESSION_WIZARD_CACHE_KEY) || '{}')).toEqual(payload);
    expect(localStorage.getItem(SESSION_WIZARD_CACHE_KEY)).toBeNull();
  });

  it('seeds tab-scoped storage from the legacy shared draft and removes the legacy copy', () => {
    const legacyDraft = { sessionId: 'legacy-id', draft: { slug: 'legacy-session' } };
    localStorage.setItem(SESSION_WIZARD_CACHE_KEY, JSON.stringify(legacyDraft));

    expect(readSessionWizardDraftCache()).toEqual(legacyDraft);
    expect(JSON.parse(sessionStorage.getItem(SESSION_WIZARD_CACHE_KEY) || '{}')).toEqual(legacyDraft);
    expect(localStorage.getItem(SESSION_WIZARD_CACHE_KEY)).toBeNull();
  });

  it('purges credentials while migrating a legacy shared draft', () => {
    localStorage.setItem(
      SESSION_WIZARD_CACHE_KEY,
      JSON.stringify({
        sessionId: 'legacy-id',
        draft: {
          slug: 'legacy-session',
          ai: { providers: { openai: { apiKey: 'legacy-draft-secret' } } },
          faucet: { amountEth: '0.001', privateKey: 'legacy-faucet-secret' },
        },
        persistWorkerSecrets: true,
        workerSecrets: {
          anthropicKey: 'legacy-secret',
          litActionCid: 'bafy-public-action',
        },
        deployForm: {
          apiToken: 'legacy-cloudflare-token',
          workerName: 'legacy-worker',
        },
      }),
    );

    expect(readSessionWizardDraftCache()).toEqual({
      sessionId: 'legacy-id',
      draft: {
        slug: 'legacy-session',
        ai: {},
        faucet: { amountEth: '0.001' },
      },
      persistWorkerSecrets: false,
      workerSecrets: { litActionCid: 'bafy-public-action' },
      deployForm: { workerName: 'legacy-worker' },
    });
    expect(localStorage.getItem(SESSION_WIZARD_CACHE_KEY)).toBeNull();
    expect(sessionStorage.getItem(SESSION_WIZARD_CACHE_KEY)).not.toContain('legacy-secret');
    expect(sessionStorage.getItem(SESSION_WIZARD_CACHE_KEY)).not.toContain('legacy-cloudflare-token');
    expect(sessionStorage.getItem(SESSION_WIZARD_CACHE_KEY)).not.toContain('legacy-draft-secret');
    expect(sessionStorage.getItem(SESSION_WIZARD_CACHE_KEY)).not.toContain('legacy-faucet-secret');
  });

  it('keeps the tab-scoped copy usable when the legacy draft cannot be removed', () => {
    const legacyDraft = { sessionId: 'legacy-id', draft: { slug: 'legacy-session' } };
    localStorage.setItem(SESSION_WIZARD_CACHE_KEY, JSON.stringify(legacyDraft));
    const originalRemoveItem = Storage.prototype.removeItem;
    const removeSpy = jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(function removeItem(key) {
      if (this === localStorage && key === SESSION_WIZARD_CACHE_KEY) throw new Error('storage denied');
      return originalRemoveItem.call(this, key);
    });

    try {
      expect(readSessionWizardDraftCache()).toEqual(legacyDraft);
      expect(JSON.parse(sessionStorage.getItem(SESSION_WIZARD_CACHE_KEY) || '{}')).toEqual(legacyDraft);
      expect(JSON.parse(localStorage.getItem(SESSION_WIZARD_CACHE_KEY) || '{}')).toEqual(legacyDraft);
      const newDraft = { draft: { slug: 'new-draft' } };
      expect(writeSessionWizardDraftCache(newDraft, { expectedCachedPayload: legacyDraft })).toEqual(
        expect.objectContaining({ ok: true, status: 'ok' }),
      );
      expect(JSON.parse(sessionStorage.getItem(SESSION_WIZARD_CACHE_KEY) || '{}')).toEqual(newDraft);
    } finally {
      removeSpy.mockRestore();
    }
  });

  it('does not let a stale legacy shared key block an ordinary tab autosave', () => {
    const legacyDraft = { sessionId: 'legacy-id', draft: { slug: 'legacy-session' } };
    const tabDraft = { sessionId: 'tab-id', draft: { slug: 'tab-session' } };
    localStorage.setItem(SESSION_WIZARD_CACHE_KEY, JSON.stringify(legacyDraft));

    expect(writeSessionWizardDraftCache(tabDraft)).toEqual(expect.objectContaining({ ok: true, status: 'ok' }));
    expect(JSON.parse(sessionStorage.getItem(SESSION_WIZARD_CACHE_KEY) || '{}')).toEqual(tabDraft);
    expect(JSON.parse(localStorage.getItem(SESSION_WIZARD_CACHE_KEY) || '{}')).toEqual(legacyDraft);
  });

  it('lets two tab-scoped copies diverge and clear independently after legacy migration', () => {
    const firstTabStorage = createMemoryStorage();
    const secondTabStorage = createMemoryStorage();
    const migratedDraft = { sessionId: 'legacy-id', draft: { slug: 'legacy-session', sessionName: 'Legacy' } };
    const firstDraft = { sessionId: 'first-id', draft: { slug: 'first-session', sessionName: 'First edit' } };
    const secondDraft = { sessionId: 'second-id', draft: { slug: 'second-session', sessionName: 'Second edit' } };

    // Model two tabs that copied the legacy value before either observed the
    // shared-key deletion, then prove all ongoing writes are isolated.
    writeSessionWizardDraftCache(migratedDraft, { storage: firstTabStorage });
    writeSessionWizardDraftCache(migratedDraft, { storage: secondTabStorage });
    writeSessionWizardDraftCache(firstDraft, { storage: firstTabStorage, expectedCachedPayload: migratedDraft });
    writeSessionWizardDraftCache(secondDraft, { storage: secondTabStorage, expectedCachedPayload: migratedDraft });

    expect(readSessionWizardDraftCache({ storage: firstTabStorage })).toEqual(firstDraft);
    expect(readSessionWizardDraftCache({ storage: secondTabStorage })).toEqual(secondDraft);

    expect(
      clearSessionWizardDraftCache({
        storage: firstTabStorage,
        expectedPublicationIdentity: { slug: 'first-session', sessionId: 'first-id' },
        clearPendingSbtDrafts: () => ({ ok: true, removed: 0, failed: 0, status: 'ok' }),
      }),
    ).toEqual(expect.objectContaining({ ok: true }));

    expect(readSessionWizardDraftCache({ storage: firstTabStorage })).toBeNull();
    expect(readSessionWizardDraftCache({ storage: secondTabStorage })).toEqual(secondDraft);
  });

  it('guards an observed foreign draft from a later stale ordinary write', () => {
    const storage = createMemoryStorage();
    const originalDraft = { sessionId: 'session-a', draft: { slug: 'session-a', sessionName: 'Original' } };
    const editedDraft = { sessionId: 'session-a', draft: { slug: 'session-a', sessionName: 'Edited' } };
    const foreignDraft = { sessionId: 'session-b', draft: { slug: 'session-b', sessionName: 'Foreign' } };

    storage.setItem(SESSION_WIZARD_CACHE_KEY, JSON.stringify(originalDraft));
    expect(writeSessionWizardDraftCache(editedDraft, { storage, expectedCachedPayload: originalDraft })).toEqual(
      expect.objectContaining({ ok: true, status: 'ok' }),
    );
    storage.setItem(SESSION_WIZARD_CACHE_KEY, JSON.stringify(foreignDraft));

    expect(writeSessionWizardDraftCache(originalDraft, { storage, expectedCachedPayload: editedDraft })).toEqual({
      ok: true,
      bytes: 0,
      key: SESSION_WIZARD_CACHE_KEY,
      status: 'preserved-foreign-draft',
    });
    expect(readSessionWizardDraftCache({ storage })).toEqual(foreignDraft);
  });

  it('returns null for missing entries and recovers malformed tab storage for guarded autosave', () => {
    const storage = createMemoryStorage();

    expect(readSessionWizardDraftCache({ storage })).toBeNull();

    storage.setItem(SESSION_WIZARD_CACHE_KEY, '{bad-json');
    expect(readSessionWizardDraftCache({ storage })).toBeNull();
    expect(storage.getItem(SESSION_WIZARD_CACHE_KEY)).toBeNull();

    const replacement = { sessionId: 'replacement-id', draft: { slug: 'replacement' } };
    expect(writeSessionWizardDraftCache(replacement, { storage, expectedCachedPayload: null })).toEqual(
      expect.objectContaining({ ok: true, status: 'ok' }),
    );
    expect(readSessionWizardDraftCache({ storage })).toEqual(replacement);
  });

  it('recovers malformed tab storage before seeding a valid legacy draft', () => {
    const legacyDraft = { sessionId: 'legacy-id', draft: { slug: 'legacy-session' } };
    sessionStorage.setItem(SESSION_WIZARD_CACHE_KEY, '{bad-json');
    localStorage.setItem(SESSION_WIZARD_CACHE_KEY, JSON.stringify(legacyDraft));

    expect(readSessionWizardDraftCache()).toEqual(legacyDraft);
    expect(JSON.parse(sessionStorage.getItem(SESSION_WIZARD_CACHE_KEY) || '{}')).toEqual(legacyDraft);
    expect(localStorage.getItem(SESSION_WIZARD_CACHE_KEY)).toBeNull();
  });

  it('clears the draft key and delegates pending SBT draft cleanup', () => {
    const storage = createMemoryStorage();
    const clearPendingSbtDrafts = jest.fn(() => ({
      ok: true,
      removed: 1,
      failed: 0,
      status: 'ok' as const,
    }));
    storage.setItem(SESSION_WIZARD_CACHE_KEY, JSON.stringify({ draft: { slug: 'edge' } }));

    expect(clearSessionWizardDraftCache({ storage, clearPendingSbtDrafts })).toEqual({
      ok: true,
      removed: 2,
      failed: 0,
      status: 'ok',
      draft: { ok: true, removed: 1, failed: 0, status: 'ok' },
      pendingSbtDrafts: { ok: true, removed: 1, failed: 0, status: 'ok' },
      poisoned: false,
    });
    expect(storage.getItem(SESSION_WIZARD_CACHE_KEY)).toBeNull();
    expect(clearPendingSbtDrafts).toHaveBeenCalledTimes(1);
  });

  it('replaces a published draft with an identity-scoped terminal tombstone', () => {
    const storage = createMemoryStorage();
    const workerSettlement = {
      workerUrl: 'https://published-worker.example.test',
      slug: 'published-session',
      sessionId: 'published-id',
    };
    storage.setItem(
      SESSION_WIZARD_CACHE_KEY,
      JSON.stringify({
        sessionId: workerSettlement.sessionId,
        deployWorkerUrl: workerSettlement.workerUrl,
        draft: { slug: workerSettlement.slug, corsWorkerUrl: workerSettlement.workerUrl },
      }),
    );

    expect(
      clearSessionWizardDraftCache({
        storage,
        workerSettlement,
        clearPendingSbtDrafts: () => ({ ok: true, removed: 1, failed: 0, status: 'ok' }),
      }),
    ).toEqual(
      expect.objectContaining({
        ok: true,
        status: 'ok',
        poisoned: true,
        draft: expect.objectContaining({ ok: true, status: 'poisoned' }),
      }),
    );
    expect(readSessionWizardDraftCache({ storage })).toEqual({
      terminalWorkerSettlement: expect.objectContaining({
        version: 2,
        workerUrl: 'https://published-worker.example.test',
        slug: 'published-session',
        sessionId: 'published-id',
      }),
    });
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('preserves a newer foreign-tab draft when another identity finishes publishing', () => {
    const storage = createMemoryStorage();
    const clearPendingSbtDrafts = jest.fn(() => ({ ok: true, removed: 1, failed: 0, status: 'ok' as const }));
    const foreignDraft = {
      sessionId: 'foreign-id',
      deployWorkerUrl: 'https://foreign-worker.example.test',
      draft: {
        slug: 'foreign-session',
        corsWorkerUrl: 'https://foreign-worker.example.test',
        sessionName: 'Keep me',
      },
    };
    storage.setItem(SESSION_WIZARD_CACHE_KEY, JSON.stringify(foreignDraft));

    const result = clearSessionWizardDraftCache({
      storage,
      workerSettlement: {
        workerUrl: 'https://published-worker.example.test',
        slug: 'published-session',
        sessionId: 'published-id',
      },
      clearPendingSbtDrafts,
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        poisoned: false,
        draft: { ok: true, removed: 0, failed: 0, status: 'preserved-foreign-draft' },
      }),
    );
    expect(readSessionWizardDraftCache({ storage })).toEqual(foreignDraft);
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(clearPendingSbtDrafts).not.toHaveBeenCalled();
  });

  it('clears a matching decentralized publication without requiring a worker URL', () => {
    const storage = createMemoryStorage();
    storage.setItem(
      SESSION_WIZARD_CACHE_KEY,
      JSON.stringify({
        sessionId: '00112233-4455-6677-8899-aabbccddeeff',
        draft: { slug: 'decentralized-session', sessionName: 'Published on-chain' },
      }),
    );

    const result = clearSessionWizardDraftCache({
      storage,
      expectedPublicationIdentity: {
        slug: 'decentralized-session',
        sessionId: '0x00112233445566778899aabbccddeeff',
      },
      clearPendingSbtDrafts: () => ({ ok: true, removed: 0, failed: 0, status: 'ok' }),
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        draft: { ok: true, removed: 1, failed: 0, status: 'ok' },
      }),
    );
    expect(readSessionWizardDraftCache({ storage })).toBeNull();
  });

  it.each([
    ['session ID', 'published-decentralized', 'ffeeddcc-bbaa-9988-7766-554433221100'],
    ['slug', 'foreign-decentralized', '00112233-4455-6677-8899-aabbccddeeff'],
  ])('preserves a foreign-tab decentralized draft when its %s does not match', (_field, slug, sessionId) => {
    const storage = createMemoryStorage();
    const foreignDraft = {
      sessionId,
      draft: { slug, sessionName: 'Keep this draft' },
    };
    storage.setItem(SESSION_WIZARD_CACHE_KEY, JSON.stringify(foreignDraft));

    const result = clearSessionWizardDraftCache({
      storage,
      expectedPublicationIdentity: {
        slug: 'published-decentralized',
        sessionId: '0x00112233445566778899aabbccddeeff',
      },
      clearPendingSbtDrafts: () => ({ ok: true, removed: 0, failed: 0, status: 'ok' }),
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        draft: { ok: true, removed: 0, failed: 0, status: 'preserved-foreign-draft' },
      }),
    );
    expect(readSessionWizardDraftCache({ storage })).toEqual(foreignDraft);
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('fails closed instead of clearing when an explicit publication identity is invalid', () => {
    const storage = createMemoryStorage();
    const foreignDraft = { sessionId: 'foreign-id', draft: { slug: 'foreign-session' } };
    storage.setItem(SESSION_WIZARD_CACHE_KEY, JSON.stringify(foreignDraft));

    const result = clearSessionWizardDraftCache({
      storage,
      expectedPublicationIdentity: { slug: '', sessionId: '' },
      clearPendingSbtDrafts: () => ({ ok: true, removed: 0, failed: 0, status: 'ok' }),
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        draft: { ok: false, removed: 0, failed: 1, status: 'invalid-identity' },
      }),
    );
    expect(readSessionWizardDraftCache({ storage })).toEqual(foreignDraft);
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it.each([
    [
      'read failure',
      () => {
        throw new Error('storage denied');
      },
      'read-failed',
    ],
    ['parse failure', () => '{bad-json', 'parse-failed'],
  ])('fails closed on a cache %s while comparing publication ownership', (_label, readValue, status) => {
    const storage = createMemoryStorage();
    storage.getItem.mockImplementation(readValue);

    const result = clearSessionWizardDraftCache({
      storage,
      expectedPublicationIdentity: { slug: 'published-session', sessionId: 'published-id' },
      clearPendingSbtDrafts: () => ({ ok: true, removed: 0, failed: 0, status: 'ok' }),
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        draft: { ok: false, removed: 0, failed: 1, status },
      }),
    );
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('retains the matching draft and reports failure when the terminal tombstone cannot be written', () => {
    const storage = createMemoryStorage();
    const clearPendingSbtDrafts = jest.fn(() => ({ ok: true, removed: 1, failed: 0, status: 'ok' as const }));
    const workerSettlement = {
      workerUrl: 'https://published-worker.example.test',
      slug: 'published-session',
      sessionId: 'published-id',
    };
    const cachedDraft = {
      sessionId: workerSettlement.sessionId,
      deployWorkerUrl: workerSettlement.workerUrl,
      draft: { slug: workerSettlement.slug, corsWorkerUrl: workerSettlement.workerUrl },
    };
    storage.setItem(SESSION_WIZARD_CACHE_KEY, JSON.stringify(cachedDraft));
    storage.setItem.mockImplementationOnce(() => {
      throw new Error('quota');
    });

    const result = clearSessionWizardDraftCache({
      storage,
      workerSettlement,
      clearPendingSbtDrafts,
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        poisoned: false,
        draft: { ok: false, removed: 0, failed: 1, status: 'write-failed' },
      }),
    );
    expect(readSessionWizardDraftCache({ storage })).toEqual(cachedDraft);
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(clearPendingSbtDrafts).not.toHaveBeenCalled();
  });

  it('preserves pending SBT drafts when matching draft removal fails', () => {
    const storage = createMemoryStorage();
    const clearPendingSbtDrafts = jest.fn(() => ({ ok: true, removed: 1, failed: 0, status: 'ok' as const }));
    storage.setItem(
      SESSION_WIZARD_CACHE_KEY,
      JSON.stringify({
        sessionId: 'published-id',
        draft: { slug: 'published-session' },
      }),
    );
    storage.removeItem.mockImplementationOnce(() => {
      throw new Error('storage denied');
    });

    const result = clearSessionWizardDraftCache({
      storage,
      expectedPublicationIdentity: { slug: 'published-session', sessionId: 'published-id' },
      clearPendingSbtDrafts,
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        draft: { ok: false, removed: 0, failed: 1, status: 'partial-failure' },
      }),
    );
    expect(clearPendingSbtDrafts).not.toHaveBeenCalled();
  });
});
