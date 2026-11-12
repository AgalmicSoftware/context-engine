import React from 'react';
import { render, screen } from '@testing-library/react';

import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../../utilities/session/sessionModeProfile';
import SessionSettingsPage from './SessionSettingsPage';

jest.mock('../../../utilities/session/sessionWorkerDiscovery', () => ({
  ...(jest.requireActual('../../../utilities/session/sessionWorkerDiscovery') as object),
  fetchWorkerCanonicalSessionBootstrap: async () => null,
}));
jest.mock('../setup/ContextSourcesPanel', () => ({ __esModule: true, default: () => null }));

const ADMIN = '0x00000000000000000000000000000000000000aa';

const renderWith = (workerOrigin: string, capabilities: Record<string, unknown>) => {
  const fetchImpl = jest.fn(async (url: unknown) =>
    String(url).startsWith(`${workerOrigin}/capabilities`)
      ? new Response(JSON.stringify({ type: 'ce_worker_capabilities', version: 1, apiVersion: 1, features: [], ...capabilities }))
      : new Response('{}', { status: 404 }),
  ) as unknown as typeof fetch;
  render(
    <SessionSettingsPage
      account={ADMIN}
      loginComplete
      toggleLoginModal={jest.fn()}
      sessionSlug="release-salon"
      sessionConfig={{
        slug: 'release-salon',
        sessionId: `0x${'2e'.repeat(16)}`,
        adminAddress: ADMIN,
        corsWorkerUrl: workerOrigin,
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
      }}
      workerOrigin={workerOrigin}
      fetchImpl={fetchImpl}
    />,
  );
};

describe('Session settings Worker release', () => {
  it('shows the release the Session Worker reports', async () => {
    renderWith('https://release-new.example.workers.dev', { release: '0.9.3' });
    expect(await screen.findByTestId('ce-settings-worker-release')).toHaveTextContent('0.9.3');
  });

  it('says a Worker that reports no release is older', async () => {
    renderWith('https://release-old.example.workers.dev', {});
    expect(await screen.findByTestId('ce-settings-worker-release')).toHaveTextContent('before 0.9.3');
  });
});
