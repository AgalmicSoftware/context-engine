import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LinkedWorkerGroup from './LinkedWorkerGroup';
import { fetchWorkerCanonicalSessionBootstrap } from '../../utilities/session/sessionWorkerDiscovery';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';
import { getWorkerSessionToken } from '../../utilities/worker/workerAuth';

jest.mock('../../utilities/session/sessionWorkerDiscovery', () => ({
  ...jest.requireActual<typeof import('../../utilities/session/sessionWorkerDiscovery')>(
    '../../utilities/session/sessionWorkerDiscovery',
  ),
  fetchWorkerCanonicalSessionBootstrap: jest.fn(),
}));
jest.mock('../../utilities/worker/workerAuth', () => ({
  ...jest.requireActual<typeof import('../../utilities/worker/workerAuth')>('../../utilities/worker/workerAuth'),
  buildSignedAdminActionAuth: jest.fn(),
  getWorkerSessionToken: jest.fn(async () => 'token'),
}));
jest.mock('./WorkerGroupMembershipPanel', () => ({
  __esModule: true,
  default: ({ onSignIn }: { onSignIn: () => void }) => (
    <button type="button" onClick={onSignIn}>
      Join
    </button>
  ),
}));
jest.mock('./WorkerParticipantGroupCreatePanel', () => () => null);

const eddy = { slug: 'fixture-session', sessionId: `0x${'44'.repeat(16)}` };
const EVIL = 'https://evil.example/';
const reference = { sessionSlug: eddy.slug, sessionId: eddy.sessionId, workerUrl: EVIL, groupId: 'community' };

beforeEach(() => {
  jest.clearAllMocks();
});

it.each([false, true])(
  'signs in to a linked Worker only after Join (public discovery: %s)',
  async (publicDiscovery) => {
    const sessionModeProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    if (publicDiscovery) {
      sessionModeProfile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
      sessionModeProfile.storage.payloadAccessControl = { gate: 'none', encryption: 'none' };
      sessionModeProfile.encryption = { mode: 'none' };
      sessionModeProfile.results.visibility = 'public_full_if_storage_public';
      sessionModeProfile.export.scope = 'all_session';
    }
    jest.mocked(fetchWorkerCanonicalSessionBootstrap).mockResolvedValue({
      config: { slug: eddy.slug, sessionIdHex: eddy.sessionId, corsWorkerUrl: EVIL, sessionModeProfile },
      sessionId: eddy.sessionId,
      sessionSlug: eddy.slug,
      workerOrigin: new URL(EVIL).origin,
      configRevision: 'v1',
    } as never);
    render(
      <LinkedWorkerGroup
        reference={reference}
        account="0x00000000000000000000000000000000000000bb"
        provider={{}}
        networkChainId={null}
      />,
    );
    await waitFor(() => expect(fetchWorkerCanonicalSessionBootstrap).toHaveBeenCalled());
    const join = await screen.findByRole('button', { name: 'Join' });
    expect(getWorkerSessionToken).not.toHaveBeenCalled();
    fireEvent.click(join);
    await waitFor(() => expect(getWorkerSessionToken).toHaveBeenCalledTimes(1));
    expect(getWorkerSessionToken).toHaveBeenCalledWith(
      expect.objectContaining({ sessionSlug: eddy.slug, workerUrl: new URL(EVIL).origin }),
    );
  },
);
