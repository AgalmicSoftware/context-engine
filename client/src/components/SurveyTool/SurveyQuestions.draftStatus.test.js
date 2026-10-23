import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderSurveyQuestions, renderSurveyPileViewMode } from './surveyQuestionsTestHarness';
import { createPileViewRuntimeStrategy } from './SurveyPileViewMode';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';
import {
  resolveWorkerCanonicalCacheIdentity,
  withWorkerCanonicalCacheIdentity,
} from '../../utilities/survey/workerCanonicalCacheIdentity';
import * as cacheScripts from '../../utilities/cache/cacheScripts';
import contractScripts, * as chainGateway from '../../utilities/web3/chainGateway';
import { surveyQuestionReadsPort } from '../../domains/surveys/surveyQuestionReadsPort';
import { cryptoUtils } from '../../utilities/crypto/cryptography';

const account = '0x00000000000000000000000000000000000000a1';
const question = { id: 'q1', type: 'freeform', prompt: 'Question one' };
const workerConfig = {
  slug: 'edge',
  corsWorkerUrl: 'https://fixture.worker.test',
  sessionId: '0x00112233445566778899aabbccddeeff',
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
  storageProfile: { backend: 'cloudflare', resources: { questions: 'active', surveys: 'active' } },
};
const legacyConfig = {
  slug: 'edge',
  networkChainId: 84532,
  __registry: { registryChainId: 84532, sessionIdHex: workerConfig.sessionId },
};

afterEach(() => {
  jest.restoreAllMocks();
  sessionStorage.clear();
});

it.each(['single', 'standalone', 'survey', 'pile'])(
  '%s waits for draft authority before mounting editable fields',
  async (mode) => {
    let currentConfig = null;
    const cache = () =>
      currentConfig
        ? {
            worker: withWorkerCanonicalCacheIdentity(
              {
                questions: { q1: question },
                questionResponses: {},
                pendingQuestionMetadata: {},
                surveys: { 'survey-1': { id: 'survey-1', questionIDs: ['q1'] } },
              },
              resolveWorkerCanonicalCacheIdentity({ sessionConfig: currentConfig, sessionSlug: 'edge' }),
            ),
          }
        : {};
    jest.spyOn(cacheScripts, 'readCache').mockImplementation(async () => cache());
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation(() => cache());
    jest.spyOn(chainGateway, 'getSessionConfigBySlug').mockReturnValue(null);
    jest.spyOn(surveyQuestionReadsPort, 'getQuestionData').mockResolvedValue(question);
    jest.spyOn(surveyQuestionReadsPort, 'getResponse').mockResolvedValue(null);
    jest.spyOn(surveyQuestionReadsPort, 'getSurveyResponse').mockResolvedValue(null);
    let engine;
    const pileRuntime = mode === 'pile' ? createPileViewRuntimeStrategy() : null;
    const view = renderSurveyQuestions({
      minifiedMode: mode === 'pile' ? 'pile' : undefined,
      account,
      loginComplete: true,
      singleQuestionMode: mode === 'single',
      isStandalone: mode === 'standalone',
      surveyId: mode === 'survey' ? 'survey-1' : undefined,
      surveys: mode === 'survey' ? [{ id: 'survey-1', title: 'Survey', questionIDs: ['q1'] }] : undefined,
      questionID: 'q1',
      questionPool: [question],
      sessionSlug: 'edge',
      sessionSlugPinned: true,
      useHeaderSubmit: mode !== 'single',
      sessionConfig: null,
      isQuestionCacheReady: true,
      isResponsesCacheReady: true,
      runtimeStrategy: {
        ...pileRuntime,
        render: (current) => {
          engine = current;
          return pileRuntime ? pileRuntime.render(current) : current.renderDefaultSurveyQuestionsRoute();
        },
      },
    });
    await waitFor(() => expect(engine).toBeTruthy());
    expect(engine.getDraftKey()).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Loading session');
    const pendingKey = `dg:surveyDraft:edge:__pending__:${account}:questions`;
    sessionStorage.setItem(pendingKey, JSON.stringify({ answers: { q1: { value: 'ambiguous old draft' } } }));
    act(() => engine.persistDraft());
    expect(Object.keys(sessionStorage)).toEqual([pendingKey]);
    currentConfig = workerConfig;
    act(() => view.rerenderSurveyQuestions({ sessionConfig: currentConfig }));
    await waitFor(() => expect(engine.getDraftKey()).toContain(':authority:'));
    expect(sessionStorage.getItem(pendingKey)).toContain('ambiguous old draft');
    expect(engine.state.surveysResponseState?.[0]?.answers?.q1?.value).not.toBe('ambiguous old draft');
    {
      await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Current answer' } });
      await waitFor(() => expect(engine.state.surveysResponseState[0].answers.q1.value).toBe('Current answer'));
      act(() => engine.persistDraft());
      expect(sessionStorage.getItem(engine.getDraftKey())).toContain('Current answer');
    }
  },
);

it('clears the memory-only warning after every pending answer is submitted', async () => {
  jest.spyOn(contractScripts, 'submitResponses').mockResolvedValue({
    wait: async () => ({ status: 1, blockNumber: 42, transactionHash: `0x${'7'.repeat(64)}`, transactionIndex: 0 }),
  });
  jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');
  jest.spyOn(cryptoUtils, 'hashIdentifier').mockImplementation((value) => `hashed:${value}`);
  const originalSetItem = Storage.prototype.setItem;
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
    if (String(key).startsWith('dg:surveyDraft:')) throw new DOMException('quota', 'QuotaExceededError');
    return originalSetItem.call(this, key, value);
  });
  let engine;
  renderSurveyQuestions({
    account,
    loginComplete: true,
    isStandalone: true,
    sessionSlug: 'edge',
    sessionConfig: legacyConfig,
    provider: { request: jest.fn() },
    questionPool: [question],
    runtimeStrategy: {
      render: (current) => {
        engine = current;
        return current.renderDefaultSurveyQuestionsRoute();
      },
    },
  });
  await waitFor(() => expect(engine).toBeTruthy());
  act(() => engine.handleAnswer(0, 'q1', 'Submitted answer'));
  act(() => engine.persistDraft());
  expect(engine.state.draftPersistenceError).toMatch(/only in memory/);
  expect(screen.getByRole('status')).toHaveTextContent('only in memory');
  await act(async () => engine.handlePrimarySubmitClick());
  await waitFor(() => expect(engine.state.submissionComplete).toBe(true));
  expect(engine.getPendingEditStats().total).toBe(0);
  expect(engine.state.draftPersistenceError).toBe('');
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
});

it.each([
  ['legacy registry', legacyConfig],
  ['local demo', { slug: 'edge', networkChainId: 84532, demoCompatibilitySeed: { temporary: true } }],
])('keeps %s pile editing available when omitted config resolves through strict lookup', async (_, sessionConfig) => {
  jest
    .spyOn(chainGateway, 'getSessionConfigBySlug')
    .mockImplementation((slug) => (slug === 'edge' ? sessionConfig : null));
  jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});
  jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
  const pileRuntime = createPileViewRuntimeStrategy();
  let engine;
  renderSurveyPileViewMode({
    sessionSlug: 'edge',
    sessionSlugPinned: true,
    account,
    loginComplete: true,
    minifiedMode: 'pile',
    isQuestionCacheReady: true,
    questionPool: [{ id: 'compat-question', type: 'rating', prompt: 'Rate the resolved session' }],
    runtimeStrategy: {
      ...pileRuntime,
      render: (current) => {
        engine = current;
        return pileRuntime.render(current);
      },
    },
  });
  const slider = await screen.findByRole('slider');
  expect(engine.props).not.toHaveProperty('sessionConfig');
  expect(engine.getDraftKey()).toContain(':edge:84532:');
  fireEvent.change(slider, { target: { value: '6' } });
  await waitFor(() => expect(slider).toHaveValue('6'));
  act(() => engine.persistDraft());
  await waitFor(() => expect(sessionStorage.getItem(engine.getDraftKey())).toContain('compat-question'));
});
