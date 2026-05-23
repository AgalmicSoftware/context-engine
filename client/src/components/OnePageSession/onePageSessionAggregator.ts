import { createLogger } from 'utilities/logging.js';

const demoLog = createLogger('demo');
const AGGREGATOR_PARSE_MEMO_MAX = 3000;

const hashMix = (seed: any, text: any) => {
  let h = Number(seed) >>> 0;
  const str = String(text || '');
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
  }
  return h >>> 0;
};

export const computeAggregatorDataSignature = (map: any = {}) => {
  if (!map || typeof map !== 'object') return '0:0:0';
  const qids = Object.keys(map).sort();
  if (qids.length === 0) return '0:0:0';
  let hash = 2166136261;
  let totalEntries = 0;
  qids.forEach((qid: any) => {
    hash = hashMix(hash, qid);
    const rows = Array.isArray(map[qid]) ? map[qid] : [];
    const rowSignatures = rows
      .map((row: any) => `${row?.responder || ''}|${row?.response || ''}`)
      .sort();
    totalEntries += rowSignatures.length;
    rowSignatures.forEach((rowSig: any) => {
      hash = hashMix(hash, rowSig);
    });
  });
  return `${qids.length}:${totalEntries}:${hash >>> 0}`;
};

const computeAggregatorDataSignatureFromRows = (qids: any = [], rowSignaturesByQuestion: any = {}) => {
  const normalizedQids = Array.isArray(qids) ? qids.filter(Boolean).sort() : [];
  if (normalizedQids.length === 0) return '0:0:0';
  let hash = 2166136261;
  let totalEntries = 0;
  normalizedQids.forEach((qid: any) => {
    hash = hashMix(hash, qid);
    const rowSignatures = Array.isArray(rowSignaturesByQuestion?.[qid])
      ? [...rowSignaturesByQuestion[qid]].sort()
      : [];
    totalEntries += rowSignatures.length;
    rowSignatures.forEach((rowSig: any) => {
      hash = hashMix(hash, rowSig);
    });
  });
  return `${normalizedQids.length}:${totalEntries}:${hash >>> 0}`;
};

export const computeAggregatorSourceSnapshotSignature = (questionResponses: any = {}) => {
  if (!questionResponses || typeof questionResponses !== 'object') return '0:0:0';
  const qids = Object.keys(questionResponses);
  if (qids.length === 0) return '0:0:0';

  let hash = 2166136261;
  let totalEntries = 0;

  qids.forEach((qid: any) => {
    hash = hashMix(hash, qid);
    const responderMap = questionResponses[qid];
    if (!responderMap || typeof responderMap !== 'object') return;
    const responders = Object.keys(responderMap);
    totalEntries += responders.length;
    responders.forEach((resAddr: any) => {
      hash = hashMix(hash, resAddr);
      const rawResponse = responderMap[resAddr];
      if (typeof rawResponse === 'string') {
        hash = hashMix(hash, rawResponse);
        return;
      }
      const answer = rawResponse?.answer;
      hash = hashMix(hash, rawResponse?.type || '');
      hash = hashMix(hash, answer?.value ?? '');
      hash = hashMix(hash, answer?.encrypted ? '1' : '0');
      hash = hashMix(hash, answer?.encryptedPortion || '');
      hash = hashMix(hash, rawResponse?.importance ?? '');
      hash = hashMix(hash, rawResponse?.conviction ?? '');
    });
  });

  return `${qids.length}:${totalEntries}:${hash >>> 0}`;
};

const normalizeAggregatorSessionSlug = (value: any = '') => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'general' ? '' : normalized;
};

const isPendingQuestionMetadataPlaceholder = (question: any = null) => (
  !!question && typeof question === 'object' && question.__ceQuestionMetadataPending === true
);

const hasVisibleQuestionMetadataForAggregator = (
  questions: any = {},
  qId: any = '',
  sessionSlug: any = ''
) => {
  if (!questions || typeof questions !== 'object') return false;
  const lowerQid = String(qId || '').trim().toLowerCase();
  if (!lowerQid) return false;
  const question = questions[lowerQid] || questions[qId];
  if (!question || typeof question !== 'object' || isPendingQuestionMetadataPlaceholder(question)) return false;
  if (question.sessionSlugExplicit === true) {
    return normalizeAggregatorSessionSlug(question.sessionSlug || '') === normalizeAggregatorSessionSlug(sessionSlug || '');
  }
  return true;
};

export const computeAggregatorQuestionMetadataSignature = (questions: any = {}) => {
  if (!questions || typeof questions !== 'object') return '0:0';
  const qids = Object.keys(questions).sort();
  if (qids.length === 0) return '0:0';
  let hash = 2166136261;
  qids.forEach((qid: any) => {
    const question = questions[qid] || {};
    hash = hashMix(hash, qid);
    hash = hashMix(hash, isPendingQuestionMetadataPlaceholder(question) ? 'pending' : 'ready');
    hash = hashMix(hash, question?.sessionSlug || '');
    hash = hashMix(hash, question?.sessionSlugExplicit === true ? 'explicit' : 'implicit');
  });
  return `${qids.length}:${hash >>> 0}`;
};

export function buildAggregatorFromLocalCache(networkObj: any, opts: any = {}) {
  if (!networkObj) return { map: {}, dirty: false };
  const parseMemo = opts?.parseMemo instanceof Map ? opts.parseMemo : null;
  const sessionSlug = opts?.sessionSlug || '';
  const questions = networkObj.questions || {};
  const questionResponses = networkObj.questionResponses || {};
  const aggregatorMap: Record<string, any> = {};
  const rowSignaturesByQuestion: Record<string, any> = {};
  let dirty = false;

  Object.keys(questionResponses).forEach((qId: any) => {
    if (!hasVisibleQuestionMetadataForAggregator(questions, qId, sessionSlug)) return;
    const responderMap = questionResponses[qId] || {};
    aggregatorMap[qId] = [];
    rowSignaturesByQuestion[qId] = [];
    Object.keys(responderMap).forEach((resAddr: any) => {
      let parsed;
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
        try { delete responderMap[resAddr]; dirty = true; } catch (e) { demoLog.warn('OnePageSession: fallback', e); }
        parsed = null;
      }
      if (!parsed) return;

      const isBinary = parsed?.type === 'binary';
      const ans = parsed?.answer;
      const isEnc = !!(ans?.encrypted || ans?.encryptedPortion);
      const isMasked = ans?.value === '*';

      if (isBinary && ans && !isEnc && !isMasked) {
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
    signature: computeAggregatorDataSignatureFromRows(
      Object.keys(aggregatorMap),
      rowSignaturesByQuestion,
    ),
  };
}
