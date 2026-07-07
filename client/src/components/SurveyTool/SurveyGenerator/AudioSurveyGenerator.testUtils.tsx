import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const mockCallAI = jest.fn();
const mockProcessAdditionalSources = jest.fn();
const mockFetchContentFromURL = jest.fn();
const mockAnalyzePhotoForQuestionGeneration = jest.fn();
const mockGetAllSessionSlugs = jest.fn();
const mockGetSessionConfigBySlug = jest.fn();
const mockDocumentLibraryPanel = jest.fn();
const mockCorpusViewer = jest.fn();
const mockUploadDocLibraryFile = jest.fn();
const mockUploadDocLibraryUrlRecord = jest.fn();
const mockFetchImageFromURL = jest.fn();
const mockReadCompactImageClipboard = jest.fn();
let mockCorpusViewerModuleLoadCount = 0;
let originalCreateObjectURL;
let originalRevokeObjectURL;
let previewUrlCounter = 0;

jest.mock('../../../utilities/ai/aiClient.js', () => ({
  callAI: (...args) => mockCallAI(...args),
  transcribeAudio: jest.fn(),
  generateAudioDiscussionSummary: jest.fn(),
  uploadMarkdownSummaryToArweave: jest.fn(),
  processAdditionalSources: (...args) => mockProcessAdditionalSources(...args),
  fetchContentFromURL: (...args) => mockFetchContentFromURL(...args),
  analyzePhotoForQuestionGeneration: (...args) => mockAnalyzePhotoForQuestionGeneration(...args),
}));

jest.mock('../../../utilities/ui/imageFetchClient.js', () => ({
  fetchImageFromURL: (...args) => mockFetchImageFromURL(...args),
}));

jest.mock('../../Shared/compactImageClipboard.js', () => ({
  readCompactImageClipboard: (...args) => mockReadCompactImageClipboard(...args),
}));

jest.mock('../../../utilities/web3/contractScripts.js', () => ({
  __esModule: true,
  getAllSessionSlugs: (...args) => mockGetAllSessionSlugs(...args),
  getSessionConfigBySlug: (...args) => mockGetSessionConfigBySlug(...args),
}));

jest.mock('../../../utilities/docLibrary/uploads.js', () => {
  const actual = jest.requireActual('../../../utilities/docLibrary/uploads.js');
  return {
    __esModule: true,
    ...actual,
    uploadDocLibraryFile: (...args) => mockUploadDocLibraryFile(...args),
    uploadDocLibraryUrlRecord: (...args) => mockUploadDocLibraryUrlRecord(...args),
  };
});

import AudioSurveyGenerator from './SurveyGenerator';
import { E2E_TESTIDS } from '../../../utilities/e2eTestIds.js';

jest.mock('../../Shared/AudioInput/AudioInput', () => (props) => (
  <textarea
    data-testid="audio-input"
    data-enable-downloads={String(!!props.enableDownloads)}
    placeholder={props.placeholder}
    value={props.value || ''}
    onChange={(event) => props.updateFunction?.(event.target.value)}
  />
));

jest.mock('../CreateQuestionsAndSurveys', () => () => <div data-testid="create-questions-and-surveys" />);

jest.mock('../../DocumentLibrary/DocumentLibraryPanel', () => ({
  __esModule: true,
  default: (props) => {
    mockDocumentLibraryPanel(props);
    return <div data-testid="mock-document-library-panel" />;
  },
}));

jest.mock('../../DemoViews/CorpusViewer', () => ({
  __esModule: true,
  default: (() => {
    mockCorpusViewerModuleLoadCount += 1;
    return () => {
      mockCorpusViewer();
      return <div data-testid="mock-corpus-viewer" />;
    };
  })(),
}));

export let container;
export let root;
let previousActEnvironment;
export const findGenerateQuestionsButton = () =>
  Array.from(container.querySelectorAll('button')).find((node) => node.textContent.includes('Generate Questions'));
export const getPhotoCards = () =>
  Array.from(container.querySelectorAll(`[data-testid="${E2E_TESTIDS.DATABASE_PHOTO_SOURCE_CARD}"]`));
export const getPhotoCardByName = (name) => getPhotoCards().find((node) => node.textContent.includes(name));
export const getPhotoSourceId = (node) => node?.getAttribute('data-ce-source-id') || '';
export const getPhotoAnalysisToggleBySourceId = (sourceId) =>
  container.querySelector(
    `[data-testid="${E2E_TESTIDS.DATABASE_PHOTO_SOURCE_ANALYSIS_TOGGLE}"][data-ce-source-id="${sourceId}"]`,
  );
export const getPhotoAnalysisBodyBySourceId = (sourceId) =>
  container.querySelector(
    `[data-testid="${E2E_TESTIDS.DATABASE_PHOTO_SOURCE_ANALYSIS_BODY}"][data-ce-source-id="${sourceId}"]`,
  );
export const toggleCheckbox = (element) => {
  act(() => {
    element.click();
  });
};
export const setInputValue = (selector, value) => {
  const input = container.querySelector(selector);
  const proto =
    input instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const setValue = Object.getOwnPropertyDescriptor(proto, 'value').set;
  act(() => {
    setValue.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
export const setAudioInputValue = (value) => {
  setInputValue('textarea[data-testid="audio-input"]', value);
};
export const addAdditionalUrl = async (value = 'https://example.com/article') => {
  setInputValue('input[placeholder="Add URL"]', value);
  const addUrlButton = container.querySelector('button[title="Add URL"]');
  await act(async () => {
    addUrlButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};
export const addAdditionalFile = (file = new File(['file-source'], 'notes.txt', { type: 'text/plain' })) => {
  const fileInput = container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_IMAGE_FILE_INPUT}"]`);
  Object.defineProperty(fileInput, 'files', {
    configurable: true,
    value: [file],
  });
  act(() => {
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  });
  return file;
};
export const addAdditionalPhoto = (files = [new File(['photo-source'], 'memo.png', { type: 'image/png' })]) => {
  const normalizedFiles = Array.isArray(files) ? files : [files];
  const fileInput = container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_IMAGE_FILE_INPUT}"]`);
  Object.defineProperty(fileInput, 'files', {
    configurable: true,
    value: normalizedFiles,
  });
  act(() => {
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  });
  return normalizedFiles;
};
export const renderSubject = async (node) => {
  await act(async () => {
    root.render(node);
  });
};
export const makeSessionConfig = ({
  slug = 'edge',
  sessionName = 'Edge Session',
  sessionIdHex = `0x${'2'.repeat(32)}`,
  sessionId = '',
  corsWorkerUrl = '',
  lit = undefined,
  docUploadsGate = {
    lookupStatus: 'ok',
    sbtAddresses: ['0x00000000000000000000000000000000000000aa'],
    chainId: 84532,
    mode: 0,
  },
} = {}) => ({
  slug,
  sessionName,
  ...(corsWorkerUrl ? { corsWorkerUrl } : {}),
  ...(lit ? { lit } : {}),
  __registry: {
    ...(sessionId ? { sessionId } : {}),
    ...(sessionIdHex ? { sessionIdHex } : {}),
    gatesByResource: {
      ...(docUploadsGate ? { docUploads: docUploadsGate } : {}),
    },
  },
});
export const buildAiQuestions = (count) =>
  Array.from({ length: count }, (_, index) => ({
    prompt: `Generated question ${index + 1}?`,
    questionType: 'binary',
    tags: ['generated'],
  }));

export const getMockCorpusViewerModuleLoadCount = () => mockCorpusViewerModuleLoadCount;

export const setupAudioSurveyGeneratorTestLifecycle = () => {
  beforeAll(() => {
    previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn((file) => {
        previewUrlCounter += 1;
        return `blob:audio-survey-${previewUrlCounter}-${file?.name || 'preview'}`;
      }),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });
  });

  beforeEach(() => {
    previewUrlCounter = 0;
    URL.createObjectURL.mockClear();
    URL.revokeObjectURL.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    window.__litHooks = {
      saveKey: jest.fn(async () => ({ ciphertext: 'ciphertext', dataToEncryptHash: 'hash' })),
      getKey: jest.fn(async () => new Uint8Array(32).fill(7)),
    };
    mockCallAI.mockReset();
    mockProcessAdditionalSources.mockReset();
    mockFetchContentFromURL.mockReset();
    mockAnalyzePhotoForQuestionGeneration.mockReset();
    mockGetAllSessionSlugs.mockReset();
    mockGetSessionConfigBySlug.mockReset();
    mockDocumentLibraryPanel.mockReset();
    mockCorpusViewer.mockReset();
    mockUploadDocLibraryFile.mockReset();
    mockUploadDocLibraryUrlRecord.mockReset();
    mockFetchImageFromURL.mockReset();
    mockReadCompactImageClipboard.mockReset();
    mockGetAllSessionSlugs.mockReturnValue(['edge', 'rxc']);
    mockGetSessionConfigBySlug.mockImplementation((slug) => {
      const normalized = String(slug || '');
      if (normalized === 'edge') {
        return makeSessionConfig({
          slug: 'edge',
          sessionName: 'Edge Session',
          sessionIdHex: `0x${'2'.repeat(32)}`,
        });
      }
      if (normalized === 'rxc') {
        return makeSessionConfig({
          slug: 'rxc',
          sessionName: 'Debate Session',
          sessionIdHex: `0x${'3'.repeat(32)}`,
        });
      }
      return {};
    });
    mockUploadDocLibraryUrlRecord.mockResolvedValue({
      txId: 'A'.repeat(43),
      url: `https://example.com/${'A'.repeat(43)}`,
      storage: 'lit-arweave',
      kind: 'link',
      tagMap: {},
      data: { size: null, type: 'application/json' },
    });
    mockUploadDocLibraryFile.mockResolvedValue({
      txId: 'B'.repeat(43),
      url: `https://example.com/${'B'.repeat(43)}`,
      storage: 'lit-arweave',
      kind: 'file',
      tagMap: {},
      data: { size: null, type: 'application/json' },
    });
    mockFetchImageFromURL.mockRejectedValue(new Error('Invalid image type'));
    mockReadCompactImageClipboard.mockResolvedValue({ error: 'Clipboard does not contain a supported image or URL.' });
  });

  afterEach(() => {
    delete window.__litHooks;
    delete window.litHooks;
    if (root) {
      act(() => {
        root.unmount();
      });
      root = null;
    }
    container.remove();
    container = null;
  });

  afterAll(() => {
    if (typeof originalCreateObjectURL === 'function') {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: originalCreateObjectURL,
      });
    } else {
      delete URL.createObjectURL;
    }
    if (typeof originalRevokeObjectURL === 'function') {
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: originalRevokeObjectURL,
      });
    } else {
      delete URL.revokeObjectURL;
    }
    if (typeof previousActEnvironment === 'undefined') {
      delete globalThis.IS_REACT_ACT_ENVIRONMENT;
      return;
    }
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  });
};

export {
  React,
  act,
  AudioSurveyGenerator,
  E2E_TESTIDS,
  mockCallAI,
  mockProcessAdditionalSources,
  mockFetchContentFromURL,
  mockAnalyzePhotoForQuestionGeneration,
  mockGetAllSessionSlugs,
  mockGetSessionConfigBySlug,
  mockDocumentLibraryPanel,
  mockCorpusViewer,
  mockUploadDocLibraryFile,
  mockUploadDocLibraryUrlRecord,
  mockFetchImageFromURL,
  mockReadCompactImageClipboard,
};
