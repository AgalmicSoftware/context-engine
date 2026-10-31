import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { E2E_TESTIDS } from '../../../utilities/e2eTestIds.js';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../../utilities/session/sessionModeProfile';
import { GROUP_CONVERSATION_MODE_QUERY_VALUE } from '../../SurveyTool/sessionVoiceModeQuery';
import SessionSettingsPage, { buildGroupRecorderLink, isSessionAdmin } from './SessionSettingsPage';

const mockFetchBootstrap = jest.fn();
const mockUpsertBootstrap = jest.fn();
const mockSignAdminAction = jest.fn(async (_options: unknown) => ({ signature: '0xsigned' }));

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
    });
    click.mockRestore();
  });

  it('is admin-only', async () => {
    const toggleLoginModal = jest.fn();
    renderPage({ account: '', loginComplete: false, toggleLoginModal });
    expect(await screen.findByTestId('ce-settings-admin-only')).toHaveTextContent('Sign in as a session admin');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(toggleLoginModal).toHaveBeenCalledWith(true);
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

  it('copies the group recorder link', async () => {
    const writeText = jest.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderPage();
    fireEvent.click(await screen.findByTestId('ce-settings-group-recorder-link'));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const link = new URL(String((writeText.mock.calls[0] as unknown[])[0]));
    expect(link.pathname).toBe('/session/edit-salon');
    expect(link.searchParams.get('mode')).toBe(GROUP_CONVERSATION_MODE_QUERY_VALUE);
    expect(link.searchParams.get('worker')).toBe(WORKER);
    expect(buildGroupRecorderLink('edit-salon', '', 'https://contextengine.sh')).toBe(
      `https://contextengine.sh/session/edit-salon?mode=${GROUP_CONVERSATION_MODE_QUERY_VALUE}`,
    );
  });

  it('says on-chain sessions are not edited here', () => {
    renderPage({
      sessionConfig: workerConfig({
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED),
      }),
    });
    expect(screen.getByTestId('ce-settings-unsupported')).toBeInTheDocument();
    expect(mockFetchBootstrap).not.toHaveBeenCalled();
  });
});
