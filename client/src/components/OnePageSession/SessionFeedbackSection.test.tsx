import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import SessionFeedbackSection from './SessionFeedbackSection';
import { feedbackOffered, feedbackView, sendFeedback } from '../../domains/worker/sessionFeedbackPorts';

jest.mock('../../domains/worker/sessionFeedbackPorts', () => ({
  FEEDBACK_TEXT_MAX: 2000,
  feedbackOffered: jest.fn(),
  sendFeedback: jest.fn(),
  feedbackView: jest.requireActual<typeof import('../../domains/worker/sessionFeedbackPorts')>(
    '../../domains/worker/sessionFeedbackPorts',
  ).feedbackView,
}));

const offered = jest.mocked(feedbackOffered);
const send = jest.mocked(sendFeedback);

const PROPS = { sessionSlug: 'salon', sessionConfig: { slug: 'salon' }, account: '0xabc', view: 'results:polis' };

const renderOpen = async (props: Partial<React.ComponentProps<typeof SessionFeedbackSection>> = {}) => {
  offered.mockResolvedValue(true);
  render(<SessionFeedbackSection {...PROPS} {...props} />);
  const toggle = await screen.findByRole('button', { name: 'Feedback' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
};
const type = (text: string) => fireEvent.change(screen.getByLabelText('Your feedback'), { target: { value: text } });
const sendButton = () => screen.getByRole('button', { name: 'Send' });

describe('SessionFeedbackSection', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('shows nothing where feedback isn’t offered', async () => {
    offered.mockResolvedValue(false);
    const { container } = render(<SessionFeedbackSection {...PROPS} />);
    await act(async () => {});
    expect(offered).toHaveBeenCalledWith(expect.objectContaining({ sessionSlug: 'salon', account: '0xabc' }));
    expect(container).toBeEmptyDOMElement();
  });

  it('shows nothing, and asks no Worker, once the admins turn the Feedback box off', async () => {
    offered.mockResolvedValue(true);
    const { container } = render(<SessionFeedbackSection {...PROPS} sessionConfig={{ feedbackEnabled: false }} />);
    await act(async () => {});
    expect(offered).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it('starts closed, and says who reads it', async () => {
    offered.mockResolvedValue(true);
    render(<SessionFeedbackSection {...PROPS} />);
    // The heading and the section are named "Feedback" alone: the "?" and its text sit beside the heading.
    expect(await screen.findByRole('heading', { name: 'Feedback' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Feedback' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Your feedback')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About feedback' })).toHaveAccessibleDescription(
      /goes to this session’s admins without saying who you are, and isn’t part of anyone’s answers/,
    );
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

  it('goes away when the admins turn the Feedback box off while the page is open', async () => {
    offered.mockResolvedValue(true);
    const { rerender, container } = render(<SessionFeedbackSection {...PROPS} />);
    expect(await screen.findByRole('heading', { name: 'Feedback' })).toBeInTheDocument();
    rerender(<SessionFeedbackSection {...PROPS} sessionConfig={{ slug: 'salon', feedbackEnabled: false }} />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('starts empty on another session: a draft is not carried to other admins', async () => {
    offered.mockResolvedValue(true);
    const { rerender } = render(<SessionFeedbackSection {...PROPS} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Feedback' }));
    type('Only for the salon’s admins.');
    rerender(<SessionFeedbackSection {...PROPS} sessionSlug="another" />);
    const toggle = await screen.findByRole('button', { name: 'Feedback' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(screen.getByLabelText('Your feedback')).toHaveValue('');
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

  it('points ideas for everyone to GitHub', async () => {
    await renderOpen();
    expect(screen.getByRole('link', { name: 'Suggest them on GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/AgalmicSoftware/context-engine/issues/new',
    );
  });
});
