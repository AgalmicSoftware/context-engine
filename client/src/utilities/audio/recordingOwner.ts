export type RecordingOptions = {
  sessionSlug: string;
  sessionConfig: Record<string, unknown> | null;
  context?: unknown;
  workerUrl?: string;
};

// A recording belongs to a session on a Worker, and to the account that made it. Its scope is the JSON array
// `[worker, slug, account]`; `identity` is the same array without the account.
export const recordingOwner = ({ sessionSlug, sessionConfig, context, workerUrl }: RecordingOptions) => {
  const account =
    context && typeof context === 'object' && 'account' in context ? String(context.account || '').toLowerCase() : '';
  const worker = workerUrl || sessionConfig?.corsWorkerUrl || sessionConfig?.workerUrl || '';
  return { account, worker, identity: JSON.stringify([worker, sessionSlug]) };
};
