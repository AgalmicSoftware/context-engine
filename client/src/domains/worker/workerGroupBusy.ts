// Reasons a group join fails only because many people joined at once. The
// join request already retries them; if they persist, joining again later works.
const BUSY_WORKER_GROUP_REASONS = new Set([
  'worker_group_coordination_unavailable',
  'worker_group_membership_state_pending',
  'worker_group_mutation_ambiguous',
  'worker_group_request_failed_503',
]);

export const isBusyWorkerGroupError = (error: unknown): boolean =>
  error instanceof Error && BUSY_WORKER_GROUP_REASONS.has(error.message);

export const BUSY_WORKER_GROUP_JOIN_MESSAGE = 'Many people are joining at once. Try again in a moment.';

// Every join refused before a valid secret gets one answer, so it never shows whether an unlisted group exists.
export const isRefusedWorkerGroupError = (error: unknown): boolean =>
  error instanceof Error && error.message === 'worker_group_join_refused';

export const REFUSED_WORKER_GROUP_JOIN_MESSAGE =
  'That link, invite or password didn’t work. Ask whoever invited you for a new one.';

/** A failed join as one plain sentence: the Worker's reason codes never reach the page. */
export const workerGroupJoinErrorMessage = (error: unknown): string => {
  if (isBusyWorkerGroupError(error)) return BUSY_WORKER_GROUP_JOIN_MESSAGE;
  const reason = error instanceof Error ? error.message : '';
  if (reason === 'worker_group_member_cap_exceeded' || reason === 'worker_group_session_cap_exceeded')
    return 'This group has reached its member limit.';
  if (reason === 'worker_group_join_ended') return 'The joining deadline for this group has passed.';
  if (reason === 'worker_group_join_refused') return REFUSED_WORKER_GROUP_JOIN_MESSAGE;
  if (reason === 'worker_group_join_denied') return 'This group is not open for joining.';
  if (reason === 'worker_group_not_found') return 'This group is unavailable in this session.';
  return reason.startsWith('worker_group_') || !reason
    ? 'Could not join this group. Please retry or contact the session host.'
    : reason;
};
