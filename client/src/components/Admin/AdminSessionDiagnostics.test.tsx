import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminSessionDiagnostics from './AdminSessionDiagnostics';
import { adminWorkerPorts } from '../../domains/worker/adminWorkerPorts';

jest.mock('../../domains/worker/adminWorkerPorts', () => ({
  adminWorkerPorts: { adminAuth: { fetchWorkerWithAuth: jest.fn() } },
}));
const fetchStatus = jest.mocked(adminWorkerPorts.adminAuth.fetchWorkerWithAuth);
const props = {
  workerUrl: 'https://diagnostics.example.test',
  sessionSlug: 'fixture',
  account: '0x1111',
  sessionId: '0x1234',
  canAdminWorker: true,
  workerAuthContext: { account: '0x1111' },
};
const body = () => ({
  type: 'ce_session_diagnostics',
  version: 1,
  observedAtMs: 1_800_000_000_000,
  uploadReceipts: {
    pendingLeases: 2,
    oldestPendingAgeMs: 12_000,
    settledCount: 19,
    complete: true,
    cursor: null as string | null,
  },
  analysis: { lastSuccessAtMs: null, retryAttempt: 3, nextAttemptAtMs: null, retriesExhausted: true },
  configProjection: { pending: true, sinceMs: 1_799_999_000_000 },
});
const reply = (data = body(), status = 200) => ({ ok: status === 200, status, json: async () => data });
const value = (label: string) => screen.getByText(label).nextElementSibling?.textContent;
beforeEach(() => {
  fetchStatus.mockReset();
});

test('shows private receipt, automatic retry, and repair diagnostics beside a refresh action', async () => {
  fetchStatus.mockResolvedValue(reply());
  render(<AdminSessionDiagnostics {...props} />);
  expect(fetchStatus).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh diagnostics' }));
  await screen.findByText('Pending upload leases');
  expect(value('Pending upload leases')).toBe('2');
  expect(value('Oldest pending lease')).toBe('12 seconds');
  expect(value('Settled upload receipts')).toBe('19');
  expect(value('Last automatic analysis success')).toBe('None recorded');
  expect(value('Automatic retry attempt')).toBe('3 of 3');
  expect(value('Next automatic attempt')).toBe('Not scheduled');
  expect(value('Automatic retries exhausted')).toContain('automatic retries have stopped');
  expect(value('Config projection repair')).toMatch(/^Pending since /);
  expect(fetchStatus).toHaveBeenCalledWith(
    'https://diagnostics.example.test/admin/diagnostics?sessionSlug=fixture',
    expect.objectContaining({ method: 'GET', cache: 'no-store', signal: expect.any(AbortSignal) }),
    { sessionSlug: 'fixture', workerUrl: props.workerUrl, context: props.workerAuthContext },
  );
});

test('labels partial totals and adds another bounded page without doubling the first', async () => {
  const first = body();
  first.uploadReceipts.complete = false;
  first.uploadReceipts.cursor = 'a'.repeat(64);
  const second = body();
  second.uploadReceipts.pendingLeases = 1;
  second.uploadReceipts.settledCount = 3;
  fetchStatus
    .mockResolvedValueOnce(reply(first))
    .mockResolvedValueOnce(reply(second))
    .mockResolvedValueOnce(reply(second));
  render(<AdminSessionDiagnostics {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh diagnostics' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Load more receipt totals' }));
  await waitFor(() => expect(value('Settled upload receipts')).toBe('22'));
  expect(value('Pending upload leases')).toBe('3');
  expect(fetchStatus.mock.calls[1][0]).toContain(`cursor=${'a'.repeat(64)}`);
  expect(screen.queryByText(/Receipt totals are partial/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh diagnostics' }));
  await waitFor(() => expect(value('Settled upload receipts')).toBe('3'));
});

test('clears old results and ignores a late reply after the account changes', async () => {
  let resolveReply: (value: ReturnType<typeof reply>) => void = () => {};
  fetchStatus.mockReturnValue(
    new Promise((resolve) => {
      resolveReply = resolve;
    }),
  );
  const view = render(<AdminSessionDiagnostics {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh diagnostics' }));
  view.rerender(<AdminSessionDiagnostics {...props} account="0x2222" />);
  expect(fetchStatus.mock.calls[0][1]?.signal?.aborted).toBe(true);
  await act(async () => resolveReply(reply()));
  expect(screen.queryByText('Settled upload receipts')).not.toBeInTheDocument();
});

test('keeps diagnostics unavailable to non-admin viewers', () => {
  render(<AdminSessionDiagnostics {...props} canAdminWorker={false} />);
  expect(screen.queryByRole('region', { name: 'Session diagnostics' })).not.toBeInTheDocument();
  expect(fetchStatus).not.toHaveBeenCalled();
});

test('shows upgrade guidance for an older Worker and rejects malformed metrics', async () => {
  fetchStatus.mockResolvedValueOnce(reply(body(), 404)).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ type: 'ce_session_diagnostics', version: 1 }),
  });
  render(<AdminSessionDiagnostics {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh diagnostics' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Update the Worker');
  fireEvent.click(screen.getByRole('button', { name: 'Refresh diagnostics' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('invalid diagnostics response'));
  expect(screen.queryByText('Settled upload receipts')).not.toBeInTheDocument();
});
