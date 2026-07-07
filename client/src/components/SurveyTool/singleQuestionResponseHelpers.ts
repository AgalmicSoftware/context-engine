import { isFreeformBlankAnswer } from '../../utilities/survey/freeformAnswerUtils.js';
import { normalizeRatingValue } from '../../utilities/survey/ratingValue.js';

type GateLike = Record<string, unknown> & {
  gateId?: unknown;
  id?: unknown;
  mode?: unknown;
  operator?: unknown;
  gateMode?: unknown;
  requireAll?: boolean;
  sbtAddress?: unknown;
  sbtAddresses?: unknown;
};

type QuestionGateLike = Record<string, unknown> & {
  encryption?: Record<string, unknown> & {
    gate?: GateLike | null;
    gateId?: unknown;
    gates?: unknown;
    mode?: unknown;
    sbtAddresses?: unknown;
  };
  gate?: GateLike | null;
  gateConfig?: GateLike | null;
  gateId?: unknown;
  gateMode?: unknown;
  gates?: unknown;
  sbtAddresses?: unknown;
};

type PromptGateTooltipInput = {
  question?: QuestionGateLike | null;
  gateId?: unknown;
  gateConfig?: GateLike | null;
  gateMode?: unknown;
  sbtAddresses?: unknown;
  userHeldSBTs?: unknown;
};

export type AggregatorResponseRecord = {
  responder?: unknown;
  timestamp?: unknown;
  response?: unknown;
};

export type MultichoiceAggregatorSummary = {
  counts: Record<string, number>;
  options: string[];
  totalResponders: number;
};
export type FreeformAggregatorSummary = {
  blankCount: number;
  displayedResponses: unknown[];
  encryptedCount: number;
  nonBlankTotal: number;
  summaryParts: string[];
  total: number;
};
export type BinaryAggregatorSummary = {
  counts: Record<'Agree' | 'Unsure' | 'Disagree', number>;
  total: number;
};
export type RatingAggregatorSummary = {
  average: number;
  median: number;
  total: number;
  values: number[];
};

type SingleQuestionBookmarkStatusPatch = {
  isBookmarked: boolean;
};

type SingleQuestionBookmarkFeedbackPatch = SingleQuestionBookmarkStatusPatch & {
  bookmarkSuccess: boolean;
};

const normalizeText = (value: unknown): string => String(value || '').trim();

export const collectGateAddresses = (gates: unknown = [], directAddresses: unknown = []): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (value: unknown) => {
    const address = normalizeText(value);
    if (!address) return;
    const key = address.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(address);
  };

  (Array.isArray(directAddresses) ? directAddresses : []).forEach(push);
  (Array.isArray(gates) ? gates : []).forEach((gate) => {
    const gateRecord = gate && typeof gate === 'object' ? (gate as GateLike) : null;
    (Array.isArray(gateRecord?.sbtAddresses) ? gateRecord.sbtAddresses : []).forEach(push);
    push(gateRecord?.sbtAddress);
  });

  return out;
};

export const normalizePromptGateMode = (gate: GateLike | null = null, fallbackMode: unknown = ''): string => {
  const raw = normalizeText(fallbackMode || gate?.mode || gate?.operator || gate?.gateMode).toLowerCase();
  if (gate?.requireAll === true || raw === 'all' || raw === 'and') return 'all';
  return raw === 'any' || !raw ? 'any' : raw;
};

export const resolvePromptGateTooltipProps = ({
  question = null,
  gateId = '',
  gateConfig = null,
  gateMode = '',
  sbtAddresses = [],
  userHeldSBTs = [],
}: PromptGateTooltipInput = {}) => {
  const questionGateList = Array.isArray(question?.encryption?.gates)
    ? question.encryption.gates
    : Array.isArray(question?.gates)
      ? question.gates
      : [];
  const resolvedGateConfig =
    gateConfig ||
    question?.gateConfig ||
    question?.encryption?.gate ||
    question?.gate ||
    (questionGateList[0] && typeof questionGateList[0] === 'object' ? (questionGateList[0] as GateLike) : null) ||
    null;
  const resolvedAddresses = collectGateAddresses(questionGateList, [
    ...(Array.isArray(sbtAddresses) ? sbtAddresses : []),
    ...(Array.isArray(question?.sbtAddresses) ? question.sbtAddresses : []),
    ...(Array.isArray(question?.encryption?.sbtAddresses) ? question.encryption.sbtAddresses : []),
  ]);

  return {
    gateId:
      normalizeText(
        gateId ||
          question?.gateId ||
          question?.encryption?.gateId ||
          resolvedGateConfig?.gateId ||
          resolvedGateConfig?.id,
      ) || null,
    gateConfig: resolvedGateConfig,
    mode: normalizePromptGateMode(
      resolvedGateConfig as GateLike | null,
      gateMode || question?.gateMode || question?.encryption?.mode,
    ),
    sbtAddresses: resolvedAddresses,
    userHeldSBTs: Array.isArray(userHeldSBTs) ? userHeldSBTs : [],
  };
};

export const buildSingleQuestionBookmarkStatusPatch = (isBookmarked: unknown): SingleQuestionBookmarkStatusPatch => ({
  isBookmarked: !!isBookmarked,
});

export const buildSingleQuestionBookmarkFeedbackPatch = (
  isBookmarked: unknown,
): SingleQuestionBookmarkFeedbackPatch => ({
  isBookmarked: !!isBookmarked,
  bookmarkSuccess: true,
});

export const buildSingleQuestionBookmarkSuccessPatch = (bookmarkSuccess: unknown) => ({
  bookmarkSuccess: !!bookmarkSuccess,
});

export const buildAggregatorResponseSignature = (allResponses: unknown = []) => {
  const responses = Array.isArray(allResponses) ? allResponses : [];
  const total = responses.length;
  if (total <= 0) return '0';
  const first = responses[0] || {};
  const last = responses[total - 1] || {};
  return [
    total,
    String(first.responder || ''),
    String(first.timestamp || ''),
    String(last.responder || ''),
    String(last.timestamp || ''),
  ].join('|');
};

export const getLatestAnsweredResponses = (allResponses: unknown = []) => {
  if (!Array.isArray(allResponses) || allResponses.length === 0) {
    return [];
  }

  const responderMap = new Map<unknown, AggregatorResponseRecord>();
  allResponses.forEach((responseRecord) => {
    const record = responseRecord as AggregatorResponseRecord;
    const existing = responderMap.get(record.responder);
    const existingTs = existing ? parseInt(String(existing.timestamp), 10) : 0;
    const newTs = parseInt(String(record.timestamp), 10);
    if (!existing || existingTs < newTs) {
      responderMap.set(record.responder, record);
    }
  });

  return Array.from(responderMap.values())
    .map((record) => record.response)
    .filter(Boolean);
};

export const buildFreeformAggregatorSummary = (parsedResponses: unknown = []): FreeformAggregatorSummary => {
  const responses = Array.isArray(parsedResponses) ? parsedResponses : [];
  const total = responses.length;
  let encryptedCount = 0;
  let blankCount = 0;
  const displayedResponses: unknown[] = [];

  responses.forEach((response) => {
    const responseRecord = response as { answer?: { encrypted?: unknown; value?: unknown } } | null | undefined;
    if (!responseRecord || !responseRecord.answer) return;
    const value = responseRecord.answer.value;

    if (responseRecord.answer.encrypted && value === '*') {
      encryptedCount += 1;
    } else if (isFreeformBlankAnswer('freeform', responseRecord)) {
      blankCount += 1;
    } else {
      displayedResponses.push(value);
    }
  });

  const nonBlankTotal = Math.max(total - blankCount, 0);
  const summaryParts = [`${nonBlankTotal} total responses.`];
  if (encryptedCount > 0) {
    summaryParts.push(`${encryptedCount} encrypted responses not shown.`);
  } else {
    summaryParts.push('0 encrypted responses not shown.');
  }
  if (blankCount > 0) {
    summaryParts.push(`${blankCount} blank not shown.`);
  }

  return {
    blankCount,
    displayedResponses,
    encryptedCount,
    nonBlankTotal,
    summaryParts,
    total,
  };
};

export const buildBinaryAggregatorSummary = (parsedResponses: unknown = []): BinaryAggregatorSummary => {
  const responses = Array.isArray(parsedResponses) ? parsedResponses : [];
  const counts = { Agree: 0, Unsure: 0, Disagree: 0 };
  let total = 0;
  responses.forEach((response) => {
    const answerValue = (response as { answer?: { value?: unknown } } | null | undefined)?.answer?.value;
    if (answerValue === 'Agree' || answerValue === 'Unsure' || answerValue === 'Disagree') {
      const key = answerValue as 'Agree' | 'Unsure' | 'Disagree';
      counts[key] += 1;
      total += 1;
    }
  });
  return { counts, total };
};

export const buildRatingAggregatorSummary = (parsedResponses: unknown = []): RatingAggregatorSummary => {
  const responses = Array.isArray(parsedResponses) ? parsedResponses : [];
  const values: number[] = [];
  responses.forEach((response) => {
    const ratingValue = normalizeRatingValue(
      (response as { answer?: { value?: unknown } } | null | undefined)?.answer?.value,
      null,
    );
    if (ratingValue !== null) values.push(ratingValue);
  });
  if (values.length === 0) {
    return {
      average: 0,
      median: 0,
      total: 0,
      values,
    };
  }
  const sum = values.reduce((acc, value) => acc + value, 0);
  const average = sum / values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return {
    average,
    median,
    total: values.length,
    values,
  };
};

export const extractSingleQuestionOptionsFromCandidate = (candidate: unknown = null): string[] => {
  const candidateRecord =
    candidate && typeof candidate === 'object'
      ? (candidate as Record<string, unknown> & {
          config?: Record<string, unknown>;
          data?: Record<string, unknown>;
          payload?: Record<string, unknown>;
        })
      : null;
  if (!candidateRecord) return [];

  const raw =
    candidateRecord.options ??
    candidateRecord.choices ??
    candidateRecord.answers ??
    candidateRecord.choiceOptions ??
    candidateRecord.config?.options ??
    candidateRecord.config?.choices ??
    candidateRecord.payload?.options ??
    candidateRecord.data?.options ??
    candidateRecord.optionsMap ??
    candidateRecord.options_by_id;

  const toLabel = (value: unknown): unknown => {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return '';
    const record = value as {
      id?: unknown;
      label?: unknown;
      name?: unknown;
      text?: unknown;
      value?: unknown;
    };
    return record.label ?? record.text ?? record.name ?? record.value ?? record.id ?? '';
  };

  let options: unknown[] = [];
  if (Array.isArray(raw)) {
    options = raw.map(toLabel);
  } else if (raw && typeof raw === 'object') {
    options = Object.values(raw).map(toLabel);
  }

  const seen = new Set<string>();
  return options
    .map(String)
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => (seen.has(value) ? false : (seen.add(value), true)));
};

export const findSingleQuestionEntryAcrossGroups = ({
  entries = [],
  idLower = '',
  netIdStr = '',
}: {
  entries?: unknown;
  idLower?: unknown;
  netIdStr?: unknown;
} = {}): unknown | null => {
  const normalizedId = String(idLower || '')
    .trim()
    .toLowerCase();
  if (!normalizedId || !Array.isArray(entries)) return null;
  const networkKey = String(netIdStr || '');

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i] as { value?: unknown } | null | undefined;
    const parsed = entry && typeof entry.value === 'object' ? (entry.value as Record<string, unknown>) : null;
    if (!parsed) continue;

    let netObj: unknown = null;
    if (networkKey) {
      netObj = parsed[networkKey] || null;
    }
    if (!netObj) {
      const firstKey = Object.keys(parsed)[0];
      netObj = firstKey ? parsed[firstKey] : null;
    }
    const netRecord = netObj && typeof netObj === 'object' ? (netObj as { questions?: Record<string, unknown> }) : null;
    const questions = netRecord?.questions || {};
    const direct = questions[normalizedId] || questions[String(normalizedId)];
    if (direct) return direct;

    const hitKey = Object.keys(questions).find(
      (questionKey) => String(questionKey || '').toLowerCase() === normalizedId,
    );
    if (hitKey) return questions[hitKey];
  }

  return null;
};

export const resolveSingleQuestionMapFromCacheValue = (
  cacheValue: unknown = null,
  netIdStr: unknown = '',
): Record<string, unknown> => {
  const parsed =
    cacheValue && typeof cacheValue === 'object'
      ? (cacheValue as Record<string, { questions?: Record<string, unknown> } | undefined>)
      : null;
  if (!parsed) return {};

  const networkKey = String(netIdStr || '');
  const exactBag = networkKey ? parsed[networkKey]?.questions : null;
  if (exactBag) return exactBag;

  const firstKey = Object.keys(parsed).find((key) => parsed[key]?.questions);
  return firstKey ? parsed[firstKey]?.questions || {} : {};
};

const getMultichoiceChoiceLabel = (choice: unknown): unknown => {
  if (typeof choice === 'string') return choice;
  if (!choice || typeof choice !== 'object') return '';
  const record = choice as {
    label?: unknown;
    text?: unknown;
    name?: unknown;
    value?: unknown;
  };
  return record.label ?? record.text ?? record.name ?? record.value ?? '';
};

export const buildMultichoiceAggregatorSummary = (
  parsedResponses: unknown = [],
  knownOptions: unknown = [],
): MultichoiceAggregatorSummary => {
  const responses = Array.isArray(parsedResponses) ? parsedResponses : [];
  let allOptions = (Array.isArray(knownOptions) ? knownOptions : [])
    .map((option) => normalizeText(option))
    .filter(Boolean);

  if (!allOptions.length) {
    const derived = new Set<string>();
    responses.forEach((response) => {
      const answer = (response as { answer?: { encrypted?: unknown; value?: unknown } } | null | undefined)?.answer;
      if (!answer || answer.encrypted) return;
      const rawValue = answer.value;
      const choices = Array.isArray(rawValue) ? rawValue : rawValue != null ? [rawValue] : [];
      choices
        .map(getMultichoiceChoiceLabel)
        .map(normalizeText)
        .filter(Boolean)
        .forEach((label) => derived.add(label));
    });
    allOptions = Array.from(derived);
  }

  const displayByKey: Record<string, string> = {};
  allOptions.forEach((option) => {
    const label = normalizeText(option);
    if (!label) return;
    const key = label.toLowerCase();
    if (!(key in displayByKey)) displayByKey[key] = label;
  });

  const counts: Record<string, number> = {};
  Object.values(displayByKey).forEach((label) => {
    counts[label] = 0;
  });

  let totalResponders = 0;
  responses.forEach((response) => {
    const answer = (response as { answer?: { encrypted?: unknown; value?: unknown } } | null | undefined)?.answer;
    if (!answer || answer.encrypted) return;
    const rawValue = answer.value;
    const picks = new Set<string>();
    const addPick = (raw: unknown) => {
      const label = normalizeText(getMultichoiceChoiceLabel(raw));
      if (!label) return;
      const displayLabel = displayByKey[label.toLowerCase()];
      if (displayLabel) picks.add(displayLabel);
    };

    if (Array.isArray(rawValue)) {
      rawValue.forEach(addPick);
    } else if (rawValue != null) {
      addPick(rawValue);
    }

    if (picks.size > 0) {
      totalResponders += 1;
      picks.forEach((label) => {
        counts[label] += 1;
      });
    }
  });

  return {
    counts,
    options: Object.values(displayByKey),
    totalResponders,
  };
};

export const isEnvelopeAesGcm256 = (encryptedPortion: unknown): boolean => {
  try {
    const env = typeof encryptedPortion === 'string' ? JSON.parse(encryptedPortion) : encryptedPortion || {};
    return (
      Number((env as Record<string, unknown>)?.v) === 2 &&
      String((env as Record<string, unknown>)?.cipher).toLowerCase() === 'aes-gcm-256'
    );
  } catch {
    return false;
  }
};

const parseEncryptedEnvelope = (encryptedPortion: unknown): Record<string, unknown> | null => {
  try {
    const env = typeof encryptedPortion === 'string' ? JSON.parse(encryptedPortion) : encryptedPortion;
    return env && typeof env === 'object' ? (env as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

export const hasLitSbtRecipientEncryptedPortion = (encryptedPortion: unknown): boolean => {
  const env = parseEncryptedEnvelope(encryptedPortion);
  const recipients = Array.isArray(env?.recipients) ? env.recipients : [];
  return recipients.some((recipient) => {
    if (!recipient || typeof recipient !== 'object') return false;
    const record = recipient as Record<string, unknown>;
    return String(record.type || '') === 'lit-sbt-v1' && !!record.lit && typeof record.lit === 'object';
  });
};

export const responseHasLitSbtRecipient = (response: unknown): boolean => {
  const record = response && typeof response === 'object' ? (response as Record<string, unknown>) : null;
  if (!record) return false;
  const fields = [record.answer, record.additional];
  return fields.some((field) => {
    const fieldRecord = field && typeof field === 'object' ? (field as Record<string, unknown>) : null;
    return hasLitSbtRecipientEncryptedPortion(fieldRecord?.encryptedPortion);
  });
};
