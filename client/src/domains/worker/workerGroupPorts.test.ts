import {
  addWorkerGroupMember,
  createWorkerGroup,
  createWorkerGroupAsParticipant,
  deleteWorkerGroup,
  joinWorkerGroup,
  leaveWorkerGroup,
  listWorkerGroupMembers,
  listWorkerGroupsAdmin,
  loadPublicWorkerGroups,
  loadWorkerGroupMembers,
  loadWorkerGroupOverview,
  normalizeWorkerGroupDefaultTags,
  normalizeWorkerGroupsAdminPayload,
  removeWorkerGroupMember,
  updateWorkerGroup,
  workerGroupAdminsMayRemove,
  workerGroupMembersMayLeave,
  addWorkerGroupInvites,
  isWorkerGroupListed,
  listWorkerGroupInvites,
  revokeWorkerGroupInvites,
  setWorkerGroupPassword,
  workerGroupNeedsSecret,
} from './workerGroupPorts';
import * as workerAuth from '../../utilities/worker/workerAuth.js';
import { SESSION_COORDINATOR_UNAVAILABLE } from '../../utilities/worker/coordinatorRetry';

const WORKER_URL = 'https://session-worker.example';
const WORKER_TOKEN = 'worker-jwt-only';
const SESSION_SLUG = 'alpha';
const SESSION_ID = '0x11111111111111111111111111111111';
const OTHER_SESSION_ID = '0x22222222222222222222222222222222';

describe('worker group ports', () => {
  it('normalizes Worker Group defaults with legacy SBT-tag fallback', () => {
    expect(
      normalizeWorkerGroupDefaultTags({
        defaultGroupTags: ' Facilitators,reviewers,facilitators ',
        defaultSbtTags: 'ignored',
      }),
    ).toEqual(['Facilitators', 'reviewers']);
    expect(normalizeWorkerGroupDefaultTags({ defaultSbtTags: ['legacy', 'tags'] })).toEqual(['legacy', 'tags']);
  });

  it('reads who can remove members from each group, leaves an unset one for the helpers to read as both, and drops unknown settings', () => {
    const group = (groupId: string, removalAuth?: unknown) => ({
      groupId,
      sessionSlug: SESSION_SLUG,
      label: groupId,
      joinMode: 'open',
      memberVisibility: 'session',
      ...(removalAuth === undefined ? {} : { removalAuth }),
    });
    const groups = normalizeWorkerGroupsAdminPayload(
      {
        groups: [
          group('both', 'both'),
          group('admins', 'admin_only'),
          group('self', 'member_only'),
          group('fixed', 'neither'),
          group('legacy'),
          group('unknown', 'owner_only'),
        ],
      },
      SESSION_SLUG,
    );

    expect(groups.map(({ groupId, removalAuth }) => [groupId, removalAuth])).toEqual([
      ['both', 'both'],
      ['admins', 'admin_only'],
      ['self', 'member_only'],
      ['fixed', 'neither'],
      ['legacy', undefined],
    ]);
    expect(groups.map((entry) => [workerGroupMembersMayLeave(entry), workerGroupAdminsMayRemove(entry)])).toEqual([
      [true, true],
      [false, true],
      [true, false],
      [false, false],
      [true, true],
    ]);
    expect([workerGroupMembersMayLeave({}), workerGroupAdminsMayRemove({})]).toEqual([true, true]);
  });

  it('loads public session-visible groups without sending a credential', async () => {
    const fetchImpl = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: SESSION_SLUG,
            groups: [
              {
                groupId: 'public-reviewers',
                sessionSlug: SESSION_SLUG,
                label: 'Public reviewers',
                joinMode: 'open',
                memberVisibility: 'session',
                memberCount: 37,
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );

    const groups = await loadPublicWorkerGroups({
      workerUrl: `${WORKER_URL}/`,
      sessionId: SESSION_ID,
      sessionSlug: SESSION_SLUG,
      fetchImpl,
    });
    expect(groups).toEqual([
      expect.objectContaining({
        groupId: 'public-reviewers',
        label: 'Public reviewers',
      }),
    ]);
    expect(groups[0]).not.toHaveProperty('memberCount');

    expect(fetchImpl).toHaveBeenCalledWith(`${WORKER_URL}/groups/list?sessionId=${encodeURIComponent(SESSION_ID)}`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'X-Session-Slug': SESSION_SLUG,
      },
    });
    expect(JSON.stringify(fetchImpl.mock.calls)).not.toContain('Authorization');

    await loadPublicWorkerGroups({
      workerUrl: WORKER_URL,
      sessionId: SESSION_ID,
      sessionSlug: SESSION_SLUG,
      joinGroup: 'salon 2026',
      fetchImpl,
    }).catch(() => undefined);
    expect((fetchImpl.mock.calls.at(-1) as unknown[] | undefined)?.[0]).toBe(
      `${WORKER_URL}/groups/list?sessionId=${encodeURIComponent(SESSION_ID)}&joinGroup=salon%202026`,
    );
  });

  it('loads visible groups and self-memberships directly with the session-worker credential', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: SESSION_SLUG,
            groups: [
              {
                groupId: 'reviewers',
                sessionSlug: SESSION_SLUG,
                label: 'Reviewers',
                imageUrl: 'https://ar-io.dev/reviewers-image',
                joinMode: 'open',
                memberVisibility: 'session',
                memberCount: 7,
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
            sessionId: SESSION_ID,
            sessionSlug: SESSION_SLUG,
            memberships: [
              {
                group: {
                  groupId: 'members',
                  sessionSlug: SESSION_SLUG,
                  label: 'Members',
                  joinMode: 'admin_add',
                  memberVisibility: 'admin_only',
                },
                member: { sessionSlug: SESSION_SLUG, principalKey: 'evm:0xabc' },
                memberCount: 3,
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

    await expect(
      loadWorkerGroupOverview({
        workerUrl: `${WORKER_URL}/`,
        credentialToken: WORKER_TOKEN,
        sessionId: SESSION_ID,
        sessionSlug: SESSION_SLUG,
        fetchImpl,
      }),
    ).resolves.toMatchObject({
      groups: [
        {
          groupId: 'reviewers',
          label: 'Reviewers',
          imageUrl: 'https://ar-io.dev/reviewers-image',
          memberCount: 7,
        },
      ],
      memberships: [{ group: { groupId: 'members', memberVisibility: 'admin_only' }, memberCount: 3 }],
    });

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      `${WORKER_URL}/groups/list?sessionId=${encodeURIComponent(SESSION_ID)}`,
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
        headers: { Authorization: `Bearer ${WORKER_TOKEN}` },
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      `${WORKER_URL}/groups/my-memberships?sessionId=${encodeURIComponent(SESSION_ID)}`,
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
        headers: { Authorization: `Bearer ${WORKER_TOKEN}` },
      }),
    );
  });

  it('discards unmatched restricted groups while preserving session discovery', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: SESSION_SLUG,
            groups: [
              {
                groupId: 'public-reviewers',
                sessionSlug: SESSION_SLUG,
                label: 'Public reviewers',
                joinMode: 'open',
                memberVisibility: 'session',
                memberCount: 9,
              },
              {
                groupId: 'stale-members',
                sessionSlug: SESSION_SLUG,
                label: 'Stale members',
                joinMode: 'admin_add',
                memberVisibility: 'members',
                memberCount: 4,
              },
              {
                groupId: 'stale-admin',
                sessionSlug: SESSION_SLUG,
                label: 'Stale admin',
                joinMode: 'admin_add',
                memberVisibility: 'admin_only',
                memberCount: 1,
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
            sessionId: SESSION_ID,
            sessionSlug: SESSION_SLUG,
            memberships: [],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

    await expect(
      loadWorkerGroupOverview({
        workerUrl: WORKER_URL,
        credentialToken: WORKER_TOKEN,
        sessionId: SESSION_ID,
        sessionSlug: SESSION_SLUG,
        fetchImpl,
      }),
    ).resolves.toEqual({
      groups: [
        expect.objectContaining({
          groupId: 'public-reviewers',
          memberVisibility: 'session',
          memberCount: 9,
        }),
      ],
      memberships: [],
    });
  });

  it.each(['7', 1.5])('rejects malformed authenticated group count %p', async (memberCount) => {
    const fetchImpl = jest.fn(async (input: RequestInfo | URL) => {
      const pathname = new URL(String(input)).pathname;
      const body = pathname.endsWith('/groups/list')
        ? {
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: SESSION_SLUG,
            groups: [
              {
                groupId: 'reviewers',
                sessionSlug: SESSION_SLUG,
                label: 'Reviewers',
                joinMode: 'open',
                memberVisibility: 'session',
                memberCount,
              },
            ],
          }
        : {
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: SESSION_SLUG,
            memberships: [],
          };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    await expect(
      loadWorkerGroupOverview({
        workerUrl: WORKER_URL,
        credentialToken: WORKER_TOKEN,
        sessionId: SESSION_ID,
        sessionSlug: SESSION_SLUG,
        fetchImpl,
      }),
    ).rejects.toMatchObject({ message: 'worker_group_response_member_count_invalid' });
  });

  it.each(['3', 1.5])('rejects malformed self-membership count %p', async (memberCount) => {
    const fetchImpl = jest.fn(async (input: RequestInfo | URL) => {
      const pathname = new URL(String(input)).pathname;
      const body = pathname.endsWith('/groups/list')
        ? {
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: SESSION_SLUG,
            groups: [],
          }
        : {
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: SESSION_SLUG,
            memberships: [
              {
                group: {
                  groupId: 'members',
                  sessionSlug: SESSION_SLUG,
                  label: 'Members',
                  joinMode: 'admin_add',
                  memberVisibility: 'members',
                },
                member: { sessionSlug: SESSION_SLUG, principalKey: 'evm:0xabc' },
                memberCount,
              },
            ],
          };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    await expect(
      loadWorkerGroupOverview({
        workerUrl: WORKER_URL,
        credentialToken: WORKER_TOKEN,
        sessionId: SESSION_ID,
        sessionSlug: SESSION_SLUG,
        fetchImpl,
      }),
    ).rejects.toMatchObject({ message: 'worker_group_response_member_count_invalid' });
  });

  it('loads a permission-visible member page without exposing storage keys or mutation actors', async () => {
    const fetchImpl = jest.fn(
      async (_input?: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: SESSION_SLUG,
            group: {
              groupId: 'reviewers',
              sessionSlug: SESSION_SLUG,
              label: 'Reviewers',
              joinMode: 'open',
              memberVisibility: 'session',
            },
            members: [
              {
                groupId: 'reviewers',
                sessionSlug: SESSION_SLUG,
                principal: {
                  kind: 'evm_address',
                  address: '0x00000000000000000000000000000000000000AA',
                },
                addedAt: '2026-07-28T12:00:00.000Z',
                principalKey: 'must-not-survive-normalization',
                addedBy: 'must-not-survive-normalization',
              },
              {
                groupId: 'reviewers',
                sessionSlug: SESSION_SLUG,
                principal: { kind: 'telegram', principalId: 'telegram:12345' },
                addedAt: '2026-07-28T12:01:00.000Z',
              },
            ],
            memberCount: 3,
            nextCursor: 'next-page-token',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );

    const page = await loadWorkerGroupMembers({
      workerUrl: WORKER_URL,
      credentialToken: WORKER_TOKEN,
      sessionId: SESSION_ID,
      sessionSlug: SESSION_SLUG,
      groupId: 'reviewers',
      cursor: 'current-page-token',
      limit: 25,
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(`${WORKER_URL}/groups/members`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${WORKER_TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        groupId: 'reviewers',
        cursor: 'current-page-token',
        limit: 25,
        sessionId: SESSION_ID,
      }),
    });
    expect(page).toMatchObject({
      group: { groupId: 'reviewers', memberVisibility: 'session' },
      memberCount: 3,
      nextCursor: 'next-page-token',
      members: [
        {
          principal: {
            kind: 'evm_address',
            address: '0x00000000000000000000000000000000000000aa',
          },
        },
        { principal: { kind: 'telegram', principalId: 'telegram:12345' } },
      ],
    });
    expect(JSON.stringify(page.members)).not.toMatch(/principalKey|addedBy|must-not-survive/);
  });

  it('preserves member-list denial and rejects malformed member identities', async () => {
    const deniedFetch = jest.fn(
      async () =>
        new Response(JSON.stringify({ ok: false, reason: 'worker_group_member_list_forbidden' }), {
          status: 403,
          headers: { 'content-type': 'application/json' },
        }),
    );
    await expect(
      loadWorkerGroupMembers({
        workerUrl: WORKER_URL,
        credentialToken: WORKER_TOKEN,
        sessionId: SESSION_ID,
        sessionSlug: SESSION_SLUG,
        groupId: 'admin-only',
        fetchImpl: deniedFetch,
      }),
    ).rejects.toMatchObject({ message: 'worker_group_member_list_forbidden', status: 403 });

    const malformedFetch = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: SESSION_SLUG,
            group: {
              groupId: 'reviewers',
              sessionSlug: SESSION_SLUG,
              label: 'Reviewers',
              joinMode: 'open',
              memberVisibility: 'session',
            },
            members: [
              {
                groupId: 'reviewers',
                sessionSlug: SESSION_SLUG,
                principal: { kind: 'telegram', principalId: '<script>' },
              },
            ],
            memberCount: 1,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );
    await expect(
      loadWorkerGroupMembers({
        workerUrl: WORKER_URL,
        credentialToken: WORKER_TOKEN,
        sessionId: SESSION_ID,
        sessionSlug: SESSION_SLUG,
        groupId: 'reviewers',
        fetchImpl: malformedFetch,
      }),
    ).rejects.toMatchObject({ message: 'worker_group_response_member_invalid' });
  });

  it('maps an older Worker without the member-directory route to a compatibility reason', async () => {
    const fetchImpl = jest.fn(
      async () =>
        new Response(JSON.stringify({ error: 'Not found.' }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        }),
    );

    await expect(
      loadWorkerGroupMembers({
        workerUrl: WORKER_URL,
        credentialToken: WORKER_TOKEN,
        sessionId: SESSION_ID,
        sessionSlug: SESSION_SLUG,
        groupId: 'reviewers',
        fetchImpl,
      }),
    ).rejects.toMatchObject({ message: 'worker_group_member_directory_unavailable', status: 404 });

    const currentWorkerFetch = jest.fn(
      async () =>
        new Response(JSON.stringify({ ok: false, reason: 'worker_group_not_found' }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        }),
    );
    await expect(
      loadWorkerGroupMembers({
        workerUrl: WORKER_URL,
        credentialToken: WORKER_TOKEN,
        sessionId: SESSION_ID,
        sessionSlug: SESSION_SLUG,
        groupId: 'missing',
        fetchImpl: currentWorkerFetch,
      }),
    ).rejects.toMatchObject({ message: 'worker_group_not_found', status: 404 });
  });

  it('joins and leaves only through self-service worker routes and preserves explicit failure reasons', async () => {
    const successfulFetch = jest.fn(
      async (_input?: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: SESSION_SLUG,
            group: {
              groupId: 'reviewers',
              sessionSlug: SESSION_SLUG,
              label: 'Reviewers',
              joinMode: 'open',
              memberVisibility: 'session',
            },
            memberCount: 1,
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
    );

    await expect(
      joinWorkerGroup({
        workerUrl: WORKER_URL,
        credentialToken: WORKER_TOKEN,
        sessionId: SESSION_ID,
        sessionSlug: SESSION_SLUG,
        groupId: 'reviewers',
        fetchImpl: successfulFetch,
      }),
    ).resolves.toMatchObject({ ok: true, group: { groupId: 'reviewers' }, memberCount: 1 });
    expect(successfulFetch).toHaveBeenCalledWith(`${WORKER_URL}/groups/join`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${WORKER_TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ groupId: 'reviewers', sessionId: SESSION_ID }),
    });

    // A crowd joining at once can find the session busy: the join is sent again.
    const busyOnce = jest.fn(async (input?: RequestInfo | URL, init?: RequestInit) =>
      busyOnce.mock.calls.length === 1
        ? new Response(JSON.stringify({ error: SESSION_COORDINATOR_UNAVAILABLE }), { status: 503 })
        : successfulFetch(input, init),
    );
    jest.useFakeTimers();
    try {
      const joining = joinWorkerGroup({
        workerUrl: WORKER_URL,
        credentialToken: WORKER_TOKEN,
        sessionId: SESSION_ID,
        sessionSlug: SESSION_SLUG,
        groupId: 'reviewers',
        fetchImpl: busyOnce,
      });
      await jest.runAllTimersAsync();
      await expect(joining).resolves.toMatchObject({ ok: true, memberCount: 1 });
    } finally {
      jest.useRealTimers();
    }
    expect(busyOnce).toHaveBeenCalledTimes(2);

    const deniedFetch = jest.fn(
      async (_input?: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ ok: false, reason: 'worker_group_join_denied' }), {
          status: 403,
          headers: { 'content-type': 'application/json' },
        }),
    );
    await expect(
      joinWorkerGroup({
        workerUrl: WORKER_URL,
        credentialToken: WORKER_TOKEN,
        sessionId: SESSION_ID,
        sessionSlug: SESSION_SLUG,
        groupId: 'private',
        fetchImpl: deniedFetch,
      }),
    ).rejects.toMatchObject({ message: 'worker_group_join_denied', status: 403 });

    const leaveFetch = jest.fn(
      async (_input?: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: SESSION_SLUG,
            groupId: 'reviewers',
            principal: { kind: 'evm_address', address: '0x00000000000000000000000000000000000000aa' },
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
    );

    await expect(
      leaveWorkerGroup({
        workerUrl: WORKER_URL,
        credentialToken: WORKER_TOKEN,
        sessionId: SESSION_ID,
        sessionSlug: SESSION_SLUG,
        groupId: 'reviewers',
        fetchImpl: leaveFetch,
      }),
    ).resolves.toMatchObject({ ok: true, groupId: 'reviewers' });
    expect(leaveFetch).toHaveBeenCalledWith(`${WORKER_URL}/groups/leave`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${WORKER_TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ groupId: 'reviewers', sessionId: SESSION_ID }),
    });

    const visibleLeaveFetch = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: SESSION_SLUG,
            groupId: 'reviewers',
            group: {
              groupId: 'reviewers',
              sessionSlug: SESSION_SLUG,
              label: 'Reviewers',
              joinMode: 'open',
              memberVisibility: 'session',
            },
            memberCount: 0,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );
    await expect(
      leaveWorkerGroup({
        workerUrl: WORKER_URL,
        credentialToken: WORKER_TOKEN,
        sessionId: SESSION_ID,
        sessionSlug: SESSION_SLUG,
        groupId: 'reviewers',
        fetchImpl: visibleLeaveFetch,
      }),
    ).resolves.toMatchObject({ group: { groupId: 'reviewers', memberVisibility: 'session' }, memberCount: 0 });
  });

  it('accepts a legacy successful join response without a post-mutation member count', async () => {
    const fetchImpl = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: SESSION_SLUG,
            group: {
              groupId: 'reviewers',
              sessionSlug: SESSION_SLUG,
              label: 'Reviewers',
              joinMode: 'open',
              memberVisibility: 'session',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );

    const result = await joinWorkerGroup({
      workerUrl: WORKER_URL,
      credentialToken: WORKER_TOKEN,
      sessionId: SESSION_ID,
      sessionSlug: SESSION_SLUG,
      groupId: 'reviewers',
      fetchImpl,
    });

    expect(result).toEqual(
      expect.objectContaining({ ok: true, group: expect.objectContaining({ groupId: 'reviewers' }) }),
    );
    expect(result).not.toHaveProperty('memberCount');
    expect(result.group).not.toHaveProperty('memberCount');
  });

  it('notes an access change only after the Worker confirms the join', async () => {
    const accessChanged = jest.spyOn(workerAuth, 'noteWorkerAccessChanged');
    const joinResponse = (groupId: string) => async () =>
      new Response(
        JSON.stringify({
          ok: true,
          sessionId: SESSION_ID,
          sessionSlug: SESSION_SLUG,
          group: {
            groupId,
            sessionSlug: SESSION_SLUG,
            label: 'Reviewers',
            joinMode: 'open',
            memberVisibility: 'session',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    const join = (fetchImpl: typeof fetch) =>
      joinWorkerGroup({
        workerUrl: WORKER_URL,
        credentialToken: WORKER_TOKEN,
        sessionId: SESSION_ID,
        sessionSlug: SESSION_SLUG,
        groupId: 'reviewers',
        fetchImpl,
      });
    try {
      await expect(join(jest.fn(joinResponse('other')))).rejects.toThrow('worker_group_response_group_invalid');
      expect(accessChanged).not.toHaveBeenCalled();
      await join(jest.fn(joinResponse('reviewers')));
      expect(accessChanged).toHaveBeenCalledTimes(1);
    } finally {
      accessChanged.mockRestore();
    }
  });

  it.each([
    [
      'join count',
      joinWorkerGroup,
      {
        group: {
          groupId: 'reviewers',
          sessionSlug: SESSION_SLUG,
          label: 'Reviewers',
          joinMode: 'open',
          memberVisibility: 'session',
        },
        memberCount: 1.5,
      },
      'worker_group_response_member_count_invalid',
    ],
    [
      'join group id',
      joinWorkerGroup,
      {
        group: {
          groupId: 'other',
          sessionSlug: SESSION_SLUG,
          label: 'Other',
          joinMode: 'open',
          memberVisibility: 'session',
        },
        memberCount: 1,
      },
      'worker_group_response_group_invalid',
    ],
    [
      'leave visibility',
      leaveWorkerGroup,
      {
        groupId: 'reviewers',
        group: {
          groupId: 'reviewers',
          sessionSlug: SESSION_SLUG,
          label: 'Reviewers',
          joinMode: 'open',
          memberVisibility: 'members',
        },
        memberCount: 0,
      },
      'worker_group_response_group_visibility_invalid',
    ],
    [
      'leave count without retained group',
      leaveWorkerGroup,
      { groupId: 'reviewers', memberCount: 0 },
      'worker_group_response_group_invalid',
    ],
  ])('rejects an inexact %s mutation response', async (_name, operation, response, reason) => {
    const fetchImpl = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: SESSION_SLUG,
            ...response,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );

    await expect(
      operation({
        workerUrl: WORKER_URL,
        credentialToken: WORKER_TOKEN,
        sessionId: SESSION_ID,
        sessionSlug: SESSION_SLUG,
        groupId: 'reviewers',
        fetchImpl,
      }),
    ).rejects.toMatchObject({ message: reason });
  });

  it('creates a participant group through the bearer-authenticated session route', async () => {
    const fetchImpl = jest.fn(
      async (_input?: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: SESSION_SLUG,
            group: {
              groupId: 'participant-review',
              sessionSlug: SESSION_SLUG,
              label: 'Participant review',
              description: 'Open working group.',
              tags: ['reviewers'],
              documentURLs: ['https://docs.example.test/brief'],
              memberLimit: 25,
              joinEndsAt: '2030-01-01T12:00:00.000Z',
              adminAddress: '0x00000000000000000000000000000000000000aa',
              joinMode: 'open',
              memberVisibility: 'session',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );

    await expect(
      createWorkerGroupAsParticipant({
        workerUrl: WORKER_URL,
        credentialToken: WORKER_TOKEN,
        sessionId: SESSION_ID,
        sessionSlug: SESSION_SLUG,
        group: {
          label: 'Participant review',
          description: 'Open working group.',
          tags: ['reviewers'],
          documentURLs: ['https://docs.example.test/brief'],
          memberLimit: 25,
          joinEndsAt: '2030-01-01T12:00:00.000Z',
          adminAddress: '0x00000000000000000000000000000000000000aa',
        },
        fetchImpl,
      }),
    ).resolves.toMatchObject({
      group: {
        groupId: 'participant-review',
        joinMode: 'open',
        memberVisibility: 'session',
        tags: ['reviewers'],
        memberLimit: 25,
      },
    });
    expect(fetchImpl).toHaveBeenCalledWith(`${WORKER_URL}/groups/create`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${WORKER_TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        group: {
          label: 'Participant review',
          description: 'Open working group.',
          tags: ['reviewers'],
          documentURLs: ['https://docs.example.test/brief'],
          memberLimit: 25,
          joinEndsAt: '2030-01-01T12:00:00.000Z',
          adminAddress: '0x00000000000000000000000000000000000000aa',
        },
        sessionId: SESSION_ID,
      }),
    });
  });

  it('maps arbitrary worker group errors without disclosing the bearer credential', async () => {
    const canaryCredential = 'worker-jwt-canary-never-render';
    const deniedFetch = jest.fn(
      async (_input?: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            ok: false,
            reason: `Bearer ${canaryCredential}`,
            error: `Authorization: Bearer ${canaryCredential}`,
          }),
          {
            status: 403,
            headers: { 'content-type': 'application/json' },
          },
        ),
    );

    const error = await joinWorkerGroup({
      workerUrl: WORKER_URL,
      credentialToken: canaryCredential,
      sessionId: SESSION_ID,
      sessionSlug: SESSION_SLUG,
      groupId: 'private',
      fetchImpl: deniedFetch,
    }).catch((caught) => caught);

    expect(error).toMatchObject({ message: 'worker_group_request_failed_403', status: 403 });
    expect(String(error?.message || error)).not.toContain(canaryCredential);
  });

  it('binds supported admin operations to their signed worker action and path', async () => {
    const buildGroup = (overrides = {}) => ({
      groupId: 'reviewers',
      sessionSlug: SESSION_SLUG,
      label: 'Reviewers',
      joinMode: 'open',
      memberVisibility: 'session',
      ...overrides,
    });
    const postSignedRequest = jest.fn(async (request) => {
      if (request.action === 'groups/create') {
        return {
          data: {
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: SESSION_SLUG,
            group: buildGroup(request.body?.group),
          },
        };
      }
      if (request.action === 'groups/update') {
        return {
          data: {
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: SESSION_SLUG,
            group: buildGroup(request.body?.group),
          },
        };
      }
      if (request.action === 'groups/list') {
        return { data: { ok: true, sessionId: SESSION_ID, sessionSlug: SESSION_SLUG, groups: [] } };
      }
      if (request.action === 'groups/list-members') {
        return {
          data: {
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: SESSION_SLUG,
            group: buildGroup(),
            members: [],
          },
        };
      }
      if (request.action === 'groups/add-member') {
        return {
          data: {
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: SESSION_SLUG,
            group: buildGroup(),
            member: { sessionSlug: SESSION_SLUG, principal: request.body?.principal },
          },
        };
      }
      return { data: { ok: true, sessionId: SESSION_ID, sessionSlug: SESSION_SLUG, request } };
    });

    await createWorkerGroup({
      sessionId: SESSION_ID,
      sessionSlug: SESSION_SLUG,
      group: {
        label: 'Open reviewers',
        joinMode: 'open',
        memberVisibility: 'session',
      },
      postSignedRequest,
    });
    await updateWorkerGroup({
      sessionId: SESSION_ID,
      sessionSlug: SESSION_SLUG,
      groupId: 'reviewers',
      group: {
        label: 'Invited reviewers',
        joinMode: 'admin_add',
        memberVisibility: 'members',
      },
      postSignedRequest,
    });
    await listWorkerGroupsAdmin({ sessionId: SESSION_ID, sessionSlug: SESSION_SLUG, postSignedRequest });
    await listWorkerGroupMembers({
      groupId: 'reviewers',
      sessionId: SESSION_ID,
      sessionSlug: SESSION_SLUG,
      postSignedRequest,
    });
    await addWorkerGroupMember({
      sessionId: SESSION_ID,
      sessionSlug: SESSION_SLUG,
      groupId: 'reviewers',
      principal: { kind: 'evm_address', address: '0x00000000000000000000000000000000000000aa' },
      postSignedRequest,
    });
    await removeWorkerGroupMember({
      sessionId: SESSION_ID,
      sessionSlug: SESSION_SLUG,
      groupId: 'reviewers',
      principal: { kind: 'evm_address', address: '0x00000000000000000000000000000000000000aa' },
      postSignedRequest,
    });
    await deleteWorkerGroup({
      groupId: 'reviewers',
      sessionId: SESSION_ID,
      sessionSlug: SESSION_SLUG,
      postSignedRequest,
    });

    expect(postSignedRequest).toHaveBeenNthCalledWith(1, {
      action: 'groups/create',
      path: '/admin/groups/create',
      body: {
        group: {
          label: 'Open reviewers',
          joinMode: 'open',
          memberVisibility: 'session',
        },
        sessionId: SESSION_ID,
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
        sessionId: SESSION_ID,
      },
    });
    expect(postSignedRequest).toHaveBeenNthCalledWith(3, {
      action: 'groups/list',
      path: '/admin/groups/list',
      body: { sessionId: SESSION_ID },
    });
    expect(postSignedRequest).toHaveBeenNthCalledWith(4, {
      action: 'groups/list-members',
      path: '/admin/groups/list-members',
      body: { groupId: 'reviewers', sessionId: SESSION_ID },
    });
    expect(postSignedRequest).toHaveBeenNthCalledWith(5, {
      action: 'groups/add-member',
      path: '/admin/groups/add-member',
      body: {
        groupId: 'reviewers',
        principal: { kind: 'evm_address', address: '0x00000000000000000000000000000000000000aa' },
        sessionId: SESSION_ID,
      },
    });
    expect(postSignedRequest).toHaveBeenNthCalledWith(6, {
      action: 'groups/remove-member',
      path: '/admin/groups/remove-member',
      body: {
        groupId: 'reviewers',
        principal: { kind: 'evm_address', address: '0x00000000000000000000000000000000000000aa' },
        sessionId: SESSION_ID,
      },
    });
    expect(postSignedRequest).toHaveBeenNthCalledWith(7, {
      action: 'groups/delete',
      path: '/admin/groups/delete',
      body: { groupId: 'reviewers', sessionId: SESSION_ID },
    });
  });

  it('preserves the signed member-list cursor contract', async () => {
    const postSignedRequest = jest.fn(async (_request?: unknown) => ({
      data: {
        ok: true,
        sessionId: SESSION_ID,
        sessionSlug: SESSION_SLUG,
        group: {
          groupId: 'reviewers',
          sessionSlug: SESSION_SLUG,
          label: 'Reviewers',
          joinMode: 'admin_add',
          memberVisibility: 'members',
        },
        members: [],
        nextCursor: 'next-page-token',
      },
    }));

    const page = await listWorkerGroupMembers({
      groupId: 'reviewers',
      cursor: 'current-page-token',
      limit: 125,
      sessionId: SESSION_ID,
      sessionSlug: SESSION_SLUG,
      postSignedRequest,
    });

    expect(postSignedRequest).toHaveBeenCalledWith({
      action: 'groups/list-members',
      path: '/admin/groups/list-members',
      body: {
        groupId: 'reviewers',
        cursor: 'current-page-token',
        limit: 125,
        sessionId: SESSION_ID,
      },
    });
    expect(page.nextCursor).toBe('next-page-token');
  });

  it.each([
    [undefined, 'worker_group_response_session_slug_missing'],
    ['beta', 'worker_group_response_session_slug_mismatch'],
  ])('rejects a group response with non-exact session provenance (%s)', async (responseSlug, reason) => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: SESSION_SLUG,
            groups: [
              {
                groupId: 'reviewers',
                ...(responseSlug ? { sessionSlug: responseSlug } : {}),
                label: 'Reviewers',
                joinMode: 'open',
                memberVisibility: 'session',
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, sessionId: SESSION_ID, sessionSlug: SESSION_SLUG, memberships: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

    await expect(
      loadWorkerGroupOverview({
        workerUrl: WORKER_URL,
        credentialToken: WORKER_TOKEN,
        sessionId: SESSION_ID,
        sessionSlug: SESSION_SLUG,
        fetchImpl,
      }),
    ).rejects.toMatchObject({ message: reason });
  });

  it('rejects an empty overview whose response envelope belongs to another session', async () => {
    const fetchImpl = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            sessionId: SESSION_ID,
            sessionSlug: 'beta',
            groups: [],
            memberships: [],
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
    );

    await expect(
      loadWorkerGroupOverview({
        workerUrl: WORKER_URL,
        credentialToken: WORKER_TOKEN,
        sessionId: SESSION_ID,
        sessionSlug: SESSION_SLUG,
        fetchImpl,
      }),
    ).rejects.toMatchObject({ message: 'worker_group_response_session_slug_mismatch' });
  });

  it.each([
    [undefined, 'worker_group_response_session_identity_missing'],
    [OTHER_SESSION_ID, 'worker_group_response_session_identity_mismatch'],
  ])('rejects a response envelope with non-exact session identity (%s)', async (responseSessionId, reason) => {
    const fetchImpl = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            ...(responseSessionId ? { sessionId: responseSessionId } : {}),
            sessionSlug: SESSION_SLUG,
            groups: [],
            memberships: [],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );

    await expect(
      loadWorkerGroupOverview({
        workerUrl: WORKER_URL,
        credentialToken: WORKER_TOKEN,
        sessionId: SESSION_ID,
        sessionSlug: SESSION_SLUG,
        fetchImpl,
      }),
    ).rejects.toMatchObject({ message: reason });
  });

  it('rejects a missing expected session identity before issuing a request', async () => {
    const fetchImpl = jest.fn();

    await expect(
      loadWorkerGroupOverview({
        workerUrl: WORKER_URL,
        credentialToken: WORKER_TOKEN,
        sessionId: '',
        sessionSlug: SESSION_SLUG,
        fetchImpl,
      }),
    ).rejects.toMatchObject({ message: 'worker_group_expected_session_identity_missing' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  describe('join choices', () => {
    const base = { groupId: 'salon', sessionSlug: SESSION_SLUG, label: 'Salon', memberVisibility: 'members' };
    const signed = (data: Record<string, unknown>) =>
      jest.fn(async (_request: { action?: string; path?: string; body?: unknown }) => ({
        data: { ok: true, sessionId: SESSION_ID, sessionSlug: SESSION_SLUG, ...data },
      }));

    it('reads every join choice, whether a group is listed, admin counts and a limit up to 10,000', () => {
      const groups = normalizeWorkerGroupsAdminPayload(
        {
          groups: [
            { ...base, joinMode: 'one_use', listed: false, invites: { unused: 3, used: 1, revoked: 0 } },
            { ...base, groupId: 'pw', joinMode: 'group_password', passwordSet: true, guessLimited: true },
            { ...base, groupId: 'big', joinMode: 'open', memberLimit: 10000 },
            { ...base, groupId: 'too-big', joinMode: 'open', memberLimit: 10001 },
            { ...base, groupId: 'odd', joinMode: 'code' },
            { ...base, groupId: 'bad-listed', joinMode: 'open', listed: 'no' },
          ],
        },
        SESSION_SLUG,
      );
      expect(groups.map((group) => group.groupId)).toEqual(['salon', 'pw', 'big']);
      expect(groups[0]).toMatchObject({ listed: false, invites: { unused: 3, used: 1, revoked: 0 } });
      expect(groups[1]).toMatchObject({ passwordSet: true, guessLimited: true });
      expect(groups[2].memberLimit).toBe(10000);
      expect(isWorkerGroupListed(groups[0])).toBe(false);
      // A record without the setting, and every Public URL group, is listed.
      expect(isWorkerGroupListed(groups[1])).toBe(true);
      expect(isWorkerGroupListed({ joinMode: 'open', listed: false })).toBe(true);
      expect(groups.map(workerGroupNeedsSecret)).toEqual([true, true, false]);
    });

    it('sends a join’s claim code or password proof, and nothing when there is none', async () => {
      const fetchImpl = jest.fn(
        async (_input?: RequestInfo | URL, _init?: RequestInit) =>
          new Response(
            JSON.stringify({
              ok: true,
              sessionId: SESSION_ID,
              sessionSlug: SESSION_SLUG,
              group: { ...base, joinMode: 'one_use' },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
      );
      const request = {
        workerUrl: WORKER_URL,
        credentialToken: WORKER_TOKEN,
        sessionId: SESSION_ID,
        sessionSlug: SESSION_SLUG,
        groupId: 'salon',
        fetchImpl,
      };
      await joinWorkerGroup({ ...request, secret: 'abcdef0123456789abcdef0123456789' });
      await joinWorkerGroup({ ...request, proof: '0xproof' });
      await joinWorkerGroup(request);
      const bodies = fetchImpl.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
      expect(bodies[0]).toMatchObject({ groupId: 'salon', secret: 'abcdef0123456789abcdef0123456789' });
      expect(bodies[1]).toMatchObject({ groupId: 'salon', proof: '0xproof' });
      expect(bodies[2]).not.toHaveProperty('secret');
      expect(bodies[2]).not.toHaveProperty('proof');
    });

    it('binds invites and the password to their signed admin actions, without a secret', async () => {
      const counts = { unused: 2, used: 0, revoked: 1 };
      const request = { groupId: 'salon', sessionId: SESSION_ID, sessionSlug: SESSION_SLUG };
      const add = signed({ added: 2, invites: counts });
      await expect(
        addWorkerGroupInvites({
          ...request,
          hashes: ['a'.repeat(64)],
          expiresAt: '2026-11-30T00:00:00.000Z',
          postSignedRequest: add,
        }),
      ).resolves.toEqual({ added: 2, invites: counts });
      expect(add).toHaveBeenCalledWith({
        action: 'groups/invites/add',
        path: '/admin/groups/invites/add',
        body: {
          groupId: 'salon',
          hashes: ['a'.repeat(64)],
          expiresAt: '2026-11-30T00:00:00.000Z',
          sessionId: SESSION_ID,
        },
      });

      const list = signed({
        invites: [
          { id: 'abcd1234', state: 'used', usedAt: '2026-11-20T10:00:00.000Z' },
          { id: 'not hex', state: 'unused' },
          { id: 'ef567890', state: 'lost' },
        ],
        counts,
        cursor: 'next',
      });
      await expect(listWorkerGroupInvites({ ...request, postSignedRequest: list })).resolves.toEqual({
        invites: [{ id: 'abcd1234', state: 'used', usedAt: '2026-11-20T10:00:00.000Z' }],
        counts,
        cursor: 'next',
      });

      const revoke = signed({ revoked: 1, counts });
      await revokeWorkerGroupInvites({ ...request, ids: 'allUnused', postSignedRequest: revoke });
      await revokeWorkerGroupInvites({ ...request, ids: ['abcd1234'], postSignedRequest: revoke });
      expect(revoke.mock.calls.map(([request]) => request.body)).toEqual([
        { groupId: 'salon', allUnused: true, sessionId: SESSION_ID },
        { groupId: 'salon', ids: ['abcd1234'], sessionId: SESSION_ID },
      ]);

      const password = signed({ group: { ...base, joinMode: 'group_password', passwordSet: true } });
      const signer = '0x0000000000000000000000000000000000000002';
      const saved = await setWorkerGroupPassword({ ...request, signer, postSignedRequest: password });
      expect(saved.group.passwordSet).toBe(true);
      expect(password).toHaveBeenCalledWith({
        action: 'groups/password/set',
        path: '/admin/groups/password/set',
        body: { groupId: 'salon', signer, sessionId: SESSION_ID },
      });
    });
  });
});
