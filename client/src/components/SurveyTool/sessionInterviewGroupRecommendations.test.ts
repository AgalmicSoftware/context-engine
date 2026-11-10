import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';
import { loadPublicWorkerGroups, loadWorkerGroupOverview } from '../../domains/worker/workerGroupPorts';
import {
  buildTokenCacheEnvelope,
  buildTokenCacheKey,
  clearAllTokenCaches,
  writeTokenCache,
} from '../../utilities/worker/workerAuthTokenCache';
import {
  DRAFTING_GROUPS_TIMEOUT_MS,
  buildGroupRecommendationRequest,
  loadDraftingGroupChoices,
  loadInterviewWorkerGroupCandidates,
  loadJoinableInterviewGroups,
  matchInterviewGroupsByAnswer,
  matchInterviewGroupsFromPicks,
  normalizeInterviewGroupCandidates,
  resolveInterviewWorkerGroupTarget,
  type InterviewGroupCandidate,
} from './sessionInterviewGroupRecommendations';

jest.mock('../../domains/worker/workerGroupPorts', () => ({
  loadPublicWorkerGroups: jest.fn(),
  loadWorkerGroupOverview: jest.fn(),
}));

const sessionId = '0x00000000000000000000000000000123';
const publicWorkerProfile = {
  profileVersion: 1,
  preset: 'custom',
  authority: { mode: 'worker_canonical' },
  evm: { registryChainId: null },
  storage: {
    backend: 'cloudflare',
    payloadAccessControl: { gate: 'none', encryption: 'none' },
  },
  identity: { default: 'passkey', enabled: ['passkey'] },
  authorization: { mechanisms: ['worker_roles'] },
  encryption: { mode: 'none' },
  surfaces: { web: true, telegram: false, miniApp: false, agentHttp: false, mcp: false, ceCc: false },
  results: {
    visibility: 'public_full_if_storage_public',
    exposure: { aggregateResultsEnabled: true, anonymizedGroupsEnabled: false, minGroupSize: 2 },
  },
  export: { scope: 'all_session' },
};

const workerConfig = () => ({
  slug: 'demo4',
  sessionId,
  corsWorkerUrl: 'https://worker.example',
  sessionModeProfile: publicWorkerProfile,
});

const privateConfig = () => ({
  ...workerConfig(),
  sessionModeProfile: {
    ...publicWorkerProfile,
    results: { ...publicWorkerProfile.results, visibility: 'session_member_aggregate' },
  },
});

const registryConfig = () => {
  const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
  return {
    slug: 'registry-demo',
    sessionId,
    sessionModeProfile: profile,
  };
};

const baseGroup = {
  groupId: 'france-builders',
  sessionSlug: 'demo4',
  label: 'France builders',
  description: 'People living in France or working directly on French deployments.',
  tags: ['country', 'France'],
  joinMode: 'open' as const,
  memberVisibility: 'session' as const,
};

const eligibleCandidate: InterviewGroupCandidate = {
  groupId: 'france-builders',
  label: 'France builders',
  description: 'People living in France or working directly on French deployments.',
  tags: ['country', 'France'],
  joinMode: 'open',
  memberVisibility: 'session',
  requiresAuthentication: false,
  source: 'authenticated',
};

describe('session interview group recommendations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves only exact Worker-canonical group targets and reports registry groups as unsupported', () => {
    expect(resolveInterviewWorkerGroupTarget({ sessionConfig: workerConfig(), sessionSlug: 'demo4' })).toEqual(
      expect.objectContaining({
        supported: true,
        sessionId,
        sessionSlug: 'demo4',
        workerUrl: 'https://worker.example',
        anonymousDiscoveryAllowed: true,
      }),
    );
    expect(resolveInterviewWorkerGroupTarget({ sessionConfig: workerConfig(), sessionSlug: 'other' })).toEqual({
      supported: false,
      reason: 'worker_group_session_identity_missing',
    });
    expect(
      resolveInterviewWorkerGroupTarget({ sessionConfig: registryConfig(), sessionSlug: 'registry-demo' }),
    ).toEqual({
      supported: false,
      reason: 'registry_groups_inline_join_unsupported',
    });
  });

  it('suggests groups named exactly like a chosen single-choice option, without the AI', () => {
    const outlook = {
      id: 'outlook',
      prompt: 'Your outlook?',
      type: 'multichoice',
      options: ['d/acc', 'e/acc'],
      singleSelect: true,
    };
    const tools = {
      id: 'tools',
      prompt: 'Tools you use?',
      type: 'multichoice',
      options: ['d/acc', 'Other'],
      singleSelect: false,
    };
    const group = (groupId: string, label: string) => ({ ...eligibleCandidate, groupId, label });
    const candidates = normalizeInterviewGroupCandidates({
      source: 'authenticated',
      memberships: [{ group: { ...baseGroup, groupId: 'joined' }, member: { groupId: 'joined' } }],
      groups: [
        { ...baseGroup, groupId: 'dacc', label: 'd/acc' },
        { ...baseGroup, groupId: 'joined', label: 'e/acc' },
      ],
    });
    const match = (answer: unknown, questionId = 'outlook') =>
      matchInterviewGroupsByAnswer({
        candidates,
        questions: [outlook, tools],
        draftResponses: [{ questionId, answer }],
      });
    // Exact, then case and spacing differences.
    expect(match('d/acc')).toEqual([{ groupId: 'dacc', reason: 'You chose “d/acc”.', confidence: 1 }]);
    expect(match('  D/ACC ')).toEqual([expect.objectContaining({ groupId: 'dacc', reason: 'You chose “D/ACC”.' })]);
    expect(match(['d/acc'])).toEqual([expect.objectContaining({ groupId: 'dacc' })]);
    expect(
      matchInterviewGroupsByAnswer({
        candidates: [group('open-source', 'Open source')],
        questions: [{ ...outlook, options: ['Open  source'] }],
        draftResponses: [{ questionId: 'outlook', answer: 'open \t source' }],
      }),
    ).toEqual([expect.objectContaining({ groupId: 'open-source' })]);
    // No match, an already-joined group, and a multiple-selection question suggest nothing.
    expect(match('dacc')).toEqual([]);
    expect(match('e/acc')).toEqual([]);
    expect(match(['d/acc'], 'tools')).toEqual([]);
    // One suggestion per group, however many answers name it.
    expect(
      matchInterviewGroupsByAnswer({
        candidates: [group('dacc', 'd/acc')],
        questions: [outlook, { ...outlook, id: 'outlook-2' }],
        draftResponses: [
          { questionId: 'outlook', answer: 'd/acc' },
          { questionId: 'OUTLOOK-2', answer: 'd/acc' },
        ],
      }),
    ).toHaveLength(1);
  });

  it('filters catalog entries to open session-visible groups and excludes known full or already-joined groups', () => {
    const candidates = normalizeInterviewGroupCandidates({
      nowMs: Date.parse('2026-09-19T12:00:00Z'),
      source: 'authenticated',
      memberships: [
        {
          group: { ...baseGroup, groupId: 'joined' },
          member: { groupId: 'joined' },
        },
      ],
      groups: [
        baseGroup,
        { ...baseGroup, groupId: 'admin-add', joinMode: 'admin_add' },
        { ...baseGroup, groupId: 'members-only', memberVisibility: 'members' },
        { ...baseGroup, groupId: 'expired', joinEndsAt: '2026-09-19T11:59:59Z' },
        { ...baseGroup, groupId: 'full', memberLimit: 2, memberCount: 2 },
        { ...baseGroup, groupId: 'joined' },
        { ...baseGroup, groupId: 'unknown-count', memberLimit: 10 },
      ],
    });
    expect(candidates.map((candidate) => candidate.groupId)).toEqual(['france-builders', 'unknown-count']);
    expect(candidates[0]).toEqual(expect.objectContaining({ requiresAuthentication: false, source: 'authenticated' }));
  });

  it('loads public candidates without suppressing unknown member counts and authenticated candidates without leaking joined groups', async () => {
    jest.mocked(loadPublicWorkerGroups).mockResolvedValue([{ ...baseGroup, memberLimit: 10 }]);
    const publicResult = await loadInterviewWorkerGroupCandidates({
      sessionConfig: workerConfig(),
      sessionSlug: 'demo4',
    });
    expect(loadPublicWorkerGroups).toHaveBeenCalledWith(
      expect.objectContaining({ workerUrl: 'https://worker.example', sessionId, sessionSlug: 'demo4' }),
    );
    expect(publicResult).toEqual(
      expect.objectContaining({
        status: 'ready',
        source: 'public',
        candidates: [expect.objectContaining({ groupId: 'france-builders', requiresAuthentication: true })],
      }),
    );

    jest.mocked(loadWorkerGroupOverview).mockResolvedValue({
      groups: [baseGroup, { ...baseGroup, groupId: 'already' }],
      memberships: [{ group: { ...baseGroup, groupId: 'already' }, member: { groupId: 'already' } }],
    });
    const signedResult = await loadInterviewWorkerGroupCandidates({
      sessionConfig: workerConfig(),
      sessionSlug: 'demo4',
      workerToken: 'session-token',
    });
    expect(loadWorkerGroupOverview).toHaveBeenCalledWith(
      expect.objectContaining({ credentialToken: 'session-token', workerUrl: 'https://worker.example' }),
    );
    expect(signedResult).toEqual(
      expect.objectContaining({
        status: 'ready',
        source: 'authenticated',
        candidates: [expect.objectContaining({ groupId: 'france-builders', requiresAuthentication: false })],
      }),
    );
  });

  it('lists a private session through a join link only, for a signed-out person', async () => {
    expect(resolveInterviewWorkerGroupTarget({ sessionConfig: privateConfig(), sessionSlug: 'demo4' })).toEqual(
      expect.objectContaining({ supported: true, anonymousDiscoveryAllowed: false }),
    );
    await expect(
      loadInterviewWorkerGroupCandidates({ sessionConfig: privateConfig(), sessionSlug: 'demo4' }),
    ).resolves.toEqual({
      status: 'unsupported',
      candidates: [],
      reason: 'worker_group_authentication_required',
    });
    expect(loadPublicWorkerGroups).not.toHaveBeenCalled();

    jest.mocked(loadPublicWorkerGroups).mockResolvedValue([baseGroup]);
    const invited = await loadInterviewWorkerGroupCandidates({
      sessionConfig: privateConfig(),
      sessionSlug: 'demo4',
      inviteGroupId: 'salon',
    });
    expect(loadPublicWorkerGroups).toHaveBeenLastCalledWith(expect.objectContaining({ joinGroup: 'salon' }));
    expect(invited).toEqual(
      expect.objectContaining({
        status: 'ready',
        candidates: [expect.objectContaining({ groupId: 'france-builders' })],
      }),
    );
    // A public session needs no link, so it never sends one.
    await loadInterviewWorkerGroupCandidates({
      sessionConfig: workerConfig(),
      sessionSlug: 'demo4',
      inviteGroupId: 'salon',
    });
    expect(loadPublicWorkerGroups).toHaveBeenLastCalledWith(expect.objectContaining({ joinGroup: '' }));
  });

  it('lists the groups a person could join through their saved sign-in, or else their join link', async () => {
    const address = '0x0000000000000000000000000000000000000001';
    const workerUrl = 'https://worker.example';
    jest.mocked(loadWorkerGroupOverview).mockResolvedValue({ groups: [baseGroup], memberships: [] });
    jest.mocked(loadPublicWorkerGroups).mockResolvedValue([baseGroup]);
    writeTokenCache(
      buildTokenCacheKey({ workerUrl, slug: 'demo4', sessionId, address }),
      buildTokenCacheEnvelope({
        token: 'saved-token',
        exp: Math.floor(Date.now() / 1000) + 3600,
        workerUrl,
        sessionSlug: 'demo4',
        sessionId,
        address,
      }),
    );
    sessionStorage.setItem(
      'ce:worker-group-auto-join:v1',
      JSON.stringify({
        version: 1,
        sessionSlug: 'demo4',
        groupId: 'salon',
        workerOrigin: workerUrl,
        createdAt: Date.now(),
      }),
    );
    try {
      const args = { sessionConfig: privateConfig(), sessionSlug: 'demo4', workerUrl };
      await expect(loadJoinableInterviewGroups({ ...args, account: address })).resolves.toEqual(
        expect.objectContaining({ status: 'ready', source: 'authenticated' }),
      );
      expect(loadWorkerGroupOverview).toHaveBeenCalledWith(expect.objectContaining({ credentialToken: 'saved-token' }));
      // Signed out, they see what the link's group's members see.
      await expect(loadJoinableInterviewGroups(args)).resolves.toEqual(
        expect.objectContaining({ status: 'ready', source: 'public' }),
      );
      expect(loadPublicWorkerGroups).toHaveBeenLastCalledWith(expect.objectContaining({ joinGroup: 'salon' }));
      // Another session's link opens nothing here.
      await expect(
        loadJoinableInterviewGroups({
          ...args,
          sessionConfig: { ...privateConfig(), slug: 'other' },
          sessionSlug: 'other',
        }),
      ).resolves.toEqual(expect.objectContaining({ status: 'unsupported' }));
    } finally {
      clearAllTokenCaches();
      sessionStorage.clear();
    }
  });

  it('offers the drafting AI joinable groups only while the session matches groups, and never waits long', async () => {
    const args = { sessionSlug: 'demo4', workerUrl: 'https://worker.example' };
    const on = { ...workerConfig(), interviewMode: { joinMatchingGroups: true } };
    jest.mocked(loadPublicWorkerGroups).mockResolvedValue([baseGroup]);
    await expect(loadDraftingGroupChoices({ ...args, sessionConfig: on })).resolves.toEqual([
      expect.objectContaining({ groupId: 'france-builders' }),
    ]);
    // Off, or with nothing about people an AI may use, nothing is looked up.
    jest.mocked(loadPublicWorkerGroups).mockClear();
    for (const interviewMode of [{}, { joinMatchingGroups: true, groupSuggestionData: [] }]) {
      await expect(
        loadDraftingGroupChoices({ ...args, sessionConfig: { ...workerConfig(), interviewMode } }),
      ).resolves.toEqual([]);
    }
    expect(loadPublicWorkerGroups).not.toHaveBeenCalled();
    // A failed or stalled lookup offers none, so the drafts go ahead.
    jest.mocked(loadPublicWorkerGroups).mockRejectedValue(new Error('Worker down'));
    await expect(loadDraftingGroupChoices({ ...args, sessionConfig: on })).resolves.toEqual([]);
    jest.useFakeTimers();
    try {
      jest.mocked(loadPublicWorkerGroups).mockReturnValue(new Promise(() => {}));
      const stalled = loadDraftingGroupChoices({ ...args, sessionConfig: on });
      await jest.advanceTimersByTimeAsync(DRAFTING_GROUPS_TIMEOUT_MS);
      await expect(stalled).resolves.toEqual([]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('takes the groups an AI picked, among those the person could join, marking their own AI’s', () => {
    const other = { ...eligibleCandidate, groupId: 'dacc', label: 'd/acc' };
    const picks = [
      { groupId: 'unknown', reason: 'Not a group here', confidence: 0.9 },
      { groupId: 'dacc', reason: 'Writes about d/acc', confidence: 0.9 },
      { groupId: 'france-builders' },
    ];
    const candidates = [eligibleCandidate, other];
    expect(matchInterviewGroupsFromPicks({ candidates, picks, ownAi: true })).toEqual([
      { groupId: 'dacc', reason: 'Your AI: Writes about d/acc', confidence: 0.9 },
      { groupId: 'france-builders', reason: 'Your AI suggested this group.' },
    ]);
    // The session's AI's picks show their reason as given.
    expect(matchInterviewGroupsFromPicks({ candidates, picks })).toEqual([
      { groupId: 'dacc', reason: 'Writes about d/acc', confidence: 0.9 },
      { groupId: 'france-builders', reason: '' },
    ]);
    expect(matchInterviewGroupsFromPicks({ candidates: [eligibleCandidate] })).toEqual([]);
  });

  it('builds a suggestion request from kept, shown answers with the person’s edits', () => {
    const request = buildGroupRecommendationRequest({
      prefillPacket: null,
      draftingPicks: [{ groupId: 'france-builders', reason: 'Works in France' }],
      drafts: [
        { questionId: 'kept', answer: 'AI answer' },
        { questionId: 'dropped', answer: 'Dropped' },
        { questionId: 'hidden', answer: 'Hidden guess' },
      ],
      selected: { kept: true, hidden: true },
      edited: { kept: { answer: 'My answer', userEditedFields: ['answer'] } },
      hidden: (questionId) => questionId === 'hidden',
    });
    expect(request).toEqual(
      expect.objectContaining({
        prefillPacket: null,
        draftResponses: [{ questionId: 'kept', answer: 'My answer', userEditedFields: ['answer'] }],
        draftingPicks: [{ groupId: 'france-builders', reason: 'Works in France' }],
      }),
    );
    expect(request.requestId).toEqual(expect.any(Number));
  });
});
