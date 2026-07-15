import { ANSWER_VALUES } from './config.mjs';
import { buildReportFingerprint } from './provenance.mjs';
import { validateAnalysisOverlay } from './schema.mjs';

const round = (value, digits = 4) => (
  Number.isFinite(value) ? Number(value.toFixed(digits)) : null
);

const countsFromSummary = (summary = {}) => Object.fromEntries(
  ANSWER_VALUES.map((answer) => [answer, Number(summary.counts?.[answer] || 0)])
);

const validVoteCount = (summary = {}) => ANSWER_VALUES.reduce(
  (sum, answer) => sum + Number(summary.counts?.[answer] || 0),
  0
);

const stanceLabel = (score) => {
  if (!Number.isFinite(score)) return 'no data';
  if (score > 0.25) return 'net support';
  if (score < -0.25) return 'net opposition';
  return 'mixed / unsure';
};

const modelDifference = (participantSummaries = []) => {
  const scores = participantSummaries
    .map((entry) => entry.meanScore)
    .filter((score) => Number.isFinite(score));
  if (scores.length < 2) return scores.length === 1 ? 0 : null;
  return round(Math.max(...scores) - Math.min(...scores));
};

export const ANALYSIS_RISK_MATRIX_CATEGORIES = Object.freeze([
  { name: 'Safety', subcategories: ['Alignment', 'Evaluations', 'Red Teaming', 'Containment'] },
  { name: 'Capabilities', subcategories: ['Scaling', 'Agents', 'Reasoning', 'Multimodal'] },
  { name: 'Governance', subcategories: ['Regulation', 'Licensing', 'International', 'Liability'] },
  { name: 'Open Source', subcategories: ['Weight Release', 'Democratization', 'Safety Tradeoffs'] },
  { name: 'Labor', subcategories: ['Automation', 'Productivity', 'Inequality', 'Retraining'] },
  { name: 'Security', subcategories: ['Cyber Offense', 'Biosecurity', 'Surveillance', 'Deepfakes'] },
  { name: 'Military', subcategories: ['Autonomous Weapons', 'Escalation', 'Arms Control'] },
  { name: 'Infra', subcategories: ['Compute', 'Energy', 'Data Centers', 'Supply Chain'] },
  { name: 'Discourse', subcategories: ['Media', 'Narratives', 'Trust', 'Misinformation'] },
  { name: 'Crypto', subcategories: ['ZK Proofs', 'Trustless Agreements', 'Post-Quantum', 'Key Management'] },
]);

const aggregateRiskCellTargets = () => ANALYSIS_RISK_MATRIX_CATEGORIES.flatMap((categoryY) => (
  ANALYSIS_RISK_MATRIX_CATEGORIES
    .filter((categoryX) => categoryX.name !== categoryY.name)
    .map((categoryX) => ({
      id: `${categoryX.name}_vs_${categoryY.name}`,
      type: 'aggregate',
      categoryX: categoryX.name,
      categoryY: categoryY.name,
      expectedOverlayFields: [
        'summary',
        'opportunities',
        'risks',
        'linkedQuestionIds',
        'linkedTopicIds',
        'scenarios',
        'confidence',
      ],
      scenarioSchema: {
        id: 'scenario-id',
        atlasNodeId: 'topic-or-atlas-node-id',
        atlasNodeLabel: 'Topic or atlas node label',
        title: 'Short scenario title',
        summary: 'One report-ready sentence about the overlap.',
        valence: 'risk | opportunity | mixed',
        confidence: 'low | medium | high',
        timeHorizon: 'Optional time horizon',
        primaryMechanism: 'Why this scenario matters for the cell.',
        historicalAnchors: [
          { name: 'Public figure, institution, or source label', role: 'Optional role or relevance note', avatar: '' },
        ],
      },
    }))
));

const buildQuestionSummaries = (report = {}) => {
  const participants = Array.isArray(report.participants) ? report.participants : [];
  const questions = Array.isArray(report.questions) ? report.questions : [];
  const byQuestion = report.polisReport?.byQuestion || {};
  const byModelQuestion = report.polisReport?.byModelQuestion || {};

  return questions.map((question) => {
    const participantStances = participants.map((participant) => {
      const summary = byModelQuestion[participant.id]?.[question.id] || {};
      return {
        participantId: participant.id,
        participantLabel: participant.label || participant.id,
        meanScore: Number.isFinite(summary.meanScore) ? summary.meanScore : null,
        stanceLabel: stanceLabel(summary.meanScore),
        counts: countsFromSummary(summary),
        validResponses: validVoteCount(summary),
        invalid: Number(summary.invalid || 0),
      };
    });
    const aggregate = byQuestion[question.id] || {};
    return {
      id: question.id,
      prompt: question.prompt || question.id,
      topic: question.topic || 'uncategorized',
      subtopics: Array.isArray(question.subtopics) ? question.subtopics : [],
      disagreementAxis: question.disagreementAxis || '',
      agreeMeans: question.agreeMeans || '',
      sourceAnchors: Array.isArray(question.sourceAnchors) ? question.sourceAnchors : [],
      agentVillageAnchors: Array.isArray(question.agentVillageAnchors) ? question.agentVillageAnchors : [],
      riskFacets: Array.isArray(question.riskFacets) ? question.riskFacets : [],
      whyIncluded: question.whyIncluded || '',
      aggregate: {
        meanScore: Number.isFinite(aggregate.meanScore) ? aggregate.meanScore : null,
        stanceLabel: stanceLabel(aggregate.meanScore),
        counts: countsFromSummary(aggregate),
        validResponses: validVoteCount(aggregate),
        invalid: Number(aggregate.invalid || 0),
        winningResponseConsistency: aggregate.winningResponseConsistency || null,
      },
      modelDifference: modelDifference(participantStances),
      participantStances,
    };
  });
};

const buildIssueAreaTargets = (report = {}, questionSummaries = []) => {
  const questionById = new Map(questionSummaries.map((question) => [question.id, question]));
  return (Array.isArray(report.debateAtlas?.topicCircles) ? report.debateAtlas.topicCircles : []).map((topic) => {
    const questionIds = Array.isArray(topic.questionIds) ? topic.questionIds : [];
    const linkedQuestions = questionIds.map((id) => questionById.get(id)).filter(Boolean);
    const suggestedTags = Array.from(new Set(linkedQuestions.flatMap((question) => [
      ...(Array.isArray(question.subtopics) ? question.subtopics : []),
      ...(Array.isArray(question.riskFacets) ? question.riskFacets : []),
    ]))).slice(0, 8);
    const differenceScores = linkedQuestions
      .map((question) => question.modelDifference)
      .filter(Number.isFinite);
    const consistencyScores = linkedQuestions
      .map((question) => question.aggregate?.winningResponseConsistency?.rate)
      .filter(Number.isFinite);
    return {
      id: topic.id,
      label: topic.label || topic.id,
      questionIds,
      suggestedTags,
      averageStance: Number.isFinite(topic.averageStance) ? topic.averageStance : null,
      averageModelDifference: differenceScores.length
        ? round(differenceScores.reduce((sum, value) => sum + value, 0) / differenceScores.length)
        : null,
      averageWinningResponseConsistency: consistencyScores.length
        ? round(consistencyScores.reduce((sum, value) => sum + value, 0) / consistencyScores.length)
        : null,
    };
  });
};

export const buildSecondPassAnalysisInput = (report = {}) => {
  const questionSummaries = buildQuestionSummaries(report);
  const inputReportHash = buildReportFingerprint(report);
  return {
    schemaVersion: 1,
    kind: 'ai_discourse_bench_second_pass_analysis_input',
    generatedAt: new Date().toISOString(),
    benchmarkId: report.benchmarkId || null,
    inputReportHash,
    title: report.title || 'AI Discourse Benchmark',
    sourceReport: {
      generatedAt: report.generatedAt || null,
      mode: report.mode || 'self',
      personaId: report.personaId || null,
      counts: report.counts || {},
    },
    stanceScale: {
      '-1': 'net opposition to the statement',
      '0': 'mixed, unsure, or no clear directional stance',
      '1': 'net support for the statement',
    },
    participants: (Array.isArray(report.participants) ? report.participants : []).map((participant) => ({
      id: participant.id,
      label: participant.label || participant.id,
      model: participant.model || '',
      provider: participant.provider || '',
      traits: participant.traits || {},
      summary: {
        meanScore: Number.isFinite(participant.summary?.meanScore) ? participant.summary.meanScore : null,
        stanceLabel: stanceLabel(participant.summary?.meanScore),
        counts: countsFromSummary(participant.summary),
        validResponses: validVoteCount(participant.summary),
        invalid: Number(participant.summary?.invalid || 0),
      },
    })),
    questions: questionSummaries,
    debateAtlas: {
      currentTopicCircles: report.debateAtlas?.topicCircles || [],
      issueAreaTargets: buildIssueAreaTargets(report, questionSummaries),
      inputs: report.rawMaterial?.debateAtlasInputs || [],
      requestedOutputs: {
        topicCircles: 'Replace or enrich currentTopicCircles with AI-generated debate topics, labels, summaries, and linked question ids.',
        issueAreas: 'Generate modal-ready issue analysis keyed to topic ids, with tags, grounded findings, linked questions, and optional freeform titled sections.',
        topicEdges: 'Optional links between topic ids with relation labels such as reinforces, conflicts, or depends-on.',
        compasses: 'Optional 2-axis maps with x/y axis labels, endpoint labels, and topic/question placements.',
      },
    },
    riskMatrix: {
      categories: ANALYSIS_RISK_MATRIX_CATEGORIES,
      aggregateCellTargets: aggregateRiskCellTargets(),
      inputs: report.rawMaterial?.riskMatrixInputs || [],
      requestedOutputs: {
        cells: 'Generate popup-ready analysis for aggregate cell ids such as Capabilities_vs_Labor.',
        subcells: 'Optionally generate deeper subcell ids in Category.Subcategory.Category.Subcategory form.',
        links: 'Use linkedQuestionIds and linkedTopicIds so popups can point back into the report and Debate Map.',
        scenarios: 'Optional atlas scenario cards for risk cells where a generated topic/compass overlap clarifies the interaction.',
      },
    },
    outputSchema: {
      schemaVersion: 1,
      kind: 'ai_discourse_bench_analysis_overlay',
      provenance: {
        generatedBy: 'analysis-model-or-pipeline-name',
        model: 'provider/model-id',
        promptVersion: 'analysis-overlay-v1',
        inputReportHash,
        generatedAt: 'ISO-8601 timestamp',
      },
      aiAnalysis: {
        executiveSummary: 'string',
        strongestConsensus: ['question id or short claim'],
        sharpestDisagreements: ['question id or short claim'],
        caveats: ['string'],
      },
      debateAtlas: {
        topicCircles: [
          {
            id: 'topic-id',
            label: 'Topic label',
            summary: 'Why this topic matters in the benchmark results.',
            questionIds: ['aidb_0001'],
            averageStance: 0,
          },
        ],
        topicEdges: [
          {
            source: 'topic-id',
            target: 'topic-id',
            relation: 'conflicts',
            summary: 'string',
          },
        ],
        issueAreas: [
          {
            id: 'topic-id',
            title: 'Optional issue-area title',
            summary: 'Report-ready overview grounded in benchmark results.',
            tags: ['governance', 'evaluation'],
            keyTensions: ['short grounded tension'],
            pointsOfAgreement: ['short convergence finding'],
            pointsOfDisagreement: ['short divergence finding'],
            openQuestions: ['unresolved question'],
            implications: ['bounded implication'],
            linkedQuestionIds: ['aidb_0001'],
            confidence: 'low | medium | high',
            analysisSections: [
              {
                title: 'Freeform section title',
                body: 'One or more concise paragraphs.',
                bullets: ['optional bullet'],
                linkedQuestionIds: ['aidb_0001'],
              },
            ],
          },
        ],
        compasses: [
          {
            id: 'compass-id',
            title: 'Compass title',
            xAxis: { left: 'left endpoint', right: 'right endpoint' },
            yAxis: { bottom: 'bottom endpoint', top: 'top endpoint' },
            placements: [{ id: 'topic-or-question-id', x: 0, y: 0, summary: 'string' }],
          },
        ],
      },
      riskMatrix: {
        cells: {
          Capabilities_vs_Labor: {
            summary: 'Popup summary for this matrix cell.',
            opportunities: ['opportunity bullet'],
            risks: ['risk bullet'],
            linkedQuestionIds: ['aidb_0001'],
            linkedTopicIds: ['topic-id'],
            scenarios: [
              {
                id: 'scenario-id',
                atlasNodeId: 'topic-id',
                atlasNodeLabel: 'Topic label',
                title: 'Scenario title',
                summary: 'Scenario summary.',
                valence: 'risk',
                confidence: 'medium',
                timeHorizon: '2-5 years',
                primaryMechanism: 'Why this scenario matters.',
                historicalAnchors: [
                  { name: 'Anchor label', role: 'Optional relevance note', avatar: '' },
                ],
              },
            ],
            confidence: 'medium',
          },
        },
      },
    },
  };
};

export const attachAnalysisOverlay = (report = {}, overlay = {}) => {
  const errors = validateAnalysisOverlay(overlay, {
    questionIds: new Set((report.questions || []).map((question) => question.id)),
    topicIds: new Set((report.debateAtlas?.topicCircles || []).map((topic) => topic.id)),
  });
  const expectedHash = buildReportFingerprint(report);
  if (overlay?.provenance?.inputReportHash && overlay.provenance.inputReportHash !== expectedHash) {
    errors.push(`provenance.inputReportHash does not match source report ${expectedHash}`);
  }
  if (errors.length) {
    throw new Error(`analysis overlay validation failed:\n- ${errors.join('\n- ')}`);
  }
  return {
    ...report,
    analysisOverlay: overlay,
  };
};
