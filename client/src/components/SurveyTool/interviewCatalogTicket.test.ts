import { fetchWorkerWithAuth } from '../../utilities/worker/workerAuth';
import { getInterviewCatalogTicket, INTERVIEW_CATALOG_TICKET_RENEW_MS } from './interviewCatalogTicket';

jest.mock('../../utilities/worker/workerAuth', () => ({ fetchWorkerWithAuth: jest.fn() }));

const fetchMock = jest.mocked(fetchWorkerWithAuth);
const NOW = Date.parse('2026-11-10T12:00:00.000Z');
const issued = (ticket: string, expiresAt: number) => new Response(JSON.stringify({ ticket, expiresAt }));
let session = 0;
const request = (overrides: Partial<Parameters<typeof getInterviewCatalogTicket>[0]> = {}) => ({
  workerUrl: 'https://worker.example.test/',
  sessionSlug: `demo-${session}`,
  sessionConfig: { slug: 'demo' },
  context: { account: '0xAbC0000000000000000000000000000000000001' },
  ...overrides,
});

beforeEach(() => {
  session += 1;
  fetchMock.mockReset();
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
});
afterEach(() => {
  jest.restoreAllMocks();
});

it('asks the Worker for a ticket as the signed-in person, and holds it while plenty is left', async () => {
  fetchMock.mockResolvedValueOnce(issued('ic1.first', NOW / 1000 + 3600));
  await expect(getInterviewCatalogTicket(request({ prompt: false }))).resolves.toEqual({
    ticket: 'ic1.first',
    expiresAtMs: NOW + 3600 * 1000,
  });
  expect(fetchMock).toHaveBeenCalledWith(
    'https://worker.example.test/agent/interview-catalog-ticket',
    { method: 'POST', cache: 'no-store' },
    expect.objectContaining({
      sessionSlug: `demo-${session}`,
      workerUrl: 'https://worker.example.test',
      prompt: false,
    }),
  );
  // The same person on the same session reuses it; letter case in the address doesn't matter.
  const again = await getInterviewCatalogTicket(
    request({ context: { account: '0xabc0000000000000000000000000000000000001' } }),
  );
  expect(again.ticket).toBe('ic1.first');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('renews a ticket with little left, and on request after the Worker refused it', async () => {
  fetchMock
    .mockResolvedValueOnce(issued('ic1.short', NOW / 1000 + INTERVIEW_CATALOG_TICKET_RENEW_MS / 1000))
    .mockResolvedValueOnce(issued('ic1.renewed', NOW / 1000 + 3600))
    .mockResolvedValueOnce(issued('ic1.fresh', NOW / 1000 + 3600));
  expect((await getInterviewCatalogTicket(request())).ticket).toBe('ic1.short');
  expect((await getInterviewCatalogTicket(request())).ticket).toBe('ic1.renewed');
  expect((await getInterviewCatalogTicket(request({ fresh: true }))).ticket).toBe('ic1.fresh');
  // Another account on the same session gets its own.
  fetchMock.mockResolvedValueOnce(issued('ic1.other', NOW / 1000 + 3600));
  const other = await getInterviewCatalogTicket(
    request({ context: { account: '0x0000000000000000000000000000000000000002' } }),
  );
  expect(other.ticket).toBe('ic1.other');
});

it('refuses anything but a current ticket', async () => {
  for (const response of [
    new Response(JSON.stringify({ error: 'No' }), { status: 403 }),
    issued('not-a-ticket', NOW / 1000 + 3600),
    issued('ic1.expired', NOW / 1000),
    new Response('not json'),
  ]) {
    fetchMock.mockResolvedValueOnce(response);
    await expect(getInterviewCatalogTicket(request())).rejects.toThrow('Could not get a private catalog link');
  }
});
