import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const DEMO_SESSIONS_PATH = path.join(REPO_ROOT, 'client/src/variables/demo/demo_sessions.json');
const DEMO_POLIS_PATH = path.join(REPO_ROOT, 'client/src/variables/demo/demo_polis_data.json');
const DEMO_QUESTION_IDS_PATH = path.join(
  REPO_ROOT,
  'client/src/variables/demo/demo_1_onchain_question_ids.json',
);

const ZERO_SURVEY_ID = `0x${'0'.repeat(64)}`;
const DEFAULT_PAGE_LIMIT = 100;
const DEFAULT_MAX_PAGES = 10;
const DEFAULT_READ_CONCURRENCY = 8;

export const LEGACY_DEMO_POLL_OPTIONS = Object.freeze([
  'Technical researchers',
  'AI developers and labs',
  'Governments and regulators',
  'The general public',
  'Affected communities',
]);

const isObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const text = (value) => String(value ?? '');
const normalizedId = (value) => text(value).trim().toLowerCase();
const finiteNumber = (value, field) => {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${field} must be a finite number.`);
  return number;
};

const uniqueStrings = (values) => {
  const out = [];
  const seen = new Set();
  values.forEach((raw) => {
    const value = text(raw).trim();
    if (!value) return;
    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(value);
  });
  return out;
};

const splitSources = (value) =>
  text(value)
    .split(',')
    .map((source) => source.trim())
    .filter(Boolean);

const parseFixtureLocation = (value) => {
  const [fixtureFile = '', fixturePath = ''] = text(value).split('#', 2);
  if (!fixtureFile || !fixturePath) {
    throw new Error('demo-sh questionFixture must identify a tracked file and JSON path.');
  }
  return { fixtureFile, fixturePath };
};

export function buildExpectedDemoShQuestions({ demoSessions, demoPolisData, questionIds }) {
  const sessionConfig = isObject(demoSessions?.['demo-sh']) ? demoSessions['demo-sh'] : null;
  const seed = isObject(sessionConfig?.demoCompatibilitySeed) ? sessionConfig.demoCompatibilitySeed : null;
  const comments = Array.isArray(demoPolisData?.comments) ? demoPolisData.comments : null;
  if (!sessionConfig || !seed || !comments || !Array.isArray(questionIds)) {
    throw new Error('Tracked demo-sh config, comments, or question IDs are malformed.');
  }
  if (seed.temporary !== false || seed.workerCanonical !== true) {
    throw new Error('demo-sh must remain a non-temporary Worker-canonical seed.');
  }
  const expectedCount = finiteNumber(seed.questionCount, 'demo-sh questionCount');
  if (comments.length !== expectedCount || questionIds.length !== expectedCount) {
    throw new Error(
      `demo-sh seed count mismatch: config=${expectedCount}, comments=${comments.length}, ids=${questionIds.length}.`,
    );
  }

  const { fixtureFile, fixturePath } = parseFixtureLocation(seed.questionFixture);
  return comments.map((comment, sourceCommentIndex) => {
    if (!isObject(comment)) throw new Error(`demo-sh comment ${sourceCommentIndex} must be an object.`);
    const id = normalizedId(questionIds[sourceCommentIndex]);
    const sourceCommentId = text(comment.commentId).trim();
    const prompt = text(comment.commentBody).trim();
    const fixtureType = text(comment.type).trim().toLowerCase() || 'freeform';
    if (!id || !sourceCommentId || !prompt) {
      throw new Error(`demo-sh comment ${sourceCommentIndex} is missing its ID or prompt.`);
    }
    const type = fixtureType === 'poll' ? 'multichoice' : fixtureType;
    const question = {
      id,
      type,
      prompt,
      tags: uniqueStrings([fixtureType, comment.category, ...splitSources(comment.sources)]),
      creator: text(comment.authorId),
      associatedSurveyId: ZERO_SURVEY_ID,
      sessionName: text(sessionConfig.sessionName),
      sessionSlug: normalizedId(sessionConfig.slug),
      corpus: 'Context',
      temporaryDemoSeed: false,
      cloudflareDemoSeed: true,
      demoFixture: {
        sourceSessionSlug: normalizedId(seed.sourceSessionSlug),
        fixtureFile,
        fixturePath,
        onchainQuestionIdsFile: text(seed.questionIds),
        sourceCommentIndex,
        sourceCommentId,
        fixtureType,
        nodeId: text(comment.nodeId),
      },
      demoStats: {
        agrees: finiteNumber(comment.agrees ?? 0, `comment ${sourceCommentIndex} agrees`),
        disagrees: finiteNumber(comment.disagrees ?? 0, `comment ${sourceCommentIndex} disagrees`),
        moderated: finiteNumber(comment.moderated ?? 0, `comment ${sourceCommentIndex} moderated`),
        timestamp: comment.timestamp == null
          ? null
          : finiteNumber(comment.timestamp, `comment ${sourceCommentIndex} timestamp`),
        datetime: text(comment.datetime),
        category: text(comment.category),
        keyTension: text(comment.key_tension),
        sources: text(comment.sources),
      },
    };
    if (type === 'multichoice') {
      question.options = [...LEGACY_DEMO_POLL_OPTIONS];
      question.singleSelect = true;
    }
    if (type === 'rating' && isObject(comment.scale)) {
      question.scale = { ...comment.scale };
    }
    return question;
  });
}

export function loadExpectedDemoShQuestions() {
  const demoSessions = readJson(DEMO_SESSIONS_PATH);
  return {
    questions: buildExpectedDemoShQuestions({
      demoSessions,
      demoPolisData: readJson(DEMO_POLIS_PATH),
      questionIds: readJson(DEMO_QUESTION_IDS_PATH),
    }),
    sessionConfig: demoSessions['demo-sh'],
  };
}

const normalizeOptionalObject = (value) => (isObject(value) ? value : null);

export function normalizeQuestionSemantics(question) {
  if (!isObject(question)) throw new Error('Question payload must be an object.');
  const id = normalizedId(question.id);
  if (!id) throw new Error('Question payload is missing an ID.');
  const fixture = normalizeOptionalObject(question.demoFixture) || {};
  const stats = normalizeOptionalObject(question.demoStats) || {};
  return {
    id,
    type: text(question.type).trim().toLowerCase(),
    prompt: text(question.prompt),
    tags: Array.isArray(question.tags) ? question.tags.map(text) : [],
    creator: text(question.creator),
    associatedSurveyId: normalizedId(question.associatedSurveyId),
    sessionName: text(question.sessionName),
    sessionSlug: normalizedId(question.sessionSlug),
    corpus: text(question.corpus),
    temporaryDemoSeed: question.temporaryDemoSeed === true,
    cloudflareDemoSeed: question.cloudflareDemoSeed === true,
    options: Array.isArray(question.options) ? question.options.map(text) : null,
    singleSelect: question.singleSelect === true,
    scale: normalizeOptionalObject(question.scale),
    demoFixture: {
      sourceSessionSlug: normalizedId(fixture.sourceSessionSlug),
      fixtureFile: text(fixture.fixtureFile),
      fixturePath: text(fixture.fixturePath),
      onchainQuestionIdsFile: text(fixture.onchainQuestionIdsFile),
      sourceCommentIndex: finiteNumber(fixture.sourceCommentIndex, `${id} sourceCommentIndex`),
      sourceCommentId: normalizedId(fixture.sourceCommentId),
      fixtureType: text(fixture.fixtureType).trim().toLowerCase(),
      nodeId: normalizedId(fixture.nodeId),
    },
    demoStats: {
      agrees: finiteNumber(stats.agrees, `${id} agrees`),
      disagrees: finiteNumber(stats.disagrees, `${id} disagrees`),
      moderated: finiteNumber(stats.moderated, `${id} moderated`),
      timestamp: stats.timestamp == null ? null : finiteNumber(stats.timestamp, `${id} timestamp`),
      datetime: text(stats.datetime),
      category: text(stats.category),
      keyTension: text(stats.keyTension),
      sources: text(stats.sources),
    },
  };
}

const collectValueDifferences = (expected, actual, pathPrefix, differences, id) => {
  if (isDeepStrictEqual(expected, actual)) return;
  if (Array.isArray(expected) || Array.isArray(actual) || !isObject(expected) || !isObject(actual)) {
    differences.push({ kind: 'changed', id, path: pathPrefix, expected, actual });
    return;
  }
  const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();
  keys.forEach((key) => {
    collectValueDifferences(expected[key], actual[key], pathPrefix ? `${pathPrefix}.${key}` : key, differences, id);
  });
};

const indexQuestions = (questions, side, differences) => {
  if (!Array.isArray(questions)) throw new Error(`${side} questions must be an array.`);
  const byId = new Map();
  questions.forEach((question) => {
    const normalized = normalizeQuestionSemantics(question);
    if (byId.has(normalized.id)) {
      differences.push({ kind: 'duplicate', side, id: normalized.id });
      return;
    }
    byId.set(normalized.id, normalized);
  });
  return byId;
};

export function compareQuestionSets(expectedQuestions, actualQuestions) {
  const differences = [];
  const expectedById = indexQuestions(expectedQuestions, 'expected', differences);
  const actualById = indexQuestions(actualQuestions, 'actual', differences);

  for (const [id, expected] of expectedById) {
    const actual = actualById.get(id);
    if (!actual) {
      differences.push({ kind: 'missing', id });
      continue;
    }
    collectValueDifferences(expected, actual, '', differences, id);
  }
  for (const id of actualById.keys()) {
    if (!expectedById.has(id)) differences.push({ kind: 'extra', id });
  }

  return { ok: differences.length === 0, differences };
}

const fetchJson = async (fetchImpl, url) => {
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: { accept: 'application/json' },
  });
  if (!response?.ok) throw new Error(`GET ${url} failed (${response?.status ?? 'unknown'}).`);
  const payload = await response.json();
  if (!isObject(payload)) throw new Error(`GET ${url} returned malformed JSON.`);
  return payload;
};

const mapWithConcurrency = async (items, concurrency, mapItem) => {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapItem(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
};

export async function fetchWorkerQuestions({
  fetchImpl = globalThis.fetch,
  workerUrl,
  pageLimit = DEFAULT_PAGE_LIMIT,
  maxPages = DEFAULT_MAX_PAGES,
  readConcurrency = DEFAULT_READ_CONCURRENCY,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required.');
  const baseUrl = new URL(workerUrl);
  if (!/^https?:$/.test(baseUrl.protocol)) throw new Error('demo-sh Worker URL must use HTTP(S).');
  const items = [];
  const seenCursors = new Set();
  let cursor = '';
  let complete = false;

  for (let page = 0; page < maxPages; page += 1) {
    const listUrl = new URL('/storage/list', baseUrl);
    listUrl.searchParams.set('resource', 'questions');
    listUrl.searchParams.set('limit', String(pageLimit));
    if (cursor) listUrl.searchParams.set('cursor', cursor);
    const payload = await fetchJson(fetchImpl, listUrl.href);
    if (!Array.isArray(payload.items)) throw new Error('Question list response is missing items.');
    items.push(...payload.items);
    complete = payload.listComplete === true;
    if (complete) break;
    cursor = text(payload.cursor);
    if (!cursor || seenCursors.has(cursor)) throw new Error('Question list pagination did not advance.');
    seenCursors.add(cursor);
  }
  if (!complete) throw new Error(`Question list exceeded the ${maxPages}-page safety limit.`);

  return mapWithConcurrency(items, readConcurrency, async (item, index) => {
    const uri = isObject(item?.storageRef) ? text(item.storageRef.uri) : '';
    if (!uri) throw new Error(`Question list item ${index} is missing storageRef.uri.`);
    const readUrl = new URL(uri, baseUrl);
    if (readUrl.origin !== baseUrl.origin || readUrl.pathname !== '/storage/read') {
      throw new Error(`Question list item ${index} has an invalid storage read URI.`);
    }
    return fetchJson(fetchImpl, readUrl.href);
  });
}

export async function verifyDemoShQuestionParity({ fetchImpl = globalThis.fetch } = {}) {
  const { questions: expectedQuestions, sessionConfig } = loadExpectedDemoShQuestions();
  const workerUrl = text(sessionConfig?.corsWorkerUrl).trim();
  if (!workerUrl) throw new Error('demo-sh config is missing its public Worker URL.');
  const actualQuestions = await fetchWorkerQuestions({ fetchImpl, workerUrl });
  const comparison = compareQuestionSets(expectedQuestions, actualQuestions);
  return { ...comparison, expectedCount: expectedQuestions.length, actualCount: actualQuestions.length, workerUrl };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  verifyDemoShQuestionParity()
    .then((result) => {
      if (!result.ok) {
        console.error(
          `demo-sh question parity failed (${result.expectedCount} expected, ${result.actualCount} live).`,
        );
        result.differences.slice(0, 50).forEach((difference) => console.error(JSON.stringify(difference)));
        if (result.differences.length > 50) {
          console.error(`${result.differences.length - 50} additional differences omitted.`);
        }
        process.exitCode = 1;
        return;
      }
      console.log(`demo-sh question parity verified: ${result.actualCount}/${result.expectedCount} live payloads match.`);
    })
    .catch((error) => {
      console.error(`demo-sh question parity failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    });
}
