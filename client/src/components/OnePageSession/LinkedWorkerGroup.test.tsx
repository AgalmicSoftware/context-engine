import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import LinkedWorkerGroup from './LinkedWorkerGroup';
import { fetchWorkerCanonicalSessionBootstrap } from '../../utilities/session/sessionWorkerDiscovery';
const mockPanel = jest.fn();
jest.mock('../../utilities/session/sessionWorkerDiscovery', () => ({
  fetchWorkerCanonicalSessionBootstrap: jest.fn(),
}));
jest.mock('./WorkerSessionGroupsPanel', () => (props: unknown) => {
  mockPanel(props);
  return <div>Original group memberships</div>;
});
const reference = {
  sessionSlug: 'source',
  sessionId: `0x${'11'.repeat(16)}`,
  workerUrl: 'https://source.example/',
  groupId: 'community',
};
const config = { slug: 'source', sessionId: reference.sessionId, corsWorkerUrl: reference.workerUrl };
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(fetchWorkerCanonicalSessionBootstrap).mockResolvedValue({
    config,
    sessionId: reference.sessionId,
    sessionSlug: 'source',
    workerOrigin: reference.workerUrl,
    configRevision: 'v1',
  });
});
it('uses the verified owning session for membership and authentication without auto-joining', async () => {
  render(<LinkedWorkerGroup reference={reference} account="" provider={null} networkChainId={null} />);
  await screen.findByText('Original group memberships');
  expect(fetchWorkerCanonicalSessionBootstrap).toHaveBeenCalledWith(
    expect.objectContaining({ sessionSlug: 'source', workerQueryValue: reference.workerUrl }),
  );
  expect(mockPanel).toHaveBeenCalledWith(
    expect.objectContaining({
      sessionConfig: config,
      sessionSlug: 'source',
      selectedGroupId: 'community',
      showCreate: false,
    }),
  );
});
it('fails closed on an identity mismatch', async () => {
  jest.mocked(fetchWorkerCanonicalSessionBootstrap).mockResolvedValue({
    config,
    sessionId: `0x${'22'.repeat(16)}`,
    sessionSlug: 'source',
    workerOrigin: reference.workerUrl,
    configRevision: 'v1',
  });
  render(<LinkedWorkerGroup reference={reference} account="" provider={null} networkChainId={null} />);
  await screen.findByRole('alert');
  expect(mockPanel).not.toHaveBeenCalled();
});
it('does not reuse the old session after changing references', async () => {
  const { rerender } = render(
    <LinkedWorkerGroup reference={reference} account="" provider={null} networkChainId={null} />,
  );
  await screen.findByText('Original group memberships');
  jest.mocked(fetchWorkerCanonicalSessionBootstrap).mockRejectedValue(new Error('Unavailable'));
  rerender(
    <LinkedWorkerGroup
      reference={{ ...reference, sessionSlug: 'other' }}
      account=""
      provider={null}
      networkChainId={null}
    />,
  );
  expect(screen.queryByText('Original group memberships')).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
});
