import React from 'react';
import { act } from '@testing-library/react';
import * as cacheScriptsModule from '../../utilities/cache/cacheScripts.js';
import * as contractScriptsModule from '../../utilities/web3/chainGateway.js';
import { renderSurveyResults } from './surveyResultsTestHarness';

const cacheScripts: any = cacheScriptsModule;

jest.mock('../SBTs/SBTFilter', () => () => null);
jest.mock('./QuestionFilter', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return ReactActual.forwardRef(() => null);
});
jest.mock('../PolisReport/PolisReport', () => () => null);
jest.mock('./SingleQuestionResponse', () => () => null);
jest.mock('../DemoViews/DemoAnalysis/DemoAnalysisWorkspace', () => ({ __esModule: true, default: () => null }));
jest.mock('../DebateMap/DebateMap', () => ({ __esModule: true, default: () => null }));
jest.mock('../MainContent/RiskMatrix', () => ({ __esModule: true, default: () => null }));

const flushAsync = async (cycles = 10): Promise<void> => {
  await act(async () => {
    for (let i = 0; i < cycles; i += 1) await Promise.resolve();
  });
};

const question = { id: 'q1', creator: '0x1', type: 'binary', prompt: 'Should the city pilot it?' };
let bucket: Record<string, unknown> = {};
const useBucket = (questionResponses: Record<string, unknown>) => {
  bucket = { questions: { q1: question }, questionResponses, questionsLatestBlock: 5, questionResponsesLatestBlock: 7 };
};

beforeEach(() => {
  useBucket({});
  jest
    .spyOn(cacheScripts, 'peekCacheSync')
    .mockImplementation((namespace: any) => (namespace === 'questionsCache' ? { '84532': bucket } : null));
  jest
    .spyOn(cacheScripts, 'readCache')
    .mockImplementation(async (namespace: any) => (namespace === 'questionsCache' ? { '84532': bucket } : {}));
  jest.spyOn(cacheScripts, 'writeCache').mockResolvedValue(true);
  jest.spyOn((contractScriptsModule as any).default, 'getLatestBlockNumber').mockResolvedValue(0);
});

afterEach(() => {
  jest.restoreAllMocks();
});

const summary = () => document.querySelector('.filterSummaryText') as HTMLElement;

it('shows the response counts as loading until the first responses land, then the counts', async () => {
  const view = renderSurveyResults({
    isOpen: true,
    preventUrlChange: true,
    viewMode: 'questions',
    isQuestionCacheReady: true,
    isResponsesCacheReady: false,
    questionResponsesNonce: 1,
  });
  await flushAsync();
  expect(summary()).not.toHaveTextContent(/Responses: 0/);
  expect(summary().querySelectorAll('svg[data-icon="spinner"]').length).toBeGreaterThanOrEqual(2);

  useBucket({ q1: { '0x2': { questionID: 'q1', answer: { value: true }, timeStamp: 1 } } });
  view.rerenderSurveyResults({ isResponsesCacheReady: true, questionResponsesNonce: 2 });
  await flushAsync();
  expect(summary()).toHaveTextContent(/Responses: 1/);
  expect(summary().querySelector('svg[data-icon="spinner"]')).toBeNull();
});

it('gives up waiting after a minute, as when a failed load leaves the cache unready', async () => {
  jest.useFakeTimers();
  try {
    renderSurveyResults({
      isOpen: true,
      preventUrlChange: true,
      viewMode: 'questions',
      isQuestionCacheReady: true,
      isResponsesCacheReady: false,
      questionResponsesNonce: 1,
    });
    await flushAsync();
    expect(summary()).not.toHaveTextContent(/Responses: 0/);
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    await flushAsync();
    expect(summary()).toHaveTextContent(/Responses: 0/);
  } finally {
    jest.useRealTimers();
  }
});
