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

  it('returns null for missing or malformed cache entries without throwing', () => {
    const storage = createMemoryStorage();

    expect(readSessionWizardDraftCache({ storage })).toBeNull();

    storage.setItem(SESSION_WIZARD_CACHE_KEY, '{bad-json');
    expect(readSessionWizardDraftCache({ storage })).toBeNull();
  });

  it('clears the draft key and delegates pending SBT draft cleanup', () => {
    const storage = createMemoryStorage();
    const clearPendingSbtDrafts = jest.fn();
    storage.setItem(SESSION_WIZARD_CACHE_KEY, JSON.stringify({ draft: { slug: 'edge' } }));

    expect(clearSessionWizardDraftCache({ storage, clearPendingSbtDrafts })).toEqual({
      ok: true,
      removed: 1,
      failed: 0,
      status: 'ok',
    });
    expect(storage.getItem(SESSION_WIZARD_CACHE_KEY)).toBeNull();
    expect(clearPendingSbtDrafts).toHaveBeenCalledTimes(1);
  });
});
