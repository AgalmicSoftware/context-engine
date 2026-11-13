import { RESULTS_ANALYSIS_SCAN_LIMITS } from './storageScanBudget.js';
import { buildIndexPrefix, getStorageIndexBinding } from './storageRouteExecution.js';
import { hiddenStorageResourcePrefix } from './storageResourceOwnership.js';

const LIST_PAGE = 1000;

// The rows an AI build reads in one pass: every stored version of every
// question and answer, and each hidden-question mark. Counted from key lists
// alone, and only until the count passes the limit, so at most a dozen lists.
export const countResultsScanRows = async ({ env, slug } = {}) => {
  const index = getStorageIndexBinding(env);
  const limit = RESULTS_ANALYSIS_SCAN_LIMITS.rows;
  let count = 0;
  let lists = 0;
  for (const prefix of [
    buildIndexPrefix({ slug, resource: 'questions' }),
    buildIndexPrefix({ slug, resource: 'responses' }),
    hiddenStorageResourcePrefix({ slug, resource: 'questions' }),
  ]) {
    let cursor = '';
    do {
      if (++lists > 20) throw new Error('Stored rows could not be counted.');
      const listed = await index.list({ prefix, limit: LIST_PAGE, ...(cursor ? { cursor } : {}) });
      count += Array.isArray(listed?.keys) ? listed.keys.length : 0;
      if (count > limit) return { count: limit + 1, limit, overLimit: true };
      cursor = listed?.list_complete === false ? String(listed?.cursor || '') : '';
      if (listed?.list_complete === false && !cursor) throw new Error('Stored rows could not be counted.');
    } while (cursor);
  }
  return { count, limit, overLimit: false };
};
