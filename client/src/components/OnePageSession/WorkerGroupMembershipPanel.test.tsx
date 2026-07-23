import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AgentClientLoginEnvelope } from '../../utilities/session/agentClientLogin';
import WorkerGroupMembershipPanel from './WorkerGroupMembershipPanel';

const envelope: AgentClientLoginEnvelope = {
  v: 2,
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
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer worker-jwt-token');
      expect(JSON.stringify(init)).not.toContain('bridge-browser-token');
      if (url.endsWith('/groups/join')) {
        joined = true;
        return new Response(JSON.stringify({ ok: true, group: { groupId: 'open-reviewers' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.endsWith('/groups/my-memberships')) {
        return new Response(
          JSON.stringify({
            ok: true,
            memberships: [
              {
                group: {
                  groupId: joined ? 'open-reviewers' : 'members',
                  label: joined ? 'Open reviewers' : 'Members',
                  joinMode: joined ? 'open' : 'admin_add',
                  memberVisibility: 'session',
                },
                member: { principalKey: 'evm:0xaa' },
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
          groups: [
            {
              groupId: 'open-reviewers',
              label: 'Open reviewers',
              description: 'Join this access group.',
              imageUrl: 'https://ar-io.dev/open-reviewers-image',
              joinMode: 'open',
              memberVisibility: 'session',
            },
            {
              groupId: 'invited-reviewers',
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
    expect(copiedGroupLink.hash).toBe('#group-invited-reviewers');
    expect(copiedGroupLink.searchParams.get('worker')).toBe('https://session-worker.example');
    expect(copiedGroupLink.searchParams.has('inv')).toBe(false);
    expect(copiedGroupLink.searchParams.has('agentToken')).toBe(false);
    expect(screen.getByText(/contains no invitation token or credential/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Join Open reviewers' }));

    await waitFor(() => expect(screen.getByText('4 members')).toBeInTheDocument());
    expect(fetchImpl.mock.calls.some(([url]) => String(url).endsWith('/groups/join'))).toBe(true);
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
});
