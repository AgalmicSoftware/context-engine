import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import SessionAgentModal from './SessionAgentModal';
import {
  askSessionAgent,
  readSessionAgentStatus,
  setSessionAgentOptOut,
  setSessionAgentUnattributed,
  type SessionAgentReply,
  type SessionAgentStatus,
} from './sessionAgentRequests';

jest.mock('./sessionAgentRequests', () => ({
  readSessionAgentStatus: jest.fn(),
  askSessionAgent: jest.fn(),
  setSessionAgentOptOut: jest.fn(),
  setSessionAgentUnattributed: jest.fn(),
}));

const readStatus = jest.mocked(readSessionAgentStatus);
const ask = jest.mocked(askSessionAgent);
const setOptOut = jest.mocked(setSessionAgentOptOut);
const setUnattributed = jest.mocked(setSessionAgentUnattributed);

const OPTIONS = { sessionSlug: 'salon', sessionConfig: { slug: 'salon' }, account: '0xabc' };
const member: SessionAgentStatus = {
  on: true,
  answers: 'general',
  audience: 1,
  optedOut: false,
  unattributed: false,
  closed: null,
};
const reply = (answer: string, read = { context: 0, results: false, answers: 0 }, note = ''): SessionAgentReply => ({
  answer,
  answers: 'general',
  read,
  note,
});

const renderModal = async (status: SessionAgentStatus) => {
  readStatus.mockResolvedValue(status);
  const onClose = jest.fn();
  render(<SessionAgentModal {...OPTIONS} onClose={onClose} />);
  const dialog = await screen.findByRole('dialog', { name: 'Session Agent' });
  await waitFor(() => expect(within(dialog).queryByText('Checking…')).not.toBeInTheDocument());
  return { dialog: within(dialog), onClose };
};

const askQuestion = (dialog: ReturnType<typeof within>, text: string) => {
  fireEvent.change(dialog.getByLabelText('Your question'), { target: { value: text } });
  fireEvent.click(dialog.getByRole('button', { name: 'Ask' }));
};

describe('SessionAgentModal', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('says it is a preview and asks for the person’s own status', async () => {
    const { dialog } = await renderModal(member);
    expect(dialog.getByText('Preview')).toBeInTheDocument();
    expect(readStatus).toHaveBeenCalledWith(OPTIONS);
    expect(dialog.getByText('You get General answers.')).toBeInTheDocument();
    expect(dialog.getByText('Answers are at most 150 words. Questions and answers aren’t kept.')).toBeInTheDocument();
    expect(dialog.getByLabelText('Your question')).toHaveAttribute('maxLength', '500');
  });

  it('asks the trimmed question and shows only the latest answer, with what it drew on', async () => {
    const { dialog } = await renderModal(member);
    expect(dialog.getByRole('button', { name: 'Ask' })).toBeDisabled();
    ask.mockResolvedValueOnce(reply('First answer.', { context: 2, results: true, answers: 0 }));
    askQuestion(dialog, '  What did we agree on?  ');
    expect(await dialog.findByText('First answer.')).toBeInTheDocument();
    expect(ask).toHaveBeenCalledWith('What did we agree on?', OPTIONS);
    expect(dialog.getByText('Drew on 2 items of context and the results.')).toBeInTheDocument();

    ask.mockResolvedValueOnce(
      reply('Second answer.', { context: 1, results: false, answers: 2000 }, 'Members’ answers couldn’t be read.'),
    );
    fireEvent.click(dialog.getByRole('button', { name: 'Ask' }));
    expect(await dialog.findByText('Second answer.')).toBeInTheDocument();
    expect(dialog.queryByText('First answer.')).not.toBeInTheDocument();
    expect(dialog.getByText('Drew on 1 item of context and 2,000 answers from members.')).toBeInTheDocument();
    expect(dialog.getByText('Members’ answers couldn’t be read.')).toBeInTheDocument();
  });

  it('shows why a question failed and keeps the question to ask again', async () => {
    const { dialog } = await renderModal(member);
    ask.mockResolvedValueOnce(reply('An answer.'));
    askQuestion(dialog, 'Who agreed?');
    await dialog.findByText('An answer.');
    let fail: (error: Error) => void = () => {};
    ask.mockReturnValueOnce(new Promise<SessionAgentReply>((_, reject) => (fail = reject)));
    fireEvent.click(dialog.getByRole('button', { name: 'Ask' }));
    expect(await dialog.findByRole('button', { name: 'Asking…' })).toBeDisabled();
    fail(new Error('The session’s AI is busy. Try again shortly.'));
    expect(await dialog.findByRole('alert')).toHaveTextContent('The session’s AI is busy. Try again shortly.');
    expect(dialog.queryByText('An answer.')).not.toBeInTheDocument();
    expect(dialog.getByLabelText('Your question')).toHaveValue('Who agreed?');
  });

  it('tells an admin they get Detailed answers, and what those draw on', async () => {
    const { dialog } = await renderModal({ ...member, answers: 'detailed', audience: 'admin' });
    expect(dialog.getByText('As an admin, you get Detailed answers.')).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'What Detailed answers draw on' })).toBeInTheDocument();
  });

  it('tells someone it doesn’t answer them, and still lets them keep their answers and files out', async () => {
    const { dialog } = await renderModal({ ...member, answers: null, audience: null });
    expect(dialog.getByText('The Session Agent isn’t open to you in this session.')).toBeInTheDocument();
    expect(dialog.queryByLabelText('Your question')).not.toBeInTheDocument();
    const use = dialog.getByRole('switch', { name: 'Use my answers and files' });
    expect(use).toBeChecked();
    expect(dialog.getByTestId('ce-session-agent-notice-switch')).toHaveAttribute(
      'href',
      expect.stringMatching(/README\.md#session-agent$/),
    );
    expect(dialog.getByTestId('ce-session-agent-notice-switch')).toHaveAccessibleDescription(
      'The Session Agent may draw on the files you added, and Detailed answers on your answers too, never naming ' +
        'you. Turning it off stops future use and keeps them out of exports made from then on; it can’t take back ' +
        'answers already given.',
    );

    setOptOut.mockResolvedValueOnce(true);
    fireEvent.click(use);
    await waitFor(() => expect(use).not.toBeChecked());
    expect(setOptOut).toHaveBeenCalledWith(true, OPTIONS);

    setOptOut.mockRejectedValueOnce(new Error('Who turned the Session Agent off couldn’t be read just now.'));
    fireEvent.click(use);
    expect(await dialog.findByRole('alert')).toHaveTextContent('couldn’t be read just now');
    expect(setOptOut).toHaveBeenLastCalledWith(false, OPTIONS);
    expect(use).not.toBeChecked();
  });

  it('keeps a switch change saved while a status check was on its way', async () => {
    readStatus.mockResolvedValueOnce(member);
    const view = render(<SessionAgentModal {...OPTIONS} onClose={() => {}} />);
    const dialog = within(await screen.findByRole('dialog', { name: 'Session Agent' }));
    const use = await dialog.findByRole('switch', { name: 'Use my answers and files' });
    let answer: (status: SessionAgentStatus) => void = () => {};
    readStatus.mockReturnValueOnce(new Promise<SessionAgentStatus>((resolve) => (answer = resolve)));
    // A new config object checks the status again.
    view.rerender(<SessionAgentModal {...OPTIONS} sessionConfig={{ slug: 'salon' }} onClose={() => {}} />);
    expect(readStatus).toHaveBeenCalledTimes(2);
    setOptOut.mockResolvedValueOnce(true);
    fireEvent.click(use);
    await waitFor(() => expect(use).not.toBeChecked());
    // That check was sent before the save, so it still says they're in.
    await act(async () => answer(member));
    expect(use).not.toBeChecked();
  });

  it('includes a person’s address unless they turn that off, and says what it changes', async () => {
    const { dialog } = await renderModal(member);
    const include = dialog.getByRole('switch', { name: 'Include my address with my answers' });
    // On to start, like the switch above it: both are turned off to opt out.
    expect(include).toBeChecked();
    const help = dialog.getByRole('button', { name: 'About your address on your answers' });
    // This session's config names no results setting, so only its organisers are claimed; the switch
    // changes exports and nothing else, and says so.
    expect(help).toHaveAccessibleDescription(
      'What you wrote and the files you added are available with your account address to this session’s ' +
        'organisers, and may be exported with it. Turning this off leaves your address off exports only; it ' +
        'still shows wherever this session shows your answers. Copies already made keep it.',
    );

    setUnattributed.mockResolvedValueOnce(true);
    fireEvent.click(include);
    await waitFor(() => expect(include).not.toBeChecked());
    expect(setUnattributed).toHaveBeenCalledWith(true, OPTIONS);
    // The other switch is untouched, and was never saved.
    expect(dialog.getByRole('switch', { name: 'Use my answers and files' })).toBeChecked();
    expect(setOptOut).not.toHaveBeenCalled();

    setUnattributed.mockRejectedValueOnce(new Error('Your choice couldn’t be saved just now.'));
    fireEvent.click(include);
    expect(await dialog.findByRole('alert')).toHaveTextContent('couldn’t be saved just now');
    expect(setUnattributed).toHaveBeenLastCalledWith(false, OPTIONS);
    expect(include).not.toBeChecked();
  });

  it('says behind the address switch who is shown a person’s answers, by the session’s results setting', async () => {
    readStatus.mockResolvedValue(member);
    const members = { slug: 'salon', sessionModeProfile: { results: { visibility: 'session_member_full' } } };
    render(<SessionAgentModal {...OPTIONS} sessionConfig={members} onClose={() => {}} />);
    const dialog = within(await screen.findByRole('dialog', { name: 'Session Agent' }));
    expect(
      await dialog.findByRole('button', { name: 'About your address on your answers' }),
    ).toHaveAccessibleDescription(
      expect.stringContaining(
        'are available with your account address to this session’s organisers and its signed-in members, and may be exported with it.',
      ),
    );
    cleanup();
    const open = { slug: 'salon', sessionModeProfile: { results: { visibility: 'public_full_if_storage_public' } } };
    render(<SessionAgentModal {...OPTIONS} sessionConfig={open} onClose={() => {}} />);
    const second = within(await screen.findByRole('dialog', { name: 'Session Agent' }));
    expect(
      await second.findByRole('button', { name: 'About your address on your answers' }),
    ).toHaveAccessibleDescription(
      expect.stringContaining('are available with your account address to anyone with this session’s link, and may be'),
    );
  });

  it('shows the address switch as off for someone who turned it off, and not at all for someone who has none', async () => {
    const chosen = await renderModal({ ...member, unattributed: true });
    expect(chosen.dialog.getByRole('switch', { name: 'Include my address with my answers' })).not.toBeChecked();
    cleanup();
    const none = await renderModal({ ...member, unattributed: null });
    expect(none.dialog.getByRole('switch', { name: 'Use my answers and files' })).toBeInTheDocument();
    expect(none.dialog.queryByRole('switch', { name: 'Include my address with my answers' })).not.toBeInTheDocument();
  });

  it('keeps an address choice saved while a status check was on its way', async () => {
    readStatus.mockResolvedValueOnce(member);
    const view = render(<SessionAgentModal {...OPTIONS} onClose={() => {}} />);
    const dialog = within(await screen.findByRole('dialog', { name: 'Session Agent' }));
    const include = await dialog.findByRole('switch', { name: 'Include my address with my answers' });
    let answer: (status: SessionAgentStatus) => void = () => {};
    readStatus.mockReturnValueOnce(new Promise<SessionAgentStatus>((resolve) => (answer = resolve)));
    view.rerender(<SessionAgentModal {...OPTIONS} sessionConfig={{ slug: 'salon' }} onClose={() => {}} />);
    setUnattributed.mockResolvedValueOnce(true);
    fireEvent.click(include);
    await waitFor(() => expect(include).not.toBeChecked());
    // That check was sent before the save, so it still says their address is included.
    await act(async () => answer(member));
    expect(include).not.toBeChecked();
  });

  it('still offers both switches once the session has ended or its AI is off, and no question box', async () => {
    const ended = await renderModal({ ...member, answers: null, audience: null, closed: 'session_ended' });
    expect(
      ended.dialog.getByText('This session has ended, so the Session Agent no longer answers.'),
    ).toBeInTheDocument();
    expect(ended.dialog.queryByLabelText('Your question')).not.toBeInTheDocument();
    setUnattributed.mockResolvedValueOnce(true);
    const include = ended.dialog.getByRole('switch', { name: 'Include my address with my answers' });
    fireEvent.click(include);
    await waitFor(() => expect(include).not.toBeChecked());
    expect(setUnattributed).toHaveBeenCalledWith(true, OPTIONS);
    expect(ended.dialog.getByRole('switch', { name: 'Use my answers and files' })).toBeChecked();
    cleanup();
    const aiOff = await renderModal({ ...member, answers: null, audience: null, closed: 'ai_disabled' });
    expect(
      aiOff.dialog.getByText('AI is turned off for this session, so the Session Agent isn’t answering.'),
    ).toBeInTheDocument();
    expect(aiOff.dialog.getAllByRole('switch')).toHaveLength(2);
  });

  it('never shows one person’s saved choice as another’s when the account changes mid-save', async () => {
    readStatus.mockResolvedValueOnce(member);
    const view = render(<SessionAgentModal {...OPTIONS} onClose={() => {}} />);
    const dialog = within(await screen.findByRole('dialog', { name: 'Session Agent' }));
    let saved: (unattributed: boolean) => void = () => {};
    setUnattributed.mockReturnValueOnce(new Promise<boolean>((resolve) => (saved = resolve)));
    fireEvent.click(await dialog.findByRole('switch', { name: 'Include my address with my answers' }));
    // Someone else signs in before that save answers.
    let answer: (status: SessionAgentStatus) => void = () => {};
    readStatus.mockReturnValueOnce(new Promise<SessionAgentStatus>((resolve) => (answer = resolve)));
    view.rerender(<SessionAgentModal {...OPTIONS} account="0xdef" onClose={() => {}} />);
    expect(readStatus).toHaveBeenLastCalledWith({ ...OPTIONS, account: '0xdef' });
    // Until their own status is read, nothing of the person before is on screen.
    expect(await dialog.findByText('Checking…')).toBeInTheDocument();
    expect(dialog.queryByRole('switch')).not.toBeInTheDocument();
    await act(async () => answer(member));
    const theirs = await dialog.findByRole('switch', { name: 'Include my address with my answers' });
    // The first person turned theirs off; this person's is still on.
    await act(async () => saved(true));
    expect(theirs).toBeChecked();
    await waitFor(() => expect(theirs).toBeEnabled());
  });

  it('shows the switch as off for someone who opted out', async () => {
    const { dialog } = await renderModal({ ...member, optedOut: true });
    expect(dialog.getByRole('switch', { name: 'Use my answers and files' })).not.toBeChecked();
  });

  it('offers to try again when it can’t say how it would answer', async () => {
    readStatus.mockRejectedValueOnce(new Error('Who may ask could not be checked just now. Try again shortly.'));
    render(<SessionAgentModal {...OPTIONS} onClose={() => {}} />);
    const dialog = within(await screen.findByRole('dialog', { name: 'Session Agent' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('Who may ask could not be checked just now.');
    readStatus.mockResolvedValueOnce(member);
    fireEvent.click(dialog.getByRole('button', { name: 'Try again' }));
    expect(await dialog.findByText('You get General answers.')).toBeInTheDocument();
    expect(readStatus).toHaveBeenCalledTimes(2);
  });

  it('says when an admin has turned it off since the page loaded', async () => {
    const { dialog } = await renderModal({ ...member, on: false, answers: null, audience: null });
    expect(dialog.getByText('An admin has turned the Session Agent off.')).toBeInTheDocument();
    expect(dialog.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('closes from its × button', async () => {
    const { dialog, onClose } = await renderModal(member);
    fireEvent.click(dialog.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});
