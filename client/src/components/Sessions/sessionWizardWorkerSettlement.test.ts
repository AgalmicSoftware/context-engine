import {
  SESSION_WIZARD_WORKER_SETTLEMENT_KEY,
  clearSessionWizardWorkerSettlement,
  isSessionWizardWorkerSettlementForWorker,
  readSessionWizardWorkerSettlement,
  writeSessionWizardWorkerSettlement,
} from './sessionWizardWorkerSettlement';

describe('sessionWizardWorkerSettlement', () => {
  beforeEach(() => localStorage.clear());

  it('persists only the durable worker-canonical settlement identity', () => {
    const result = writeSessionWizardWorkerSettlement({
      workerUrl: 'https://published-worker.example.test/',
      slug: 'published-session',
      sessionId: '0x00112233445566778899aabbccddeeff',
      settledAt: 1_725_000_000_000,
    });

    expect(result.ok).toBe(true);
    expect(JSON.parse(localStorage.getItem(SESSION_WIZARD_WORKER_SETTLEMENT_KEY) || '{}')).toEqual({
      version: 1,
      workerUrl: 'https://published-worker.example.test',
      slug: 'published-session',
      sessionId: '0x00112233445566778899aabbccddeeff',
      settledAt: 1_725_000_000_000,
    });
    expect(readSessionWizardWorkerSettlement()).toEqual({
      version: 1,
      workerUrl: 'https://published-worker.example.test',
      slug: 'published-session',
      sessionId: '0x00112233445566778899aabbccddeeff',
      settledAt: 1_725_000_000_000,
    });
  });

  it('matches normalized worker URLs and rejects corrupt or foreign markers', () => {
    expect(
      isSessionWizardWorkerSettlementForWorker(
        {
          version: 1,
          workerUrl: 'https://published-worker.example.test',
          slug: 'published-session',
          sessionId: 'session-id',
          settledAt: 1,
        },
        'https://published-worker.example.test/',
      ),
    ).toBe(true);
    expect(
      isSessionWizardWorkerSettlementForWorker(
        {
          version: 1,
          workerUrl: 'https://published-worker.example.test',
          slug: 'published-session',
          sessionId: 'session-id',
          settledAt: 1,
        },
        'https://other-worker.example.test',
      ),
    ).toBe(false);

    localStorage.setItem(SESSION_WIZARD_WORKER_SETTLEMENT_KEY, JSON.stringify({ workerUrl: 'javascript:bad' }));
    expect(readSessionWizardWorkerSettlement()).toBeNull();
  });

  it('reports write and clear failures without throwing', () => {
    const writeStorage = { setItem: jest.fn(() => { throw new Error('quota'); }) };
    expect(
      writeSessionWizardWorkerSettlement(
        { workerUrl: 'https://published-worker.example.test', slug: 'published-session', sessionId: 'id' },
        { storage: writeStorage },
      ),
    ).toEqual(expect.objectContaining({ ok: false, status: 'write-failed' }));

    const clearStorage = { removeItem: jest.fn(() => { throw new Error('denied'); }) };
    expect(clearSessionWizardWorkerSettlement({ storage: clearStorage })).toEqual({
      ok: false,
      removed: 0,
      failed: 1,
      status: 'partial-failure',
    });
  });
});
