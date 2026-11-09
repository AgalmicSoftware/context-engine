import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { SessionInterviewGroupRecommendation } from './SessionInterviewRecommendedGroups';
import {
  getWorkerSessionToken,
  joinWorkerGroup,
  loadPublicWorkerGroups,
  loadWorkerGroupOverview,
  type WorkerGroup,
  type WorkerGroupOverview,
} from '../../domains/worker/workerGroupPorts';
import { dispatchWorkerGroupsChanged } from '../../utilities/worker/workerGroupChangeEvents';
import { AUTO_JOIN_STORAGE_KEY, readPendingAutoJoin } from '../../domains/worker/workerGroupAutoJoinIntent';
import { isWorkerGroupAutoJoinCancelled } from '../../domains/worker/workerGroupAutoJoinPreference';
import {
  buildTokenCacheEnvelope,
  buildTokenCacheKey,
  clearAllTokenCaches,
  writeTokenCache,
} from '../../utilities/worker/workerAuthTokenCache';

jest.mock('../../domains/worker/workerGroupPorts', () => ({
  isSafeHttpsUrl: jest.requireActual<typeof import('../../domains/worker/workerGroupPorts')>(
    '../../domains/worker/workerGroupPorts',
  ).isSafeHttpsUrl,
  getWorkerSessionToken: jest.fn(),
  joinWorkerGroup: jest.fn(),
  loadPublicWorkerGroups: jest.fn(),
  loadWorkerGroupOverview: jest.fn(),
}));

jest.mock('../../utilities/worker/workerGroupChangeEvents', () => ({
  ...jest.requireActual<typeof import('../../utilities/worker/workerGroupChangeEvents')>(
    '../../utilities/worker/workerGroupChangeEvents',
  ),
  dispatchWorkerGroupsChanged: jest.fn(),
}));
const announceGroupsChanged = jest.requireActual<typeof import('../../utilities/worker/workerGroupChangeEvents')>(
  '../../utilities/worker/workerGroupChangeEvents',
).dispatchWorkerGroupsChanged;

const { SessionInterviewRecommendedGroups } = jest.requireActual<typeof import('./SessionInterviewRecommendedGroups')>(
  './SessionInterviewRecommendedGroups',
);

const sessionId = `0x${'1'.repeat(32)}`;
const workerUrl = 'https://worker.example';
const account = '0x0000000000000000000000000000000000000001';

const group = (overrides: Partial<WorkerGroup> = {}): WorkerGroup => ({
  groupId: 'ai-optimists',
  sessionSlug: 'demo',
  label: 'AI Optimists',
  description: 'People who explicitly support optimistic AI governance views.',
  joinMode: 'open',
  memberVisibility: 'session',
  ...overrides,
});

const recommendation = (
  overrides: Partial<SessionInterviewGroupRecommendation> = {},
): SessionInterviewGroupRecommendation => ({
  groupId: 'ai-optimists',
  reason: 'Your reviewed answer explicitly supported optimistic AI governance.',
  evidence: 'I support open AI development.',
  confidence: 0.9,
  ...overrides,
});

const overview = (
  groups: WorkerGroup[],
  memberships: WorkerGroupOverview['memberships'] = [],
): WorkerGroupOverview => ({ groups, memberships });

type Props = Partial<React.ComponentProps<typeof SessionInterviewRecommendedGroups>>;
const element = (props: Props = {}) => (
  <SessionInterviewRecommendedGroups
    recommendations={[recommendation()]}
    account=""
    loginComplete={false}
    sessionConfig={{ slug: 'demo', sessionId }}
    sessionSlug="demo"
    workerUrl={workerUrl}
    {...props}
  />
);
const signedIn = { account, loginComplete: true };

const box = (name: RegExp | string) => screen.getByRole<HTMLInputElement>('checkbox', { name });
const pendingLink = (groupId = 'salon', sessionSlug = 'demo') =>
  sessionStorage.setItem(
    AUTO_JOIN_STORAGE_KEY,
    JSON.stringify({ version: 1, sessionSlug, groupId, workerOrigin: workerUrl, sessionId, createdAt: Date.now() }),
  );
const linkScope = { workerUrl, sessionSlug: 'demo', sessionId, groupId: 'salon' };
const saveWorkerSignIn = (address = account) =>
  writeTokenCache(
    buildTokenCacheKey({ workerUrl, slug: 'demo', sessionId, address }),
    buildTokenCacheEnvelope({
      token: 'token',
      exp: Math.floor(Date.now() / 1000) + 3600,
      workerUrl,
      sessionSlug: 'demo',
      sessionId,
      address,
    }),
  );

describe('SessionInterviewRecommendedGroups', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    clearAllTokenCaches();
    jest.mocked(loadPublicWorkerGroups).mockResolvedValue([group()]);
    jest.mocked(loadWorkerGroupOverview).mockResolvedValue(overview([group()]));
    jest.mocked(getWorkerSessionToken).mockResolvedValue('token');
    jest.mocked(joinWorkerGroup).mockResolvedValue({ group: group(), memberCount: 1 });
  });

  it('leaves every match unticked, however strong, and lists only joinable groups', async () => {
    jest
      .mocked(loadPublicWorkerGroups)
      .mockResolvedValue([
        group(),
        group({ groupId: 'maybe', label: 'Maybe' }),
        group({ groupId: 'restricted', label: 'Restricted', joinMode: 'admin_add' }),
        group({ groupId: 'expired', label: 'Expired', joinEndsAt: '2020-01-01T00:00:00.000Z' }),
        group({ groupId: 'unrecommended', label: 'Unrecommended' }),
      ]);
    render(
      element({
        recommendations: [
          recommendation(),
          recommendation({ groupId: 'maybe', confidence: 0.69 }),
          recommendation({ groupId: 'restricted' }),
          recommendation({ groupId: 'expired' }),
        ],
      }),
    );

    expect(await screen.findByRole('heading', { name: 'Groups (2)' })).toBeInTheDocument();
    expect(box(/AI Optimists/)).not.toBeChecked();
    expect(box(/Maybe/)).not.toBeChecked();
    const row = within(box(/AI Optimists/).closest('label')!);
    expect(row.getByText('Your reviewed answer explicitly supported optimistic AI governance.')).toBeInTheDocument();
    // A quote only grounds the match: it may name a place smaller than a country, so it never shows.
    expect(screen.queryByText(/I support open AI development/)).toBeNull();
    for (const hidden of ['Restricted', 'Expired', 'Unrecommended']) expect(screen.queryByText(hidden)).toBeNull();
    expect(getWorkerSessionToken).not.toHaveBeenCalled();
    expect(joinWorkerGroup).not.toHaveBeenCalled();
  });

  it('keeps suggestion order, so a group named like a chosen answer stays first, and shows every match', async () => {
    const many = Array.from({ length: 6 }, (_, index) => group({ groupId: `g${index}`, label: `Group ${index}` }));
    jest.mocked(loadPublicWorkerGroups).mockResolvedValue([...many, group({ groupId: 'dacc', label: 'd/acc' })]);
    const named = recommendation({ groupId: 'dacc', reason: 'You chose “d/acc”.', evidence: '', confidence: 1 });
    const view = render(element({ recommendations: [named, recommendation({ groupId: 'g0', confidence: 0.4 })] }));
    await screen.findByRole('heading', { name: 'Groups (2)' });
    fireEvent.click(box(/Group 0/));
    // The session's AI answers later; its matches join the end, even stronger ones, so no row moves.
    view.rerender(
      element({
        recommendations: [
          named,
          recommendation({ groupId: 'g0', confidence: 0.4 }),
          ...many.slice(1).map(({ groupId }) => recommendation({ groupId, confidence: 1 })),
        ],
      }),
    );
    expect(await screen.findByRole('heading', { name: 'Groups (7)' })).toBeInTheDocument();
    expect(
      screen.getAllByRole('checkbox').map((input) => input.closest('label')?.querySelector('strong')?.textContent),
    ).toEqual(['d/acc', ...many.map(({ label }) => label)]);
    expect(box(/Group 0/)).toBeChecked();
  });

  it('tells the page whether any group is ticked, and that none is once it goes', async () => {
    const onTickedChange = jest.fn();
    const view = render(element({ onTickedChange }));
    fireEvent.click(await screen.findByRole('checkbox', { name: /AI Optimists/ }));
    expect(onTickedChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(box(/AI Optimists/));
    expect(onTickedChange).toHaveBeenLastCalledWith(false);
    fireEvent.click(box(/AI Optimists/));
    view.unmount();
    expect(onTickedChange).toHaveBeenLastCalledWith(false);
  });

  it('lists a pending join link’s group first and ticked, and unticking cancels that join', async () => {
    pendingLink();
    jest.mocked(loadPublicWorkerGroups).mockResolvedValue([group(), group({ groupId: 'salon', label: 'Salon' })]);
    const onTickedChange = jest.fn();
    const { container } = render(element({ onTickedChange }));

    expect(await screen.findByRole('heading', { name: 'Groups (2)' })).toBeInTheDocument();
    // A signed-out person sees the groups through their link.
    expect(loadPublicWorkerGroups).toHaveBeenCalledWith(expect.objectContaining({ joinGroup: 'salon' }));
    const [first] = screen.getAllByRole('checkbox');
    expect(first).toBe(box(/Salon/));
    expect(within(first.closest('label')!).getByText('From your link.')).toBeInTheDocument();
    expect(first).toBeChecked();
    // Only the link's group starts ticked, not even a strong match.
    expect(box(/AI Optimists/)).not.toBeChecked();
    expect(onTickedChange).toHaveBeenLastCalledWith(true);
    // The link's own notice stands aside while its group is listed here.
    expect(container.querySelector('[data-ce-auto-join-claim="salon"]')).not.toBeNull();

    fireEvent.click(first);
    expect(first).not.toBeChecked();
    expect(isWorkerGroupAutoJoinCancelled(linkScope)).toBe(true);
    expect(readPendingAutoJoin()).toBeNull();
    expect(onTickedChange).toHaveBeenLastCalledWith(false);

    fireEvent.click(first);
    expect(first).toBeChecked();
    expect(isWorkerGroupAutoJoinCancelled(linkScope)).toBe(false);
    expect(readPendingAutoJoin()).toEqual(expect.objectContaining({ groupId: 'salon', sessionSlug: 'demo' }));
  });

  it('ignores another session’s link, and one already cancelled', async () => {
    pendingLink('salon', 'other');
    const first = render(element({ recommendations: [] }));
    await waitFor(() => expect(loadPublicWorkerGroups).not.toHaveBeenCalled());
    expect(screen.queryByRole('checkbox')).toBeNull();
    first.unmount();

    pendingLink();
    localStorage.setItem(
      `ce:worker-group-auto-join-cancelled:v1:${JSON.stringify([workerUrl, 'demo', 'salon'])}`,
      JSON.stringify({ cancelled: true }),
    );
    render(element({ recommendations: [] }));
    await waitFor(() => expect(loadPublicWorkerGroups).not.toHaveBeenCalled());
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('joins the ticked groups only after a submit, skipping unticked ones, and reports each outcome', async () => {
    const groups = [
      group(),
      group({ groupId: 'maybe', label: 'Maybe' }),
      group({ groupId: 'full', label: 'Full house' }),
    ];
    jest.mocked(loadPublicWorkerGroups).mockResolvedValue(groups);
    jest.mocked(loadWorkerGroupOverview).mockResolvedValue(overview(groups));
    jest.mocked(joinWorkerGroup).mockImplementation(async ({ groupId }) => {
      if (groupId === 'full') throw new Error('worker_group_member_cap_exceeded');
      return { group: group({ groupId: String(groupId) }), memberCount: 1 };
    });
    const recommendations = [
      recommendation(),
      recommendation({ groupId: 'maybe', confidence: 0.4 }),
      recommendation({ groupId: 'full', confidence: 0.95 }),
    ];
    const onGroupsChanged = jest.fn();
    const view = render(element({ ...signedIn, recommendations, onGroupsChanged }));
    await screen.findByRole('heading', { name: 'Groups (3)' });
    fireEvent.click(box(/AI Optimists/));
    fireEvent.click(box(/Full house/));
    expect(joinWorkerGroup).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Join ticked groups' })).toBeNull();

    view.rerender(element({ ...signedIn, recommendations, onGroupsChanged, joinRequest: 1 }));
    expect(await screen.findByText('Joined AI Optimists.')).toHaveAttribute('role', 'status');
    expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t join Full house: it is full.');
    expect(jest.mocked(joinWorkerGroup).mock.calls.map(([args]) => args.groupId)).toEqual(['ai-optimists', 'full']);
    expect(joinWorkerGroup).toHaveBeenCalledWith(
      expect.objectContaining({ workerUrl, credentialToken: 'token', sessionId, sessionSlug: 'demo' }),
    );
    expect(dispatchWorkerGroupsChanged).toHaveBeenCalledWith({ sessionSlug: 'demo', sessionId });
    expect(onGroupsChanged).toHaveBeenCalledTimes(1);
    // The joined group leaves the list; the full one stays ticked to try again.
    expect(screen.queryByRole('checkbox', { name: /AI Optimists/ })).toBeNull();
    expect(box(/Full house/)).toBeChecked();
    expect(box(/Maybe/)).not.toBeChecked();

    // The same submit never joins twice.
    view.rerender(element({ ...signedIn, recommendations, onGroupsChanged, joinRequest: 1 }));
    expect(joinWorkerGroup).toHaveBeenCalledTimes(2);
    jest.mocked(joinWorkerGroup).mockResolvedValue({ group: group({ groupId: 'full' }), memberCount: 2 });
    fireEvent.click(screen.getByRole('button', { name: 'Join ticked groups' }));
    expect(await screen.findByText('Joined Full house.')).toBeInTheDocument();
    expect(joinWorkerGroup).toHaveBeenCalledTimes(3);
  });

  it('does not join again when it reappears after a submit, as after another interview round', async () => {
    pendingLink();
    const groups = [group(), group({ groupId: 'salon', label: 'Salon' })];
    jest.mocked(loadPublicWorkerGroups).mockResolvedValue(groups);
    jest.mocked(loadWorkerGroupOverview).mockResolvedValue(overview(groups));
    render(element({ ...signedIn, joinRequest: 5 }));
    await screen.findByRole('heading', { name: 'Groups (2)' });
    expect(box(/Salon/)).toBeChecked();
    await waitFor(() => expect(loadPublicWorkerGroups).toHaveBeenCalled());
    expect(getWorkerSessionToken).not.toHaveBeenCalled();
    expect(joinWorkerGroup).not.toHaveBeenCalled();
    // Ticked groups still join on request.
    fireEvent.click(screen.getByRole('button', { name: 'Join ticked groups' }));
    expect(await screen.findByText('Joined Salon.')).toBeInTheDocument();
  });

  it('counts a membership as joined without asking the Worker to join again', async () => {
    jest
      .mocked(loadWorkerGroupOverview)
      .mockResolvedValue(
        overview([group()], [{ group: group(), member: { groupId: 'ai-optimists', sessionSlug: 'demo' } }]),
      );
    const view = render(element(signedIn));
    await screen.findByRole('heading', { name: 'Groups (1)' });
    fireEvent.click(box(/AI Optimists/));
    view.rerender(element({ ...signedIn, joinRequest: 1 }));
    expect(await screen.findByText('Joined AI Optimists.')).toBeInTheDocument();
    expect(joinWorkerGroup).not.toHaveBeenCalled();
  });

  it('refuses a group that closed since it was suggested', async () => {
    const view = render(element(signedIn));
    await screen.findByRole('heading', { name: 'Groups (1)' });
    fireEvent.click(box(/AI Optimists/));
    jest
      .mocked(loadWorkerGroupOverview)
      .mockResolvedValue(overview([group({ joinEndsAt: '2020-01-01T00:00:00.000Z' })]));
    view.rerender(element({ ...signedIn, joinRequest: 1 }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Couldn’t join AI Optimists: it is no longer open to join.',
    );
    expect(joinWorkerGroup).not.toHaveBeenCalled();
  });

  it('joins a link’s group with the others and finishes its link', async () => {
    pendingLink();
    const groups = [group(), group({ groupId: 'salon', label: 'Salon' })];
    jest.mocked(loadPublicWorkerGroups).mockResolvedValue(groups);
    jest.mocked(loadWorkerGroupOverview).mockResolvedValue(overview(groups));
    const view = render(element());
    await screen.findByRole('heading', { name: 'Groups (2)' });
    view.rerender(element({ ...signedIn, joinRequest: 1 }));
    expect(await screen.findByText('Joined Salon.')).toBeInTheDocument();
    expect(jest.mocked(joinWorkerGroup).mock.calls.map(([args]) => args.groupId)).toEqual(['salon']);
    expect(readPendingAutoJoin()).toBeNull();
  });

  it('never joins for someone signed out', async () => {
    const view = render(element());
    await screen.findByRole('heading', { name: 'Groups (1)' });
    fireEvent.click(box(/AI Optimists/));
    view.rerender(element({ joinRequest: 1 }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Log in to join groups.');
    expect(getWorkerSessionToken).not.toHaveBeenCalled();
    expect(joinWorkerGroup).not.toHaveBeenCalled();
  });

  it('says it is looking while suggestions load, and when groups are unavailable', async () => {
    const view = render(element({ recommendations: [], availability: 'loading' }));
    expect(screen.getByRole('status')).toHaveTextContent('Finding groups that fit your answers…');
    jest.mocked(loadPublicWorkerGroups).mockRejectedValue(new Error('worker_group_discovery_not_public'));
    view.rerender(element());
    expect(await screen.findByText('Groups are unavailable right now.')).toBeInTheDocument();
  });

  it('offers a refresh that keeps keyboard focus in the Groups section', async () => {
    const onRefresh = jest.fn();
    render(element({ recommendations: [], onRefresh }));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh group suggestions' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Groups (0)' }).closest('summary')).toHaveFocus();
  });

  it('keeps its ticks out of sight during another interview round, and gives the link back meanwhile', async () => {
    pendingLink();
    jest.mocked(loadPublicWorkerGroups).mockResolvedValue([group(), group({ groupId: 'salon', label: 'Salon' })]);
    const view = render(element());
    await screen.findByRole('heading', { name: 'Groups (2)' });
    fireEvent.click(box(/AI Optimists/));
    expect(box(/AI Optimists/)).toBeChecked();
    expect(document.querySelector('[data-ce-auto-join-claim="salon"]')).not.toBeNull();
    view.rerender(element({ hidden: true }));
    expect(screen.getByRole('heading', { name: 'Groups (2)', hidden: true }).closest('details')).not.toBeVisible();
    // While it is out of sight the link's own notice comes back.
    expect(document.querySelector('[data-ce-auto-join-claim]')).toBeNull();
    view.rerender(element());
    expect(box(/AI Optimists/)).toBeChecked();
    expect(box(/Salon/)).toBeChecked();
  });

  it('keeps what it listed, ticks and all, while an edit has cleared the suggestions', async () => {
    jest
      .mocked(loadPublicWorkerGroups)
      .mockResolvedValue([
        group(),
        group({ groupId: 'maybe', label: 'Maybe' }),
        group({ groupId: 'new', label: 'New' }),
      ]);
    const listed = [recommendation(), recommendation({ groupId: 'maybe', confidence: 0.4 })];
    const view = render(element({ recommendations: listed, availability: 'available' }));
    await screen.findByRole('heading', { name: 'Groups (2)' });
    fireEvent.click(box(/AI Optimists/));
    fireEvent.click(box(/Maybe/));
    view.rerender(element({ recommendations: [], availability: 'idle' }));
    expect(box(/AI Optimists/)).toBeChecked();
    expect(box(/Maybe/)).toBeChecked();
    view.rerender(element({ recommendations: [], availability: 'loading' }));
    expect(box(/Maybe/)).toBeChecked();
    expect(screen.getByRole('status')).toHaveTextContent('Finding groups that fit your answers…');
    // Fresh suggestions replace them.
    view.rerender(element({ recommendations: [recommendation({ groupId: 'new' })], availability: 'available' }));
    expect(await screen.findByRole('heading', { name: 'Groups (1)' })).toBeInTheDocument();
    expect(box(/New/)).not.toBeChecked();
    expect(screen.queryByRole('checkbox', { name: /AI Optimists/ })).toBeNull();
  });

  it('drops the link’s group once it is joined elsewhere, as at sign-in', async () => {
    pendingLink();
    saveWorkerSignIn();
    const groups = [group(), group({ groupId: 'salon', label: 'Salon' })];
    jest.mocked(loadWorkerGroupOverview).mockResolvedValue(overview(groups));
    render(element(signedIn));
    expect(await screen.findByRole('checkbox', { name: /Salon/ })).toBeChecked();
    expect(loadPublicWorkerGroups).not.toHaveBeenCalled();
    jest
      .mocked(loadWorkerGroupOverview)
      .mockResolvedValue(overview(groups, [{ group: groups[1], member: { groupId: 'salon', sessionSlug: 'demo' } }]));
    act(() => {
      announceGroupsChanged({ sessionSlug: 'other', sessionId });
    });
    expect(screen.getByRole('checkbox', { name: /Salon/ })).toBeInTheDocument();
    act(() => {
      announceGroupsChanged({ sessionSlug: 'demo', sessionId });
    });
    await waitFor(() => expect(screen.queryByRole('checkbox', { name: /Salon/ })).toBeNull());
    expect(screen.getByRole('heading', { name: 'Groups (1)' })).toBeInTheDocument();
  });

  it('forgets what one account joined when another signs in', async () => {
    const view = render(element(signedIn));
    await screen.findByRole('heading', { name: 'Groups (1)' });
    fireEvent.click(box(/AI Optimists/));
    view.rerender(element({ ...signedIn, joinRequest: 1 }));
    expect(await screen.findByText('Joined AI Optimists.')).toBeInTheDocument();
    const other = '0x0000000000000000000000000000000000000002';
    view.rerender(element({ account: other, loginComplete: true, joinRequest: 1 }));
    await waitFor(() => expect(screen.queryByText('Joined AI Optimists.')).toBeNull());
    expect(await screen.findByRole('checkbox', { name: /AI Optimists/ })).not.toBeChecked();
  });

  it('clears one account’s ticks when another signs in, but keeps the link’s, which the browser holds', async () => {
    pendingLink();
    jest
      .mocked(loadPublicWorkerGroups)
      .mockResolvedValue([
        group(),
        group({ groupId: 'salon', label: 'Salon' }),
        group({ groupId: 'maybe', label: 'Maybe' }),
      ]);
    const view = render(
      element({ ...signedIn, recommendations: [recommendation(), recommendation({ groupId: 'maybe' })] }),
    );
    await screen.findByRole('heading', { name: 'Groups (3)' });
    fireEvent.click(box(/AI Optimists/));
    fireEvent.click(box(/Salon/));
    expect(isWorkerGroupAutoJoinCancelled(linkScope)).toBe(true);
    view.rerender(
      element({
        account: '0x0000000000000000000000000000000000000002',
        loginComplete: true,
        recommendations: [recommendation(), recommendation({ groupId: 'maybe' })],
      }),
    );
    expect(await screen.findByRole('checkbox', { name: /AI Optimists/ })).not.toBeChecked();
    expect(box(/Maybe/)).not.toBeChecked();
    expect(box(/Salon/)).not.toBeChecked();
    expect(isWorkerGroupAutoJoinCancelled(linkScope)).toBe(true);
  });

  it('shows each group’s image beside its name, only from a safe address', async () => {
    jest
      .mocked(loadPublicWorkerGroups)
      .mockResolvedValue([
        group({ imageUrl: 'https://images.example/optimists.png' }),
        group({ groupId: 'plain', label: 'Plain' }),
        group({ groupId: 'unsafe', label: 'Unsafe', imageUrl: 'http://images.example/unsafe.png' }),
      ]);
    render(
      element({
        recommendations: [
          recommendation(),
          recommendation({ groupId: 'plain' }),
          recommendation({ groupId: 'unsafe' }),
        ],
      }),
    );
    const image = await screen.findByTestId('ce-session-interview-group-image-ai-optimists');
    expect(image).toHaveAttribute('src', 'https://images.example/optimists.png');
    // Decorative: the name beside it already labels the tick box.
    expect(image).toHaveAttribute('alt', '');
    expect(box(/AI Optimists/).closest('label')).toContainElement(image);
    expect(screen.queryByTestId('ce-session-interview-group-image-plain')).toBeNull();
    expect(screen.queryByTestId('ce-session-interview-group-image-unsafe')).toBeNull();
    expect(box(/^AI Optimists/)).toBeInTheDocument();
  });

  it('shows nothing with no groups to list and nothing pending', () => {
    const { container } = render(element({ recommendations: [] }));
    expect(container).toBeEmptyDOMElement();
  });
});
