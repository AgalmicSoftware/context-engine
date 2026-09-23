type Scope = {
  workerUrl: string;
  sessionSlug: string;
  sessionId?: string;
  groupId: string;
  account?: unknown;
};

const key = (scope: Scope) =>
  `ce:worker-group-auto-join-cancelled:v1:${JSON.stringify([
    new URL(scope.workerUrl).origin,
    scope.sessionSlug,
    scope.groupId,
    String(scope.account || '')
      .trim()
      .toLowerCase(),
  ])}`;

export const isWorkerGroupAutoJoinCancelled = (scope: Scope): boolean => {
  try {
    const saved = JSON.parse(localStorage.getItem(key(scope)) || 'null');
    return (
      saved?.cancelled === true &&
      (!saved.sessionId || !scope.sessionId || saved.sessionId === scope.sessionId.toLowerCase())
    );
  } catch {
    return false;
  }
};

export const rememberWorkerGroupAutoJoinCancellation = (scope: Scope): boolean => {
  try {
    localStorage.setItem(key(scope), JSON.stringify({ cancelled: true, sessionId: scope.sessionId?.toLowerCase() }));
    return true;
  } catch {
    return false;
  }
};

export const clearWorkerGroupAutoJoinCancellation = (scope: Scope): void => {
  try {
    localStorage.removeItem(key(scope));
  } catch {
    // Joining is still possible when browser storage is disabled.
  }
};
