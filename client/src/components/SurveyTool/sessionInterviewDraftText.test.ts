import { exportDraftText, syncDraftText } from './sessionInterviewDraftText';
import { keepConsentWithdrawals, resolveConsentFlags, summarizeInterviewConsent } from './sessionInterviewConsent';
import { fetchWorkerWithAuth } from '../../utilities/worker/workerAuth';

jest.mock('../../utilities/worker/corsProxy', () => ({ getCorsProxyUrlOrThrow: async () => 'https://worker.test/' }));
jest.mock('../../utilities/worker/workerAuth', () => ({ fetchWorkerWithAuth: jest.fn() }));

const fetchMock = jest.mocked(fetchWorkerWithAuth);
const reply = (body: unknown, ok = true) => ({ ok, json: async () => body }) as unknown as Response;
const context = { sessionConfig: { sessionId: '0x1' }, sessionSlug: 'demo' };
const calls = () => fetchMock.mock.calls.map(([url, init]) => [url, JSON.parse(String(init?.body))]);

beforeEach(() => {
  fetchMock.mockReset();
});

describe('syncDraftText', () => {
  it('removes before it stores, and stores nothing when the removal fails', async () => {
    fetchMock.mockResolvedValue(reply({ ok: true }));
    await syncDraftText({ put: [{ questionId: 'q2', aiComment: 'Text' }], remove: ['q1'] }, context);
    expect(calls()).toEqual([
      ['https://worker.test/storage/draft-text/delete', { questionIds: ['q1'] }],
      ['https://worker.test/storage/draft-text/put', { items: [{ questionId: 'q2', aiComment: 'Text' }] }],
    ]);
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(reply({ error: 'Refused.' }, false));
    await expect(
      syncDraftText({ put: [{ questionId: 'q2', aiComment: 'Text' }], remove: ['q1'] }, context),
    ).rejects.toThrow('Refused.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends nothing when there is nothing to change', async () => {
    await syncDraftText({ put: [], remove: [] }, context);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('exportDraftText', () => {
  it('joins every page into one file', async () => {
    const page = (rows: unknown[], cursor = '') => ({
      type: 'ce_draft_text_export',
      version: 1,
      sessionSlug: 'demo',
      exportedAt: '2026-11-20T10:00:00Z',
      rows,
      cursor,
    });
    fetchMock.mockResolvedValueOnce(reply(page([{ questionId: 'q1' }], 'next')));
    fetchMock.mockResolvedValueOnce(reply(page([{ questionId: 'q2' }])));
    const file = await exportDraftText(context);
    expect(file.rows).toEqual([{ questionId: 'q1' }, { questionId: 'q2' }]);
    expect(calls()[1][1]).toEqual({ cursor: 'next' });
  });
});

describe('draft text consent', () => {
  it('reads a saved consent marker as consent, and nothing else', () => {
    expect(resolveConsentFlags({ draftTextConsent: true }).includeDraftText).toBe(true);
    expect(resolveConsentFlags({ draftTextConsent: true, includeDraftText: false }).includeDraftText).toBe(false);
    expect(resolveConsentFlags({ predictionComparison: {} }).includeDraftText).toBe(false);
  });

  it('keeps a withdrawal of the text alone, without withdrawing research', () => {
    const before = { includePredictionComparison: true, predictionComparison: {}, draftTextConsent: true };
    const kept = keepConsentWithdrawals(before, { includePredictionComparison: true, predictionComparison: {} });
    expect(kept).not.toBeNull();
    expect(resolveConsentFlags(kept).includeDraftText).toBe(false);
    expect(resolveConsentFlags(kept).includePredictionComparison).toBe(true);
  });

  it('withdrawing research withdraws the text too', () => {
    const before = { includePredictionComparison: true, predictionComparison: {}, draftTextConsent: true };
    const kept = keepConsentWithdrawals(before, { includePredictionComparison: false });
    expect(resolveConsentFlags(kept)).toMatchObject({ includePredictionComparison: false, includeDraftText: false });
  });

  it('shows new drafts ticked and older saved answers as they were saved', () => {
    const choices = summarizeInterviewConsent({
      drafts: [{ questionId: 'q1' }, { questionId: 'q2' }],
      saved: { q2: { predictionComparison: {} } },
      overrides: {},
      defaults: { ai: true, comparison: true, name: false, draftText: true },
    });
    expect(choices.draftTextChoice).toEqual({ checked: false, mixed: true });
    expect(choices.comparisonChoice).toEqual({ checked: true, mixed: false });
  });
});
