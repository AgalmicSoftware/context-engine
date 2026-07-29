import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import WorkerGroupImage from './WorkerGroupImage';

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

const publicConfig = {
  storageProfile: {
    backend: 'cloudflare',
    payloadAccessControl: { gate: 'none', encryption: 'none' },
  },
};

const privateConfig = {
  storageProfile: {
    backend: 'cloudflare',
    payloadAccessControl: { gate: 'role_gate', encryption: 'worker_envelope' },
  },
};

describe('WorkerGroupImage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalCreateObjectURL) {
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL });
    } else {
      delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
    }
    if (originalRevokeObjectURL) {
      Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectURL });
    } else {
      delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;
    }
  });

  it('renders public session storage artwork directly for anonymous visitors', () => {
    const fetchImpl = jest.fn();
    const src = 'https://demo-sh-worker.example/storage/read?id=cf_group_image';

    render(
      <WorkerGroupImage
        src={src}
        sessionConfig={publicConfig}
        sessionSlug="demo-sh"
        workerUrl="https://demo-sh-worker.example"
        fetchImpl={fetchImpl}
        testId="group-image"
      />,
    );

    expect(screen.getByTestId('group-image')).toHaveAttribute('src', src);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('loads private session storage artwork with the existing Worker credential', async () => {
    const createObjectURL = jest.fn().mockReturnValue('blob:private-group-image');
    const revokeObjectURL = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    const imageBlob = new Blob(['image'], { type: 'image/png' });
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: jest.fn().mockResolvedValue(imageBlob),
    });
    const src = 'https://private-worker.example/storage/read?id=cf_group_image';

    const { unmount } = render(
      <WorkerGroupImage
        src={src}
        sessionConfig={privateConfig}
        sessionSlug="private-session"
        workerToken="participant-token"
        workerUrl="https://private-worker.example"
        fetchImpl={fetchImpl}
        testId="group-image"
      />,
    );

    await waitFor(() => expect(screen.getByTestId('group-image')).toHaveAttribute('src', 'blob:private-group-image'));
    expect(fetchImpl).toHaveBeenCalledWith(
      src,
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer participant-token',
          'X-Group-Slug': 'private-session',
        },
      }),
    );
    expect(createObjectURL).toHaveBeenCalledWith(imageBlob);

    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:private-group-image');
  });

  it('does not send Worker credentials to external HTTPS image hosts', () => {
    const fetchImpl = jest.fn();

    render(
      <WorkerGroupImage
        src="https://images.example/group.png"
        sessionConfig={privateConfig}
        sessionSlug="private-session"
        workerToken="participant-token"
        workerUrl="https://private-worker.example"
        fetchImpl={fetchImpl}
        testId="group-image"
      />,
    );

    expect(screen.getByTestId('group-image')).toHaveAttribute('src', 'https://images.example/group.png');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
