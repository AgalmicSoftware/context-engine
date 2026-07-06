import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expect, jest } from '@jest/globals';

import type { SurveyResultsProps } from './SurveyResults';
import * as cacheScriptsModule from '../../utilities/cache/cacheScripts.js';
import * as contractScriptsModule from '../../utilities/web3/contractScripts.js';
import { renderSurveyResults } from './surveyResultsTestHarness';
import { callAI } from '../../utilities/ai/aiScripts.js';
import {
  downloadSessionResultsHtmlReport,
  downloadSessionResultsPdfReport,
} from '../../utilities/sessionResultsExport';

const cacheScripts: any = cacheScriptsModule;
const contractScripts: any = (contractScriptsModule as any).default;

export const OP_NETWORK = { id: 11155420 };
export const WALLET_ACCOUNT = '0x9999999999999999999999999999999999999999';
export const SURVEY_ID = '0x1111111111111111111111111111111111111111111111111111111111111111';
export const RESPONDER_ONE = '0x1111111111111111111111111111111111111111';
export const RESPONDER_TWO = '0x2222222222222222222222222222222222222222';

export const cacheStoreKey = (namespace: unknown, slug: unknown = ''): string => (
  `${String(namespace || '')}|${String(slug || '')}`
);

export let cacheStore: Map<string, any>;
let analysisPeekError: Error | null;
let analysisWriteErrors: Error[];
type JestSpy = ReturnType<typeof jest.spyOn>;
type JestMock = ReturnType<typeof jest.fn>;
export let peekSpy: JestSpy;
export let readSpy: JestSpy;
export let writeSpy: JestSpy;
let listSpy: JestSpy;
export let latestBlockSpy: JestSpy;

export const setAnalysisPeekError = (error: Error | null): void => {
  analysisPeekError = error;
};

export const setAnalysisWriteErrors = (errors: Error[]): void => {
  analysisWriteErrors = errors;
};

const installModuleBoundarySpies = (): void => {
  peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation(
    (namespace: any, slug: any = '') => {
      if (analysisPeekError && String(namespace) === 'analysisCache') throw analysisPeekError;
      const value = cacheStore.get(cacheStoreKey(namespace, slug));
      return value === undefined ? null : value;
    }
  );
  readSpy = jest.spyOn(cacheScripts, 'readCache').mockImplementation(
    async (namespace: any, slug: any = '') => {
      const value = cacheStore.get(cacheStoreKey(namespace, slug));
      return value === undefined ? null : value;
    }
  );
  writeSpy = jest.spyOn(cacheScripts, 'writeCache').mockImplementation(
    async (namespace: any, slug: any = '', value: any = null) => {
      if (analysisWriteErrors.length > 0 && String(namespace) === 'analysisCache') {
        throw analysisWriteErrors.shift();
      }
      cacheStore.set(cacheStoreKey(namespace, slug), value);
      return true;
    }
  );
  listSpy = jest.spyOn(cacheScripts, 'listNamespaceEntriesSync').mockImplementation(
    (namespace: any) => {
      const prefix = `${String(namespace)}|`;
      return Array.from(cacheStore.entries())
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, value]) => ({
          key,
          namespace: String(namespace),
          slug: key.slice(prefix.length),
          value,
        }));
    }
  );
  latestBlockSpy = jest.spyOn(contractScripts, 'getLatestBlockNumber').mockResolvedValue(1);
};

export const resetSurveyResultsExportControlsHarness = (): void => {
  cacheStore = new Map();
  analysisPeekError = null;
  analysisWriteErrors = [];
  installModuleBoundarySpies();
  (downloadSessionResultsHtmlReport as unknown as JestMock).mockReset();
  (downloadSessionResultsPdfReport as unknown as JestMock).mockReset();
  (callAI as unknown as JestMock).mockReset();
  window.localStorage.clear();
};

export const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, reject, resolve };
};

export const flushMicrotasks = async (cycles = 6): Promise<void> => {
  for (let index = 0; index < cycles; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

export const createAnalysisArtifact = (inputSignature = 'input-sig') => ({
  generatedAt: '2026-06-01T00:00:00.000Z',
  inputSignature,
  kind: 'ce_session_results_analysis_artifact',
  participants: [],
  sections: {
    argumentMap: { available: true, debates: [] },
    atlas: { available: true, edges: [], nodes: [] },
    breakdown: { available: true, dimensions: [], groups: [], summary: {} },
    riskMatrix: { available: true, categories: [], comments: [], heatmap: {}, scenarioLinks: [] },
  },
  source: 'ai-generated',
  version: 1,
});

export const mountSurveyResults = (props: SurveyResultsProps = {}) => renderSurveyResults({
  filterState: {},
  isOpen: true,
  isQuestionCacheReady: true,
  isResponsesCacheReady: true,
  isSBTCacheReady: true,
  preventUrlChange: true,
  sessionSlugPinned: true,
  viewMode: 'questions',
  ...props,
});

type QuestionsCacheSeed = {
  netId?: number;
  questionResponses?: Record<string, Record<string, any>>;
  questions?: Record<string, any>;
  slug: string;
};

export const seedQuestionsCache = ({
  netId = 11155420,
  questionResponses = {},
  questions = {},
  slug,
}: QuestionsCacheSeed): void => {
  cacheStore.set(cacheStoreKey('questionsCache', slug), {
    [String(netId)]: {
      questionResponses,
      questions,
      questionResponsesLatestBlock: 1,
      questionsLatestBlock: 1,
    },
  });
};

export const seedSingleBinaryQuestion = ({
  netId = 11155420,
  responder = '0xabc',
  response = { answer: { encrypted: false, value: 'Agree' }, questionId: 'q1', timeStamp: '2026-05-01T00:00:00.000Z' },
  prompt = 'Export this report?',
  slug,
}: {
  netId?: number;
  prompt?: string;
  responder?: string;
  response?: any;
  slug: string;
}): void => {
  seedQuestionsCache({
    netId,
    questionResponses: { q1: { [responder]: response } },
    questions: {
      q1: {
        id: 'q1',
        options: ['Agree', 'Disagree'],
        prompt,
        type: 'binary',
      },
    },
    slug,
  });
};

/** Eligible analysis dataset: 2 questions, 3 responses, 2 participants. */
export const seedAnalysisEligibleSession = (slug: string, netId = 11155420): void => {
  seedQuestionsCache({
    netId,
    questionResponses: {
      q1: {
        [RESPONDER_ONE]: { answer: { encrypted: false, value: 'Use a viewer.' }, questionId: 'q1', timeStamp: '2026-05-01T00:00:00.000Z' },
        [RESPONDER_TWO]: { answer: { encrypted: false, value: 'Keep it private.' }, questionId: 'q1', timeStamp: '2026-05-02T00:00:00.000Z' },
      },
      q2: {
        [RESPONDER_ONE]: { answer: { encrypted: false, value: 'Make PDF readable.' }, questionId: 'q2', timeStamp: '2026-05-03T00:00:00.000Z' },
      },
    },
    questions: {
      q1: { id: 'q1', prompt: 'What export should exist?', tags: ['exports'], type: 'freeform' },
      q2: { id: 'q2', prompt: 'What risk matters?', tags: ['safety'], type: 'freeform' },
    },
    slug,
  });
};

export const waitForHydratedResponseCount = async (count: number): Promise<void> => {
  await waitFor(() => {
    const summary = document.querySelector('.filterSummaryText');
    expect(summary).not.toBeNull();
    expect(String(summary?.textContent || '')).toMatch(new RegExp(`Responses: ${count}(\\D|$)`));
  });
};

export const openExportArea = (): void => {
  const collapsedToggle = screen.queryByRole('button', { name: 'Export Data' });
  if (collapsedToggle) fireEvent.click(collapsedToggle);
};

/** jsdom Blob has no .text(); read captured download blobs through FileReader. */
export const readBlobText = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(reader.error);
  reader.readAsText(blob);
});

export const openHtmlReportModal = async (): Promise<HTMLElement> => {
  openExportArea();
  fireEvent.click(screen.getByTestId('ce-surveyresults-export-html-report'));
  return screen.findByTestId('ce-surveyresults-html-report-modal');
};

export const getDownloadReportButton = (): HTMLElement => (
  screen.getByTestId('ce-surveyresults-html-report-download')
);
export const getGenerateAnalysisButton = (): HTMLElement => (
  screen.getByTestId('ce-surveyresults-html-report-generate-analysis')
);
export const clickGenerateAnalysis = (): void => {
  fireEvent.click(getGenerateAnalysisButton());
};

export const getSectionRows = (): Array<{ availability: string; label: string; reason: string }> => {
  const table = document.querySelector('.htmlReportSectionTable');
  expect(table).not.toBeNull();
  return Array.from((table as HTMLElement).querySelectorAll('tbody tr')).map((row) => {
    const cells = Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim() || '');
    return { availability: cells[2], label: cells[1], reason: cells[3] };
  });
};

export const analysisCachePeeks = (): any[][] => (
  peekSpy.mock.calls.filter((call: any[]) => String(call[0]) === 'analysisCache')
);
export const analysisCacheReads = (): any[][] => (
  readSpy.mock.calls.filter((call: any[]) => String(call[0]) === 'analysisCache')
);
export const analysisCacheWrites = (): any[][] => (
  writeSpy.mock.calls.filter((call: any[]) => String(call[0]) === 'analysisCache')
);
export const analysisArtifactsFromWrite = (writeIndex: number): Array<[string, any]> => {
  const call = analysisCacheWrites()[writeIndex];
  expect(call).toBeTruthy();
  return Object.entries((call[2] || {}).sessionResultsAnalysis || {}) as Array<[string, any]>;
};

export const callAIPrompts = (): string[] => (
  (callAI as unknown as JestMock).mock.calls.map((call: unknown[]) => String(call[0]))
);

export const waitForAnalysisCacheWrites = async (count: number): Promise<void> => {
  await waitFor(() => expect(analysisCacheWrites()).toHaveLength(count));
};
export const waitForAnalysisIdle = async (): Promise<void> => {
  await waitFor(() => {
    expect(String(getGenerateAnalysisButton().textContent || '')).not.toMatch(/Generating/);
  });
};

export const BREAKDOWN_ANALYSIS_JSON = JSON.stringify({
  breakdown: {
    dimensions: [],
    groups: [{ id: 'group_1', label: 'Generated group' }],
    summary: { overview: 'Generated analysis.' },
  },
});
export const RISK_MATRIX_ANALYSIS_JSON = JSON.stringify({
  riskMatrix: {
    categories: [{ id: 'risk_1', label: 'Generated risk' }],
    comments: [],
    heatmap: {},
    scenarioLinks: [],
  },
});

export const primeAnalysisArtifactCacheKey = async (
  mountProps: SurveyResultsProps,
  seed: () => void
): Promise<{ artifact: any; cacheKey: string }> => {
  (callAI as unknown as JestMock).mockResolvedValue(BREAKDOWN_ANALYSIS_JSON);
  seed();
  const primed = mountSurveyResults(mountProps);
  await waitForHydratedResponseCount(3);
  await openHtmlReportModal();
  clickGenerateAnalysis();
  await waitForAnalysisCacheWrites(1);
  await waitForAnalysisIdle();
  const entries = analysisArtifactsFromWrite(0);
  const [cacheKey, artifact] = entries[entries.length - 1];
  primed.unmount();
  cacheStore = new Map();
  (callAI as unknown as JestMock).mockClear();
  peekSpy.mockClear();
  readSpy.mockClear();
  writeSpy.mockClear();
  listSpy.mockClear();
  (downloadSessionResultsHtmlReport as unknown as JestMock).mockClear();
  (downloadSessionResultsPdfReport as unknown as JestMock).mockClear();
  return { artifact, cacheKey };
};

type BrowserDownloadCapture = {
  anchor: HTMLAnchorElement;
  anchorClickSpy: JestSpy;
  appendChildSpy: JestSpy;
  blobs: Blob[];
  createObjectURLMock: JestMock;
  removeChildSpy: JestSpy;
  restore: () => void;
};

export const installBrowserDownloadCapture = (): BrowserDownloadCapture => {
  const originalCreateObjectURL = window.URL.createObjectURL;
  const blobs: Blob[] = [];
  const createObjectURLMock = jest.fn((blob: Blob) => {
    blobs.push(blob);
    return 'blob:test-export';
  });
  (window.URL as any).createObjectURL = createObjectURLMock;
  const appendChildSpy = jest.spyOn(document.body, 'appendChild');
  const removeChildSpy = jest.spyOn(document.body, 'removeChild');
  const originalCreateElement = document.createElement.bind(document);
  const anchor = originalCreateElement('a') as HTMLAnchorElement;
  const anchorClickSpy = jest.spyOn(anchor, 'click').mockImplementation(() => {});
  const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation(((tagName: any, options: any) => (
    String(tagName).toLowerCase() === 'a' ? anchor : originalCreateElement(tagName, options)
  )) as any);
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    createElementSpy.mockRestore();
    anchorClickSpy.mockRestore();
    removeChildSpy.mockRestore();
    appendChildSpy.mockRestore();
    if (originalCreateObjectURL) {
      window.URL.createObjectURL = originalCreateObjectURL;
    } else {
      delete (window.URL as any).createObjectURL;
    }
  };
  return { anchor, anchorClickSpy, appendChildSpy, blobs, createObjectURLMock, removeChildSpy, restore };
};

export const selectExportType = (label: string): void => {
  const menu = document.querySelector('.dropdown-menu');
  expect(menu).not.toBeNull();
  fireEvent.click(within(menu as HTMLElement).getByText(label));
};

export const clickExportDownload = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'Download' }));
};
