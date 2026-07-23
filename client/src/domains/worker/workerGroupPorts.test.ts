import {
  addWorkerGroupMember,
  createWorkerGroup,
  deleteWorkerGroup,
  joinWorkerGroup,
  listWorkerGroupMembers,
  listWorkerGroupsAdmin,
  loadWorkerGroupOverview,
  removeWorkerGroupMember,
  updateWorkerGroup,
} from './workerGroupPorts';

const WORKER_URL = 'https://session-worker.example';
const WORKER_TOKEN = 'worker-jwt-only';

describe('worker group ports', () => {
  it('loads visible groups and self-memberships directly with the session-worker credential', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            groups: [
              {
                groupId: 'reviewers',
                label: 'Reviewers',
                imageUrl: 'https://ar-io.dev/reviewers-image',
                joinMode: 'open',
                memberVisibility: 'session',
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            memberships: [
              {
                group: {
                  groupId: 'members',
                  label: 'Members',
                  joinMode: 'admin_add',
                  memberVisibility: 'admin_only',
                },
                member: { principalKey: 'evm:0xabc' },
                memberCount: 3,
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

    await expect(
      loadWorkerGroupOverview({ workerUrl: `${WORKER_URL}/`, credentialToken: WORKER_TOKEN, fetchImpl }),
    ).resolves.toMatchObject({
      groups: [
        {
          groupId: 'reviewers',
          label: 'Reviewers',
          imageUrl: 'https://ar-io.dev/reviewers-image',
        },
      ],
      memberships: [{ group: { groupId: 'members', memberVisibility: 'admin_only' }, memberCount: 3 }],
    });

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      `${WORKER_URL}/groups/list`,
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
        headers: { Authorization: `Bearer ${WORKER_TOKEN}` },
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      `${WORKER_URL}/groups/my-memberships`,
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
        headers: { Authorization: `Bearer ${WORKER_TOKEN}` },
      }),
    );
  });

  it('joins only through the worker route and preserves an explicit worker failure reason', async () => {
    const successfulFetch = jest.fn(
      async () =>
        new Response(JSON.stringify({ ok: true, group: { groupId: 'reviewers' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );

    await expect(
      joinWorkerGroup({
        workerUrl: WORKER_URL,
        credentialToken: WORKER_TOKEN,
        groupId: 'reviewers',
        fetchImpl: successfulFetch,
      }),
    ).resolves.toMatchObject({ ok: true, group: { groupId: 'reviewers' } });
    expect(successfulFetch).toHaveBeenCalledWith(`${WORKER_URL}/groups/join`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${WORKER_TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ groupId: 'reviewers' }),
    });

    const deniedFetch = jest.fn(
      async () =>
        new Response(JSON.stringify({ ok: false, reason: 'worker_group_join_denied' }), {
          status: 403,
          headers: { 'content-type': 'application/json' },
        }),
    );
    await expect(
      joinWorkerGroup({
        workerUrl: WORKER_URL,
        credentialToken: WORKER_TOKEN,
        groupId: 'private',
        fetchImpl: deniedFetch,
      }),
    ).rejects.toMatchObject({ message: 'worker_group_join_denied', status: 403 });
  });

  it('binds supported admin operations to their signed worker action and path', async () => {
    const postSignedRequest = jest.fn(async (request) => ({ data: { ok: true, request } }));

    await createWorkerGroup({
      group: {
        label: 'Open reviewers',
        joinMode: 'open',
        memberVisibility: 'session',
      },
      postSignedRequest,
    });
    await updateWorkerGroup({
      groupId: 'reviewers',
      group: {
        label: 'Invited reviewers',
        joinMode: 'admin_add',
        memberVisibility: 'members',
      },
      postSignedRequest,
    });
    await listWorkerGroupsAdmin({ postSignedRequest });
    await listWorkerGroupMembers({ groupId: 'reviewers', postSignedRequest });
    await addWorkerGroupMember({
      groupId: 'reviewers',
      principal: { kind: 'evm_address', address: '0x00000000000000000000000000000000000000aa' },
      postSignedRequest,
    });
    await removeWorkerGroupMember({
      groupId: 'reviewers',
      principal: { kind: 'evm_address', address: '0x00000000000000000000000000000000000000aa' },
      postSignedRequest,
    });
    await deleteWorkerGroup({ groupId: 'reviewers', postSignedRequest });

    expect(postSignedRequest).toHaveBeenNthCalledWith(1, {
      action: 'groups/create',
      path: '/admin/groups/create',
      body: {
        group: {
          label: 'Open reviewers',
          joinMode: 'open',
          memberVisibility: 'session',
        },
      },
    });
    expect(postSignedRequest).toHaveBeenNthCalledWith(2, {
      action: 'groups/update',
      path: '/admin/groups/update',
      body: {
        groupId: 'reviewers',
        group: {
          label: 'Invited reviewers',
          joinMode: 'admin_add',
          memberVisibility: 'members',
        },
      },
    });
    expect(postSignedRequest).toHaveBeenNthCalledWith(3, {
      action: 'groups/list',
      path: '/admin/groups/list',
      body: {},
    });
    expect(postSignedRequest).toHaveBeenNthCalledWith(4, {
      action: 'groups/list-members',
      path: '/admin/groups/list-members',
      body: { groupId: 'reviewers' },
    });
    expect(postSignedRequest).toHaveBeenNthCalledWith(5, {
      action: 'groups/add-member',
      path: '/admin/groups/add-member',
      body: {
        groupId: 'reviewers',
        principal: { kind: 'evm_address', address: '0x00000000000000000000000000000000000000aa' },
      },
    });
    expect(postSignedRequest).toHaveBeenNthCalledWith(6, {
      action: 'groups/remove-member',
      path: '/admin/groups/remove-member',
      body: {
        groupId: 'reviewers',
        principal: { kind: 'evm_address', address: '0x00000000000000000000000000000000000000aa' },
      },
    });
    expect(postSignedRequest).toHaveBeenNthCalledWith(7, {
      action: 'groups/delete',
      path: '/admin/groups/delete',
      body: { groupId: 'reviewers' },
    });
  });
});
