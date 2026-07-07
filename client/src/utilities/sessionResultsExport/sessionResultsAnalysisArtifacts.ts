export const SESSION_RESULTS_ANALYSIS_ARTIFACT_KIND = 'ce_session_results_analysis_artifact';
export const SESSION_RESULTS_ANALYSIS_ARTIFACT_VERSION = 1;

export const SESSION_RESULTS_ANALYSIS_MINIMUMS = Object.freeze({
  participants: 2,
  questions: 1,
  responses: 3,
});

export const SESSION_RESULTS_ANALYSIS_SECTION_KEYS = Object.freeze([
  'breakdown',
  'argumentMap',
  'riskMatrix',
  'atlas',
] as const);

export const SESSION_RESULTS_ANALYSIS_INPUT_LIMITS = Object.freeze({
  maxOptionsPerQuestion: 12,
  maxQuestionPromptChars: 900,
  maxQuestions: 80,
  maxResponseAdditionalChars: 900,
  maxResponseAnswerChars: 1400,
  maxResponses: 420,
  maxSegmentDimensions: 12,
  maxSegmentValuesPerDimension: 60,
  maxTagsPerQuestion: 16,
});

const ETH_ADDRESS_TEXT_PATTERN = /\b0x[a-fA-F0-9]{40}\b/g;
const REDACTED_ADDRESS_PLACEHOLDER = '[redacted-address]';
const SENSITIVE_ANALYSIS_OUTPUT_KEY_PATTERNS = [
  /^address$/i,
  /^wallet$/i,
  /^walletAddress$/i,
  /^participantAddress$/i,
  /^participantAddresses$/i,
  /^responder$/i,
  /^responderAddress$/i,
];

export type SessionResultsAnalysisQuestionInput = {
  id: string;
  options?: string[];
  prompt: string;
  tags?: string[];
  type?: string;
};

export type SessionResultsAnalysisSectionKey = (typeof SESSION_RESULTS_ANALYSIS_SECTION_KEYS)[number];

export type SessionResultsAnalysisResponseInput = {
  additional?: unknown;
  answer?: unknown;
  participantAddress?: unknown;
  questionId: unknown;
  questionPrompt?: unknown;
  questionType?: unknown;
};

export type SessionResultsAnalysisParticipant = {
  address?: string;
  displayAddress?: string;
  syntheticId: string;
};

export type SessionResultsAnalysisAiResponse = {
  additional?: string;
  answer: string;
  participantId: string;
  questionId: string;
  questionPrompt?: string;
  questionType?: string;
};

export type SessionResultsAnalysisAiPayload = {
  counts: {
    participants: number;
    questions: number;
    responses: number;
  };
  inputLimits: typeof SESSION_RESULTS_ANALYSIS_INPUT_LIMITS;
  questions: SessionResultsAnalysisQuestionInput[];
  responses: SessionResultsAnalysisAiResponse[];
  segmentDimensions: SessionResultsAnalysisSegmentDimension[];
  session: {
    name: string;
    slug: string;
  };
};

export type SessionResultsAnalysisSegmentValue = {
  count?: number;
  id: string;
  label: string;
  source?: string;
};

export type SessionResultsAnalysisSegmentDimension = {
  id: string;
  label: string;
  source?: string;
  values: SessionResultsAnalysisSegmentValue[];
};

export type SessionResultsAnalysisPayloadBuildResult = {
  aiPayload: SessionResultsAnalysisAiPayload;
  participants: SessionResultsAnalysisParticipant[];
};

export type SessionResultsGeneratedAnalysisArtifact = {
  generatedAt: string;
  inputSignature: string;
  kind: typeof SESSION_RESULTS_ANALYSIS_ARTIFACT_KIND;
  model?: string;
  participants: SessionResultsAnalysisParticipant[];
  sections: {
    argumentMap: {
      available: boolean;
      debates: unknown[];
      reason?: string;
    };
    atlas: {
      available: boolean;
      edges: unknown[];
      nodes: unknown[];
      reason?: string;
    };
    breakdown: {
      available: boolean;
      dimensions: unknown[];
      groups: unknown[];
      reason?: string;
      summary: Record<string, unknown>;
    };
    riskMatrix: {
      available: boolean;
      categories: unknown[];
      comments: unknown[];
      heatmap: Record<string, unknown>;
      reason?: string;
      scenarioLinks: unknown[];
    };
  };
  source: 'ai-generated';
  version: typeof SESSION_RESULTS_ANALYSIS_ARTIFACT_VERSION;
};

export type SessionResultsAnalysisEligibility = {
  counts: {
    participants: number;
    questions: number;
    responses: number;
  };
  eligible: boolean;
  reasons: string[];
};

const toSafeString = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

const normalizeText = (value: unknown): string => toSafeString(value).replace(/\s+/g, ' ').trim();

const normalizeAiText = (value: unknown): string =>
  normalizeText(value).replace(ETH_ADDRESS_TEXT_PATTERN, REDACTED_ADDRESS_PLACEHOLDER);

const truncateAiText = (value: unknown, maxLength: number): string => {
  const text = normalizeAiText(value);
  const limit = Math.max(0, Number(maxLength) || 0);
  if (!limit || text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 15)).trimEnd()} [truncated]`;
};

const toPlainRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const toArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const buildSyntheticId = (index: number): string => `participant_${String(index + 1).padStart(3, '0')}`;

const slugifyAnalysisId = (value: unknown, fallback = 'item'): string => {
  const slug = normalizeAiText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 72);
  return slug || fallback;
};

const isSafeAnalysisLabel = (value: unknown): boolean => {
  const label = normalizeAiText(value);
  return !!label && !label.includes(REDACTED_ADDRESS_PLACEHOLDER);
};

const normalizeSegmentValue = (value: unknown, dimensionId: string): SessionResultsAnalysisSegmentValue | null => {
  const record = toPlainRecord(value);
  const label = normalizeAiText(record.label ?? record.value ?? '');
  if (!isSafeAnalysisLabel(label)) return null;
  const count = Number(record.count);
  const rawId = record.id ?? record.valueId;
  return {
    id: slugifyAnalysisId(isSafeAnalysisLabel(rawId) ? rawId : `${dimensionId}_${label}`, 'value'),
    label,
    ...(Number.isFinite(count) && count > 0 ? { count: Math.floor(count) } : {}),
    ...(isSafeAnalysisLabel(record.source) ? { source: normalizeAiText(record.source) } : {}),
  };
};

const normalizeSegmentDimension = (value: unknown): SessionResultsAnalysisSegmentDimension | null => {
  const record = toPlainRecord(value);
  const label = normalizeAiText(record.label ?? record.dimensionLabel ?? record.dimension ?? '');
  if (!isSafeAnalysisLabel(label)) return null;

  const rawId = record.id ?? record.dimensionId;
  const id = slugifyAnalysisId(isSafeAnalysisLabel(rawId) ? rawId : label, 'dimension');
  const values = toArray(record.values)
    .map((entry) => normalizeSegmentValue(entry, id))
    .filter(Boolean) as SessionResultsAnalysisSegmentValue[];
  if (values.length === 0) return null;

  return {
    id,
    label,
    values: values.slice(0, SESSION_RESULTS_ANALYSIS_INPUT_LIMITS.maxSegmentValuesPerDimension),
    ...(isSafeAnalysisLabel(record.source) ? { source: normalizeAiText(record.source) } : {}),
  };
};

const normalizeAnalysisSegmentDimensions = (value: unknown): SessionResultsAnalysisSegmentDimension[] =>
  (toArray(value).map(normalizeSegmentDimension).filter(Boolean) as SessionResultsAnalysisSegmentDimension[]).slice(
    0,
    SESSION_RESULTS_ANALYSIS_INPUT_LIMITS.maxSegmentDimensions,
  );

const shouldDropAnalysisOutputKey = (key: string): boolean =>
  SENSITIVE_ANALYSIS_OUTPUT_KEY_PATTERNS.some((pattern) => pattern.test(key));

const sanitizeGeneratedAnalysisValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sanitizeGeneratedAnalysisValue);
  if (typeof value === 'string') return normalizeAiText(value);
  if (!value || typeof value !== 'object') return value;

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((acc, [key, entryValue]) => {
    if (shouldDropAnalysisOutputKey(key)) return acc;
    acc[key] = sanitizeGeneratedAnalysisValue(entryValue);
    return acc;
  }, {});
};

export const shortenSessionResultsAddress = (value: unknown): string => {
  const address = toSafeString(value).trim();
  if (!address) return '';
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const getResponseText = (value: unknown): string => {
  const direct = normalizeAiText(value);
  if (direct && direct !== '[object Object]') return direct;
  const record = toPlainRecord(value);
  return normalizeAiText(record.value ?? record.text ?? record.answer ?? '');
};

const normalizeSignatureValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalizeSignatureValue);
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  return Object.keys(record)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = normalizeSignatureValue(record[key]);
      return acc;
    }, {});
};

const stableSerializeForSignature = (value: unknown): string => {
  try {
    return JSON.stringify(normalizeSignatureValue(value)) || '';
  } catch (_) {
    return String(value || '');
  }
};

export const buildSessionResultsAnalysisInputSignature = (payload: SessionResultsAnalysisAiPayload): string => {
  const input = stableSerializeForSignature(payload);
  let hashA = 0x811c9dc5;
  let hashB = 0x45d9f3b;
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    hashA = Math.imul(hashA ^ code, 16777619) >>> 0;
    hashB = Math.imul(hashB ^ code, 1597334677) >>> 0;
  }
  return ['session-results-analysis-v1', hashA.toString(16).padStart(8, '0'), hashB.toString(16).padStart(8, '0')].join(
    '-',
  );
};

export const buildSessionResultsAnalysisAiPayload = ({
  questions = [],
  responses = [],
  segmentDimensions = [],
  session = {},
}: {
  questions?: SessionResultsAnalysisQuestionInput[];
  responses?: SessionResultsAnalysisResponseInput[];
  segmentDimensions?: unknown[];
  session?: Partial<SessionResultsAnalysisAiPayload['session']>;
} = {}): SessionResultsAnalysisPayloadBuildResult => {
  const participantIds = new Map<string, SessionResultsAnalysisParticipant>();
  const getParticipant = (participantAddress: unknown): SessionResultsAnalysisParticipant => {
    const address = toSafeString(participantAddress).trim();
    const key = address ? address.toLowerCase() : `anonymous:${participantIds.size}`;
    const existing = participantIds.get(key);
    if (existing) return existing;
    const participant = {
      ...(address ? { address, displayAddress: shortenSessionResultsAddress(address) } : {}),
      syntheticId: buildSyntheticId(participantIds.size),
    };
    participantIds.set(key, participant);
    return participant;
  };

  const normalizedQuestions = questions
    .slice(0, SESSION_RESULTS_ANALYSIS_INPUT_LIMITS.maxQuestions)
    .map((question) => ({
      id: normalizeAiText(question?.id),
      options: Array.isArray(question?.options)
        ? question.options
            .slice(0, SESSION_RESULTS_ANALYSIS_INPUT_LIMITS.maxOptionsPerQuestion)
            .map((option) => truncateAiText(option, 140))
            .filter(Boolean)
        : [],
      prompt: truncateAiText(question?.prompt, SESSION_RESULTS_ANALYSIS_INPUT_LIMITS.maxQuestionPromptChars),
      tags: Array.isArray(question?.tags)
        ? question.tags
            .slice(0, SESSION_RESULTS_ANALYSIS_INPUT_LIMITS.maxTagsPerQuestion)
            .map((tag) => truncateAiText(tag, 120))
            .filter(Boolean)
        : [],
      type: normalizeAiText(question?.type),
    }))
    .filter((question) => question.id || question.prompt);

  const normalizedResponses = responses
    .slice(0, SESSION_RESULTS_ANALYSIS_INPUT_LIMITS.maxResponses)
    .map((response) => {
      const answer = truncateAiText(
        getResponseText(response?.answer),
        SESSION_RESULTS_ANALYSIS_INPUT_LIMITS.maxResponseAnswerChars,
      );
      const additional = truncateAiText(
        getResponseText(response?.additional),
        SESSION_RESULTS_ANALYSIS_INPUT_LIMITS.maxResponseAdditionalChars,
      );
      if (!answer && !additional) return null;
      const participant = getParticipant(response?.participantAddress);
      return {
        ...(additional ? { additional } : {}),
        answer,
        participantId: participant.syntheticId,
        questionId: normalizeAiText(response?.questionId),
        questionPrompt: normalizeAiText(response?.questionPrompt),
        questionType: normalizeAiText(response?.questionType),
      };
    })
    .filter(Boolean) as SessionResultsAnalysisAiResponse[];
  const normalizedSegmentDimensions = normalizeAnalysisSegmentDimensions(segmentDimensions);

  return {
    aiPayload: {
      counts: {
        participants: participantIds.size,
        questions: normalizedQuestions.length,
        responses: normalizedResponses.length,
      },
      inputLimits: SESSION_RESULTS_ANALYSIS_INPUT_LIMITS,
      questions: normalizedQuestions,
      responses: normalizedResponses,
      segmentDimensions: normalizedSegmentDimensions,
      session: {
        name: normalizeAiText(session?.name),
        slug: normalizeAiText(session?.slug),
      },
    },
    participants: Array.from(participantIds.values()),
  };
};

export const evaluateSessionResultsAnalysisEligibility = (
  payload: SessionResultsAnalysisAiPayload,
): SessionResultsAnalysisEligibility => {
  const counts = payload?.counts || { participants: 0, questions: 0, responses: 0 };
  const reasons: string[] = [];
  if (counts.responses < SESSION_RESULTS_ANALYSIS_MINIMUMS.responses) {
    reasons.push(
      `Needs at least ${SESSION_RESULTS_ANALYSIS_MINIMUMS.responses} viewable responses; ${counts.responses} available.`,
    );
  }
  if (counts.participants < SESSION_RESULTS_ANALYSIS_MINIMUMS.participants) {
    reasons.push(
      `Needs at least ${SESSION_RESULTS_ANALYSIS_MINIMUMS.participants} participants; ${counts.participants} available.`,
    );
  }
  if (counts.questions < SESSION_RESULTS_ANALYSIS_MINIMUMS.questions) {
    reasons.push(
      `Needs at least ${SESSION_RESULTS_ANALYSIS_MINIMUMS.questions} hydrated question; ${counts.questions} available.`,
    );
  }
  return {
    counts: {
      participants: Number(counts.participants || 0),
      questions: Number(counts.questions || 0),
      responses: Number(counts.responses || 0),
    },
    eligible: reasons.length === 0,
    reasons,
  };
};

const SESSION_RESULTS_SECTION_PROMPTS: Record<
  SessionResultsAnalysisSectionKey,
  {
    description: string;
    jsonShape: string;
    outputKey: SessionResultsAnalysisSectionKey;
  }
> = {
  breakdown: {
    description: 'Breakdown: infer dataset-specific comparison/filter dimensions and concise thematic groups.',
    outputKey: 'breakdown',
    jsonShape: `{
  "breakdown": {
    "summary": { "overview": "short neutral synthesis" },
    "dimensions": [{ "id": "sbt_groups", "label": "SBT / Groups", "source": "sbt", "values": [{ "id": "builders", "label": "Builders", "count": 3 }] }],
    "groups": [{ "id": "group_1", "label": "theme", "summary": "paraphrased summary", "participantIds": ["participant_001"], "questionIds": ["q1"] }]
  }
}`,
  },
  argumentMap: {
    description: 'Argument Map: identify debates, claims, stances, and supporting/opposing relationships.',
    outputKey: 'argumentMap',
    jsonShape: `{
  "argumentMap": {
    "debates": [{ "id": "debate_1", "title": "debate title", "claims": [{ "id": "claim_1", "label": "paraphrased claim", "stance": "support|oppose|mixed", "participantIds": ["participant_001"], "questionIds": ["q1"] }] }]
  }
}`,
  },
  riskMatrix: {
    description:
      'Risk Matrix: infer a custom per-session risk taxonomy, likelihood/impact values, and paraphrased evidence.',
    outputKey: 'riskMatrix',
    jsonShape: `{
  "riskMatrix": {
    "categories": [{ "id": "risk_1", "label": "custom category", "description": "why it matters" }],
    "heatmap": { "risk_1": { "likelihood": "low|medium|high", "impact": "low|medium|high" } },
    "comments": [{ "id": "risk_comment_1", "categoryId": "risk_1", "summary": "paraphrased evidence", "participantIds": ["participant_001"], "questionIds": ["q1"] }],
    "scenarioLinks": []
  }
}`,
  },
  atlas: {
    description: 'Atlas Nodes: create explorable conceptual nodes and labeled edges from the session discussion.',
    outputKey: 'atlas',
    jsonShape: `{
  "atlas": {
    "nodes": [{ "id": "atlas_1", "label": "node label", "summary": "paraphrased node summary", "participantIds": ["participant_001"], "questionIds": ["q1"] }],
    "edges": [{ "source": "atlas_1", "target": "atlas_2", "label": "relationship" }]
  }
}`,
  },
};

const isSessionResultsAnalysisSectionKey = (value: unknown): value is SessionResultsAnalysisSectionKey =>
  (SESSION_RESULTS_ANALYSIS_SECTION_KEYS as readonly string[]).includes(String(value || ''));

const buildAllSectionsJsonShape = (): string => `{
  "breakdown": {
    "summary": { "overview": "short neutral synthesis" },
    "dimensions": [{ "id": "sbt_groups", "label": "SBT / Groups", "source": "sbt", "values": [{ "id": "builders", "label": "Builders", "count": 3 }] }],
    "groups": [{ "id": "group_1", "label": "theme", "summary": "paraphrased summary", "participantIds": ["participant_001"], "questionIds": ["q1"] }]
  },
  "argumentMap": {
    "debates": [{ "id": "debate_1", "title": "debate title", "claims": [{ "id": "claim_1", "label": "paraphrased claim", "stance": "support|oppose|mixed", "participantIds": ["participant_001"], "questionIds": ["q1"] }] }]
  },
  "riskMatrix": {
    "categories": [{ "id": "risk_1", "label": "custom category", "description": "why it matters" }],
    "heatmap": { "risk_1": { "likelihood": "low|medium|high", "impact": "low|medium|high" } },
    "comments": [{ "id": "risk_comment_1", "categoryId": "risk_1", "summary": "paraphrased evidence", "participantIds": ["participant_001"], "questionIds": ["q1"] }],
    "scenarioLinks": []
  },
  "atlas": {
    "nodes": [{ "id": "atlas_1", "label": "node label", "summary": "paraphrased node summary", "participantIds": ["participant_001"], "questionIds": ["q1"] }],
    "edges": [{ "source": "atlas_1", "target": "atlas_2", "label": "relationship" }]
  }
}`;

export const buildSessionResultsAnalysisPrompt = (
  payload: SessionResultsAnalysisAiPayload,
  section: SessionResultsAnalysisSectionKey | 'all' = 'all',
): string => {
  const sectionConfig = isSessionResultsAnalysisSectionKey(section) ? SESSION_RESULTS_SECTION_PROMPTS[section] : null;
  const sectionLine = sectionConfig
    ? `Generate only this result view: ${sectionConfig.description}`
    : 'Generate all Context Engine session analysis result views.';
  const outputInstruction = sectionConfig
    ? `Return exactly one top-level "${sectionConfig.outputKey}" object. Do not include other result-view keys.`
    : 'Return all top-level result-view objects shown below.';
  const jsonShape = sectionConfig ? sectionConfig.jsonShape : buildAllSectionsJsonShape();

  return `You are generating Context Engine session analysis artifacts.

Return only valid JSON. Do not include markdown fences.

${sectionLine}
${outputInstruction}

Privacy rules:
- The input uses synthetic participant IDs only. Never invent or request wallet addresses.
- If segmentDimensions is non-empty, use those dataset-specific dimensions for Breakdown comparison/filter controls. They may represent SBTs, gates, groups, tags, or other non-address cohort labels.
- Do not use demo-only dimensions such as Era, Region, Country, Gender, Affiliation, or Atlas Category unless those exact dimensions are present in segmentDimensions.
- Never put wallet addresses or contract addresses in generated segment labels, ids, summaries, or participant references.
- You may reason from raw answer text, but your summaries must paraphrase instead of quoting identifiable freeform responses.
- Keep participant references as synthetic IDs such as participant_001.
- The input is capped by inputLimits to protect context windows. Work only from included data and mention uncertainty in summaries when the visible sample is thin.

Generate this JSON shape:
${jsonShape}

Session input:
${JSON.stringify(payload, null, 2)}`;
};

const parseJsonObject = (raw: unknown): Record<string, unknown> => {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  const text = toSafeString(raw).trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (_) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch (_inner) {
        return {};
      }
    }
  }
  return {};
};

const sectionArray = (record: Record<string, unknown>, key: string): unknown[] =>
  toArray(record[key]).map(sanitizeGeneratedAnalysisValue);

const normalizeSectionRecord = (value: unknown): Record<string, unknown> => toPlainRecord(value);

export const normalizeGeneratedSessionResultsAnalysisArtifact = ({
  generatedAt = new Date().toISOString(),
  inputSignature = '',
  model = '',
  participants = [],
  rawOutput = {},
}: {
  generatedAt?: unknown;
  inputSignature?: unknown;
  model?: unknown;
  participants?: SessionResultsAnalysisParticipant[];
  rawOutput?: unknown;
} = {}): SessionResultsGeneratedAnalysisArtifact => {
  const parsed = parseJsonObject(rawOutput);
  const sourceSections = normalizeSectionRecord(parsed.sections || parsed);
  const breakdown = normalizeSectionRecord(sourceSections.breakdown);
  const argumentMap = normalizeSectionRecord(sourceSections.argumentMap);
  const riskMatrix = normalizeSectionRecord(sourceSections.riskMatrix);
  const atlas = normalizeSectionRecord(sourceSections.atlas);
  const generatedAtDate = new Date(toSafeString(generatedAt));
  const normalizedGeneratedAt = Number.isNaN(generatedAtDate.getTime())
    ? new Date().toISOString()
    : generatedAtDate.toISOString();

  const groups = sectionArray(breakdown, 'groups');
  const dimensions = sectionArray(breakdown, 'dimensions');
  const debates = sectionArray(argumentMap, 'debates');
  const categories = sectionArray(riskMatrix, 'categories');
  const comments = sectionArray(riskMatrix, 'comments');
  const scenarioLinks = sectionArray(riskMatrix, 'scenarioLinks');
  const nodes = sectionArray(atlas, 'nodes');
  const edges = sectionArray(atlas, 'edges');
  const breakdownSummary = toPlainRecord(sanitizeGeneratedAnalysisValue(breakdown.summary));
  const riskMatrixHeatmap = toPlainRecord(sanitizeGeneratedAnalysisValue(riskMatrix.heatmap));

  return {
    generatedAt: normalizedGeneratedAt,
    inputSignature: normalizeText(inputSignature),
    kind: SESSION_RESULTS_ANALYSIS_ARTIFACT_KIND,
    ...(normalizeText(model) ? { model: normalizeText(model) } : {}),
    participants,
    sections: {
      argumentMap: {
        available: debates.length > 0,
        debates,
        ...(debates.length ? {} : { reason: 'AI generation did not return argument-map debates.' }),
      },
      atlas: {
        available: nodes.length > 0 || edges.length > 0,
        edges,
        nodes,
        ...(nodes.length || edges.length ? {} : { reason: 'AI generation did not return atlas nodes.' }),
      },
      breakdown: {
        available: dimensions.length > 0 || groups.length > 0 || Object.keys(breakdownSummary).length > 0,
        dimensions,
        groups,
        summary: breakdownSummary,
        ...(dimensions.length || groups.length || Object.keys(breakdownSummary).length
          ? {}
          : {
              reason: 'AI generation did not return breakdown groups.',
            }),
      },
      riskMatrix: {
        available: categories.length > 0 || comments.length > 0,
        categories,
        comments,
        heatmap: riskMatrixHeatmap,
        scenarioLinks,
        ...(categories.length || comments.length ? {} : { reason: 'AI generation did not return risk matrix data.' }),
      },
    },
    source: 'ai-generated',
    version: SESSION_RESULTS_ANALYSIS_ARTIFACT_VERSION,
  };
};

export const mergeGeneratedSessionResultsAnalysisArtifacts = ({
  base = null,
  next = null,
  sections = SESSION_RESULTS_ANALYSIS_SECTION_KEYS,
}: {
  base?: SessionResultsGeneratedAnalysisArtifact | null;
  next?: SessionResultsGeneratedAnalysisArtifact | null;
  sections?: readonly SessionResultsAnalysisSectionKey[];
} = {}): SessionResultsGeneratedAnalysisArtifact | null => {
  if (!base) return next || null;
  if (!next) return base;

  const nextSectionSet = new Set<SessionResultsAnalysisSectionKey>(
    (Array.isArray(sections) ? sections : []).filter(isSessionResultsAnalysisSectionKey),
  );

  const shouldUseNext = (key: SessionResultsAnalysisSectionKey): boolean => nextSectionSet.has(key);

  return {
    ...base,
    generatedAt: next.generatedAt || base.generatedAt,
    inputSignature: next.inputSignature || base.inputSignature,
    kind: SESSION_RESULTS_ANALYSIS_ARTIFACT_KIND,
    model: [base.model, next.model].filter(Boolean).join('+') || undefined,
    participants: base.participants.length ? base.participants : next.participants,
    sections: {
      argumentMap: shouldUseNext('argumentMap') ? next.sections.argumentMap : base.sections.argumentMap,
      atlas: shouldUseNext('atlas') ? next.sections.atlas : base.sections.atlas,
      breakdown: shouldUseNext('breakdown') ? next.sections.breakdown : base.sections.breakdown,
      riskMatrix: shouldUseNext('riskMatrix') ? next.sections.riskMatrix : base.sections.riskMatrix,
    },
    source: 'ai-generated',
    version: SESSION_RESULTS_ANALYSIS_ARTIFACT_VERSION,
  };
};
