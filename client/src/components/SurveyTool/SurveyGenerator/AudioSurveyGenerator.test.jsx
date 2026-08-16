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
  setInputValue,
  setAudioInputValue,
  addAdditionalPhoto,
  renderSubject,
  buildAiQuestions,
  mockCallAI,
  mockProcessAdditionalSources,
  mockFetchContentFromURL,
  setupAudioSurveyGeneratorTestLifecycle,
} from './AudioSurveyGenerator.testUtils';

describe('AudioSurveyGenerator input and question generation', () => {
  setupAudioSurveyGeneratorTestLifecycle();

  it('shows transcript mode only when text input exists and toggles placeholder text', () => {
    act(() => {
      root.render(
        <AudioSurveyGenerator provider={{}} network={{}} account="0x123" loginComplete toggleLoginModal={jest.fn()} />,
      );
    });

    const textarea = container.querySelector('textarea[data-testid="audio-input"]');
    expect(textarea.placeholder).toBe('Speak or type text here...');
    expect(textarea.getAttribute('data-enable-downloads')).toBe('false');
    expect(container.querySelector('[data-testid="transcript-mode-toggle"]')).toBeNull();

    setAudioInputValue('Transcript source notes');

    const toggle = container.querySelector('[data-testid="transcript-mode-toggle"]');
    expect(toggle).not.toBeNull();
    act(() => {
      toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(textarea.placeholder).toBe('Speak to capture transcript or Paste Text...');
    expect(textarea.getAttribute('data-enable-downloads')).toBe('true');
    expect(container.textContent).toContain('Upload Summary');

    setAudioInputValue('   ');

    expect(container.querySelector('[data-testid="transcript-mode-toggle"]')).toBeNull();
    expect(textarea.placeholder).toBe('Speak or type text here...');
    expect(textarea.getAttribute('data-enable-downloads')).toBe('false');
  });

  it('shows transcript mode when a URL source is typed', () => {
    act(() => {
      root.render(
        <AudioSurveyGenerator provider={{}} network={{}} account="0x123" loginComplete toggleLoginModal={jest.fn()} />,
      );
    });

    expect(container.querySelector('[data-testid="transcript-mode-toggle"]')).toBeNull();

    setInputValue('input[placeholder="Add URL"]', 'https://example.com/source');

    expect(container.querySelector('[data-testid="transcript-mode-toggle"]')).not.toBeNull();
  });

  it('hides the generate questions button until the full-size database tool has content', () => {
    act(() => {
      root.render(
        <AudioSurveyGenerator provider={{}} network={{}} account="0x123" loginComplete toggleLoginModal={jest.fn()} />,
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
        />,
      );
    });

    expect(findGenerateQuestionsButton()).toBeUndefined();

    setAudioInputValue('Compact database tool content.');
    expect(findGenerateQuestionsButton()).toBeTruthy();
  });

  it('treats queued photo uploads as valid DatabaseTool input content', async () => {
    await renderSubject(
      <AudioSurveyGenerator provider={{}} network={{}} account="0x123" loginComplete toggleLoginModal={jest.fn()} />,
    );

    expect(findGenerateQuestionsButton()).toBeUndefined();

    addAdditionalPhoto([firstPhoto, secondPhoto]);
    await act(async () => {});

    expect(getPhotoCards()).toHaveLength(2);
    expect(container.querySelectorAll(`[data-testid="${E2E_TESTIDS.DATABASE_PHOTO_SOURCE_PREVIEW}"]`)).toHaveLength(2);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('memo.png');
    expect(container.textContent).toContain('diagram.webp');
    expect(container.textContent).toContain('Queued for analysis');
    expect(findGenerateQuestionsButton()).toBeTruthy();
  });

  it('queues valid docs and photos from a mixed upload selection and skips unsupported files', async () => {
    const validPng = new File(['photo-one'], 'memo.png', { type: 'image/png' });
    const validPdf = new File(['doc-one'], 'notes.pdf', { type: 'application/pdf' });
    const validGif = new File(['photo-two'], 'diagram.gif', { type: 'image/gif' });
    const invalidSvg = new File(['not-supported'], 'vector.svg', { type: 'image/svg+xml' });

    await renderSubject(
      <AudioSurveyGenerator provider={{}} network={{}} account="0x123" loginComplete toggleLoginModal={jest.fn()} />,
    );

    addAdditionalPhoto([validPng, validPdf, validGif, invalidSvg]);

    expect(getPhotoCards()).toHaveLength(2);
    expect(container.textContent).toContain(
      'Skipped 1 unsupported file. Use pdf, md, txt, csv, ppt, pptx, json, png, jpg, jpeg, webp, or gif.',
    );
    expect(container.textContent).toContain('memo.png');
    expect(container.textContent).toContain('diagram.gif');
    expect(container.textContent).toContain('notes.pdf');
  });

  it('does not expose inline photo analysis while a queued photo is not ready', async () => {
    await renderSubject(
      <AudioSurveyGenerator provider={{}} network={{}} account="0x123" loginComplete toggleLoginModal={jest.fn()} />,
    );

    addAdditionalPhoto();

    expect(container.textContent).toContain('[photo]');
    expect(container.textContent).toContain('Queued for analysis');
    expect(findGenerateQuestionsButton()).toBeTruthy();
  });

  it('uses simplified section headings in the generator surface', async () => {
    act(() => {
      root.render(
        <AudioSurveyGenerator provider={{}} network={{}} account="0x123" loginComplete toggleLoginModal={jest.fn()} />,
      );
    });

    await act(async () => {
      const urlInput = container.querySelector('input[type="url"][placeholder="Add URL"]');
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(
        urlInput,
        'https://example.com/seed-source',
      );
      urlInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      const addButton = container.querySelector('button[title="Add URL"]');
      addButton.click();
    });
    setAudioInputValue('Question-generation context for the simplified authoring sections.');

    const sectionHeadings = Array.from(container.querySelectorAll('h3')).map((node) => node.textContent.trim());
    expect(sectionHeadings).toContain('Types');
    expect(sectionHeadings).not.toContain('Content');
    expect(sectionHeadings).not.toContain('Question Types');

    const anyHeading = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6')).map((node) =>
      node.textContent.trim(),
    );
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

  it('shows question configuration only when the text box has content', () => {
    act(() => {
      root.render(
        <AudioSurveyGenerator provider={{}} network={{}} account="0x123" loginComplete toggleLoginModal={jest.fn()} />,
      );
    });

    expect(Array.from(container.querySelectorAll('h3')).some((node) => node.textContent.trim() === 'Types')).toBe(false);
    expect(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_QUESTION_COUNT_VALUE}"]`)).toBeNull();

    setAudioInputValue('   ');

    expect(Array.from(container.querySelectorAll('h3')).some((node) => node.textContent.trim() === 'Types')).toBe(false);
    expect(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_QUESTION_COUNT_VALUE}"]`)).toBeNull();

    setAudioInputValue('Context that should reveal question configuration.');

    expect(Array.from(container.querySelectorAll('h3')).some((node) => node.textContent.trim() === 'Types')).toBe(true);
    expect(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_QUESTION_COUNT_VALUE}"]`)).toBeTruthy();

    setAudioInputValue('');

    expect(Array.from(container.querySelectorAll('h3')).some((node) => node.textContent.trim() === 'Types')).toBe(false);
    expect(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_QUESTION_COUNT_VALUE}"]`)).toBeNull();
  });

  it('shows a visual preview for every question type after text is entered', () => {
    act(() => {
      root.render(
        <AudioSurveyGenerator provider={{}} network={{}} account="0x123" loginComplete toggleLoginModal={jest.fn()} />,
      );
    });
    setAudioInputValue('Context that should reveal all question-type previews.');

    const typeCards = Array.from(container.querySelectorAll(`[class*="typeButton"]`));
    const cardFor = (title) => typeCards.find((card) => card.textContent.includes(title));

    expect(cardFor('Binary').textContent).toContain('Agree');
    expect(cardFor('Multichoice').textContent).toContain('Opt 1');
    expect(cardFor('Rating').textContent).toContain('1');
    expect(cardFor('Rating').textContent).toContain('10');
    expect(cardFor('Freeform').textContent).toContain('Write an answer...');
  });

  it('shows the question count readout with the default value', () => {
    act(() => {
      root.render(
        <AudioSurveyGenerator provider={{}} network={{}} account="0x123" loginComplete toggleLoginModal={jest.fn()} />,
      );
    });
    setAudioInputValue('Context that should reveal the default question count.');

    expect(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_QUESTION_COUNT_VALUE}"]`).textContent).toBe(
      '10',
    );
    expect(container.textContent).toContain('# Questions');
    expect(container.textContent).not.toContain('Number of Questions');
  });

  it('decrements the question count by five and clamps at five', () => {
    act(() => {
      root.render(
        <AudioSurveyGenerator provider={{}} network={{}} account="0x123" loginComplete toggleLoginModal={jest.fn()} />,
      );
    });
    setAudioInputValue('Context that should reveal the decrement controls.');

    const countValue = () => container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_QUESTION_COUNT_VALUE}"]`);
    const decrementButton = container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_QUESTION_COUNT_DECREMENT}"]`);

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
        <AudioSurveyGenerator provider={{}} network={{}} account="0x123" loginComplete toggleLoginModal={jest.fn()} />,
      );
    });
    setAudioInputValue('Context that should reveal the increment controls.');

    const countValue = () => container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_QUESTION_COUNT_VALUE}"]`);
    const incrementButton = container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_QUESTION_COUNT_INCREMENT}"]`);

    for (let index = 0; index < 8; index += 1) {
      toggleCheckbox(incrementButton);
    }

    expect(countValue().textContent).toBe('50');
    expect(incrementButton.disabled).toBe(true);

    toggleCheckbox(incrementButton);
    expect(countValue().textContent).toBe('50');
  });

  it('passes the adjusted question count through to the AI prompt on submit', async () => {
    mockCallAI.mockResolvedValue(
      JSON.stringify({
        surveyTitle: 'Adjusted Count Survey',
        questions: buildAiQuestions(15),
      }),
    );

    await renderSubject(
      <AudioSurveyGenerator provider={{}} network={{}} account="0x123" loginComplete toggleLoginModal={jest.fn()} />,
    );

    setAudioInputValue('This database tool content is comfortably longer than fifty characters for generation.');
    toggleCheckbox(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_QUESTION_COUNT_INCREMENT}"]`));

    const form = container.querySelector('form');
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mockCallAI).toHaveBeenCalledTimes(1);
    expect(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_QUESTION_COUNT_VALUE}"]`).textContent).toBe(
      '15',
    );
    expect(mockCallAI.mock.calls[0][0]).toMatch(/numberOfSeedStatementsOrPrompts:\s*15\b/);
  });

  it('uses webpage source type when only additional URL sources are provided', async () => {
    mockProcessAdditionalSources.mockResolvedValue(
      'This is extracted webpage content from additional sources only, and it is long enough to pass validation.',
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
      }),
    );

    await act(async () => {
      root.render(
        <AudioSurveyGenerator provider={{}} network={{}} account="0x123" loginComplete toggleLoginModal={jest.fn()} />,
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
});
