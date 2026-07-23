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

    expect(screen.getByText('Access groups are not included in this credential.')).toBeInTheDocument();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
