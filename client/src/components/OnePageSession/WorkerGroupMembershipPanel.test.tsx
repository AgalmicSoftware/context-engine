import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AgentClientLoginEnvelope } from '../../utilities/session/agentClientLogin';
import WorkerGroupMembershipPanel from './WorkerGroupMembershipPanel';

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
    expect(screen.getByTestId('ce-session-worker-group-image')).toHaveAttribute(
      'src',
      'https://ar-io.dev/open-reviewers-image',
    );
    expect(screen.getByText('3 members')).toBeInTheDocument();
    expect(screen.getByText('Invited reviewers')).toBeInTheDocument();
    expect(screen.getByText(/No invitation token is created/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Copy Invited reviewers group link' }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1));
    const copiedGroupLink = new URL(String((navigator.clipboard.writeText as jest.Mock).mock.calls[0][0]));
    expect(copiedGroupLink.pathname).toBe('/session/alpha');
    expect(copiedGroupLink.hash).toBe('#group-invited-reviewers');
    expect(copiedGroupLink.searchParams.get('worker')).toBe('https://session-worker.example');
    expect(copiedGroupLink.searchParams.has('inv')).toBe(false);
    expect(copiedGroupLink.searchParams.has('agentToken')).toBe(false);
    expect(screen.getByText(/contains no invitation token or credential/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Join Open reviewers' }));

    await waitFor(() => expect(screen.getByText('4 members')).toBeInTheDocument());
    expect(fetchImpl.mock.calls.some(([url]) => new URL(String(url)).pathname.endsWith('/groups/join'))).toBe(true);
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
