import { canonicalizeSessionSlug } from '../../utilities/session/canonicalSessionContext.js';
import { finishWorkerGroupAutoJoin, readLinkedWorkerGroupId } from '../../domains/worker/workerGroupAutoJoin';
import {
  clearPendingAutoJoin,
  readPendingAutoJoin,
  savePendingAutoJoin,
  type WorkerGroupAutoJoinIntent,
} from '../../domains/worker/workerGroupAutoJoinIntent';
import {
  clearWorkerGroupAutoJoinCancellation,
  isWorkerGroupAutoJoinCancelled,
  rememberWorkerGroupAutoJoinCancellation,
} from '../../domains/worker/workerGroupAutoJoinPreference';

const scope = (intent: WorkerGroupAutoJoinIntent) => ({
  workerUrl: intent.workerOrigin,
  sessionSlug: intent.sessionSlug,
  sessionId: intent.sessionId,
  groupId: intent.groupId,
});

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

/** This session's join link group, still waiting for sign-in and not cancelled. */
export const readPendingInterviewInvite = (
  sessionSlug: string,
  workerUrl: string,
): WorkerGroupAutoJoinIntent | null => {
  const intent = pendingFor(sessionSlug, workerUrl);
  return intent && !isWorkerGroupAutoJoinCancelled(scope(intent)) ? intent : null;
};

/** The group this page's join link is for, joined or not; it shows a signed-out person what its members see. */
export const readInterviewInviteGroupId = (sessionSlug: string, workerUrl: string): string =>
  pendingFor(sessionSlug, workerUrl)?.groupId || readLinkedWorkerGroupId(canonicalizeSessionSlug(sessionSlug));

/** Unticking a link's group cancels its join in this browser, as the link notice's Cancel does. */
export const cancelInterviewInvite = (intent: WorkerGroupAutoJoinIntent) => {
  rememberWorkerGroupAutoJoinCancellation(scope(intent));
  clearPendingAutoJoin(intent);
  finishWorkerGroupAutoJoin(intent.sessionSlug, intent.groupId);
};

/** Ticking it again joins it after all, as the notice's Join does. */
export const resumeInterviewInvite = (intent: WorkerGroupAutoJoinIntent) => {
  clearWorkerGroupAutoJoinCancellation(scope(intent));
  savePendingAutoJoin(intent);
};

/** Once joined from the Groups area, the link has done its job. */
export const finishInterviewInvite = (intent: WorkerGroupAutoJoinIntent) => {
  clearPendingAutoJoin(intent);
  finishWorkerGroupAutoJoin(intent.sessionSlug, intent.groupId, intent.sessionId);
};
