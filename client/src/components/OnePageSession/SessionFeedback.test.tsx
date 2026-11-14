import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import SessionFeedback from './SessionFeedback';
import { FOOTER_SESSION_ACTIONS_IDS } from '../Footer/Footer';
import {
  dictationOffered,
  feedbackOffered,
  feedbackView,
  sendFeedback,
} from '../../domains/worker/sessionFeedbackPorts';

jest.mock('../../domains/worker/sessionFeedbackPorts', () => ({
  FEEDBACK_TEXT_MAX: 2000,
  dictationOffered: jest.fn(),
  feedbackOffered: jest.fn(),
  sendFeedback: jest.fn(),
  feedbackView: jest.requireActual<typeof import('../../domains/worker/sessionFeedbackPorts')>(
    '../../domains/worker/sessionFeedbackPorts',
  ).feedbackView,
}));

// The recorder the answer field uses, as a test sets it; it counts its unmounts, which stop a real one.
const mockWhisper = {
  options: null as null | { sessionSlug: string; context: unknown; onTranscriptionComplete: (words: string) => void },
  state: {} as Record<string, unknown>,
  unmounts: 0,
};
jest.mock('../../utilities/useWhisper', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    RECORDING_STATUS: { PROCESSING: 'processing' },
    useWhisper: (options: typeof mockWhisper.options) => {
      mockWhisper.options = options;
      useEffect(
        () => () => {
          mockWhisper.unmounts += 1;
        },
        [],
      );
      return mockWhisper.state;
    },
  };
});

const offered = jest.mocked(feedbackOffered);
const speech = jest.mocked(dictationOffered);
const send = jest.mocked(sendFeedback);

const PROPS = { sessionSlug: 'salon', sessionConfig: { slug: 'salon' }, account: '0xabc', view: 'results:polis' };

const footerButton = () => screen.findByRole('button', { name: 'Feedback' });
const box = () => screen.getByLabelText('Your feedback');
const open = async () => {
  const button = await footerButton();
  // Not focused first: some browsers don't focus a clicked button, and focus must come back to it all the same.
  fireEvent.click(button);
  await screen.findByRole('dialog', { name: 'Feedback' });
  return button;
};
const renderOpen = async (props: Partial<React.ComponentProps<typeof SessionFeedback>> = {}) => {
  offered.mockResolvedValue(true);
  render(<SessionFeedback {...PROPS} {...props} />);
  return open();
};
const type = (text: string) => fireEvent.change(box(), { target: { value: text } });
const sendButton = () => screen.getByRole('button', { name: 'Send' });

describe('SessionFeedback', () => {
  // The site's footer, where the app puts the session's own controls.
  let slot: HTMLElement;
  beforeEach(() => {
    speech.mockResolvedValue(false);
    mockWhisper.options = null;
    mockWhisper.unmounts = 0;
    mockWhisper.state = {
      status: 'idle',
      isRecording: false,
      isProcessing: false,
      errorMessage: '',
      startRecording: jest.fn(),
      stopRecording: jest.fn(),
    };
    slot = document.createElement('div');
    slot.id = FOOTER_SESSION_ACTIONS_IDS[0];
    document.body.appendChild(slot);
  });
  afterEach(() => {
    slot.remove();
    jest.resetAllMocks();
  });

  it('puts a button in each of the footer’s places, of which the footer shows one', async () => {
    const taskbar = document.createElement('div');
    taskbar.id = FOOTER_SESSION_ACTIONS_IDS[1];
    document.body.appendChild(taskbar);
    try {
      offered.mockResolvedValue(true);
      render(<SessionFeedback {...PROPS} />);
      expect(await screen.findAllByRole('button', { name: 'Feedback' })).toHaveLength(2);
      expect(slot.querySelectorAll('button')).toHaveLength(1);
      expect(taskbar.querySelectorAll('button')).toHaveLength(1);
    } finally {
      taskbar.remove();
    }
  });

  it('puts nothing in the footer where feedback isn’t offered', async () => {
    offered.mockResolvedValue(false);
    render(<SessionFeedback {...PROPS} />);
    await act(async () => {});
    expect(offered).toHaveBeenCalledWith(expect.objectContaining({ sessionSlug: 'salon', account: '0xabc' }));
    expect(slot).toBeEmptyDOMElement();
  });

  it('puts nothing there, and asks no Worker, once the admins turn the Feedback box off', async () => {
    offered.mockResolvedValue(true);
    render(<SessionFeedback {...PROPS} sessionConfig={{ feedbackEnabled: false }} />);
    await act(async () => {});
    expect(offered).not.toHaveBeenCalled();
    expect(slot).toBeEmptyDOMElement();
  });

  it('opens from a footer button, says who reads it, and puts focus in the box', async () => {
    offered.mockResolvedValue(true);
    render(<SessionFeedback {...PROPS} />);
    const button = await footerButton();
    expect(slot).toContainElement(button);
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await open();
    expect(screen.getByRole('dialog', { name: 'Feedback' })).toHaveTextContent(
      'Tell this session’s admins what worked in the app and what didn’t. It never says who you are.',
    );
    await waitFor(() => expect(box()).toHaveFocus());
  });

  it('closes on Esc and on its ×, gives focus back to the button, and keeps what was typed', async () => {
    const button = await renderOpen();
    type('Half a thought');
    fireEvent.keyUp(screen.getByRole('dialog'), { key: 'Escape', keyCode: 27 });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(button).toHaveFocus());
    await open();
    expect(box()).toHaveValue('Half a thought');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(button).toHaveFocus());
  });

  it('sends what was typed with where they were, and thanks them', async () => {
    send.mockResolvedValue();
    await renderOpen();
    expect(sendButton()).toBeDisabled();
    type('  The map was hard to read.  ');
    fireEvent.click(sendButton());
    expect(await screen.findByText(/Thanks, it’s sent\./)).toBeInTheDocument();
    expect(send).toHaveBeenCalledTimes(1);
    const [draft, options] = send.mock.calls[0];
    expect(draft).toEqual({
      text: 'The map was hard to read.',
      view: 'results:polis',
      theme: expect.stringMatching(/^[a-z0-9-]+$/),
      screen: 'desktop',
    });
    // No release is built into a test run, and an empty one is left out rather than sent.
    expect(draft).not.toHaveProperty('appRelease');
    expect(options).toEqual(expect.objectContaining({ sessionSlug: 'salon', account: '0xabc' }));
    // Send took the button that had focus away: the thanks has it now, so it is read out.
    expect(screen.getByTestId('ce-session-feedback-sent')).toHaveFocus();
    // Send more starts again with an empty box, and puts focus in it.
    fireEvent.click(screen.getByRole('button', { name: 'Send more' }));
    expect(screen.getByLabelText('Your feedback')).toHaveValue('');
    await waitFor(() => expect(screen.getByLabelText('Your feedback')).toHaveFocus());
  });

  it('goes away when the admins turn the Feedback box off while the page is open, and stays shut', async () => {
    offered.mockResolvedValue(true);
    const { rerender } = render(<SessionFeedback {...PROPS} />);
    await open();
    rerender(<SessionFeedback {...PROPS} sessionConfig={{ slug: 'salon', feedbackEnabled: false }} />);
    await waitFor(() => expect(slot).toBeEmptyDOMElement());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // Turned on again, the button is back but the dialog doesn't open by itself.
    rerender(<SessionFeedback {...PROPS} />);
    await footerButton();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('reopens on the thanks after a send, so a screen reader reads it', async () => {
    send.mockResolvedValue();
    await renderOpen();
    type('Done.');
    fireEvent.click(sendButton());
    await screen.findByTestId('ce-session-feedback-sent');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await open();
    await waitFor(() => expect(screen.getByTestId('ce-session-feedback-sent')).toHaveFocus());
  });

  it('starts empty on another session: a draft is not carried to other admins', async () => {
    offered.mockResolvedValue(true);
    const { rerender } = render(<SessionFeedback {...PROPS} />);
    await open();
    type('Only for the salon’s admins.');
    rerender(<SessionFeedback {...PROPS} sessionSlug="another" />);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await open();
    expect(box()).toHaveValue('');
  });

  it('lets a visitor who isn’t signed in send too', async () => {
    send.mockResolvedValue();
    await renderOpen({ account: '' });
    type('I could not sign in.');
    fireEvent.click(sendButton());
    await waitFor(() => expect(send).toHaveBeenCalled());
    expect(send.mock.calls[0][1]).toEqual(expect.objectContaining({ account: '' }));
  });

  it('counts down from 2,000 and takes no more', async () => {
    await renderOpen();
    expect(screen.getByText('2,000 left')).toBeInTheDocument();
    type('x'.repeat(800));
    expect(screen.getByText('1,200 left')).toBeInTheDocument();
    expect(screen.getByLabelText('Your feedback')).toHaveAttribute('maxlength', '2000');
  });

  it('asks for no way to reach them: every message is sent without saying who wrote it', async () => {
    send.mockResolvedValue();
    await renderOpen();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    type('Please tell me when this is fixed.');
    fireEvent.click(sendButton());
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(send.mock.calls[0][0]).not.toHaveProperty('reachMe');
  });

  it('shows the Worker’s sentence when a message is refused, and keeps what was typed', async () => {
    send.mockRejectedValue(new Error('You’ve sent 5 today. Thanks! Try again tomorrow.'));
    await renderOpen();
    type('A sixth thought.');
    fireEvent.click(sendButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('You’ve sent 5 today. Thanks! Try again tomorrow.');
    expect(screen.getByLabelText('Your feedback')).toHaveValue('A sixth thought.');
    expect(sendButton()).toBeEnabled();
  });

  it('never sends an address as the view: links carry invites and prefills', async () => {
    send.mockResolvedValue();
    await renderOpen({ view: 'results:https://x.example/session/salon?joinGroup=g#groupInvite=secret' });
    type('Fine.');
    fireEvent.click(sendButton());
    await waitFor(() => expect(send).toHaveBeenCalled());
    const { view } = send.mock.calls[0][0];
    expect(view).toMatch(/^[A-Za-z0-9:_-]{1,80}$/);
    expect(view).not.toMatch(/[?#/=.]/);
    expect(feedbackView('')).toBe('session');
    expect(feedbackView('x'.repeat(200))).toHaveLength(80);
  });

  describe('speaking instead of typing', () => {
    const mic = () => screen.findByRole('button', { name: 'Start recording' });
    const words = (spoken: string) => act(() => mockWhisper.options?.onTranscriptionComplete(spoken));

    it('has no microphone, and no room for one, where the session doesn’t pay for AI', async () => {
      await renderOpen();
      await waitFor(() => expect(speech).toHaveBeenCalledWith(expect.objectContaining({ sessionSlug: 'salon' })));
      expect(screen.queryByTestId('ce-session-feedback-mic')).not.toBeInTheDocument();
      expect(mockWhisper.options).toBeNull();
    });

    it('asks only once the form opens, so a page that never opens it asks nothing', async () => {
      offered.mockResolvedValue(true);
      render(<SessionFeedback {...PROPS} />);
      await footerButton();
      expect(speech).not.toHaveBeenCalled();
    });

    it('records with the answer field’s recorder, for this session and person, from the keyboard', async () => {
      speech.mockResolvedValue(true);
      await renderOpen();
      const button = await mic();
      expect(button).toHaveAttribute('aria-pressed', 'false');
      expect(mockWhisper.options).toEqual(
        expect.objectContaining({ sessionSlug: 'salon', context: { account: '0xabc' } }),
      );
      fireEvent.click(button);
      expect(mockWhisper.state.startRecording).toHaveBeenCalledTimes(1);
    });

    it('says it is recording, and stops on a second press', async () => {
      speech.mockResolvedValue(true);
      mockWhisper.state = { ...mockWhisper.state, isRecording: true };
      await renderOpen();
      const button = await screen.findByRole('button', { name: 'Stop recording' });
      expect(button).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText('Recording…')).toBeInTheDocument();
      type('Typed first.');
      expect(sendButton()).toBeDisabled();
      fireEvent.click(button);
      expect(mockWhisper.state.stopRecording).toHaveBeenCalledTimes(1);
    });

    it('waits while the words are written down, keeping focus on the microphone and Send held', async () => {
      speech.mockResolvedValue(true);
      mockWhisper.state = { ...mockWhisper.state, status: 'processing', isProcessing: true };
      await renderOpen();
      type('Typed first.');
      const button = await mic();
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByText('Processing audio…')).toBeInTheDocument();
      // Still focusable, so the keyboard stays in the dialog; a press does nothing.
      button.focus();
      expect(button).toHaveFocus();
      fireEvent.click(button);
      expect(mockWhisper.state.startRecording).not.toHaveBeenCalled();
      // Sending now would lose the words being written down.
      expect(sendButton()).toBeDisabled();
    });

    it('adds the words to the end of the message, to edit and send as typed text', async () => {
      speech.mockResolvedValue(true);
      send.mockResolvedValue();
      await renderOpen();
      await mic();
      type('The map  ');
      words('  was hard to read. ');
      expect(box()).toHaveValue('The map was hard to read.');
      expect(screen.getByText('1,975 left')).toBeInTheDocument();
      // Nothing goes to the admins until Send.
      expect(send).not.toHaveBeenCalled();
      type('The map was hard to read on a phone.');
      fireEvent.click(sendButton());
      await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
      expect(send.mock.calls[0][0].text).toBe('The map was hard to read on a phone.');
    });

    it('keeps to 2,000 characters and says when the end didn’t fit', async () => {
      speech.mockResolvedValue(true);
      await renderOpen();
      await mic();
      type('x'.repeat(1995));
      words('abcdefghij');
      expect(box()).toHaveValue(`${'x'.repeat(1995)} abcd`);
      expect(screen.getByText('0 left')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('The end of what you said didn’t fit in 2,000 characters.');
      type('Shorter now.');
      expect(screen.queryByText(/didn’t fit/)).not.toBeInTheDocument();
    });

    it('says what the answer field’s microphone says when the words can’t be written down', async () => {
      speech.mockResolvedValue(true);
      // The recorder's own sentence for a refusal, a limit or a busy Worker, which it doesn't quote.
      mockWhisper.state = { ...mockWhisper.state, errorMessage: 'Couldn’t transcribe the recording. Try again.' };
      await renderOpen();
      expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t transcribe the recording. Try again.');
    });

    it('lets Send go again after the dialog closed mid-recording', async () => {
      speech.mockResolvedValue(true);
      mockWhisper.state = { ...mockWhisper.state, isRecording: true };
      await renderOpen();
      type('Before the close.');
      await screen.findByRole('button', { name: 'Stop recording' });
      expect(sendButton()).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      // Closing stopped the recorder, so it is idle when the dialog opens again.
      mockWhisper.state = { ...mockWhisper.state, isRecording: false };
      await open();
      await mic();
      expect(sendButton()).toBeEnabled();
    });

    it('stops recording when the dialog closes, and keeps what was written', async () => {
      speech.mockResolvedValue(true);
      await renderOpen();
      await mic();
      words('Half a thought.');
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(mockWhisper.unmounts).toBe(1);
      await open();
      expect(box()).toHaveValue('Half a thought.');
      // Asked once: the answer holds while the page is open.
      expect(speech).toHaveBeenCalledTimes(1);
    });
  });

  it('links nowhere else: the form is the only way out of the dialog', async () => {
    await renderOpen();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
