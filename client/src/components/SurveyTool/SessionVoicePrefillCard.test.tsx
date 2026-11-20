import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import SessionVoicePrefillCard from './SessionVoicePrefillCard';
import { getInterviewCatalogTicket } from './interviewCatalogTicket';

jest.mock('./interviewCatalogTicket', () => ({
  ...jest.requireActual<object>('./interviewCatalogTicket'),
  getInterviewCatalogTicket: jest.fn(),
}));

const ticketMock = jest.mocked(getInterviewCatalogTicket);
// The card remembers whom it asked for as long as the page is open, so each test signs in as someone new.
let people = 0;
let ACCOUNT = '';
const catalog = (questionIds: string[] = []) =>
  new Response(
    JSON.stringify({
      type: 'context-engine.interview-question-catalog',
      version: 1,
      sessionSlug: 'demo',
      prefillPromptVersion: 'ce-interview-brief-v6',
      questions: questionIds.map((id) => ({ id, prompt: `${id}?`, type: 'freeform' })),
    }),
  );
const signInRequired = () =>
  new Response(JSON.stringify({ error: 'Sign in.', reason: 'sign_in_required' }), { status: 401 });
// A private session's Worker, which lists its questions only with a ticket.
const privateWorker = async (input: RequestInfo | URL) =>
  new URL(String(input)).searchParams.get('ticket')
    ? catalog()
    : new Response(JSON.stringify({ error: 'Invite.', reason: 'private_session_invite_required' }), { status: 403 });
const spyOnFetch = () => jest.spyOn(globalThis, 'fetch').mockImplementation(privateWorker);
let fetchMock: ReturnType<typeof spyOnFetch>;
const writeText = jest.fn(async (_text: string) => undefined);

const renderCard = (account = ACCOUNT, questionPool?: unknown[]) =>
  render(
    <SessionVoicePrefillCard
      sessionSlug="demo"
      sessionConfig={{ slug: 'demo' }}
      context={account ? { account } : {}}
      workerUrl="https://worker.example"
      questionPool={questionPool}
    />,
  );
const POOL = [
  { id: 'q1', prompt: 'q1?', type: 'freeform' },
  { id: 'q2', prompt: 'q2?', type: 'freeform' },
];
const copy = async () => {
  const button = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_COPY_AGENT_PROMPT);
  await waitFor(() => expect(button).toHaveAttribute('aria-disabled', 'false'));
  await act(async () => fireEvent.click(button));
  return writeText.mock.calls.at(-1)?.[0] || '';
};

beforeEach(() => {
  people += 1;
  ACCOUNT = `0x${String(people).padStart(40, '0')}`;
  ticketMock.mockReset();
  writeText.mockClear();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  fetchMock = spyOnFetch();
});
afterEach(() => fetchMock.mockRestore());

// The address a chat AI's fetch tool takes must stay short, so a ticket goes in only where it is needed.
it('gives a signed-in person on a public session a short address with no ticket, asking nothing', async () => {
  fetchMock.mockImplementation(async () => catalog(['q1', 'q2']));
  renderCard(ACCOUNT, POOL);
  const prompt = await copy();
  const address = prompt.match(/^https:\/\/worker\.example\/agent\/interview-catalog\S*$/m)?.[0] || '';
  expect(address).toBe(
    `https://worker.example/agent/interview-catalog?slug=demo&sessionUrl=${encodeURIComponent('http://localhost/')}`,
  );
  expect(address.length).toBeLessThan(200);
  expect(prompt).not.toContain('The link is private to me');
  expect(ticketMock).not.toHaveBeenCalled();
});

it('gives a signed-in person’s AI a private catalog link on a private session, asking them to sign in once', async () => {
  ticketMock.mockResolvedValue({ ticket: 'ic1.mine', expiresAtMs: Date.now() + 60 * 60 * 1000 });
  renderCard();
  const prompt = await copy();
  expect(prompt).toContain('&ticket=ic1.mine');
  expect(prompt).toContain('The link is private to me');
  expect(ticketMock).toHaveBeenCalledWith(expect.objectContaining({ sessionSlug: 'demo', prompt: true, fresh: false }));
  // The check read the catalog the AI will read, after the read without a ticket was refused.
  expect(fetchMock.mock.calls.map(([input]) => new URL(String(input)).searchParams.get('ticket'))).toEqual([
    null,
    'ic1.mine',
  ]);
});

it('asks for a ticket where the public catalog leaves out questions the person sees, as their group’s', async () => {
  fetchMock.mockImplementation(async (input) =>
    catalog(new URL(String(input)).searchParams.get('ticket') ? ['q1', 'q2'] : ['q1']),
  );
  ticketMock.mockResolvedValueOnce({ ticket: 'ic1.mine', expiresAtMs: Date.now() + 60 * 60 * 1000 });
  renderCard(ACCOUNT, POOL);
  expect(await copy()).toContain('&ticket=ic1.mine');
});

it('still offers a signed-out visitor’s prompt when the person declines to sign in', async () => {
  fetchMock.mockImplementation(async () => catalog(['q1']));
  ticketMock.mockRejectedValue(new Error('Declined'));
  renderCard(ACCOUNT, POOL);
  const prompt = await copy();
  expect(ticketMock).toHaveBeenCalled();
  expect(prompt).not.toContain('ticket=');
  expect(prompt).toContain('/agent/interview-catalog?slug=demo');
});

it('on a session that needs a sign-in, asks again only when the person presses Retry', async () => {
  ticketMock.mockRejectedValueOnce(new Error('Declined'));
  fetchMock.mockImplementation(async (input) =>
    new URL(String(input)).searchParams.get('ticket') ? catalog() : signInRequired(),
  );
  renderCard();
  expect(await screen.findByRole('alert')).toHaveTextContent('Press Retry to sign in, then copy the prompt.');
  expect(ticketMock).toHaveBeenLastCalledWith(expect.objectContaining({ prompt: true }));
  ticketMock.mockResolvedValueOnce({ ticket: 'ic1.after-retry', expiresAtMs: Date.now() + 60 * 60 * 1000 });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Retry' })));
  expect(ticketMock).toHaveBeenCalledTimes(2);
  expect(ticketMock).toHaveBeenLastCalledWith(expect.objectContaining({ prompt: true }));
  expect(await copy()).toContain('&ticket=ic1.after-retry');
});

it('asks only once wherever the card shows, as when Back brings it back', async () => {
  fetchMock.mockImplementation(async () => catalog(['q1']));
  ticketMock.mockRejectedValue(new Error('Declined'));
  const first = renderCard(ACCOUNT, POOL);
  await copy();
  expect(ticketMock).toHaveBeenLastCalledWith(expect.objectContaining({ prompt: true }));
  first.unmount();
  renderCard(ACCOUNT, POOL);
  await copy();
  expect(ticketMock).toHaveBeenCalledTimes(2);
  expect(ticketMock).toHaveBeenLastCalledWith(expect.objectContaining({ prompt: false }));
});

it('tells a signed-out visitor on such a session to log in', async () => {
  fetchMock.mockImplementation(async () => signInRequired());
  renderCard('');
  expect(await screen.findByRole('alert')).toHaveTextContent('Use Log in at the top of the page');
  expect(ticketMock).not.toHaveBeenCalled();
});

it('renews the private link quietly before it runs out', async () => {
  jest.useFakeTimers();
  try {
    const start = Date.now();
    ticketMock
      .mockResolvedValueOnce({ ticket: 'ic1.first', expiresAtMs: start + 11 * 60 * 1000 })
      .mockResolvedValueOnce({ ticket: 'ic1.second', expiresAtMs: start + 70 * 60 * 1000 });
    renderCard();
    await act(async () => {});
    expect(await copy()).toContain('&ticket=ic1.first');
    // Ten minutes before it ends, the link is renewed without asking to sign in.
    await act(async () => {
      jest.advanceTimersByTime(60 * 1000);
    });
    await act(async () => {});
    expect(ticketMock).toHaveBeenCalledTimes(2);
    expect(ticketMock).toHaveBeenLastCalledWith(expect.objectContaining({ prompt: false }));
    expect(await copy()).toContain('&ticket=ic1.second');
  } finally {
    jest.useRealTimers();
  }
});

it('keeps the prompt to copy by hand through a renewal, with the renewed link, without taking focus', async () => {
  jest.useFakeTimers();
  try {
    const start = Date.now();
    ticketMock
      .mockResolvedValueOnce({ ticket: 'ic1.first', expiresAtMs: start + 11 * 60 * 1000 })
      .mockResolvedValueOnce({ ticket: 'ic1.second', expiresAtMs: start + 70 * 60 * 1000 });
    writeText.mockRejectedValueOnce(new Error('denied'));
    renderCard();
    await act(async () => {});
    await copy();
    const field = await screen.findByRole<HTMLTextAreaElement>('textbox', {
      name: 'Memory augmentation prompt to copy',
    });
    expect(field.value).toContain('&ticket=ic1.first');
    expect(document.activeElement).toBe(field);
    const elsewhere = screen.getByRole('button', { name: 'Prompt' });
    elsewhere.focus();
    await act(async () => {
      jest.advanceTimersByTime(60 * 1000);
    });
    await act(async () => {});
    expect(ticketMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('textbox', { name: 'Memory augmentation prompt to copy' })).toBe(field);
    expect(field.value).toContain('&ticket=ic1.second');
    expect(document.activeElement).toBe(elsewhere);
  } finally {
    jest.useRealTimers();
  }
});

it('hides the prompt to copy by hand when its renewal check fails', async () => {
  jest.useFakeTimers();
  try {
    const start = Date.now();
    ticketMock
      .mockResolvedValueOnce({ ticket: 'ic1.first', expiresAtMs: start + 11 * 60 * 1000 })
      .mockResolvedValueOnce({ ticket: 'ic1.second', expiresAtMs: start + 70 * 60 * 1000 });
    writeText.mockRejectedValueOnce(new Error('denied'));
    renderCard();
    await act(async () => {});
    await copy();
    expect(await screen.findByRole('textbox', { name: 'Memory augmentation prompt to copy' })).toBeInTheDocument();
    fetchMock.mockImplementation(async () => signInRequired());
    await act(async () => {
      jest.advanceTimersByTime(60 * 1000);
    });
    await act(async () => {});
    expect(screen.getByText(/Could not check this session’s Worker/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Memory augmentation prompt to copy' })).toBeNull();
  } finally {
    jest.useRealTimers();
  }
});

it('renews a ticket cut short by the end of its sign-in only as it runs out', async () => {
  jest.useFakeTimers();
  try {
    const start = Date.now();
    ticketMock
      .mockResolvedValueOnce({ ticket: 'ic1.short', expiresAtMs: start + 5 * 60 * 1000 })
      .mockResolvedValueOnce({ ticket: 'ic1.next', expiresAtMs: start + 65 * 60 * 1000 });
    renderCard();
    await act(async () => {});
    expect(await copy()).toContain('&ticket=ic1.short');
    // Renewing sooner would only get the same short ticket again.
    await act(async () => {
      jest.advanceTimersByTime(4 * 60 * 1000);
    });
    await act(async () => {});
    expect(ticketMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(60 * 1000);
    });
    await act(async () => {});
    expect(ticketMock).toHaveBeenCalledTimes(2);
    expect(await copy()).toContain('&ticket=ic1.next');
  } finally {
    jest.useRealTimers();
  }
});

it('checks again rather than copy a link whose renewal a sleeping timer missed', async () => {
  jest.useFakeTimers();
  try {
    const start = Date.now();
    ticketMock
      .mockResolvedValueOnce({ ticket: 'ic1.before', expiresAtMs: start + 60 * 60 * 1000 })
      .mockResolvedValueOnce({ ticket: 'ic1.after', expiresAtMs: start + 3 * 60 * 60 * 1000 });
    renderCard();
    await act(async () => {});
    expect(await copy()).toContain('&ticket=ic1.before');
    // Two hours pass, as over a closed laptop, without the renewal timer firing.
    jest.setSystemTime(start + 2 * 60 * 60 * 1000);
    writeText.mockClear();
    await act(async () => fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_COPY_AGENT_PROMPT)));
    expect(writeText).not.toHaveBeenCalled();
    expect(await copy()).toContain('&ticket=ic1.after');
    expect(ticketMock).toHaveBeenLastCalledWith(expect.objectContaining({ prompt: false }));
  } finally {
    jest.useRealTimers();
  }
});
