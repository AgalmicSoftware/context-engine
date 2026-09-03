import {
  React,
  act,
  AudioSurveyGenerator,
  E2E_TESTIDS,
  container,
  toggleCheckbox,
  setInputValue,
  addAdditionalUrl,
  renderSubject,
  makeSessionConfig,
  mockCallAI,
  mockProcessAdditionalSources,
  mockUploadDocLibraryUrlRecord,
  setupAudioSurveyGeneratorTestLifecycle,
} from './AudioSurveyGenerator.testUtils';

describe('AudioSurveyGenerator session context audience and failures', () => {
  setupAudioSurveyGeneratorTestLifecycle();

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
      />,
    );

    await addAdditionalUrl('https://example.com/source');
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
      />,
    );

    await addAdditionalUrl('https://example.com/private');
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
    expect(container.textContent).toContain('Edge Session has no shared document audience');
    expect(container.textContent).toContain('Saves stay private to your wallet');
  });

  it('shows the real session name and fixed session audience for Worker-native document storage', async () => {
    await renderSubject(
      <AudioSurveyGenerator
        provider={{ request: jest.fn() }}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
        activeSessionSlug="demo-sh"
        sessionConfig={{
          slug: 'demo-sh',
          sessionName: 'Demo Session',
          corsWorkerUrl: 'https://worker.example',
          sessionModeProfile: {
            authority: { mode: 'worker_canonical' },
            storage: {
              backend: 'cloudflare',
              payloadAccessControl: { gate: 'none', encryption: 'none' },
            },
          },
        }}
      />,
    );

    await addAdditionalUrl('https://example.com/worker-context');

    const audience = container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_AUDIENCE_BUTTON}"]`);
    expect(audience.getAttribute('data-ce-doc-save-audience')).toBe('session');
    expect(audience.getAttribute('aria-label')).toContain('Demo Session');
    expect(audience.textContent).toContain('Demo Session');
    expect(container.textContent).not.toContain('docUploads gate unavailable');
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
      />,
    );

    await addAdditionalUrl('https://example.com/delayed-gate');
    toggleCheckbox(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_TOGGLE}"]`));

    expect(
      container
        .querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_AUDIENCE_BUTTON}"]`)
        .getAttribute('aria-label'),
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
      />,
    );

    expect(
      container
        .querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_AUDIENCE_BUTTON}"]`)
        .getAttribute('aria-label'),
    ).toContain('Edge Session');
  });

  it('saves queued extra sources into the session doc library before generating questions', async () => {
    const onQuestionsGenerated = jest.fn();
    mockProcessAdditionalSources.mockResolvedValue(
      'This additional source content is long enough to drive question generation on its own.',
    );
    mockCallAI.mockResolvedValue(
      JSON.stringify({
        surveyTitle: 'Saved Sources Survey',
        questions: [
          {
            prompt: 'Should saved sources use doc-library refs?',
            questionType: 'binary',
            tags: ['docs'],
          },
        ],
      }),
    );

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
      />,
    );

    await addAdditionalUrl('https://example.com/to-save');
    toggleCheckbox(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_TOGGLE}"]`));

    const form = container.querySelector('form');
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mockUploadDocLibraryUrlRecord).toHaveBeenCalledTimes(1);
    expect(mockCallAI).toHaveBeenCalledTimes(1);
    expect(mockUploadDocLibraryUrlRecord.mock.invocationCallOrder[0]).toBeLessThan(
      mockCallAI.mock.invocationCallOrder[0],
    );
    expect(onQuestionsGenerated).toHaveBeenCalledTimes(1);
    expect(onQuestionsGenerated.mock.calls[0][1]).toEqual([expect.stringContaining('/session/0xSessionToken/docs?')]);
    expect(onQuestionsGenerated.mock.calls[0][1][0].startsWith('/session/0xSessionToken/docs?')).toBe(true);
    expect(onQuestionsGenerated.mock.calls[0][1][0]).toContain(`__ceDocTx=${'A'.repeat(43)}`);
    expect(onQuestionsGenerated.mock.calls[0][1][0]).not.toBe('https://example.com/to-save');
  });

  it('saves a typed URL source into session context during generation without requiring the add-url click', async () => {
    const onQuestionsGenerated = jest.fn();
    mockProcessAdditionalSources.mockResolvedValue(
      'This typed URL source content is long enough to drive question generation on its own.',
    );
    mockCallAI.mockResolvedValue(
      JSON.stringify({
        surveyTitle: 'Typed URL Saved Sources Survey',
        questions: [
          {
            prompt: 'Should typed URLs be saved as context before generation?',
            questionType: 'binary',
            tags: ['docs'],
          },
        ],
      }),
    );

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
      />,
    );

    setInputValue('input[placeholder="Add URL"]', 'https://example.com/typed-to-save');
    toggleCheckbox(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_TOGGLE}"]`));

    const form = container.querySelector('form');
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mockUploadDocLibraryUrlRecord).toHaveBeenCalledTimes(1);
    expect(mockUploadDocLibraryUrlRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com/typed-to-save',
      }),
    );
    expect(mockCallAI).toHaveBeenCalledTimes(1);
    expect(onQuestionsGenerated).toHaveBeenCalledTimes(1);
    expect(onQuestionsGenerated.mock.calls[0][1]).toEqual([expect.stringContaining('/session/0xSessionToken/docs?')]);
    expect(onQuestionsGenerated.mock.calls[0][1][0]).toContain(`__ceDocTx=${'A'.repeat(43)}`);
    expect(onQuestionsGenerated.mock.calls[0][1][0]).not.toBe('https://example.com/typed-to-save');
    expect(container.querySelector('input[placeholder="Add URL"]').value).toBe('');
  });

  it('uses scoped Lit hooks for OP Sepolia session-context saves when Chipotle credentials stay server-side', async () => {
    delete window.__litHooks;
    const scopedSaveKey = jest.fn(async () => ({ ciphertext: 'ciphertext', dataToEncryptHash: 'hash' }));
    const onQuestionsGenerated = jest.fn();
    mockProcessAdditionalSources.mockResolvedValue(
      'This additional source content is long enough to drive question generation on its own.',
    );
    mockCallAI.mockResolvedValue(
      JSON.stringify({
        surveyTitle: 'Worker Runtime Survey',
        questions: [
          {
            prompt: 'Can server-side Lit runtime save session-gated context?',
            questionType: 'binary',
            tags: ['docs'],
          },
        ],
      }),
    );

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
      />,
    );

    await addAdditionalUrl('https://example.com/to-save-with-worker-runtime');
    toggleCheckbox(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_TOGGLE}"]`));

    expect(
      container
        .querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_AUDIENCE_BUTTON}"]`)
        .getAttribute('aria-label'),
    ).toContain('Edge Session');

    const form = container.querySelector('form');
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mockUploadDocLibraryUrlRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        encryption: expect.objectContaining({
          enabled: true,
          saveKey: scopedSaveKey,
          chainId: 11155420,
        }),
      }),
    );
    expect(onQuestionsGenerated).toHaveBeenCalledTimes(1);
  });

  it('keeps raw extra-source URLs when doc-library saving is not enabled', async () => {
    const onQuestionsGenerated = jest.fn();
    mockProcessAdditionalSources.mockResolvedValue(
      'This additional source content is long enough to drive question generation on its own.',
    );
    mockCallAI.mockResolvedValue(
      JSON.stringify({
        surveyTitle: 'Raw URL Survey',
        questions: [
          {
            prompt: 'Should unsaved sources stay raw?',
            questionType: 'binary',
            tags: ['docs'],
          },
        ],
      }),
    );

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
      />,
    );

    await addAdditionalUrl('https://example.com/raw-source');

    const form = container.querySelector('form');
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mockUploadDocLibraryUrlRecord).not.toHaveBeenCalled();
    expect(onQuestionsGenerated).toHaveBeenCalledWith(
      expect.any(Array),
      ['https://example.com/raw-source'],
      'Raw URL Survey',
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
      />,
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
      'This additional source content is long enough to drive question generation on its own.',
    );
    mockCallAI.mockResolvedValue(
      JSON.stringify({
        surveyTitle: 'Should not render',
        questions: [],
      }),
    );

    await renderSubject(
      <AudioSurveyGenerator
        provider={{ request: jest.fn() }}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
        activeSessionSlug="edge"
        sessionConfig={makeSessionConfig()}
      />,
    );

    await addAdditionalUrl('https://example.com/fails');
    toggleCheckbox(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_SAVE_DOCS_TOGGLE}"]`));

    const form = container.querySelector('form');
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mockCallAI).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Save failed.');
    expect(container.querySelector('[data-testid="create-questions-and-surveys"]')).toBeNull();
  });
});
