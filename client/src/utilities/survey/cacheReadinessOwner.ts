// Who may publish a cache's ready flag. A foreground load holds it while it runs,
// so an earlier session's load finishing late cannot mark the session now loading
// as ready. With no such load running, any load may publish, so a load that failed
// does not leave the page waiting.
export const createCacheReadinessOwner = () => {
  let owner: string | null = null;
  return {
    claim: (runKey: string): void => {
      owner = runKey;
    },
    release: (runKey: string): void => {
      if (owner === runKey) owner = null;
    },
    allows: (runKey: string): boolean => owner === null || owner === runKey,
  };
};
