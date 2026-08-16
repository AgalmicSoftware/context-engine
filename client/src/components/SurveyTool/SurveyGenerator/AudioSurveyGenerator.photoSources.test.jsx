import {
  React,
  act,
  AudioSurveyGenerator,
  E2E_TESTIDS,
  container,
  findGenerateQuestionsButton,
  getPhotoCards,
  getPhotoCardByName,
  getPhotoSourceId,
  getPhotoAnalysisToggleBySourceId,
  getPhotoAnalysisBodyBySourceId,
  toggleCheckbox,
  setInputValue,
  setAudioInputValue,
  addAdditionalPhoto,
  renderSubject,
  makeSessionConfig,
  mockCallAI,
  mockProcessAdditionalSources,
  mockAnalyzePhotoForQuestionGeneration,
  mockUploadDocLibraryFile,
  mockFetchImageFromURL,
  setupAudioSurveyGeneratorTestLifecycle,
} from './AudioSurveyGenerator.testUtils';

describe('AudioSurveyGenerator photo and extra source handling', () => {
  setupAudioSurveyGeneratorTestLifecycle();

  it('blocks question generation when photo analysis is unsupported by the configured AI provider or model', async () => {
    mockAnalyzePhotoForQuestionGeneration.mockRejectedValueOnce(
      new Error('Photo analysis requires a vision-capable OpenAI, Anthropic, or OpenRouter model.'),
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
      />,
    );

    addAdditionalPhoto();

    const form = container.querySelector('form');
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mockAnalyzePhotoForQuestionGeneration).toHaveBeenCalledTimes(1);
    expect(mockCallAI).not.toHaveBeenCalled();
    expect(mockUploadDocLibraryFile).not.toHaveBeenCalled();
    expect(container.textContent).toContain(
      'Photo analysis requires a vision-capable OpenAI, Anthropic, or OpenRouter model.',
    );
    expect(container.textContent).toContain('Photo analysis failed for memo.png');
  });

  it('injects successful photo analysis into the question-generation prompt without calling generic file processing', async () => {
    const photo = new File(['photo-source'], 'whiteboard.png', { type: 'image/png' });
    mockAnalyzePhotoForQuestionGeneration.mockResolvedValueOnce({
      text: 'This screenshot shows a policy whiteboard with three budget scenarios, two risk warnings, and a recommendation to phase in disclosure requirements over six months.',
    });
    mockCallAI.mockResolvedValue(
      JSON.stringify({
        surveyTitle: 'Photo Survey',
        questions: [
          {
            prompt: 'Should the phased disclosure plan move forward?',
            questionType: 'binary',
            tags: ['photo'],
          },
        ],
      }),
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
      />,
    );

    addAdditionalPhoto(photo);

    const form = container.querySelector('form');
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mockAnalyzePhotoForQuestionGeneration).toHaveBeenCalledWith(
      photo,
      expect.objectContaining({
        sessionSlug: 'edge',
      }),
    );
    expect(mockProcessAdditionalSources).not.toHaveBeenCalled();
    expect(mockCallAI).toHaveBeenCalledTimes(1);
    expect(mockCallAI.mock.calls[0][0]).toContain('Photo Source: whiteboard.png');
    expect(mockCallAI.mock.calls[0][0]).toContain('phase in disclosure requirements over six months');
    expect(container.textContent).toContain('Analysis complete');
    expect(container.textContent).not.toContain('Analysis ready');
  });

  it('expands and collapses inline photo analysis from the Analysis complete toggle', async () => {
    const photo = new File(['photo-source'], 'whiteboard.png', { type: 'image/png' });
    mockAnalyzePhotoForQuestionGeneration.mockResolvedValueOnce({
      text: 'This screenshot shows a policy whiteboard with three budget scenarios, two risk warnings, and a recommendation to phase in disclosure requirements over six months.',
    });
    mockCallAI.mockResolvedValue(
      JSON.stringify({
        surveyTitle: 'Photo Survey',
        questions: [
          {
            prompt: 'Should the phased disclosure plan move forward?',
            questionType: 'binary',
            tags: ['photo'],
          },
        ],
      }),
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
      />,
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
      'phase in disclosure requirements over six months',
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
      />,
    );

    expect(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_TOGGLE}"]`)).toBeNull();
    expect(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_ADD_LIBRARY_BUTTON}"]`)).toBeNull();

    setInputValue('input[placeholder="Add URL"]', 'https://example.com/source');

    expect(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_TOGGLE}"]`)).toBeTruthy();
    expect(container.textContent).toContain('Add to session context');
    expect(container.textContent).not.toContain('Session Doc Library');
    expect(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_ADD_LIBRARY_BUTTON}"]`)).toBeNull();

    await act(async () => {
      container.querySelector('button[title="Add URL"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
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
      />,
    );

    mockFetchImageFromURL.mockResolvedValueOnce(new File(['remote-image'], 'remote_image.png', { type: 'image/png' }));
    setInputValue('input[placeholder="Add URL"]', 'https://example.com/context.png');

    await act(async () => {
      container.querySelector('button[title="Add URL"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mockFetchImageFromURL).toHaveBeenCalledWith('https://example.com/context.png');
    expect(getPhotoCards()).toHaveLength(1);
    expect(container.textContent).toContain('remote_image.png');
  });

  it('keeps unsupported fetched image subtypes as URL sources', async () => {
    await renderSubject(
      <AudioSurveyGenerator
        provider={{}}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
      />,
    );

    mockFetchImageFromURL.mockResolvedValueOnce(
      new File(['remote-svg'], 'remote_image.svg', { type: 'image/svg+xml' }),
    );
    setInputValue('input[placeholder="Add URL"]', 'https://example.com/context.png');

    await act(async () => {
      container.querySelector('button[title="Add URL"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mockFetchImageFromURL).toHaveBeenCalledWith('https://example.com/context.png');
    expect(getPhotoCards()).toHaveLength(0);
    expect(container.textContent).toContain('[url]');
    expect(container.textContent).toContain('https://example.com/context.png');
    expect(container.textContent).not.toContain('unsupported photo');
    expect(container.querySelector('input[placeholder="Add URL"]').value).toBe('');
  });

  it('adds extensionless URLs directly without speculative image fetches', async () => {
    await renderSubject(
      <AudioSurveyGenerator
        provider={{}}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
      />,
    );

    setInputValue('input[placeholder="Add URL"]', 'https://example.com/assets/render?id=123');

    await act(async () => {
      container.querySelector('button[title="Add URL"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mockFetchImageFromURL).not.toHaveBeenCalled();
    expect(getPhotoCards()).toHaveLength(0);
    expect(container.textContent).toContain('[url]');
    expect(container.textContent).toContain('https://example.com/assets/render?id=123');
  });

  it('does not download ordinary article URLs through the image worker', async () => {
    await renderSubject(
      <AudioSurveyGenerator
        provider={{}}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
      />,
    );

    setInputValue('input[placeholder="Add URL"]', 'https://example.com/articles/policy-context');

    await act(async () => {
      container.querySelector('button[title="Add URL"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mockFetchImageFromURL).not.toHaveBeenCalled();
    expect(getPhotoCards()).toHaveLength(0);
    expect(container.textContent).toContain('[url]');
    expect(container.textContent).toContain('https://example.com/articles/policy-context');
  });

  it('keeps Add mode on a single URL entry path', async () => {
    await renderSubject(
      <AudioSurveyGenerator
        provider={{}}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
      />,
    );

    expect(container.querySelectorAll('input[placeholder="Add URL"]')).toHaveLength(1);
    expect(
      Array.from(container.querySelectorAll('button')).filter((node) => node.textContent.trim() === 'URL'),
    ).toHaveLength(0);
  });

  it('embeds paste and upload controls at the trailing end of the Add URL field', async () => {
    await renderSubject(
      <AudioSurveyGenerator
        provider={{}}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
      />,
    );

    const urlInput = container.querySelector('input[placeholder="Add URL"]');
    const urlControl = urlInput.parentElement;
    const chooser = container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_IMAGE_CHOOSER}"]`);
    const pasteButton = container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_IMAGE_PASTE}"]`);
    const uploadButton = container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_IMAGE_UPLOAD}"]`);
    const addButton = container.querySelector('button[title="Add URL"]');

    expect(chooser.parentElement).toBe(urlControl);
    expect(urlControl).toContainElement(pasteButton);
    expect(urlControl).toContainElement(uploadButton);
    expect(urlControl.lastElementChild).toBe(addButton);
  });

  it('shows the title field only after an uploaded file source is queued', async () => {
    await renderSubject(
      <AudioSurveyGenerator
        provider={{}}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
      />,
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
      />,
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
      />,
    );

    expect(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_TITLE_INPUT}"]`)).toBeNull();
    setAudioInputValue(
      'These are durable context notes that should generate questions without exposing a direct context upload action.',
    );

    expect(findGenerateQuestionsButton()).toBeTruthy();
    expect(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_ADD_LIBRARY_BUTTON}"]`)).toBeNull();
    expect(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_TOGGLE}"]`)).toBeNull();
    expect(container.textContent).not.toContain('Add to Library');
    expect(container.textContent).not.toContain('Add to session context');
    expect(mockUploadDocLibraryFile).not.toHaveBeenCalled();
  });
});
