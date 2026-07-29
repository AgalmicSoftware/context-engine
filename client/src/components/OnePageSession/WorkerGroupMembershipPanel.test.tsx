import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AgentClientLoginEnvelope } from '../../utilities/session/agentClientLogin';
import WorkerGroupMembershipPanel, {
  resolveWorkerGroupJoinWindowDisplay,
} from './WorkerGroupMembershipPanel';

const SESSION_ID = '0x11111111111111111111111111111111';
const OTHER_SESSION_ID = '0x22222222222222222222222222222222';

const envelope: AgentClientLoginEnvelope = {
  v: 2,
  sessionId: SESSION_ID,
  sessionSlug: 'alpha',
  expiresAt: '2027-07-05T00:00:00.000Z',
  address: '0x00000000000000000000000000000000000000aa',
  capabilities: { readGroups: true },
  bridgeCredential: { kind: 'agent_bridge_browser_token', token: 'bridge-browser-token' },
  workerCredential: { kind: 'session_worker_jwt', token: 'worker-jwt-token' },
  workerUrl: 'https://session-worker.example',
};

describe('WorkerGroupMembershipPanel', () => {
  beforeEach(() => {
    window.history.replaceState(
      {},
      '',
      '/session/alpha?worker=https%3A%2F%2Fworker.example&inv=must-not-copy&agentToken=must-not-copy',
    );
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
    Object.defineProperty(window, 'open', {
      configurable: true,
      value: jest.fn(),
    });
  });

  it('formats active, expired, and unlimited join windows without depending on wall-clock time', () => {
    expect(resolveWorkerGroupJoinWindowDisplay({ nowMs: Date.parse('2026-01-01T00:00:00.000Z') })).toEqual({
      status: 'never',
      countdownText: '',
      fullDateText: '',
    });
    expect(
      resolveWorkerGroupJoinWindowDisplay({
        joinEndsAt: '2026-01-02T02:00:00.000Z',
        nowMs: Date.parse('2026-01-01T00:00:00.000Z'),
      }),
    ).toMatchObject({
      status: 'active',
      countdownText: '1d 2h',
    });
    expect(
      resolveWorkerGroupJoinWindowDisplay({
        joinEndsAt: '2025-12-31T23:59:59.000Z',
        nowMs: Date.parse('2026-01-01T00:00:00.000Z'),
      }),
    ).toMatchObject({
      status: 'expired',
      countdownText: '',
    });
  });

  it('shows public groups without a credential and asks for sign-in only when joining', async () => {
    const onSignIn = jest.fn();
    const fetchImpl = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('Authorization')).toBeNull();
      expect(new Headers(init?.headers).get('X-Session-Slug')).toBe('alpha');
      return new Response(
        JSON.stringify({
          ok: true,
          sessionId: SESSION_ID,
          sessionSlug: 'alpha',
          groups: [
            {
              groupId: 'open-reviewers',
              sessionSlug: 'alpha',
              label: 'Open reviewers',
              description: 'Visible before sign-in.',
              tags: ['research', 'reviewers'],
              documentURLs: ['https://docs.example.test/brief'],
              memberLimit: 25,
              joinEndsAt: '2030-01-01T12:00:00.000Z',
              adminAddress: '0x00000000000000000000000000000000000000aa',
              joinMode: 'open',
              memberVisibility: 'session',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });

    render(
      <WorkerGroupMembershipPanel
        allowAnonymousGroupDiscovery={true}
        canReadGroups={true}
        workerUrl="https://session-worker.example"
        sessionId={SESSION_ID}
        sessionSlug="alpha"
        fetchImpl={fetchImpl as typeof fetch}
        onSignIn={onSignIn}
      />,
    );

    const groupTitle = await screen.findByText('Open reviewers');
    const groupCard = screen.getByRole('article', { name: 'Open reviewers' });
    expect(groupTitle).toHaveClass('miniSbtName');
    expect(groupCard).toHaveClass('sbtItem', 'workerGroupCard');
    expect(groupCard.parentElement).toHaveClass('sbtGrid', 'workerGroupCardGrid');
    expect(screen.getByText('Visible before sign-in.')).toHaveClass('workerGroupCardDescription');
    expect(screen.queryByText(/visible without signing in/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Details')).not.toBeInTheDocument();
    expect(screen.queryByText('Tags: research, reviewers')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open group details for Open reviewers' }));
    expect(window.open).toHaveBeenCalledWith(
      'http://localhost/group/open-reviewers?sessionName=alpha',
      '_blank',
      'noopener,noreferrer',
    );
    const joinButton = screen.getByRole('button', { name: 'Sign in to join Open reviewers' });
    expect(joinButton).toHaveTextContent(/^Join$/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    fireEvent.click(joinButton);
    expect(onSignIn).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('renders a selected worker group in the normal full-detail layout', async () => {
    const fetchImpl = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: 'alpha',
            groups: [
              {
                groupId: 'open-reviewers',
                sessionSlug: 'alpha',
                label: 'Open reviewers',
                description: 'Visible before sign-in.',
                imageUrl: 'https://ar-io.dev/open-reviewers',
                tags: ['research', 'reviewers'],
                documentURLs: ['https://docs.example.test/brief'],
                memberLimit: 25,
                joinEndsAt: '2030-01-01T12:00:00.000Z',
                adminAddress: '0x00000000000000000000000000000000000000aa',
                joinMode: 'open',
                memberVisibility: 'session',
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );

    render(
      <WorkerGroupMembershipPanel
        allowAnonymousGroupDiscovery={true}
        canReadGroups={true}
        workerUrl="https://session-worker.example"
        sessionId={SESSION_ID}
        sessionSlug="alpha"
        selectedGroupId="open-reviewers"
        fetchImpl={fetchImpl as typeof fetch}
      />,
    );

    expect(await screen.findByTestId('ce-worker-group-detail')).toHaveClass('sbtPage');
    expect(screen.getByRole('article', { name: 'Open reviewers' })).toHaveClass('sbtInfo', 'workerGroupDetailCard');
    expect(screen.getByText('Visible before sign-in.')).toBeInTheDocument();
    expect(screen.getByText('Joining open')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'STATS' })).toBeInTheDocument();
    expect(screen.getByText('Member limit:')).toBeInTheDocument();
    expect(screen.queryByText('Members:')).not.toBeInTheDocument();
    expect(screen.getByText('Joining ends:')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ACTIONS' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'MORE' })).toBeInTheDocument();
    expect(screen.getByText('Document URLs:')).toBeInTheDocument();
    expect(screen.getByText('Tags:')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'research' })).toHaveAttribute('href', '/tag/research');
    expect(screen.getByRole('link', { name: 'reviewers' })).toHaveAttribute('href', '/tag/reviewers');
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('0x00000000000000000000000000000000000000aa')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'https://docs.example.test/brief' })).toHaveAttribute(
      'href',
      'https://docs.example.test/brief',
    );
    expect(screen.getByRole('link', { name: /back to groups/i })).toHaveAttribute('href', '/groups?sessionName=alpha');
    expect(screen.getByRole('button', { name: 'Sign in to join Open reviewers' })).toHaveTextContent(/^Join$/);
    expect(screen.queryByRole('button', { name: 'View Open reviewers members' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open group details for Open reviewers' })).not.toBeInTheDocument();
  });

  it('shows the member count in detail only when the signed-in participant membership supplies it', async () => {
    const fetchImpl = jest.fn(async (input: RequestInfo | URL) => {
      const pathname = new URL(String(input)).pathname;
      if (pathname.endsWith('/groups/my-memberships')) {
        return new Response(
          JSON.stringify({
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: 'alpha',
            memberships: [
              {
                group: {
                  groupId: 'members',
                  sessionSlug: 'alpha',
                  label: 'Members',
                  memberLimit: 10,
                  joinMode: 'admin_add',
                  memberVisibility: 'members',
                },
                member: { sessionSlug: 'alpha', principalKey: 'evm:0xaa' },
                memberCount: 4,
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({
          ok: true,
          sessionId: SESSION_ID,
          sessionSlug: 'alpha',
          groups: [],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });

    render(
      <WorkerGroupMembershipPanel
        envelope={envelope}
        selectedGroupId="members"
        fetchImpl={fetchImpl as typeof fetch}
      />,
    );

    expect(await screen.findByTestId('ce-worker-group-detail')).toBeInTheDocument();
    expect(screen.getByText('Joining closed')).toBeInTheDocument();
    expect(screen.getByText('Members:')).toBeInTheDocument();
    expect(screen.getByText('4 / 10')).toBeInTheDocument();
    expect(screen.queryByText('Member limit:')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Leave Members' })).toBeInTheDocument();
  });

  it('uses only an infinity icon for an unlimited group capacity', async () => {
    const fetchImpl = jest.fn(async (input: RequestInfo | URL) => {
      const pathname = new URL(String(input)).pathname;
      if (pathname.endsWith('/groups/my-memberships')) {
        return new Response(
          JSON.stringify({
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: 'alpha',
            memberships: [
              {
                group: {
                  groupId: 'unlimited',
                  sessionSlug: 'alpha',
                  label: 'Unlimited',
                  joinMode: 'admin_add',
                  memberVisibility: 'admin_only',
                },
                member: { sessionSlug: 'alpha', principalKey: 'evm:0xaa' },
                memberCount: 1,
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({
          ok: true,
          sessionId: SESSION_ID,
          sessionSlug: 'alpha',
          groups: [],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });

    render(
      <WorkerGroupMembershipPanel
        envelope={envelope}
        selectedGroupId="unlimited"
        fetchImpl={fetchImpl as typeof fetch}
      />,
    );

    expect(await screen.findByTestId('ce-worker-group-detail')).toBeInTheDocument();
    expect(screen.getByText('Members:')).toBeInTheDocument();
    expect(screen.getByTitle('Unlimited')).toBeInTheDocument();
    expect(screen.queryByText(/\/\s*Unlimited/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View Unlimited members' })).not.toBeInTheDocument();
  });

  it('opens a permission-visible member list and renders safe participant identities', async () => {
    const fetchImpl = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const pathname = new URL(String(input)).pathname;
      if (pathname.endsWith('/groups/my-memberships')) {
        return new Response(
          JSON.stringify({
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: 'alpha',
            memberships: [],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (pathname.endsWith('/groups/members')) {
        expect(init?.method).toBe('POST');
        expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer worker-jwt-token');
        expect(JSON.parse(String(init?.body))).toEqual({
          groupId: 'reviewers',
          limit: 100,
          sessionId: SESSION_ID,
        });
        return new Response(
          JSON.stringify({
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: 'alpha',
            group: {
              groupId: 'reviewers',
              sessionSlug: 'alpha',
              label: 'Reviewers',
              joinMode: 'open',
              memberVisibility: 'session',
            },
            members: [
              {
                groupId: 'reviewers',
                sessionSlug: 'alpha',
                principal: {
                  kind: 'evm_address',
                  address: '0x00000000000000000000000000000000000000aa',
                },
                principalKey: 'must-not-render',
              },
              {
                groupId: 'reviewers',
                sessionSlug: 'alpha',
                principal: { kind: 'telegram', principalId: 'telegram:12345' },
              },
            ],
            memberCount: 2,
            nextCursor: '',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({
          ok: true,
          sessionId: SESSION_ID,
          sessionSlug: 'alpha',
          groups: [
            {
              groupId: 'reviewers',
              sessionSlug: 'alpha',
              label: 'Reviewers',
              joinMode: 'open',
              memberVisibility: 'session',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });

    render(
      <WorkerGroupMembershipPanel
        envelope={envelope}
        selectedGroupId="reviewers"
        fetchImpl={fetchImpl as typeof fetch}
      />,
    );

    const viewMembersButton = await screen.findByRole('button', { name: 'View Reviewers members' });
    fireEvent.click(viewMembersButton);

    expect(await screen.findByText('Reviewers members')).toBeInTheDocument();
    expect(await screen.findByTitle('0x00000000000000000000000000000000000000aa')).toHaveAttribute(
      'href',
      '/u/0x00000000000000000000000000000000000000aa',
    );
    expect(screen.getByText('Telegram · telegram:12345')).toBeInTheDocument();
    expect(screen.getByText('(2)')).toBeInTheDocument();
    expect(screen.queryByText(/must-not-render/)).not.toBeInTheDocument();
    expect(fetchImpl.mock.calls.filter(([url]) => new URL(String(url)).pathname.endsWith('/groups/members'))).toHaveLength(
      1,
    );
  });

  it('omits descriptions from minimized cards without changing the full-view default', async () => {
    const fetchImpl = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: 'alpha',
            groups: [
              {
                groupId: 'compact-reviewers',
                sessionSlug: 'alpha',
                label: 'Compact reviewers',
                description: 'Only show this description in the full Groups view.',
                joinMode: 'open',
                memberVisibility: 'session',
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );

    render(
      <WorkerGroupMembershipPanel
        allowAnonymousGroupDiscovery={true}
        canReadGroups={true}
        workerUrl="https://session-worker.example"
        sessionId={SESSION_ID}
        sessionSlug="alpha"
        fetchImpl={fetchImpl as typeof fetch}
        showDescriptions={false}
      />,
    );

    const groupCard = await screen.findByRole('article', { name: 'Compact reviewers' });
    expect(screen.queryByText('Only show this description in the full Groups view.')).not.toBeInTheDocument();
    expect(groupCard).not.toHaveAttribute('aria-describedby');
  });

  it('hides the redundant list header and reloads when the parent refresh nonce changes', async () => {
    const fetchImpl = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: 'alpha',
            groups: [],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );
    const { rerender } = render(
      <WorkerGroupMembershipPanel
        allowAnonymousGroupDiscovery={true}
        canReadGroups={true}
        workerUrl="https://session-worker.example"
        sessionId={SESSION_ID}
        sessionSlug="alpha"
        fetchImpl={fetchImpl as typeof fetch}
        refreshNonce={0}
        showListHeader={false}
      />,
    );

    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument();

    rerender(
      <WorkerGroupMembershipPanel
        allowAnonymousGroupDiscovery={true}
        canReadGroups={true}
        workerUrl="https://session-worker.example"
        sessionId={SESSION_ID}
        sessionSlug="alpha"
        fetchImpl={fetchImpl as typeof fetch}
        refreshNonce={1}
        showListHeader={false}
      />,
    );

    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));
  });

  it('uses only the worker JWT, shows self-memberships, and joins visible open groups', async () => {
    let joined = false;
    const fetchImpl = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const parsedUrl = new URL(url);
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer worker-jwt-token');
      expect(JSON.stringify(init)).not.toContain('bridge-browser-token');
      if (parsedUrl.pathname.endsWith('/groups/join')) {
        joined = true;
        expect(JSON.parse(String(init?.body))).toEqual({ groupId: 'open-reviewers', sessionId: SESSION_ID });
        return new Response(
          JSON.stringify({
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: 'alpha',
            group: {
              groupId: 'open-reviewers',
              sessionSlug: 'alpha',
              label: 'Open reviewers',
              joinMode: 'open',
              memberVisibility: 'session',
            },
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        );
      }
      if (parsedUrl.pathname.endsWith('/groups/leave')) {
        joined = false;
        expect(JSON.parse(String(init?.body))).toEqual({ groupId: 'open-reviewers', sessionId: SESSION_ID });
        return new Response(
          JSON.stringify({
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: 'alpha',
            groupId: 'open-reviewers',
            principal: {
              kind: 'evm_address',
              address: '0x00000000000000000000000000000000000000aa',
            },
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        );
      }
      expect(parsedUrl.searchParams.get('sessionId')).toBe(SESSION_ID);
      if (parsedUrl.pathname.endsWith('/groups/my-memberships')) {
        return new Response(
          JSON.stringify({
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: 'alpha',
            memberships: [
              {
                group: {
                  groupId: joined ? 'open-reviewers' : 'members',
                  sessionSlug: 'alpha',
                  label: joined ? 'Open reviewers' : 'Members',
                  joinMode: joined ? 'open' : 'admin_add',
                  memberVisibility: 'session',
                },
                member: { sessionSlug: 'alpha', principalKey: 'evm:0xaa' },
                memberCount: joined ? 4 : 3,
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({
          ok: true,
          sessionId: SESSION_ID,
          sessionSlug: 'alpha',
          groups: [
            {
              groupId: 'open-reviewers',
              sessionSlug: 'alpha',
              label: 'Open reviewers',
              description: 'Join this access group.',
              imageUrl: 'https://ar-io.dev/open-reviewers-image',
              joinMode: 'open',
              memberVisibility: 'session',
            },
            {
              groupId: 'invited-reviewers',
              sessionSlug: 'alpha',
              label: 'Invited reviewers',
              description: 'Admins add identities to this group.',
              joinMode: 'admin_add',
              memberVisibility: 'session',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });

    render(<WorkerGroupMembershipPanel envelope={envelope} fetchImpl={fetchImpl as typeof fetch} />);

    expect(await screen.findByText('Members')).toBeInTheDocument();
    const groupImage = screen.getByTestId('ce-session-worker-group-image');
    expect(groupImage).toHaveAttribute('src', 'https://ar-io.dev/open-reviewers-image');
    expect(groupImage).toHaveClass('sbtImage');
    expect(groupImage.parentElement).toHaveClass('miniImageContainer');
    expect(screen.getByText('Invited reviewers')).toBeInTheDocument();
    expect(screen.queryByText('Details')).not.toBeInTheDocument();
    expect(screen.queryByText(/contract|network|rpc|gas|mint/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Copy Invited reviewers group link' }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1));
    const copiedGroupLink = new URL(String((navigator.clipboard.writeText as jest.Mock).mock.calls[0][0]));
    expect(copiedGroupLink.pathname).toBe('/group/invited-reviewers');
    expect(copiedGroupLink.hash).toBe('');
    expect(copiedGroupLink.searchParams.get('sessionName')).toBe('alpha');
    expect([...copiedGroupLink.searchParams.keys()]).toEqual(['sessionName']);
    expect(copiedGroupLink.searchParams.has('inv')).toBe(false);
    expect(copiedGroupLink.searchParams.has('agentToken')).toBe(false);
    expect(screen.getByText(/contains no invitation token or credential/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Join Open reviewers' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Joined Open reviewers.');
    expect(await screen.findByRole('button', { name: 'Leave Open reviewers' })).toBeInTheDocument();
    expect(fetchImpl.mock.calls.some(([url]) => new URL(String(url)).pathname.endsWith('/groups/join'))).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Leave Open reviewers' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Left Open reviewers.');
    expect(await screen.findByRole('button', { name: 'Join Open reviewers' })).toBeInTheDocument();
    expect(fetchImpl.mock.calls.some(([url]) => new URL(String(url)).pathname.endsWith('/groups/leave'))).toBe(true);
  });

  it('does not consume the worker credential when the exchanged source lacks group-read capability', () => {
    const fetchImpl = jest.fn();
    render(
      <WorkerGroupMembershipPanel
        envelope={{ ...envelope, capabilities: { readGroups: false } }}
        fetchImpl={fetchImpl as typeof fetch}
      />,
    );

    expect(screen.getByText('Groups are not included in this credential.')).toBeInTheDocument();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('clears the prior session and ignores late responses when only the exact session identity changes', async () => {
    let resolveFirstGroups: (response: Response) => void = () => {};
    let resolveFirstMemberships: (response: Response) => void = () => {};
    const fetchImpl = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const parsedUrl = new URL(url);
      const requestedSessionId = parsedUrl.searchParams.get('sessionId');
      if (requestedSessionId === SESSION_ID) {
        return new Promise<Response>((resolve) => {
          if (parsedUrl.pathname.endsWith('/groups/list')) resolveFirstGroups = resolve;
          else resolveFirstMemberships = resolve;
        });
      }
      expect(requestedSessionId).toBe(OTHER_SESSION_ID);
      if (parsedUrl.pathname.endsWith('/groups/my-memberships')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              sessionId: OTHER_SESSION_ID,
              sessionSlug: 'alpha',
              memberships: [],
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            },
          ),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ok: true,
            sessionId: OTHER_SESSION_ID,
            sessionSlug: 'alpha',
            groups: [
              {
                groupId: 'second-reviewers',
                sessionSlug: 'alpha',
                label: 'Second-identity reviewers',
                joinMode: 'open',
                memberVisibility: 'session',
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    });

    const { rerender } = render(
      <WorkerGroupMembershipPanel
        canReadGroups={true}
        workerUrl="https://session-worker.example"
        workerToken="same-token"
        sessionId={SESSION_ID}
        sessionSlug="alpha"
        fetchImpl={fetchImpl as typeof fetch}
      />,
    );
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));

    rerender(
      <WorkerGroupMembershipPanel
        canReadGroups={true}
        workerUrl="https://session-worker.example"
        workerToken="same-token"
        sessionId={OTHER_SESSION_ID}
        sessionSlug="alpha"
        fetchImpl={fetchImpl as typeof fetch}
      />,
    );

    expect(screen.queryByText('First-identity reviewers')).not.toBeInTheDocument();
    expect(await screen.findByText('Second-identity reviewers')).toBeInTheDocument();

    await act(async () => {
      resolveFirstGroups(
        new Response(
          JSON.stringify({
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: 'alpha',
            groups: [
              {
                groupId: 'first-reviewers',
                sessionSlug: 'alpha',
                label: 'First-identity reviewers',
                joinMode: 'open',
                memberVisibility: 'session',
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
      resolveFirstMemberships(
        new Response(JSON.stringify({ ok: true, sessionId: SESSION_ID, sessionSlug: 'alpha', memberships: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
      await Promise.resolve();
    });

    expect(screen.getByText('Second-identity reviewers')).toBeInTheDocument();
    expect(screen.queryByText('First-identity reviewers')).not.toBeInTheDocument();
  });

  it('keeps empty and error states inside the native Worker collection', async () => {
    const emptyFetch = jest.fn(
      async (input: RequestInfo | URL) =>
        new Response(
          JSON.stringify(
            new URL(String(input)).pathname.endsWith('/groups/list')
              ? { ok: true, sessionId: SESSION_ID, sessionSlug: 'alpha', groups: [] }
              : { ok: true, sessionId: SESSION_ID, sessionSlug: 'alpha', memberships: [] },
          ),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );
    const { rerender } = render(
      <WorkerGroupMembershipPanel
        canReadGroups={true}
        workerUrl="https://alpha-worker.example"
        workerToken="alpha-token"
        sessionId={SESSION_ID}
        sessionSlug="alpha"
        fetchImpl={emptyFetch as typeof fetch}
      />,
    );

    expect(await screen.findByText('No visible Groups are configured.')).toBeInTheDocument();
    expect(screen.queryByText(/soulbound|on-chain/i)).not.toBeInTheDocument();

    const errorFetch = jest.fn(
      async () =>
        new Response(JSON.stringify({ ok: false, reason: 'worker_group_store_unavailable' }), {
          status: 503,
          headers: { 'content-type': 'application/json' },
        }),
    );
    rerender(
      <WorkerGroupMembershipPanel
        canReadGroups={true}
        workerUrl="https://beta-worker.example"
        workerToken="beta-token"
        sessionId={OTHER_SESSION_ID}
        sessionSlug="beta"
        fetchImpl={errorFetch as typeof fetch}
      />,
    );

    expect(await screen.findByText('worker_group_store_unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No visible Groups are configured.')).not.toBeInTheDocument();
    expect(screen.queryByText(/soulbound|on-chain/i)).not.toBeInTheDocument();
  });

  it.each([
    [undefined, 'worker_group_response_session_identity_missing'],
    [OTHER_SESSION_ID, 'worker_group_response_session_identity_mismatch'],
  ])('fails closed when a Worker response has non-exact session identity (%s)', async (responseSessionId, reason) => {
    const fetchImpl = jest.fn(
      async (input: RequestInfo | URL) =>
        new Response(
          JSON.stringify({
            ok: true,
            ...(responseSessionId ? { sessionId: responseSessionId } : {}),
            sessionSlug: 'alpha',
            ...(new URL(String(input)).pathname.endsWith('/groups/list') ? { groups: [] } : { memberships: [] }),
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );

    render(
      <WorkerGroupMembershipPanel
        canReadGroups={true}
        workerUrl="https://session-worker.example"
        workerToken="worker-token"
        sessionId={SESSION_ID}
        sessionSlug="alpha"
        fetchImpl={fetchImpl as typeof fetch}
      />,
    );

    expect(await screen.findByText(reason)).toBeInTheDocument();
    expect(screen.queryByText('No visible Groups are configured.')).not.toBeInTheDocument();
  });
});
