import { RESULTS_ANALYSIS_SCAN_LIMITS } from './storageScanBudget.js';
import { buildIndexPrefix, getStorageIndexBinding, listedAnswerVersions } from './storageRouteExecution.js';
import { buildSessionIdOf } from './answerVersionStamp.js';
import { hiddenStorageResourcePrefix } from './storageResourceOwnership.js';

const LIST_PAGE = 1000;
const MAX_LISTS = 60;

// The rows an AI build reads in one pass: every stored version of every
// question, each hidden-question mark, and every answer except a person's
// older answers to a question that list entries show (listedAnswerVersions).
// Counted from key lists alone, so at most 60 lists.
export const countResultsScanRows = async ({ env, slug, config } = {}) => {
  const index = getStorageIndexBinding(env);
  const limit = RESULTS_ANALYSIS_SCAN_LIMITS.rows;
  const over = { count: limit + 1, limit, overLimit: true };
  const responses = buildIndexPrefix({ slug, resource: 'responses' });
  let count = 0;
  let lists = 0;
  for (const prefix of [
    buildIndexPrefix({ slug, resource: 'questions' }),
    responses,
    hiddenStorageResourcePrefix({ slug, resource: 'questions' }),
  ]) {
    const entries = [];
    let cursor = '';
    do {
      if (++lists > MAX_LISTS) throw new Error('Stored rows could not be counted.');
      const listed = await index.list({ prefix, limit: LIST_PAGE, ...(cursor ? { cursor } : {}) });
      const keys = Array.isArray(listed?.keys) ? listed.keys : [];
      if (prefix === responses) entries.push(...keys);
      else count += keys.length;
      if (count > limit) return over;
      if (entries.length > RESULTS_ANALYSIS_SCAN_LIMITS.listed) return over;
      cursor = listed?.list_complete === false ? String(listed?.cursor || '') : '';
      if (listed?.list_complete === false && !cursor) throw new Error('Stored rows could not be counted.');
    } while (cursor);
    count += listedAnswerVersions(entries, { prefix: responses, sessionId: buildSessionIdOf(config) })
      .filter((version) => version?.older !== true).length;
    if (count > limit) return over;
  }
  return { count, limit, overLimit: false };
};
