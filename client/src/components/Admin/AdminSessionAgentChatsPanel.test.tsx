import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import AdminSessionAgentChatsPanel from './AdminSessionAgentChatsPanel';
import { fetchWorkerWithAuth } from '../../utilities/worker/workerAuth';

jest.mock('../../utilities/worker/workerAuth', () => ({ fetchWorkerWithAuth: jest.fn() }));

const fetchWorker = jest.mocked(fetchWorkerWithAuth);
const ASKER = `0x${'ab'.repeat(20)}`;
const chat = (id: string, question: string, extra: Record<string, unknown> = {}) => ({
  id,
  day: '2026-11-24',
  answers: 'general',
  question,
  answer: `Answer to ${question}`,
  read: { context: 1, results: false, answers: 0 },
  ...extra,
});
const answer = (status: number, body: unknown) =>
  fetchWorker.mockResolvedValueOnce({
    ok: status < 400,
    status,
    json: async () => body,
  } as unknown as Response);

const renderPanel = (props: Partial<React.ComponentProps<typeof AdminSessionAgentChatsPanel>> = {}) => {
  const postSignedRequest = jest.fn().mockResolvedValue({ data: { ok: true } });
  render(
    <AdminSessionAgentChatsPanel
      workerUrl="https://worker.example/"
      sessionSlug="salon"
      sessionConfig={{ slug: 'salon' }}
      account="0xadmin"
      canAdminWorker
      postSignedRequest={postSignedRequest}
      {...props}
    />,
  );
  return postSignedRequest;
};

describe('AdminSessionAgentChatsPanel', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('is offered only to a config admin, and reads nothing until asked', () => {
    renderPanel({ canAdminWorker: false });
    expect(screen.queryByTestId('ce-admin-session-agent-chats')).not.toBeInTheDocument();
    renderPanel();
    expect(screen.getByRole('button', { name: 'Show stored chats' })).toBeInTheDocument();
    expect(fetchWorker).not.toHaveBeenCalled();
  });

  it('lists chats newest first with who asked only as far as they said, a page at a time', async () => {
    renderPanel();
    answer(200, {
      entries: [
        chat('000000000003', 'Third?', { scope: 'admin' }),
        chat('000000000002', 'Second?', { by: ASKER, name: 'Sam', answers: 'detailed', groups: ['salon', 'hosts'] }),
      ],
      cursor: '000000000002',
      stored: 3,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show stored chats' }));
    expect(await screen.findByRole('status')).toHaveTextContent('3 stored; showing 2, newest first.');
    // Read with the admin's sign-in, not a signature.
    const [url, init, auth] = fetchWorker.mock.calls[0];
    expect(url).toBe('https://worker.example/admin/session-agent/chats?slug=salon');
    expect(init).toEqual({ method: 'GET' });
    expect(auth).toEqual(expect.objectContaining({ sessionSlug: 'salon', context: { account: '0xadmin' } }));
    const [third, second] = screen.getAllByTestId('ce-admin-session-agent-chat');
    // Whom each answer was fit for is said too: an admin's is never exported, a group's is for that group.
    expect(third).toHaveTextContent(
      '2026-11-24 · General answer · No address or name · Answered to an admin; not exported',
    );
    expect(third).toHaveTextContent('Asked: Third?');
    expect(third).toHaveTextContent('Answered: Answer to Third?');
    expect(second).toHaveTextContent(`2026-11-24 · Detailed answer · Sam, ${ASKER} · For salon, hosts`);

    answer(200, { entries: [chat('000000000001', 'First?')], stored: 3 });
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    await waitFor(() => expect(screen.getAllByTestId('ce-admin-session-agent-chat')).toHaveLength(3));
    expect(screen.getAllByTestId('ce-admin-session-agent-chat')[2]).not.toHaveTextContent(/exported|For /);
    expect(fetchWorker.mock.calls[1][0]).toBe(
      'https://worker.example/admin/session-agent/chats?slug=salon&cursor=000000000002',
    );
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
  });

  it('deletes one chat, or every one up to the newest shown, with one signed call each', async () => {
    const postSignedRequest = renderPanel();
    answer(200, { entries: [chat('000000000002', 'Second?'), chat('000000000001', 'First?')], stored: 2 });
    fireEvent.click(screen.getByRole('button', { name: 'Show stored chats' }));
    const [second] = await screen.findAllByTestId('ce-admin-session-agent-chat');

    answer(200, { entries: [chat('000000000001', 'First?')], stored: 1 });
    fireEvent.click(within(second).getByRole('button', { name: 'Delete the chat asking “Second?”' }));
    await waitFor(() => expect(screen.getAllByTestId('ce-admin-session-agent-chat')).toHaveLength(1));
    expect(postSignedRequest).toHaveBeenLastCalledWith({
      action: 'session-agent/chats/delete',
      path: '/admin/session-agent/chats/delete',
      body: { sessionSlug: 'salon', ids: ['000000000002'] },
    });

    // Deleting all takes a second click on a button that says how many go, and can be backed out of.
    fireEvent.click(screen.getByRole('button', { name: 'Delete all' }));
    expect(postSignedRequest).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Keep them' }));
    expect(screen.queryByRole('button', { name: /Delete the 1 stored chat/ })).not.toBeInTheDocument();
    expect(postSignedRequest).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Delete all' }));
    // A chat stored since the list was read is newer than `through`, so it stays.
    answer(200, { entries: [], stored: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Delete the 1 stored chat' }));
    expect(await screen.findByText('No chats are stored.')).toBeInTheDocument();
    expect(postSignedRequest).toHaveBeenLastCalledWith({
      action: 'session-agent/chats/delete',
      path: '/admin/session-agent/chats/delete',
      body: { sessionSlug: 'salon', through: '000000000001' },
    });
    expect(screen.queryByRole('button', { name: 'Delete all' })).not.toBeInTheDocument();
  });

  it('says so plainly when the Worker is too old, refuses, or a delete fails', async () => {
    const postSignedRequest = renderPanel();
    answer(404, {});
    fireEvent.click(screen.getByRole('button', { name: 'Show stored chats' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This Session Worker doesn’t store chats yet. Update the Session Worker first.',
    );
    answer(403, { error: 'Only the session’s admins can read stored chats.' });
    fireEvent.click(screen.getByRole('button', { name: 'Show stored chats' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Only the session’s admins can read stored chats.'),
    );

    answer(200, { entries: [chat('000000000001', 'First?')], stored: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Show stored chats' }));
    await screen.findByTestId('ce-admin-session-agent-chat');
    postSignedRequest.mockRejectedValueOnce(new Error('Stored chats couldn’t be reached just now. Try again shortly.'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete the 1 stored chat' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('couldn’t be reached just now');
    // Nothing was deleted, so the chat is still listed.
    expect(screen.getAllByTestId('ce-admin-session-agent-chat')).toHaveLength(1);
  });
});
