import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { E2E_TESTIDS } from '../../../utilities/e2eTestIds.js';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../../utilities/session/sessionModeProfile';
import { GROUP_CONVERSATION_MODE_QUERY_VALUE } from '../../SurveyTool/sessionVoiceModeQuery';
import SessionSettingsPage, { isSessionAdmin } from './SessionSettingsPage';
import { buildGroupRecorderLink } from '../sessionWizardUrlSupport';

const mockFetchBootstrap = jest.fn();
const mockUpsertBootstrap = jest.fn();
const mockSignAdminAction = jest.fn(async (_options: unknown) => ({ signature: '0xsigned' }));
const mockUploadMetadata = jest.fn();
const mockUpdateMetadataOnChain = jest.fn();
const mockUpsertRegistryCache = jest.fn();
const mockReadWallet = jest.fn();

const mockPublishQuestions = jest.fn();
jest.mock('../../../domains/surveys/workerCanonicalAuthoringPort', () => ({
  workerCanonicalAuthoringPort: { publishQuestions: (...args: unknown[]) => mockPublishQuestions(...args) },
}));
jest.mock('../../../utilities/session/sessionWorkerDiscovery', () => ({
  ...(jest.requireActual('../../../utilities/session/sessionWorkerDiscovery') as object),
  fetchWorkerCanonicalSessionBootstrap: (...args: unknown[]) => mockFetchBootstrap(...args),
}));
jest.mock('../../../utilities/session/sessionWorkerConfigCache', () => ({
  ...(jest.requireActual('../../../utilities/session/sessionWorkerConfigCache') as object),
  upsertWorkerCanonicalSessionBootstrap: (...args: unknown[]) => mockUpsertBootstrap(...args),
}));
jest.mock('../../../utilities/worker/workerAuth', () => ({
  ...(jest.requireActual('../../../utilities/worker/workerAuth') as object),
  buildSignedAdminActionAuth: (options: unknown) => mockSignAdminAction(options),
}));

jest.mock('../../../domains/sessions/registry/sessionRegistryAdminPorts', () => ({
  adminSessionRegistryPorts: {
    reads: { upsertSessionRegistryCache: (input: unknown) => mockUpsertRegistryCache(input) },
    writes: {
      uploadSessionMetadata: (metadata: unknown, options: unknown) => mockUploadMetadata(metadata, options),
      updateSessionMetadataOnChain: (input: unknown) => mockUpdateMetadataOnChain(input),
    },
  },
}));

jest.mock('./sessionSettingsWallet', () => ({
  readSigningWallet: (provider: unknown) => mockReadWallet(provider),
}));

// The live files and links panel reports what the Worker lists.
jest.mock('../setup/ContextSourcesPanel', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  const MockPanel = ({ onSourcesChange }: { onSourcesChange?: (sources: unknown[]) => void }) => {
    useEffect(() => {
      onSourcesChange?.([
        { id: 'pdf-1', kind: 'file', title: 'deck.pdf', adminsOnly: true },
        { id: 'link-1', kind: 'link', title: 'Essay', url: 'https://example.org/essay', adminsOnly: false },
      ]);
    }, [onSourcesChange]);
    return <div data-testid="mock-context-sources-panel" />;
  };
  return { __esModule: true, default: MockPanel };
});

const ADMIN = '0x00000000000000000000000000000000000000aa';
const OTHER_ACCOUNT = '0x00000000000000000000000000000000000000cc';
const WORKER = 'https://edit-salon.example.workers.dev';
const SESSION_ID = `0x${'1f'.repeat(16)}`;

const workerConfig = (overrides: Record<string, unknown> = {}) => ({
  slug: 'edit-salon',
  sessionId: SESSION_ID,
  adminAddress: ADMIN,
  corsWorkerUrl: WORKER,
  configRevision: 'rev-1',
  authzEpoch: 3,
  sessionName: 'Edit salon',
  sessionInfo: 'Before.',
  groupCreationPolicy: 'participants',
  interviewModeEnabled: true,
  interviewMode: { openingMode: 'auto', enabled: true, provider: 'openai', realtimeModel: 'gpt-live-1' },
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
  ...overrides,
});

const bootstrapOf = (config: Record<string, unknown>) => ({
  config,
  configRevision: config.configRevision,
  sessionId: SESSION_ID,
  sessionSlug: 'edit-salon',
  workerOrigin: WORKER,
});

const renderPage = (props: Partial<React.ComponentProps<typeof SessionSettingsPage>> = {}) =>
  render(
    <SessionSettingsPage
      account={ADMIN}
      loginComplete
      toggleLoginModal={jest.fn()}
      sessionSlug="edit-salon"
      sessionConfig={workerConfig()}
      workerOrigin={WORKER}
      {...props}
    />,
  );

describe('SessionSettingsPage', () => {
  const originalFetch = global.fetch;
  let posted: Array<Record<string, unknown>> = [];

  beforeEach(() => {
    jest.clearAllMocks();
    posted = [];
    mockFetchBootstrap.mockResolvedValue(bootstrapOf(workerConfig()));
    global.fetch = jest.fn(async (url: unknown, init: RequestInit = {}) => {
      posted.push({ url: String(url), body: JSON.parse(String(init.body || '{}')) });
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    }) as unknown as typeof fetch;
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('exports a template listing the session’s files by name and privacy, without their contents', async () => {
    mockFetchBootstrap.mockResolvedValue(
      bootstrapOf(
        workerConfig({
          sessionContext: {
            title: 'Context',
            paragraphs: ['Notes.'],
            links: [{ label: 'Site', url: 'https://example.org/' }],
          },
        }),
      ),
    );
    const createObjectURL = jest.fn((_blob: Blob) => 'blob:template');
    Object.assign(URL, { createObjectURL, revokeObjectURL: jest.fn() });
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderPage();
    await waitFor(() => expect(mockUpsertBootstrap).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('ce-setup-more-context'));
    expect(screen.getByTestId('mock-context-sources-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SETUP_TEMPLATE_EXPORT));
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(createObjectURL.mock.calls[0][0]);
    });
    const template = JSON.parse(text);
    expect(template.contextFiles).toEqual([{ name: 'deck.pdf', adminsOnly: true }]);
    expect(template.sessionContext).toEqual({
      title: 'Context',
      paragraphs: ['Notes.'],
      links: [{ label: 'Site', url: 'https://example.org/' }],
      html: '',
    });
    click.mockRestore();
  });

  it('is admin-only', async () => {
    const toggleLoginModal = jest.fn();
    renderPage({ account: '', loginComplete: false, toggleLoginModal });
    const adminOnly = await screen.findByTestId('ce-settings-admin-only');
    expect(adminOnly).toHaveTextContent('Sign in as a session admin to change its settings.');
    // The button starts the sentence, so it can't read as a separate word below it.
    const signIn = within(adminOnly).getByRole('button', { name: 'Sign in' });
    expect(signIn).toHaveClass('primaryButton');
    fireEvent.click(signIn);
    expect(toggleLoginModal).toHaveBeenCalledWith(true);
    cleanup();
    renderPage({ account: OTHER_ACCOUNT });
    // A passkey makes its own address, so the page says which account it is looking at.
    expect(await screen.findByTestId('ce-settings-admin-only')).toHaveTextContent(
      `Only this session’s admins can change its settings. You’re signed in as ${OTHER_ACCOUNT}.`,
    );
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
    expect(isSessionAdmin(workerConfig({ adminAddresses: ['0xBB'] }), '0xbb')).toBe(true);
    expect(isSessionAdmin(workerConfig(), '0x00000000000000000000000000000000000000cc')).toBe(false);
  });

  it('shows slug, session ID, Worker URL and hosting as fixed facts, not inputs', async () => {
    renderPage();
    await waitFor(() => expect(mockFetchBootstrap).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('ce-setup-more-hosting'));
    const locked = screen.getByTestId('ce-settings-locked');
    expect(locked).toHaveTextContent('edit-salon');
    expect(locked).toHaveTextContent(SESSION_ID);
    expect(locked).toHaveTextContent(WORKER);
    expect(within(locked).queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ce-setup-authority')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ce-setup-storage')).not.toBeInTheDocument();
  });

  it('gives every element a unique id with all sections open', async () => {
    renderPage();
    await waitFor(() => expect(mockUpsertBootstrap).toHaveBeenCalled());
    document.querySelectorAll('[data-testid^="ce-setup-more-"]').forEach((caret) => {
      if (caret.getAttribute('aria-expanded') === 'false') fireEvent.click(caret);
    });
    const ids = Array.from(document.querySelectorAll('[id]'), (element) => element.id);
    expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
  });

  it('lists which edits sign participants out, then saves only the changed fields', async () => {
    renderPage();
    await waitFor(() => expect(mockUpsertBootstrap).toHaveBeenCalled());
    const save = screen.getByTestId(E2E_TESTIDS.SESSION_SETTINGS_SAVE);
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), { target: { value: 'Reverse Alignment' } });
    expect(screen.getByTestId('ce-settings-content-changes')).toHaveTextContent('Name');
    expect(screen.queryByTestId('ce-settings-authority-changes')).not.toBeInTheDocument();
    expect(save).toHaveTextContent(/^Save$/);

    fireEvent.click(screen.getByTestId('ce-setup-more-participation'));
    fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_GROUP_CREATION_POLICY), { target: { value: 'admin_only' } });
    expect(screen.getByTestId('ce-settings-authority-changes')).toHaveTextContent('Who can create groups');
    expect(save).toHaveTextContent('Save and sign participants out');

    mockFetchBootstrap.mockResolvedValue(
      bootstrapOf(workerConfig({ sessionName: 'Reverse Alignment', groupCreationPolicy: 'admin_only', authzEpoch: 4 })),
    );
    await act(async () => {
      fireEvent.click(save);
    });
    await waitFor(() => expect(screen.getByTestId('ce-settings-status')).toHaveTextContent('Settings saved.'));
    const write = posted.find((entry) => String(entry.url).endsWith('/admin/set-config'));
    expect(write?.body).toEqual({
      sessionSlug: 'edit-salon',
      config: { sessionName: 'Reverse Alignment', groupCreationPolicy: 'admin_only' },
      signature: '0xsigned',
    });
    expect(mockSignAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'set-config',
        sessionId: SESSION_ID,
        sessionAuthorityMode: 'worker_canonical',
      }),
    );
    expect(save).toBeDisabled();
  });

  it('imports a template but keeps the session’s fixed hosting, and queues its questions', async () => {
    renderPage();
    await waitFor(() => expect(mockUpsertBootstrap).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('ce-template-import'));
    fireEvent.change(screen.getByTestId('ce-template-paste'), {
      target: {
        value: JSON.stringify({
          format: 'ce.session-template/v1',
          sessionName: 'From a template',
          questions: [{ prompt: 'Adapting institutions deserves investment.', type: 'binary' }],
          sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED),
        }),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    fireEvent.click(screen.getByTestId('ce-template-import-apply'));

    expect(screen.getByTestId('ce-settings-status')).toHaveTextContent('the session keeps its own');
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME)).toHaveValue('From a template');
    expect(screen.getByTestId('ce-setup-summary-questions')).toHaveTextContent('1 question');
    expect(screen.getByTestId('ce-setup-questions-publish')).toHaveTextContent('Add 1 question to the session');
    expect(screen.getByTestId('ce-settings-content-changes')).toHaveTextContent('Name');
  });

  it('keeps a question edited while the questions upload', async () => {
    renderPage();
    await waitFor(() => expect(mockUpsertBootstrap).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('ce-template-import'));
    fireEvent.change(screen.getByTestId('ce-template-paste'), {
      target: {
        value: JSON.stringify({
          format: 'ce.session-template/v1',
          questions: [
            { prompt: 'Adapting institutions deserves investment.', type: 'binary' },
            { prompt: 'Cities should plant more trees.', type: 'binary' },
          ],
        }),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    fireEvent.click(screen.getByTestId('ce-template-import-apply'));
    fireEvent.click(screen.getByTestId(`${E2E_TESTIDS.SETUP_MORE_PREFIX}questions`));

    let finishUpload: (value: unknown) => void = () => {};
    mockPublishQuestions.mockReturnValue(
      new Promise((resolve) => {
        finishUpload = resolve;
      }),
    );
    fireEvent.click(screen.getByTestId('ce-setup-questions-publish'));
    await screen.findByText('Adding…');
    fireEvent.change(screen.getByLabelText('Question 2'), { target: { value: 'Cities should plant shade trees.' } });
    await act(async () => {
      finishUpload({ uploadedQuestions: [{}, {}] });
    });

    expect(await screen.findByText('Added 2 questions.')).toBeInTheDocument();
    expect(screen.getByLabelText('Question 1')).toHaveValue('Cities should plant shade trees.');
    expect(screen.queryByLabelText('Question 2')).not.toBeInTheDocument();
    expect(screen.getByTestId('ce-setup-questions-publish')).toHaveTextContent('Add 1 question to the session');
  });

  it('copies the group recorder link', async () => {
    const writeText = jest.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderPage();
    fireEvent.click(await screen.findByTestId('ce-settings-group-recorder-link'));
    expect(screen.getByRole('link', { name: 'Open the session' })).toHaveAttribute(
      'data-ce-control-appearance',
      'raised',
    );
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const link = new URL(String((writeText.mock.calls[0] as unknown[])[0]));
    expect(link.pathname).toBe('/session/edit-salon');
    expect(link.searchParams.get('mode')).toBe(GROUP_CONVERSATION_MODE_QUERY_VALUE);
    expect(link.searchParams.get('worker')).toBe(WORKER);
    expect(buildGroupRecorderLink('https://contextengine.sh/session/edit-salon')).toBe(
      `https://contextengine.sh/session/edit-salon?mode=${GROUP_CONVERSATION_MODE_QUERY_VALUE}`,
    );
  });

  it('edits AI only when the Worker says it merges ai, keeping a saved model that is not offered', async () => {
    const ai = {
      models: {
        fast: { provider: 'openai', model: 'gpt-legacy-fast' },
        thinking: { provider: 'openai', model: 'gpt-5' },
      },
      reasoningEffort: 'low',
      taskReasoningEffort: { generate: 'medium' },
    };
    renderPage({ sessionConfig: workerConfig({ ai }) });
    await waitFor(() => expect(mockUpsertBootstrap).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('ce-setup-more-ai'));
    expect(screen.getByTestId('ce-settings-ai-locked')).toHaveTextContent('this Session Worker is older');
    expect(screen.queryByTestId('ce-setup-ai-fast')).not.toBeInTheDocument();
    cleanup();

    mockFetchBootstrap.mockResolvedValue(bootstrapOf(workerConfig({ ai, setConfigMergesAi: true })));
    renderPage();
    await waitFor(() => expect(mockUpsertBootstrap).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('ce-setup-more-ai'));
    expect(screen.getByTestId('ce-setup-ai-fast')).toHaveValue('gpt-legacy-fast');
    expect(screen.getByTestId('ce-settings-ai-task-generate')).toHaveValue('medium');
    fireEvent.change(screen.getByTestId('ce-setup-ai-effort'), { target: { value: 'high' } });
    fireEvent.change(screen.getByTestId('ce-settings-ai-task-new'), { target: { value: 'interview-map' } });
    fireEvent.click(screen.getByTestId('ce-settings-ai-task-add'));
    expect(screen.getByTestId('ce-settings-authority-changes')).toHaveTextContent('AI models and effort');

    await act(async () => {
      fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_SETTINGS_SAVE));
    });
    const write = posted.find((entry) => String(entry.url).endsWith('/admin/set-config'));
    expect((write?.body as Record<string, unknown>).config).toEqual({
      ai: { reasoningEffort: 'high', taskReasoningEffort: { generate: 'medium', 'interview-map': 'high' } },
    });
  });

  it('shows the ID lists read-only, with the reason, on an older Worker', async () => {
    renderPage();
    await waitFor(() => expect(mockUpsertBootstrap).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('ce-setup-more-questions'));
    expect(screen.getByTestId('ce-settings-lists-locked')).toHaveTextContent('this Session Worker is older');
    expect(screen.getByTestId('ce-settings-list-BLOCKED_QUESTION_IDS')).toHaveAttribute('readonly');
    expect(screen.getByTestId('ce-settings-default-filters')).not.toHaveAttribute('readonly');
  });

  it('edits the question list settings in the Questions section and saves them without a sign-out', async () => {
    mockFetchBootstrap.mockResolvedValue(bootstrapOf(workerConfig({ setConfigMergesAi: true })));
    renderPage();
    await waitFor(() => expect(mockUpsertBootstrap).toHaveBeenCalled());
    expect(screen.queryByTestId('ce-settings-lists-locked')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ce-settings-list-BLOCKED_QUESTION_IDS')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ce-setup-more-questions'));
    fireEvent.change(screen.getByTestId('ce-settings-list-BLOCKED_QUESTION_IDS'), { target: { value: 'q-1\nq-2' } });
    fireEvent.change(screen.getByTestId('ce-settings-default-filters'), { target: { value: 'tag=housing' } });
    expect(screen.getByTestId('ce-settings-content-changes')).toHaveTextContent('Hidden questions');
    expect(screen.getByTestId('ce-settings-authority-changes')).toHaveTextContent('Default filters');

    fireEvent.change(screen.getByTestId('ce-settings-default-filters'), { target: { value: '{"selectedTags":' } });
    expect(screen.getByText(/Default filters must be a JSON object/)).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_SETTINGS_SAVE)).toBeDisabled();
  });

  it('offers the results admin list only on a Worker that builds atlases', async () => {
    renderPage();
    await waitFor(() => expect(mockUpsertBootstrap).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('ce-setup-more-results'));
    expect(screen.queryByTestId('ce-setting-results-admins')).not.toBeInTheDocument();
  });

  it('adds and removes results admins and saves them without a sign-out', async () => {
    const existing = `0x${'cd'.repeat(20)}`;
    const added = `0x${'AB'.repeat(20)}`;
    mockFetchBootstrap.mockResolvedValue(
      bootstrapOf(
        workerConfig({ debateAtlas: true, resultsAdminAddresses: [existing.toUpperCase().replace('0X', '0x')] }),
      ),
    );
    renderPage();
    await waitFor(() => expect(mockUpsertBootstrap).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('ce-setup-more-results'));
    const list = screen.getByTestId('ce-setting-results-admins-list');
    expect(within(list).getByText(existing)).toBeInTheDocument();
    // A stored list in other letter case is not an edit.
    expect(screen.queryByTestId('ce-settings-content-changes')).not.toBeInTheDocument();

    const input = screen.getByTestId('ce-setting-results-admins');
    fireEvent.change(input, { target: { value: '0x1234' } });
    fireEvent.click(screen.getByTestId('ce-setting-results-admins-add'));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter an address');
    fireEvent.change(input, { target: { value: existing } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('alert')).toHaveTextContent('already a results admin');

    fireEvent.change(input, { target: { value: ` ${added} ` } });
    fireEvent.click(screen.getByTestId('ce-setting-results-admins-add'));
    expect(input).toHaveValue('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: `Remove ${existing}` }));
    expect(screen.getByTestId('ce-settings-content-changes')).toHaveTextContent('Results admins');
    expect(screen.queryByTestId('ce-settings-authority-changes')).not.toBeInTheDocument();
    const save = screen.getByTestId(E2E_TESTIDS.SESSION_SETTINGS_SAVE);
    expect(save).toHaveTextContent(/^Save$/);

    await act(async () => {
      fireEvent.click(save);
    });
    await waitFor(() => expect(screen.getByTestId('ce-settings-status')).toHaveTextContent('Settings saved.'));
    const write = posted.find((entry) => String(entry.url).endsWith('/admin/set-config'));
    expect(write?.body).toEqual({
      sessionSlug: 'edit-salon',
      config: { resultsAdminAddresses: [added.toLowerCase()] },
      signature: '0xsigned',
    });
  });

  it('keeps typed edits when the Worker’s copy arrives after them', async () => {
    let resolveBootstrap: (value: unknown) => void = () => {};
    mockFetchBootstrap.mockReturnValue(new Promise((resolve) => (resolveBootstrap = resolve)));
    renderPage();
    fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), { target: { value: 'Typed first' } });
    await act(async () => {
      resolveBootstrap(bootstrapOf(workerConfig({ sessionInfo: 'Saved elsewhere.' })));
    });
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME)).toHaveValue('Typed first');
    expect(screen.getByTestId('ce-settings-content-changes')).toHaveTextContent('Name');
    expect(screen.getByTestId('ce-settings-content-changes')).not.toHaveTextContent('Description');
  });

  it('drops a Worker copy that arrives after the page moved to another session', async () => {
    const otherWorker = 'https://other-salon.example.workers.dev';
    const other = workerConfig({ slug: 'other-salon', sessionName: 'Other salon', corsWorkerUrl: otherWorker });
    let resolveEarlier: (value: unknown) => void = () => {};
    mockFetchBootstrap
      .mockReturnValueOnce(new Promise((resolve) => (resolveEarlier = resolve)))
      .mockResolvedValueOnce({ ...bootstrapOf(other), sessionSlug: 'other-salon', workerOrigin: otherWorker });
    const view = renderPage();
    view.rerender(
      <SessionSettingsPage
        account={ADMIN}
        loginComplete
        toggleLoginModal={jest.fn()}
        sessionSlug="other-salon"
        sessionConfig={other}
        workerOrigin={otherWorker}
      />,
    );
    await waitFor(() => expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME)).toHaveValue('Other salon'));

    await act(async () => {
      resolveEarlier(bootstrapOf(workerConfig({ sessionName: 'Edit salon, late' })));
    });
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME)).toHaveValue('Other salon');
    expect(mockUpsertBootstrap).toHaveBeenCalledTimes(1);
    expect(mockUpsertBootstrap).toHaveBeenCalledWith(expect.objectContaining({ slug: 'other-salon' }));
  });

  describe('an on-chain session', () => {
    const registryConfig = (registry: Record<string, unknown> = {}) => {
      const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
      return {
        slug: 'edit-salon',
        sessionId: '1f1f1f1f-1f1f-1f1f-1f1f-1f1f1f1f1f1f',
        networkChainId: 11155420,
        sessionName: 'Chain salon',
        corsWorkerUrl: WORKER,
        sessionModeProfile: profile,
        blockLimits: { start: 100, end: null },
        contracts: { surveys: { address: `0x${'f1'.repeat(20)}`, chainId: 11155420 } },
        ai: { models: { fast: { provider: 'openai', model: 'gpt-5' } }, reasoningEffort: 'low' },
        __registry: {
          registryChainId: 11155420,
          chainId: 11155420,
          metadataURI: 'ar://old-metadata',
          encryptedMetadataURI: '',
          adminAddress: ADMIN,
          sessionIdHex: SESSION_ID,
          metadataLoadState: 'loaded',
          metadataDefaultedContractKeys: [],
          ...registry,
        },
      };
    };

    beforeEach(() => {
      mockUploadMetadata.mockResolvedValue({ metadataUri: 'ar://new-metadata' });
      mockUpdateMetadataOnChain.mockResolvedValue({ ok: true, txHash: '0xmetadatahash' });
      mockReadWallet.mockResolvedValue({ address: ADMIN, chainId: 11155420 });
    });

    it('uses the same sections, adds the chain fields, and saves through the registry step by step', async () => {
      renderPage({ sessionConfig: registryConfig(), workerOrigin: '' });
      expect(mockFetchBootstrap).not.toHaveBeenCalled();
      fireEvent.click(screen.getByTestId('ce-setup-more-hosting'));
      expect(screen.getByTestId('ce-settings-registry-chain')).toHaveTextContent('11155420');
      expect(screen.getByTestId('ce-settings-block-start')).toHaveValue('100');
      fireEvent.click(screen.getByTestId('ce-setup-more-ai'));
      expect(screen.getByTestId('ce-setup-ai-fast')).toHaveValue('gpt-5');
      expect(screen.getByTestId('ce-settings-chain-needs')).toHaveTextContent('11155420');

      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), { target: { value: 'Renamed' } });
      fireEvent.change(screen.getByTestId('ce-settings-faucet-amount'), { target: { value: '0.0005' } });
      await act(async () => {
        fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_SETTINGS_SAVE));
      });

      await waitFor(() => expect(screen.getByTestId('ce-settings-status')).toHaveTextContent('Saved on chain.'));
      expect(mockUploadMetadata.mock.calls[0][0]).toMatchObject({
        sessionName: 'Renamed',
        faucet: { amountEth: '0.0005' },
      });
      expect(mockUpdateMetadataOnChain).toHaveBeenCalledWith(
        expect.objectContaining({ chainId: 11155420, slug: 'edit-salon', metadataURI: 'ar://new-metadata' }),
      );
      expect(mockUpsertRegistryCache).toHaveBeenCalled();
      const steps = within(screen.getByTestId('ce-settings-chain-steps')).getAllByRole('listitem');
      expect(steps.map((step) => step.getAttribute('data-state'))).toEqual(['done', 'done', 'done', 'done', 'done']);
      expect(screen.getByTestId('ce-settings-chain-tx')).toHaveAttribute(
        'href',
        expect.stringContaining('/tx/0xmetadatahash'),
      );
      const sync = posted.find((entry) => String(entry.url).endsWith('/admin/set-config'));
      expect((sync?.body as Record<string, unknown>).config).toMatchObject({ sessionName: 'Renamed' });
      expect(mockSignAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({ sessionAuthorityMode: 'evm_registry_canonical', sessionId: undefined }),
      );
      expect(screen.getByTestId(E2E_TESTIDS.SESSION_SETTINGS_SAVE)).toBeDisabled();
    });

    it('keeps a failed Worker sync and retries it without saving on chain again', async () => {
      mockSignAdminAction.mockRejectedValueOnce(new Error('Admin authorization failed.'));
      renderPage({ sessionConfig: registryConfig(), workerOrigin: '' });
      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), { target: { value: 'Renamed' } });
      await act(async () => {
        fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_SETTINGS_SAVE));
      });
      await waitFor(() =>
        expect(screen.getByTestId('ce-settings-status')).toHaveTextContent(
          'The Session Worker didn’t sync: Admin authorization failed.',
        ),
      );
      expect(screen.getByTestId(E2E_TESTIDS.SESSION_SETTINGS_SAVE)).toBeDisabled();

      await act(async () => {
        fireEvent.click(screen.getByTestId('ce-settings-retry-sync'));
      });
      await waitFor(() =>
        expect(screen.getByTestId('ce-settings-status')).toHaveTextContent('The Session Worker is synced now.'),
      );
      const sync = posted.find((entry) => String(entry.url).endsWith('/admin/set-config'));
      expect((sync?.body as Record<string, unknown>).config).toMatchObject({ sessionName: 'Renamed' });
      expect(screen.queryByTestId('ce-settings-retry-sync')).not.toBeInTheDocument();
      expect(mockUploadMetadata).toHaveBeenCalledTimes(1);
      expect(mockUpdateMetadataOnChain).toHaveBeenCalledTimes(1);
    });

    it('names the wallet it needs', () => {
      renderPage({ sessionConfig: registryConfig(), account: '0x00000000000000000000000000000000000000cc' });
      expect(screen.getByTestId('ce-settings-admin-only')).toHaveTextContent(`registry admin, ${ADMIN},`);
      expect(screen.getByTestId('ce-settings-admin-only')).toHaveTextContent(
        'You’re signed in as 0x00000000000000000000000000000000000000cc.',
      );
      cleanup();
      renderPage({ sessionConfig: registryConfig(), account: '', loginComplete: false });
      const adminOnly = screen.getByTestId('ce-settings-admin-only');
      expect(adminOnly).toHaveTextContent(`Sign in with the session’s registry admin wallet, ${ADMIN},`);
      expect(within(adminOnly).getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    });

    it('refuses to save synthesized contract addresses until the admin confirms them', () => {
      renderPage({
        sessionConfig: registryConfig({ metadataLoadState: 'unavailable', metadataDefaultedContractKeys: ['surveys'] }),
      });
      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), { target: { value: 'Renamed' } });
      expect(screen.getByText('Correct the contract addresses or confirm them before saving.')).toBeInTheDocument();
      expect(screen.getByTestId(E2E_TESTIDS.SESSION_SETTINGS_SAVE)).toBeDisabled();
      fireEvent.click(screen.getByTestId('ce-setup-more-hosting'));
      expect(screen.getByTestId('ce-settings-metadata-unavailable')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('ce-settings-contracts-checked'));
      expect(screen.getByTestId(E2E_TESTIDS.SESSION_SETTINGS_SAVE)).toBeEnabled();
    });
  });

  it('says when a session’s profile cannot be edited here', () => {
    renderPage({
      sessionConfig: workerConfig({ sessionModeProfile: { profileVersion: 1, authority: { mode: 'other' } } }),
    });
    expect(screen.getByTestId('ce-settings-unsupported')).toBeInTheDocument();
    expect(mockFetchBootstrap).not.toHaveBeenCalled();
  });
});
