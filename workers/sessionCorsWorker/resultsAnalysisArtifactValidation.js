const ARTIFACT_KIND = 'ce_session_results_analysis_artifact';
const ARTIFACT_VERSION = 1;
const SECTION_ORDER = ['argumentMap', 'atlas', 'breakdown', 'riskMatrix'];
const SEVERITY_LEVELS = new Set(['low', 'medium', 'high']);
const WALLET_TEXT_RE = /\b0x[a-fA-F0-9]{40}\b/g;
const WALLET_ID_RE = /^0x[a-fA-F0-9]{40}$/;

const LIMITS = Object.freeze({
  debates: 24,
  claimsPerDebate: 16,
  atlasNodes: 80,
  atlasEdges: 120,
  breakdownDimensions: 24,
  breakdownDimensionValues: 24,
  breakdownGroups: 40,
  breakdownThemes: 24,
  riskCategories: 24,
  riskAssessments: 80,
  riskAxisLevels: 6,
  riskComments: 80,
  riskScenarioLinks: 0,
  sourceRefs: 16,
  idChars: 128,
  labelChars: 180,
  summaryChars: 900,
  modelChars: 180,
});

const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const toArray = (value) => (Array.isArray(value) ? value : []);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const toPrimitiveStr = (value) => {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return '';
};
const compactWhitespace = (value) => toPrimitiveStr(value).replace(/\s+/g, ' ').trim();

const cleanText = (value, maxLength = LIMITS.summaryChars) => {
  const text = compactWhitespace(value).replace(WALLET_TEXT_RE, '[redacted-address]');
  if (!text) return '';
  return text.slice(0, Math.max(0, maxLength));
};

const cleanId = (value, fallback = '') => {
  const text = compactWhitespace(value).slice(0, LIMITS.idChars);
  if (!text || WALLET_ID_RE.test(text)) return fallback;
  return [...text].filter((char) => {
    const code = char.codePointAt(0);
    return code > 0x1f && code !== 0x7f;
  }).join('') || fallback;
};

const slugId = (value, fallback) => {
  const base = cleanId(value)
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, LIMITS.idChars);
  return base || fallback;
};

const unique = (values) => [...new Set(values.filter(Boolean))];

const sectionRecord = (value) => {
  const raw = isObj(value?.sections) ? value.sections : value;
  return isObj(raw) ? raw : {};
};

const normalizeSections = (sections) => {
  const requested = new Set();
  toArray(sections).forEach((section) => {
    const key = compactWhitespace(section);
    if (key === 'circles') {
      requested.add('argumentMap');
      requested.add('atlas');
    } else if (SECTION_ORDER.includes(key)) {
      requested.add(key);
    }
  });
  return SECTION_ORDER.filter((section) => requested.has(section));
};

const unavailable = (reason, extra = {}) => ({ available: false, ...extra, reason });

const defaultSection = (key, reason) => {
  if (key === 'argumentMap') return unavailable(reason, { debates: [] });
  if (key === 'atlas') return unavailable(reason, { nodes: [], edges: [] });
  if (key === 'breakdown') return unavailable(reason, { dimensions: [], groups: [], summary: {} });
  return unavailable(reason, { categories: [], comments: [], heatmap: {}, scenarioLinks: [] });
};

const buildAllowedSourceIds = (source = {}) => {
  const aiSnapshotPresent = hasOwn(source, 'aiSnapshot');
  const aiQuestions = [
    ...toArray(source?.aiSnapshot?.questions),
    ...toArray(source?.aiSnapshot?.responses),
  ];
  const snapshotQuestions = [
    ...toArray(source?.snapshot?.questions),
    ...toArray(source?.snapshot?.responses),
  ];
  const aiParticipants = toArray(source?.aiSnapshot?.responses);
  const snapshotParticipants = [
    ...toArray(source?.participants),
    ...toArray(source?.snapshot?.responses),
  ];
  const questions = aiSnapshotPresent ? aiQuestions : snapshotQuestions;
  const participants = aiSnapshotPresent ? aiParticipants : snapshotParticipants;
  return {
    questions: new Set(questions.map((entry) => cleanId(entry?.id || entry?.questionId || entry?.questionID)).filter(Boolean)),
    participants: new Set(participants.map((entry) => cleanId(entry?.syntheticId || entry?.participantId)).filter(Boolean)),
  };
};

const normalizeParticipants = (participants) => toArray(participants)
  .map((entry) => {
    const syntheticId = cleanId(entry?.syntheticId);
    return syntheticId ? { syntheticId } : null;
  })
  .filter(Boolean);

const normalizeIdRefs = ({ value, allowed, label, errors }) => {
  const refs = unique(toArray(value).map((entry) => cleanId(entry)).filter(Boolean)).slice(0, LIMITS.sourceRefs);
  refs.forEach((ref) => {
    if (!allowed.has(ref)) errors.push(`unknown ${label}: ${ref}`);
  });
  return refs;
};

const normalizeSourceFields = (record, allowed, errors) => {
  const participantIds = normalizeIdRefs({ value: record.participantIds, allowed: allowed.participants, label: 'participantId', errors });
  const questionIds = normalizeIdRefs({ value: record.questionIds, allowed: allowed.questions, label: 'questionId', errors });
  return {
    ...(participantIds.length ? { participantIds } : {}),
    ...(questionIds.length ? { questionIds } : {}),
  };
};

const normalizeSummaryRecord = (value) => {
  const record = isObj(value) ? value : {};
  const overview = cleanText(record.overview || record.summary || record.interpretation || record.narrative);
  const themes = toArray(record.themes || record.keyFindings || record.findings)
    .slice(0, LIMITS.breakdownThemes)
    .map((entry, index) => {
      const item = isObj(entry) ? entry : { summary: entry };
      const label = cleanText(item.label || item.name || item.title || `Theme ${index + 1}`, LIMITS.labelChars);
      const summary = cleanText(item.summary || item.description || item.finding || item.body);
      if (!label && !summary) return null;
      return {
        id: slugId(item.id || label || summary, `theme_${index + 1}`),
        label: label || `Theme ${index + 1}`,
        ...(summary ? { summary } : {}),
      };
    })
    .filter(Boolean);
  return {
    ...(overview ? { overview } : {}),
    ...(themes.length ? { themes } : {}),
  };
};

const normalizeArgumentMap = (rawSection, allowed) => {
  if (!isObj(rawSection)) return defaultSection('argumentMap', 'AI generation did not return argument-map data.');
  const errors = [];
  const debates = toArray(rawSection.debates).slice(0, LIMITS.debates).map((debate, debateIndex) => {
    if (!isObj(debate)) return null;
    const title = cleanText(debate.title || debate.label || debate.question || debate.summary, LIMITS.labelChars);
    if (!title) return null;
    const claims = toArray(debate.claims).slice(0, LIMITS.claimsPerDebate).map((claim, claimIndex) => {
      if (!isObj(claim)) return null;
      const label = cleanText(claim.label || claim.claim || claim.title || claim.summary, LIMITS.labelChars);
      if (!label) return null;
      const summary = cleanText(claim.summary || claim.description || claim.evidence);
      const stance = cleanText(claim.stance, 24).toLowerCase();
      return {
        id: slugId(claim.id || label, `claim_${debateIndex + 1}_${claimIndex + 1}`),
        label,
        ...(summary ? { summary } : {}),
        ...(['support', 'oppose', 'mixed'].includes(stance) ? { stance } : {}),
        ...normalizeSourceFields(claim, allowed, errors),
      };
    }).filter(Boolean);
    const summary = cleanText(debate.summary || debate.description);
    return {
      id: slugId(debate.id || title, `debate_${debateIndex + 1}`),
      title,
      ...(summary ? { summary } : {}),
      ...normalizeSourceFields(debate, allowed, errors),
      ...(claims.length ? { claims } : { claims: [] }),
    };
  }).filter(Boolean);
  if (errors.length) return defaultSection('argumentMap', `AI generation referenced unknown source ids in argument map: ${errors.slice(0, 4).join(', ')}.`);
  if (!debates.length) return defaultSection('argumentMap', 'AI generation did not return renderable argument-map debates.');
  return { available: true, debates };
};

const hasCycle = (nodes, edges) => {
  const adjacency = new Map(nodes.map((node) => [node.id, []]));
  edges.forEach((edge) => adjacency.get(edge.source)?.push(edge.target));
  const visiting = new Set();
  const visited = new Set();
  const visit = (id) => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const child of adjacency.get(id) || []) {
      if (visit(child)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return nodes.some((node) => visit(node.id));
};

const normalizeAtlas = (rawSection, allowed) => {
  if (!isObj(rawSection)) return defaultSection('atlas', 'AI generation did not return atlas data.');
  const errors = [];
  const seenIds = new Set();
  const nodes = toArray(rawSection.nodes).slice(0, LIMITS.atlasNodes).map((node, index) => {
    if (!isObj(node)) return null;
    const label = cleanText(node.label || node.name || node.title || node.summary, LIMITS.labelChars);
    if (!label) return null;
    let id = slugId(node.id || label, `atlas_${index + 1}`);
    if (seenIds.has(id)) id = `atlas_${index + 1}`;
    seenIds.add(id);
    const summary = cleanText(node.summary || node.description);
    return {
      id,
      label,
      ...(summary ? { summary } : {}),
      ...normalizeSourceFields(node, allowed, errors),
    };
  }).filter(Boolean);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = toArray(rawSection.edges).slice(0, LIMITS.atlasEdges).map((edge, index) => {
    if (!isObj(edge)) return null;
    const source = slugId(edge.source || edge.sourceId, '');
    const target = slugId(edge.target || edge.targetId, '');
    if (!source || !target || source === target || !nodeIds.has(source) || !nodeIds.has(target)) {
      errors.push(`invalid atlas edge ${index + 1}`);
      return null;
    }
    const label = cleanText(edge.label || edge.relationship || edge.summary, LIMITS.labelChars);
    return { source, target, ...(label ? { label } : {}) };
  }).filter(Boolean);
  if (errors.length) return defaultSection('atlas', `AI generation returned invalid atlas data: ${errors.slice(0, 4).join(', ')}.`);
  if (!nodes.length) return defaultSection('atlas', 'AI generation did not return renderable atlas nodes.');
  if (hasCycle(nodes, edges)) return defaultSection('atlas', 'AI generation returned an atlas graph with a cycle.');
  const childIds = new Set(edges.map((edge) => edge.target));
  if (nodes.length && nodes.every((node) => childIds.has(node.id))) {
    return defaultSection('atlas', 'AI generation returned an atlas graph without a renderable root.');
  }
  return { available: true, nodes, edges };
};

const normalizeBreakdown = (rawSection, allowed) => {
  if (!isObj(rawSection)) return defaultSection('breakdown', 'AI generation did not return breakdown data.');
  const errors = [];
  const summary = normalizeSummaryRecord(rawSection.summary);
  const dimensions = toArray(rawSection.dimensions).slice(0, LIMITS.breakdownDimensions).map((dimension, index) => {
    if (!isObj(dimension)) return null;
    const label = cleanText(dimension.label || dimension.name || dimension.dimension, LIMITS.labelChars);
    if (!label) return null;
    const description = cleanText(dimension.summary || dimension.description || dimension.interpretation);
    const values = toArray(dimension.values).slice(0, LIMITS.breakdownDimensionValues).map((value, valueIndex) => {
      const item = isObj(value) ? value : { label: value };
      const valueLabel = cleanText(item.label || item.value || item.name, LIMITS.labelChars);
      if (!valueLabel) return null;
      const valueSummary = cleanText(item.summary || item.description || item.interpretation);
      return {
        id: slugId(item.id || item.valueId || valueLabel, `value_${index + 1}_${valueIndex + 1}`),
        label: valueLabel,
        ...(valueSummary ? { summary: valueSummary } : {}),
      };
    }).filter(Boolean);
    return {
      id: slugId(dimension.id || dimension.dimensionId || label, `dimension_${index + 1}`),
      label,
      ...(description ? { summary: description } : {}),
      ...(values.length ? { values } : {}),
    };
  }).filter(Boolean);
  const groups = toArray(rawSection.groups).slice(0, LIMITS.breakdownGroups).map((group, index) => {
    if (!isObj(group)) return null;
    const label = cleanText(group.label || group.name || group.title || group.group, LIMITS.labelChars);
    const summaryText = cleanText(group.summary || group.description || group.interpretation || group.insight);
    if (!label && !summaryText) return null;
    return {
      id: slugId(group.id || label || summaryText, `group_${index + 1}`),
      label: label || `Group ${index + 1}`,
      ...(summaryText ? { summary: summaryText } : {}),
      ...normalizeSourceFields(group, allowed, errors),
    };
  }).filter(Boolean);
  if (errors.length) return defaultSection('breakdown', `AI generation referenced unknown source ids in breakdown: ${errors.slice(0, 4).join(', ')}.`);
  if (!Object.keys(summary).length && !dimensions.length && !groups.length) {
    return defaultSection('breakdown', 'AI generation did not return renderable breakdown content.');
  }
  return { available: true, summary, dimensions, groups };
};

const normalizeSeverity = (value) => {
  const normalized = cleanText(value, 16).toLowerCase();
  return SEVERITY_LEVELS.has(normalized) ? normalized : '';
};

const DEFAULT_RISK_AXES = Object.freeze({
  x: {
    id: 'likelihood',
    label: 'Likelihood',
    levels: [
      { id: 'low', label: 'Low' },
      { id: 'medium', label: 'Medium' },
      { id: 'high', label: 'High' },
    ],
  },
  y: {
    id: 'impact',
    label: 'Impact',
    levels: [
      { id: 'low', label: 'Low' },
      { id: 'medium', label: 'Medium' },
      { id: 'high', label: 'High' },
    ],
  },
});

const normalizeRiskAxis = (axis, fallback) => {
  if (!isObj(axis)) return null;
  const record = axis;
  const label = cleanText(record.label || record.name, LIMITS.labelChars);
  if (!label) return null;
  const id = slugId(record.id || label, fallback.id);
  const rawLevels = toArray(record.levels);
  const seen = new Set();
  const levels = rawLevels.slice(0, LIMITS.riskAxisLevels).map((level, index) => {
    const levelRecord = isObj(level) ? level : { label: level, id: level };
    const levelLabel = cleanText(levelRecord.label || levelRecord.name || levelRecord.id, LIMITS.labelChars);
    if (!levelLabel) return null;
    let levelId = slugId(levelRecord.id || levelLabel, `level_${index + 1}`);
    if (seen.has(levelId)) levelId = `level_${index + 1}`;
    seen.add(levelId);
    const description = cleanText(levelRecord.description || levelRecord.summary, LIMITS.summaryChars);
    return { id: levelId, label: levelLabel, ...(description ? { description } : {}) };
  }).filter(Boolean);
  if (levels.length < 2) return null;
  return { id, label, levels };
};

const normalizeRiskAxes = (rawAxes) => {
  const axes = isObj(rawAxes) ? rawAxes : {};
  const x = normalizeRiskAxis(axes.x || axes.columns || axes.horizontal, DEFAULT_RISK_AXES.x);
  const y = normalizeRiskAxis(axes.y || axes.rows || axes.vertical, DEFAULT_RISK_AXES.y);
  return x && y ? { x, y } : null;
};

const normalizeRiskAssessments = ({ rawAssessments, axes, allowed, errors }) => {
  const xLevelIds = new Set(axes.x.levels.map((level) => level.id));
  const yLevelIds = new Set(axes.y.levels.map((level) => level.id));
  return toArray(rawAssessments).slice(0, LIMITS.riskAssessments).map((assessment, index) => {
    if (!isObj(assessment)) return null;
    const label = cleanText(assessment.label || assessment.category || assessment.name || assessment.title, LIMITS.labelChars);
    const summary = cleanText(assessment.summary || assessment.description || assessment.rationale || assessment.evidence);
    const xLevelId = slugId(assessment.xLevelId || assessment.x || assessment.columnLevelId || assessment.likelihood, '');
    const yLevelId = slugId(assessment.yLevelId || assessment.y || assessment.rowLevelId || assessment.impact, '');
    if (!label || !summary || !xLevelIds.has(xLevelId) || !yLevelIds.has(yLevelId)) {
      errors.push(`invalid assessment ${index + 1}`);
      return null;
    }
    return {
      id: slugId(assessment.id || label, `assessment_${index + 1}`),
      label,
      summary,
      xLevelId,
      yLevelId,
      ...normalizeSourceFields(assessment, allowed, errors),
    };
  }).filter(Boolean);
};

const normalizeDynamicRiskMatrix = (rawSection, allowed) => {
  const errors = [];
  const axes = normalizeRiskAxes(rawSection.axes);
  if (!axes) return defaultSection('riskMatrix', 'AI generation returned invalid risk matrix axes.');
  const assessments = normalizeRiskAssessments({
    rawAssessments: rawSection.assessments,
    axes,
    allowed,
    errors,
  });
  if (errors.length) return defaultSection('riskMatrix', `AI generation returned invalid risk matrix data: ${errors.slice(0, 4).join(', ')}.`);
  if (!assessments.length) return defaultSection('riskMatrix', 'AI generation did not return renderable risk matrix assessments.');
  return {
    available: true,
    axes,
    assessments,
    categories: [],
    comments: [],
    heatmap: {},
    scenarioLinks: [],
  };
};

const normalizeLegacyRiskMatrix = (rawSection, allowed) => {
  const errors = [];
  const rawHeatmap = isObj(rawSection.heatmap) ? rawSection.heatmap : {};
  const categoryEntries = [];
  const heatmap = {};
  const assessments = [];
  toArray(rawSection.categories).slice(0, LIMITS.riskCategories).forEach((category, index) => {
    if (!isObj(category)) return;
    const label = cleanText(category.label || category.name || category.title, LIMITS.labelChars);
    if (!label) return;
    const id = slugId(category.id || label, `risk_${index + 1}`);
    const heat = isObj(rawHeatmap[id]) ? rawHeatmap[id] : {};
    const likelihood = normalizeSeverity(category.likelihood || heat.likelihood);
    const impact = normalizeSeverity(category.impact || heat.impact);
    if (!likelihood || !impact) {
      errors.push(`invalid severity for ${id}`);
      return;
    }
    const description = cleanText(category.description || category.summary || category.rationale);
    const sourceFields = normalizeSourceFields(category, allowed, errors);
    categoryEntries.push({
      id,
      label,
      ...(description ? { description } : {}),
      ...sourceFields,
    });
    assessments.push({
      id,
      label,
      summary: description || label,
      xLevelId: likelihood,
      yLevelId: impact,
      ...sourceFields,
    });
    heatmap[id] = { likelihood, impact };
  });
  const categoryIds = new Set(categoryEntries.map((category) => category.id));
  const comments = toArray(rawSection.comments).slice(0, LIMITS.riskComments).map((comment, index) => {
    if (!isObj(comment)) return null;
    const categoryId = slugId(comment.categoryId || comment.category || comment.id, '');
    if (!categoryId || !categoryIds.has(categoryId)) {
      errors.push(`unknown risk category for comment ${index + 1}`);
      return null;
    }
    const summary = cleanText(comment.summary || comment.comment || comment.description || comment.evidence);
    if (!summary) return null;
    return {
      id: slugId(comment.id || summary, `risk_comment_${index + 1}`),
      categoryId,
      summary,
      ...normalizeSourceFields(comment, allowed, errors),
    };
  }).filter(Boolean);
  if (errors.length) return defaultSection('riskMatrix', `AI generation returned invalid risk matrix data: ${errors.slice(0, 4).join(', ')}.`);
  if (!categoryEntries.length) return defaultSection('riskMatrix', 'AI generation did not return renderable risk likelihood/impact assessments.');
  return {
    available: true,
    axes: DEFAULT_RISK_AXES,
    assessments,
    categories: categoryEntries,
    comments,
    heatmap,
    scenarioLinks: [],
  };
};

const normalizeRiskMatrix = (rawSection, allowed) => {
  if (!isObj(rawSection)) return defaultSection('riskMatrix', 'AI generation did not return risk matrix data.');
  if (isObj(rawSection.axes) || Array.isArray(rawSection.assessments)) return normalizeDynamicRiskMatrix(rawSection, allowed);
  return normalizeLegacyRiskMatrix(rawSection, allowed);
};

const normalizeGeneratedAt = (value) => {
  const parsed = Date.parse(toPrimitiveStr(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '1970-01-01T00:00:00.000Z';
};

const normalizeModel = (model) => cleanText(model, LIMITS.modelChars);

const normalizeSection = ({ key, rawSection, requested, allowed }) => {
  if (!requested.has(key)) return defaultSection(key, `${key} was not requested.`);
  if (key === 'argumentMap') return normalizeArgumentMap(rawSection, allowed);
  if (key === 'atlas') return normalizeAtlas(rawSection, allowed);
  if (key === 'breakdown') return normalizeBreakdown(rawSection, allowed);
  return normalizeRiskMatrix(rawSection, allowed);
};

export const normalizeResultsAnalysisArtifact = ({ value, source = {}, sections = [], generatedAt, model = '' } = {}) => {
  const requestedSections = normalizeSections(sections);
  if (!requestedSections.length) throw new Error('No supported results analysis sections were requested.');
  const requested = new Set(requestedSections);
  const raw = sectionRecord(value);
  const allowed = buildAllowedSourceIds(source);
  const normalizedSections = Object.fromEntries(SECTION_ORDER.map((key) => [
    key,
    normalizeSection({ key, rawSection: raw[key], requested, allowed }),
  ]));
  const anyRequestedAvailable = requestedSections.some((key) => normalizedSections[key]?.available === true);
  if (!anyRequestedAvailable) {
    const reasons = requestedSections.map((key) => normalizedSections[key]?.reason).filter(Boolean).join(' ');
    throw new Error(`Results analysis artifact did not include any renderable requested sections. ${reasons}`.trim());
  }
  const safeModel = normalizeModel(model);
  return {
    generatedAt: normalizeGeneratedAt(generatedAt || value?.generatedAt),
    inputSignature: cleanText(source?.signature || value?.inputSignature, 160),
    kind: ARTIFACT_KIND,
    ...(safeModel ? { model: safeModel } : {}),
    participants: normalizeParticipants(source?.participants),
    sections: normalizedSections,
    source: 'ai-generated',
    version: ARTIFACT_VERSION,
  };
};

export default normalizeResultsAnalysisArtifact;
