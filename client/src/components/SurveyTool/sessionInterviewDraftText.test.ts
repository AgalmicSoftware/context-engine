import {
  exportDraftText,
  planDraftTextSync,
  resendPendingDraftTextDeletes,
  syncDraftText,
} from './sessionInterviewDraftText';
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

  it('sends in batches the Worker accepts', async () => {
    fetchMock.mockResolvedValue(reply({ ok: true }));
    const ids = Array.from({ length: 450 }, (_, index) => `q${index}`);
    await syncDraftText(
      { put: ids.slice(0, 30).map((questionId) => ({ questionId, aiComment: 'x' })), remove: ids },
      context,
    );
    expect(calls().map(([url, body]) => [url.split('/').pop(), (body.questionIds || body.items).length])).toEqual([
      ['delete', 200],
      ['delete', 200],
      ['delete', 50],
      ['put', 25],
      ['put', 5],
    ]);
  });

  it('sends nothing when there is nothing to change', async () => {
    await syncDraftText({ put: [], remove: [] }, context);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('a draft text delete that fails', () => {
  const signed = { ...context, account: '0xabc' };
  beforeEach(() => localStorage.clear());

  it('is kept and sent again on the next page load, without asking anyone to sign in', async () => {
    fetchMock.mockResolvedValueOnce(reply({ error: 'Busy.' }, false));
    await expect(syncDraftText({ put: [], remove: ['q1'] }, signed)).rejects.toThrow('Busy.');

    // Another account, or no one signed in, sends nothing.
    await resendPendingDraftTextDeletes({ ...signed, account: '0xdef' });
    await resendPendingDraftTextDeletes({ ...context, account: '' });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValue(reply({ ok: true }));
    await resendPendingDraftTextDeletes(signed);
    expect(calls()[1]).toEqual(['https://worker.test/storage/draft-text/delete', { questionIds: ['q1'] }]);
    // Signed in as the address that kept it, never as whoever is signed in now, and with no prompt.
    expect(fetchMock.mock.calls[1][2]).toEqual(expect.objectContaining({ prompt: false, requireAccount: '0xabc' }));

    // Sent once: nothing is left to resend.
    await resendPendingDraftTextDeletes(signed);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('is kept before it is sent, so a page closed while it waits still sends it on the next load', () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));
    // Its own address: this sync never settles, and syncs queue per address.
    void syncDraftText({ put: [], remove: ['q1'] }, { ...context, account: '0xclosed' });
    expect(JSON.parse(localStorage.getItem('ce:draft-text-pending-deletes:v1:demo|0xclosed') || '[]')).toEqual(['q1']);
  });

  it('is kept by address whatever the case or wallet kind', async () => {
    fetchMock.mockResolvedValueOnce(reply({ error: 'Busy.' }, false));
    await expect(syncDraftText({ put: [], remove: ['q1'] }, { ...context, account: '0xABC' })).rejects.toThrow();
    fetchMock.mockResolvedValue(reply({ ok: true }));
    await resendPendingDraftTextDeletes(signed);
    expect(calls()[1]).toEqual(['https://worker.test/storage/draft-text/delete', { questionIds: ['q1'] }]);
  });

  it('is not cleared by a resend that was already under way when a submit kept another', async () => {
    let finishResend: (value: Response) => void = () => undefined;
    fetchMock
      .mockResolvedValueOnce(reply({ error: 'Busy.' }, false))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => (finishResend = resolve)))
      .mockResolvedValueOnce(reply({ error: 'Busy.' }, false));
    await expect(syncDraftText({ put: [], remove: ['q1'] }, signed)).rejects.toThrow('Busy.');

    const resend = resendPendingDraftTextDeletes(signed);
    const submit = syncDraftText({ put: [], remove: ['q2'] }, signed);
    await new Promise((resolve) => setTimeout(resolve, 0));
    finishResend(reply({ ok: true }));
    await resend;
    await expect(submit).rejects.toThrow('Busy.');

    fetchMock.mockResolvedValue(reply({ ok: true }));
    await resendPendingDraftTextDeletes(signed);
    // The submit's delete is kept at once, so the resend under way carries it too; the submit still sends it.
    expect(calls().map(([, body]) => body.questionIds)).toEqual([['q1'], ['q1', 'q2'], ['q2'], ['q2']]);
  });

  it('goes out with the next submit, before its new text', async () => {
    fetchMock.mockResolvedValueOnce(reply({ error: 'Busy.' }, false));
    await expect(syncDraftText({ put: [], remove: ['q1'] }, signed)).rejects.toThrow('Busy.');
    fetchMock.mockResolvedValue(reply({ ok: true }));
    await syncDraftText({ put: [{ questionId: 'q1', aiComment: 'New' }], remove: ['q2'] }, signed);
    expect(calls().slice(1)).toEqual([
      ['https://worker.test/storage/draft-text/delete', { questionIds: ['q1', 'q2'] }],
      ['https://worker.test/storage/draft-text/put', { items: [{ questionId: 'q1', aiComment: 'New' }] }],
    ]);
    await resendPendingDraftTextDeletes(signed);
    expect(fetchMock).toHaveBeenCalledTimes(3);
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

describe('planDraftTextSync', () => {
  it('finds earlier consent saved under a lowercased question id', () => {
    const uploaded = [{ questionID: 'ceq_AbC', interviewProvenance: {} }];
    expect(
      planDraftTextSync({ sessionConfig: {}, uploaded, drafts: {}, earlier: { ceq_abc: { draftTextConsent: true } } }),
    ).toEqual({
      put: [],
      remove: ['ceq_AbC'],
    });
  });
});
