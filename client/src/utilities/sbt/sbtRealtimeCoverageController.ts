import { normalizeSessionSlug } from '../web3/contractScripts.js';

interface SbtRealtimeCoverageState {
  sbtRealtimeCoverageBySlug?: Record<string, unknown>;
}

type SbtRealtimeCoverageStatePatch = {
  sbtRealtimeCoverageBySlug: Record<string, unknown>;
} | null;

type SbtRealtimeCoverageUpdater = (prev: SbtRealtimeCoverageState | null | undefined) => SbtRealtimeCoverageStatePatch;

interface SbtRealtimeCoverageControllerOptions {
  setState?: ((updater: SbtRealtimeCoverageUpdater, cb?: unknown) => unknown) | null;
}

export const createSbtRealtimeCoverageController = ({ setState = null }: SbtRealtimeCoverageControllerOptions = {}) => {
  const applyState = (updater: SbtRealtimeCoverageUpdater, cb?: unknown): void => {
    if (typeof setState === 'function') {
      setState(updater, cb);
      return;
    }
    if (typeof cb === 'function') cb();
  };

  const setSbtRealtimeCoverageForGroup = (slugIn: unknown, hasCoverage: unknown = true): void => {
    const slug = normalizeSessionSlug(slugIn || '');
    applyState((prev) => {
      const currentMap = prev?.sbtRealtimeCoverageBySlug || {};
      if (hasCoverage) {
        if (currentMap[slug] === true) return null;
        return {
          sbtRealtimeCoverageBySlug: {
            ...currentMap,
            [slug]: true,
          },
        };
      }
      if (!Object.prototype.hasOwnProperty.call(currentMap, slug)) return null;
      const next = { ...currentMap };
      delete next[slug];
      return { sbtRealtimeCoverageBySlug: next };
    });
  };

  const clearSbtRealtimeCoverageForGroup = (slugIn: unknown): void => {
    setSbtRealtimeCoverageForGroup(slugIn, false);
  };

  return {
    setSbtRealtimeCoverageForGroup,
    clearSbtRealtimeCoverageForGroup,
  };
};
