import { act, renderHook, waitFor } from '@testing-library/react';
import { useTranscriptContextUpload } from './useTranscriptContextUpload';
import {
  removeContextSource,
  uploadContextFile,
  workerAcceptsParticipantContext,
  workerSupportsContextSources,
} from '../../utilities/docLibrary/contextSources';

jest.mock('../../utilities/docLibrary/contextSources', () => ({
  removeContextSource: jest.fn(async () => undefined),
  uploadContextFile: jest.fn(async () => 'stored-1'),
  workerAcceptsParticipantContext: jest.fn(async () => true),
  workerSupportsContextSources: jest.fn(async () => true),
}));
jest.mock('../../utilities/docLibrary/useContextGroups', () => ({
  useContextGroups: ({ enabled }: { enabled: boolean }) => (enabled ? [{ groupId: 'salon', label: 'Salon' }] : []),
}));
jest.mock('../../utilities/docLibrary/useSessionContextSources', () => ({ supportsContextSources: () => true }));

const ME = '0xaaaa000000000000000000000000000000000001';
const input = (sessionConfig: Record<string, unknown> = {}, account = ME) => ({
  sessionSlug: 'salon',
  sessionConfig,
  context: { account },
  enabled: true,
});
const mount = async (sessionConfig?: Record<string, unknown>) => {
  const view = renderHook((props: ReturnType<typeof input>) => useTranscriptContextUpload(props), {
    initialProps: input(sessionConfig),
  });
  await waitFor(() => expect(view.result.current.available).toBe(true));
  return view;
};

describe('adding a transcript to context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState({}, '', '/session/salon');
  });

  it('is offered to participants unless limited to admins or their Worker can’t take it', async () => {
    await mount();
    expect(workerAcceptsParticipantContext).toHaveBeenCalled();
    const limited = renderHook(() => useTranscriptContextUpload(input({ contextAdditionPolicy: 'admin_only' })));
    await act(async () => undefined);
    expect(limited.result.current.available).toBe(false);
    const asAdmin = renderHook(() =>
      useTranscriptContextUpload(input({ contextAdditionPolicy: 'admin_only', adminAddress: ME })),
    );
    await waitFor(() => expect(asAdmin.result.current.available).toBe(true));
    expect(workerSupportsContextSources).toHaveBeenCalled();
    expect(asAdmin.result.current.allowAdminsOnly).toBe(true);
    jest.mocked(workerAcceptsParticipantContext).mockResolvedValueOnce(false);
    const older = renderHook(() => useTranscriptContextUpload(input()));
    await act(async () => undefined);
    expect(older.result.current.available).toBe(false);
  });

  it('uploads nothing unless ticked', async () => {
    const { result } = await mount();
    await act(() => result.current.upload('Person 1: Words.'));
    expect(uploadContextFile).not.toHaveBeenCalled();
  });

  it('starts at the group this page’s link is for, and uploads the transcript as a text file with that lock', async () => {
    window.history.replaceState({}, '', '/session/salon?joinGroup=salon');
    const { result } = await mount();
    expect(result.current.choice).toBe('group:salon');
    act(() => result.current.setChosen(true));
    await act(() => result.current.upload(' Person 1: Words. '));
    const [args, options] = jest.mocked(uploadContextFile).mock.calls[0];
    expect(args.groupId).toBe('salon');
    expect(args.file.type).toBe('text/plain');
    expect(args.file.name).toMatch(/^Group conversation \d{4}-\d{2}-\d{2} \d{2}-\d{2}\.txt$/);
    const text = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsText(args.file);
    });
    expect(text).toBe('Person 1: Words.');
    expect(options).toMatchObject({ sessionSlug: 'salon', context: { account: ME } });
    expect(result.current.status).toBe('Transcript added to context.');
  });

  it('leaves it for the session when there’s no linked group, or when chosen', async () => {
    const { result } = await mount();
    expect(result.current.choice).toBe('session');
    act(() => {
      result.current.setChosen(true);
      result.current.setChoice('session');
    });
    await act(() => result.current.upload('Person 1: Words.'));
    const [args] = jest.mocked(uploadContextFile).mock.calls[0];
    expect(args).not.toHaveProperty('groupId');
    expect(args).not.toHaveProperty('adminsOnly');
  });

  it('replaces its earlier upload when more transcript follows, and skips an unchanged one', async () => {
    const { result } = await mount();
    act(() => result.current.setChosen(true));
    await act(() => result.current.upload('Person 1: Words.'));
    await act(() => result.current.upload('Person 1: Words.'));
    expect(uploadContextFile).toHaveBeenCalledTimes(1);
    jest.mocked(uploadContextFile).mockResolvedValueOnce('stored-2');
    await act(() => result.current.upload('Person 1: Words. More.'));
    expect(uploadContextFile).toHaveBeenCalledTimes(2);
    expect(removeContextSource).toHaveBeenCalledWith(
      { id: 'stored-1', reading: null },
      expect.objectContaining({ sessionSlug: 'salon' }),
    );
  });

  it('says when it failed and can try again, and closing waits for an upload under way', async () => {
    const { result } = await mount();
    act(() => result.current.setChosen(true));
    jest.mocked(uploadContextFile).mockRejectedValueOnce(new Error('Worker said no'));
    await act(() => result.current.upload('Person 1: Words.'));
    expect(result.current.failed).toBe(true);
    expect(result.current.status).toContain('Worker said no');
    let finish = (_id: string) => {};
    jest.mocked(uploadContextFile).mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    let settled = false;
    act(() => {
      void result.current.upload('Person 1: Words.');
      void result.current.settled().then(() => (settled = true));
    });
    await act(async () => undefined);
    expect(settled).toBe(false);
    await act(async () => finish('stored-3'));
    await waitFor(() => expect(settled).toBe(true));
    expect(result.current.failed).toBe(false);
  });
});
