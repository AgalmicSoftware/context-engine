import { normalizeSessionSlug } from '../web3/contractScripts.js';

export const createSbtRealtimeCoverageController = ({
  setState = null,
} = {}) => {
  const applyState = (updater, cb) => {
    if (typeof setState === 'function') {
      setState(updater, cb);
      return;
    }
    if (typeof cb === 'function') cb();
  };

  const setSbtRealtimeCoverageForGroup = (slugIn, hasCoverage = true) => {
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

  const clearSbtRealtimeCoverageForGroup = (slugIn) => {
    setSbtRealtimeCoverageForGroup(slugIn, false);
  };

  return {
    setSbtRealtimeCoverageForGroup,
    clearSbtRealtimeCoverageForGroup,
  };
};
