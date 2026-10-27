import { ReadableStream, TextDecoderStream } from 'node:stream/web';
import { TextEncoder } from 'node:util';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminSessionBackupPanel from './AdminSessionBackupPanel';
import { postSignedAdminWorkerRequest } from '../../utilities/worker/signedAdminWorkerRequest';
import { readWorkerCapabilities } from '../../utilities/worker/workerCapabilities';
jest.mock('../../utilities/worker/workerCapabilities', () => ({
  ...jest.requireActual<typeof import('../../utilities/worker/workerCapabilities')>(
    '../../utilities/worker/workerCapabilities',
  ),
  readWorkerCapabilities: jest.fn(),
}));

const page = (pageNumber: number, complete = false) => ({
  ok: true,
  pageNumber,
  archiveId: 'fixture',
  nextCursor: complete ? '' : `cursor-${pageNumber + 1}`,
  manifest: {
    type: 'ce_session_backup',
    version: 1,
    sessionSlug: 'sample',
    sessionId: `0x${'3'.repeat(32)}`,
    complete,
  },
  entries: [],
});
const props = { workerUrl: 'https://backup.test', sessionSlug: 'sample', account: '0xadmin', canAdminWorker: true };
const chooseFile = async (pages: unknown[]) => {
  const file = new File([], 'sample.jsonl');
  const bytes = new TextEncoder().encode(pages.map((value) => JSON.stringify(value)).join('\r\n'));
  Object.defineProperty(file, 'text', {
    value: jest.fn(() => {
      throw new Error('Whole-file strings are forbidden.');
    }),
  });
  Object.defineProperty(file, 'stream', {
    value: jest.fn(() => {
      let offset = 0;
      return new ReadableStream({
        pull(controller) {
          if (offset === bytes.length) {
            controller.close();
            return;
          }
          controller.enqueue(bytes.slice(offset, offset + 37));
          offset = Math.min(bytes.length, offset + 37);
        },
      });
    }),
  });
  const input = await screen.findByLabelText('Backup file');
  await act(async () => fireEvent.change(input, { target: { files: [file] } }));
  return file;
};
beforeEach(() => {
  Object.defineProperty(globalThis, 'TextDecoderStream', { configurable: true, value: TextDecoderStream });
  jest.mocked(readWorkerCapabilities).mockResolvedValue({ legacy: false, features: ['session_backup_v1'] });
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn(() => 'blob:backup') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
  jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

test('hides backup actions on Workers without the capability', async () => {
  jest.mocked(readWorkerCapabilities).mockResolvedValue({ legacy: true, features: [] });
  render(<AdminSessionBackupPanel {...props} postSignedRequest={jest.fn()} />);
  await waitFor(() => expect(readWorkerCapabilities).toHaveBeenCalled());
  expect(screen.queryByText('Backup & restore')).not.toBeInTheDocument();
});

test('downloads all pages and resumes after a lost export reply', async () => {
  const post = jest
    .fn()
    .mockResolvedValueOnce({ data: page(0) })
    .mockRejectedValueOnce(new Error('Connection lost'))
    .mockResolvedValueOnce({ data: page(1, true) });
  render(<AdminSessionBackupPanel {...props} postSignedRequest={post} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Download backup' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Connection lost');
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Resume download' }));
  await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1));
  expect(post.mock.calls[2][0].body.cursor).toBe('cursor-1');
  expect(screen.getByRole('status')).toHaveTextContent('Downloaded 2 pages');
});

test('imports every page with identity adoption and reports conflicts', async () => {
  const post = jest
    .fn()
    .mockResolvedValueOnce({ data: { ok: true, complete: false, counts: { written: 2, skipped: 0, conflicts: 0 } } })
    .mockResolvedValueOnce({
      data: {
        ok: true,
        complete: false,
        counts: { written: 2, skipped: 1, conflicts: 1 },
        conflicts: ['ce-storage:sample:responses:fixture'],
      },
    });
  render(<AdminSessionBackupPanel {...props} postSignedRequest={post} />);
  await chooseFile([page(0), page(1, true)]);
  fireEvent.click(screen.getByLabelText(/Adopt the backup session ID/));
  fireEvent.click(await screen.findByRole('button', { name: 'Restore from backup' }));
  await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
  expect(post.mock.calls[0][0].body.adoptSessionId).toBe(true);
  expect(post.mock.calls[0][0].body.sessionId).toBe(page(0).manifest.sessionId);
  expect(await screen.findByRole('alert')).toHaveTextContent('1 conflict');
  expect(screen.getByRole('alert')).toHaveTextContent('Abandon this restore to remove its imported data');
  expect(screen.queryByText('Restore complete.')).not.toBeInTheDocument();
});

test('rejects a partial or out-of-order file before signing any import', async () => {
  const post = jest.fn();
  render(<AdminSessionBackupPanel {...props} postSignedRequest={post} />);
  await chooseFile([page(1, true)]);
  expect(await screen.findByRole('alert')).toHaveTextContent(/complete backup in page order/i);
  expect(post).not.toHaveBeenCalled();
});

test('waits for the nonce rate limit and resumes the same export page', async () => {
  jest.useFakeTimers();
  try {
    const post = jest
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('Limited'), { status: 429 }))
      .mockResolvedValueOnce({ data: page(0, true) });
    render(<AdminSessionBackupPanel {...props} postSignedRequest={post} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Download backup' }));
    await screen.findByText(/Resuming in one minute/);
    await act(async () => jest.advanceTimersByTimeAsync(61_000));
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[0][0]).toEqual(post.mock.calls[1][0]);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});

test('leaving the session prevents a late export reply from downloading a file', async () => {
  let finish: () => void = () => {};
  const post = jest.fn(
    () =>
      new Promise<{ data: unknown }>((resolve) => {
        finish = () => resolve({ data: page(0, true) });
      }),
  );
  const view = render(<AdminSessionBackupPanel {...props} postSignedRequest={post} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Download backup' }));
  view.unmount();
  await act(async () => finish());
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});

test('recovery export asks for confirmation and signs it, then hides the key after dismissal', async () => {
  jest
    .mocked(readWorkerCapabilities)
    .mockResolvedValue({ legacy: false, features: ['session_backup_v1', 'recovery_key_export'] });
  const confirm = jest.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true);
  const post = jest
    .fn()
    .mockResolvedValue({ data: { ok: true, recoveryKey: 'a'.repeat(64), fingerprint: 'b'.repeat(64) } });
  render(<AdminSessionBackupPanel {...props} postSignedRequest={post} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Show recovery key' }));
  expect(post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Show recovery key' }));
  expect(await screen.findByLabelText('Recovery key')).toHaveAttribute('type', 'password');
  expect(screen.queryByText('The Worker uses a generated recovery key.')).not.toBeInTheDocument();
  expect(post).toHaveBeenCalledWith({
    action: 'export-recovery-key',
    path: '/admin/export-recovery-key',
    body: { sessionSlug: 'sample', confirm: 'export-recovery-key' },
  });
  fireEvent.click(screen.getByRole('button', { name: "I've saved it" }));
  await waitFor(() => expect(screen.queryByLabelText('Recovery key')).not.toBeInTheDocument());
  expect(confirm).toHaveBeenCalledTimes(2);
});

test('hides key export when the Worker advertises backup without deployment key custody', async () => {
  render(<AdminSessionBackupPanel {...props} postSignedRequest={jest.fn()} />);
  expect(await screen.findByRole('button', { name: 'Download backup' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Show recovery key' })).not.toBeInTheDocument();
});

test('offers abandonment after the Worker reports an unfinished restore', async () => {
  const post = jest
    .fn()
    .mockResolvedValueOnce({
      data: { ok: true, restore: { archiveId: 'unfinished', inProgress: true, canAbandon: true } },
    })
    .mockResolvedValueOnce({ data: { ok: true, complete: true } });
  render(<AdminSessionBackupPanel {...props} postSignedRequest={post} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Check restore status' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Abandon restore' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Restore abandoned'));
  expect(screen.getByRole('status')).toHaveTextContent('All data written by this restore was removed');
  expect(screen.getByText(/Restore requires an empty target session/)).toBeVisible();
  expect(post.mock.calls[1][0].action).toBe('abandon-session-backup');
  expect(post.mock.calls[1][0].body.archiveId).toBe('unfinished');
  expect(screen.queryByRole('button', { name: 'Abandon restore' })).not.toBeInTheDocument();
});

test('follows bounded group preparation without putting it in the archive', async () => {
  const post = jest
    .fn()
    .mockResolvedValueOnce({ data: { ok: true, preparing: true, nextCursor: 'groups-next' } })
    .mockResolvedValueOnce({ data: page(0, true) });
  render(<AdminSessionBackupPanel {...props} postSignedRequest={post} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Download backup' }));
  await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1));
  expect(post.mock.calls[1][0].body.cursor).toBe('groups-next');
  expect(screen.getByRole('status')).toHaveTextContent('Downloaded 1 pages');
});

test('resends the same import page until its operation budget continuation finishes', async () => {
  const counts = { written: 1, skipped: 0, conflicts: 0 };
  const post = jest
    .fn()
    .mockResolvedValueOnce({ data: { ok: true, pageComplete: false, complete: false, counts } })
    .mockResolvedValueOnce({ data: { ok: true, complete: true, counts } });
  render(<AdminSessionBackupPanel {...props} postSignedRequest={post} />);
  await chooseFile([page(0, true)]);
  fireEvent.click(await screen.findByRole('button', { name: 'Restore from backup' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Restore complete'));
  expect(post).toHaveBeenCalledTimes(2);
  expect(post.mock.calls[0][0]).toEqual(post.mock.calls[1][0]);
});

test('streams split UTF-8 lines and reopens the file to resume an interrupted restore', async () => {
  const counts = { written: 1, skipped: 0, conflicts: 0 };
  const post = jest
    .fn()
    .mockResolvedValueOnce({ data: { ok: true, complete: false, counts } })
    .mockRejectedValueOnce(new Error('Connection lost'))
    .mockResolvedValueOnce({ data: { ok: true, complete: true, counts } });
  render(<AdminSessionBackupPanel {...props} postSignedRequest={post} />);
  const first = { ...page(0), note: '☃'.repeat(80) };
  const file = await chooseFile([first, page(1, true)]);
  expect(screen.getByRole('status')).toHaveTextContent('Ready to restore 2 pages');
  fireEvent.click(screen.getByRole('button', { name: 'Restore from backup' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Connection lost');
  fireEvent.click(screen.getByRole('button', { name: 'Resume restore' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Restore complete'));
  expect(post.mock.calls.map(([request]) => request.body.page.pageNumber)).toEqual([0, 1, 1]);
  expect(post.mock.calls[0][0].body.page.note).toBe(first.note);
  expect(file.text).not.toHaveBeenCalled();
  expect(file.stream).toHaveBeenCalledTimes(3);
});

test.each([
  [409, 'backup_session_changed'],
  [403, 'backup_cursor_invalid'],
  [200, 'backup_session_changed'],
])('discards unusable pages and offers only restart (%s, %s)', async (status, reason) => {
  const failure = { reason, error: 'Restart the backup.' };
  const fetchImpl = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(new Response(JSON.stringify(page(0)), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify(failure), { status: Number(status) }))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ ...page(0, true), archiveId: 'new-archive' }), { status: 200 }),
    );
  const signAdminAction = jest.fn().mockResolvedValue({});
  const post = jest.fn((request) =>
    postSignedAdminWorkerRequest({ ...request, workerUrl: props.workerUrl, signAdminAction, fetchImpl }),
  );
  render(<AdminSessionBackupPanel {...props} postSignedRequest={post} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Download backup' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Restart the backup');
  expect(screen.queryByRole('button', { name: 'Resume download' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save partial backup' })).not.toBeInTheDocument();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Restart download' }));
  await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1));
  expect(post.mock.calls[2][0].body.cursor).toBe('');
  expect(screen.getByRole('status')).toHaveTextContent('Downloaded 1 pages');
});
