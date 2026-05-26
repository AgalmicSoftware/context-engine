export const SESSION_RESULTS_ANALYSIS_ARTIFACT_KIND = 'ce_session_results_analysis_artifact';
export const SESSION_RESULTS_ANALYSIS_ARTIFACT_VERSION = 1;

export const SESSION_RESULTS_ANALYSIS_MINIMUMS = Object.freeze({
  participants: 2,
  questions: 1,
  responses: 3,
});

const ETH_ADDRESS_TEXT_PATTERN = /\b0x[a-fA-F0-9]{40}\b/g;

export type SessionResultsAnalysisQuestionInput = {
  id: string;
  options?: string[];
  prompt: string;
  tags?: string[];
  type?: string;
};

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
  questions: SessionResultsAnalysisQuestionInput[];
  responses: SessionResultsAnalysisAiResponse[];
  session: {
    name: string;
    slug: string;
  };
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

const toSafeString = (value: unknown): string => (
  value === null || value === undefined ? '' : String(value)
);

const normalizeText = (value: unknown): string => (
  toSafeString(value)
    .replace(/\s+/g, ' ')
    .trim()
);

const normalizeAiText = (value: unknown): string => (
  normalizeText(value).replace(ETH_ADDRESS_TEXT_PATTERN, '[redacted-address]')
);

const toPlainRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

const toArray = (value: unknown): unknown[] => (
  Array.isArray(value) ? value : []
);

const buildSyntheticId = (index: number): string => `participant_${String(index + 1).padStart(3, '0')}`;

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
  return Object.keys(record).sort().reduce<Record<string, unknown>>((acc, key) => {
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

export const buildSessionResultsAnalysisInputSignature = (
  payload: SessionResultsAnalysisAiPayload
): string => {
  const input = stableSerializeForSignature(payload);
  let hashA = 0x811c9dc5;
  let hashB = 0x45d9f3b;
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    hashA = Math.imul(hashA ^ code, 16777619) >>> 0;
    hashB = Math.imul(hashB ^ code, 1597334677) >>> 0;
  }
  return [
    'session-results-analysis-v1',
    hashA.toString(16).padStart(8, '0'),
    hashB.toString(16).padStart(8, '0'),
  ].join('-');
};

export const buildSessionResultsAnalysisAiPayload = ({
  questions = [],
  responses = [],
  session = {},
}: {
  questions?: SessionResultsAnalysisQuestionInput[];
  responses?: SessionResultsAnalysisResponseInput[];
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

  const normalizedQuestions = questions.map((question) => ({
    id: normalizeAiText(question?.id),
    options: Array.isArray(question?.options) ? question.options.map(normalizeAiText).filter(Boolean) : [],
    prompt: normalizeAiText(question?.prompt),
    tags: Array.isArray(question?.tags) ? question.tags.map(normalizeAiText).filter(Boolean) : [],
    type: normalizeAiText(question?.type),
  })).filter((question) => question.id || question.prompt);

  const normalizedResponses = responses.map((response) => {
    const answer = getResponseText(response?.answer);
    const additional = getResponseText(response?.additional);
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
  }).filter(Boolean) as SessionResultsAnalysisAiResponse[];

  return {
    aiPayload: {
      counts: {
        participants: participantIds.size,
        questions: normalizedQuestions.length,
        responses: normalizedResponses.length,
      },
      questions: normalizedQuestions,
      responses: normalizedResponses,
      session: {
        name: normalizeAiText(session?.name),
        slug: normalizeAiText(session?.slug),
      },
    },
    participants: Array.from(participantIds.values()),
  };
};

export const evaluateSessionResultsAnalysisEligibility = (
  payload: SessionResultsAnalysisAiPayload
): SessionResultsAnalysisEligibility => {
  const counts = payload?.counts || { participants: 0, questions: 0, responses: 0 };
  const reasons: string[] = [];
  if (counts.responses < SESSION_RESULTS_ANALYSIS_MINIMUMS.responses) {
    reasons.push(`Needs at least ${SESSION_RESULTS_ANALYSIS_MINIMUMS.responses} viewable responses; ${counts.responses} available.`);
  }
  if (counts.participants < SESSION_RESULTS_ANALYSIS_MINIMUMS.participants) {
    reasons.push(`Needs at least ${SESSION_RESULTS_ANALYSIS_MINIMUMS.participants} participants; ${counts.participants} available.`);
  }
  if (counts.questions < SESSION_RESULTS_ANALYSIS_MINIMUMS.questions) {
    reasons.push(`Needs at least ${SESSION_RESULTS_ANALYSIS_MINIMUMS.questions} hydrated question; ${counts.questions} available.`);
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

export const buildSessionResultsAnalysisPrompt = (
  payload: SessionResultsAnalysisAiPayload
): string => `You are generating Context Engine session analysis artifacts.

Return only valid JSON. Do not include markdown fences.

Privacy rules:
- The input uses synthetic participant IDs only. Never invent or request wallet addresses.
- You may reason from raw answer text, but your summaries must paraphrase instead of quoting identifiable freeform responses.
- Keep participant references as synthetic IDs such as participant_001.

Generate this JSON shape:
{
  "breakdown": {
    "summary": { "overview": "short neutral synthesis" },
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
}

Session input:
${JSON.stringify(payload, null, 2)}`;

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

const sectionArray = (record: Record<string, unknown>, key: string): unknown[] => (
  toArray(record[key])
);

const normalizeSectionRecord = (value: unknown): Record<string, unknown> => (
  toPlainRecord(value)
);

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
  const debates = sectionArray(argumentMap, 'debates');
  const categories = sectionArray(riskMatrix, 'categories');
  const comments = sectionArray(riskMatrix, 'comments');
  const scenarioLinks = sectionArray(riskMatrix, 'scenarioLinks');
  const nodes = sectionArray(atlas, 'nodes');
  const edges = sectionArray(atlas, 'edges');

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
        available: groups.length > 0 || Object.keys(toPlainRecord(breakdown.summary)).length > 0,
        groups,
        summary: toPlainRecord(breakdown.summary),
        ...(groups.length || Object.keys(toPlainRecord(breakdown.summary)).length ? {} : {
          reason: 'AI generation did not return breakdown groups.',
        }),
      },
      riskMatrix: {
        available: categories.length > 0 || comments.length > 0,
        categories,
        comments,
        heatmap: toPlainRecord(riskMatrix.heatmap),
        scenarioLinks,
        ...(categories.length || comments.length ? {} : { reason: 'AI generation did not return risk matrix data.' }),
      },
    },
    source: 'ai-generated',
    version: SESSION_RESULTS_ANALYSIS_ARTIFACT_VERSION,
  };
};
