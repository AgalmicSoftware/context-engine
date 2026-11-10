// Who may publish a cache's ready flag: the newest foreground load. An earlier load
// keeps filling its own session's cache, but how it ends, whether complete, partial
// or failed, says nothing about the session on screen, and a failed newer load must
// not be marked ready by it.
export const createCacheReadinessOwner = () => {
  let owner: string | null = null;
  return {
    claim: (runKey: string): void => {
      owner = runKey;
    },
    allows: (runKey: string): boolean => owner === null || owner === runKey,
  };
};
