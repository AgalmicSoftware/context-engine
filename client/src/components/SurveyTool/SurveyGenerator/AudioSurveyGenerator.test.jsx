import {
  React,
  act,
  AudioSurveyGenerator,
  E2E_TESTIDS,
  container,
  root,
  findGenerateQuestionsButton,
  getPhotoCards,
  getPhotoCardByName,
  getPhotoSourceId,
  getPhotoAnalysisToggleBySourceId,
  getPhotoAnalysisBodyBySourceId,
  toggleCheckbox,
  setAudioInputValue,
  addAdditionalPhoto,
  renderSubject,
  buildAiQuestions,
  mockCallAI,
  mockProcessAdditionalSources,
  mockFetchContentFromURL,
  setupAudioSurveyGeneratorTestLifecycle,
} from './AudioSurveyGenerator.testUtils';

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
let mockCorpusViewerModuleLoadCount = 0;

jest.mock('../../../utilities/ai/aiScripts.js', () => ({
  callAI: (...args) => mockCallAI(...args),
  transcribeAudio: jest.fn(),
  generateAudioDiscussionSummary: jest.fn(),
  uploadMarkdownSummaryToArweave: jest.fn(),
  processAdditionalSources: (...args) => mockProcessAdditionalSources(...args),
  fetchContentFromURL: (...args) => mockFetchContentFromURL(...args),
  analyzePhotoForQuestionGeneration: (...args) => mockAnalyzePhotoForQuestionGeneration(...args),
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

jest.mock('../../Shared/AudioInput/AudioInput.jsx', () => (props) => (
  <textarea
    data-testid="audio-input"
    data-enable-downloads={String(!!props.enableDownloads)}
    placeholder={props.placeholder}
    value={props.value || ''}
    onChange={(event) => props.updateFunction?.(event.target.value)}
  />
));

jest.mock('../CreateQuestionsAndSurveys.jsx', () => () => (
  <div data-testid="create-questions-and-surveys" />
));

jest.mock('../../DocumentLibrary/DocumentLibraryPanel.jsx', () => ({
  __esModule: true,
  default: (props) => {
    mockDocumentLibraryPanel(props);
    return <div data-testid="mock-document-library-panel" />;
  },
}));

jest.mock('../../DemoViews/CorpusViewer.jsx', () => ({
  __esModule: true,
  default: (() => {
    mockCorpusViewerModuleLoadCount += 1;
    return () => {
      mockCorpusViewer();
      return <div data-testid="mock-corpus-viewer" />;
    };
  })(),
}));

describe('AudioSurveyGenerator', () => {
  let container;
  let root;
  let previousActEnvironment;
  const findGenerateQuestionsButton = () =>
    Array.from(container.querySelectorAll('button')).find((node) => node.textContent.includes('Generate Questions'));
  const toggleCheckbox = (element) => {
    act(() => {
      element.click();
    });
  };
  const setInputValue = (selector, value) => {
    const input = container.querySelector(selector);
    const proto = input instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const setValue = Object.getOwnPropertyDescriptor(proto, 'value').set;
    act(() => {
      setValue.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  const setAudioInputValue = (value) => {
    setInputValue('textarea[data-testid="audio-input"]', value);
  };
  const addAdditionalUrl = (value = 'https://example.com/article') => {
    setInputValue('input[placeholder="Add URL"]', value);
    const addUrlButton = container.querySelector('button[title="Add URL"]');
    act(() => {
      addUrlButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  };
  const addAdditionalFile = (file = new File(['file-source'], 'notes.txt', { type: 'text/plain' })) => {
    const fileInput = container.querySelector('input[type="file"][accept*=".pdf"]');
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [file],
    });
    act(() => {
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
    return file;
  };
  const addAdditionalPhoto = (file = new File(['photo-source'], 'memo.png', { type: 'image/png' })) => {
    const fileInput = container.querySelector('input[type="file"][accept*="image/png"]');
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [file],
    });
    act(() => {
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
    return file;
  };
  const renderSubject = async (node) => {
    await act(async () => {
      root.render(node);
    });
  };
  const makeSessionConfig = ({
    slug = 'edge',
    sessionName = 'Edge Session',
    sessionIdHex = `0x${'2'.repeat(32)}`,
    sessionId = '',
    docUploadsGate = {
      lookupStatus: 'ok',
      sbtAddresses: ['0x00000000000000000000000000000000000000aa'],
      chainId: 84532,
      mode: 0,
    },
  } = {}) => ({
    slug,
    sessionName,
    __registry: {
      ...(sessionId ? { sessionId } : {}),
      ...(sessionIdHex ? { sessionIdHex } : {}),
      gatesByResource: {
        ...(docUploadsGate ? { docUploads: docUploadsGate } : {}),
      },
    },
  });
  const buildAiQuestions = (count) => Array.from({ length: count }, (_, index) => ({
    prompt: `Generated question ${index + 1}?`,
    questionType: 'binary',
    tags: ['generated'],
  }));

  beforeAll(() => {
    previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
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
    mockGetAllSessionSlugs.mockReturnValue(['edge', 'rxc']);
    mockGetSessionConfigBySlug.mockImplementation((slug) => {
      const normalized = String(slug || '');
      if (normalized === 'edge') return { slug: 'edge', sessionName: 'Edge Session' };
      if (normalized === 'rxc') return { slug: 'rxc', sessionName: 'Debate Session' };
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
    if (typeof previousActEnvironment === 'undefined') {
      delete globalThis.IS_REACT_ACT_ENVIRONMENT;
      return;
    }
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  });

  it('toggles transcript mode placeholder text', () => {
    act(() => {
      root.render(
        <AudioSurveyGenerator
          provider={{}}
          network={{}}
          account="0x123"
          loginComplete
          toggleLoginModal={jest.fn()}
        />
      );
    });

    const textarea = container.querySelector('textarea[data-testid="audio-input"]');
    expect(textarea.placeholder).toBe('Speak or type text here...');
    expect(textarea.getAttribute('data-enable-downloads')).toBe('false');

    const toggle = container.querySelector('[data-testid="transcript-mode-toggle"]');
    act(() => {
      toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(textarea.placeholder).toBe('Speak to capture transcript or Paste Text...');
    expect(textarea.getAttribute('data-enable-downloads')).toBe('true');
    expect(container.textContent).toContain('Upload Summary');
  });

  it('hides the generate questions button until the full-size database tool has content', () => {
    act(() => {
      root.render(
        <AudioSurveyGenerator
          provider={{}}
          network={{}}
          account="0x123"
          loginComplete
          toggleLoginModal={jest.fn()}
        />
      );
    });

    expect(findGenerateQuestionsButton()).toBeUndefined();

    setAudioInputValue('   ');
    expect(findGenerateQuestionsButton()).toBeUndefined();

    setAudioInputValue('This database tool content should unlock question generation.');
    expect(findGenerateQuestionsButton()).toBeTruthy();
  });

  it('hides the generate questions button in minified mode until content exists', () => {
    act(() => {
      root.render(
        <AudioSurveyGenerator
          provider={{}}
          network={{}}
          account="0x123"
          loginComplete
          toggleLoginModal={jest.fn()}
          minified
        />
      );
    });

    expect(findGenerateQuestionsButton()).toBeUndefined();

    setAudioInputValue('Compact database tool content.');
    expect(findGenerateQuestionsButton()).toBeTruthy();
  });

  it('treats queued photo uploads as valid DatabaseTool input content', async () => {
    await renderSubject(
      <AudioSurveyGenerator
        provider={{}}
        network={{}}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
      />
    );

    expect(findGenerateQuestionsButton()).toBeUndefined();

    addAdditionalPhoto();

    expect(container.textContent).toContain('[photo]');
    expect(container.textContent).toContain('Queued for analysis');
    expect(findGenerateQuestionsButton()).toBeTruthy();
  });

  it('uses simplified section headings in the generator surface', async () => {
    act(() => {
      root.render(
        <AudioSurveyGenerator
          provider={{}}
          network={{}}
          account="0x123"
          loginComplete
          toggleLoginModal={jest.fn()}
        />
      );
    });

    await act(async () => {
      const urlInput = container.querySelector('input[type="url"][placeholder="Add URL"]');
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(
        urlInput,
        'https://example.com/seed-source'
      );
      urlInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      const addButton = container.querySelector('button[title="Add URL"]');
      addButton.click();
    });

    const sectionHeadings = Array.from(container.querySelectorAll('h3')).map((node) => node.textContent.trim());
    expect(sectionHeadings).toContain('Types');
    expect(sectionHeadings).not.toContain('Content');
    expect(sectionHeadings).not.toContain('Question Types');

    const anyHeading = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6')).map((node) => node.textContent.trim());
    expect(anyHeading).not.toContain('Content');
    expect(anyHeading).not.toContain('Question Types');
    expect(anyHeading).not.toContain('Additional Context (URL / File)');

    const form = container.querySelector('form');
    const addSourceControls = form.querySelector(`[class*="addSourceControls"]`);
    expect(addSourceControls).toBeTruthy();
    const additionalContextSection = form.querySelector(`[class*="additionalContextSection"]`);
    expect(additionalContextSection).toBeTruthy();
    expect(additionalContextSection.contains(addSourceControls)).toBe(false);
  });

  it('shows the question count readout with the default value', () => {
    act(() => {
      root.render(
        <AudioSurveyGenerator
          provider={{}}
          network={{}}
          account="0x123"
          loginComplete
          toggleLoginModal={jest.fn()}
        />
      );
    });

    expect(
      container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_QUESTION_COUNT_VALUE}"]`).textContent
    ).toBe('10');
    expect(container.textContent).toContain('# Questions');
    expect(container.textContent).not.toContain('Number of Questions');
  });

  it('decrements the question count by five and clamps at five', () => {
    act(() => {
      root.render(
        <AudioSurveyGenerator
          provider={{}}
          network={{}}
          account="0x123"
          loginComplete
          toggleLoginModal={jest.fn()}
        />
      );
    });

    const countValue = () => container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_QUESTION_COUNT_VALUE}"]`);
    const decrementButton = container.querySelector(
      `[data-testid="${E2E_TESTIDS.DATABASE_QUESTION_COUNT_DECREMENT}"]`
    );

    expect(countValue().textContent).toBe('10');
    expect(decrementButton.disabled).toBe(false);

    toggleCheckbox(decrementButton);
    expect(countValue().textContent).toBe('5');
    expect(decrementButton.disabled).toBe(true);

    toggleCheckbox(decrementButton);
    expect(countValue().textContent).toBe('5');
  });

  it('increments the question count by five and clamps at fifty', () => {
    act(() => {
      root.render(
        <AudioSurveyGenerator
          provider={{}}
          network={{}}
          account="0x123"
          loginComplete
          toggleLoginModal={jest.fn()}
        />
      );
    });

    const countValue = () => container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_QUESTION_COUNT_VALUE}"]`);
    const incrementButton = container.querySelector(
      `[data-testid="${E2E_TESTIDS.DATABASE_QUESTION_COUNT_INCREMENT}"]`
    );

    for (let index = 0; index < 8; index += 1) {
      toggleCheckbox(incrementButton);
    }

    expect(countValue().textContent).toBe('50');
    expect(incrementButton.disabled).toBe(true);

    toggleCheckbox(incrementButton);
    expect(countValue().textContent).toBe('50');
  });

  it('passes the adjusted question count through to the AI prompt on submit', async () => {
    mockCallAI.mockResolvedValue(JSON.stringify({
      surveyTitle: 'Adjusted Count Survey',
      questions: buildAiQuestions(15),
    }));

    await renderSubject(
      <AudioSurveyGenerator
        provider={{}}
        network={{}}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
      />
    );

    toggleCheckbox(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_QUESTION_COUNT_INCREMENT}"]`));
    setAudioInputValue('This database tool content is comfortably longer than fifty characters for generation.');

    const form = container.querySelector('form');
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mockCallAI).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_QUESTION_COUNT_VALUE}"]`).textContent
    ).toBe('15');
    expect(mockCallAI.mock.calls[0][0]).toMatch(/numberOfSeedStatementsOrPrompts:\s*15\b/);
  });

  it('uses webpage source type when only additional URL sources are provided', async () => {
    mockProcessAdditionalSources.mockResolvedValue(
      'This is extracted webpage content from additional sources only, and it is long enough to pass validation.'
    );
    mockCallAI.mockResolvedValue(
      JSON.stringify({
        surveyTitle: 'URL Source Survey',
        questions: [
          {
            prompt: 'Should this be treated as webpage content?',
            questionType: 'binary',
            tags: ['webpage'],
          },
        ],
      })
    );

    await act(async () => {
      root.render(
        <AudioSurveyGenerator
          provider={{}}
          network={{}}
          account="0x123"
          loginComplete
          toggleLoginModal={jest.fn()}
        />
      );
    });

    const urlInput = container.querySelector('input[placeholder="Add URL"]');
    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setValue.call(urlInput, 'https://example.com/article');
      urlInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const addUrlButton = container.querySelector('button[title="Add URL"]');
    await act(async () => {
      addUrlButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('[url]');

    const form = container.querySelector('form');
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mockProcessAdditionalSources).toHaveBeenCalledTimes(1);
    expect(mockFetchContentFromURL).not.toHaveBeenCalled();
    expect(mockCallAI).toHaveBeenCalledTimes(1);
    expect(mockCallAI.mock.calls[0][0]).toMatch(/SourceType:\s*webpage/);
  });

  it('blocks question generation when photo analysis is unsupported by the configured AI provider or model', async () => {
    mockAnalyzePhotoForQuestionGeneration.mockRejectedValueOnce(
      new Error('Photo analysis requires a vision-capable OpenAI, Anthropic, or OpenRouter model.')
    );

    await renderSubject(
      <AudioSurveyGenerator
        provider={{}}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
        activeSessionSlug="edge"
        sessionConfig={makeSessionConfig()}
      />
    );

    addAdditionalPhoto();

    const form = container.querySelector('form');
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mockAnalyzePhotoForQuestionGeneration).toHaveBeenCalledTimes(1);
    expect(mockCallAI).not.toHaveBeenCalled();
    expect(mockUploadDocLibraryFile).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Photo analysis requires a vision-capable OpenAI, Anthropic, or OpenRouter model.');
    expect(container.textContent).toContain('Photo analysis failed for memo.png');
  });

  it('injects successful photo analysis into the question-generation prompt without calling generic file processing', async () => {
    const photo = new File(['photo-source'], 'whiteboard.png', { type: 'image/png' });
    mockAnalyzePhotoForQuestionGeneration.mockResolvedValueOnce({
      text: 'This screenshot shows a policy whiteboard with three budget scenarios, two risk warnings, and a recommendation to phase in disclosure requirements over six months.',
    });
    mockCallAI.mockResolvedValue(JSON.stringify({
      surveyTitle: 'Photo Survey',
      questions: [
        {
          prompt: 'Should the phased disclosure plan move forward?',
          questionType: 'binary',
          tags: ['photo'],
        },
      ],
    }));

    await renderSubject(
      <AudioSurveyGenerator
        provider={{}}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
        activeSessionSlug="edge"
        sessionConfig={makeSessionConfig()}
      />
    );

    addAdditionalPhoto(photo);

    const form = container.querySelector('form');
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mockAnalyzePhotoForQuestionGeneration).toHaveBeenCalledWith(photo, expect.objectContaining({
      sessionSlug: 'edge',
    }));
    expect(mockProcessAdditionalSources).not.toHaveBeenCalled();
    expect(mockCallAI).toHaveBeenCalledTimes(1);
    expect(mockCallAI.mock.calls[0][0]).toContain('Photo Source: whiteboard.png');
    expect(mockCallAI.mock.calls[0][0]).toContain('phase in disclosure requirements over six months');
    expect(container.textContent).toContain('Analysis ready');
  });

  it('expands and collapses inline photo analysis from the Analysis complete toggle', async () => {
    const photo = new File(['photo-source'], 'whiteboard.png', { type: 'image/png' });
    mockAnalyzePhotoForQuestionGeneration.mockResolvedValueOnce({
      text: 'This screenshot shows a policy whiteboard with three budget scenarios, two risk warnings, and a recommendation to phase in disclosure requirements over six months.',
    });
    mockCallAI.mockResolvedValue(JSON.stringify({
      surveyTitle: 'Photo Survey',
      questions: [
        {
          prompt: 'Should the phased disclosure plan move forward?',
          questionType: 'binary',
          tags: ['photo'],
        },
      ],
    }));

    await renderSubject(
      <AudioSurveyGenerator
        provider={{}}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
        activeSessionSlug="edge"
        sessionConfig={makeSessionConfig()}
      />
    );

    addAdditionalPhoto(photo);

    const form = container.querySelector('form');
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    const photoCard = getPhotoCardByName('whiteboard.png');
    const sourceId = getPhotoSourceId(photoCard);
    const analysisToggle = getPhotoAnalysisToggleBySourceId(sourceId);

    expect(analysisToggle).toBeTruthy();
    expect(analysisToggle.textContent).toContain('Analysis complete');
    expect(analysisToggle.getAttribute('aria-expanded')).toBe('false');
    expect(getPhotoAnalysisBodyBySourceId(sourceId)).toBeNull();

    toggleCheckbox(analysisToggle);
    expect(getPhotoAnalysisToggleBySourceId(sourceId).getAttribute('aria-expanded')).toBe('true');
    expect(getPhotoAnalysisBodyBySourceId(sourceId).textContent).toContain(
      'phase in disclosure requirements over six months'
    );

    toggleCheckbox(getPhotoAnalysisToggleBySourceId(sourceId));
    expect(getPhotoAnalysisToggleBySourceId(sourceId).getAttribute('aria-expanded')).toBe('false');
    expect(getPhotoAnalysisBodyBySourceId(sourceId)).toBeNull();
  });

  it('hides the session-context checkbox until a file or URL source is present', async () => {
    await renderSubject(
      <AudioSurveyGenerator
        provider={{}}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
        activeSessionSlug="edge"
        sessionConfig={makeSessionConfig()}
      />
    );

    expect(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_TOGGLE}"]`)).toBeNull();
    expect(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_ADD_LIBRARY_BUTTON}"]`)).toBeNull();

    setInputValue('input[placeholder="Add URL"]', 'https://example.com/source');

    expect(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_TOGGLE}"]`)).toBeTruthy();
    expect(container.textContent).toContain('Add to session context');
    expect(container.textContent).not.toContain('Session Doc Library');
    expect(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_ADD_LIBRARY_BUTTON}"]`)).toBeNull();

    await act(async () => {
      container
        .querySelector('button[title="Add URL"]')
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_TOGGLE}"]`)).toBeTruthy();
  });

  it('queues image URLs through the shared Add URL field', async () => {
    await renderSubject(
      <AudioSurveyGenerator
        provider={{}}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
      />
    );

    mockFetchImageFromURL.mockResolvedValueOnce(
      new File(['remote-image'], 'remote_image.png', { type: 'image/png' })
    );
    setInputValue('input[placeholder="Add URL"]', 'https://example.com/context.png');

    await act(async () => {
      container
        .querySelector('button[title="Add URL"]')
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mockFetchImageFromURL).toHaveBeenCalledWith('https://example.com/context.png');
    expect(getPhotoCards()).toHaveLength(1);
    expect(container.textContent).toContain('remote_image.png');
  });

  it('treats extensionless image URLs as photos when the fetched content is an image', async () => {
    await renderSubject(
      <AudioSurveyGenerator
        provider={{}}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
      />
    );

    mockFetchImageFromURL.mockResolvedValueOnce(
      new File(['remote-image'], 'remote_asset.webp', { type: 'image/webp' })
    );
    setInputValue('input[placeholder="Add URL"]', 'https://example.com/assets/render?id=123');

    await act(async () => {
      container
        .querySelector('button[title="Add URL"]')
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mockFetchImageFromURL).toHaveBeenCalledWith('https://example.com/assets/render?id=123');
    expect(getPhotoCards()).toHaveLength(1);
    expect(container.textContent).toContain('remote_asset.webp');
  });

  it('keeps Add mode on a single URL entry path', async () => {
    await renderSubject(
      <AudioSurveyGenerator
        provider={{}}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
      />
    );

    expect(container.querySelectorAll('input[placeholder="Add URL"]')).toHaveLength(1);
    expect(
      Array.from(container.querySelectorAll('button')).filter((node) => node.textContent.trim() === 'URL')
    ).toHaveLength(0);
  });

  it('shows the title field only after an uploaded file source is queued', async () => {
    await renderSubject(
      <AudioSurveyGenerator
        provider={{}}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
      />
    );

    expect(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_TITLE_INPUT}"]`)).toBeNull();

    addAdditionalPhoto(new File(['photo-source'], 'briefing.jpeg', { type: 'image/jpeg' }));

    expect(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_TITLE_INPUT}"]`)).toBeTruthy();
  });

  it('accepts both docs and jpeg images in the shared upload chooser', async () => {
    await renderSubject(
      <AudioSurveyGenerator
        provider={{}}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
      />
    );

    const fileInput = container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_IMAGE_FILE_INPUT}"]`);
    expect(fileInput.getAttribute('accept')).toContain('.pdf');
    expect(fileInput.getAttribute('accept')).toContain('.jpeg');
    expect(fileInput.getAttribute('accept')).toContain('.jpg');
  });

  it('does not expose direct session-context upload controls for pasted text-only input', async () => {
    await renderSubject(
      <AudioSurveyGenerator
        provider={{ request: jest.fn() }}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
        activeSessionSlug="edge"
        sessionConfig={makeSessionConfig({
          sessionId: '0xSessionToken',
          sessionIdHex: `0x${'8'.repeat(32)}`,
        })}
      />
    );

    expect(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_TITLE_INPUT}"]`)).toBeNull();
    setAudioInputValue('These are durable context notes that should generate questions without exposing a direct context upload action.');

    expect(findGenerateQuestionsButton()).toBeTruthy();
    expect(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_ADD_LIBRARY_BUTTON}"]`)).toBeNull();
    expect(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_TOGGLE}"]`)).toBeNull();
    expect(container.textContent).not.toContain('Add to Library');
    expect(container.textContent).not.toContain('Add to session context');
    expect(mockUploadDocLibraryFile).not.toHaveBeenCalled();
  });

  it('defaults generate-time session context saves to only-me when the session doc gate uses OP Sepolia', async () => {
    delete window.__litHooks;
    const onQuestionsGenerated = jest.fn();
    mockProcessAdditionalSources.mockResolvedValue(
      'This additional source content is long enough to drive question generation on its own.'
    );
    mockCallAI.mockResolvedValue(JSON.stringify({
      surveyTitle: 'Private Context Survey',
      questions: [
        {
          prompt: 'Should private context stay wallet-scoped?',
          questionType: 'binary',
          tags: ['docs'],
        },
      ],
    }));

    await renderSubject(
      <AudioSurveyGenerator
        provider={{ request: jest.fn() }}
        network={{ id: 11155420 }}
        account="0x0000000000000000000000000000000000000123"
        loginComplete
        toggleLoginModal={jest.fn()}
        activeSessionSlug="edge"
        sessionConfig={makeSessionConfig({
          sessionIdHex: `0x${'8'.repeat(32)}`,
          docUploadsGate: {
            lookupStatus: 'ok',
            sbtAddresses: ['0x00000000000000000000000000000000000000aa'],
            chainId: 11155420,
            mode: 0,
          },
        })}
        onQuestionsGenerated={onQuestionsGenerated}
      />
    );

    await addAdditionalUrl('https://example.com/private-context');
    toggleCheckbox(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_TOGGLE}"]`));

    const audienceButton = container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_AUDIENCE_BUTTON}"]`);
    expect(audienceButton.getAttribute('data-ce-doc-save-audience')).toBe('self');
    expect(audienceButton.getAttribute('aria-label')).toContain('only me');
    expect(audienceButton.textContent).not.toContain('only me');

    await act(async () => {
      container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mockUploadDocLibraryUrlRecord).toHaveBeenCalledTimes(1);
    expect(mockUploadDocLibraryUrlRecord.mock.calls[0][0].encryption).toEqual(expect.objectContaining({
      recipientType: 'self-eip712-v1',
      selfRecipient: true,
      contextLabel: 'doc-link:edge',
    }));
    expect(mockUploadDocLibraryUrlRecord.mock.calls[0][0].encryption).not.toHaveProperty('saveKey');
    expect(mockUploadDocLibraryUrlRecord.mock.calls[0][0].encryption).not.toHaveProperty('accessControlConditions');
    expect(onQuestionsGenerated).toHaveBeenCalledTimes(1);
  });

  it('can skip photo-analysis sidecar uploads when adding images to session context during generation', async () => {
    const photo = new File(['photo-source'], 'briefing.png', { type: 'image/png' });
    const onQuestionsGenerated = jest.fn();
    mockAnalyzePhotoForQuestionGeneration.mockResolvedValue('Briefing image analysis for generated questions.');
    mockCallAI.mockResolvedValue(JSON.stringify({
      surveyTitle: 'Photo Context Survey',
      questions: [
        {
          prompt: 'Should photo context be saved without an analysis sidecar?',
          questionType: 'binary',
          tags: ['photo'],
        },
      ],
    }));

    await renderSubject(
      <AudioSurveyGenerator
        provider={{ request: jest.fn() }}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
        activeSessionSlug="edge"
        sessionConfig={makeSessionConfig({
          sessionIdHex: `0x${'8'.repeat(32)}`,
        })}
        onQuestionsGenerated={onQuestionsGenerated}
      />
    );

    setAudioInputValue('This primary source text is long enough to generate questions while a photo source is also saved as context.');
    addAdditionalPhoto(photo);
    toggleCheckbox(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_TOGGLE}"]`));
    toggleCheckbox(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_LIBRARY_ANALYZE_TOGGLE}"]`));

    await act(async () => {
      container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mockUploadDocLibraryFile).toHaveBeenCalledTimes(1);
    expect(mockUploadDocLibraryFile.mock.calls[0][0].file).toBe(photo);
    expect(onQuestionsGenerated).toHaveBeenCalledTimes(1);
  });

  it('resolves the active session config by slug before saving extra doc sources', async () => {
    const onQuestionsGenerated = jest.fn();
    mockGetSessionConfigBySlug.mockImplementation((slug) => {
      const normalized = String(slug || '');
      if (normalized === 'edge') {
        return makeSessionConfig({
          sessionId: '0xSessionToken',
          sessionIdHex: `0x${'7'.repeat(32)}`,
        });
      }
      if (normalized === 'rxc') return { slug: 'rxc', sessionName: 'Debate Session' };
      return {};
    });
    mockProcessAdditionalSources.mockResolvedValue(
      'This saved source has enough content to drive question generation.'
    );
    mockCallAI.mockResolvedValue(JSON.stringify({
      surveyTitle: 'Slug Resolved Survey',
      questions: [
        {
          prompt: 'Can saved doc sources resolve session config by slug?',
          questionType: 'binary',
          tags: ['docs'],
        },
      ],
    }));

    await renderSubject(
      <AudioSurveyGenerator
        provider={{ request: jest.fn() }}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
        activeSessionSlug="edge"
        onQuestionsGenerated={onQuestionsGenerated}
      />
    );

    addAdditionalUrl('https://example.com/slug-only');
    toggleCheckbox(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_TOGGLE}"]`));

    const form = container.querySelector('form');
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mockUploadDocLibraryUrlRecord).toHaveBeenCalledTimes(1);
    expect(onQuestionsGenerated).toHaveBeenCalledTimes(1);
    expect(onQuestionsGenerated.mock.calls[0][1][0]).toContain('/session/0xSessionToken/docs?');
    expect(onQuestionsGenerated.mock.calls[0][1][0].startsWith('/session/0xSessionToken/docs?')).toBe(true);
  });

  it('saves queued file sources through the shared doc-library upload helper', async () => {
    const onQuestionsGenerated = jest.fn();
    const file = new File(['file-source-content'], 'notes.txt', { type: 'text/plain' });
    mockProcessAdditionalSources.mockResolvedValue(
      'This uploaded file contributes enough content for question generation.'
    );
    mockCallAI.mockResolvedValue(JSON.stringify({
      surveyTitle: 'Saved File Survey',
      questions: [
        {
          prompt: 'Should saved file sources use doc-library refs?',
          questionType: 'binary',
          tags: ['docs'],
        },
      ],
    }));

    await renderSubject(
      <AudioSurveyGenerator
        provider={{ request: jest.fn() }}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
        activeSessionSlug="edge"
        sessionConfig={makeSessionConfig({
          sessionId: '0xSessionToken',
          sessionIdHex: `0x${'5'.repeat(32)}`,
        })}
        onQuestionsGenerated={onQuestionsGenerated}
      />
    );

    addAdditionalFile(file);
    toggleCheckbox(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_TOGGLE}"]`));

    const form = container.querySelector('form');
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mockUploadDocLibraryFile).toHaveBeenCalledTimes(1);
    expect(mockUploadDocLibraryFile).toHaveBeenCalledWith(expect.objectContaining({
      file,
    }));
    expect(onQuestionsGenerated.mock.calls[0][1]).toEqual([
      expect.stringContaining('/session/0xSessionToken/docs?'),
    ]);
    expect(onQuestionsGenerated.mock.calls[0][1][0].startsWith('/session/0xSessionToken/docs?')).toBe(true);
  });

  it('keeps photo analysis ephemeral when doc-library saving is disabled', async () => {
    mockAnalyzePhotoForQuestionGeneration.mockResolvedValueOnce({
      text: 'This document photo summarizes a draft charter with enough detail to drive question generation without additional text input.',
    });
    mockCallAI.mockResolvedValue(JSON.stringify({
      surveyTitle: 'Ephemeral Photo Survey',
      questions: [
        {
          prompt: 'Should ephemeral photo analysis stay unsaved?',
          questionType: 'binary',
          tags: ['photo'],
        },
      ],
    }));

    await renderSubject(
      <AudioSurveyGenerator
        provider={{ request: jest.fn() }}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
        activeSessionSlug="edge"
        sessionConfig={makeSessionConfig()}
      />
    );

    addAdditionalPhoto();

    const form = container.querySelector('form');
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mockUploadDocLibraryFile).not.toHaveBeenCalled();
    expect(mockCallAI).toHaveBeenCalledTimes(1);
  });

  it('saves queued photo sources as both the original image and a paired analysis sidecar', async () => {
    const onQuestionsGenerated = jest.fn();
    const photo = new File(['photo-source'], 'policy-note.png', { type: 'image/png' });
    mockAnalyzePhotoForQuestionGeneration.mockResolvedValueOnce({
      text: 'This screenshot shows a policy note with enough text to generate several concrete survey questions about implementation timing and risk tradeoffs.',
    });
    mockUploadDocLibraryFile
      .mockResolvedValueOnce({
        txId: 'C'.repeat(43),
        url: `https://example.com/${'C'.repeat(43)}`,
        storage: 'lit-arweave',
        kind: 'file',
        tagMap: {},
        data: { size: null, type: 'application/json' },
      })
      .mockResolvedValueOnce({
        txId: 'D'.repeat(43),
        url: `https://example.com/${'D'.repeat(43)}`,
        storage: 'lit-arweave',
        kind: 'file',
        tagMap: {},
        data: { size: null, type: 'application/json' },
      });
    mockCallAI.mockResolvedValue(JSON.stringify({
      surveyTitle: 'Saved Photo Survey',
      questions: [
        {
          prompt: 'Should the policy note analysis be saved beside the image?',
          questionType: 'binary',
          tags: ['photo'],
        },
      ],
    }));

    await renderSubject(
      <AudioSurveyGenerator
        provider={{ request: jest.fn() }}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
        activeSessionSlug="edge"
        sessionConfig={makeSessionConfig({
          sessionId: '0xSessionToken',
          sessionIdHex: `0x${'6'.repeat(32)}`,
        })}
        onQuestionsGenerated={onQuestionsGenerated}
      />
    );

    addAdditionalPhoto(photo);
    toggleCheckbox(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_TOGGLE}"]`));

    const form = container.querySelector('form');
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mockUploadDocLibraryFile).toHaveBeenCalledTimes(2);
    expect(mockUploadDocLibraryFile.mock.calls[0][0]).toEqual(expect.objectContaining({
      file: photo,
      encryption: expect.objectContaining({
        contextLabel: 'doc:edge',
      }),
      tags: expect.arrayContaining([
        expect.objectContaining({ name: 'CE-DocRole', value: 'photo' }),
      ]),
    }));
    expect(mockUploadDocLibraryFile.mock.calls[1][0]).toEqual(expect.objectContaining({
      file: expect.objectContaining({
        name: 'policy-note.analysis.md',
        type: 'text/markdown',
      }),
      encryption: expect.objectContaining({
        contextLabel: 'doc:edge',
      }),
      tags: expect.arrayContaining([
        expect.objectContaining({ name: 'CE-DocRole', value: 'photo-analysis' }),
        expect.objectContaining({ name: 'CE-DocDerivedFromTx', value: 'C'.repeat(43) }),
      ]),
    }));
    expect(onQuestionsGenerated).toHaveBeenCalledTimes(1);
    expect(onQuestionsGenerated.mock.calls[0][1]).toEqual([
      expect.stringContaining(`/session/0xSessionToken/docs?__ceDocTx=${'C'.repeat(43)}`),
      expect.stringContaining(`/session/0xSessionToken/docs?__ceDocTx=${'D'.repeat(43)}`),
    ]);
  });

  it('removing one queued photo leaves the other queued photo intact', async () => {
    const firstPhoto = new File(['photo-one'], 'memo.png', { type: 'image/png' });
    const secondPhoto = new File(['photo-two'], 'diagram.webp', { type: 'image/webp' });

    await renderSubject(
      <AudioSurveyGenerator
        provider={{}}
        network={{}}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
      />
    );

    addAdditionalPhoto([firstPhoto, secondPhoto]);

    const firstCard = getPhotoCardByName('memo.png');
    const secondCard = getPhotoCardByName('diagram.webp');

    expect(firstCard).toBeTruthy();
    expect(secondCard).toBeTruthy();

    toggleCheckbox(firstCard.querySelector('button[aria-label="Remove photo memo.png"]'));

    expect(getPhotoCards()).toHaveLength(1);
    expect(getPhotoCardByName('memo.png')).toBeUndefined();
    expect(getPhotoCardByName('diagram.webp')).toBeTruthy();
  });

  it('keeps the saved-context audience label behind an icon-only lock when the doc gate exists', async () => {
    await renderSubject(
      <AudioSurveyGenerator
        provider={{ request: jest.fn() }}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
        activeSessionSlug="edge"
        sessionConfig={makeSessionConfig()}
      />
    );

    addAdditionalUrl('https://example.com/source');
    toggleCheckbox(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_TOGGLE}"]`));

    const audienceButton = container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_AUDIENCE_BUTTON}"]`);
    expect(audienceButton.getAttribute('data-ce-doc-save-audience')).toBe('session');
    expect(audienceButton.getAttribute('aria-label')).toContain('Edge Session');
    expect(audienceButton.textContent).not.toContain('Edge Session');

    act(() => {
      audienceButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_AUDIENCE_SELF}"]`)).toBeTruthy();
    expect(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_AUDIENCE_SESSION}"]`)).toBeTruthy();
  });

  it('falls back to only-me audience behind the lock when the session docUploads gate is unavailable', async () => {
    await renderSubject(
      <AudioSurveyGenerator
        provider={{ request: jest.fn() }}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
        activeSessionSlug="edge"
        sessionConfig={makeSessionConfig({ docUploadsGate: null })}
      />
    );

    addAdditionalUrl('https://example.com/private');
    toggleCheckbox(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_TOGGLE}"]`));

    const audienceButton = container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_AUDIENCE_BUTTON}"]`);
    expect(audienceButton.getAttribute('data-ce-doc-save-audience')).toBe('self');
    expect(audienceButton.getAttribute('aria-label')).toContain('only me');
    expect(audienceButton.textContent).not.toContain('only me');

    act(() => {
      audienceButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_AUDIENCE_SELF}"]`)).toBeTruthy();
    expect(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_AUDIENCE_SESSION}"]`)).toBeNull();
    expect(container.textContent).toContain('Saved docs will stay private to your wallet');
  });

  it('recomputes the default saved-doc audience when the session doc gate loads later', async () => {
    await renderSubject(
      <AudioSurveyGenerator
        provider={{ request: jest.fn() }}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
        activeSessionSlug="edge"
        sessionConfig={makeSessionConfig({
          sessionIdHex: `0x${'3'.repeat(32)}`,
          docUploadsGate: null,
        })}
      />
    );

    addAdditionalUrl('https://example.com/delayed-gate');
    toggleCheckbox(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_TOGGLE}"]`));

    expect(
      container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_AUDIENCE_BUTTON}"]`).getAttribute('aria-label')
    ).toContain('only me');

    await renderSubject(
      <AudioSurveyGenerator
        provider={{ request: jest.fn() }}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
        activeSessionSlug="edge"
        sessionConfig={makeSessionConfig({
          sessionIdHex: `0x${'3'.repeat(32)}`,
          docUploadsGate: {
            lookupStatus: 'ok',
            sbtAddresses: ['0x00000000000000000000000000000000000000aa'],
            chainId: 84532,
            mode: 0,
          },
        })}
      />
    );

    expect(
      container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_AUDIENCE_BUTTON}"]`).getAttribute('aria-label')
    ).toContain('Edge Session');
  });

  it('saves queued extra sources into the session doc library before generating questions', async () => {
    const onQuestionsGenerated = jest.fn();
    mockProcessAdditionalSources.mockResolvedValue(
      'This additional source content is long enough to drive question generation on its own.'
    );
    mockCallAI.mockResolvedValue(JSON.stringify({
      surveyTitle: 'Saved Sources Survey',
      questions: [
        {
          prompt: 'Should saved sources use doc-library refs?',
          questionType: 'binary',
          tags: ['docs'],
        },
      ],
    }));

    await renderSubject(
      <AudioSurveyGenerator
        provider={{ request: jest.fn() }}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
        activeSessionSlug="edge"
        sessionConfig={makeSessionConfig({
          sessionId: '0xSessionToken',
          sessionIdHex: `0x${'4'.repeat(32)}`,
        })}
        onQuestionsGenerated={onQuestionsGenerated}
      />
    );

    addAdditionalUrl('https://example.com/to-save');
    toggleCheckbox(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_TOGGLE}"]`));

    const form = container.querySelector('form');
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mockUploadDocLibraryUrlRecord).toHaveBeenCalledTimes(1);
    expect(mockCallAI).toHaveBeenCalledTimes(1);
    expect(mockUploadDocLibraryUrlRecord.mock.invocationCallOrder[0]).toBeLessThan(mockCallAI.mock.invocationCallOrder[0]);
    expect(onQuestionsGenerated).toHaveBeenCalledTimes(1);
    expect(onQuestionsGenerated.mock.calls[0][1]).toEqual([
      expect.stringContaining('/session/0xSessionToken/docs?'),
    ]);
    expect(onQuestionsGenerated.mock.calls[0][1][0].startsWith('/session/0xSessionToken/docs?')).toBe(true);
    expect(onQuestionsGenerated.mock.calls[0][1][0]).toContain(`__ceDocTx=${'A'.repeat(43)}`);
    expect(onQuestionsGenerated.mock.calls[0][1][0]).not.toBe('https://example.com/to-save');
  });

  it('saves a typed URL source into session context during generation without requiring the add-url click', async () => {
    const onQuestionsGenerated = jest.fn();
    mockProcessAdditionalSources.mockResolvedValue(
      'This typed URL source content is long enough to drive question generation on its own.'
    );
    mockCallAI.mockResolvedValue(JSON.stringify({
      surveyTitle: 'Typed URL Saved Sources Survey',
      questions: [
        {
          prompt: 'Should typed URLs be saved as context before generation?',
          questionType: 'binary',
          tags: ['docs'],
        },
      ],
    }));

    await renderSubject(
      <AudioSurveyGenerator
        provider={{ request: jest.fn() }}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
        activeSessionSlug="edge"
        sessionConfig={makeSessionConfig({
          sessionId: '0xSessionToken',
          sessionIdHex: `0x${'4'.repeat(32)}`,
        })}
        onQuestionsGenerated={onQuestionsGenerated}
      />
    );

    setInputValue('input[placeholder="Add URL"]', 'https://example.com/typed-to-save');
    toggleCheckbox(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_TOGGLE}"]`));

    const form = container.querySelector('form');
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mockUploadDocLibraryUrlRecord).toHaveBeenCalledTimes(1);
    expect(mockUploadDocLibraryUrlRecord).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://example.com/typed-to-save',
    }));
    expect(mockCallAI).toHaveBeenCalledTimes(1);
    expect(onQuestionsGenerated).toHaveBeenCalledTimes(1);
    expect(onQuestionsGenerated.mock.calls[0][1]).toEqual([
      expect.stringContaining('/session/0xSessionToken/docs?'),
    ]);
    expect(onQuestionsGenerated.mock.calls[0][1][0]).toContain(`__ceDocTx=${'A'.repeat(43)}`);
    expect(onQuestionsGenerated.mock.calls[0][1][0]).not.toBe('https://example.com/typed-to-save');
    expect(container.querySelector('input[placeholder="Add URL"]').value).toBe('');
  });

  it('uses scoped Lit hooks for OP Sepolia session-context saves when Chipotle credentials stay server-side', async () => {
    delete window.__litHooks;
    const scopedSaveKey = jest.fn(async () => ({ ciphertext: 'ciphertext', dataToEncryptHash: 'hash' }));
    const onQuestionsGenerated = jest.fn();
    mockProcessAdditionalSources.mockResolvedValue(
      'This additional source content is long enough to drive question generation on its own.'
    );
    mockCallAI.mockResolvedValue(JSON.stringify({
      surveyTitle: 'Worker Runtime Survey',
      questions: [
        {
          prompt: 'Can server-side Lit runtime save session-gated context?',
          questionType: 'binary',
          tags: ['docs'],
        },
      ],
    }));

    await renderSubject(
      <AudioSurveyGenerator
        provider={{ request: jest.fn() }}
        network={{ id: 11155420 }}
        account="0x123"
        litHooks={{ saveKey: scopedSaveKey }}
        loginComplete
        toggleLoginModal={jest.fn()}
        activeSessionSlug="edge"
        sessionConfig={makeSessionConfig({
          sessionId: '0xSessionToken',
          sessionIdHex: `0x${'7'.repeat(32)}`,
          corsWorkerUrl: 'https://worker.example.test',
          docUploadsGate: {
            lookupStatus: 'ok',
            sbtAddresses: ['0x00000000000000000000000000000000000000aa'],
            chainId: 11155420,
            mode: 0,
          },
        })}
        onQuestionsGenerated={onQuestionsGenerated}
      />
    );

    await addAdditionalUrl('https://example.com/to-save-with-worker-runtime');
    toggleCheckbox(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_TOGGLE}"]`));

    expect(
      container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_AUDIENCE_BUTTON}"]`).getAttribute('aria-label')
    ).toContain('Edge Session');

    const form = container.querySelector('form');
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mockUploadDocLibraryUrlRecord).toHaveBeenCalledWith(expect.objectContaining({
      encryption: expect.objectContaining({
        enabled: true,
        saveKey: scopedSaveKey,
        chainId: 11155420,
      }),
    }));
    expect(onQuestionsGenerated).toHaveBeenCalledTimes(1);
  });

  it('keeps raw extra-source URLs when doc-library saving is not enabled', async () => {
    const onQuestionsGenerated = jest.fn();
    mockProcessAdditionalSources.mockResolvedValue(
      'This additional source content is long enough to drive question generation on its own.'
    );
    mockCallAI.mockResolvedValue(JSON.stringify({
      surveyTitle: 'Raw URL Survey',
      questions: [
        {
          prompt: 'Should unsaved sources stay raw?',
          questionType: 'binary',
          tags: ['docs'],
        },
      ],
    }));

    await renderSubject(
      <AudioSurveyGenerator
        provider={{ request: jest.fn() }}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
        activeSessionSlug="edge"
        sessionConfig={makeSessionConfig()}
        onQuestionsGenerated={onQuestionsGenerated}
      />
    );

    addAdditionalUrl('https://example.com/raw-source');

    const form = container.querySelector('form');
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mockUploadDocLibraryUrlRecord).not.toHaveBeenCalled();
    expect(onQuestionsGenerated).toHaveBeenCalledWith(
      expect.any(Array),
      ['https://example.com/raw-source'],
      'Raw URL Survey'
    );
  });

  it('opens login without showing the old library error when session-context generation needs auth', async () => {
    const toggleLoginModal = jest.fn();
    await renderSubject(
      <AudioSurveyGenerator
        provider={{ request: jest.fn() }}
        network={{ id: 84532 }}
        account=""
        loginComplete={false}
        toggleLoginModal={toggleLoginModal}
        activeSessionSlug="edge"
        sessionConfig={makeSessionConfig()}
      />
    );

    setInputValue('input[placeholder="Add URL"]', 'https://example.com/auth-required');
    toggleCheckbox(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_TOGGLE}"]`));

    await act(async () => {
      container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(toggleLoginModal).toHaveBeenCalledWith(true);
    expect(mockUploadDocLibraryUrlRecord).not.toHaveBeenCalled();
    expect(mockProcessAdditionalSources).not.toHaveBeenCalled();
    expect(mockCallAI).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('Connect a wallet to save sources to the session doc library');
    expect(container.textContent).not.toContain('Generation failed');
  });

  it('blocks question generation when saving queued doc sources fails', async () => {
    mockUploadDocLibraryUrlRecord.mockRejectedValueOnce(new Error('Save failed.'));
    mockProcessAdditionalSources.mockResolvedValue(
      'This additional source content is long enough to drive question generation on its own.'
    );
    mockCallAI.mockResolvedValue(JSON.stringify({
      surveyTitle: 'Should not render',
      questions: [],
    }));

    await renderSubject(
      <AudioSurveyGenerator
        provider={{ request: jest.fn() }}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
        activeSessionSlug="edge"
        sessionConfig={makeSessionConfig()}
      />
    );

    addAdditionalUrl('https://example.com/fails');
    toggleCheckbox(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_TOGGLE}"]`));

    const form = container.querySelector('form');
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mockCallAI).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Save failed.');
    expect(container.querySelector('[data-testid="create-questions-and-surveys"]')).toBeNull();
  });

  it('defers loading the demo corpus module until explorer view renders it', async () => {
    expect(mockCorpusViewerModuleLoadCount).toBe(0);

    await renderSubject(
      <AudioSurveyGenerator
        provider={{}}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
      />
    );

    expect(mockCorpusViewerModuleLoadCount).toBe(0);
    expect(mockCorpusViewer).not.toHaveBeenCalled();

    await renderSubject(
      <AudioSurveyGenerator
        provider={{}}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
        activeSessionSlug="edge"
        sessionConfig={{
          slug: 'edge',
          sessionName: 'Edge Session',
          __registry: {
            sessionIdHex: `0x${'9'.repeat(32)}`,
          },
        }}
        explorerMode="view"
      />
    );

    expect(mockCorpusViewerModuleLoadCount).toBe(1);
    expect(container.querySelector('[data-testid="mock-corpus-viewer"]')).toBeTruthy();
  });

  it('does not render the removed open-full-page link in view mode', async () => {
    await renderSubject(
      <AudioSurveyGenerator
        provider={{}}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
        activeSessionSlug="DEBATE"
        sessionConfig={makeSessionConfig({
          slug: 'DEBATE',
          sessionName: 'Debate Session',
          sessionId: '0xSessionToken',
          sessionIdHex: `0x${'1'.repeat(32)}`,
        })}
        explorerMode="view"
      />
    );

    const demoToggle = container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_VIEW_DEMO_TOGGLE}"]`);
    toggleCheckbox(demoToggle);

    expect(container.textContent).not.toContain('Open full page');
    expect(Array.from(container.querySelectorAll('a')).some((node) => node.textContent === 'Open full page')).toBe(false);
  });

  it('defaults explorer view mode to the demo corpus and can switch to the session doc library', async () => {
    await renderSubject(
      <AudioSurveyGenerator
        provider={{}}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
        activeSessionSlug="edge"
        sessionConfig={{
          slug: 'edge',
          sessionName: 'Edge Session',
          __registry: {
            sessionIdHex: `0x${'2'.repeat(32)}`,
          },
        }}
        explorerMode="view"
      />
    );

    const demoToggle = container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_VIEW_DEMO_TOGGLE}"]`);

    expect(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_VIEW_PANEL}"]`)).toBeTruthy();
    expect(demoToggle.checked).toBe(true);
    expect(container.querySelector('[data-testid="mock-corpus-viewer"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="mock-document-library-panel"]')).toBeNull();

    toggleCheckbox(demoToggle);

    expect(container.querySelector('[data-testid="mock-corpus-viewer"]')).toBeNull();
    expect(container.querySelector('[data-testid="mock-document-library-panel"]')).toBeTruthy();
    expect(mockDocumentLibraryPanel).toHaveBeenLastCalledWith(expect.objectContaining({
      sessionSlug: 'edge',
      mode: 'session',
      compact: false,
      pageSize: 10,
    }));
  });

  it('defaults explorer view mode to session docs when demo surfaces are disabled', async () => {
    await renderSubject(
      <AudioSurveyGenerator
        provider={{}}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
        activeSessionSlug="edge"
        sessionConfig={{
          slug: 'edge',
          sessionName: 'Edge Session',
          __registry: {
            sessionIdHex: `0x${'3'.repeat(32)}`,
          },
        }}
        explorerMode="view"
        demoSurfaceMode={false}
      />
    );

    expect(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_VIEW_DEMO_TOGGLE}"]`)).toBeNull();
    expect(container.querySelector('[data-testid="mock-corpus-viewer"]')).toBeNull();
    expect(container.querySelector('[data-testid="mock-document-library-panel"]')).toBeTruthy();
    expect(mockDocumentLibraryPanel).toHaveBeenLastCalledWith(expect.objectContaining({
      sessionSlug: 'edge',
      mode: 'session',
      compact: false,
      pageSize: 10,
    }));
  });

  it('shows an empty state instead of the doc library when explorer view mode has no resolved session docs context', async () => {
    await renderSubject(
      <AudioSurveyGenerator
        provider={{}}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
        explorerMode="view"
      />
    );

    const demoToggle = container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_VIEW_DEMO_TOGGLE}"]`);

    toggleCheckbox(demoToggle);

    expect(container.textContent).toContain('Select a session with docs to view the session library here');
    expect(container.querySelector('[data-testid="mock-document-library-panel"]')).toBeNull();
  });

  it('keeps Tool Explorer view controls out of minified mode', () => {
    act(() => {
      root.render(
        <AudioSurveyGenerator
          provider={{}}
          network={{ id: 84532 }}
          account="0x123"
          loginComplete
          toggleLoginModal={jest.fn()}
          minified
          explorerMode="view"
        />
      );
    });

    expect(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_VIEW_PANEL}"]`)).toBeNull();
    expect(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_VIEW_DEMO_TOGGLE}"]`)).toBeNull();
    expect(container.querySelector('[data-testid="mock-corpus-viewer"]')).toBeNull();
    expect(container.querySelector('[data-testid="mock-document-library-panel"]')).toBeNull();
  });

  it('keeps the AudioSurveyGenerator session selector behind a gear toggle and can locally override/reset', () => {
    act(() => {
      root.render(
        <AudioSurveyGenerator
          provider={{}}
          network={{ id: 84532 }}
          account="0x123"
          loginComplete
          toggleLoginModal={jest.fn()}
          activeSessionSlug="edge"
          sessionConfig={{ slug: 'edge', sessionName: 'Edge Session' }}
        />
      );
    });

    expect(container.querySelector('[data-testid="ce-database-session-selector"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="ce-database-session-selector-toggle"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="ce-database-session-selector-panel"]')).toBeNull();

    act(() => {
      container.querySelector('[data-testid="ce-database-session-selector-toggle"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="ce-database-session-selector-panel"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="ce-database-session-chip-edge"]')).toHaveAttribute('data-session-selected', 'true');

    act(() => {
      container.querySelector('[data-testid="ce-database-session-chip-rxc"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="ce-database-session-chip-rxc"]')).toHaveAttribute('data-session-selected', 'true');
    expect(container.textContent).toContain('Using a local AudioSurveyGenerator override.');

    act(() => {
      const resetButton = Array.from(container.querySelectorAll('button')).find((node) => node.textContent.includes('Use global default'));
      resetButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="ce-database-session-chip-edge"]')).toHaveAttribute('data-session-selected', 'true');
    expect(container.textContent).toContain('Using the global primary session by default.');
  });
});
