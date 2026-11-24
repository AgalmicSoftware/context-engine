import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { dictationNeedsSignIn, dictationOffered, sessionEnded } from '../../domains/worker/sessionDictationPorts';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import SessionAgentModal from './SessionAgentModal';
import {
  askSessionAgent,
  readSessionAgentStatus,
  setSessionAgentOptOut,
  setSessionAgentUnattributed,
  type SessionAgentReply,
  type SessionAgentStatus,
} from './sessionAgentRequests';

jest.mock('../../domains/worker/sessionDictationPorts', () => ({
  dictationOffered: jest.fn(),
  dictationNeedsSignIn: jest.fn(),
  sessionEnded: jest.fn(),
}));

// The recorder the answer field uses, as a test sets it.
const mockWhisper = {
  options: null as null | { sessionSlug: string; context: unknown; onTranscriptionComplete: (words: string) => void },
  state: {} as Record<string, unknown>,
};
jest.mock('../../utilities/useWhisper', () => ({
  RECORDING_STATUS: { PROCESSING: 'processing' },
  useWhisper: (options: typeof mockWhisper.options) => {
    mockWhisper.options = options;
    return mockWhisper.state;
  },
}));

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
const speech = jest.mocked(dictationOffered);
const speechNeedsSignIn = jest.mocked(dictationNeedsSignIn);
const ended = jest.mocked(sessionEnded);

const OPTIONS = { sessionSlug: 'salon', sessionConfig: { slug: 'salon' }, account: '0xabc' };
const member: SessionAgentStatus = {
  on: true,
  answers: 'general',
  audience: 1,
  optedOut: false,
  unattributed: false,
  closed: null,
  recording: false,
  signedOut: false,
};
const reply = (answer: string, read = { context: 0, results: false, answers: 0 }, note = ''): SessionAgentReply => ({
  answer,
  answers: 'general',
  read,
  sources: null,
  questions: [],
  questionsFrom: 'answers',
  note,
  stored: null,
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
  beforeEach(() => {
    speech.mockResolvedValue(false);
    speechNeedsSignIn.mockResolvedValue(false);
    mockWhisper.state = {};
  });
  afterEach(async () => {
    // Unmount, then let what the modal already asked finish, and only then reset the mocks. On a loaded machine
    // a status read lands after a test's last line: a modal still on the page would then ask a mock that
    // answers nothing once reset, and a check already under way would make its second call in the next test.
    cleanup();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    jest.resetAllMocks();
  });

  it('lists the context an answer read for someone the Worker lists it for, and only the count otherwise', async () => {
    const { dialog } = await renderModal(member);
    ask.mockResolvedValueOnce({
      ...reply('An answer.', { context: 3, results: false, answers: 0 }),
      sources: [
        { kind: 'session-link', title: 'Charter', url: 'https://example.org/charter', readByAi: false },
        { kind: 'file', title: 'report.pdf', url: '', readByAi: true },
        { kind: 'session-note', title: 'Reverse alignment is…', url: '', readByAi: false },
      ],
    });
    askQuestion(dialog, 'Why?');
    const list = within(await dialog.findByTestId('ce-session-agent-sources'));
    // The count is what opens the list.
    expect(list.getByText('Drew on 3 items of context.').tagName).toBe('SUMMARY');
    expect(list.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Charter (link in the session’s context)',
      'report.pdf (PDF, as the session’s AI read it)',
      'Reverse alignment is… (the session’s context)',
    ]);
    const link = list.getByRole('link', { name: 'Charter' });
    expect(link).toHaveAttribute('href', 'https://example.org/charter');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(list.queryByRole('link', { name: 'report.pdf' })).not.toBeInTheDocument();

    // No list from the Worker, as for someone not signed in: the count alone, with nothing to open.
    ask.mockResolvedValueOnce(reply('Another answer.', { context: 3, results: false, answers: 0 }));
    fireEvent.click(dialog.getByRole('button', { name: 'Ask' }));
    await dialog.findByText('Another answer.');
    expect(dialog.queryByTestId('ce-session-agent-sources')).not.toBeInTheDocument();
    expect(dialog.getByText('Drew on 3 items of context.').tagName).toBe('P');
  });

  it('links the questions an answer read to their own pages, and opens Results when it read them', async () => {
    readStatus.mockResolvedValue(member);
    const onClose = jest.fn();
    const onOpenResults = jest.fn();
    render(<SessionAgentModal {...OPTIONS} onOpenResults={onOpenResults} onClose={onClose} />);
    const dialog = within(await screen.findByRole('dialog', { name: 'Session Agent' }));
    await dialog.findByLabelText('Your question');
    ask.mockResolvedValueOnce({
      ...reply('An answer.', { context: 0, results: true, answers: 0 }),
      questions: [{ id: '0xq1', question: 'Should meetings be shorter?' }],
    });
    askQuestion(dialog, 'Why?');
    const questions = within(await dialog.findByTestId('ce-session-agent-questions'));
    expect(questions.getByText('Questions whose answers it read that are closest to yours:')).toBeInTheDocument();
    const link = questions.getByRole('link', { name: 'Should meetings be shorter?' });
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    const address = new URL(link.getAttribute('href') || '', 'https://site.example');
    expect(address.pathname).toMatch(/\/question\/0xq1$/);
    expect(address.searchParams.get('session')).toBe('salon');
    // A new tab, so the answer, which isn't kept, stays on this one.
    expect(link).toHaveAttribute('target', '_blank');

    fireEvent.click(dialog.getByRole('button', { name: 'Open Results' }));
    expect(onOpenResults).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Questions the results cite are said to be that, and an answer that read no results offers none to open.
    ask.mockResolvedValueOnce({
      ...reply('Another answer.', { context: 1, results: false, answers: 0 }),
      questions: [{ id: '0xq2', question: 'Should meetings move online?' }],
      questionsFrom: 'results',
    });
    fireEvent.click(dialog.getByRole('button', { name: 'Ask' }));
    await dialog.findByText('Another answer.');
    expect(dialog.getByText('Questions the session’s results cite that are closest to yours:')).toBeInTheDocument();
    expect(dialog.queryByRole('button', { name: 'Open Results' })).not.toBeInTheDocument();
  });

  it('offers no Results button where the page has none to open', async () => {
    const { dialog } = await renderModal(member);
    ask.mockResolvedValueOnce(reply('An answer.', { context: 1, results: true, answers: 0 }));
    askQuestion(dialog, 'Why?');
    await dialog.findByText('An answer.');
    expect(dialog.queryByRole('button', { name: 'Open Results' })).not.toBeInTheDocument();
    expect(dialog.queryByTestId('ce-session-agent-questions')).not.toBeInTheDocument();
  });

  it('takes a spoken question where the session writes speech down, up to the question’s limit', async () => {
    speech.mockResolvedValue(true);
    const { dialog } = await renderModal(member);
    const mic = await dialog.findByRole('button', { name: 'Start recording' });
    expect(mic).toHaveAttribute('data-testid', 'ce-session-agent-mic');
    expect(speech).toHaveBeenCalledWith(OPTIONS);
    // As for an answer: the session's Worker writes it down, and speaking never asks for a signature.
    expect(mockWhisper.options).toEqual(
      expect.objectContaining({ sessionSlug: 'salon', context: { account: '0xabc' }, signInPrompt: false }),
    );
    fireEvent.change(dialog.getByLabelText('Your question'), { target: { value: 'About meetings: ' } });
    act(() => mockWhisper.options?.onTranscriptionComplete('  should they be shorter?  '));
    expect(dialog.getByLabelText('Your question')).toHaveValue('About meetings: should they be shorter?');
    expect(dialog.queryByText(/didn’t fit/)).not.toBeInTheDocument();
    act(() => mockWhisper.options?.onTranscriptionComplete('x'.repeat(600)));
    expect((dialog.getByLabelText('Your question') as HTMLTextAreaElement).value).toHaveLength(500);
    expect(dialog.getByText('The end of what you said didn’t fit in 500 characters.')).toBeInTheDocument();
    fireEvent.change(dialog.getByLabelText('Your question'), { target: { value: 'Shorter?' } });
    expect(dialog.queryByText(/didn’t fit/)).not.toBeInTheDocument();
  });

  it('holds Ask while speech is recorded or written down, so no half question is sent', async () => {
    speech.mockResolvedValue(true);
    mockWhisper.state = { isRecording: true };
    const { dialog } = await renderModal(member);
    await dialog.findByRole('button', { name: 'Stop recording' });
    fireEvent.change(dialog.getByLabelText('Your question'), { target: { value: 'Why?' } });
    expect(dialog.getByRole('button', { name: 'Ask' })).toBeDisabled();
    fireEvent.submit(dialog.getByLabelText('Your question').closest('form') as HTMLFormElement);
    expect(ask).not.toHaveBeenCalled();
    cleanup();

    mockWhisper.state = { isProcessing: true };
    const { dialog: writing } = await renderModal(member);
    await writing.findByText('Processing audio…');
    fireEvent.change(writing.getByLabelText('Your question'), { target: { value: 'Why?' } });
    expect(writing.getByRole('button', { name: 'Ask' })).toBeDisabled();
  });

  it('shows no microphone where the session writes no speech down, and tells a visitor when signing in would', async () => {
    const { dialog } = await renderModal(member);
    await waitFor(() => expect(speech).toHaveBeenCalled());
    expect(dialog.queryByTestId('ce-session-agent-mic')).not.toBeInTheDocument();
    expect(dialog.queryByText(/Sign in to ask by voice/)).not.toBeInTheDocument();
    cleanup();

    speechNeedsSignIn.mockResolvedValue(true);
    readStatus.mockResolvedValue({ ...member, unattributed: null, signedOut: true });
    render(<SessionAgentModal {...OPTIONS} account="" onClose={() => {}} />);
    const visitor = within(await screen.findByRole('dialog', { name: 'Session Agent' }));
    expect(await visitor.findByText(/Sign in to ask by voice\.$/)).toBeInTheDocument();
    expect(visitor.queryByTestId('ce-session-agent-mic')).not.toBeInTheDocument();
  });

  it('tells a visitor to sign in to ask by voice when the Worker takes a moment to answer', async () => {
    // The second answer arrives after the page has drawn the first: a real read of the Worker, not a cached one.
    speechNeedsSignIn.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(true), 20)));
    readStatus.mockResolvedValue({ ...member, unattributed: null, signedOut: true });
    render(<SessionAgentModal {...OPTIONS} account="" onClose={() => {}} />);
    const visitor = within(await screen.findByRole('dialog', { name: 'Session Agent' }));
    expect(await visitor.findByText(/Sign in to ask by voice\.$/)).toBeInTheDocument();
    expect(speech).toHaveBeenCalledTimes(1);
  });

  it('shows no microphone and promises nothing where the Worker couldn’t be read', async () => {
    speech.mockResolvedValue(null);
    const { dialog } = await renderModal(member);
    await waitFor(() => expect(speech).toHaveBeenCalled());
    expect(dialog.queryByTestId('ce-session-agent-mic')).not.toBeInTheDocument();
    expect(speechNeedsSignIn).not.toHaveBeenCalled();
  });

  it('takes the microphone away once the session has ended with the dialog open', async () => {
    speech.mockResolvedValue(true);
    readStatus.mockResolvedValue(member);
    const view = render(<SessionAgentModal {...OPTIONS} onClose={() => {}} />);
    const dialog = within(await screen.findByRole('dialog', { name: 'Session Agent' }));
    await dialog.findByTestId('ce-session-agent-mic');
    ended.mockReturnValue(true);
    view.rerender(<SessionAgentModal {...OPTIONS} onClose={() => {}} />);
    expect(dialog.queryByTestId('ce-session-agent-mic')).not.toBeInTheDocument();
  });

  it('ignores a late answer about the person before', async () => {
    let answerFirst: (value: boolean) => void = () => {};
    speech.mockImplementationOnce(() => new Promise((resolve) => (answerFirst = resolve)));
    speech.mockResolvedValue(false);
    readStatus.mockResolvedValue(member);
    const view = render(<SessionAgentModal {...OPTIONS} onClose={() => {}} />);
    const dialog = within(await screen.findByRole('dialog', { name: 'Session Agent' }));
    await waitFor(() => expect(speech).toHaveBeenCalledTimes(1));
    view.rerender(<SessionAgentModal {...OPTIONS} account="0xdef" onClose={() => {}} />);
    await waitFor(() => expect(speech).toHaveBeenLastCalledWith({ ...OPTIONS, account: '0xdef' }));
    await act(async () => answerFirst(true));
    expect(dialog.queryByTestId('ce-session-agent-mic')).not.toBeInTheDocument();
  });

  it('ignores a late word about signing in that was for the visitor before', async () => {
    let answerVisitor: (value: boolean) => void = () => {};
    speechNeedsSignIn.mockImplementationOnce(() => new Promise((resolve) => (answerVisitor = resolve)));
    readStatus.mockResolvedValue({ ...member, unattributed: null, signedOut: true });
    const view = render(<SessionAgentModal {...OPTIONS} account="" onClose={() => {}} />);
    const dialog = within(await screen.findByRole('dialog', { name: 'Session Agent' }));
    await waitFor(() => expect(speechNeedsSignIn).toHaveBeenCalledTimes(1));
    // They sign in before the answer arrives; the session writes no speech down for them either.
    readStatus.mockResolvedValue(member);
    view.rerender(<SessionAgentModal {...OPTIONS} onClose={() => {}} />);
    await waitFor(() => expect(speech).toHaveBeenLastCalledWith(OPTIONS));
    await waitFor(() => expect(speechNeedsSignIn.mock.calls.length).toBeGreaterThan(1));
    await act(async () => answerVisitor(true));
    expect(dialog.queryByText(/Sign in to ask by voice/)).not.toBeInTheDocument();
  });

  it('starts the microphone afresh for the next person, and frees Ask if the one before was recording', async () => {
    speech.mockResolvedValue(true);
    mockWhisper.state = { isRecording: true };
    readStatus.mockResolvedValue(member);
    const view = render(<SessionAgentModal {...OPTIONS} onClose={() => {}} />);
    const dialog = within(await screen.findByRole('dialog', { name: 'Session Agent' }));
    await dialog.findByRole('button', { name: 'Stop recording' });
    // The next person's session writes no speech down for them.
    speech.mockResolvedValue(false);
    view.rerender(<SessionAgentModal {...OPTIONS} account="0xdef" onClose={() => {}} />);
    await waitFor(() => expect(speech).toHaveBeenLastCalledWith({ ...OPTIONS, account: '0xdef' }));
    await waitFor(() => expect(dialog.queryByTestId('ce-session-agent-mic')).not.toBeInTheDocument());
    fireEvent.change(dialog.getByLabelText('Your question'), { target: { value: 'Why?' } });
    expect(dialog.getByRole('button', { name: 'Ask' })).toBeEnabled();
  });

  it('says behind the General "?" who the session gives Detailed answers', async () => {
    const group = { match: 'any', conditions: [{ kind: 'worker_group', groupIds: ['salon'] }] };
    const everyone = { match: 'any', conditions: [{ kind: 'agent_grant_scope', scope: 'ai' }] };
    const sessionConfig = {
      slug: 'salon',
      sessionAgent: {
        audiences: [
          { who: group, answers: 'detailed' },
          { who: everyone, answers: 'general' },
        ],
      },
    };
    readStatus.mockResolvedValue({ ...member, unattributed: null, signedOut: true });
    render(<SessionAgentModal {...OPTIONS} sessionConfig={sessionConfig} account="" onClose={() => {}} />);
    const dialog = within(await screen.findByRole('dialog', { name: 'Session Agent' }));
    expect(await dialog.findByRole('button', { name: 'What General answers draw on' })).toHaveAccessibleDescription(
      'General answers draw on the session’s context, the files everyone may see and the results you may see. ' +
        'They never use members’ answers or files locked to a group. In this session members of some of its ' +
        'groups may get Detailed answers, which also draw on members’ answers. Sign in to see which you get.',
    );
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
    // Headed apart from storing a chat, whose address choice is a different one.
    expect(dialog.getByRole('group', { name: 'Your answers and files in this session' })).toContainElement(use);
    expect(dialog.getByRole('button', { name: 'About using your answers and files' })).toHaveAccessibleDescription(
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
    // takes the address off what the person wrote and added in exports, not off a group's member list, and says so.
    expect(help).toHaveAccessibleDescription(
      'What you wrote and the files you added are available with your account address to this session’s ' +
        'organisers, and may be exported with it. Turn this off and exports leave your address off what you ' +
        'wrote and added; a group’s member list in an export still includes it, and it still shows wherever ' +
        'this session shows your answers. Copies already made keep it.',
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

  it('shows a "?" when clicked or tapped, keeps it while the "?" has focus, and with the app’s tooltips off', async () => {
    const store = createStore(() => ({ sessionState: { tooltipsEnabled: false } }));
    readStatus.mockResolvedValue({ ...member, recording: true });
    render(
      <Provider store={store}>
        <SessionAgentModal {...OPTIONS} onClose={() => {}} />
      </Provider>,
    );
    const dialog = within(await screen.findByRole('dialog', { name: 'Session Agent' }));
    const help = await dialog.findByRole('button', { name: 'About storing this chat' });
    fireEvent.click(help);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Untick it to keep this one out.');
    // A tap ends with the mouse leaving: the words stay while the "?" has focus.
    fireEvent.mouseOut(help);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    expect(screen.getByRole('tooltip')).toHaveTextContent('Untick it to keep this one out.');
    act(() => help.blur());
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
    // Without focus, the mouse leaving closes it.
    fireEvent.mouseOver(help);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Untick it to keep this one out.');
    fireEvent.mouseOut(help);
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
  });

  it('offers no way to store a chat in a session that stores none, and sends nothing about storing', async () => {
    const { dialog } = await renderModal(member);
    expect(dialog.queryByRole('checkbox', { name: 'Store this chat' })).not.toBeInTheDocument();
    expect(dialog.queryByLabelText('Name (optional)')).not.toBeInTheDocument();
    ask.mockResolvedValueOnce(reply('An answer.'));
    askQuestion(dialog, 'Why?');
    await dialog.findByText('An answer.');
    expect(ask.mock.calls[0]).toEqual(['Why?', OPTIONS]);
    expect(dialog.queryByText('This chat was stored.')).not.toBeInTheDocument();
  });

  it('stores a chat unless its asker unticks the box, without their address unless they choose it', async () => {
    const { dialog } = await renderModal({ ...member, recording: true });
    const store = dialog.getByRole('checkbox', { name: 'Store this chat' });
    // Ticked to start, and said before anything is asked.
    expect(store).toBeChecked();
    expect(dialog.getByRole('button', { name: 'About storing this chat' })).toHaveAccessibleDescription(
      /will be kept in this session’s records, available to its organisers, and may be exported\. Untick it to keep this one out\./,
    );
    expect(dialog.queryByText(/Questions and answers aren’t kept/)).not.toBeInTheDocument();
    expect(dialog.getByRole('radio', { name: 'No address' })).toBeChecked();
    expect(dialog.getByRole('radio', { name: 'My address' })).not.toBeChecked();
    expect(dialog.getByLabelText('Name (optional)')).toHaveAttribute('maxLength', '60');

    ask.mockResolvedValueOnce({ ...reply('First answer.'), stored: true });
    askQuestion(dialog, 'Why?');
    expect(await dialog.findByText('This chat was stored.')).toBeInTheDocument();
    expect(ask).toHaveBeenLastCalledWith('Why?', OPTIONS, { attribution: 'anonymous', name: '' });

    fireEvent.click(dialog.getByRole('radio', { name: 'My address' }));
    fireEvent.change(dialog.getByLabelText('Name (optional)'), { target: { value: '  Sam’s agent ' } });
    ask.mockResolvedValueOnce({ ...reply('Second answer.'), stored: true });
    fireEvent.click(dialog.getByRole('button', { name: 'Ask' }));
    await dialog.findByText('Second answer.');
    expect(ask).toHaveBeenLastCalledWith('Why?', OPTIONS, { attribution: 'address', name: 'Sam’s agent' });

    // Unticked, nothing about who asked is offered or sent, and the dialog says this one isn't kept.
    fireEvent.click(store);
    expect(dialog.queryByRole('radio')).not.toBeInTheDocument();
    expect(dialog.queryByLabelText('Name (optional)')).not.toBeInTheDocument();
    expect(dialog.getByText(/This chat won’t be kept\./)).toBeInTheDocument();
    ask.mockResolvedValueOnce({ ...reply('Third answer.'), stored: false });
    fireEvent.click(dialog.getByRole('button', { name: 'Ask' }));
    await dialog.findByText('Third answer.');
    expect(ask).toHaveBeenLastCalledWith('Why?', OPTIONS, null);
    expect(dialog.queryByText('This chat was stored.')).not.toBeInTheDocument();
  });

  it('shows what the Worker says when a chat that was to be stored wasn’t', async () => {
    const { dialog } = await renderModal({ ...member, recording: true });
    ask.mockResolvedValueOnce({
      ...reply('An answer.', undefined, 'This chat couldn’t be stored just now.'),
      stored: false,
    });
    askQuestion(dialog, 'Why?');
    expect(await dialog.findByText('This chat couldn’t be stored just now.')).toBeInTheDocument();
    expect(dialog.queryByText('This chat was stored.')).not.toBeInTheDocument();
  });

  it('starts the next person afresh: nothing the one before typed or chose is sent as theirs', async () => {
    const recording = { ...member, recording: true };
    readStatus.mockResolvedValueOnce(recording);
    const view = render(<SessionAgentModal {...OPTIONS} onClose={() => {}} />);
    const dialog = within(await screen.findByRole('dialog', { name: 'Session Agent' }));
    fireEvent.click(await dialog.findByRole('radio', { name: 'My address' }));
    fireEvent.change(dialog.getByLabelText('Name (optional)'), { target: { value: 'Sam' } });
    fireEvent.change(dialog.getByLabelText('Your question'), { target: { value: 'Sam’s own question' } });
    // Someone else signs in with the dialog open.
    readStatus.mockResolvedValueOnce(recording);
    view.rerender(<SessionAgentModal {...OPTIONS} account="0xdef" onClose={() => {}} />);
    expect(await dialog.findByRole('radio', { name: 'No address' })).toBeChecked();
    expect(dialog.getByLabelText('Name (optional)')).toHaveValue('');
    expect(dialog.getByLabelText('Your question')).toHaveValue('');
    ask.mockResolvedValueOnce({ ...reply('An answer.'), stored: true });
    askQuestion(dialog, 'Why?');
    await dialog.findByText('An answer.');
    expect(ask).toHaveBeenLastCalledWith(
      'Why?',
      { ...OPTIONS, account: '0xdef' },
      { attribution: 'anonymous', name: '' },
    );
  });

  it('gives someone signed in without an address no address to store', async () => {
    const { dialog } = await renderModal({ ...member, recording: true, unattributed: null });
    expect(dialog.getByRole('checkbox', { name: 'Store this chat' })).toBeChecked();
    expect(dialog.queryByRole('radio')).not.toBeInTheDocument();
    ask.mockResolvedValueOnce({ ...reply('An answer.'), stored: true });
    askQuestion(dialog, 'Why?');
    await dialog.findByText('An answer.');
    expect(ask).toHaveBeenLastCalledWith('Why?', OPTIONS, { attribution: 'anonymous', name: '' });
  });

  it('answers someone not signed in with General answers, and offers them no switches or address', async () => {
    readStatus.mockResolvedValue({ ...member, unattributed: null, recording: true, signedOut: true });
    render(<SessionAgentModal {...OPTIONS} account="" onClose={() => {}} />);
    const dialog = within(await screen.findByRole('dialog', { name: 'Session Agent' }));
    expect(await dialog.findByText('Not signed in, you get General answers.')).toBeInTheDocument();
    expect(readStatus).toHaveBeenCalledWith({ ...OPTIONS, account: '' });
    expect(dialog.queryByRole('switch')).not.toBeInTheDocument();
    // How it works stays a link away without the switches' "?".
    expect(dialog.getByRole('link', { name: 'How the Session Agent works' })).toHaveAttribute(
      'href',
      expect.stringMatching(/README\.md#session-agent$/),
    );
    // They may store a chat, with a name if they like, and never an address.
    expect(dialog.getByRole('checkbox', { name: 'Store this chat' })).toBeChecked();
    expect(dialog.queryByRole('radio')).not.toBeInTheDocument();
    fireEvent.change(dialog.getByLabelText('Name (optional)'), { target: { value: 'A visitor' } });
    ask.mockResolvedValueOnce({ ...reply('An answer.'), stored: true });
    askQuestion(dialog, 'Why?');
    await dialog.findByText('An answer.');
    expect(ask).toHaveBeenLastCalledWith(
      'Why?',
      { ...OPTIONS, account: '' },
      { attribution: 'anonymous', name: 'A visitor' },
    );
  });

  it('asks someone not signed in to sign in where the Session Agent won’t answer them as they are', async () => {
    readStatus.mockResolvedValue({ ...member, answers: null, audience: null, unattributed: null, signedOut: true });
    render(<SessionAgentModal {...OPTIONS} account="" onClose={() => {}} />);
    const dialog = within(await screen.findByRole('dialog', { name: 'Session Agent' }));
    expect(await dialog.findByText('Sign in to ask the Session Agent.')).toBeInTheDocument();
    expect(dialog.queryByLabelText('Your question')).not.toBeInTheDocument();
    expect(dialog.queryByRole('switch')).not.toBeInTheDocument();
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
