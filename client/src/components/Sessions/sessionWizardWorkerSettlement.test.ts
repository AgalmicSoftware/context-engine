import {
  clearSessionWizardWorkerSettlement,
  getSessionWizardWorkerSettlementStorageKey,
  isSessionWizardWorkerSettlementForIdentity,
  readSessionWizardWorkerSettlement,
  writeSessionWizardWorkerSettlement,
} from './sessionWizardWorkerSettlement';

const publishedIdentity = {
  workerUrl: 'https://published-worker.example.test/',
  slug: 'published-session',
  sessionId: '0x00112233445566778899aabbccddeeff',
};

describe('sessionWizardWorkerSettlement', () => {
  beforeEach(() => localStorage.clear());

  it('persists independent durable records per worker and session identity', () => {
    const result = writeSessionWizardWorkerSettlement({
      ...publishedIdentity,
      settledAt: 1_725_000_000_000,
    });
    const secondIdentity = {
      workerUrl: 'https://published-worker.example.test/',
      slug: 'second-session',
      sessionId: 'second-id',
    };
    expect(writeSessionWizardWorkerSettlement({ ...secondIdentity, settledAt: 1_725_000_000_001 }).ok).toBe(true);

    expect(result.ok).toBe(true);
    const publishedKey = getSessionWizardWorkerSettlementStorageKey(publishedIdentity);
    const secondKey = getSessionWizardWorkerSettlementStorageKey(secondIdentity);
    expect(publishedKey).not.toBe(secondKey);
    expect(JSON.parse(localStorage.getItem(publishedKey) || '{}')).toEqual({
      version: 2,
      workerUrl: 'https://published-worker.example.test',
      slug: 'published-session',
      sessionId: '0x00112233445566778899aabbccddeeff',
      settledAt: 1_725_000_000_000,
    });
    expect(readSessionWizardWorkerSettlement({ identity: publishedIdentity })).toEqual({
      version: 2,
      workerUrl: 'https://published-worker.example.test',
      slug: 'published-session',
      sessionId: '0x00112233445566778899aabbccddeeff',
      settledAt: 1_725_000_000_000,
    });
    expect(readSessionWizardWorkerSettlement({ identity: secondIdentity })).toEqual(
      expect.objectContaining({ slug: 'second-session', sessionId: 'second-id' }),
    );
  });

  it('uses one canonical record for equivalent UUID and bytes16 session identities', () => {
    const uuidIdentity = {
      ...publishedIdentity,
      sessionId: '00112233-4455-6677-8899-aabbccddeeff',
    };
    const hexIdentity = {
      ...publishedIdentity,
      sessionId: '0x00112233445566778899aabbccddeeff',
    };

    expect(getSessionWizardWorkerSettlementStorageKey(uuidIdentity)).toBe(
      getSessionWizardWorkerSettlementStorageKey(hexIdentity),
    );
    expect(writeSessionWizardWorkerSettlement({ ...uuidIdentity, settledAt: 10 }).ok).toBe(true);
    expect(readSessionWizardWorkerSettlement({ identity: hexIdentity })).toEqual(
      expect.objectContaining({
        sessionId: hexIdentity.sessionId,
        settledAt: 10,
      }),
    );
    expect(
      isSessionWizardWorkerSettlementForIdentity(
        readSessionWizardWorkerSettlement({ identity: hexIdentity }),
        uuidIdentity,
      ),
    ).toBe(true);
  });

  it('matches the complete normalized identity and rejects corrupt or foreign markers', () => {
    const settlement = {
      version: 2 as const,
      workerUrl: 'https://published-worker.example.test',
      slug: 'published-session',
      sessionId: 'session-id',
      settledAt: 1,
    };
    expect(
      isSessionWizardWorkerSettlementForIdentity(settlement, {
        workerUrl: 'https://published-worker.example.test/',
        slug: 'published-session',
        sessionId: 'session-id',
      }),
    ).toBe(true);
    expect(
      isSessionWizardWorkerSettlementForIdentity(settlement, {
        workerUrl: 'https://published-worker.example.test',
        slug: 'other-session',
        sessionId: 'session-id',
      }),
    ).toBe(false);

    const corruptKey = getSessionWizardWorkerSettlementStorageKey(publishedIdentity);
    localStorage.setItem(corruptKey, JSON.stringify({ version: 2, workerUrl: 'javascript:bad' }));
    expect(readSessionWizardWorkerSettlement({ identity: publishedIdentity })).toBeNull();
    expect(localStorage.getItem(corruptKey)).toBeNull();
  });

  it('clears only the requested settlement record', () => {
    const secondIdentity = {
      workerUrl: 'https://published-worker.example.test',
      slug: 'second-session',
      sessionId: 'second-id',
    };
    writeSessionWizardWorkerSettlement(publishedIdentity);
    writeSessionWizardWorkerSettlement(secondIdentity);

    expect(clearSessionWizardWorkerSettlement(publishedIdentity).ok).toBe(true);
    expect(readSessionWizardWorkerSettlement({ identity: publishedIdentity })).toBeNull();
    expect(readSessionWizardWorkerSettlement({ identity: secondIdentity })).not.toBeNull();
  });

  it('reports write and clear failures without throwing', () => {
    const writeStorage = {
      setItem: jest.fn(() => {
        throw new Error('quota');
      }),
    };
    expect(
      writeSessionWizardWorkerSettlement(
        { workerUrl: 'https://published-worker.example.test', slug: 'published-session', sessionId: 'id' },
        { storage: writeStorage },
      ),
    ).toEqual(expect.objectContaining({ ok: false, status: 'write-failed' }));

    const clearStorage = {
      removeItem: jest.fn(() => {
        throw new Error('denied');
      }),
    };
    expect(clearSessionWizardWorkerSettlement(publishedIdentity, { storage: clearStorage })).toEqual({
      ok: false,
      removed: 0,
      failed: 1,
      status: 'partial-failure',
    });
  });
});
