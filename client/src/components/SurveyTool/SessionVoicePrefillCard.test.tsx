import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import SessionVoicePrefillCard from './SessionVoicePrefillCard';
import { getInterviewCatalogTicket } from './interviewCatalogTicket';

jest.mock('./interviewCatalogTicket', () => ({
  ...jest.requireActual<object>('./interviewCatalogTicket'),
  getInterviewCatalogTicket: jest.fn(),
}));

const ticketMock = jest.mocked(getInterviewCatalogTicket);
const ACCOUNT = '0x0000000000000000000000000000000000000001';
const catalog = () =>
  new Response(
    JSON.stringify({
      type: 'context-engine.interview-question-catalog',
      version: 1,
      sessionSlug: 'demo',
      prefillPromptVersion: 'ce-interview-brief-v6',
    }),
  );
const signInRequired = () =>
  new Response(JSON.stringify({ error: 'Sign in.', reason: 'sign_in_required' }), { status: 401 });
const spyOnFetch = () => jest.spyOn(globalThis, 'fetch').mockImplementation(async () => catalog());
let fetchMock: ReturnType<typeof spyOnFetch>;
const writeText = jest.fn(async (_text: string) => undefined);

const renderCard = (account = ACCOUNT) =>
  render(
    <SessionVoicePrefillCard
      sessionSlug="demo"
      sessionConfig={{ slug: 'demo' }}
      context={account ? { account } : {}}
      workerUrl="https://worker.example"
    />,
  );
const copy = async () => {
  const button = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_COPY_AGENT_PROMPT);
  await waitFor(() => expect(button).toHaveAttribute('aria-disabled', 'false'));
  await act(async () => fireEvent.click(button));
  return writeText.mock.calls.at(-1)?.[0] || '';
};

beforeEach(() => {
  ticketMock.mockReset();
  writeText.mockClear();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  fetchMock = spyOnFetch();
});
afterEach(() => fetchMock.mockRestore());

it('gives a signed-in person’s AI a private catalog link, asking them to sign in once', async () => {
  ticketMock.mockResolvedValue({ ticket: 'ic1.mine', expiresAtMs: Date.now() + 60 * 60 * 1000 });
  renderCard();
  const prompt = await copy();
  expect(prompt).toContain('&ticket=ic1.mine');
  expect(prompt).toContain('The link is private to me');
  expect(ticketMock).toHaveBeenCalledWith(expect.objectContaining({ sessionSlug: 'demo', prompt: true, fresh: false }));
  // The check read the catalog the AI will read.
  expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('ticket')).toBe('ic1.mine');
});

it('still offers a signed-out visitor’s prompt when the person declines to sign in', async () => {
  ticketMock.mockRejectedValue(new Error('Declined'));
  renderCard();
  const prompt = await copy();
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
