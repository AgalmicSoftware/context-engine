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
