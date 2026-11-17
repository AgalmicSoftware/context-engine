import { sessionAgentMinAnswers, sessionAgentSettingOf, sessionAgentStoresChats } from '../../shared/sessionAgent.mjs';
import {
  buildSessionAgentExport, serializeSessionAgentExport, sessionAgentExportFilename,
} from '../../shared/sessionAgentExport.mjs';
import { CONTEXT_ROLE, contextRoleOf, groupLockedIds, isAdminsOnlyAccess } from '../../shared/sessionContextSources.mjs';
import { CONTEXT_READ_LIMITS, forEveryone, loadParticipantContextSources } from './contextSourceLoader.js';
import { PAYLOAD_ACCESS_GATES, PAYLOAD_ENCRYPTION_MODES } from './payloadAccessControl.js';
import { evaluateResultsAnalysisViewerEligibility, readPublishedResultsAnalysisArtifact } from './resultsAnalysisGeneration.js';
import { TOO_MANY_STORED, callSessionAgentHistoryStore, readMemberAnswers, resultsText } from './sessionAgentRoute.js';
import { callSessionConfigCoordinator } from './sessionConfigAuthority.js';
import { resolveCanonicalWorkerSessionIdHex } from './sessionConfigMutation.js';
import { resolvePayloadAccessControl } from './storageRouteExecution.js';
import { isWorkerCanonicalSessionConfig } from './workerCanonicalAuthority.js';
import { MAX_WORKER_GROUP_MEMBER_PAGE_SIZE, listWorkerGroupMembers, normalizeWorkerGroupId } from './workerGroups.js';

// POST /admin/session-agent/export, signed by a full admin: what the Session
// Agent may give a member, as one file for the session's organisers, with who
// is in the groups its rules name. It is built from what the agent itself
// reads, so the file and the agent's answers never disagree about what counts
// or who is left out. What can't be read is never left out silently: the
// export refuses instead.
export const SESSION_AGENT_EXPORT_ACTION = 'session-agent/export';

// One export reads more context than one answer does, since whoever uses the
// file picks from it: as many sources as two answers' worth, each cut as an
// answer cuts it. Listing a group reads each member, so one export lists this
// many members in all, across this many groups; past either, a group's list
// says it is not complete.
const LIMITS = Object.freeze({
  contextSources: CONTEXT_READ_LIMITS.sources * 2,
  contextChars: 200_000,
  members: 500,
  groups: 40,
});

const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const trim = (value) => (typeof value === 'string' ? value.trim() : '');
const lower = (value) => trim(value).toLowerCase();
const refuse = (status, error, reason) => ({ ok: false, status, body: { error, reason } });

const OPEN_RULE = Object.freeze({ match: 'any', conditions: [] });
const UNKNOWN_RULE = Object.freeze({ match: 'all', conditions: [{ kind: 'unknown' }] });

const UNKNOWN = Object.freeze({ kind: 'unknown' });
const ADDRESS = /^0x[0-9a-f]{40}$/;
const has = (rule, ...fields) => fields.some((field) => rule[field] !== undefined);
const groupsOf = (ids) => [...new Set((Array.isArray(ids) ? ids : [ids]).map(normalizeWorkerGroupId).filter(Boolean))].sort();

// One condition in the words the agent's audiences use, read the way the
// Worker's own check reads it. One this file can't say exactly becomes
// `{ kind: 'unknown' }`, so its reader refuses rather than guesses.
//
// The sign-in rule knows two kinds, a role and one group, and admits no one by
// any other.
const signInConditionOf = (rule) => {
  const kind = lower(rule.kind);
  if (kind === 'worker_role') return { kind, role: lower(rule.role) || 'admin' };
  if (kind === 'worker_group' && typeof rule.groupId === 'string' && groupsOf(rule.groupId).length) {
    return { kind, groupIds: groupsOf(rule.groupId) };
  }
  return { ...UNKNOWN };
};
// The reading rule takes older spellings too; an SBT rule is said only in the
// one shape the file's readers know: one contract on a named chain.
const readConditionOf = (rule) => {
  const kind = lower(rule.kind);
  if (kind === 'worker_role') return { kind, role: lower(rule.role || rule.name) || 'admin' };
  if (kind === 'agent_grant_scope' && trim(rule.scope || rule.value)) return { kind, scope: trim(rule.scope || rule.value) };
  if (kind === 'worker_group') {
    const groupIds = groupsOf(rule.groupIds || rule.groups || rule.groupId);
    return groupIds.length ? { kind, groupIds } : { ...UNKNOWN };
  }
  if (kind === 'sbt_onchain') {
    const anyOrAll = rule.anyOrAll === undefined ? 'any' : lower(rule.anyOrAll);
    return !has(rule, 'sbtAddresses', 'address', 'mode', 'match', 'networkChainId') && Number.isSafeInteger(rule.chainId) && rule.chainId > 0 &&
      ADDRESS.test(lower(rule.contract)) && ['any', 'all'].includes(anyOrAll)
      ? { kind, chainId: rule.chainId, contract: lower(rule.contract), anyOrAll }
      : { ...UNKNOWN };
  }
  return { ...UNKNOWN };
};
// Sign-in skips an entry that isn't a rule, as the Worker's own check does; in
// a reading rule such an entry is not guessed at.
const signInRuleOf = (rule) => ({
  match: lower(rule?.match) === 'all' ? 'all' : 'any',
  conditions: (Array.isArray(rule?.conditions) ? rule.conditions : []).filter(isObj).map(signInConditionOf),
});
const readRuleOf = (rule) => ({
  match: lower(rule?.match) === 'all' ? 'all' : 'any',
  conditions: (Array.isArray(rule?.conditions) ? rule.conditions : []).map((entry) => (isObj(entry) ? readConditionOf(entry) : { ...UNKNOWN })),
});

/**
 * Who the session itself lets in: its rule for signing in and its rule for
 * reading its questions, each read the way the Worker enforces it. Someone
 * must pass both; a rule with no conditions keeps no one out, and admins pass
 * every rule.
 */
export const sessionAgentExportGate = (config) => {
  // Signing in follows the sign-in rule only where the Worker runs the session under its own policy.
  const policy = isObj(config?.workerAuthority) && Number(config.workerAuthority.version) === 1 ? config.workerAuthority : null;
  const signIn = isWorkerCanonicalSessionConfig(config) && policy
    ? (isObj(policy.loginGate) ? signInRuleOf(policy.loginGate) : OPEN_RULE)
    : UNKNOWN_RULE;
  // The reading rule, in the order the Worker's own gate tries it: its
  // conditions when it has any, then no gate, then the gate's groups.
  const access = resolvePayloadAccessControl(config);
  let read = UNKNOWN_RULE;
  if (access.conditions?.conditions?.length) read = readRuleOf(access.conditions);
  else if (access.encryption === PAYLOAD_ENCRYPTION_MODES.LIT || access.gate === PAYLOAD_ACCESS_GATES.NONE) read = OPEN_RULE;
  else if (access.gate === PAYLOAD_ACCESS_GATES.GROUP_GATE && access.groupIds.length) {
    read = readRuleOf({ conditions: [{ kind: 'worker_group', groupIds: access.groupIds }] });
  }
  return { signIn: { ...signIn }, read: { ...read } };
};

// Every group a reader of the file needs the members of: those the session's
// rules and the agent's audiences name, and those an exported item is locked to.
const groupsNamed = (gate, setting, sources, asked) => [...new Set([
  ...[...gate.signIn.conditions, ...gate.read.conditions, ...setting.audiences.flatMap((audience) => audience.who.conditions)]
    .filter((condition) => condition.kind === 'worker_group')
    .flatMap((condition) => condition.groupIds),
  ...sources.flatMap((source) => (source.everyone ? [] : source.groupIds)),
  // An admin's stored chat isn't exported, so its groups need no list.
  ...asked.flatMap((chat) => (chat?.scope === undefined && Array.isArray(chat?.groups) ? chat.groups : [])),
].map(normalizeWorkerGroupId).filter(Boolean))].sort();

// The addresses in one group, a page at a time, within what is left of the
// export's budget. A member without an address (one who joined through
// Telegram or as an agent grant) can't be listed and is counted instead.
// Null when the group can't be read just now.
const membersOf = async ({ env, slug, sessionId, groupId, budget, deps }) => {
  const list = deps.listWorkerGroupMembers || listWorkerGroupMembers;
  const members = [];
  let withoutAddress = 0;
  for (let cursor = ''; ;) {
    const limit = Math.min(MAX_WORKER_GROUP_MEMBER_PAGE_SIZE, budget.left);
    if (limit < 1) return { groupId, members, withoutAddress, complete: false };
    let page = null;
    try {
      page = await list({ env, slug, sessionId, groupId, cursor, limit });
    } catch {
      return null;
    }
    // A group the rules name that no longer exists has no members.
    if (!page?.ok) return page?.status === 404 ? { groupId, members: [], withoutAddress: 0 } : null;
    const rows = Array.isArray(page.members) ? page.members : [];
    budget.left -= Math.max(1, rows.length);
    rows.forEach((member) => {
      const address = lower(member?.principal?.address);
      if (address) members.push(address);
      else withoutAddress += 1;
    });
    const next = trim(page.nextCursor);
    if (!next) return { groupId, members, withoutAddress };
    // A cursor that doesn't move on would list for ever.
    if (next === cursor) return null;
    cursor = next;
  }
};

// Names the part that couldn't be read, so one that keeps failing can be looked at.
const unavailable = (part) => ({
  ok: false,
  status: 503,
  body: {
    error: `The Session Agent’s material couldn’t all be read just now: ${part}. Nothing was exported; try again shortly.`,
    reason: 'session_agent_export_unavailable',
  },
});

/** `{ ok, filename, content, manifest }`, or a refusal with a plain sentence. `address` is the admin exporting. */
export const exportSessionAgent = async ({ env, slug, config, address, deps = {} } = {}) => {
  const setting = sessionAgentSettingOf(config?.sessionAgent);
  if (!setting || !isWorkerCanonicalSessionConfig(config)) {
    return refuse(409, 'This session has no Session Agent to export. Turn it on in Settings first.', 'session_agent_off');
  }
  const store = deps.callSessionAgentOptOutStore ||
    ((storeEnv, storeSlug, operation) => callSessionConfigCoordinator({ env: storeEnv, slug: storeSlug, path: `session-agent/${operation}` }));
  // Who opted out, and who wants their address left off, is read first: without it nothing may be exported.
  const choices = await store(env, slug, 'list');
  if (!choices?.ok || !Array.isArray(choices.body?.addresses) || !Array.isArray(choices.body?.unattributed)) return unavailable('people’s own choices');
  const optedOut = new Set(choices.body.addresses);

  // Context the agent may give a Detailed asker: what everyone the session
  // admits may read, and what is locked to groups. Admins-only items and items
  // under any other rule stay out, and are counted.
  const notExported = { adminsOnly: 0, otherRules: 0 };
  const readable = async (row) => {
    if (forEveryone(row, config) || groupLockedIds(row.accessConditions)) return true;
    if (contextRoleOf(row.tags) === CONTEXT_ROLE) notExported[isAdminsOnlyAccess(row.accessConditions) ? 'adminsOnly' : 'otherRules'] += 1;
    return false;
  };
  const gate = sessionAgentExportGate(config);
  const [context, answers, published] = await Promise.all([
    loadParticipantContextSources({
      env, slug, config, deps, readable, principal: lower(address), leaveOutUploaders: optedOut,
      totalChars: LIMITS.contextChars, maxSources: LIMITS.contextSources,
    }),
    // As a member with Detailed answers hears them: the session's own minimum applies.
    readMemberAnswers({ env, slug, config, optedOut, minAnswers: sessionAgentMinAnswers(setting), writers: true, deps }),
    (async () => {
      // Results are exported only when everyone the session admits may see them, as General answers read them.
      if (!(deps.evaluateResultsAnalysisViewerEligibility || evaluateResultsAnalysisViewerEligibility)({ config })?.ok) return { hidden: true };
      // The published results' own read says "none yet" when its storage is down, so watch the storage read itself.
      let storageRead = true;
      const readStatus = deps.readCoordinatedResultsAnalysisStatus ||
        (async (args) => (await import('./sessionWriteCoordinator.js')).readCoordinatedResultsAnalysisStatus(args));
      try {
        const found = await (deps.readPublishedResultsAnalysisArtifact || readPublishedResultsAnalysisArtifact)({
          env, slug, config, includeSnapshot: false,
          deps: {
            ...deps,
            readCoordinatedResultsAnalysisStatus: async (args) => {
              const status = await readStatus(args);
              if (status?.ok === false) storageRead = false;
              return status;
            },
          },
        });
        return storageRead ? { text: found?.ok ? resultsText(found.artifact) : '' } : null;
      } catch {
        return null;
      }
    })(),
  ]);
  if (context.unavailable || context.failed) return unavailable('its context');
  if (answers === null) return unavailable('members’ answers');
  if (published === null) return unavailable('the results');
  // The chats askers chose to store, while the session stores them.
  let asked = [];
  if (sessionAgentStoresChats(setting)) {
    let chats = null;
    try {
      chats = await (deps.callSessionAgentHistoryStore || callSessionAgentHistoryStore)(env, slug, 'all');
    } catch {
      chats = null;
    }
    if (!chats?.ok || !Array.isArray(chats.body?.entries)) return unavailable('its stored chats');
    asked = chats.body.entries;
  }
  const tooMany = answers === TOO_MANY_STORED;

  const sessionId = resolveCanonicalWorkerSessionIdHex(config);
  const budget = { left: LIMITS.members };
  const groups = [];
  for (const [index, groupId] of groupsNamed(gate, setting, context.sources, asked).entries()) {
    const group = index < LIMITS.groups
      ? await membersOf({ env, slug, sessionId, groupId, budget, deps })
      : { groupId, members: [], withoutAddress: 0, complete: false };
    if (!group) return unavailable('a group’s members');
    groups.push(group);
  }

  const bundle = await buildSessionAgentExport({
    slug,
    title: trim(config?.sessionName),
    gate,
    setting,
    questions: tooMany ? [] : answers.questions,
    sessionContext: config?.sessionContext,
    sources: context.sources,
    results: published.text || '',
    resultsForEveryone: !published.hidden,
    answers: tooMany ? [] : answers.groups,
    asked,
    unattributed: choices.body.unattributed,
    groups,
    leftOut: {
      optedOut: (tooMany ? 0 : answers.leftOut.optedOut) + context.withheld,
      belowMinAnswers: tooMany ? 0 : answers.leftOut.belowMinAnswers,
      answersWithoutAddress: tooMany ? 0 : answers.leftOut.withoutAddress,
      adminsOnlyContext: notExported.adminsOnly,
      otherRulesContext: notExported.otherRules,
      contextNotRead: context.leftOut,
      unreadableContext: context.unreadable,
      resultsNotForEveryone: published.hidden ? 1 : 0,
      membersWithoutAddress: groups.reduce((sum, group) => sum + group.withoutAddress, 0),
      // 1 when the session stores more question and answer versions than the agent can read at once: then no question or answer is in the file.
      answersNotRead: tooMany ? 1 : 0,
    },
  });
  return { ok: true, filename: sessionAgentExportFilename(slug), content: serializeSessionAgentExport(bundle), manifest: bundle.manifest };
};
