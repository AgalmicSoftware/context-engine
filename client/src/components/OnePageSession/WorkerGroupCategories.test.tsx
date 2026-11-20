import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AgentClientLoginEnvelope } from '../../utilities/session/agentClientLogin';
import type { WorkerGroup } from '../../domains/worker/workerGroupPorts';
import WorkerGroupMembershipPanel from './WorkerGroupMembershipPanel';
import { DEFAULT_NEW_SESSION_SBT_TAGS } from '../Sessions/sessionWizardDraftState';
import { groupWorkerGroupsByCategory, UNCHOSEN_GROUP_TAGS } from './workerGroupCategoryOrder';

const SESSION_ID = '0x11111111111111111111111111111111';
const envelope: AgentClientLoginEnvelope = {
  v: 3,
  sessionId: SESSION_ID,
  sessionSlug: 'alpha',
  expiresAt: '2027-07-05T00:00:00.000Z',
  address: '0x00000000000000000000000000000000000000aa',
  capabilities: { readGroups: true },
  agentCredential: { kind: 'session_agent_browser_token', token: 'agent-browser-token' },
  workerCredential: { kind: 'session_worker_jwt', token: 'worker-jwt-token' },
  workerUrl: 'https://session-worker.example',
};

const group = (groupId: string, label: string, tags: string[], joinMode = 'open'): WorkerGroup =>
  ({ groupId, sessionSlug: 'alpha', label, tags, joinMode, memberVisibility: 'session' }) as WorkerGroup;

const GROUPS = [
  group('robins', 'Robins', ['stance']),
  group('another-place', 'Another place', ['Region']),
  group('north', 'Northland', ['Region']),
  group('east', 'Eastland', ['region']),
  group('builders', 'Builders', ['role']),
  group('core', 'Core team', ['role'], 'group_password'),
  group('loose', 'Loose ends', []),
];

const json = (body: unknown) =>
  new Response(JSON.stringify({ ok: true, sessionId: SESSION_ID, sessionSlug: 'alpha', ...(body as object) }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const fakeWorker = (groups: WorkerGroup[], { refuse = false, member = [] as WorkerGroup[] } = {}) => {
  const joined = new Set<string>(member.map((entry) => entry.groupId));
  const known = [...groups, ...member];
  return jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const pathname = new URL(String(input)).pathname;
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const found = known.find((entry) => entry.groupId === body.groupId);
    if (pathname.endsWith('/groups/join') && refuse) {
      return new Response(JSON.stringify({ ok: false, reason: 'worker_group_full' }), {
        status: 409,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (pathname.endsWith('/groups/join')) {
      joined.add(body.groupId);
      return json({ group: found, memberCount: 1 });
    }
    if (pathname.endsWith('/groups/leave')) {
      joined.delete(body.groupId);
      return json({ groupId: body.groupId, group: found, memberCount: 0 });
    }
    if (pathname.endsWith('/groups/my-memberships')) {
      return json({
        memberships: known
          .filter((entry) => joined.has(entry.groupId))
          .map((entry) => ({ group: entry, member: { sessionSlug: 'alpha', principalKey: 'evm:0xaa' } })),
      });
    }
    return json({ groups });
  });
};

const setWide = (wide: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: wide,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }),
  });
};

describe('groupWorkerGroupsByCategory', () => {
  it('orders categories A–Z by name, with catch-alls and untagged groups last', () => {
    const categories = groupWorkerGroupsByCategory(GROUPS.map((entry) => ({ group: entry, isMember: false })));
    expect(categories.map(({ name }) => name)).toEqual(['Region', 'Role', 'Stance', 'Other groups']);
    expect(categories[0].entries.map(({ group: entry }) => entry.label)).toEqual([
      'Eastland',
      'Northland',
      'Another place',
    ]);
  });

  it("names a category from its tag: dashes as spaces, a capital first letter, the tag's own case kept", () => {
    const tagged = [group('a', 'A', ['ai-agents']), group('b', 'B', ['UN_regions']), group('c', 'C', ['zebra'])];
    const categories = groupWorkerGroupsByCategory(tagged.map((entry) => ({ group: entry, isMember: false })));
    expect(categories.map(({ name }) => name)).toEqual(['Ai agents', 'UN regions', 'Zebra']);
  });

  it("puts a group still carrying the create form's untouched default tags with the untagged ones", () => {
    expect(UNCHOSEN_GROUP_TAGS.join(', ')).toBe(DEFAULT_NEW_SESSION_SBT_TAGS);
    const tagged = [
      group('a', 'A', ['Location', 'idea', 'event', 'group', 'demographic']),
      group('b', 'B', ['group', 'event', 'idea', 'demographic']),
      group('c', 'C', ['region']),
    ];
    const categories = groupWorkerGroupsByCategory(tagged.map((entry) => ({ group: entry, isMember: false })));
    expect(categories.map(({ name, entries }) => [name, entries.map((entry) => entry.group.label)])).toEqual([
      ['Group', ['B']],
      ['Region', ['C']],
      ['Other groups', ['A']],
    ]);
  });

  it("sends a category's catch-all group last, after names that sort before it", () => {
    const roles = [
      group('r', 'Researcher', ['role']),
      group('x', 'Another role', ['role']),
      group('a', 'AI agents', ['role']),
    ];
    const other = group('o', 'Elsewhere', ['region']);
    const categories = groupWorkerGroupsByCategory(
      [...roles, other].map((entry) => ({ group: entry, isMember: false })),
    );
    expect(categories[1].entries.map((entry) => entry.group.label)).toEqual([
      'AI agents',
      'Researcher',
      'Another role',
    ]);
  });

  it('keeps a tag named Other apart from the untagged groups', () => {
    const tagged = [group('a', 'A', ['other']), group('b', 'B', []), group('c', 'C', ['zebra'])];
    const categories = groupWorkerGroupsByCategory(tagged.map((entry) => ({ group: entry, isMember: false })));
    expect(categories.map(({ key, name }) => [key, name])).toEqual([
      ['other', 'Other'],
      ['zebra', 'Zebra'],
      ['', 'Other groups'],
    ]);
  });

  it('gives no categories when no group carries a tag, or every group shares one', () => {
    expect(groupWorkerGroupsByCategory([{ group: group('a', 'A', []), isMember: false }])).toEqual([]);
    const shared = [group('a', 'A', ['role']), group('b', 'B', ['Role', 'other'])];
    expect(groupWorkerGroupsByCategory(shared.map((entry) => ({ group: entry, isMember: false })))).toEqual([]);
  });
});

describe('WorkerGroupMembershipPanel categories', () => {
  beforeEach(() => setWide(false));

  it('shows a closed accordion on a phone, joins with one tap and says what was joined', async () => {
    const fetchImpl = fakeWorker(GROUPS);
    render(<WorkerGroupMembershipPanel envelope={envelope} fetchImpl={fetchImpl as typeof fetch} />);

    const region = await screen.findByRole('button', { name: /^Region/ });
    expect(region).toHaveAttribute('aria-expanded', 'false');
    expect(region).toHaveTextContent('3 groups');
    expect(screen.queryByRole('button', { name: 'Join Eastland' })).not.toBeInTheDocument();

    fireEvent.click(region);
    expect(region).toHaveAttribute('aria-expanded', 'true');
    const list = document.getElementById(String(region.getAttribute('aria-controls')))!;
    expect(
      within(list)
        .getAllByRole('article')
        .map((row) => row.getAttribute('aria-label')),
    ).toEqual(['Eastland', 'Northland', 'Another place']);

    fireEvent.click(within(list).getByRole('button', { name: 'Join Eastland' }));
    expect(await screen.findByRole('button', { name: 'Leave Eastland' })).toBeInTheDocument();
    expect(within(list).getByRole('article', { name: 'Eastland' })).toHaveTextContent('Joined');

    fireEvent.click(region);
    expect(region).toHaveTextContent('Eastland');
    expect(region).not.toHaveTextContent('3 groups');

    fireEvent.click(region);
    fireEvent.click(screen.getByRole('button', { name: 'Leave Eastland' }));
    expect(await screen.findByRole('button', { name: 'Join Eastland' })).toBeInTheDocument();
  });

  it('keeps the code flow for a group that needs one, behind Enter code', async () => {
    render(<WorkerGroupMembershipPanel envelope={envelope} fetchImpl={fakeWorker(GROUPS) as typeof fetch} />);
    fireEvent.click(await screen.findByRole('button', { name: /^Role/ }));
    const enter = screen.getByRole('button', { name: 'Enter code for Core team' });
    expect(enter).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('Invite link or password for Core team')).not.toBeInTheDocument();
    fireEvent.click(enter);
    expect(enter).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById(String(enter.getAttribute('aria-controls')))).toContainElement(
      screen.getByLabelText('Invite link or password for Core team'),
    );
  });

  it('shows every category open side by side on a wide screen', async () => {
    setWide(true);
    render(<WorkerGroupMembershipPanel envelope={envelope} fetchImpl={fakeWorker(GROUPS) as typeof fetch} />);
    expect(await screen.findByRole('heading', { name: /^Region/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Region/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join Robins' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join Loose ends' })).toBeInTheDocument();
  });

  it('asks a signed-out visitor to sign in from Join, then joins that group', async () => {
    const onSignIn = jest.fn();
    render(
      <WorkerGroupMembershipPanel
        allowAnonymousGroupDiscovery
        canReadGroups
        workerUrl={envelope.workerUrl}
        sessionId={SESSION_ID}
        sessionSlug="alpha"
        onSignIn={onSignIn}
        fetchImpl={fakeWorker(GROUPS) as typeof fetch}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: /^Stance/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to join Robins' }));
    expect(onSignIn).toHaveBeenCalledWith('robins');
  });

  it('comes back from a group page to its open category with the focus on that group', async () => {
    render(
      <WorkerGroupMembershipPanel envelope={envelope} inlineDetails fetchImpl={fakeWorker(GROUPS) as typeof fetch} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: /^Stance/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Open group details for Robins' }));
    fireEvent.click(await screen.findByRole('button', { name: '← Back to Groups' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open group details for Robins' })).toHaveFocus());
    expect(screen.getByRole('button', { name: /^Stance/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows a join refused after sign-in in its open category, under the row', async () => {
    render(
      <WorkerGroupMembershipPanel
        envelope={envelope}
        joinAfterSignInGroupId="robins"
        fetchImpl={fakeWorker(GROUPS, { refuse: true }) as typeof fetch}
      />,
    );
    const row = await screen.findByRole('article', { name: 'Robins' });
    expect(await within(row).findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Stance/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('opens the code field with the reason when a code joined after sign-in is refused', async () => {
    render(
      <WorkerGroupMembershipPanel
        envelope={envelope}
        joinAfterSignInGroupId="core"
        joinAfterSignInToken="wrong-password"
        fetchImpl={fakeWorker(GROUPS, { refuse: true }) as typeof fetch}
      />,
    );
    const field = await screen.findByLabelText('Invite link or password for Core team');
    expect(await within(field.closest('form')!).findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enter code for Core team' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('says Joined to a screen reader for a group its members may not leave', async () => {
    const kept = { ...group('kept', 'Kept circle', ['stance']), removalAuth: 'admin_only' } as WorkerGroup;
    render(
      <WorkerGroupMembershipPanel
        envelope={envelope}
        fetchImpl={fakeWorker([...GROUPS, kept], { member: [] }) as typeof fetch}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: /^Stance/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Join Kept circle' }));
    const name = await screen.findByRole('button', {
      name: 'Open group details for Kept circle',
      description: /Joined/,
    });
    expect(within(name.closest('article')!).queryByRole('button', { name: /Leave/ })).not.toBeInTheDocument();
  });

  it('puts a joined group missing from the list in its category and its closed summary', async () => {
    render(
      <WorkerGroupMembershipPanel
        envelope={envelope}
        fetchImpl={fakeWorker(GROUPS, { member: [group('hidden', 'Hidden harbour', ['region'])] }) as typeof fetch}
      />,
    );
    const region = await screen.findByRole('button', { name: /^Region/ });
    expect(region).toHaveTextContent('Hidden harbour');
    fireEvent.click(region);
    expect(screen.getByRole('article', { name: 'Hidden harbour' })).toHaveTextContent('Joined');
  });

  it('keeps the cards when no group carries a tag', async () => {
    render(
      <WorkerGroupMembershipPanel
        envelope={envelope}
        fetchImpl={fakeWorker([group('a', 'Alpha', []), group('b', 'Beta', [])]) as typeof fetch}
      />,
    );
    expect(await screen.findByRole('button', { name: 'Join Alpha' })).toBeInTheDocument();
    expect(screen.queryByTestId('ce-session-worker-group-categories')).not.toBeInTheDocument();
  });
});
