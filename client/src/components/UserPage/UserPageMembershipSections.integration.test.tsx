import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { renderUserPageMembershipSections } from './UserPageMembershipSections';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';
import { getWorkerSessionToken } from '../../utilities/worker/workerAuth';

jest.mock('../../utilities/worker/workerAuth', () => ({ getWorkerSessionToken: jest.fn() }));
const account = '0x00000000000000000000000000000000000000aa';
const sessionId = '0x11111111111111111111111111111111';
const sessionConfig = {
  slug: 'profile-session',
  sessionId,
  corsWorkerUrl: 'https://profile-worker.example',
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
};
const renderMemberships = (viewer = account) =>
  renderUserPageMembershipSections({
    account: viewer,
    activeSessionSlug: sessionConfig.slug,
    isOwner: viewer === account,
    isSimulated: false,
    onChainProfileEnabled: false,
    provider: 'passkey_eoa',
    sessionConfig,
    sbtSectionProps: {
      heading: 'SBTs',
      onRefreshSbtData: jest.fn(),
      sbtDisplayState: {},
      sbtEmptyText: '',
      sbtEntries: [],
    },
  });

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

it('loads the owner’s joined group and removes it on account change without exposing it to another viewer', async () => {
  jest.mocked(getWorkerSessionToken).mockResolvedValue('synthetic-worker-token');
  const group = {
    groupId: 'reviewers',
    sessionSlug: sessionConfig.slug,
    label: 'Fixture reviewers',
    joinMode: 'open',
    memberVisibility: 'members',
  };
  const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer synthetic-worker-token');
    const url = new URL(String(input));
    expect(url.searchParams.get('sessionId')).toBe(sessionId);
    expect(url.origin).toBe(sessionConfig.corsWorkerUrl);
    expect(['/groups/list', '/groups/my-memberships']).toContain(url.pathname);
    return new Response(
      JSON.stringify({
        ok: true,
        sessionId,
        sessionSlug: sessionConfig.slug,
        ...(url.pathname.endsWith('my-memberships')
          ? { memberships: [{ group, member: { sessionSlug: sessionConfig.slug, principalKey: `evm:${account}` } }] }
          : { groups: [] }),
      }),
      { status: 200 },
    );
  });
  const view = render(<>{renderMemberships()}</>);
  expect(await screen.findByText('Fixture reviewers')).toBeInTheDocument();
  await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
  expect(getWorkerSessionToken).toHaveBeenCalledWith(
    expect.objectContaining({
      sessionSlug: sessionConfig.slug,
      sessionConfig,
      context: expect.objectContaining({ account }),
    }),
  );
  view.rerender(<>{renderMemberships('0x00000000000000000000000000000000000000bb')}</>);
  expect(screen.queryByText('Fixture reviewers')).not.toBeInTheDocument();
  expect(screen.getByText('Group memberships are only shown on your own profile.')).toBeInTheDocument();
  expect(fetchSpy).toHaveBeenCalledTimes(2);
});
