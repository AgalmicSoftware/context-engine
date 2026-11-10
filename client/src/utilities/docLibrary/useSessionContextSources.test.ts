import { act, renderHook, waitFor } from '@testing-library/react';

import { workerAcceptsParticipantContext, type ContextSource, type ContextSourceOptions } from './contextSources';
import { useSessionContextPrompt, useSessionContextSources } from './useSessionContextSources';

const mockRequests: Array<{ options: ContextSourceOptions; resolve: (sources: ContextSource[]) => void }> = [];

jest.mock('../storage/sessionStorageConfig', () => ({
  ...jest.requireActual<object>('../storage/sessionStorageConfig'),
  usesCloudflareSessionStorage: () => true,
  requiresLitForSessionStorage: () => false,
}));
let mockTokenHeld = false;
let mockHearToken: () => void = () => undefined;
let mockHearGroups: () => void = () => undefined;
jest.mock('../worker/workerAuth.js', () => ({
  hasCachedWorkerSessionToken: async () => mockTokenHeld,
  subscribeWorkerSessionToken: (listener: () => void) => {
    mockHearToken = listener;
    return () => undefined;
  },
}));
jest.mock('../worker/workerGroupChangeEvents', () => ({
  subscribeWorkerGroupsChanged: (listener: () => void) => {
    mockHearGroups = listener;
    return () => undefined;
  },
}));
jest.mock('./contextSources', () => ({
  workerAcceptsParticipantContext: jest.fn(async () => true),
  listContextSources: jest.fn(
    (options: ContextSourceOptions) => new Promise((resolve) => mockRequests.push({ options, resolve })),
  ),
  loadContextSourcesForAi: jest.fn(async (sources: ContextSource[], options: ContextSourceOptions) =>
    sources.map((source) => ({
      title: source.title,
      kind: source.kind,
      text: `${source.title} as read by ${String((options.context as { account?: unknown }).account)}`,
    })),
  ),
}));

const ADMIN = '0xaaaa000000000000000000000000000000000001';
const READER = '0xbbbb000000000000000000000000000000000002';
const config = (workerUrl = 'https://worker-one.example') => ({ adminAddresses: [ADMIN], corsWorkerUrl: workerUrl });
const source = (id: string, adminsOnly = false): ContextSource => ({
  id,
  kind: 'file',
  title: `Source ${id}`,
  url: '',
  mime: 'text/plain',
  size: 1,
  createdAt: '',
  adminsOnly,
  lockedGroupIds: [],
  addedBy: '',
  fetchedAt: '',
  reading: null,
});
type HookProps = { sessionSlug: string; sessionConfig: unknown; account: string };
const resolveLatest = (sources: ContextSource[]) =>
  act(async () => {
    mockRequests[mockRequests.length - 1].resolve(sources);
  });

beforeEach(() => {
  mockRequests.length = 0;
});

describe('useSessionContextSources', () => {
  const mount = (account: string) =>
    renderHook((props: HookProps) => useSessionContextSources(props), {
      initialProps: { sessionSlug: 'salon', sessionConfig: config(), account },
    });

  it('lets signed-in people add files unless the session limits it or their Worker can’t', async () => {
    const { result, rerender } = mount(READER);
    await resolveLatest([]);
    await waitFor(() => expect(result.current.participantsCanAdd).toBe(true));

    rerender({
      sessionSlug: 'salon',
      sessionConfig: { ...config(), contextAdditionPolicy: 'admin_only' } as ReturnType<typeof config>,
      account: READER,
    });
    expect(result.current.participantsCanAdd).toBe(false);

    rerender({ sessionSlug: 'salon', sessionConfig: config(), account: '' });
    expect(result.current.participantsCanAdd).toBe(false);

    jest.mocked(workerAcceptsParticipantContext).mockResolvedValueOnce(false);
    const older = mount(READER);
    await resolveLatest([]);
    await act(async () => undefined);
    expect(older.result.current.participantsCanAdd).toBe(false);
  });

  it('skips the Worker check where adding isn’t on offer, as for the AI’s context', async () => {
    jest.mocked(workerAcceptsParticipantContext).mockClear();
    renderHook(() =>
      useSessionContextSources({ sessionSlug: 'salon', sessionConfig: config(), account: READER, offersAdding: false }),
    );
    await resolveLatest([]);
    expect(workerAcceptsParticipantContext).not.toHaveBeenCalled();
    renderHook(() =>
      useSessionContextPrompt({ sessionSlug: 'salon', sessionConfig: config(), account: READER, totalChars: 100 }),
    );
    await resolveLatest([]);
    expect(workerAcceptsParticipantContext).not.toHaveBeenCalled();
  });

  it('lists again when a token or a new membership arrives, as they can open a group’s files', async () => {
    mockTokenHeld = false;
    const { result } = mount(READER);
    await resolveLatest([source('public')]);
    await waitFor(() => expect(result.current.groupFilesHidden).toBe(true));
    const before = mockRequests.length;

    mockTokenHeld = true;
    act(() => mockHearToken());
    expect(mockRequests.length).toBe(before + 1);
    await resolveLatest([source('public'), source('locked')]);
    expect(result.current.sources.map(({ id }) => id)).toEqual(['public', 'locked']);
    await waitFor(() => expect(result.current.groupFilesHidden).toBe(false));

    act(() => mockHearGroups());
    expect(mockRequests.length).toBe(before + 2);
    await resolveLatest([]);
  });

  it('lets only a reader’s first list ask them to sign in, and offers group files only once it has loaded', async () => {
    mockTokenHeld = false;
    const { result, rerender } = mount(READER);
    expect(mockRequests[mockRequests.length - 1].options.prompt).toBe(true);
    await act(async () => undefined);
    // The list, and any sign-in it asked for, is still under way.
    expect(result.current.groupFilesHidden).toBe(false);
    await resolveLatest([source('public')]);
    await waitFor(() => expect(result.current.groupFilesHidden).toBe(true));
    act(() => mockHearToken());
    expect(mockRequests[mockRequests.length - 1].options.prompt).toBe(false);
    act(() => mockHearGroups());
    expect(mockRequests[mockRequests.length - 1].options.prompt).toBe(false);
    rerender({ sessionSlug: 'salon', sessionConfig: config(), account: ADMIN });
    expect(mockRequests[mockRequests.length - 1].options.prompt).toBe(true);
    await resolveLatest([]);
    // A list hidden and shown again is a first list once more.
    const shown = renderHook((props: HookProps & { enabled: boolean }) => useSessionContextSources(props), {
      initialProps: { sessionSlug: 'salon', sessionConfig: config(), account: READER, enabled: true },
    });
    await resolveLatest([]);
    shown.rerender({ sessionSlug: 'salon', sessionConfig: config(), account: READER, enabled: false });
    shown.rerender({ sessionSlug: 'salon', sessionConfig: config(), account: READER, enabled: true });
    expect(mockRequests[mockRequests.length - 1].options.prompt).toBe(true);
    await resolveLatest([]);
  });

  it('asks nothing of admins or signed-out readers about groups’ files', async () => {
    mockTokenHeld = false;
    const admin = mount(ADMIN);
    await resolveLatest([]);
    await act(async () => undefined);
    expect(admin.result.current.groupFilesHidden).toBe(false);
    const signedOut = mount('');
    await resolveLatest([]);
    await act(async () => undefined);
    expect(signedOut.result.current.groupFilesHidden).toBe(false);
  });

  it('shows a new reader no sources until their own list loads', async () => {
    const { result, rerender } = mount(ADMIN);
    await resolveLatest([source('admins-only', true)]);
    expect(result.current.sources.map(({ id }) => id)).toEqual(['admins-only']);

    rerender({ sessionSlug: 'salon', sessionConfig: config(), account: READER });
    expect(result.current).toEqual(expect.objectContaining({ sources: [], loading: true, isAdmin: false }));
    await resolveLatest([source('public')]);
    expect(result.current.sources.map(({ id }) => id)).toEqual(['public']);
  });

  it('reads the list again from a replaced session Worker', async () => {
    const { result, rerender } = mount(ADMIN);
    await resolveLatest([source('old-worker')]);

    rerender({ sessionSlug: 'salon', sessionConfig: config('https://worker-two.example'), account: ADMIN });
    expect(result.current.sources).toEqual([]);
    await waitFor(() => expect(mockRequests).toHaveLength(2));
  });

  it('keeps the list on screen while the same reader reloads it', async () => {
    const { result } = mount(ADMIN);
    await resolveLatest([source('kept')]);

    act(() => result.current.reload());
    expect(result.current).toEqual(expect.objectContaining({ loading: true, sources: [source('kept')] }));
  });
});

describe('useSessionContextPrompt', () => {
  it('clears the previous reader text as soon as the reader changes', async () => {
    const { result, rerender } = renderHook(
      (props: HookProps) => useSessionContextPrompt({ ...props, totalChars: 4000 }),
      {
        initialProps: { sessionSlug: 'salon', sessionConfig: config(), account: ADMIN },
      },
    );
    await resolveLatest([source('admins-only', true)]);
    await waitFor(() => expect(result.current.text).toContain(`as read by ${ADMIN}`));

    rerender({ sessionSlug: 'salon', sessionConfig: config(), account: READER });
    expect(result.current.text).not.toContain('admins-only');
    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(result.current.text).not.toContain('admins-only');
  });
});
