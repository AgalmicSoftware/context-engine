import {
  React,
  act,
  AudioSurveyGenerator,
  E2E_TESTIDS,
  container,
  getPhotoCards,
  getPhotoCardByName,
  toggleCheckbox,
  setAudioInputValue,
  addAdditionalUrl,
  addAdditionalFile,
  addAdditionalPhoto,
  renderSubject,
  makeSessionConfig,
  mockCallAI,
  mockProcessAdditionalSources,
  mockAnalyzePhotoForQuestionGeneration,
  mockGetSessionConfigBySlug,
  mockUploadDocLibraryFile,
  mockUploadDocLibraryUrlRecord,
  setupAudioSurveyGeneratorTestLifecycle,
} from './AudioSurveyGenerator.testUtils';

describe('AudioSurveyGenerator session context saves', () => {
  setupAudioSurveyGeneratorTestLifecycle();

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

    await addAdditionalUrl('https://example.com/slug-only');
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
});
