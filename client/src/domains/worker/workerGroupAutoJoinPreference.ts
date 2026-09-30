type Scope = {
  workerUrl: string;
  sessionSlug: string;
  sessionId?: string;
  groupId: string;
};

const prefix = 'ce:worker-group-auto-join-cancelled:v1:';
const id = (scope: Scope) => JSON.stringify([new URL(scope.workerUrl).origin, scope.sessionSlug, scope.groupId]);

// One choice per browser. Older keys also named an account; they still count
// until an explicit Join clears them.
const keys = (scope: Scope) => [
  `${prefix}${id(scope)}`,
  ...Object.keys(localStorage).filter((key) => key.startsWith(`${prefix}${id(scope).slice(0, -1)},`)),
];

export const isWorkerGroupAutoJoinCancelled = (scope: Scope): boolean => {
  try {
    return keys(scope).some((key) => {
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      return (
        saved?.cancelled === true &&
        (!saved.sessionId || !scope.sessionId || saved.sessionId === scope.sessionId.toLowerCase())
      );
    });
  } catch {
    return false;
  }
};

export const rememberWorkerGroupAutoJoinCancellation = (scope: Scope): boolean => {
  try {
    localStorage.setItem(
      `${prefix}${id(scope)}`,
      JSON.stringify({ cancelled: true, sessionId: scope.sessionId?.toLowerCase() }),
    );
    return true;
  } catch {
    return false;
  }
};

export const clearWorkerGroupAutoJoinCancellation = (scope: Scope): void => {
  try {
    keys(scope).forEach((key) => localStorage.removeItem(key));
  } catch {
    // Joining is still possible when browser storage is disabled.
  }
};
