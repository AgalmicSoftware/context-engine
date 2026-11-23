import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import SessionVoicePrefillCard from './SessionVoicePrefillCard';
import { getInterviewCatalogTicket } from './interviewCatalogTicket';
import { getWorkerSessionToken } from '../../utilities/worker/workerAuth';
import { QUIET_RETRY_DELAYS_MS, QUIET_TRY_TIMEOUT_MS } from '../../utilities/session/useAgentKey';

jest.mock('../../utilities/worker/workerAuth', () => ({
  ...jest.requireActual<object>('../../utilities/worker/workerAuth'),
  getWorkerSessionToken: jest.fn(),
}));
jest.mock('../../utilities/worker/corsProxy.js', () => ({
  ...jest.requireActual<object>('../../utilities/worker/corsProxy.js'),
  // Only a card given no Worker address looks one up; here that lookup never ends.
  getCorsProxyUrlOrThrow: jest.fn(() => new Promise<string>(() => undefined)),
}));
jest.mock('./interviewCatalogTicket', () => ({
  ...jest.requireActual<object>('./interviewCatalogTicket'),
  getInterviewCatalogTicket: jest.fn(),
}));

const ticketMock = jest.mocked(getInterviewCatalogTicket);
const tokenMock = jest.mocked(getWorkerSessionToken);
// The card remembers whom it asked for as long as the page is open, so each test signs in as someone new.
let people = 0;
let ACCOUNT = '';
// A session always lists something: a prompt is only given with its question ids.
const catalog = (questionIds: string[] = ['listed']) =>
  new Response(
    JSON.stringify({
      type: 'context-engine.interview-question-catalog',
      version: 1,
      sessionSlug: 'demo',
      prefillPromptVersion: 'ce-interview-brief-v6',
      questionSetHash: 'f'.repeat(64),
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

// A quiet try for the key that fails is not tried again here.
const RETRY_DELAYS = [...QUIET_RETRY_DELAYS_MS];
afterAll(() => void QUIET_RETRY_DELAYS_MS.splice(0, QUIET_RETRY_DELAYS_MS.length, ...RETRY_DELAYS));
beforeEach(() => {
  QUIET_RETRY_DELAYS_MS.length = 0;
  people += 1;
  ACCOUNT = `0x${String(people).padStart(40, '0')}`;
  ticketMock.mockReset();
  writeText.mockClear();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  fetchMock = spyOnFetch();
});
afterEach(() => fetchMock.mockRestore());

// The address a chat AI's fetch tool takes must stay short, so a ticket goes in only where it is needed.
it('always carries the session’s question ids in the copied prompt, as the session lists them, whatever this page has loaded', async () => {
  const whole = {
    type: 'context-engine.interview-question-catalog',
    version: 1,
    sessionSlug: 'demo',
    reviewUrl: 'https://app.example/session/demo?mode=interview',
    questionSetHash: 'c'.repeat(64),
    prefillPromptVersion: 'ce-interview-brief-v6',
    questions: [
      { id: 'q1', prompt: 'Parks need more money.', type: 'binary', options: ['Agree', 'Disagree'] },
      { id: 'q2', prompt: 'Why?', type: 'freeform' },
    ],
  };
  fetchMock.mockImplementation(async () => new Response(JSON.stringify(whole)));
  // The page's own question pool is still empty, as before its questions load.
  renderCard('', []);
  const prompt = await copy();
  expect(prompt).toContain('\nQuestion ids: 1 q1 binary, 2 q2 freeform\n');
  expect(prompt).toContain(
    `questionSetHash "${'c'.repeat(64)}", prefillPromptVersion "ce-interview-brief-v6", 2 questions.`,
  );
  // An empty list would read as nothing left to answer.
  expect(prompt).not.toMatch(/: \[\]/);
  // Opened to read, the ids and the fingerprint are stand-ins.
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT_TOGGLE));
  const box = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT);
  expect(box).toHaveTextContent('Question ids: <QuestionIds>');
  expect(box).toHaveTextContent('questionSetHash <QuestionSetHash>');
});

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
      name: 'AI prompt to copy',
    });
    expect(field.value).toContain('&ticket=ic1.first');
    expect(document.activeElement).toBe(field);
    const elsewhere = screen.getByRole('button', { name: 'Read the AI prompt' });
    elsewhere.focus();
    await act(async () => {
      jest.advanceTimersByTime(60 * 1000);
    });
    await act(async () => {});
    expect(ticketMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('textbox', { name: 'AI prompt to copy' })).toBe(field);
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
    expect(await screen.findByRole('textbox', { name: 'AI prompt to copy' })).toBeInTheDocument();
    fetchMock.mockImplementation(async () => signInRequired());
    await act(async () => {
      jest.advanceTimersByTime(60 * 1000);
    });
    await act(async () => {});
    expect(screen.getByText(/Could not check this session’s Worker/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'AI prompt to copy' })).toBeNull();
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

describe('the AI key in a signed-in person’s prompt', () => {
  const AGENT_SESSION = {
    slug: 'demo',
    sessionName: 'Demo "one"',
    sessionModeProfile: { authority: { mode: 'worker_canonical' }, surfaces: { agentHttp: true } },
  };
  const KEY = 'ceagt_abcdefghijklmnopqrstuvwx';
  const KEY_LINE = `The key is ${KEY};`;
  const delegate = (submitAnswers = true) =>
    new Response(
      JSON.stringify({
        ok: true,
        token: KEY,
        expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        sessionSlug: 'demo',
        submitAnswers,
      }),
    );
  const renderAgentCard = (account = ACCOUNT, workerUrl = 'https://worker.example') =>
    render(
      <SessionVoicePrefillCard
        sessionSlug="demo"
        sessionConfig={AGENT_SESSION}
        context={account ? { account } : {}}
        workerUrl={workerUrl}
      />,
    );
  const canSubmit = () => screen.getByRole('checkbox', { name: 'AI can submit for me' });
  const keyRequests = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('/credentials/delegate'));
  const serve = (submitAnswers = true) =>
    fetchMock.mockImplementation(async (input) =>
      String(input).endsWith('/api/agent/credentials/delegate') ? delegate(submitAnswers) : catalog(),
    );
  beforeEach(() => {
    tokenMock.mockReset();
    tokenMock.mockResolvedValue('session-token');
  });

  it('offers no tick, and asks for no key, where the session gives no AI keys', async () => {
    fetchMock.mockImplementation(async () => catalog());
    renderCard();
    await copy();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(keyRequests()).toHaveLength(0);
  });

  it('starts with "AI can submit for me" unticked: no key is made or copied until the person ticks it', async () => {
    serve();
    renderAgentCard();
    expect(canSubmit()).not.toBeChecked();
    const draft = await copy();
    expect(draft).not.toContain('ceagt_');
    expect(draft).toContain('This prompt holds no AI key, so draft.');
    expect(keyRequests()).toHaveLength(0);
    expect(tokenMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_VOICE_PREFILL_KEY_NOTE)).not.toBeInTheDocument();

    // Ticked, the key is asked of the session's Worker with the page's sign-in, asking the person nothing.
    fireEvent.click(canSubmit());
    const prompt = await copy();
    expect(tokenMock).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: false, workerUrl: 'https://worker.example' }),
    );
    const [[url, init]] = keyRequests();
    expect(url).toBe('https://worker.example/api/agent/credentials/delegate');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer session-token');
    // While the box is ticked and the prompt holds the key, the line under the box says so, with its end time.
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_VOICE_PREFILL_KEY_NOTE)).toHaveTextContent(
      /^The prompt holds your AI key, for this session only, until \d/,
    );
    expect(prompt).toContain(KEY_LINE);
    expect(prompt).toContain('submit them as me only after I say yes here');
    // It names its session, and still says how to draft.
    expect(prompt).toContain('It is only for the session "Demo \\"one\\"" at ');
    expect(prompt).toContain('/agent/interview-catalog?slug=demo');
    // Opened to read, the key is a stand-in.
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT_TOGGLE));
    const shown = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT);
    expect(shown).toHaveTextContent('The key is <AIKey>;');
    expect(shown).toHaveTextContent('until <KeyEnds>.');
    expect(shown).not.toHaveTextContent(KEY);

    // Unticked again, the key leaves the prompt. The line stays, since the key that was copied still works.
    fireEvent.click(canSubmit());
    expect(await copy()).not.toContain('ceagt_');
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_VOICE_PREFILL_KEY_NOTE)).toHaveTextContent(
      /^Key can answer as you until /,
    );
    expect(keyRequests()).toHaveLength(1);
    // The page kept no key: ticked again, it asks for a new one.
    fireEvent.click(canSubmit());
    expect(await copy()).toContain(KEY_LINE);
    expect(keyRequests()).toHaveLength(2);
    expect(canSubmit()).toHaveAccessibleDescription(
      'If checked, the prompt can hold a key and the AI can act on your behalf.',
    );
  });

  it('takes no key that arrives after the box is unticked again', async () => {
    let release: (response: Response) => void = () => {};
    fetchMock.mockImplementation(async (input) =>
      String(input).endsWith('/api/agent/credentials/delegate')
        ? new Promise<Response>((done) => (release = done))
        : catalog(),
    );
    renderAgentCard();
    fireEvent.click(canSubmit());
    await waitFor(() => expect(keyRequests()).toHaveLength(1));
    fireEvent.click(canSubmit());
    await act(async () => release(delegate()));
    expect(await copy()).not.toContain('ceagt_');
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_VOICE_PREFILL_KEY_NOTE)).not.toBeInTheDocument();
  });

  it('signed out, gives a prompt without a key and nothing to tick', async () => {
    serve();
    renderAgentCard('');
    expect(await copy()).toContain('\nThis prompt holds no AI key. If you have Context Engine tools');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(keyRequests()).toHaveLength(0);
    expect(tokenMock).not.toHaveBeenCalled();
  });

  it('keeps the key out where the session lets no AI submit', async () => {
    serve(false);
    renderAgentCard();
    fireEvent.click(canSubmit());
    await waitFor(() => expect(keyRequests()).toHaveLength(1));
    expect(await copy()).not.toContain('ceagt_');
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_VOICE_PREFILL_KEY_NOTE)).not.toBeInTheDocument();
    // The box is ticked and the prompt has no key: the card says why, and offers nothing to press.
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_VOICE_PREFILL_KEY_MISSING)).toHaveTextContent(
      'This session lets an AI draft only, so the prompt has no key.',
    );
    expect(screen.queryByRole('button', { name: 'Add my AI key' })).not.toBeInTheDocument();
  });

  it('gives the prompt without a key where the key needs a fresh sign-in to the session, and says so', async () => {
    serve();
    tokenMock.mockRejectedValue(new Error('sign in needed'));
    renderAgentCard();
    fireEvent.click(canSubmit());
    const without = await copy();
    expect(without).not.toContain('ceagt_');
    expect(without).toContain(
      'If I want you to submit as me, I can copy the prompt again in the session with "AI can submit for me" ticked',
    );
    expect(tokenMock).toHaveBeenCalledTimes(1);
    expect(tokenMock).toHaveBeenCalledWith(expect.objectContaining({ prompt: false }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_VOICE_PREFILL_KEY_NOTE)).not.toBeInTheDocument();
    // No signing prompt was raised: the card says the prompt has no key, and one tap adds it.
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_VOICE_PREFILL_KEY_MISSING)).toHaveTextContent(
      'The prompt has no AI key yet.',
    );
    tokenMock.mockResolvedValue('session-token');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Add my AI key' })));
    expect(tokenMock).toHaveBeenLastCalledWith(expect.objectContaining({ prompt: true }));
    expect(await copy()).toContain(KEY_LINE);
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_VOICE_PREFILL_KEY_MISSING)).not.toBeInTheDocument();
  });

  it('says what went wrong when asking for the key fails too, and keeps the button', async () => {
    fetchMock.mockImplementation(async (input) =>
      String(input).endsWith('/api/agent/credentials/delegate')
        ? new Response(JSON.stringify({ ok: false, reason: 'agent_http_disabled' }), { status: 403 })
        : catalog(),
    );
    renderAgentCard();
    fireEvent.click(canSubmit());
    // Found first: a search inside act() never sees the card settle.
    const add = await screen.findByRole('button', { name: 'Add my AI key' });
    await act(async () => fireEvent.click(add));
    expect(await screen.findByTestId(E2E_TESTIDS.SESSION_VOICE_PREFILL_KEY_MISSING)).toHaveTextContent(
      'Agents (HTTP API) are off in this session.',
    );
    expect(screen.getByRole('button', { name: 'Add my AI key' })).toBeInTheDocument();
    expect(await copy()).not.toContain('ceagt_');
  });

  it('gives up on a key request that never answers, and says the prompt has no key', async () => {
    jest.useFakeTimers();
    try {
      fetchMock.mockImplementation(async (input) =>
        String(input).endsWith('/api/agent/credentials/delegate') ? new Promise<Response>(() => undefined) : catalog(),
      );
      // With the retries a failed try gets: a try that got no answer is still the last one.
      QUIET_RETRY_DELAYS_MS.push(...RETRY_DELAYS);
      renderAgentCard();
      fireEvent.click(canSubmit());
      await act(async () => undefined);
      expect(screen.getByText('Adding your AI key…')).toBeInTheDocument();
      await act(async () => void jest.advanceTimersByTime(QUIET_TRY_TIMEOUT_MS + 1));
      await act(async () => undefined);
      expect(screen.getByTestId(E2E_TESTIDS.SESSION_VOICE_PREFILL_KEY_MISSING)).toHaveTextContent(
        'The prompt has no AI key yet.',
      );
      expect(screen.queryByText('Adding your AI key…')).not.toBeInTheDocument();
      // No second try, however long the card stays open.
      await act(async () => void jest.advanceTimersByTime(60000));
      expect(keyRequests()).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows nothing, and asks for no key, until the session’s Worker is found', async () => {
    serve();
    // No Worker address given: the card looks it up, and the key could only be asked of that Worker.
    renderAgentCard(ACCOUNT, '');
    await act(async () => undefined);
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_COPY_AGENT_PROMPT)).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(tokenMock).not.toHaveBeenCalled();
  });

  it('holds the copy while the key is made', async () => {
    let release: (response: Response) => void = () => {};
    fetchMock.mockImplementation(async (input) =>
      String(input).endsWith('/api/agent/credentials/delegate')
        ? new Promise<Response>((done) => (release = done))
        : catalog(),
    );
    renderAgentCard();
    fireEvent.click(canSubmit());
    expect(await screen.findByText('Adding your AI key…')).toBeInTheDocument();
    const button = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_COPY_AGENT_PROMPT);
    expect(button).toHaveAttribute('aria-disabled', 'true');
    // Read out only, until a tap finds it cannot copy yet: then it is on screen, saying what to do.
    expect(screen.getByText('Adding your AI key…')).toHaveClass('sessionListeningSrOnly');
    await act(async () => fireEvent.click(button));
    expect(writeText).not.toHaveBeenCalled();
    const waiting = screen.getByText('Adding your AI key… Tap Copy again when this finishes.');
    expect(waiting.closest('[role="status"]')).not.toHaveClass('sessionListeningSrOnly');
    await act(async () => release(delegate()));
    expect(screen.queryByText(/Tap Copy again/)).not.toBeInTheDocument();
    expect(await copy()).toContain(KEY_LINE);
  });

  it('copies nothing by hand while the key is still being added, and says what it waits for', async () => {
    serve();
    renderAgentCard();
    // The prompt is opened before the box is ticked, so it is on screen while the key is made.
    await copy();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT_TOGGLE));
    let release: (response: Response) => void = () => {};
    fetchMock.mockImplementation(async (input) =>
      String(input).endsWith('/api/agent/credentials/delegate')
        ? new Promise<Response>((done) => (release = done))
        : catalog(),
    );
    fireEvent.click(canSubmit());
    expect(await screen.findByText('Adding your AI key…')).toBeInTheDocument();
    const box = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT);
    const setData = jest.fn();
    window.getSelection()?.selectAllChildren(box);
    expect(fireEvent.copy(box, { clipboardData: { setData } })).toBe(false);
    // Nothing of the prompt: it is about to change.
    expect(setData).toHaveBeenCalledWith('text/plain', '');
    expect(screen.getByText('Adding your AI key… Tap Copy again when this finishes.')).toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_VOICE_PREFILL_KEY_NOTE)).not.toBeInTheDocument();
    await act(async () => release(delegate()));
  });

  it('gives up on a key the person asked for when the Worker never answers', async () => {
    jest.useFakeTimers();
    try {
      tokenMock.mockRejectedValueOnce(new Error('sign in needed'));
      // Answers only by failing when the page gives up on it.
      fetchMock.mockImplementation(async (input, init) =>
        String(input).endsWith('/api/agent/credentials/delegate')
          ? new Promise<Response>((_, reject) => {
              init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
            })
          : catalog(),
      );
      renderAgentCard();
      fireEvent.click(canSubmit());
      await act(async () => undefined);
      await act(async () => undefined);
      const add = screen.getByRole('button', { name: 'Add my AI key' });
      await act(async () => fireEvent.click(add));
      expect(screen.getByText('Adding your AI key…')).toBeInTheDocument();
      await act(async () => void jest.advanceTimersByTime(15001));
      await act(async () => undefined);
      expect(screen.getByRole('alert')).toHaveTextContent('the session did not answer in time');
      expect(screen.getByRole('button', { name: 'Add my AI key' })).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it('copies the prompt itself, key included, when text is selected in the opened prompt and copied by hand', async () => {
    serve();
    renderAgentCard();
    fireEvent.click(canSubmit());
    await waitFor(() => expect(keyRequests()).toHaveLength(1));
    await waitFor(() =>
      expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_COPY_AGENT_PROMPT)).toHaveAttribute(
        'aria-disabled',
        'false',
      ),
    );
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT_TOGGLE));
    const box = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT);
    // On screen the key is a stand-in, which is what a selection would hold.
    expect(box).toHaveTextContent('The key is <AIKey>;');
    expect(box).not.toHaveTextContent(KEY);
    const setData = jest.fn();
    window.getSelection()?.selectAllChildren(box);
    const copied = fireEvent.copy(box, { clipboardData: { setData } });
    // The page's own copy took its place.
    expect(copied).toBe(false);
    expect(setData).toHaveBeenCalledTimes(1);
    expect(setData.mock.calls[0][0]).toBe('text/plain');
    expect(setData.mock.calls[0][1]).toContain(KEY_LINE);
    expect(setData.mock.calls[0][1]).not.toContain('<AIKey>');
    // A key that left the page by hand is said to have, as one copied by the button is, once the box is unticked.
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_VOICE_PREFILL_KEY_NOTE)).toHaveTextContent(
      /^The prompt holds your AI key, for this session only, until /,
    );
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_VOICE_PREFILL_CAN_SUBMIT));
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_VOICE_PREFILL_KEY_NOTE)).toHaveTextContent(
      /^Key can answer as you until /,
    );
  });

  it('drops the key at Sign Agents Out without making another, and starts another account on drafting only', async () => {
    serve();
    const view = renderAgentCard();
    fireEvent.click(canSubmit());
    expect(await copy()).toContain(KEY_LINE);
    expect(keyRequests()).toHaveLength(1);
    // The key in the prompt is dead: it goes, and nothing asks for another while the card stays as it is.
    act(() => void window.dispatchEvent(new Event('ce-agents-signed-out')));
    expect(await copy()).not.toContain('ceagt_');
    // The copied key is dead too, so the line goes, and the box is back where it starts: unticked.
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_VOICE_PREFILL_KEY_NOTE)).not.toBeInTheDocument();
    expect(canSubmit()).not.toBeChecked();
    expect(keyRequests()).toHaveLength(1);
    fireEvent.click(canSubmit());
    expect(await copy()).toContain(KEY_LINE);
    expect(keyRequests()).toHaveLength(2);

    view.rerender(
      <SessionVoicePrefillCard
        sessionSlug="demo"
        sessionConfig={AGENT_SESSION}
        context={{ account: `0x${'9'.repeat(40)}` }}
        workerUrl="https://worker.example"
      />,
    );
    // Another person starts where everyone does: drafting only, with no key asked for.
    await waitFor(() => expect(canSubmit()).not.toBeChecked());
    expect(await copy()).not.toContain('ceagt_');
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_VOICE_PREFILL_KEY_NOTE)).not.toBeInTheDocument();
    expect(keyRequests()).toHaveLength(2);
  });
});
