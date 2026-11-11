import { canonicalizeSessionSlug } from '../../utilities/session/canonicalSessionContext.js';
import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection.js';
import { resolveWorkerCanonicalSessionIdHex } from '../../utilities/session/sessionWorkerDiscovery.js';
import { getUsableSessionWorkerUrl } from '../../utilities/session/sessionWorkerAvailability';
import { buildTokenCacheKey, readScopedTokenCache } from '../../utilities/worker/workerAuthTokenCache';
import { normalizeWorkerUrl } from '../../utilities/worker/workerUrl.js';
import { sessionModeAllowsAnonymousWorkerGroupDiscovery } from '../../utilities/session/sessionModeProfile';
import { normalizeInterviewSettings, type GroupSuggestionDataKind } from '../../../../shared/interviewSettings.mjs';
import {
  loadPublicWorkerGroups,
  loadWorkerGroupOverview,
  type WorkerGroup,
  type WorkerGroupMembership,
} from '../../domains/worker/workerGroupPorts';
import { readInterviewInviteGroupId } from './sessionInterviewGroupInvite';
import type {
  InterviewDraftResponse,
  InterviewPrefillGroupPick,
  InterviewPrefillPacket,
  InterviewQuestion,
} from './sessionInterview';

type UnknownRecord = Record<string, unknown>;

export type InterviewGroupCandidate = {
  groupId: string;
  label: string;
  description?: string;
  tags: string[];
  joinMode: 'open';
  memberVisibility: 'session';
  joinEndsAt?: string;
  memberLimit?: number;
  memberCount?: number;
  requiresAuthentication: boolean;
  source: 'public' | 'authenticated';
};

export type InterviewGroupRecommendation = {
  groupId: string;
  reason: string;
  /** 0-1: how surely the group fits. */
  confidence?: number;
};

export type InterviewWorkerGroupTarget =
  | {
      supported: true;
      sessionId: string;
      sessionSlug: string;
      workerUrl: string;
      anonymousDiscoveryAllowed: boolean;
    }
  | {
      supported: false;
      reason:
        | 'worker_groups_profile_required'
        | 'registry_groups_inline_join_unsupported'
        | 'worker_group_session_identity_missing'
        | 'worker_group_worker_url_missing';
    };

export type InterviewGroupCandidateLoadResult =
  | {
      status: 'ready';
      candidates: InterviewGroupCandidate[];
      source: 'public' | 'authenticated';
      sessionId: string;
      sessionSlug: string;
      workerUrl: string;
    }
  | {
      status: 'unsupported' | 'error';
      candidates: [];
      reason: string;
    };

export type LoadInterviewWorkerGroupCandidatesArgs = {
  sessionConfig: unknown;
  sessionSlug?: unknown;
  workerUrl?: unknown;
  workerToken?: unknown;
  /** A pending join link's group, which lets a signed-out person see what its members see. */
  inviteGroupId?: string;
  fetchImpl?: typeof fetch;
  nowMs?: number;
};

export type SessionInterviewGroupRecommendationRequest = {
  requestId: number;
  /** Its `groups` are what the person's own AI picked. */
  prefillPacket: InterviewPrefillPacket | null;
  draftResponses: InterviewDraftResponse[];
  /** What the session's AI picked in the reply that drafted the answers. */
  draftingPicks: InterviewPrefillGroupPick[];
};

/** Suggestions count only answers the person keeps; a hidden draft's guess stays out until it is shown. */
export const buildGroupRecommendationRequest = ({
  prefillPacket,
  draftingPicks,
  drafts,
  selected,
  edited,
  hidden,
}: {
  prefillPacket: InterviewPrefillPacket | null;
  draftingPicks: InterviewPrefillGroupPick[];
  drafts: InterviewDraftResponse[];
  selected: Record<string, boolean>;
  edited: Record<string, Partial<InterviewDraftResponse>>;
  hidden: (questionId: string) => boolean;
}): SessionInterviewGroupRecommendationRequest => ({
  requestId: Date.now(),
  prefillPacket,
  draftResponses: drafts
    .filter(({ questionId }) => selected[questionId] && !hidden(questionId))
    .map((draft) => ({ ...draft, ...(edited[draft.questionId] || {}) })),
  draftingPicks,
});

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};

const toText = (value: unknown): string => String(value ?? '').trim();

const clampText = (value: unknown, maxLength: number): string => {
  const text = toText(value).replace(/\s+/g, ' ');
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}…` : text;
};

const lower = (value: unknown): string => toText(value).toLowerCase();

const normalizeTags = (value: unknown): string[] => {
  const seen = new Set<string>();
  return (Array.isArray(value) ? value : [])
    .map((tag) => clampText(tag, 64))
    .filter((tag) => {
      if (!tag) return false;
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20);
};

const isJoinWindowOpen = (joinEndsAt: unknown, nowMs: number): boolean => {
  const raw = toText(joinEndsAt);
  if (!raw) return true;
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) && timestamp > nowMs;
};

const hasReachedKnownCapacity = (group: WorkerGroup): boolean => {
  const limit = Number(group.memberLimit);
  const count = Number(group.memberCount);
  return Number.isSafeInteger(limit) && limit > 0 && Number.isSafeInteger(count) && count >= limit;
};

const membershipGroupIds = (memberships: WorkerGroupMembership[] = []): Set<string> =>
  new Set(memberships.map((membership) => toText(membership.group?.groupId)).filter(Boolean));

export const resolveInterviewWorkerGroupTarget = ({
  sessionConfig,
  sessionSlug,
  workerUrl,
}: {
  sessionConfig: unknown;
  sessionSlug?: unknown;
  workerUrl?: unknown;
}): InterviewWorkerGroupTarget => {
  const config = asRecord(sessionConfig);
  const canonicalSlug = canonicalizeSessionSlug(sessionSlug || config.slug);
  const configuredSlug = canonicalizeSessionSlug(config.slug);
  const sessionId = resolveWorkerCanonicalSessionIdHex(config);
  const projection = resolveSessionCapabilityProjection(config);
  const isWorkerProfile = projection.source === 'profile' && projection.profileValid && projection.isWorkerCanonical;
  const isRegistryProfile =
    (projection.source === 'profile' && projection.profileValid && projection.isRegistryCanonical) ||
    (projection.source === 'legacy_registry' && projection.isRegistryCanonical);

  if (!isWorkerProfile) {
    return {
      supported: false,
      reason: isRegistryProfile ? 'registry_groups_inline_join_unsupported' : 'worker_groups_profile_required',
    };
  }
  if (!canonicalSlug || configuredSlug !== canonicalSlug || !sessionId) {
    return { supported: false, reason: 'worker_group_session_identity_missing' };
  }
  const resolvedWorkerUrl =
    toText(workerUrl) ||
    getUsableSessionWorkerUrl({
      slug: canonicalSlug,
      sessionConfig,
      requireExactWorkerSession: true,
    });
  if (!resolvedWorkerUrl) return { supported: false, reason: 'worker_group_worker_url_missing' };
  return {
    supported: true,
    sessionId,
    sessionSlug: canonicalSlug,
    workerUrl: resolvedWorkerUrl,
    anonymousDiscoveryAllowed: sessionModeAllowsAnonymousWorkerGroupDiscovery(config.sessionModeProfile),
  };
};

/** A signed-in person's saved Worker token for this session, read without asking them to sign anything. */
export const readCachedInterviewWorkerToken = ({
  sessionConfig,
  sessionSlug,
  workerUrl,
  account,
}: {
  sessionConfig: unknown;
  sessionSlug?: unknown;
  workerUrl?: unknown;
  account?: unknown;
}): string => {
  const address = lower(account);
  const config = asRecord(sessionConfig);
  const slug = canonicalizeSessionSlug(sessionSlug || config.slug);
  const sessionId = resolveWorkerCanonicalSessionIdHex(config);
  const url = normalizeWorkerUrl(workerUrl);
  if (!/^0x[0-9a-f]{40}$/.test(address) || !slug || !sessionId || !url) return '';
  const cached = readScopedTokenCache(buildTokenCacheKey({ workerUrl: url, slug, sessionId, address }), {
    workerUrl: url,
    sessionSlug: slug,
    sessionId,
    address,
  });
  return cached?.ok && cached.token ? cached.token : '';
};

export const normalizeInterviewGroupCandidates = ({
  groups,
  memberships = [],
  nowMs = Date.now(),
  source = 'authenticated',
}: {
  groups: WorkerGroup[];
  memberships?: WorkerGroupMembership[];
  nowMs?: number;
  source?: 'public' | 'authenticated';
}): InterviewGroupCandidate[] => {
  const joined = membershipGroupIds(memberships);
  const seen = new Set<string>();
  return groups.reduce<InterviewGroupCandidate[]>((items, group) => {
    const groupId = toText(group.groupId);
    const label = clampText(group.label, 120);
    if (!groupId || !label || seen.has(groupId)) return items;
    seen.add(groupId);
    if (group.joinMode !== 'open') return items;
    if (group.memberVisibility !== 'session') return items;
    if (joined.has(groupId)) return items;
    if (!isJoinWindowOpen(group.joinEndsAt, nowMs)) return items;
    if (hasReachedKnownCapacity(group)) return items;
    const memberLimit = Number(group.memberLimit);
    const memberCount = Number(group.memberCount);
    items.push({
      groupId,
      label,
      ...(group.description ? { description: clampText(group.description, 500) } : {}),
      tags: normalizeTags(group.tags),
      joinMode: 'open',
      memberVisibility: 'session',
      ...(group.joinEndsAt ? { joinEndsAt: toText(group.joinEndsAt) } : {}),
      ...(Number.isSafeInteger(memberLimit) && memberLimit > 0 ? { memberLimit } : {}),
      ...(Number.isSafeInteger(memberCount) && memberCount >= 0 ? { memberCount } : {}),
      requiresAuthentication: source === 'public',
      source,
    });
    return items;
  }, []);
};

export const loadInterviewWorkerGroupCandidates = async ({
  sessionConfig,
  sessionSlug,
  workerUrl,
  workerToken,
  inviteGroupId = '',
  fetchImpl,
  nowMs,
}: LoadInterviewWorkerGroupCandidatesArgs): Promise<InterviewGroupCandidateLoadResult> => {
  const target = resolveInterviewWorkerGroupTarget({ sessionConfig, sessionSlug, workerUrl });
  if (!target.supported) return { status: 'unsupported', candidates: [], reason: target.reason };
  try {
    const token = toText(workerToken);
    if (token) {
      const overview = await loadWorkerGroupOverview({
        workerUrl: target.workerUrl,
        credentialToken: token,
        sessionId: target.sessionId,
        sessionSlug: target.sessionSlug,
        fetchImpl,
      });
      return {
        status: 'ready',
        source: 'authenticated',
        sessionId: target.sessionId,
        sessionSlug: target.sessionSlug,
        workerUrl: target.workerUrl,
        candidates: normalizeInterviewGroupCandidates({
          groups: overview.groups,
          memberships: overview.memberships,
          nowMs,
          source: 'authenticated',
        }),
      };
    }
    if (!target.anonymousDiscoveryAllowed && !inviteGroupId) {
      return { status: 'unsupported', candidates: [], reason: 'worker_group_authentication_required' };
    }
    const groups = await loadPublicWorkerGroups({
      workerUrl: target.workerUrl,
      sessionId: target.sessionId,
      sessionSlug: target.sessionSlug,
      joinGroup: target.anonymousDiscoveryAllowed ? '' : inviteGroupId,
      fetchImpl,
    });
    return {
      status: 'ready',
      source: 'public',
      sessionId: target.sessionId,
      sessionSlug: target.sessionSlug,
      workerUrl: target.workerUrl,
      candidates: normalizeInterviewGroupCandidates({ groups, nowMs, source: 'public' }),
    };
  } catch (error) {
    return {
      status: 'error',
      candidates: [],
      reason: error instanceof Error ? error.message : 'worker_group_recommendation_catalog_failed',
    };
  }
};

/** The groups a person could join: those a saved sign-in lists, or what a join link's group's members see. */
export const loadJoinableInterviewGroups = async ({
  sessionConfig,
  sessionSlug = '',
  workerUrl = '',
  account = '',
}: {
  sessionConfig: unknown;
  sessionSlug?: string;
  workerUrl?: string;
  account?: string;
}) =>
  loadInterviewWorkerGroupCandidates({
    sessionConfig,
    sessionSlug,
    workerUrl,
    workerToken: readCachedInterviewWorkerToken({ sessionConfig, sessionSlug, workerUrl, account }),
    inviteGroupId: readInterviewInviteGroupId(sessionSlug, workerUrl),
  });

// A slow group list never holds up someone's drafts for longer than this.
export const DRAFTING_GROUPS_TIMEOUT_MS = 5000;

/**
 * The groups to offer the AI that drafts someone's answers, on the Worker catalog's rule for their
 * own AI: only while the session joins matching groups and lets an AI use some kind of detail about
 * people. A failed or slow lookup offers none.
 */
export const loadDraftingGroupChoices = async (
  args: Parameters<typeof loadJoinableInterviewGroups>[0],
): Promise<InterviewGroupCandidate[]> => {
  const { joinMatchingGroups, groupSuggestionData } = normalizeInterviewSettings(
    asRecord(args.sessionConfig).interviewMode,
  );
  if (!joinMatchingGroups || !groupSuggestionData.length) return [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      // A failed lookup already comes back with no groups.
      loadJoinableInterviewGroups(args).then((catalog) => catalog.candidates),
      new Promise<InterviewGroupCandidate[]>((resolve) => {
        timer = setTimeout(() => resolve([]), DRAFTING_GROUPS_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

/** The kinds of detail about a person that the session lets an AI base a group suggestion on. */
export const groupSuggestionDataFor = (sessionConfig: unknown): GroupSuggestionDataKind[] =>
  normalizeInterviewSettings(asRecord(sessionConfig).interviewMode).groupSuggestionData;

// Group names and options compare without case or extra spacing: "D/acc " names group "d/acc".
const nameKey = (value: unknown): string => lower(value).replace(/\s+/g, ' ');

/**
 * Open groups named exactly like an option the person chose, or their AI drafted, on a
 * single-choice question. These need no AI call: choosing "d/acc" suggests group "d/acc".
 */
export const matchInterviewGroupsByAnswer = ({
  candidates,
  draftResponses = [],
  questions = [],
}: {
  candidates: InterviewGroupCandidate[];
  draftResponses?: InterviewDraftResponse[];
  questions?: InterviewQuestion[];
}): InterviewGroupRecommendation[] => {
  const singleChoice = new Set(
    questions
      .filter((question) => question.type === 'multichoice' && question.singleSelect === true)
      .map((question) => lower(question.id)),
  );
  const groups = new Map(candidates.map((group) => [nameKey(group.label), group]));
  const matches: InterviewGroupRecommendation[] = [];
  for (const draft of draftResponses) {
    if (!singleChoice.has(lower(draft.questionId))) continue;
    const choice = toText(Array.isArray(draft.answer) && draft.answer.length === 1 ? draft.answer[0] : draft.answer);
    const group = choice ? groups.get(nameKey(choice)) : undefined;
    if (!group || matches.some((match) => match.groupId === group.groupId)) continue;
    // A kept answer naming the group is as strong as a match gets.
    matches.push({ groupId: group.groupId, reason: `You chose “${choice}”.`, confidence: 1 });
  }
  return matches;
};

/**
 * The groups an AI picked, among those the person could join: their own AI's, from its prefill,
 * marked as theirs, or the session's AI's, from the reply that drafted their answers.
 */
export const matchInterviewGroupsFromPicks = ({
  candidates,
  picks = [],
  ownAi = false,
}: {
  candidates: InterviewGroupCandidate[];
  picks?: InterviewPrefillGroupPick[];
  ownAi?: boolean;
}): InterviewGroupRecommendation[] => {
  const eligible = new Set(candidates.map((group) => group.groupId));
  const ownReason = (reason = '') => (reason ? `Your AI: ${reason}` : 'Your AI suggested this group.');
  return picks
    .filter((pick) => eligible.has(pick.groupId))
    .map((pick) => ({
      groupId: pick.groupId,
      reason: ownAi ? ownReason(pick.reason) : pick.reason || '',
      ...(pick.confidence === undefined ? {} : { confidence: pick.confidence }),
    }));
};
