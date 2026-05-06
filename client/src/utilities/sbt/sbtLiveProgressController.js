import { normalizeSessionSlug } from '../web3/contractScripts.js';
import {
  mergeSbtLiveProgressEntry,
  SBT_PROGRESS_MIN_INTERVAL_MS,
  shouldCommitThrottledProgress,
} from '../../components/MainSite/progressHelpers.js';

export const createSbtLiveProgressController = ({
  mergeProgressEntry = mergeSbtLiveProgressEntry,
  setState = null,
  shouldCommitProgress = shouldCommitThrottledProgress,
  minIntervalMs = SBT_PROGRESS_MIN_INTERVAL_MS,
} = {}) => {
  const progressMetaBySlug = new Map();

  const applyState = (updater, cb) => {
    if (typeof setState === 'function') {
      setState(updater, cb);
      return;
    }
    if (typeof cb === 'function') cb();
  };

  const beginSbtLiveProgress = (slugIn, initialPatch = {}) => {
    const slug = normalizeSessionSlug(slugIn || '');
    const token = Number(progressMetaBySlug.get(slug)?.token || 0) + 1;
    const nowMs = Date.now();
    progressMetaBySlug.set(slug, {
      token,
      lastCommitMs: nowMs,
    });
    applyState((prev) => ({
      sbtScanProgressBySlug: {
        ...(prev?.sbtScanProgressBySlug || {}),
        [slug]: mergeProgressEntry({
          prevEntry: null,
          nextPatch: {
            slug,
            ...initialPatch,
            updatedAtMs: nowMs,
          },
          nowMs,
        }),
      },
    }));
    return token;
  };

  const updateSbtLiveProgress = (slugIn, token, nextPatch = {}, options = {}) => {
    const slug = normalizeSessionSlug(slugIn || '');
    const meta = progressMetaBySlug.get(slug);
    if (!meta || Number(meta.token || 0) !== Number(token || 0)) return false;
    const nowMs = Date.now();
    if (!shouldCommitProgress({
      force: options?.force === true,
      nowMs,
      lastCommitMs: Number(meta.lastCommitMs || 0),
      minIntervalMs,
    })) {
      return false;
    }
    meta.lastCommitMs = nowMs;
    progressMetaBySlug.set(slug, meta);
    applyState((prev) => {
      const prevEntry = prev?.sbtScanProgressBySlug?.[slug] || null;
      const nextEntry = mergeProgressEntry({
        prevEntry,
        nextPatch: {
          slug,
          ...nextPatch,
          updatedAtMs: nowMs,
        },
        nowMs,
      });
      if (
        prevEntry &&
        Number(prevEntry.currentBlock || 0) === Number(nextEntry.currentBlock || 0) &&
        Number(prevEntry.latestBlock || 0) === Number(nextEntry.latestBlock || 0)
      ) {
        return null;
      }
      return {
        sbtScanProgressBySlug: {
          ...(prev?.sbtScanProgressBySlug || {}),
          [slug]: nextEntry,
        },
      };
    });
    return true;
  };

  const clearSbtLiveProgress = (slugIn, token = null) => {
    const slug = normalizeSessionSlug(slugIn || '');
    const meta = progressMetaBySlug.get(slug);
    if (token != null && Number(meta?.token || 0) !== Number(token || 0)) return;
    progressMetaBySlug.delete(slug);
    applyState((prev) => {
      const current = prev?.sbtScanProgressBySlug || {};
      if (!Object.prototype.hasOwnProperty.call(current, slug)) return null;
      const next = { ...current };
      delete next[slug];
      return { sbtScanProgressBySlug: next };
    });
  };

  const destroy = () => {
    progressMetaBySlug.clear();
  };

  return {
    beginSbtLiveProgress,
    updateSbtLiveProgress,
    clearSbtLiveProgress,
    destroy,
  };
};
