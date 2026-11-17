import {
  normalizeSessionName,
  resolveSessionNamesSource,
  sessionNameLabels,
  subscribeSessionNames,
  SESSION_NAMES_FEATURE,
} from './sessionNames';
import { getUsableSessionWorkerUrl } from './sessionWorkerAvailability';
import { readWorkerCapabilities } from '../worker/workerCapabilities';
import { fetchWorkerWithAuth, getCachedWorkerSessionToken } from '../worker/workerAuth';

jest.mock('./sessionWorkerAvailability', () => ({ getUsableSessionWorkerUrl: jest.fn() }));
jest.mock('../worker/workerCapabilities', () => ({ readWorkerCapabilities: jest.fn() }));
jest.mock('../worker/workerAuth', () => ({ fetchWorkerWithAuth: jest.fn(), getCachedWorkerSessionToken: jest.fn() }));
jest.mock('../worker/workerGroupReadProof', () => ({ groupReadHeaders: () => ({}) }));

const WORKER = 'https://names.worker.test';
const A = '0x00000000000000000000000000000000000000aa';
const B = '0x00000000000000000000000000000000000000bb';
const C = '0x00000000000000000000000000000000000000cc';
const options = (account = '') => ({ sessionSlug: 'names-session', sessionConfig: {}, account });
const json = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as unknown as Response;

let fetchMock: jest.Mock<Promise<Response>, [string, RequestInit]>;
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getUsableSessionWorkerUrl).mockReturnValue(`${WORKER}/`);
  jest.mocked(readWorkerCapabilities).mockResolvedValue({ legacy: false, features: [SESSION_NAMES_FEATURE] });
  jest.mocked(getCachedWorkerSessionToken).mockResolvedValue('');
  fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
});

it('keeps the short address beside a name two people share', () => {
  expect(sessionNameLabels({ [A]: 'Sam', [B]: 'sam', [C]: 'Ada' })).toEqual({
    [A]: 'Sam · 0x000…00aa',
    [B]: 'sam · 0x000…00bb',
    [C]: 'Ada',
  });
});

it('has no source for an on-chain session or a Worker from before names', async () => {
  jest.mocked(getUsableSessionWorkerUrl).mockReturnValueOnce('');
  expect(await resolveSessionNamesSource(options())).toBeNull();
  expect(readWorkerCapabilities).not.toHaveBeenCalled();

  jest.mocked(readWorkerCapabilities).mockResolvedValueOnce({ legacy: false, features: ['worker_groups'] });
  expect(await resolveSessionNamesSource(options())).toBeNull();
});

it("shows and sets no names once the session's admins turn them off", async () => {
  const source = await resolveSessionNamesSource({ ...options(A), sessionConfig: { namesEnabled: false } });
  expect(source?.enabled).toBe(false);
  expect(await source?.readAll()).toEqual({});
  await expect(source?.setOwn('Sam')).rejects.toThrow('Names are off in this session.');
  expect(fetchMock).not.toHaveBeenCalled();
  expect(fetchWorkerWithAuth).not.toHaveBeenCalled();
});

it('reads names with a held sign-in, never starting one, and shares one read between views', async () => {
  jest.mocked(getCachedWorkerSessionToken).mockResolvedValue('held-token');
  fetchMock.mockResolvedValue(json({ names: { [A.toUpperCase().replace('0X', '0x')]: 'Sam', [B]: '' } }));
  const source = await resolveSessionNamesSource(options(A));

  expect(await source?.readAll()).toEqual({ [A]: 'Sam' });
  expect(await source?.readAll()).toEqual({ [A]: 'Sam' });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe(`${WORKER}/names?slug=names-session`);
  expect((init.headers as Record<string, string>).Authorization).toBe('Bearer held-token');
  expect(fetchWorkerWithAuth).not.toHaveBeenCalled();
});

it('shows no names when the Worker withholds them', async () => {
  fetchMock.mockResolvedValue(json({ error: 'nope' }, 500));
  const source = await resolveSessionNamesSource(options());
  expect(await source?.readAll()).toEqual({});
  expect((fetchMock.mock.calls[0][1].headers as Record<string, string>).Authorization).toBeUndefined();
});

it("saves your own name, tells every view, and passes on the Worker's refusal as it is", async () => {
  const heard = jest.fn();
  const stop = subscribeSessionNames(heard);
  const source = await resolveSessionNamesSource(options(A));
  jest.mocked(fetchWorkerWithAuth).mockResolvedValueOnce(json({ name: 'Sam Lee', setAt: 1 }));

  await expect(source?.setOwn('Sam  Lee')).resolves.toBe('Sam Lee');
  expect(jest.mocked(fetchWorkerWithAuth).mock.calls[0][0]).toBe(`${WORKER}/names/set`);
  expect(JSON.parse(String(jest.mocked(fetchWorkerWithAuth).mock.calls[0][1]?.body))).toEqual({ name: 'Sam  Lee' });
  expect(heard).toHaveBeenCalledTimes(1);

  jest
    .mocked(fetchWorkerWithAuth)
    .mockResolvedValueOnce(json({ error: "Names can't claim a role", reason: 'role' }, 400));
  await expect(source?.setOwn('Admin')).rejects.toThrow("Names can't claim a role");
  expect(heard).toHaveBeenCalledTimes(1);
  stop();
});

it('compares names as the Worker stores them', () => {
  expect(normalizeSessionName('  \uFB01ona \u00A0 Lee ')).toBe('fiona Lee');
  expect(normalizeSessionName(undefined)).toBe('');
});

it('keeps one source per session and reader, so a reload is not taken for a change', async () => {
  const first = await resolveSessionNamesSource({ ...options(A), sessionSlug: 'same-source' });
  expect(
    await resolveSessionNamesSource({ ...options(A.toUpperCase().replace('0X', '0x')), sessionSlug: 'same-source' }),
  ).toBe(first);
  expect(await resolveSessionNamesSource({ ...options(B), sessionSlug: 'same-source' })).not.toBe(first);
});

it("throws when the Worker can't say whether it keeps names, rather than passing for an older Worker", async () => {
  jest.mocked(readWorkerCapabilities).mockResolvedValueOnce({ legacy: false, features: [], unavailable: true });
  await expect(resolveSessionNamesSource(options())).rejects.toThrow();
});

it("reads past the browser's cache and asks again after a refusal", async () => {
  fetchMock
    .mockResolvedValueOnce(json({ error: 'expired' }, 401))
    .mockResolvedValueOnce(json({ names: { [A]: 'Sam' } }));
  const source = await resolveSessionNamesSource({ ...options(), sessionSlug: 'refused-once' });

  expect(await source?.readAll()).toEqual({});
  expect(await source?.readAll()).toEqual({ [A]: 'Sam' });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[0][1].cache).toBe('no-cache');
});

it('drops only its own failed read, never a newer one kept under the same key', async () => {
  jest.useFakeTimers({ now: 0, doNotFake: ['nextTick', 'setImmediate'] });
  try {
    let failOld: (response: Response) => void = () => undefined;
    fetchMock
      .mockImplementationOnce(() => new Promise((resolve) => (failOld = resolve)))
      .mockResolvedValueOnce(json({ names: { [A]: 'Sam' } }));
    const source = await resolveSessionNamesSource({ ...options(), sessionSlug: 'slow-refusal' });
    const old = source?.readAll();
    jest.setSystemTime(31_000);
    expect(await source?.readAll()).toEqual({ [A]: 'Sam' });

    failOld(json({ error: 'expired' }, 401));
    expect(await old).toEqual({});
    expect(await source?.readAll()).toEqual({ [A]: 'Sam' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  } finally {
    jest.useRealTimers();
  }
});
