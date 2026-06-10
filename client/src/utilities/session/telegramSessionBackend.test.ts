import {
  buildTelegramPreferenceAnswer,
  loadTelegramBucketCards,
  loadTelegramResultsDataset,
  submitTelegramAnswer,
} from './telegramSessionBackend';
import { getTelegramAgentBridgeCredentials } from '../worker/workerAuth.js';

jest.mock('../worker/workerAuth.js', () => ({
  getTelegramAgentBridgeCredentials: jest.fn(),
}));

const mockedCredentials = getTelegramAgentBridgeCredentials as jest.Mock;

const question = {
  questionId: 'q1',
  questionType: 'binary',
  prompt: 'Should agents disclose?',
  options: [],
  tags: [],
  answeredByUser: false,
  answerable: true,
};

const okJson = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const errJson = (status: number, body: unknown = {}) => ({ ok: false, status, json: async () => body });

describe('telegramSessionBackend', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCredentials.mockReturnValue({
      token: `ceagt_${'A'.repeat(32)}`,
      agentBridgeUrl: 'https://bridge.example',
      sessionSlug: 'edge',
    });
  });

  it('builds worker preference answers by question type', () => {
    expect(buildTelegramPreferenceAnswer(question, 'Agree')).toEqual({
      questionType: 'binary',
      value: 'agree',
      comments: '',
    });
    expect(buildTelegramPreferenceAnswer({ ...question, questionType: 'rating' }, { value: 7 })).toEqual({
      questionType: 'rating',
      value: 7,
      comments: '',
    });
    expect(buildTelegramPreferenceAnswer({ ...question, questionType: 'multichoice' }, ['Geo', 'Index'])).toEqual({
      questionType: 'multichoice',
      values: ['Geo', 'Index'],
      comments: '',
    });
    expect(buildTelegramPreferenceAnswer({ ...question, questionType: 'freeform' }, { text: 'Useful agents coordinate.' })).toEqual({
      questionType: 'freeform',
      text: 'Useful agents coordinate.',
      comments: '',
    });
  });

  it('submits a human-approved answer through the preferences route', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(okJson({
      ok: true,
      submittedCount: 1,
      reviewRequired: false,
    }));

    const result = await submitTelegramAnswer({
      sessionSlug: 'edge',
      question,
      answer: 'yes',
      fetchImpl: fetchImpl as never,
    });

    expect(result.ok).toBe(true);
    expect(result.submittedCount).toBe(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://bridge.example/telegram/agent/api/preferences',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Bearer ceagt_/),
          'content-type': 'application/json',
        }),
      })
    );
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body).toMatchObject({
      sessionSlug: 'edge',
      submit: true,
      humanApproved: true,
      preferences: [{
        questionId: 'q1',
        answer: { questionType: 'binary', value: 'agree' },
      }],
    });
  });

  it('reports submit auth failures without throwing', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(errJson(401, { ok: false, reason: 'agent_token_not_found' }));
    const result = await submitTelegramAnswer({
      sessionSlug: 'edge',
      question,
      answer: 'agree',
      fetchImpl: fetchImpl as never,
    });
    expect(result).toMatchObject({
      ok: false,
      status: 401,
      reason: 'agent_token_not_found',
    });
  });

  it('wraps results with a synthesized Polis dataset when vectors are unavailable', async () => {
    const fetchImpl = jest.fn(async (urlIn: string) => {
      const view = new URL(String(urlIn)).searchParams.get('view');
      if (view === 'consensus' || view === 'difference') {
        return okJson({
          ok: true,
          questions: [{
            questionId: 'q1',
            prompt: 'Disclose agents?',
            participants: 3,
            total: 3,
            counts: [
              { label: 'Agree', count: 2 },
              { label: 'Disagree', count: 1 },
            ],
          }],
        });
      }
      return errJson(400, { ok: false, reason: 'unsupported_results_view' });
    });
    const result = await loadTelegramResultsDataset({ sessionSlug: 'edge', fetchImpl: fetchImpl as never });
    expect(result.ok).toBe(true);
    expect(result.approximate).toBe(true);
    expect(result.polisDataset.hasData).toBe(true);
    expect(Object.keys(result.polisDataset.aggregator)).toEqual(['q1']);
  });

  it('maps bucket cards through the lower-level normalizer', () => {
    expect(loadTelegramBucketCards({
      categories: [{ categoryId: 'role', label: 'Role', options: [{ optionId: 'builder', label: 'Builder' }] }],
      selections: { role: ['builder'] },
    })).toEqual([{
      categoryId: 'role',
      categoryLabel: 'Role',
      options: [{ optionId: 'builder', label: 'Builder', selected: true }],
    }]);
  });
});
