/** @file sessionAgentWording.ts: what the Session Agent's notices tell a person, by who the session shows answers to. */
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

/** Behind the "?" of "Use my answers and files": the same under every results setting. */
export const SESSION_AGENT_USE_NOTICE =
  'The Session Agent may draw on the files you added, and Detailed answers on your answers too, never naming ' +
  'you. Turning it off stops future use and keeps them out of exports made from then on; it can’t take back ' +
  'answers already given.';

/** Behind the "?" of "Include my address with my answers". The switch changes exports and nothing else. */
export const sessionAgentAddressNotice = (sessionConfig: unknown): string =>
  `What you wrote and the files you added are available with your account address ${answersReach(sessionConfig)}, ` +
  'and may be exported with it. Turning this off leaves your address off exports only; it still shows wherever ' +
  'this session shows your answers. Copies already made keep it.';
