import {
  React,
  act,
  AudioSurveyGenerator,
  E2E_TESTIDS,
  container,
  root,
  toggleCheckbox,
  renderSubject,
  makeSessionConfig,
  mockDocumentLibraryPanel,
  mockCorpusViewer,
  getMockCorpusViewerModuleLoadCount,
  setupAudioSurveyGeneratorTestLifecycle,
} from './AudioSurveyGenerator.testUtils';

describe('AudioSurveyGenerator explorer view and session selector', () => {
  setupAudioSurveyGeneratorTestLifecycle();

  it('defers loading the demo corpus module until explorer view renders it', async () => {
    expect(getMockCorpusViewerModuleLoadCount()).toBe(0);

    await renderSubject(
      <AudioSurveyGenerator
        provider={{}}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
      />,
    );

    expect(getMockCorpusViewerModuleLoadCount()).toBe(0);
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
      />,
    );

    expect(getMockCorpusViewerModuleLoadCount()).toBe(1);
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
      />,
    );

    const demoToggle = container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_VIEW_DEMO_TOGGLE}"]`);
    toggleCheckbox(demoToggle);

    expect(container.textContent).not.toContain('Open full page');
    expect(Array.from(container.querySelectorAll('a')).some((node) => node.textContent === 'Open full page')).toBe(
      false,
    );
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
      />,
    );

    const demoToggle = container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_VIEW_DEMO_TOGGLE}"]`);

    expect(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_VIEW_PANEL}"]`)).toBeTruthy();
    expect(demoToggle.checked).toBe(true);
    expect(container.querySelector('[data-testid="mock-corpus-viewer"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="mock-document-library-panel"]')).toBeNull();

    toggleCheckbox(demoToggle);

    expect(container.querySelector('[data-testid="mock-corpus-viewer"]')).toBeNull();
    expect(container.querySelector('[data-testid="mock-document-library-panel"]')).toBeTruthy();
    expect(mockDocumentLibraryPanel).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sessionSlug: 'edge',
        mode: 'session',
        compact: false,
        pageSize: 10,
        showUploadControls: false,
      }),
    );
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
      />,
    );

    expect(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_VIEW_DEMO_TOGGLE}"]`)).toBeNull();
    expect(container.querySelector('[data-testid="mock-corpus-viewer"]')).toBeNull();
    expect(container.querySelector('[data-testid="mock-document-library-panel"]')).toBeTruthy();
    expect(mockDocumentLibraryPanel).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sessionSlug: 'edge',
        mode: 'session',
        compact: false,
        pageSize: 10,
        showUploadControls: false,
      }),
    );
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
      />,
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
        />,
      );
    });

    expect(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_VIEW_PANEL}"]`)).toBeNull();
    expect(container.querySelector(`[data-testid="${E2E_TESTIDS.DATABASE_VIEW_DEMO_TOGGLE}"]`)).toBeNull();
    expect(container.querySelector('[data-testid="mock-corpus-viewer"]')).toBeNull();
    expect(container.querySelector('[data-testid="mock-document-library-panel"]')).toBeNull();
  });

  it('keeps the standalone AudioSurveyGenerator session selector behind a gear toggle and can locally override/reset', () => {
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
        />,
      );
    });

    expect(container.querySelector('[data-testid="ce-database-session-selector"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="ce-database-session-selector-toggle"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="ce-database-session-selector-panel"]')).toBeNull();

    act(() => {
      container
        .querySelector('[data-testid="ce-database-session-selector-toggle"]')
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="ce-database-session-selector-panel"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="ce-database-session-chip-edge"]')).toHaveAttribute(
      'data-session-selected',
      'true',
    );

    act(() => {
      container
        .querySelector('[data-testid="ce-database-session-chip-rxc"]')
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="ce-database-session-chip-rxc"]')).toHaveAttribute(
      'data-session-selected',
      'true',
    );
    expect(container.textContent).toContain('Using a local AudioSurveyGenerator override.');

    act(() => {
      const resetButton = Array.from(container.querySelectorAll('button')).find((node) =>
        node.textContent.includes('Use global default'),
      );
      resetButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="ce-database-session-chip-edge"]')).toHaveAttribute(
      'data-session-selected',
      'true',
    );
    expect(container.textContent).toContain('Using the global primary session by default.');
  });

  it('suppresses the internal selector when a parent controls the session override and uses that session in view mode', async () => {
    await renderSubject(
      <AudioSurveyGenerator
        provider={{}}
        network={{ id: 84532 }}
        account="0x123"
        loginComplete
        toggleLoginModal={jest.fn()}
        activeSessionSlug="edge"
        sessionConfig={makeSessionConfig({
          slug: 'edge',
          sessionName: 'Edge Session',
          sessionIdHex: `0x${'2'.repeat(32)}`,
        })}
        explorerMode="view"
        demoSurfaceMode={false}
        sessionOverrideSlug="rxc"
        sessionOverrideTouched={true}
        hideInternalSessionSelector
      />,
    );

    expect(container.querySelector('[data-testid="ce-database-session-selector"]')).toBeNull();
    expect(container.querySelector('[data-testid="mock-document-library-panel"]')).toBeTruthy();
    expect(mockDocumentLibraryPanel).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sessionSlug: 'rxc',
        mode: 'session',
        sessionIdHex: `0x${'3'.repeat(32)}`,
        showUploadControls: false,
      }),
    );
  });
});
