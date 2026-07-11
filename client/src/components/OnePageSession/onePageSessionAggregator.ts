import { createLogger } from 'utilities/logging.js';
import { isResponseAllowedForSessionSlug } from '../../utilities/session/responseSessionScope.js';

const demoLog = createLogger('demo');
const AGGREGATOR_PARSE_MEMO_MAX = 3000;

type UnknownRecord = Record<string, unknown>;
type AggregatorRow = {
  responder: string;
  questionId: string;
  response: string;
};
type AggregatorMap = Record<string, AggregatorRow[]>;
type RowSignaturesByQuestion = Record<string, string[]>;
type QuestionResponses = Record<string, unknown>;
type AggregatorNetworkNode = {
  questions?: UnknownRecord;
  questionResponses?: Record<string, QuestionResponses>;
};
type AggregatorBuildOptions = {
  parseMemo?: Map<string, unknown> | null;
  sessionSlug?: unknown;
};
type AggregatorBuildResult = {
  map: AggregatorMap;
  dirty: boolean;
  signature?: string;
};

const isRecord = (value: unknown): value is UnknownRecord => !!value && typeof value === 'object';

const asRecord = (value: unknown): UnknownRecord => (isRecord(value) ? value : {});

const hashMix = (seed: unknown, text: unknown) => {
  let h = Number(seed) >>> 0;
  const str = String(text || '');
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
  }
  return h >>> 0;
};

export const computeAggregatorDataSignature = (map: unknown = {}) => {
  if (!isRecord(map)) return '0:0:0';
  const qids = Object.keys(map).sort();
  if (qids.length === 0) return '0:0:0';
  let hash = 2166136261;
  let totalEntries = 0;
  qids.forEach((qid) => {
    hash = hashMix(hash, qid);
    const rows = Array.isArray(map[qid]) ? map[qid] : [];
    const rowSignatures = rows
      .map((row) => {
        const rowRecord = asRecord(row);
        return `${rowRecord.responder || ''}|${rowRecord.response || ''}`;
      })
      .sort();
    totalEntries += rowSignatures.length;
    rowSignatures.forEach((rowSig) => {
      hash = hashMix(hash, rowSig);
    });
  });
  return `${qids.length}:${totalEntries}:${hash >>> 0}`;
};

const computeAggregatorDataSignatureFromRows = (
  qids: unknown[] = [],
  rowSignaturesByQuestion: RowSignaturesByQuestion = {},
) => {
  const normalizedQids = Array.isArray(qids) ? qids.filter(Boolean).sort() : [];
  if (normalizedQids.length === 0) return '0:0:0';
  let hash = 2166136261;
  let totalEntries = 0;
  normalizedQids.forEach((qid) => {
    hash = hashMix(hash, qid);
    const qidKey = String(qid);
    const rowSignatures = Array.isArray(rowSignaturesByQuestion[qidKey])
      ? [...rowSignaturesByQuestion[qidKey]].sort()
      : [];
    totalEntries += rowSignatures.length;
    rowSignatures.forEach((rowSig) => {
      hash = hashMix(hash, rowSig);
    });
  });
  return `${normalizedQids.length}:${totalEntries}:${hash >>> 0}`;
};

export const computeAggregatorSourceSnapshotSignature = (questionResponses: unknown = {}) => {
  if (!isRecord(questionResponses)) return '0:0:0';
  const qids = Object.keys(questionResponses);
  if (qids.length === 0) return '0:0:0';

  let hash = 2166136261;
  let totalEntries = 0;

  qids.forEach((qid) => {
    hash = hashMix(hash, qid);
    const responderMap = asRecord(questionResponses[qid]);
    if (!isRecord(responderMap)) return;
    const responders = Object.keys(responderMap);
    totalEntries += responders.length;
    responders.forEach((resAddr) => {
      hash = hashMix(hash, resAddr);
      const rawResponse = responderMap[resAddr];
      if (typeof rawResponse === 'string') {
        hash = hashMix(hash, rawResponse);
        return;
      }
      const responseRecord = asRecord(rawResponse);
      const answer = asRecord(responseRecord.answer);
      hash = hashMix(hash, responseRecord.type || '');
      hash = hashMix(hash, answer.value ?? '');
      hash = hashMix(hash, answer.encrypted ? '1' : '0');
      hash = hashMix(hash, answer.encryptedPortion || '');
      hash = hashMix(hash, responseRecord.importance ?? '');
      hash = hashMix(hash, responseRecord.conviction ?? '');
    });
  });

  return `${qids.length}:${totalEntries}:${hash >>> 0}`;
};

const normalizeAggregatorSessionSlug = (value: unknown = '') => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  return normalized === 'general' ? '' : normalized;
};

const isPendingQuestionMetadataPlaceholder = (question: unknown = null) =>
  isRecord(question) && question.__ceQuestionMetadataPending === true;

const hasOwn = (obj: unknown, key: PropertyKey) => isRecord(obj) && Object.prototype.hasOwnProperty.call(obj, key);

const getQuestionSessionSlugExplicitSignature = (question: unknown = {}) => {
  const questionRecord = asRecord(question);
  if (questionRecord.sessionSlugExplicit === true) return 'explicit';
  if (questionRecord.sessionSlugExplicit === false) return 'bucket';
  return 'implicit';
};

const hasVisibleQuestionMetadataForAggregator = (
  questions: UnknownRecord = {},
  qId: unknown = '',
  sessionSlug: unknown = '',
) => {
  const lowerQid = String(qId || '')
    .trim()
    .toLowerCase();
  if (!lowerQid) return false;
  const question = questions[lowerQid] || questions[String(qId)];
  if (!isRecord(question) || isPendingQuestionMetadataPlaceholder(question)) return false;
  const normalizedQuestionSlug = normalizeAggregatorSessionSlug(question.sessionSlug || '');
  if (hasOwn(question, 'sessionSlug') && normalizedQuestionSlug && question.sessionSlugExplicit !== false) {
    return normalizedQuestionSlug === normalizeAggregatorSessionSlug(sessionSlug || '');
  }
  return true;
};

const isDemoPolisFixtureResponse = (response: unknown = null) =>
  isRecord(response) && response.source === 'demo-polis-data';

export const computeAggregatorQuestionMetadataSignature = (questions: unknown = {}) => {
  if (!isRecord(questions)) return '0:0';
  const qids = Object.keys(questions).sort();
  if (qids.length === 0) return '0:0';
  let hash = 2166136261;
  qids.forEach((qid) => {
    const question = asRecord(questions[qid]);
    hash = hashMix(hash, qid);
    hash = hashMix(hash, isPendingQuestionMetadataPlaceholder(question) ? 'pending' : 'ready');
    hash = hashMix(hash, question.sessionSlug || '');
    hash = hashMix(hash, getQuestionSessionSlugExplicitSignature(question));
  });
  return `${qids.length}:${hash >>> 0}`;
};

export function buildAggregatorFromLocalCache(
  networkObj: AggregatorNetworkNode | null | undefined,
  opts: AggregatorBuildOptions = {},
): AggregatorBuildResult {
  if (!networkObj) return { map: {}, dirty: false };
  const parseMemo = opts?.parseMemo instanceof Map ? opts.parseMemo : null;
  const sessionSlug = opts?.sessionSlug || '';
  const questions = asRecord(networkObj.questions);
  const questionResponses = isRecord(networkObj.questionResponses) ? networkObj.questionResponses : {};
  const aggregatorMap: AggregatorMap = {};
  const rowSignaturesByQuestion: RowSignaturesByQuestion = {};
  let dirty = false;

  Object.keys(questionResponses).forEach((qId) => {
    if (!hasVisibleQuestionMetadataForAggregator(questions, qId, sessionSlug)) return;
    const responderMap = asRecord(questionResponses[qId]);
    aggregatorMap[qId] = [];
    rowSignaturesByQuestion[qId] = [];
    Object.keys(responderMap).forEach((resAddr) => {
      let parsed: unknown;
      let rawResponseString = '';
      try {
        const rawResponse = responderMap[resAddr];
        if (typeof rawResponse === 'string') {
          rawResponseString = rawResponse;
          if (parseMemo && parseMemo.has(rawResponse)) {
            parsed = parseMemo.get(rawResponse);
            parseMemo.delete(rawResponse);
            parseMemo.set(rawResponse, parsed);
          } else {
            parsed = JSON.parse(rawResponse);
            if (parseMemo) {
              parseMemo.set(rawResponse, parsed);
              while (parseMemo.size > AGGREGATOR_PARSE_MEMO_MAX) {
                const oldest = parseMemo.keys().next().value;
                if (!oldest) break;
                parseMemo.delete(oldest);
              }
            }
          }
        } else {
          parsed = rawResponse;
        }
      } catch {
        parsed = null;
      }
      if (!parsed) return;
      if (isDemoPolisFixtureResponse(parsed)) return;
      if (!isResponseAllowedForSessionSlug(parsed, sessionSlug)) return;

      const parsedRecord = asRecord(parsed);
      const answerValue = parsedRecord.answer;
      const ans = asRecord(answerValue);
      const isBinary = parsedRecord.type === 'binary';
      const isEnc = !!(ans.encrypted || ans.encryptedPortion);
      const isMasked = ans.value === '*';

      if (isBinary && answerValue && !isEnc && !isMasked) {
        const responseJson = rawResponseString || JSON.stringify(parsed);
        aggregatorMap[qId].push({
          responder: resAddr,
          questionId: qId,
          response: responseJson,
        });
        rowSignaturesByQuestion[qId].push(`${resAddr}|${responseJson}`);
      }
    });
  });

  return {
    map: aggregatorMap,
    dirty,
    signature: computeAggregatorDataSignatureFromRows(Object.keys(aggregatorMap), rowSignaturesByQuestion),
  };
}
