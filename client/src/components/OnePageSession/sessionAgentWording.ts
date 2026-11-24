/** @file sessionAgentWording.ts: what the Session Agent's notices tell a person, by who the session shows answers to. */
import { sessionAgentSettingOf } from '@ce-shared/sessionAgent.mjs';
import { MEMBER_RESULTS, PUBLIC_RESULTS } from '../Sessions/setup/sessionSetupProfile';

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/**
 * Who a person's answers are shown to with their address, under the session's results setting. Its organisers
 * always are; a setting that shows others only totals, or one this page doesn't know, names no one else.
 */
export const answersReach = (sessionConfig: unknown): string => {
  const { visibility } = asRecord(asRecord(asRecord(sessionConfig).sessionModeProfile).results);
  if (visibility === PUBLIC_RESULTS) return 'to anyone with this session’s link';
  if (visibility === MEMBER_RESULTS) return 'to this session’s organisers and its signed-in members';
  return 'to this session’s organisers';
};

/** By the session's title, while it has a Session Agent. */
export const sessionAgentPageNotice = (sessionConfig: unknown): string =>
  'The Session Agent may draw on your answers and the files you add when it answers others, never naming you. ' +
  `They are available with your account address ${answersReach(sessionConfig)}, and may be exported; ` +
  'a summary without names or addresses may be published.';

/** Behind the "?" of "Session Agent may use my answers and files": the same under every results setting. */
export const SESSION_AGENT_USE_NOTICE =
  'The Session Agent may draw on the files you added, and Detailed answers on your answers too, never naming ' +
  'you. Turning it off stops future use and keeps them out of exports made from then on; it can’t take back ' +
  'answers already given.';

/**
 * Behind the "?" of "Include my address with my answers". The switch changes exports and nothing else, and there
 * only what the person wrote and added: an export's group member lists carry every member's address.
 */
export const sessionAgentAddressNotice = (sessionConfig: unknown): string =>
  `What you wrote and the files you added are available with your account address ${answersReach(sessionConfig)}, ` +
  'and may be exported with it. Turn this off and exports leave your address off what you wrote and added; a ' +
  'group’s member list in an export still includes it, and it still shows wherever this session shows your ' +
  'answers. Copies already made keep it.';

type Condition = NonNullable<
  ReturnType<typeof sessionAgentSettingOf>
>['audiences'][number]['who']['conditions'][number];

// What one rule admits, as names two rules share when they admit the same people; 'in' is anyone signed in.
const reachOf = (condition: Condition): string[] => {
  if (condition.kind === 'worker_group') return condition.groupIds.map((id) => `group:${id}`);
  if (condition.kind === 'sbt_onchain') {
    return [`sbt:${condition.chainId}:${condition.contract}:${condition.anyOrAll}`];
  }
  return condition.kind === 'agent_grant_scope' ? ['in'] : [];
};
const GROUPS = 'members of some of its groups';
const HOLDERS = 'people holding certain digital credentials';

/**
 * Behind the "?" of someone given General answers: who the session gives Detailed ones, read from its own
 * audiences as the Worker judges them, so it never promises more than they allow. The first audience that
 * admits a person sets their answers, so one that an earlier audience already answers in full is passed over,
 * and none counts after an audience that admits everyone signed in. An audience that asks for all of its
 * rules is named as the people who meet them all. Admins always get Detailed answers; when no audience does,
 * it says only that.
 */
export const sessionAgentFullerAnswersNote = (sessionConfig: unknown, signedOut: boolean): string => {
  const audiences = sessionAgentSettingOf(asRecord(sessionConfig).sessionAgent)?.audiences || [];
  // Who earlier audiences already answer, whatever a later one says.
  const answered = new Set<string>();
  const who = new Set<string>();
  for (const { who: rule, answers } of audiences) {
    const detailed = answers === 'detailed';
    // An audience that needs an admin adds no one: admins get Detailed answers anyway.
    const needsAdmin = rule.match === 'all' && rule.conditions.some((condition) => condition.kind === 'worker_role');
    const rules = rule.conditions.filter((condition) => condition.kind !== 'worker_role');
    if (needsAdmin || !rules.length) continue;
    if (rule.match === 'any') {
      const reach = rules.flatMap(reachOf).filter((name) => !answered.has(name));
      if (detailed) {
        if (reach.some((name) => name.startsWith('group:'))) who.add(GROUPS);
        if (reach.some((name) => name.startsWith('sbt:'))) who.add(HOLDERS);
        if (reach.includes('in')) who.add(signedOut ? 'people who sign in' : 'other signed-in people');
      }
      reach.forEach((name) => answered.add(name));
      if (reach.includes('in')) break;
      continue;
    }
    // All of its rules: signing in is part of every rule, so what is left says who they are.
    const needed = rules.filter((condition) => condition.kind !== 'agent_grant_scope');
    if (!needed.length) {
      if (detailed) who.add(signedOut ? 'people who sign in' : 'other signed-in people');
      break;
    }
    // Everyone a rule admits is answered already, so no one reaches this audience.
    if (needed.some((condition) => reachOf(condition).every((name) => answered.has(name)))) continue;
    if (detailed) {
      const groups = needed.some((condition) => condition.kind === 'worker_group');
      const holders = needed.some((condition) => condition.kind === 'sbt_onchain');
      who.add(groups && holders ? `${GROUPS} who also hold certain digital credentials` : groups ? GROUPS : HOLDERS);
    }
    // One rule alone answers everyone it admits, as an "any" audience would.
    if (needed.length === 1) reachOf(needed[0]).forEach((name) => answered.add(name));
  }
  if (!who.size) return 'In this session only its admins get Detailed answers.';
  const list = [...who];
  const named = list.length > 1 ? `${list.slice(0, -1).join(', ')} or ${list.at(-1)}` : list[0];
  return (
    `In this session ${named} may get Detailed answers, which also draw on members’ answers.` +
    (signedOut ? ' Sign in to see which you get.' : '')
  );
};
