import type { DebateMapProps, DebateNode } from '../DebateMap/debateMapTypes';
import type { DemoAnalysisWorkspaceData } from '../DemoViews/DemoAnalysis/DemoAnalysisWorkspace';
import type {
  RiskCategory,
  RiskCommentRecord,
  RiskMatrixRestoreState,
} from '../MainContent/RiskMatrix';
import type {
  RiskMatrixSeverityAssessment,
  RiskMatrixSeverityAxes,
  RiskSeverityLevel,
} from '../MainContent/RiskMatrixGeneratedSeverity';
import type {
  SessionResultsGeneratedAnalysisArtifact,
  SessionResultsAnalysisQuestionInput,
} from '../../utilities/sessionResultsExport/sessionResultsAnalysisArtifacts';

type PlainRecord = Record<string, unknown>;

export type GeneratedSessionResultsSubmittedQuestion = Partial<SessionResultsAnalysisQuestionInput> & {
  text?: unknown;
  question?: unknown;
};

export type GeneratedSessionResultsSubmittedResponse = {
  additional?: unknown;
  answer?: unknown;
  participantId?: unknown;
  questionId?: unknown;
  questionPrompt?: unknown;
  questionType?: unknown;
  segmentKeys?: unknown;
  segmentValues?: unknown;
  segments?: unknown;
};

export type GeneratedDebateMapAdapterResult = {
  props: Pick<DebateMapProps, 'atlasRootLabel' | 'hideDemoModeToggle' | 'readOnly' | 'treeData'> | null;
  unavailableReason: string;
};

export type GeneratedBreakdownAdapterResult = {
  analysisData: DemoAnalysisWorkspaceData | null;
  unavailableReason: string;
};

export type GeneratedRiskMatrixAdapterResult = {
  props: {
    categories: RiskCategory[];
    commentEyebrow: string;
    generatedSeverityAssessments?: RiskMatrixSeverityAssessment[];
    generatedSeverityAxes?: RiskMatrixSeverityAxes;
    initialComments: RiskCommentRecord[];
    readOnly: boolean;
    restoreState: RiskMatrixRestoreState;
  } | null;
  unavailableReason: string;
};

const GENERATED_ATLAS_ROOT_LABEL = 'Session Results Atlas';
const ETH_ADDRESS_TEXT_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const toRecord = (value: unknown): PlainRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as PlainRecord) : {};

const toArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const toText = (value: unknown): string =>
  value === null || value === undefined
    ? ''
    : String(value)
        .replace(/\s+/g, ' ')
        .trim();

const slugify = (value: unknown, fallback = 'item'): string => {
  const slug = toText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
  return slug || fallback;
};

const uniqueTexts = (values: unknown[]): string[] => Array.from(new Set(values.map(toText).filter(Boolean)));

const flattenSourceRefValues = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value.flatMap(flattenSourceRefValues);
  const record = toRecord(value);
  if (Object.keys(record).length > 0) {
    return [record.label ?? record.ref ?? record.id ?? record.questionId ?? record.sourceId ?? ''];
  }
  return [value];
};

const collectSourceRefs = (...values: unknown[]): string[] =>
  uniqueTexts(values.flatMap(flattenSourceRefValues)).filter((ref) => !ETH_ADDRESS_TEXT_PATTERN.test(ref));

const isAvailableArtifact = (artifact: unknown): artifact is SessionResultsGeneratedAnalysisArtifact =>
  Boolean(
    artifact &&
      typeof artifact === 'object' &&
      (artifact as PlainRecord).source === 'ai-generated' &&
      (artifact as PlainRecord).sections &&
      typeof (artifact as PlainRecord).sections === 'object' &&
      !Array.isArray((artifact as PlainRecord).sections),
  );

const getArtifactSectionsRecord = (artifact: SessionResultsGeneratedAnalysisArtifact): PlainRecord =>
  toRecord(artifact.sections);

const getArtifactSectionRecord = (
  artifact: SessionResultsGeneratedAnalysisArtifact,
  sectionKey: string,
): PlainRecord => toRecord(getArtifactSectionsRecord(artifact)[sectionKey]);

const getArtifactSectionArray = (
  artifact: SessionResultsGeneratedAnalysisArtifact,
  sectionKey: string,
  arrayKey: string,
): unknown[] => toArray(getArtifactSectionRecord(artifact, sectionKey)[arrayKey]);

const getArtifactSectionAvailable = (
  artifact: SessionResultsGeneratedAnalysisArtifact,
  sectionKey: string,
): boolean => getArtifactSectionRecord(artifact, sectionKey).available === true;

const getArtifactSectionReason = (
  artifact: SessionResultsGeneratedAnalysisArtifact,
  sectionKey: string,
): string => toText(getArtifactSectionRecord(artifact, sectionKey).reason);

const buildQuestionRefs = (questionIds: unknown): DebateNode['questions'] =>
  uniqueTexts(toArray(questionIds)).map((questionId) => ({
    id: questionId,
    question: `Question ${questionId}`,
  }));

const buildCommentRefs = (record: PlainRecord, fallback = ''): DebateNode['comments'] => {
  const comment = toText(record.summary ?? record.rationale ?? record.description ?? record.evidence ?? fallback);
  return comment ? [{ id: `${slugify(record.id ?? record.label ?? fallback, 'comment')}:summary`, comment }] : [];
};

const normalizeClaimNode = (claim: unknown, index: number): DebateNode | null => {
  const record = toRecord(claim);
  const label = toText(record.label ?? record.claim ?? record.title ?? record.summary);
  if (!label) return null;

  return {
    id: slugify(record.id ?? label, `claim_${index + 1}`),
    name: label,
    comments: buildCommentRefs(record, label),
    questions: buildQuestionRefs(record.questionIds),
    votes: { up: 0, down: 0 },
  };
};

const normalizeDebateNode = (debate: unknown, index: number): DebateNode | null => {
  const record = toRecord(debate);
  const title = toText(record.title ?? record.label ?? record.question ?? record.summary);
  if (!title) return null;
  const claims = toArray(record.claims)
    .map((claim, claimIndex) => normalizeClaimNode(claim, claimIndex))
    .filter(Boolean) as DebateNode[];

  return {
    id: slugify(record.id ?? title, `debate_${index + 1}`),
    name: title,
    children: claims,
    comments: buildCommentRefs(record, title),
    questions: buildQuestionRefs(record.questionIds),
    votes: { up: 0, down: 0 },
  };
};

const normalizeAtlasNodeLabel = (node: PlainRecord): string => toText(node.label ?? node.name ?? node.title ?? node.summary);

const buildAtlasNodes = (nodes: unknown[], edges: unknown[]): { nodes: DebateNode[]; rejectedReason: string } => {
  const nodeMap = new Map<string, DebateNode>();
  nodes.forEach((node, index) => {
    const record = toRecord(node);
    const label = normalizeAtlasNodeLabel(record);
    if (!label) return;
    const id = slugify(record.id ?? label, `atlas_${index + 1}`);
    nodeMap.set(id, {
      id,
      name: label,
      comments: buildCommentRefs(record, label),
      questions: buildQuestionRefs(record.questionIds),
      votes: { up: 0, down: 0 },
    });
  });

  const childIds = new Set<string>();
  const parentByChild = new Map<string, string>();
  edges.forEach((edge) => {
    const record = toRecord(edge);
    const sourceId = slugify(record.source ?? record.sourceId, '');
    const targetId = slugify(record.target ?? record.targetId, '');
    const source = nodeMap.get(sourceId);
    const target = nodeMap.get(targetId);
    if (!source || !target || sourceId === targetId) return;
    if (parentByChild.has(targetId)) return;
    source.children = [...(source.children || []), target];
    childIds.add(targetId);
    parentByChild.set(targetId, sourceId);
  });

  const hasCycle = (nodeId: string, path = new Set<string>()): boolean => {
    if (path.has(nodeId)) return true;
    path.add(nodeId);
    const node = nodeMap.get(nodeId);
    const children = Array.isArray(node?.children) ? node.children : [];
    return children.some((child) => hasCycle(String(child.id || ''), new Set(path)));
  };

  if (Array.from(nodeMap.keys()).some((nodeId) => hasCycle(nodeId))) {
    return { nodes: [], rejectedReason: 'Generated atlas graph contains a cycle and cannot be rendered safely.' };
  }

  const roots = Array.from(nodeMap.values()).filter((node) => !childIds.has(String(node.id || '')));
  if (roots.length === 0 && nodeMap.size > 0) {
    return { nodes: [], rejectedReason: 'Generated atlas graph did not include a renderable root node.' };
  }

  return { nodes: roots, rejectedReason: '' };
};

export const buildGeneratedDebateMapAdapter = (
  artifact: unknown,
): GeneratedDebateMapAdapterResult => {
  if (!isAvailableArtifact(artifact)) {
    return { props: null, unavailableReason: 'Generated session analysis is not available.' };
  }

  const debateNodes = getArtifactSectionAvailable(artifact, 'argumentMap')
    ? getArtifactSectionArray(artifact, 'argumentMap', 'debates')
        .map((debate, index) => normalizeDebateNode(debate, index))
        .filter(Boolean) as DebateNode[]
    : [];
  const atlasResult =
    debateNodes.length === 0 && getArtifactSectionAvailable(artifact, 'atlas')
      ? buildAtlasNodes(
          getArtifactSectionArray(artifact, 'atlas', 'nodes'),
          getArtifactSectionArray(artifact, 'atlas', 'edges'),
        )
      : { nodes: [], rejectedReason: '' };
  const treeData = debateNodes.length > 0 ? debateNodes : atlasResult.nodes;

  if (treeData.length === 0) {
    return {
      props: null,
      unavailableReason:
        atlasResult.rejectedReason ||
        getArtifactSectionReason(artifact, 'argumentMap') ||
        getArtifactSectionReason(artifact, 'atlas') ||
        'Generated argument-map data is empty.',
    };
  }

  return {
    props: {
      atlasRootLabel: GENERATED_ATLAS_ROOT_LABEL,
      hideDemoModeToggle: true,
      readOnly: true,
      treeData,
    },
    unavailableReason: '',
  };
};

const normalizeQuestion = (question: GeneratedSessionResultsSubmittedQuestion, index: number) => {
  const id = toText(question.id) || `question_${index + 1}`;
  const text = toText(question.prompt ?? question.text ?? question.question) || `Question ${index + 1}`;
  return {
    id,
    text,
    options: uniqueTexts(toArray(question.options)),
    category: uniqueTexts(toArray(question.tags))[0] || '',
    keyTension: '',
    sourcePromptType: toText(question.type) || 'session',
  };
};

const getResponseSegments = (response: GeneratedSessionResultsSubmittedResponse): string[] => {
  const explicitSegmentKeys = uniqueTexts(toArray(response.segmentKeys));
  if (explicitSegmentKeys.length > 0) return explicitSegmentKeys;

  const segmentRecord = {
    ...toRecord(response.segments),
    ...toRecord(response.segmentValues),
  };

  return Object.entries(segmentRecord)
    .map(([category, value]) => {
      const categoryText = toText(category);
      const valueText = toText(value);
      return categoryText && valueText ? `${categoryText}:${valueText}` : '';
    })
    .filter(Boolean);
};

const addCount = (target: Record<string, number>, key: string, amount = 1) => {
  target[key] = Number(target[key] || 0) + amount;
};

export const buildGeneratedBreakdownAnalysisData = ({
  questions = [],
  responses = [],
}: {
  artifact?: unknown;
  questions?: GeneratedSessionResultsSubmittedQuestion[];
  responses?: GeneratedSessionResultsSubmittedResponse[];
} = {}): GeneratedBreakdownAdapterResult => {
  const normalizedQuestions = (Array.isArray(questions) ? questions : []).map(normalizeQuestion);
  const questionMap = new Map(normalizedQuestions.map((question) => [question.id, question]));
  const answerCounts = new Map<string, Record<string, number>>();
  const segmentTotalsByQuestion: Record<string, Record<string, number>> = {};
  const demographicParticipantKeys: Record<string, Record<string, Set<string>>> = {};
  const seenQuestionParticipantResponses = new Set<string>();

  (Array.isArray(responses) ? responses : []).forEach((response, index) => {
    const questionId = toText(response.questionId);
    const answer = toText(response.answer ?? response.additional);
    if (!questionId || !answer) return;
    if (!questionMap.has(questionId)) return;

    const participantKey = toText(response.participantId) || `response_${index + 1}`;
    const responseKey = `${questionId}::${participantKey}`;
    if (seenQuestionParticipantResponses.has(responseKey)) return;
    seenQuestionParticipantResponses.add(responseKey);

    const segmentKeys = ['All', ...getResponseSegments(response)];
    segmentKeys.forEach((segmentKey) => {
      const mapKey = `${questionId}::${segmentKey}`;
      const counts = answerCounts.get(mapKey) || {};
      addCount(counts, answer);
      answerCounts.set(mapKey, counts);
      segmentTotalsByQuestion[questionId] = segmentTotalsByQuestion[questionId] || {};
      addCount(segmentTotalsByQuestion[questionId], segmentKey);

      if (segmentKey !== 'All') {
        const separatorIndex = segmentKey.indexOf(':');
        const category = segmentKey.slice(0, separatorIndex);
        const value = segmentKey.slice(separatorIndex + 1);
        if (category && value) {
          demographicParticipantKeys[category] = demographicParticipantKeys[category] || {};
          demographicParticipantKeys[category][value] = demographicParticipantKeys[category][value] || new Set();
          demographicParticipantKeys[category][value].add(participantKey);
        }
      }
    });
  });

  const finalQuestions = Array.from(questionMap.values()).map((question) => {
    const optionSet = new Set(question.options);
    answerCounts.forEach((counts, key) => {
      if (!key.startsWith(`${question.id}::`)) return;
      Object.keys(counts).forEach((answer) => optionSet.add(answer));
    });
    return { ...question, options: Array.from(optionSet) };
  });

  const flatResponses = finalQuestions.flatMap((question) => {
    const segmentKeys = Object.keys(segmentTotalsByQuestion[question.id] || {});
    return segmentKeys.flatMap((segmentKey) => {
      const totalVotes = Number(segmentTotalsByQuestion[question.id]?.[segmentKey] || 0);
      const counts = answerCounts.get(`${question.id}::${segmentKey}`) || {};
      return question.options.map((responseText) => {
        const count = Number(counts[responseText] || 0);
        return {
          questionId: question.id,
          responseText,
          segmentKey,
          count,
          participantCount: totalVotes,
          totalVotes,
          rate: totalVotes > 0 ? count / totalVotes : 0,
        };
      });
    });
  });

  if (finalQuestions.length === 0 || flatResponses.length === 0) {
    return {
      analysisData: null,
      unavailableReason: 'Submitted responses are required before Breakdown can render generated session distributions.',
    };
  }

  const demographics = Object.fromEntries(
    Object.entries(demographicParticipantKeys).map(([category, counts]) => [
      category,
      Object.entries(counts).map(([value, participantKeys]) => ({ value, count: participantKeys.size })),
    ]),
  );

  return {
    analysisData: {
      questions: finalQuestions,
      flatResponses,
      demographics,
      segmentCounts: segmentTotalsByQuestion,
      questionTagsData: Object.fromEntries(
        finalQuestions.map((question) => [
          question.id,
          question.category
            ? [{ tagID: `category:${slugify(question.category)}`, tagName: question.category }]
            : [],
        ]),
      ),
    },
    unavailableReason: '',
  };
};

const isCanonicalCellId = (cell = ''): boolean => {
  const parts = String(cell).split('.');
  return parts.length === 4 && parts.every(Boolean);
};

const normalizeRiskValence = (value: unknown): 'risk' | 'opportunity' | null => {
  const normalized = toText(value).toLowerCase();
  if (normalized === 'opportunity' || normalized === 'positive') return 'opportunity';
  if (normalized === 'risk' || normalized === 'negative') return 'risk';
  return null;
};

const normalizeRiskIntensity = (value: unknown): number | null => {
  const numericValue = Number(value);
  if (Number.isFinite(numericValue) && numericValue > 0) return Math.max(1, Math.min(10, Math.round(numericValue)));
  return null;
};

const normalizeSeverityLevel = (value: unknown): RiskSeverityLevel | null => {
  const normalized = toText(value).toLowerCase();
  return normalized === 'low' || normalized === 'medium' || normalized === 'high' ? normalized : null;
};

const normalizeGeneratedRiskCategory = (category: unknown, index: number): { id: string; category: RiskCategory } | null => {
  const record = toRecord(category);
  const label = toText(record.label ?? record.name ?? record.title);
  if (!label) return null;
  const subcategories = uniqueTexts(toArray(record.subcategories));
  return {
    id: slugify(record.id ?? label, `risk_${index + 1}`),
    category: {
      name: label,
      subcategories: subcategories.length > 0 ? subcategories : ['Generated'],
    },
  };
};

const normalizeRiskAxisLevels = (levels: unknown[]): RiskMatrixSeverityAxes['x']['levels'] =>
  levels
    .map((level, index) => {
      const record = toRecord(level);
      const label = toText(record.label ?? record.name ?? record.id ?? level);
      if (!label) return null;
      return {
        id: slugify(record.id ?? label, `level_${index + 1}`),
        label,
        ...(toText(record.description ?? record.summary) ? { description: toText(record.description ?? record.summary) } : {}),
      };
    })
    .filter(Boolean) as RiskMatrixSeverityAxes['x']['levels'];

const normalizeRiskAxes = (value: unknown): RiskMatrixSeverityAxes | null => {
  const record = toRecord(value);
  const xRecord = toRecord(record.x ?? record.columns ?? record.horizontal);
  const yRecord = toRecord(record.y ?? record.rows ?? record.vertical);
  const xLabel = toText(xRecord.label ?? xRecord.name);
  const yLabel = toText(yRecord.label ?? yRecord.name);
  const xLevels = normalizeRiskAxisLevels(toArray(xRecord.levels));
  const yLevels = normalizeRiskAxisLevels(toArray(yRecord.levels));
  if (!xLabel || !yLabel || xLevels.length === 0 || yLevels.length === 0) return null;
  return {
    x: { id: slugify(xRecord.id ?? xLabel, 'x_axis'), label: xLabel, levels: xLevels },
    y: { id: slugify(yRecord.id ?? yLabel, 'y_axis'), label: yLabel, levels: yLevels },
  };
};

const buildGeneratedRiskAssessmentsFromAxes = (
  section: PlainRecord,
  axes: RiskMatrixSeverityAxes | null,
): RiskMatrixSeverityAssessment[] => {
  if (!axes) return [];
  const xLevelIds = new Set(axes.x.levels.map((level) => level.id));
  const yLevelIds = new Set(axes.y.levels.map((level) => level.id));
  return toArray(section.assessments)
    .map((assessment, index) => {
      const record = toRecord(assessment);
      const id = slugify(record.id ?? record.label ?? record.category ?? record.name, `assessment_${index + 1}`);
      const category = toText(record.label ?? record.category ?? record.name ?? record.title);
      const summary = toText(record.summary ?? record.description ?? record.rationale ?? record.evidence);
      const xLevelId = slugify(record.xLevelId ?? record.x ?? record.columnLevelId ?? record.likelihood, '');
      const yLevelId = slugify(record.yLevelId ?? record.y ?? record.rowLevelId ?? record.impact, '');
      const sourceRefs = collectSourceRefs(record.sourceRefs, record.sources, record.questionIds, record.evidenceIds);
      const valence = normalizeRiskValence(record.valence ?? record.type);
      if (!id || !category || !summary || !xLevelIds.has(xLevelId) || !yLevelIds.has(yLevelId)) return null;
      return {
        id,
        category,
        summary,
        xLevelId,
        yLevelId,
        ...(sourceRefs.length > 0 ? { sourceRefs } : {}),
        ...(valence ? { valence } : {}),
      };
    })
    .filter(Boolean) as RiskMatrixSeverityAssessment[];
};

export const buildGeneratedRiskMatrixAdapter = (
  artifact: unknown,
): GeneratedRiskMatrixAdapterResult => {
  if (!isAvailableArtifact(artifact)) {
    return { props: null, unavailableReason: 'Generated session risk analysis is not available.' };
  }

  const section = getArtifactSectionRecord(artifact, 'riskMatrix');
  if (section.available !== true) {
    return { props: null, unavailableReason: toText(section.reason) || 'Generated risk matrix data is empty.' };
  }

  const sectionCategories = toArray(section.categories);
  const sectionComments = toArray(section.comments);
  const generatedCategories = sectionCategories
    .map(normalizeGeneratedRiskCategory)
    .filter(Boolean) as Array<{ id: string; category: RiskCategory }>;
  const categoriesByName = new Map<string, RiskCategory>();
  const rememberCategory = (category: RiskCategory) => {
    if (!categoriesByName.has(category.name)) categoriesByName.set(category.name, category);
  };

  generatedCategories.forEach(({ category }) => rememberCategory(category));

  const heatmap = toRecord(section.heatmap);
  const generatedAxes = normalizeRiskAxes(section.axes);
  const axisAssessments = buildGeneratedRiskAssessmentsFromAxes(section, generatedAxes);
  const comments = sectionComments
    .map((comment) => {
      const record = toRecord(comment);
      const directCell = toText(record.cell);
      const cell = isCanonicalCellId(directCell) ? directCell : '';
      const summary = toText(record.summary ?? record.comment ?? record.description ?? record.evidence);
      const valence = normalizeRiskValence(record.valence ?? record.type);
      const intensity = normalizeRiskIntensity(record.intensity);
      if (!cell || !summary || !valence || intensity == null) return null;

      return {
        cell,
        comment: summary,
        intensity,
        valence,
      };
    })
    .filter(Boolean) as RiskCommentRecord[];

  const legacySeverityAssessments = sectionCategories
    .map((category, index) => {
      const record = toRecord(category);
      const id = slugify(record.id ?? record.label ?? record.name, `risk_${index + 1}`);
      const heat = toRecord(heatmap[id]);
      const likelihood = normalizeSeverityLevel(record.likelihood ?? heat.likelihood);
      const impact = normalizeSeverityLevel(record.impact ?? heat.impact);
      const label = toText(record.label ?? record.name ?? record.title);
      const matchingComments = sectionComments
        .map(toRecord)
        .filter((comment) => slugify(comment.categoryId ?? comment.category ?? comment.id, '') === id);
      const summary =
        toText(record.summary ?? record.description) ||
        toText(matchingComments[0]?.summary ?? matchingComments[0]?.comment ?? matchingComments[0]?.description);
      const sourceRefs = collectSourceRefs(
        record.sourceRefs,
        record.sources,
        record.questionIds,
        record.evidenceIds,
        ...matchingComments.flatMap((comment) => [
          comment.sourceRefs,
          comment.sources,
          comment.questionIds,
          comment.evidenceIds,
        ]),
      );
      const valence = normalizeRiskValence(record.valence ?? matchingComments[0]?.valence);
      if (!id || !label || !likelihood || !impact || !summary) return null;
      return {
        id,
        category: label,
        impact,
        likelihood,
        ...(sourceRefs.length > 0 ? { sourceRefs } : {}),
        summary,
        ...(valence ? { valence } : {}),
      };
    })
    .filter(Boolean) as RiskMatrixSeverityAssessment[];
  const severityAssessments = axisAssessments.length > 0 ? axisAssessments : legacySeverityAssessments;

  if (comments.length === 0 && severityAssessments.length === 0) {
    return {
      props: null,
      unavailableReason:
        'Generated risk matrix did not include validated pairwise cells or explicit likelihood/impact assessments.',
    };
  }

  comments.forEach((comment) => {
    const [catX, subX, catY, subY] = comment.cell.split('.');
    rememberCategory({ name: catX, subcategories: [subX] });
    rememberCategory({ name: catY, subcategories: [subY] });
  });

  const categories = Array.from(categoriesByName.values()).map((category) => ({
    name: category.name,
    subcategories: uniqueTexts(category.subcategories).length > 0 ? uniqueTexts(category.subcategories) : ['Generated'],
  }));

  return {
    props: {
      categories,
      commentEyebrow: 'Generated note',
      generatedSeverityAssessments: severityAssessments,
      ...(generatedAxes && axisAssessments.length > 0 ? { generatedSeverityAxes: generatedAxes } : {}),
      initialComments: comments,
      readOnly: true,
      restoreState: { comments },
    },
    unavailableReason: '',
  };
};
