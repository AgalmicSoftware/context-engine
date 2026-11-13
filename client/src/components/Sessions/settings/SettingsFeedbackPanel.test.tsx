import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../../utilities/session/sessionModeProfile';
import {
  deleteFeedback,
  listFeedback,
  type FeedbackAdmin,
  type FeedbackMessage,
} from '../../../domains/worker/sessionFeedbackPorts';
import SessionSettingsPage from './SessionSettingsPage';
import SettingsFeedbackPanel from './SettingsFeedbackPanel';

jest.mock('../../../domains/worker/sessionFeedbackPorts', () => ({
  ...(jest.requireActual('../../../domains/worker/sessionFeedbackPorts') as object),
  listFeedback: jest.fn(),
  deleteFeedback: jest.fn(),
}));
jest.mock('../../../utilities/session/sessionWorkerDiscovery', () => ({
  ...(jest.requireActual('../../../utilities/session/sessionWorkerDiscovery') as object),
  fetchWorkerCanonicalSessionBootstrap: async () => null,
}));
jest.mock('../setup/ContextSourcesPanel', () => ({ __esModule: true, default: () => null }));

const list = jest.mocked(listFeedback);
const remove = jest.mocked(deleteFeedback);

const ADMIN_ADDRESS = '0x00000000000000000000000000000000000000aa';
const ADMIN: FeedbackAdmin = {
  workerOrigin: 'https://worker.example',
  sessionSlug: 'salon',
  sessionConfig: { slug: 'salon' },
  sessionIdHex: '0x01',
  account: ADMIN_ADDRESS,
  chainId: 1,
};
const message = (id: string, extra: Partial<FeedbackMessage> = {}): FeedbackMessage => ({
  id,
  text: `Message ${id}`,
  createdAt: '2026-11-24T10:00:00.000Z',
  view: 'results:debateAtlas',
  theme: 'classic-95',
  screen: 'phone',
  appRelease: '0.9.8',
  workerRelease: '0.9.7',
  signedIn: false,
  contact: null,
  ...extra,
});

const showMessages = async (messages: FeedbackMessage[]) => {
  list.mockResolvedValue(messages);
  render(<SettingsFeedbackPanel admin={ADMIN} />);
  // Reading may ask the admin to sign in to the Worker, so nothing is read until asked.
  expect(list).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Show messages' }));
  await waitFor(() => expect(list).toHaveBeenCalledWith(ADMIN));
};

describe('SettingsFeedbackPanel', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('lists each message with what came with it, as plain text', async () => {
    await showMessages([
      message('a', { text: '<img src=x onerror=alert(1)> https://evil.example' }),
      message('b', { signedIn: true, contact: { address: '0xdef', reachMe: 'sam on Signal' } }),
    ]);
    const rows = within(await screen.findByTestId('ce-settings-feedback-list')).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    // Shown as written: no markup is made from it and no link is made clickable.
    expect(rows[0]).toHaveTextContent('<img src=x onerror=alert(1)> https://evil.example');
    expect(within(rows[0]).queryByRole('img')).not.toBeInTheDocument();
    expect(within(rows[0]).queryByRole('link')).not.toBeInTheDocument();
    for (const detail of ['results:debateAtlas', 'classic-95', 'phone', 'app 0.9.8', 'Worker 0.9.7', 'not signed in']) {
      expect(rows[0]).toHaveTextContent(detail);
    }
    expect(rows[0]).not.toHaveTextContent('May be contacted');
    expect(rows[1]).toHaveTextContent('May be contacted: sam on Signal · 0xdef');
  });

  it('says so when there is none', async () => {
    await showMessages([]);
    expect(await screen.findByText('No feedback yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download CSV' })).not.toBeInTheDocument();
  });

  it('downloads what is listed as a CSV', async () => {
    const blobs: Blob[] = [];
    const createObjectURL = jest.fn((blob: Blob) => {
      blobs.push(blob);
      return 'blob:feedback';
    });
    Object.assign(URL, { createObjectURL, revokeObjectURL: jest.fn() });
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function saved(
      this: HTMLAnchorElement,
    ) {
      expect(this.download).toBe('salon_feedback.csv');
    });
    await showMessages([message('a', { text: 'First' })]);
    fireEvent.click(await screen.findByRole('button', { name: 'Download CSV' }));
    expect(click).toHaveBeenCalledTimes(1);
    expect(blobs[0].type).toBe('text/csv;charset=utf-8;');
    expect(blobs[0].size).toBeGreaterThan('Sent,Feedback'.length);
    click.mockRestore();
  });

  it('deletes one message, and all only after asking', async () => {
    remove.mockResolvedValue();
    await showMessages([message('a'), message('b'), message('c')]);
    const rows = within(await screen.findByTestId('ce-settings-feedback-list')).getAllByRole('listitem');
    fireEvent.click(within(rows[1]).getByRole('button', { name: /^Delete the message sent/ }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith(ADMIN, { ids: ['b'] }));
    await waitFor(() => expect(screen.queryByText('Message b')).not.toBeInTheDocument());
    expect(screen.getByText('Message a')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ce-settings-feedback-delete-all'));
    // Asked first: nothing more is deleted by the first press.
    expect(remove).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Delete the 2 messages listed\? This can’t be undone\./)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ce-settings-feedback-delete-all-confirm'));
    // Exactly the ones listed: a message that arrived since stays, unread.
    await waitFor(() => expect(remove).toHaveBeenLastCalledWith(ADMIN, { through: 'a' }));
    expect(await screen.findByText('No feedback yet.')).toBeInTheDocument();
  });

  it('keeps the list and says so when a delete or a read fails', async () => {
    remove.mockRejectedValue(new Error('Only this session’s admins can delete feedback.'));
    await showMessages([message('a')]);
    fireEvent.click(await screen.findByRole('button', { name: /^Delete the message sent/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Only this session’s admins can delete feedback.');
    expect(screen.getByText('Message a')).toBeInTheDocument();

    // A refresh that fails keeps what was listed, too.
    list.mockRejectedValue(new Error('Only this session’s admins can read feedback.'));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByText('Only this session’s admins can read feedback.')).toBeInTheDocument();
    expect(screen.getByText('Message a')).toBeInTheDocument();
  });
});

describe('Session settings Feedback section', () => {
  const renderPage = (workerOrigin: string, features: string[]) => {
    const fetchImpl = jest.fn(async (url: unknown) =>
      String(url).startsWith(`${workerOrigin}/capabilities`)
        ? new Response(JSON.stringify({ type: 'ce_worker_capabilities', version: 1, apiVersion: 1, features }))
        : new Response('{}', { status: 404 }),
    ) as unknown as typeof fetch;
    render(
      <SessionSettingsPage
        account={ADMIN_ADDRESS}
        loginComplete
        toggleLoginModal={jest.fn()}
        sessionSlug="feedback-salon"
        sessionConfig={{
          slug: 'feedback-salon',
          sessionId: `0x${'2e'.repeat(16)}`,
          adminAddress: ADMIN_ADDRESS,
          corsWorkerUrl: workerOrigin,
          sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
        }}
        workerOrigin={workerOrigin}
        fetchImpl={fetchImpl}
      />,
    );
  };

  it('shows the setting, on, and the messages where the Worker takes feedback', async () => {
    renderPage('https://feedback-new.example.workers.dev', ['session_feedback']);
    const section = within(await screen.findByTestId('ce-settings-feedback'));
    expect(section.getByLabelText('Feedback box')).toBeChecked();
    expect(section.getByRole('button', { name: 'Show messages' })).toBeInTheDocument();
  });

  it('shows no Feedback section for a Worker too old to take it', async () => {
    renderPage('https://feedback-old.example.workers.dev', ['worker_groups']);
    expect(await screen.findByTestId('ce-settings-worker-release')).toBeInTheDocument();
    expect(screen.queryByTestId('ce-settings-feedback')).not.toBeInTheDocument();
  });
});
