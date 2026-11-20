import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { renderUserPageMembershipSections } from './UserPageMembershipSections';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';
import { getWorkerSessionToken } from '../../utilities/worker/workerAuth';

jest.mock('../../utilities/worker/workerAuth', () => ({ getWorkerSessionToken: jest.fn() }));
// Session names are read through their own module and tested there; this test counts only the groups' requests.
jest.mock('../../utilities/session/useSessionNames', () => ({
  useSessionNames: () => ({ source: null, names: {}, answerNamesShown: true }),
}));
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

it('loads the owner’s joined group and drops the section on account change without exposing it to another viewer', async () => {
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
  expect(screen.queryByRole('heading', { name: 'Groups Joined:' })).not.toBeInTheDocument();
  expect(screen.queryByText(/Group memberships/)).not.toBeInTheDocument();
  expect(fetchSpy).toHaveBeenCalledTimes(2);
});

it("puts another person's shown card in the side column, and never one on my own page", () => {
  const other = '0x00000000000000000000000000000000000000bb';
  const withCard = (viewer: string, savedCard: React.ReactNode, onChainProfileEnabled = false) =>
    renderUserPageMembershipSections({
      account: viewer,
      activeSessionSlug: sessionConfig.slug,
      isOwner: viewer === account,
      isSimulated: false,
      onChainProfileEnabled,
      provider: 'passkey_eoa',
      savedCard,
      sessionConfig,
      sbtSectionProps: {
        heading: 'SBTs',
        onRefreshSbtData: jest.fn(),
        sbtDisplayState: {},
        sbtEmptyText: '',
        sbtEntries: [],
      },
    });
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));

  // Someone else's page in a session with no groups to show: the column holds their card and nothing else.
  const view = render(<>{withCard(other, <section aria-label="Picture card">their card</section>)}</>);
  const column = screen.getByRole('region', { name: 'Picture card' }).parentElement as HTMLElement;
  expect(column.className).toBe('rightColumn cardColumn');
  expect(column.childElementCount).toBe(1);

  // They show no card: the component draws nothing, so the column is empty and the style gives it no room.
  const Nothing = () => null;
  view.rerender(<>{withCard(other, <Nothing />)}</>);
  expect(view.container.querySelector('.cardColumn')?.childNodes).toHaveLength(0);
  view.rerender(<>{withCard(other, null)}</>);
  expect(view.container.querySelector('.rightColumn')).toBeNull();

  // Where groups are on the chain the card leads the column.
  view.rerender(<>{withCard(other, <section aria-label="Picture card">their card</section>, true)}</>);
  expect(view.container.querySelector('.cardColumn')?.firstElementChild).toBe(
    screen.getByRole('region', { name: 'Picture card' }),
  );

  // My own page: a card handed in by mistake is still not drawn here.
  view.rerender(<>{withCard(account, <section aria-label="Picture card">my card</section>)}</>);
  expect(screen.queryByRole('region', { name: 'Picture card' })).toBeNull();
  expect(view.container.querySelector('.cardColumn')).toBeNull();
});
