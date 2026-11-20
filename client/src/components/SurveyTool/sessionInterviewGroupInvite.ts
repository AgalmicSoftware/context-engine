import { canonicalizeSessionSlug } from '../../utilities/session/canonicalSessionContext.js';
import { readLinkedWorkerGroupId } from '../../domains/worker/workerGroupAutoJoin';
import { readPendingAutoJoin, type WorkerGroupAutoJoinIntent } from '../../domains/worker/workerGroupAutoJoinIntent';

const pendingFor = (sessionSlug: string, workerUrl: string): WorkerGroupAutoJoinIntent | null => {
  const intent = readPendingAutoJoin();
  try {
    return intent &&
      intent.sessionSlug === canonicalizeSessionSlug(sessionSlug) &&
      new URL(workerUrl).origin === intent.workerOrigin
      ? intent
      : null;
  } catch {
    return null;
  }
};

/** The group this page's join link is for, joined or not; it shows a signed-out person what its members see. */
export const readInterviewInviteGroupId = (sessionSlug: string, workerUrl: string): string =>
  pendingFor(sessionSlug, workerUrl)?.groupId || readLinkedWorkerGroupId(canonicalizeSessionSlug(sessionSlug));
