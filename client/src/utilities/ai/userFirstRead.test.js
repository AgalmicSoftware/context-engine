import { analyzeUserOpinions } from './aiClient.js';
import { getEffectiveAiConfig } from './aiSettings.js';
import { analyzeUserFirstRead } from './userFirstRead';
import { getCorsProxyUrlOrThrow } from '../worker/corsProxy.js';
import { fetchWorkerWithAuth } from '../worker/workerAuth.js';

jest.mock('./aiSettings.js', () => ({ getEffectiveAiConfig: jest.fn(), getEffectiveTranscriptionConfig: jest.fn() }));
jest.mock('../worker/corsProxy.js', () => ({ getCorsProxyUrlOrThrow: jest.fn() }));
jest.mock('../worker/workerAuth.js', () => ({ fetchWorkerWithAuth: jest.fn() }));
jest.mock('../logging.js', () => ({ createLogger: () => ({ log: jest.fn(), warn: jest.fn(), error: jest.fn() }) }));

const reply = (value) => ({ ok: true, json: async () => ({ completion: JSON.stringify(value) }) });
const options = { sessionSlug: 'session-a', throwOnError: true };

describe('the quick first read of a person', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // The session's fast model unless the thinking one is asked for.
    getEffectiveAiConfig.mockImplementation(async ({ thinking }) => ({
      provider: 'openai',
      model: thinking ? 'gpt-6.1-sol' : 'gpt-6.1-terra',
      apiKeySource: 'session',
      reasoningEffort: 'low',
    }));
    getCorsProxyUrlOrThrow.mockResolvedValue('https://worker.example');
  });

  it('asks the fast model for a headline and at most three lines', async () => {
    fetchWorkerWithAuth.mockResolvedValue(
      reply({ headline: ' Wants decisions made close to home. ', points: [' One ', '', 'Two', 'Three', 'Four', 7] }),
    );

    await expect(analyzeUserFirstRead({ questions: [] }, options)).resolves.toEqual({
      headline: 'Wants decisions made close to home.',
      points: ['One', 'Two', 'Three'],
    });

    expect(getEffectiveAiConfig).toHaveBeenCalledWith(expect.objectContaining({ thinking: false }));
    const body = JSON.parse(fetchWorkerWithAuth.mock.calls[0][1].body);
    expect(body).toMatchObject({ model: 'gpt-6.1-terra', taskType: 'summarize', max_output_tokens: 800 });
    expect(body.response_format).toMatchObject({ type: 'json_schema', name: 'user_first_read' });
    expect(body.messages[0].content).toContain('"headline": one sentence of at most 20 words');
  });

  it('keeps each line to one line of plain text, however the reply came', async () => {
    fetchWorkerWithAuth.mockResolvedValue(
      reply({ headline: `Long ${'x'.repeat(400)}`, points: ['Two\n\nlines', { text: 'not a line' }, 'y'.repeat(300)] }),
    );
    const { headline, points } = await analyzeUserFirstRead({}, options);
    expect(headline).toHaveLength(200);
    expect(points).toEqual(['Two lines', 'y'.repeat(140)]);

    fetchWorkerWithAuth.mockResolvedValue(reply({ headline: { text: 'An object' }, points: ['One'] }));
    await expect(analyzeUserFirstRead({}, options)).rejects.toThrow('The AI reply had no first read.');
  });

  it('does not wait for an earlier first read that never came back', async () => {
    fetchWorkerWithAuth.mockReturnValueOnce(new Promise(() => {}));
    void analyzeUserFirstRead({}, options);
    fetchWorkerWithAuth.mockResolvedValue(reply({ headline: 'The next one.', points: [] }));
    await expect(analyzeUserFirstRead({}, options)).resolves.toEqual({ headline: 'The next one.', points: [] });
  });

  it('is not a first read without a headline', async () => {
    fetchWorkerWithAuth.mockResolvedValue(reply({ headline: ' ', points: ['One'] }));
    await expect(analyzeUserFirstRead({}, options)).rejects.toThrow('The AI reply had no first read.');
  });

  it('does not wait for the analysis: it has its own lane beside the shared AI queue', async () => {
    let finishAnalysis = () => {};
    fetchWorkerWithAuth.mockImplementation((_url, init) =>
      JSON.parse(init.body).model === 'gpt-6.1-sol'
        ? new Promise((resolve) => {
            finishAnalysis = () => resolve(reply({ summary: 'The full analysis.' }));
          })
        : Promise.resolve(reply({ headline: 'A first read.', points: [] })),
    );

    const analysis = analyzeUserOpinions({}, options);
    await expect(analyzeUserFirstRead({}, options)).resolves.toEqual({ headline: 'A first read.', points: [] });

    finishAnalysis();
    await expect(analysis).resolves.toMatchObject({ summary: 'The full analysis.' });
  });

  it('is sent once more when the first request is lost on the way', async () => {
    fetchWorkerWithAuth
      .mockRejectedValueOnce(new TypeError('Load failed'))
      .mockResolvedValue(reply({ headline: 'A first read.', points: ['One'] }));
    await expect(analyzeUserFirstRead({}, options)).resolves.toEqual({ headline: 'A first read.', points: ['One'] });
    expect(fetchWorkerWithAuth).toHaveBeenCalledTimes(2);
  });
});
