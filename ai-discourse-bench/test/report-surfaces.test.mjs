import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

import { buildResultsReport } from '../src/scoring.mjs';
import { renderHtmlReport } from '../src/render-html.mjs';
import { limitQuestionBank, mergeModelRosters, mergeRunsFiles } from '../src/report-inputs.mjs';
import { buildContextEnginePolisExport } from '../src/ce-export.mjs';

const readJson = async (url) => JSON.parse(await fs.readFile(url, 'utf8'));

test('report preserves raw atlas and risk-matrix material', async () => {
  const questionBank = await readJson(new URL('../data/question-bank.sample.json', import.meta.url));
  const modelRoster = await readJson(new URL('../data/model-roster.sample.json', import.meta.url));
  const runsFile = {
    schemaVersion: 1,
    benchmarkId: questionBank.benchmarkId,
    mode: 'self',
    runs: [],
  };

  const report = buildResultsReport({ questionBank, modelRoster, runsFile });
  assert.equal(report.questions.length, 200);
  assert.ok(report.debateAtlas.topicCircles.length >= 20);
  assert.ok(report.riskMatrix.facets.length > 0);
  assert.equal(report.rawMaterial.debateAtlasInputs.length, 200);
  assert.equal(report.rawMaterial.riskMatrixInputs.length, 200);

  const html = renderHtmlReport(report);
  const runtimeScript = html.match(/<script>\s*(\(function \(\) \{[\s\S]*?\}\(\)\);)\s*<\/script>/)?.[1];
  assert.ok(runtimeScript, 'expected a self-contained report runtime');
  assert.doesNotThrow(() => new vm.Script(runtimeScript));
  assert.match(html, /data-testid="ce-session-results-view-nav"/);
  assert.match(html, /Consensus and Difference/);
  assert.match(html, /All Questions/);
  assert.match(html, /List of Participants/);
  assert.match(html, /Risk Matrix/);
  assert.match(html, /class="nodeLabel packedNodeLabel alwaysVisible" style="font-size:[^"]+">\s*AI R&amp;D Automation\s*<\/div>/);
  assert.match(html, /data-ce-node-id="ai-rd-automation"/);
  assert.match(html, /id="debate-atlas-ai-rd-automation"[\s\S]*?data-ce-atlas-open="ai-rd-automation"/);
  assert.match(html, /data-ce-atlas-tag-filter/);
  assert.match(html, /data-ce-atlas-tag-option/);
  assert.match(html, /data-ce-atlas-tag-summary>All tags/);
  assert.match(html, /data-ce-atlas-tag-clear>Clear/);
  assert.match(html, /Match any selected/);
  assert.match(html, /data-ce-atlas-sort/);
  assert.match(html, /data-ce-atlas-issue-template/);
  assert.match(html, /data-ce-atlas-issue-modal hidden role="dialog" aria-modal="true"/);
  assert.doesNotMatch(html, /Measured view\.|atlasIssueAnalysisNotice/);
  assert.doesNotMatch(html, /benchmark statements? map this issue area/);
  assert.match(html, /data-ce-atlas-question-distribution/);
  assert.match(html, /data-ce-atlas-question-vote-bar/);
  assert.doesNotMatch(html, /data-ce-atlas-model-roster/);
  assert.doesNotMatch(html, /Answer coverage/);
  assert.match(html, /Response direction/);
  assert.match(html, /No model answers/);
  assert.match(html, /aria-expanded="true"\s+aria-controls="ce-atlas-modal-ai-rd-automation-questions-body"/);
  assert.match(html, /id="ce-atlas-modal-ai-rd-automation-questions-body" data-ce-atlas-modal-collapse-body>/);
  assert.match(html, /function updateAtlasBrowse\(\)/);
  assert.match(html, /function getSelectedAtlasTags\(\)/);
  assert.match(html, /selectedTags\.some\(function \(tag\) \{ return nodeTags\.indexOf\(tag\) !== -1; \}\)/);
  assert.match(html, /function computeAtlasBrowseSlots\(nodes\)/);
  assert.match(html, /var useOriginalLayout = selectedTags\.length === 0 && sortMode === 'atlas';/);
  assert.match(html, /if \(matchingTagInput\) matchingTagInput\.checked = true;/);
  assert.match(html, /function openAtlasIssueModal\(topicId, options\)/);
  assert.match(html, /function syncAtlasIssueModalWithHash\(\)/);
  assert.match(html, /data-ce-tag-modal hidden role="dialog" aria-modal="true"/);
  assert.match(html, /function questionsForTag\(tag\)/);
  assert.match(html, /function openTagModal\(tag, options\)/);
  assert.match(html, /function syncTagModalWithHash\(\)/);
  assert.match(html, /body\[data-ce-tag-modal-open="true"\] \{ overflow: hidden; \}/);
  assert.doesNotMatch(html, /href="\/tag\//);
  assert.match(html, /body\[data-ce-atlas-modal-open="true"\] \{ overflow: hidden; \}/);
  assert.match(html, /\.atlasIssueModalOverlay \{ position: fixed; inset: 0; z-index: 2000;/);
  assert.match(html, /--topic-mobile-font-size:[0-9.]+px;/);
  assert.match(html, /\.debateMap \.atlasNode\.packedAtlasNode \.packedNodeLabel \{ font-size: var\(--topic-mobile-font-size, 9px\) !important; line-height: 1\.04; letter-spacing: 0; overflow-wrap: normal; word-break: normal; hyphens: none; \}/);
  assert.doesNotMatch(html, /\.debateMap \.atlasNode\.packedAtlasNode \.packedNodeLabel \{ overflow-wrap: anywhere; \}/);
  assert.match(html, /class="nodeLabel packedNodeLabel alwaysVisible" style="font-size:[^"]+">\s*Regulation and Coordination\s*<\/div>/);
  assert.match(html, /data-ce-atlas-topic-title="Regulation and Coordination"/);
  assert.match(html, /class="nodeLabel packedNodeLabel alwaysVisible" style="font-size:[^"]+">\s*Copyright and Creative Markets\s*<\/div>/);
  assert.doesNotMatch(html, /Regulation And Coordination/);
  assert.doesNotMatch(html, /Copyright And Creative Markets/);
  assert.match(html, /id="snapshot-json"[\s\S]*?class="[^"]*ce-report-section ce-results-mode-pane aidb-mode-pane aidb-raw-results-modal-pane[^"]*"/);
  assert.match(html, /Embedded Snapshot JSON/);
  assert.match(html, /AI Analysis Input/);
  assert.match(html, /id="ce-ai-discourse-bench-analysis-input"/);
  assert.match(html, /data-ce-download-analysis-input/);
  assert.match(html, /ai-discourse-bench-ai-analysis-input\.json/);
  assert.match(html, /<summary>AI Analysis Input JSON<\/summary>/);
  assert.match(html, /ai_discourse_bench_second_pass_analysis_input/);
  assert.equal((html.match(/data-question-has-votes="false"/g) || []).length, 200);
  assert.match(html, /class="beeswarmPoint beeswarmPointNoData"/);
  assert.match(html, /class="beeswarmCircle beeswarmCircleNoData"/);
  assert.match(html, /No model responses yet/);
  assert.match(html, /\.beeswarmCircleNoData \{ fill: #cbd5e1; opacity: 0\.42; stroke: #94a3b8; stroke-width: 1; \}/);
});

test('persona reports visibly identify the weights-only public-figure mode', async () => {
  const questionBank = limitQuestionBank(
    await readJson(new URL('../data/question-bank.sample.json', import.meta.url)),
    1
  );
  const modelRoster = await readJson(new URL('../data/model-roster.sample.json', import.meta.url));
  const report = buildResultsReport({
    questionBank,
    modelRoster,
    runsFile: {
      schemaVersion: 1,
      benchmarkId: questionBank.benchmarkId,
      mode: 'persona',
      personaId: 'ada-lovelace',
      manifest: {
        personaProfile: {
          id: 'ada-lovelace',
          label: 'Ada Lovelace',
          profileType: 'public-figure-weights-only',
        },
      },
      runs: [],
    },
  });
  const html = renderHtmlReport(report);
  assert.match(html, /Persona mode: Ada Lovelace \(weights-only\)/);
  assert.doesNotMatch(html, /Persona lens:/);
  assert.doesNotMatch(html, /evidence through/);
  assert.match(html, /data-benchmark-persona="ada-lovelace"/);
});

test('publication intro explains the benchmark and does not overstate preview artifacts', async () => {
  const questionBank = limitQuestionBank(
    await readJson(new URL('../data/question-bank.sample.json', import.meta.url)),
    1
  );
  const fullRoster = await readJson(new URL('../data/model-roster.sample.json', import.meta.url));
  const modelRoster = { ...fullRoster, models: fullRoster.models.slice(0, 2) };
  const questionId = questionBank.questions[0].id;
  const runs = modelRoster.models.flatMap((model) => [
    {
      modelId: model.id,
      questionId,
      polarity: 'canonical',
      repeatIndex: 1,
      normalizedAnswer: 'Agree',
    },
    {
      modelId: model.id,
      questionId,
      polarity: 'reversed',
      repeatIndex: 1,
      normalizedAnswer: 'Agree',
    },
  ]);
  const report = buildResultsReport({
    questionBank,
    modelRoster,
    runsFile: {
      schemaVersion: 1,
      benchmarkId: questionBank.benchmarkId,
      mode: 'self',
      repeats: 1,
      runs,
    },
  });
  const html = renderHtmlReport(report);
  const previewNotice = html.match(/<div class="aidb-preview-notice"[\s\S]*?<\/div>/)?.[0] || '';
  const introStart = html.indexOf('data-ce-benchmark-intro');
  const resultsStart = html.indexOf('data-ce-results-section');
  const resultsHeaderStart = html.indexOf('<div class="sectionHeaderRow">', resultsStart);
  const miniSectionStart = html.indexOf('<div class="miniSectionContent">', resultsHeaderStart);
  const provenanceStart = html.indexOf('<p class="aidb-benchmark-provenance">', introStart);
  const introHeadingStart = html.indexOf('<h1 id="aidb-benchmark-intro-title">', introStart);

  assert.ok(introStart >= 0);
  assert.ok(resultsStart >= 0 && introStart < resultsStart);
  assert.ok(provenanceStart > introStart && provenanceStart < introHeadingStart);
  assert.match(html, /<p class="aidb-benchmark-provenance"><span class="aidb-benchmark-technical-name">model-opinions-bench<\/span><span class="aidb-benchmark-generated">Generated: [^<]+<\/span><\/p>/);
  assert.match(html, /<button type="button" class="aidb-benchmark-download pdfIgnore" data-ce-benchmark-download title="Download benchmark report" aria-label="Download benchmark report">[\s\S]*?data-icon="download"[\s\S]*?<\/button>/);
  assert.match(html, /window\.parent\.postMessage\(\{ type: 'ce-benchmark-download' \}, '\*'\)/);
  assert.match(html, /event\.data\.type === 'ce-benchmark-config'/);
  assert.match(html, /if \(hash === '#report'\) \{[\s\S]*?setReportViewMode\('report', \{ scroll: false \}\);[\s\S]*?scrollToReportViewTarget\(benchmarkIntro\);/);
  assert.match(html, /setReportViewMode\(initialMode, \{ scroll: initialMode !== 'report' \}\);/);
  assert.match(html, /configuredAnchor\.download = benchmarkDownloadFilename/);
  assert.match(html, /standaloneAnchor\.download = 'model-opinions-bench-report\.html'/);
  assert.doesNotMatch(html, /<p class="aidb-benchmark-provenance">Benchmark ID:/);
  assert.ok(resultsHeaderStart > resultsStart);
  assert.ok(miniSectionStart > resultsHeaderStart);
  assert.match(html, /<meta name="description" content="A Context Engine AI opinions benchmark mapping agreement, disagreement, uncertainty, and wording sensitivity across 1 corpus-grounded question answered by 2 model participants\." \/>/);
  assert.match(html, /<meta name="robots" content="noindex,nofollow" \/>/);
  assert.match(html, /data-ce-benchmark-publication-status="preview"/);
  assert.doesNotMatch(html, /aidb-publication-status/);
  assert.doesNotMatch(html, />Publication preview<\/span>/);
  assert.match(html, /<h1 id="aidb-benchmark-intro-title">Context Engine: AI Opinions Benchmark<\/h1>/);
  assert.doesNotMatch(html, /aidb-benchmark-kicker/);
  assert.doesNotMatch(html, /aidb-benchmark-method-summary/);
  assert.doesNotMatch(html, /aidb-benchmark-reading-guide/);
  assert.doesNotMatch(html, /How to read these results/);
  assert.doesNotMatch(html, /aidb-publication-note/);
  assert.doesNotMatch(html, /Publication status:/);
  assert.match(html, /questions about AI futures and policy, drawn from or implied by the OSS <strong>ai-discourse-corpus<\/strong>\. The same benchmark method can be applied to any topic\. An optional quadratic-importance mode gives every model the same credit budget to prioritize questions; those allocations determine Debate Map prominence when present\./);
  assert.match(html, /<div class="aidb-benchmark-topic-fact"><dt><label for="aidb-benchmark-topic">Benchmark topic<\/label><\/dt><dd><select id="aidb-benchmark-topic" aria-describedby="aidb-benchmark-topic-description" data-ce-benchmark-topic-selector><option value="ai-futures-policy" selected>AI Futures &amp; Policy<\/option><\/select><\/dd><\/div>/);
  assert.doesNotMatch(html, /class="aidb-benchmark-topic-control"/);
  assert.match(html, /<div class="aidb-benchmark-fact-number"><dt>Questions<\/dt><dd>1<\/dd><\/div>/);
  assert.match(html, /<div class="aidb-benchmark-fact-number"><dt>Model participants<\/dt><dd>2<\/dd><\/div>/);
  assert.match(html, /<dt>Mode<button type="button" class="tooltip aidb-benchmark-fact-tooltip pdfIgnore" aria-label="About benchmark mode" aria-describedby="aidb-mode-tooltip-copy" data-ce-mode-tooltip>[\s\S]*?data-icon="question-circle"[\s\S]*?<span class="tooltiptext" id="aidb-mode-tooltip-copy" role="tooltip">Persona mode asks each model to predict how a named historical or contemporary public figure would answer, using only information in the model's weights\.<\/span><\/button><\/dt><dd>Models answer as themselves<\/dd>/);
  assert.doesNotMatch(html, /<dt>Lens(?:<|\s)/);
  assert.doesNotMatch(html, /<dt>Repeat runs/);
  assert.doesNotMatch(html, /data-ce-repeat-runs-tooltip/);
  assert.doesNotMatch(html, /<dt>Question bank<\/dt>/);
  assert.match(html, /<strong>Development preview\.<\/strong>/);
  assert.match(html, /The measurements below are useful for testing the report and methodology, but this is not an official benchmark release\./);
  assert.match(html, /<summary>Why this is a development preview<\/summary>/);
  assert.match(html, /<strong>Question bank:<\/strong> Development Seed\. An official release requires a separately reviewed and validated bank\./);
  assert.match(html, /<strong>Repeat depth:<\/strong> The imported artifacts declare 1 completed run per wording; this bank requires 10 for release\./);
  assert.match(html, /<strong>Current model coverage:<\/strong> 2 of 2 model participants answered every question in both wordings with no invalid responses in this run set\./);
  assert.doesNotMatch(html, /<strong>Wording sensitivity:<\/strong>/);
  assert.doesNotMatch(previewNotice, /coverage=1, paired=1, completion=0, valid=1/);
  assert.match(html, /coverage=1, paired=1, completion=0, valid=1/);

  const wordingSensitiveHtml = renderHtmlReport({
    ...report,
    polisReport: {
      ...report.polisReport,
      byQuestion: {
        ...report.polisReport.byQuestion,
        [questionId]: {
          ...report.polisReport.byQuestion[questionId],
          wordingSensitivity: {
            ...report.polisReport.byQuestion[questionId].wordingSensitivity,
            meanAbsoluteShift: 0.5,
          },
        },
      },
    },
  });
  assert.match(wordingSensitiveHtml, /<strong>Wording sensitivity:<\/strong> 1 of 1 questions changed by at least 0\.50 on the normalized -1 to \+1 answer scale when original and reversed wording were compared\. These items require wording review before release\./);

  const releaseHtml = renderHtmlReport({
    ...report,
    status: 'release-ready',
    integrity: {
      ...report.integrity,
      releaseReady: true,
      bankReleaseStatus: 'validated',
      bankValidated: true,
      repeatConfigurationValid: true,
      declaredRepeatValues: [10],
    },
  });
  assert.match(releaseHtml, /<meta name="robots" content="index,follow" \/>/);
  assert.match(releaseHtml, /data-ce-benchmark-publication-status="release-ready"/);
  assert.doesNotMatch(releaseHtml, /aidb-publication-status/);
  assert.doesNotMatch(releaseHtml, />Release-ready result<\/span>/);
  assert.doesNotMatch(releaseHtml, /<dt>Repeat runs/);
  assert.doesNotMatch(releaseHtml, /<dt>Question bank<\/dt>/);
  assert.doesNotMatch(releaseHtml, /aidb-publication-note/);
  assert.doesNotMatch(releaseHtml, /data-ce-benchmark-preview/);

  const hostileTitle = '<img src=x onerror=alert(1)>';
  const hostileHtml = renderHtmlReport({ ...report, title: hostileTitle });
  assert.match(hostileHtml, /<meta property="og:title" content="Context Engine: AI Opinions Benchmark" \/>/);
  assert.match(hostileHtml, /<title>Context Engine: AI Opinions Benchmark - Results Report<\/title>/);
  assert.match(hostileHtml, /<h1 id="aidb-benchmark-intro-title">Context Engine: AI Opinions Benchmark<\/h1>/);
  assert.doesNotMatch(hostileHtml, /<img src=x onerror=alert\(1\)>/);
});

test('quadratic importance allocations control Debate Map prominence without changing stance results', async () => {
  const questionBank = {
    benchmarkId: 'importance-report',
    runPlan: { repeatsPerPolarity: 1 },
    questions: [
      { id: 'q1', canonicalPrompt: 'Governance matters.', reversedPrompt: 'Governance does not matter.', topic: 'governance' },
      { id: 'q2', canonicalPrompt: 'Labor matters.', reversedPrompt: 'Labor does not matter.', topic: 'labor' },
    ],
  };
  const modelRoster = {
    models: [
      { id: 'model-a', label: 'Model A', model: 'model-a', provider: 'local', traits: {} },
      { id: 'model-b', label: 'Model B', model: 'model-b', provider: 'local', traits: {} },
    ],
  };
  const stanceRuns = modelRoster.models.flatMap((model) => questionBank.questions.flatMap((question) => [
    { modelId: model.id, questionId: question.id, polarity: 'canonical', normalizedAnswer: 'Agree' },
    { modelId: model.id, questionId: question.id, polarity: 'reversed', normalizedAnswer: 'Agree' },
  ]));
  const importanceFile = {
    budget: 25,
    maxAllocations: 2,
    maxVotesPerQuestion: 3,
    repeats: 1,
    runs: [
      { modelId: 'model-a', allocations: [{ questionId: 'q1', votes: 3 }], spentCredits: 9 },
      { modelId: 'model-b', allocations: [{ questionId: 'q1', votes: 3 }, { questionId: 'q2', votes: 1 }], spentCredits: 10 },
    ],
  };
  const report = buildResultsReport({
    questionBank,
    modelRoster,
    runsFile: { repeats: 1, runs: stanceRuns },
    importanceFile,
  });
  assert.equal(report.importance.available, true);
  assert.equal(report.importance.byQuestion.q1.meanVotes, 3);
  assert.equal(report.polisReport.byQuestion.q1.meanScore, 1);
  assert.equal(report.debateAtlas.sizeMetric, 'quadratic-importance');
  assert.equal(report.debateAtlas.topicCircles.find((topic) => topic.id === 'governance').importanceVotes, 3);
  assert.equal(report.debateAtlas.topicCircles.find((topic) => topic.id === 'labor').importanceVotes, 0.5);

  const html = renderHtmlReport(report);
  assert.match(html, /Circle prominence reflects equal-budget quadratic importance allocations from model participants/);
  assert.match(html, /<option value="importance">Most important<\/option>/);
  assert.match(html, /data-ce-atlas-importance="3"/);
  assert.match(html, /data-ce-atlas-importance="0\.5"/);
  assert.match(html, /if \(sortMode === 'importance'\)/);
  assert.match(html, /of allocated importance/);
});

test('participant opinion groups use client-style hulls and pair connectors', async () => {
  const questionBank = limitQuestionBank(
    await readJson(new URL('../data/question-bank.sample.json', import.meta.url)),
    1
  );
  const modelRoster = {
    schemaVersion: 1,
    models: ['a', 'b', 'c', 'd'].map((id) => ({
      id: `model-${id}`,
      label: `Model ${id.toUpperCase()}`,
      model: `provider/model-${id}`,
      provider: 'mock',
      traits: {},
    })),
  };
  const runsFile = {
    schemaVersion: 1,
    benchmarkId: questionBank.benchmarkId,
    mode: 'self',
    runs: modelRoster.models.map((model, index) => ({
      modelId: model.id,
      questionId: questionBank.questions[0].id,
      polarity: 'canonical',
      normalizedAnswer: index < 2 ? 'Agree' : 'Disagree',
    })),
  };
  const report = buildResultsReport({ questionBank, modelRoster, runsFile });
  report.participants.forEach((participant) => {
    participant.coverage.eligibleForSimilarity = true;
  });
  report.polisReport.similarityMatrix = {
    'model-a': { 'model-a': 1, 'model-b': 0.9, 'model-c': 0.5, 'model-d': 0.2 },
    'model-b': { 'model-a': 0.9, 'model-b': 1, 'model-c': 0.3, 'model-d': 0.6 },
    'model-c': { 'model-a': 0.5, 'model-b': 0.3, 'model-c': 1, 'model-d': 0.8 },
    'model-d': { 'model-a': 0.2, 'model-b': 0.6, 'model-c': 0.8, 'model-d': 1 },
  };
  report.participantGraph.nodes = report.participants.map((participant) => ({
    id: participant.id,
    label: participant.label,
    opinionGroup: 0,
  }));

  const hullHtml = renderHtmlReport(report);
  assert.match(hullHtml, /<path\s+class="graph-outline graph-group-hull"/);
  assert.match(hullHtml, /class="graph-outline graph-group-hull"[\s\S]*?d="M[^\"]+ L[^\"]+ Z"/);
  assert.doesNotMatch(hullHtml, /<ellipse\s+class="graph-outline"/);
  assert.match(hullHtml, /function buildParticipantGraphHull\(points\)/);
  assert.match(hullHtml, /document\.createElementNS\('http:\/\/www\.w3\.org\/2000\/svg', 'path'\)/);

  report.participantGraph.nodes = report.participantGraph.nodes.map((node, index) => ({
    ...node,
    opinionGroup: index < 2 ? 0 : index,
  }));
  const connectorHtml = renderHtmlReport(report);
  assert.match(connectorHtml, /<line\s+class="graph-outline graph-group-connector"/);
  assert.equal((connectorHtml.match(/class="graph-outline graph-group-connector"/g) || []).length, 1);
  assert.doesNotMatch(connectorHtml, /<path\s+class="graph-outline graph-group-hull"/);
  assert.match(connectorHtml, /document\.createElementNS\('http:\/\/www\.w3\.org\/2000\/svg', 'line'\)/);
});

test('report HTML keeps model-generated markup inert', async () => {
  const questionBank = limitQuestionBank(
    await readJson(new URL('../data/question-bank.sample.json', import.meta.url)),
    1
  );
  const modelRoster = {
    schemaVersion: 1,
    models: [{ id: 'model-a', label: 'Model A', model: 'model-a', provider: 'mock', traits: {} }],
  };
  const attack = '</script><script id="aidb-xss">globalThis.__aidbXss=true</script>';
  const report = buildResultsReport({
    questionBank,
    modelRoster,
    runsFile: { repeats: 10, mode: 'self', runs: [] },
  });
  report.title = attack;
  report.questions[0].prompt = attack;
  report.analysisOverlay = {
    riskMatrix: { cells: { Capabilities_vs_Labor: { summary: attack } } },
  };

  const html = renderHtmlReport(report);
  assert.doesNotMatch(html, /<script id="aidb-xss">/);
  assert.match(html, /&lt;\/script&gt;&lt;script id=&quot;aidb-xss&quot;&gt;/);
  assert.match(html, /\\u003C\/script\\u003E\\u003Cscript id=\\"aidb-xss\\"\\u003E/);
});

test('report beeswarm places model-to-model difference on the right axis', async () => {
  const questionBank = limitQuestionBank(
    await readJson(new URL('../data/question-bank.sample.json', import.meta.url)),
    4
  );
  const modelRoster = {
    schemaVersion: 1,
    models: [
      { id: 'model-a', label: 'Model A', model: 'provider/model-a', provider: 'mock', traits: {} },
      { id: 'model-b', label: 'Model B', model: 'provider/model-b', provider: 'mock', traits: {} },
    ],
  };
  const [consensusQuestion, splitQuestion, unsureQuestion, volatileQuestion] = questionBank.questions;
  const runsFile = {
    schemaVersion: 1,
    benchmarkId: questionBank.benchmarkId,
    mode: 'self',
    runs: [
      { modelId: 'model-a', questionId: consensusQuestion.id, polarity: 'canonical', normalizedAnswer: 'Agree' },
      { modelId: 'model-b', questionId: consensusQuestion.id, polarity: 'canonical', normalizedAnswer: 'Agree' },
      { modelId: 'model-a', questionId: splitQuestion.id, polarity: 'canonical', normalizedAnswer: 'Agree' },
      { modelId: 'model-b', questionId: splitQuestion.id, polarity: 'canonical', normalizedAnswer: 'Disagree' },
      { modelId: 'model-a', questionId: unsureQuestion.id, polarity: 'canonical', normalizedAnswer: 'Unsure' },
      { modelId: 'model-b', questionId: unsureQuestion.id, polarity: 'canonical', normalizedAnswer: 'Unsure' },
      { modelId: 'model-a', questionId: volatileQuestion.id, polarity: 'canonical', normalizedAnswer: 'Agree' },
      { modelId: 'model-a', questionId: volatileQuestion.id, polarity: 'canonical', normalizedAnswer: 'Disagree' },
      { modelId: 'model-b', questionId: volatileQuestion.id, polarity: 'canonical', normalizedAnswer: 'Agree' },
      { modelId: 'model-b', questionId: volatileQuestion.id, polarity: 'canonical', normalizedAnswer: 'Disagree' },
    ],
  };

  const report = buildResultsReport({ questionBank, modelRoster, runsFile });
  const html = renderHtmlReport(report);
  const mainBeeswarm = html.match(/<svg width="700" height="250" class="beeswarmSvg" role="img" aria-label="Questions by model disagreement and repeat consistency">([\s\S]*?)<\/svg>/)?.[1] || '';
  const points = new Map();
  for (const match of mainBeeswarm.matchAll(/href="#question-([^"]+)"[\s\S]*?data-ce-beeswarm-point[\s\S]*?<circle class="beeswarmCircle" cx="([^"]+)" cy="([^"]+)" r="5"/g)) {
    points.set(match[1], { x: Number(match[2]), y: Number(match[3]) });
  }

  assert.equal(points.size, 4);
  assert.ok(points.get(consensusQuestion.id).x < 100);
  assert.ok(points.get(splitQuestion.id).x > 600);
  assert.ok(points.get(unsureQuestion.id).x < 100);
  assert.ok(points.get(consensusQuestion.id).y <= 30);
  assert.ok(points.get(splitQuestion.id).y <= 30);
  assert.ok(points.get(unsureQuestion.id).y <= 30);
  assert.ok(points.get(volatileQuestion.id).y >= 100 && points.get(volatileQuestion.id).y <= 115);
  assert.match(html, /data-question-difference="0\.00"/);
  assert.match(html, /data-question-difference="1\.00"/);
  assert.match(html, /data-question-winning-response-consistency="0\.50"/);
  assert.match(html, /data-question-winning-responses="2"/);
  assert.match(html, /data-question-attempted-runs="4"/);
  assert.match(html, /Repeat consistency<\/text>/);
  assert.match(html, /Consensus<\/text>/);
  assert.match(html, /Difference<\/text>/);
  assert.match(html, /data-question-difference-label="Model disagreement"/);
  assert.match(html, /var differenceLabel = point\.dataset\.questionDifferenceLabel \|\| 'Model disagreement';/);
  assert.doesNotMatch(html, /<strong>Model difference:<\/strong>/);
  assert.doesNotMatch(mainBeeswarm, /<title>/);
  assert.match(mainBeeswarm, /aria-label="[^"]+repeat consistency\)"/);
});

test('report beeswarm collision-packs repeated metric pairs into reachable points', async () => {
  const questionBank = limitQuestionBank(
    await readJson(new URL('../data/question-bank.sample.json', import.meta.url)),
    24
  );
  const modelRoster = {
    schemaVersion: 1,
    models: [
      { id: 'model-a', label: 'Model A', model: 'provider/model-a', provider: 'mock', traits: {} },
      { id: 'model-b', label: 'Model B', model: 'provider/model-b', provider: 'mock', traits: {} },
    ],
  };
  const runs = questionBank.questions.flatMap((question) => modelRoster.models.map((entry) => ({
    modelId: entry.id,
    questionId: question.id,
    polarity: 'canonical',
    normalizedAnswer: 'Agree',
  })));

  const report = buildResultsReport({ questionBank, modelRoster, runsFile: { runs } });
  const html = renderHtmlReport(report);
  const coordinates = Array.from(html.matchAll(
    /data-ce-beeswarm-point[\s\S]*?<circle class="beeswarmCircle" cx="([^"]+)" cy="([^"]+)" r="5" \/>/g
  )).map((match) => ({ x: Number(match[1]), y: Number(match[2]) }));

  assert.equal(coordinates.length, 24);
  assert.equal(new Set(coordinates.map(({ x, y }) => `${x},${y}`)).size, 24);
  coordinates.forEach((left, leftIndex) => {
    coordinates.slice(leftIndex + 1).forEach((right) => {
      assert.ok(Math.hypot(left.x - right.x, left.y - right.y) >= 11);
    });
  });
});

test('Breakdown comparison beeswarm plots cohort difference against repeat consistency', async () => {
  const questionBank = limitQuestionBank(
    await readJson(new URL('../data/question-bank.sample.json', import.meta.url)),
    2
  );
  const [splitQuestion, similarQuestion] = questionBank.questions;
  const modelRoster = {
    schemaVersion: 1,
    models: [
      {
        id: 'model-a',
        label: 'Model A',
        model: 'provider/model-a',
        provider: 'mock',
        traits: { parameterClass: 'large' },
      },
      {
        id: 'model-b',
        label: 'Model B',
        model: 'provider/model-b',
        provider: 'mock',
        traits: { parameterClass: 'small' },
      },
      {
        id: 'model-c',
        label: 'Model C',
        model: 'provider/model-c',
        provider: 'mock',
        traits: {},
      },
    ],
  };
  const runs = [
    ...Array.from({ length: 2 }, () => ({
      modelId: 'model-a',
      questionId: splitQuestion.id,
      polarity: 'canonical',
      normalizedAnswer: 'Agree',
    })),
    ...Array.from({ length: 2 }, () => ({
      modelId: 'model-b',
      questionId: splitQuestion.id,
      polarity: 'canonical',
      normalizedAnswer: 'Disagree',
    })),
    {
      modelId: 'model-a',
      questionId: similarQuestion.id,
      polarity: 'canonical',
      normalizedAnswer: 'Agree',
    },
    {
      modelId: 'model-a',
      questionId: similarQuestion.id,
      polarity: 'canonical',
      normalizedAnswer: 'Disagree',
    },
    ...Array.from({ length: 2 }, () => ({
      modelId: 'model-b',
      questionId: similarQuestion.id,
      polarity: 'canonical',
      normalizedAnswer: 'Unsure',
    })),
    ...Array.from({ length: 2 }, () => ({
      modelId: 'model-c',
      questionId: splitQuestion.id,
      polarity: 'canonical',
      normalizedAnswer: 'Agree',
    })),
    ...Array.from({ length: 2 }, () => ({
      modelId: 'model-c',
      questionId: similarQuestion.id,
      polarity: 'canonical',
      normalizedAnswer: 'Disagree',
    })),
  ];
  const report = buildResultsReport({ questionBank, modelRoster, runsFile: { runs } });
  const html = renderHtmlReport(report);
  const chartStart = html.indexOf('<div class="swarmLayoutContainer" data-ce-comparison-beeswarm>');
  const chartEnd = html.indexOf('</svg>', chartStart);

  assert.ok(chartStart >= 0);
  assert.ok(chartEnd > chartStart);
  const chart = html.slice(chartStart, chartEnd + '</svg>'.length);
  const points = new Map(Array.from(chart.matchAll(
    /<a[\s\S]*?data-ce-comparison-beeswarm-point[\s\S]*?<\/a>/g
  )).map((match) => {
    const markup = match[0];
    const id = markup.match(/data-question-id="([^"]+)"/)?.[1];
    const coordinates = markup.match(/<circle class="beeswarmCircle" cx="([^"]+)" cy="([^"]+)" r="5" \/>/);
    return [id, {
      x: Number(coordinates?.[1]),
      y: Number(coordinates?.[2]),
      markup,
    }];
  }));

  assert.equal(points.size, 2);
  assert.ok(points.get(splitQuestion.id).x > 600);
  assert.ok(points.get(splitQuestion.id).y <= 30);
  assert.ok(points.get(similarQuestion.id).x < 100);
  assert.ok(points.get(similarQuestion.id).y > 60 && points.get(similarQuestion.id).y < 70);
  assert.match(points.get(splitQuestion.id).markup, /data-question-difference="1\.00"/);
  assert.match(points.get(splitQuestion.id).markup, /data-question-winning-response-consistency="1\.00"/);
  assert.match(points.get(similarQuestion.id).markup, /data-question-difference="0\.00"/);
  assert.match(points.get(similarQuestion.id).markup, /data-question-winning-response-consistency="0\.75"/);
  assert.match(points.get(similarQuestion.id).markup, /data-question-attempted-runs="4"/);
  assert.match(points.get(similarQuestion.id).markup, /data-question-contributing-models="2"/);
  assert.match(points.get(similarQuestion.id).markup, /data-question-difference-label="Cohort difference"/);
  assert.match(points.get(similarQuestion.id).markup, new RegExp(`href="#question-${similarQuestion.id}"`));
  assert.match(chart, /aria-label="Questions by model-cohort difference and repeat consistency"/);
  assert.match(chart, /class="beeswarmAxisTitle"[^>]*>Repeat consistency<\/text>/);
  assert.match(chart, /<text class="beeswarmAxisLabel" x="62" y="232">Similarity<\/text>/);
  assert.match(chart, /<text class="beeswarmAxisLabel" x="680" y="232" text-anchor="end">Difference<\/text>/);
  assert.doesNotMatch(chart, /<title>/);
  assert.match(chart, /aria-label="[^"]+modeled responses; [^"]+repeat consistency\)"/);
});

test('All Questions gives each model one averaged vote and preserves invalid raw runs separately', async () => {
  const questionBank = limitQuestionBank(
    await readJson(new URL('../data/question-bank.sample.json', import.meta.url)),
    1
  );
  const modelRoster = {
    schemaVersion: 1,
    models: [
      { id: 'model-a', label: 'Model A', model: 'provider/model-a', provider: 'mock', traits: {} },
    ],
  };
  const [question] = questionBank.questions;
  const runsFile = {
    schemaVersion: 1,
    benchmarkId: questionBank.benchmarkId,
    mode: 'self',
    runs: [
      { modelId: 'model-a', questionId: question.id, polarity: 'canonical', normalizedAnswer: 'Agree' },
      { modelId: 'model-a', questionId: question.id, polarity: 'canonical', normalizedAnswer: null },
    ],
  };

  const report = buildResultsReport({ questionBank, modelRoster, runsFile });
  const html = renderHtmlReport(report);

  assert.equal(report.polisReport.byQuestion[question.id].total, 1);
  assert.equal(report.polisReport.byQuestion[question.id].invalid, 0);
  assert.equal(report.polisReport.byQuestion[question.id].runSummary.total, 2);
  assert.equal(report.polisReport.byQuestion[question.id].runSummary.invalid, 1);
  assert.match(html, /<strong>Agree:<\/strong> 1 \/\s*<strong>Disagree:<\/strong> 0 \/\s*<strong>Unsure:<\/strong> 0 \/\s*\(Total: 1\)/);
  assert.match(html, /class="questionModelLegend" aria-label="Model marker legend"/);
  assert.match(html, /<button\s+type="button"\s+class="questionModelLegendItem"\s+data-ce-question-model-card="model-a"\s+style="--atlas-model-color:#1f77b4"\s+title="Model A"\s+aria-label="Toggle Model A answer highlighting"\s+aria-pressed="false"[\s\S]*?>1<\/span>[\s\S]*?<span>Model A<\/span>/);
  assert.match(html, /id="question-[^"]+"[\s\S]*?class="atlasIssueQuestionDistribution questionModelDistribution"[\s\S]*?data-ce-atlas-model-marker="model-a"[\s\S]*?data-ce-atlas-model-answer="Agree"/);
  assert.match(html, /\.questionModelDistribution \.atlasIssueQuestionBar \{ height: 24px; border-color: #64748b; background: #eef2f6; \}/);
  assert.match(html, /#all-questions\[data-ce-question-model-highlight\] \.questionModelDistribution \.atlasIssueModelMarker \{ opacity: 0\.25;/);
  assert.match(html, /function applyQuestionModelHighlight\(\)/);
  assert.match(html, /var lockedQuestionModelIds = new Set\(\);/);
  assert.match(html, /var activeModelIds = lockedQuestionModelIds\.size > 0\s*\? Array\.from\(lockedQuestionModelIds\)/);
  assert.match(html, /var isActive = activeModelIds\.indexOf\(cardModelId\) !== -1;/);
  assert.match(html, /var isLocked = lockedQuestionModelIds\.has\(cardModelId\);/);
  assert.match(html, /activeModelIds\.indexOf\(marker\.getAttribute\('data-ce-atlas-model-marker'\) \|\| ''\) !== -1/);
  assert.match(html, /if \(lockedQuestionModelIds\.has\(modelId\)\) \{\s*lockedQuestionModelIds\.delete\(modelId\);/);
  assert.match(html, /lockedQuestionModelIds\.add\(modelId\);/);
  assert.match(html, /card\.setAttribute\('aria-pressed', isLocked \? 'true' : 'false'\)/);
  assert.match(html, /data-ce-atlas-question-distribution aria-label="Model vote distribution: Agree 1, Unsure 0, Disagree 0\. Model answers: Model A: Agree"/);
  assert.match(html, /data-ce-atlas-question-vote-count="Agree"><i class="aidb-answer-agree"><\/i><span>Agree<\/span><strong>1<\/strong>/);
  assert.match(html, /data-ce-atlas-question-vote-count="Unsure"><i class="aidb-answer-unsure"><\/i><span>Unsure<\/span><strong>0<\/strong>/);
  assert.match(html, /data-ce-atlas-question-vote-count="Disagree"><i class="aidb-answer-disagree"><\/i><span>Disagree<\/span><strong>0<\/strong>/);
  assert.match(html, /data-ce-atlas-model-roster/);
  assert.doesNotMatch(html, /data-ce-atlas-model-context/);
  assert.match(html, /Models included/);
  assert.match(html, /data-ce-atlas-model-card="model-a"/);
  assert.match(html, /<button\s+type="button"\s+class="atlasIssueModelCard"\s+data-ce-atlas-model-card="model-a"[^>]*aria-label="Highlight Model A answers and metrics; click to lock selection"\s+aria-pressed="false"/);
  assert.match(html, /data-ce-atlas-model-marker="model-a"/);
  assert.match(html, /data-ce-atlas-model-answer="Agree"/);
  assert.match(html, /title="Model A: Agree"/);
  assert.doesNotMatch(html, /Answer coverage/);
  assert.match(html, /Response direction/);
  assert.match(html, /Average \+1\.00/);
  assert.match(html, /-1 disagree \| 0 unsure \| \+1 agree/);
  assert.match(html, /Model difference/);
  assert.match(html, /No comparison/);
  assert.doesNotMatch(html, /Mean of 1 model-question answer after repeat runs were combined/);
  assert.doesNotMatch(html, /This describes response direction, not correctness/);
});

test('Debate Map uses stable model colors and overlays each answer on its aggregate segment', async () => {
  const questionBank = limitQuestionBank(
    await readJson(new URL('../data/question-bank.sample.json', import.meta.url)),
    1
  );
  const modelRoster = {
    schemaVersion: 1,
    models: [
      { id: 'model-a', label: 'Model A', model: 'provider/model-a', provider: 'mock', traits: {} },
      { id: 'model-b', label: 'Model B', model: 'provider/model-b', provider: 'mock', traits: {} },
      { id: 'model-c', label: 'Model C', model: 'provider/model-c', provider: 'mock', traits: {} },
    ],
  };
  const [question] = questionBank.questions;
  const report = buildResultsReport({
    questionBank,
    modelRoster,
    runsFile: {
      schemaVersion: 1,
      benchmarkId: questionBank.benchmarkId,
      mode: 'self',
      runs: [
        { modelId: 'model-a', questionId: question.id, polarity: 'canonical', normalizedAnswer: 'Agree' },
        { modelId: 'model-b', questionId: question.id, polarity: 'canonical', normalizedAnswer: 'Unsure' },
        { modelId: 'model-c', questionId: question.id, polarity: 'canonical', normalizedAnswer: 'Disagree' },
      ],
    },
  });
  const html = renderHtmlReport(report);

  assert.match(html, /data-ce-atlas-model-card="model-a"[^>]*style="--atlas-model-color:#1f77b4"/);
  assert.match(html, /data-ce-atlas-model-card="model-b"[^>]*style="--atlas-model-color:#ff7f0e"/);
  assert.match(html, /data-ce-atlas-model-card="model-c"[^>]*style="--atlas-model-color:#2ca02c"/);
  assert.match(html, /data-ce-atlas-model-card="model-a"[^>]*data-ce-atlas-model-stance-value="Average \+1\.00"[^>]*data-ce-atlas-model-difference-value="Mean peer gap 1\.50"[^>]*data-ce-atlas-model-consistency-value="100%"/);
  assert.match(html, /data-ce-atlas-model-card="model-b"[^>]*data-ce-atlas-model-stance-value="Average 0\.00"[^>]*data-ce-atlas-model-difference-value="Mean peer gap 1\.00"[^>]*data-ce-atlas-model-consistency-value="100%"/);
  assert.match(html, /data-ce-atlas-model-marker="model-a"[\s\S]*?data-ce-atlas-model-answer="Agree"[\s\S]*?data-ce-atlas-model-repeat-value="100%"[\s\S]*?data-ce-atlas-model-winning-responses="1"[\s\S]*?data-ce-atlas-model-attempted-runs="1"[\s\S]*?style="--atlas-model-color:#1f77b4;left:16\.67%"[\s\S]*?>1<\/span>/);
  assert.match(html, /data-ce-atlas-model-marker="model-b"[\s\S]*?data-ce-atlas-model-answer="Unsure"[\s\S]*?style="--atlas-model-color:#ff7f0e;left:50\.00%"[\s\S]*?>2<\/span>/);
  assert.match(html, /data-ce-atlas-model-marker="model-c"[\s\S]*?data-ce-atlas-model-answer="Disagree"[\s\S]*?style="--atlas-model-color:#2ca02c;left:83\.33%"[\s\S]*?>3<\/span>/);
  assert.match(html, /aria-label="Model vote distribution: Agree 1, Unsure 1, Disagree 1\. Model answers: Model A: Agree, Model B: Unsure, Model C: Disagree"/);
  assert.match(html, /\.atlasIssueModalContent\[data-ce-atlas-model-highlight\] \.atlasIssueModelMarker \{ opacity: 0\.25; filter: brightness\(0\.72\) saturate\(0\.55\); \}/);
  assert.match(html, /\.atlasIssueModalContent\[data-ce-atlas-model-highlight\] \.atlasIssueModelMarker\.atlasIssueModelMarkerActive \{[^}]*opacity: 1;[^}]*filter: brightness\(1\.38\) saturate\(1\.25\);/);
  assert.match(html, /\.atlasIssueMetricGrid\[data-ce-atlas-model-metrics-active\] \{[^}]*background: color-mix\(in srgb, var\(--atlas-active-model-color\) 24%, rgba\(15, 23, 42, 0\.82\)\);/);
  assert.match(html, /data-ce-atlas-model-metric-grid aria-label="Issue area benchmark metrics"/);
  assert.match(html, /data-ce-atlas-metric-label="difference" data-ce-atlas-metric-default="Model difference"/);
  assert.match(html, /function updateAtlasIssueMetrics\(modelId\)/);
  assert.match(html, /function updateAtlasQuestionMetrics\(modelId\)/);
  assert.match(html, /data-ce-atlas-question-meta data-ce-atlas-question-meta-default="Model score gap 2\.00 \| 100% repeat stability"/);
  assert.match(html, /meta\.textContent = label \+ ': ' \+ answer \+ ' \| ' \+ repeatValue \+ ' repeat stability' \+ runDetail;/);
  assert.match(html, /updateAtlasQuestionMetrics\(modelId\);/);
  assert.match(html, /setAtlasMetricText\(grid, 'label', 'difference', 'Distance from peers'\)/);
  assert.match(html, /function applyAtlasModelHighlight\(\)/);
  assert.match(html, /var modelId = lockedAtlasModelId \|\| hoveredAtlasModelId \|\| focusedAtlasModelId;/);
  assert.match(html, /card\.classList\.toggle\('atlasIssueModelCardLocked', isLocked\)/);
  assert.match(html, /card\.setAttribute\('aria-pressed', isLocked \? 'true' : 'false'\)/);
  assert.match(html, /atlasIssueModalContent\.setAttribute\('data-ce-atlas-model-highlight', modelId\)/);
  assert.match(html, /marker\.classList\.toggle\(\s*'atlasIssueModelMarkerActive',\s*marker\.getAttribute\('data-ce-atlas-model-marker'\) === modelId/);
  assert.match(html, /atlasIssueModalBody\.addEventListener\('mouseover', function \(event\) \{[\s\S]*?hoveredAtlasModelId = card\.getAttribute\('data-ce-atlas-model-card'\) \|\| '';[\s\S]*?applyAtlasModelHighlight\(\);/);
  assert.match(html, /atlasIssueModalBody\.addEventListener\('mouseout', function \(event\) \{[\s\S]*?hoveredAtlasModelId = '';[\s\S]*?applyAtlasModelHighlight\(\);/);
  assert.match(html, /atlasIssueModalBody\.addEventListener\('focusin', function \(event\) \{[\s\S]*?focusedAtlasModelId = card\.getAttribute\('data-ce-atlas-model-card'\) \|\| '';/);
  assert.match(html, /atlasIssueModalBody\.addEventListener\('focusout', function \(event\) \{[\s\S]*?focusedAtlasModelId = '';/);
  assert.match(html, /if \(lockedAtlasModelId === modelId\) \{\s*lockedAtlasModelId = '';\s*hoveredAtlasModelId = '';\s*focusedAtlasModelId = '';\s*if \(modelCard\.blur\) modelCard\.blur\(\);\s*\} else \{\s*lockedAtlasModelId = modelId;/);
});

test('Debate Map model repeat stability stays separate from polarity sensitivity', async () => {
  const questionBank = limitQuestionBank(
    await readJson(new URL('../data/question-bank.sample.json', import.meta.url)),
    1
  );
  const modelRoster = {
    schemaVersion: 1,
    models: [
      { id: 'model-a', label: 'Model A', model: 'provider/model-a', provider: 'mock', traits: {} },
    ],
  };
  const [question] = questionBank.questions;
  const report = buildResultsReport({
    questionBank,
    modelRoster,
    runsFile: {
      schemaVersion: 1,
      benchmarkId: questionBank.benchmarkId,
      mode: 'self',
      runs: [
        { modelId: 'model-a', questionId: question.id, polarity: 'canonical', normalizedAnswer: 'Agree' },
        { modelId: 'model-a', questionId: question.id, polarity: 'canonical', normalizedAnswer: 'Agree' },
        { modelId: 'model-a', questionId: question.id, polarity: 'reversed', normalizedAnswer: 'Disagree' },
        { modelId: 'model-a', questionId: question.id, polarity: 'reversed', normalizedAnswer: 'Disagree' },
      ],
    },
  });
  const html = renderHtmlReport(report);

  assert.match(html, /data-ce-atlas-model-card="model-a"[^>]*data-ce-atlas-model-consistency-value="100%"/);
  assert.match(html, /data-ce-atlas-model-marker="model-a"[\s\S]*?data-ce-atlas-model-repeat-value="100%"/);
  assert.equal(report.polisReport.byQuestion[question.id].wordingSensitivity.meanAbsoluteShift, 2);
});

test('Debate Map contributor context distinguishes partial model coverage', async () => {
  const questionBank = limitQuestionBank(
    await readJson(new URL('../data/question-bank.sample.json', import.meta.url)),
    1
  );
  const modelRoster = {
    schemaVersion: 1,
    models: [
      { id: 'model-a', label: 'Model A', model: 'provider/model-a', provider: 'mock', traits: {} },
      { id: 'model-b', label: 'Model B', model: 'provider/model-b', provider: 'mock', traits: {} },
    ],
  };
  const [question] = questionBank.questions;
  const report = buildResultsReport({
    questionBank,
    modelRoster,
    runsFile: {
      schemaVersion: 1,
      benchmarkId: questionBank.benchmarkId,
      mode: 'self',
      runs: [
        { modelId: 'model-a', questionId: question.id, polarity: 'canonical', normalizedAnswer: 'Agree' },
      ],
    },
  });
  const html = renderHtmlReport(report);
  const topicId = report.debateAtlas.topicCircles.find((topic) => (
    topic.questionIds.includes(question.id)
  )).id;
  const issueTemplate = Array.from(html.matchAll(/<template[\s\S]*?<\/template>/g))
    .map((match) => match[0])
    .find((template) => template.includes(`data-ce-atlas-topic-id="${topicId}"`));

  assert.ok(issueTemplate);
  assert.doesNotMatch(issueTemplate, /Measured benchmark evidence/);
  assert.doesNotMatch(issueTemplate, /inform(?:s)? this issue area/);
  assert.doesNotMatch(issueTemplate, /Answer coverage/);
  assert.match(issueTemplate, /data-ce-atlas-model-card="model-a"/);
  assert.doesNotMatch(issueTemplate, /data-ce-atlas-model-card="model-b"/);
  assert.doesNotMatch(issueTemplate, /question answered|average score/);
  assert.match(issueTemplate, /No comparison/);
  assert.match(issueTemplate, /Two models must answer the same question/);
});

test('Summary stats count only concrete agree and disagree votes like live Polis', async () => {
  const questionBank = limitQuestionBank(
    await readJson(new URL('../data/question-bank.sample.json', import.meta.url)),
    1
  );
  const modelRoster = {
    schemaVersion: 1,
    models: [
      { id: 'model-a', label: 'Model A', model: 'provider/model-a', provider: 'mock', traits: {} },
      { id: 'model-b', label: 'Model B', model: 'provider/model-b', provider: 'mock', traits: {} },
    ],
  };
  const [question] = questionBank.questions;
  const runsFile = {
    schemaVersion: 1,
    benchmarkId: questionBank.benchmarkId,
    mode: 'self',
    runs: [
      { modelId: 'model-a', questionId: question.id, polarity: 'canonical', normalizedAnswer: 'Agree' },
      { modelId: 'model-a', questionId: question.id, polarity: 'canonical', normalizedAnswer: 'Unsure' },
      { modelId: 'model-b', questionId: question.id, polarity: 'canonical', normalizedAnswer: null },
    ],
  };

  const report = buildResultsReport({ questionBank, modelRoster, runsFile });
  const html = renderHtmlReport(report);

  assert.equal(report.counts.runs, 3);
  assert.match(html, /<span class="statLabel">Votes<span class="pdfIgnore aidb-inline-tooltip-reference"[\s\S]*?:<\/span><span class="statValue">1<\/span>/);
  assert.match(html, /<span class="statLabel">Votes\/Voter Avg<span class="pdfIgnore aidb-inline-tooltip-reference"[\s\S]*?:<\/span><span class="statValue">1\.00<\/span>/);
  assert.match(html, /\(Total: 2\)/);
  assert.doesNotMatch(html, /<span class="statLabel">Votes<span class="pdfIgnore aidb-inline-tooltip-reference"[\s\S]*?:<\/span><span class="statValue">3<\/span>/);
  assert.doesNotMatch(html, /<span class="statLabel">Votes\/Voter Avg<span class="pdfIgnore aidb-inline-tooltip-reference"[\s\S]*?:<\/span><span class="statValue">1\.50<\/span>/);
});

test('analysis overlay populates risk matrix popups and Debate Map generated surfaces', async () => {
  const questionBank = limitQuestionBank(
    await readJson(new URL('../data/question-bank.sample.json', import.meta.url)),
    1
  );
  const modelRoster = {
    schemaVersion: 1,
    models: [
      { id: 'model-a', label: 'Model A', model: 'provider/model-a', provider: 'mock', traits: {} },
    ],
  };
  const runsFile = {
    schemaVersion: 1,
    benchmarkId: questionBank.benchmarkId,
    mode: 'self',
    runs: [],
  };

  const report = {
    ...buildResultsReport({ questionBank, modelRoster, runsFile }),
    analysisOverlay: {
      schemaVersion: 1,
      kind: 'ai_discourse_bench_analysis_overlay',
      aiAnalysis: {
        executiveSummary: 'Second-pass synthesis highlights consensus on evaluation disclosure and disagreement about labor adjustment speed.',
        strongestConsensus: ['aidb_0001'],
        sharpestDisagreements: [
          { questionId: 'aidb_0001', summary: 'Evaluation disclosure is the sharpest visible split in this fixture.' },
        ],
        caveats: ['Fixture-sized overlays should not be treated as final benchmark interpretation.'],
      },
      debateAtlas: {
        topicCircles: [
          {
            id: 'labor-transition',
            label: 'Labor Transition',
            summary: 'Model disagreement clusters around automation and transition support.',
            questionIds: ['aidb_0001'],
            averageStance: 0.5,
          },
        ],
        issueAreas: [
          {
            id: 'labor-transition',
            title: 'Labor Transition Analysis',
            summary: 'A modal-ready synthesis of the benchmark evidence on labor transition policy.',
            tags: ['labor', 'automation'],
            keyTensions: ['Deployment speed can outpace adjustment capacity.'],
            pointsOfAgreement: ['Models favor some form of transition support.'],
            pointsOfDisagreement: ['Models differ on the timing and scale of intervention.'],
            openQuestions: ['Which institution should fund adjustment programs?'],
            implications: ['Policy sequencing may matter as much as policy selection.'],
            linkedQuestionIds: ['aidb_0001'],
            confidence: 'medium',
            analysisSections: [
              {
                title: 'Policy Pathways',
                body: 'The second pass can provide freeform analysis without changing measured benchmark outputs.',
                bullets: ['Compare anticipatory and reactive transition policy.'],
                linkedQuestionIds: ['aidb_0001'],
              },
            ],
          },
        ],
        compasses: [
          {
            id: 'governance-speed',
            title: 'Governance Speed Compass',
            xAxis: { left: 'Precaution', right: 'Deployment' },
            yAxis: { bottom: 'Decentralized', top: 'Centralized' },
            placements: [
              {
                id: 'labor-transition',
                label: 'Labor Transition',
                x: -0.35,
                y: 0.65,
                summary: 'Transition policy sits between precaution and centralized coordination.',
              },
            ],
          },
        ],
      },
      riskMatrix: {
        cells: {
          Capabilities_vs_Labor: {
            summary: 'AI-generated summary for capability and labor interaction.',
            opportunities: ['Use the productivity gain to fund transition programs.'],
            risks: ['Automation pressure can reduce bargaining power.'],
            linkedQuestionIds: ['aidb_0001'],
            linkedTopicIds: ['labor-transition'],
            scenarios: [
              {
                id: 'automation-bargaining',
                atlasNodeId: 'labor-transition',
                atlasNodeLabel: 'Labor Transition',
                title: 'Automation bargaining pressure',
                summary: 'Capability acceleration can shift worker bargaining power before transition policy catches up.',
                valence: 'risk',
                confidence: 'medium',
                timeHorizon: '2-5 years',
                primaryMechanism: 'The model split links capability speed to labor-market adjustment capacity.',
                historicalAnchors: [
                  { name: 'Industrial policy debates', role: 'Transition precedent' },
                ],
              },
            ],
            confidence: 'medium',
            generatedBy: 'fixture-model',
          },
        },
      },
    },
  };
  const html = renderHtmlReport(report);

  assert.match(html, /id="ai-analysis"/);
  assert.match(html, /data-ce-ai-analysis-overlay/);
  assert.match(html, /Second-pass synthesis highlights consensus on evaluation disclosure/);
  assert.match(html, /Strongest Consensus/);
  assert.match(html, /href="#question-aidb_0001">aidb_0001<\/a>/);
  assert.match(html, /Sharpest Disagreements/);
  assert.match(html, /Evaluation disclosure is the sharpest visible split/);
  assert.match(html, /Caveats/);
  assert.match(html, /Fixture-sized overlays should not be treated as final benchmark interpretation/);
  assert.match(html, /\.aidb-ai-analysis-grid \{ display: grid; grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(html, /@media \(max-width: 980px\) \{[\s\S]*\.aidb-ai-analysis-grid \{ grid-template-columns: 1fr; \}/);
  assert.match(html, /AI-generated summary for capability and labor interaction/);
  assert.match(html, /Use the productivity gain to fund transition programs/);
  assert.match(html, /Automation pressure can reduce bargaining power/);
  assert.match(html, /function renderRiskAiSummary\(payload\)/);
  assert.match(html, /renderRiskAiBulletGroup\('AI Opportunities', aiOpportunities, 'opportunity'\)/);
  assert.match(html, /function renderRiskAtlasScenarios\(payload\)/);
  assert.match(html, /data-ce-risk-matrix-scenario-rail[\s\S]*class="commentSections" data-ce-risk-matrix-comment-list/);
  assert.match(html, /var riskMatrixScenarioRail = document\.querySelector\('\[data-ce-risk-matrix-scenario-rail\]'\);/);
  assert.match(html, /riskMatrixScenarioRail\.innerHTML = renderRiskAtlasScenarios\(payload\);/);
  assert.match(html, /riskMatrixCommentList\.innerHTML = \[\s*renderRiskAiSummary\(payload\),/);
  assert.doesNotMatch(html, /riskMatrixCommentList\.innerHTML = \[\s*renderRiskAtlasScenarios\(payload\),/);
  assert.match(html, /Automation bargaining pressure/);
  assert.match(html, /Capability acceleration can shift worker bargaining power/);
  assert.match(html, /Related atlas scenario visualizations/);
  assert.match(html, /data-testid="ce-risk-matrix-atlas-scenario-card"/);
  assert.match(html, /data-testid="ce-risk-matrix-atlas-link-/);
  assert.match(html, /linked atlas overlap/);
  assert.match(html, /\.atlasScenarioRail/);
  assert.match(html, /\.atlasScenarioValenceRisk/);
  assert.match(html, /\.atlasScenarioHeaderMain/);
  assert.match(html, /\.riskMatrixAiSummary/);
  assert.match(html, /data-ce-node-id="labor-transition"/);
  assert.match(html, /id="debate-atlas-labor-transition"/);
  assert.match(html, /data-ce-atlas-open="labor-transition"/);
  assert.match(html, /data-ce-atlas-topic-title="Labor Transition Analysis"/);
  assert.match(html, /A modal-ready synthesis of the benchmark evidence on labor transition policy/);
  assert.match(html, /Deployment speed can outpace adjustment capacity/);
  assert.match(html, /Models favor some form of transition support/);
  assert.match(html, /Models differ on the timing and scale of intervention/);
  assert.match(html, /Which institution should fund adjustment programs/);
  assert.match(html, /Policy sequencing may matter as much as policy selection/);
  assert.match(html, /Policy Pathways/);
  assert.match(html, /The second pass can provide freeform analysis without changing measured benchmark outputs/);
  assert.match(html, /data-ce-atlas-modal-tag="labor"/);
  assert.match(html, /data-ce-atlas-question-link/);
  assert.match(html, /data-ce-atlas-issue-copy-link/);
  assert.match(html, /atlasIssueModal\.addEventListener\('click'/);
  assert.match(html, /if \(event\.key === 'Tab' && atlasIssueModal && !atlasIssueModal\.hidden\)/);
  assert.match(html, /class="nodeLabel packedNodeLabel alwaysVisible" style="font-size:[^"]+">\s*Labor Transition\s*<\/div>/);
  assert.match(html, /data-ce-analysis-compasses/);
  assert.match(html, /class="collapseSection aidb-analysis-compass" data-ce-static-compass data-ce-compass-id="governance-speed"/);
  assert.match(html, /Governance Speed Compass/);
  assert.match(html, /Precaution/);
  assert.match(html, /Deployment/);
  assert.match(html, /Decentralized/);
  assert.match(html, /Centralized/);
  assert.match(html, /data-ce-compass-placement="labor-transition"/);
  assert.match(html, /\.debateMap \.collapseSection \{ margin-bottom: 12px; background: transparent; border-radius: var\(--ce-radius-6\); \}/);
  assert.match(html, /\.debateMap \.compassSection \.compassContainer \{ width: 100%; padding: 4px 0 8px; \}/);
  assert.match(html, /document\.querySelectorAll\('\[data-ce-static-compass\]'\)/);
});

test('report renders models as participants in a OnePageSession-style results shell', async () => {
  const questionBank = limitQuestionBank(
    await readJson(new URL('../data/question-bank.sample.json', import.meta.url)),
    1
  );
  const modelRoster = {
    schemaVersion: 1,
    models: [
      {
        id: 'model-a',
        label: 'Model A',
        model: 'provider/model-a',
        provider: 'mock',
        traits: {
          parameterClass: '30B A3B',
          ossStatus: 'closed',
          countryOfOrigin: 'US',
          providerClass: 'mock',
        },
      },
      {
        id: 'model-b',
        label: 'Model B',
        model: 'provider/model-b',
        provider: 'mock',
        traits: {
          parameterClass: 'medium',
          ossStatus: 'open-weights',
          countryOfOrigin: 'Canada',
          providerClass: 'mock',
        },
      },
    ],
  };
  const runsFile = {
    schemaVersion: 1,
    benchmarkId: questionBank.benchmarkId,
    mode: 'self',
    runs: [
      {
        modelId: 'model-a',
        questionId: 'aidb_0001',
        polarity: 'canonical',
        normalizedAnswer: 'Agree',
      },
      {
        modelId: 'model-b',
        questionId: 'aidb_0001',
        polarity: 'canonical',
        normalizedAnswer: 'Disagree',
      },
    ],
  };

  const report = buildResultsReport({ questionBank, modelRoster, runsFile });
  const html = renderHtmlReport(report);
  const polisContainerStart = html.indexOf('<div class="polisReportContainer ce-polis-report-shell');
  const modeSurfacesStart = html.indexOf('<div class="ce-results-mode-surfaces"');
  const polisContainerMarkup = html.slice(polisContainerStart, modeSurfacesStart);

  assert.equal(report.participants.length, 2);
  assert.match(html, /<span class="statLabel">Participants<span class="pdfIgnore aidb-inline-tooltip-reference"[\s\S]*?:<\/span><span class="statValue">2<\/span>/);
  assert.match(html, /<div id="root">\s*<div data-testid="ce-page-session-root">\s*<div class="onePageDemoContainer">/);
  assert.match(html, /<div class="onePageDemoContainer">/);
  assert.match(html, /#root \{ padding-right: 2%; padding-left: 2%; \}/);
  assert.match(html, /\.onePageDemoContainer \{ font-family: var\(--ce-font-body\); font-size: 1rem; line-height: 1\.6; color: #1a1a1a; padding: 20px; padding-top: 0 !important; \}/);
  assert.doesNotMatch(html, /\.onePageDemoContainer \{[^}]*max-width: none/);
  assert.doesNotMatch(html, /\.onePageDemoContainer \{[^}]*margin: 0/);
  assert.doesNotMatch(html, /main\.onePageDemoContainer/);
  assert.doesNotMatch(html, /ce-benchmark-results-shell/);
  assert.doesNotMatch(html, /padding-bottom: max\(20px, min\(70vh, 760px\)\);/);
  assert.match(html, /<link href="https:\/\/fonts\.googleapis\.com\/css\?family=Poppins:200,300,400,600,700,800" rel="stylesheet" \/>/);
  assert.match(html, /<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">/);
  assert.match(html, /<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>/);
  assert.match(html, /<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=Open\+Sans:ital,wght@0,300;0,500;1,500;1,600&display=swap" rel="stylesheet">/);
  assert.match(html, /--primary:#e14eca;/);
  assert.match(html, /--success:#00f2c3;/);
  assert.match(html, /--info:#1d8cf8;/);
  assert.match(html, /--warning:#ff8d72;/);
  assert.match(html, /--danger:#fd5d93;/);
  assert.match(html, /--font-family-sans-serif:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji';/);
  assert.match(html, /--ce-color-bg:#20204e;/);
  assert.match(html, /--ce-color-text:#525f7f;/);
  assert.match(html, /--ce-color-text-muted:#6c757d;/);
  assert.match(html, /--ce-color-surface:#1f2251;/);
  assert.match(html, /--ce-color-surface-alt:#272b65;/);
  assert.match(html, /--ce-color-surface-light:#f8f9fa;/);
  assert.match(html, /--ce-color-dark:#212529;/);
  assert.match(html, /--ce-color-light:#e9ecef;/);
  assert.match(html, /--ce-color-border:#333333;/);
  assert.match(html, /--ce-color-border-light:#cccccc;/);
  assert.match(html, /--ce-color-tooltip-bg:rgba\(15, 18, 34, 0\.95\);/);
  assert.match(html, /--ce-color-tooltip-text:#f4f7ff;/);
  assert.match(html, /--ce-color-tooltip-muted:rgba\(244, 247, 255, 0\.7\);/);
  assert.match(html, /--ce-color-panel-bg:#171941;/);
  assert.match(html, /--ce-color-panel-text:#f4f7ff;/);
  assert.match(html, /--ce-color-panel-text-muted:rgba\(244, 247, 255, 0\.65\);/);
  assert.match(html, /--ce-color-card-bg:rgba\(255, 255, 255, 0\.06\);/);
  assert.match(html, /--ce-color-card-border:rgba\(255, 255, 255, 0\.14\);/);
  assert.match(html, /--ce-shadow-card:0 6px 22px rgba\(0, 0, 0, 0\.25\);/);
  assert.match(html, /--ce-color-input-bg:rgba\(255, 255, 255, 0\.08\);/);
  assert.match(html, /--ce-color-input-border:rgba\(255, 255, 255, 0\.16\);/);
  assert.match(html, /--ce-color-input-border-strong:rgba\(255, 255, 255, 0\.18\);/);
  assert.match(html, /--ce-color-error:#ff4757;/);
  assert.match(html, /--ce-color-primary:#e14eca;/);
  assert.match(html, /--ce-color-primary-hover:#c221a9;/);
  assert.match(html, /--ce-color-info:#1d8cf8;/);
  assert.match(html, /--ce-color-success:#2dce89;/);
  assert.match(html, /--ce-color-success-bright:#00f2c3;/);
  assert.match(html, /--ce-color-warning:#ff8d72;/);
  assert.match(html, /--ce-color-danger:#fd5d93;/);
  assert.match(html, /--ce-color-orange:#fb6340;/);
  assert.match(html, /--ce-color-indigo:#5e72e4;/);
  assert.match(html, /--ce-color-indigo-hover:#324cdd;/);
  assert.match(html, /--ce-color-blue:#3358f4;/);
  assert.match(html, /--ce-color-yellow:#ffd600;/);
  assert.match(html, /--ce-color-pink:#ff6491;/);
  assert.match(html, /--ce-color-purple:#ba54f5;/);
  assert.match(html, /--ce-color-cyan:#0098f0;/);
  assert.match(html, /--ce-color-accent:#4dffa4;/);
  assert.match(html, /--ce-color-accent-hover:#1aff8a;/);
  assert.match(html, /--ce-color-info-soft:#89cff0;/);
  assert.match(html, /--ce-color-success-soft:#d4edda;/);
  assert.match(html, /--ce-color-success-soft-hover:#c3e6cb;/);
  assert.match(html, /--ce-color-warning-soft:#fff3cd;/);
  assert.match(html, /--ce-color-warning-soft-hover:#ffeeba;/);
  assert.match(html, /--ce-radius-20:20px;/);
  assert.match(html, /--ce-radius-round:50%;/);
  assert.match(html, /--ce-font-body:"Poppins", sans-serif;/);
  assert.match(html, /--ce-font-ui:"Open Sans", sans-serif;/);
  assert.match(html, /--ce-font-button:"Poppins", sans-serif;/);
  assert.match(html, /\*,\s*\*::before,\s*\*::after \{ box-sizing: border-box; \}/);
  assert.match(html, /html \{ font-family: sans-serif; line-height: 1\.15; -webkit-text-size-adjust: 100%; -webkit-tap-highlight-color: rgba\(34, 42, 66, 0\); scrollbar-gutter: stable; scroll-behavior: smooth; \}/);
  assert.match(html, /body \{ margin: 0; font-family: var\(--ce-font-body\); font-size: 0\.875rem; font-weight: 400; line-height: 1\.5; color: var\(--ce-color-text\); text-align: left; background-color: var\(--ce-color-bg\); \}/);
  assert.match(html, /\.index-page \{ background-image: none; \}/);
  assert.match(html, /h1, h2, h3, h4, h5, h6 \{ margin-top: 0; margin-bottom: 0\.5rem; \}/);
  assert.match(html, /p \{ margin-top: 0; margin-bottom: 1rem; \}/);
  assert.match(html, /ol, ul, dl \{ margin-top: 0; margin-bottom: 1rem; \}/);
  assert.doesNotMatch(html, /h1, h2, h3, p, dl, ol \{ margin: 0; \}/);
  assert.doesNotMatch(html, /h1 \{ font-size: 1\.4rem; line-height: 1\.2; letter-spacing: 0; margin: 0 0 5px; \}/);
  assert.doesNotMatch(html, /h2 \{ font-size: 24px; letter-spacing: 0; \}/);
  assert.doesNotMatch(html, /h3 \{ font-size: 15px; margin-bottom: 10px; text-transform: none; \}/);
  assert.doesNotMatch(html, /p \{ color: var\(--muted\); line-height: 1\.45; \}/);
  assert.match(html, /button \{ border-radius: var\(--ce-radius-0\); \}/);
  assert.match(html, /input, button, select, optgroup, textarea \{ margin: 0; font-family: inherit; font-size: inherit; line-height: inherit; \}/);
  assert.match(html, /button:not\(:disabled\), \[type='button'\]:not\(:disabled\), \[type='reset'\]:not\(:disabled\), \[type='submit'\]:not\(:disabled\) \{ cursor: pointer; \}/);
  assert.doesNotMatch(html, /button \{ cursor: pointer; font: inherit; \}/);
  assert.match(html, /\.statLabel \{ font-weight: 600; margin-right: 4px; color: var\(--ce-color-border\); \}/);
  assert.match(html, /\.statValue \{ color: var\(--ce-color-border\); \}/);
  assert.match(html, /\.statsRow \{ display: flex; flex-wrap: wrap; margin-bottom: 6px; \}/);
  assert.match(html, /\.tooltipIcon \{ display: inline-block; margin-left: 4px; color: #555; cursor: help;/);
  assert.match(html, /class="pdfIgnore aidb-inline-tooltip-reference" style="display: inline-flex;" title="Participants who voted or wrote statements in the conversation\."/);
  assert.match(html, /data-icon="question-circle" class="svg-inline--fa fa-question-circle tooltipIcon"/);
  assert.match(html, /<div class="statsRow">\s*<div class="statsItem"><span class="statLabel">Participants<span class="pdfIgnore aidb-inline-tooltip-reference"[\s\S]*?:<\/span><span class="statValue">2<\/span><\/div>\s*<div class="statsItem"><span class="statLabel">Statements<span class="pdfIgnore aidb-inline-tooltip-reference"[\s\S]*?:<\/span><span class="statValue">1<\/span><\/div>\s*<div class="statsItem"><span class="statLabel">Votes<span class="pdfIgnore aidb-inline-tooltip-reference"[\s\S]*?:<\/span><span class="statValue">2<\/span><\/div>\s*<div class="statsItem"><span class="statLabel">Votes\/Voter Avg<span class="pdfIgnore aidb-inline-tooltip-reference"[\s\S]*?:<\/span><span class="statValue">1\.00<\/span><\/div>\s*<\/div>/);
  assert.match(html, /<div class="statsSection" data-benchmark-id="ai-discourse-bench-v0-sample-200-first-1" data-benchmark-mode="self" data-benchmark-issue-count="0">/);
  assert.match(html, /<div class="statsRow">\s*<div class="statsItem"><span class="statLabel">Active Filters<span class="pdfIgnore aidb-inline-tooltip-reference"[\s\S]*?:<\/span><div class="statValue"><span>None<\/span><\/div><\/div>\s*<\/div>/);
  assert.match(html, /<div class="statsRow">\s*<div class="statsItem"><span class="statLabel">Blockchain:<\/span><span class="statValue">Unknown<\/span><\/div>\s*<div class="statsItem"><span class="statLabel">Timestamp:<\/span><span class="statValue">[^<]+ UTC<\/span><\/div>\s*<\/div>/);
  assert.doesNotMatch(html, /<span class="statLabel">Parse or Provider Issues:<\/span>/);
  assert.doesNotMatch(html, /<span class="statLabel">Mode:<\/span>/);
  assert.doesNotMatch(html, /<span class="statLabel">Benchmark:<\/span>/);
  assert.match(html, /svg \{ overflow: hidden; vertical-align: middle; \}/);
  assert.match(html, /\.participantSvg, \.aidb-world-map-svg \{ display: block; width: 100%; height: auto; \}/);
  assert.doesNotMatch(html, /svg \{ width: 100%; height: auto; display: block; \}/);
  assert.doesNotMatch(html, /\n\s+table \{ width: 100%; border-collapse: collapse;/);
  assert.match(html, /\.aidb-matrix-table \{ width: 100%; border-collapse: collapse; margin-top: 16px; background: #fff; font-size: 13px; \}/);
  assert.match(html, /\.aidb-matrix-table th, \.aidb-matrix-table td \{ border-bottom: 1px solid #e3e7ef; padding: 10px 12px; text-align: left; vertical-align: top; \}/);
  assert.doesNotMatch(html, /\n\s+details \{ border: 1px solid #d9dee8;/);
  assert.match(html, /\.aidb-similarity-details, \.htmlReportJsonDetails \{ border: 1px solid #d9dee8; border-radius: 8px; background: #fff; padding: 10px 12px; margin: 10px 0; \}/);
  assert.doesNotMatch(html, /nav a, button \{/);
  assert.match(html, /class="sectionContainer sectionExpanded ce-session-results-section"/);
  assert.match(html, /\.ce-session-results-section \{ grid-column: 1 \/ -1; box-sizing: border-box; width: 100%; max-width: 100%;/);
  assert.match(html, /<div class="sectionsGrid">\s*<section[\s\S]*?data-ce-benchmark-intro[\s\S]*?<\/section>\s*<div class="sectionContainer sectionExpanded ce-session-results-section"[^>]*>\s*<div class="sectionHeaderRow">[\s\S]*?<\/div>\s*<div class="miniSectionContent">/);
  assert.match(html, /\.sectionsGrid \{ display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 12px; max-width: 100%; min-width: 0; \}/);
  assert.match(html, /\.aidb-benchmark-intro \{ grid-column: 1 \/ -1;/);
  assert.match(html, /\.aidb-benchmark-heading-row \{ display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; \}/);
  assert.match(html, /\.aidb-benchmark-download \{ width: 44px; height: 44px;/);
  assert.doesNotMatch(html, /\.aidb-benchmark-intro \{[^}]*border-bottom:/);
  assert.doesNotMatch(html, /\.aidb-benchmark-facts \{[^}]*border-bottom:/);
  assert.match(html, /\.aidb-benchmark-facts \{ display: grid; grid-template-columns: minmax\(5\.5rem, 0\.55fr\) minmax\(8rem, 0\.78fr\) minmax\(13rem, 1\.25fr\) minmax\(19\.75rem, 1\.65fr\);/);
  assert.doesNotMatch(html, /\.aidb-benchmark-facts \{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(html, /\.aidb-benchmark-technical-name \{ color: rgba\(244, 247, 255, 0\.82\); font-weight: 700; \}/);
  assert.match(html, /\.aidb-benchmark-topic-fact select \{[^}]*width: 100%;[^}]*min-width: 0;[^}]*border-radius: 4px;[^}]*\}/);
  assert.doesNotMatch(html, /\.aidb-benchmark-topic-control/);
  assert.match(html, /\.aidb-benchmark-facts dt \{[^}]*font-size: 0\.82rem;[^}]*\}/);
  assert.match(html, /\.aidb-benchmark-facts dd \{[^}]*font-size: 1\.08rem;[^}]*\}/);
  assert.match(html, /\.aidb-benchmark-fact-number \{ align-items: center; text-align: center; \}/);
  assert.match(html, /\.aidb-benchmark-fact-number dt \{ width: 100%; justify-content: center; \}/);
  assert.match(html, /\.aidb-benchmark-fact-number dd \{ margin-top: 9px; font-family: var\(--ce-font-body\); font-size: 2rem; font-variant-numeric: tabular-nums; font-weight: 700; line-height: 1; \}/);
  assert.match(html, /@media \(min-width: 768px\) \{\s*\.sectionsGrid \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); align-items: start; \}\s*\.sectionsGridTwoUp \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}\s*\.sectionsGrid \.sectionExpanded \{ grid-column: 1 \/ -1; \}/);
  assert.match(html, /class="sectionContainer sectionExpanded ce-session-results-section" data-ce-results-section data-ce-results-open="true"/);
  assert.match(html, /<h2 class="sectionHeader" data-ce-results-toggle role="button" tabindex="0" aria-expanded="true">/);
  assert.match(html, /data-ce-report-view-mode="report"[\s\S]*<span class="sectionHeaderViewModeIcon" aria-hidden="true">🧾<\/span>/);
  assert.match(html, /data-ce-report-view-mode="debate-atlas"[\s\S]*<span class="sectionHeaderViewModeIcon" aria-hidden="true">🗺️<\/span>/);
  assert.match(html, /data-ce-report-view-mode="breakdown"[\s\S]*<span class="sectionHeaderViewModeIcon" aria-hidden="true">📊<\/span>/);
  assert.match(html, /data-ce-report-view-mode="risk-matrix"[\s\S]*<span class="sectionHeaderViewModeIcon" aria-hidden="true">⚠️<\/span>/);
  assert.match(html, /class="polisReportContainer ce-polis-report-shell"/);
  assert.doesNotMatch(html, /class="polisReportContainer ce-polis-report-shell polisReportModern"/);
  assert.match(html, /\.ce-polis-report-shell \{ margin-top: 20px;[\s\S]*overflow-x: scroll;/);
  assert.match(html, /\.ce-session-results-section > \.sectionHeaderRow > \.sectionHeader \{ display: flex; flex-direction: row; align-items: flex-start; flex-wrap: wrap; gap: 10px; cursor: pointer; font-size: 2rem; margin: 0; font-weight: bold; color: rgba\(255, 255, 255, 0\.75\); flex: 0 1 auto; min-width: 0; line-height: 1\.1; \}/);
  assert.doesNotMatch(html, /\.ce-session-results-section > \.sectionHeaderRow > \.sectionHeader \{[^}]*font-weight: 700;/);
  assert.doesNotMatch(html, /\n\s*\.sectionHeader \{ display: flex; flex-direction: row;/);
  assert.match(html, /\.aidb-view-section \.sectionTitle \{ margin: 0; font-size: 1\.2rem; color: var\(--ce-color-border\); \}\s*\.aidb-view-section \.sectionHeader \{ cursor: pointer; font-size: 1\.4rem; margin-bottom: 10px; color: var\(--ce-color-border\); font-weight: 600; \}/);
  assert.doesNotMatch(html, /\.aidb-view-section \.sectionHeader \{[^}]*display: flex/);
  assert.doesNotMatch(html, /\.aidb-view-section \.sectionHeader \{[^}]*flex: 1 1 auto/);
  assert.doesNotMatch(html, /\.aidb-view-section \.sectionHeader \{[^}]*margin: 0 0 10px/);
  assert.doesNotMatch(html, /\.aidb-view-section \.sectionTitle \{ color: var\(--ce-color-border\); \}/);
  assert.match(html, /data-ce-report-shell="polis"/);
  assert.match(html, /class="reportInner"/);
  assert.doesNotMatch(html, /class="reportInner reportInnerModern"/);
  assert.doesNotMatch(html, /class="orgReportTitle"/);
  assert.doesNotMatch(html, /class="ce-report-meta"/);
  assert.match(html, /<div class="brandingHeader"><\/div>/);
  assert.match(html, /<div class="brandingHeader"><\/div>\s*<h4 class="heading"><\/h4>\s*<div class="aidb-preview-notice"[\s\S]*?<div class="disclaimerBox">/);
  assert.doesNotMatch(html, /<p class="sessionInfo">AI Discourse Bench Sample<\/p>/);
  assert.doesNotMatch(html, /<p class="sessionInfo">Context Engine AI Discourse Benchmark Results Report<\/p>/);
  assert.match(html, /class="disclaimerBox"/);
  assert.match(html, /<strong>Note:<\/strong> Only non-encrypted, binary/);
  assert.match(html, /\(Agree\/Disagree\/Unsure\) responses have been considered in\s+this Polis-inspired report\./);
  assert.match(html, /\.heading \{ font-size: 1\.4rem; margin-bottom: 10px; color: var\(--ce-color-border\); \}/);
  assert.match(html, /\.polisReportModern \.heading \{ font-size: 1\.55rem; letter-spacing: 0\.2px; color: #1f2a44; \}/);
  assert.match(html, /\.polisReportDark \.heading \{ font-size: 1\.55rem; letter-spacing: 0\.2px; color: #f3f4f6; \}/);
  assert.match(html, /\.disclaimerBox \{ border: 1px solid var\(--ce-color-border-light\); background: #ffffe0; padding: 8px; margin-bottom: 12px; font-size: 0\.9rem; \}/);
  assert.match(html, /data-benchmark-id="ai-discourse-bench-v0-sample-200-first-1"/);
  assert.match(html, /<span class="statLabel">Timestamp:<\/span><span class="statValue">/);
  assert.match(html, /class="pdfIgnore" data-ce-report-settings-toggle-row style="text-align:right;display:flex;justify-content:flex-end;align-items:center;gap:10px;"/);
  assert.doesNotMatch(html, /reportSettingsToggleRow/);
  assert.match(html, /data-ce-report-settings-toggle/);
  assert.match(html, /data-testid="ce-polis-settings-toggle"/);
  assert.match(html, /data-ce-report-settings-toggle[^>]*aria-label="Show report settings"/);
  assert.match(html, /data-ce-report-settings-toggle[^>]*style="background:transparent;border:none;padding:0;cursor:pointer;margin-right:10px;color:inherit;"/);
  assert.match(html, /data-ce-report-settings-row/);
  assert.match(html, /class="pdfIgnore settingsRow" data-ce-report-settings-row hidden>/);
  assert.doesNotMatch(html, /class="settingsRow pdfIgnore" data-ce-report-settings-row/);
  assert.doesNotMatch(html, /class="pdfIgnore settingsRow" data-ce-report-settings-row>/);
  assert.match(html, /polisReportContainer[\s\S]*data-ce-report-settings-toggle-row[\s\S]*pdfIgnore settingsRow[\s\S]*reportInner/);
  assert.ok(modeSurfacesStart > polisContainerStart);
  assert.match(html, /class="ce-results-mode-surfaces"/);
  assert.doesNotMatch(polisContainerMarkup, /<small>/);
  assert.match(polisContainerMarkup, /data-ce-section-subtitle="Beeswarm plus statement-level agreement and difference"/);
  assert.match(polisContainerMarkup, /<span class="aidb-section-title">Consensus and Difference<\/span>/);
  assert.doesNotMatch(polisContainerMarkup, /Highest Difference Statements/);
  assert.doesNotMatch(polisContainerMarkup, /Highest Consensus/);
  assert.match(polisContainerMarkup, /data-ce-static-collapsible/);
  assert.match(polisContainerMarkup, /data-ce-collapsible-toggle role="button" tabindex="0" aria-expanded="true"/);
  assert.match(polisContainerMarkup, /data-ce-collapsible-body/);
  assert.match(polisContainerMarkup, /id="all-questions"[\s\S]*data-ce-collapsible-open="true"[\s\S]*data-ce-default-open="true"[\s\S]*aria-expanded="true"/);
  assert.match(polisContainerMarkup, /id="participants-list"[\s\S]*data-ce-collapsible-open="true"[\s\S]*data-ce-default-open="true"[\s\S]*aria-expanded="true"/);
  assert.doesNotMatch(polisContainerMarkup, /<summary class="sectionHeaderRow/);
  assert.doesNotMatch(polisContainerMarkup, /id="debate-atlas"/);
  assert.doesNotMatch(polisContainerMarkup, /id="breakdown"/);
  assert.doesNotMatch(polisContainerMarkup, /id="risk-matrix"/);
  assert.match(html.slice(modeSurfacesStart), /class="ce-report-section ce-results-mode-pane aidb-mode-pane[^"]*"[\s\S]*id="debate-atlas"|id="debate-atlas"[\s\S]*class="ce-report-section ce-results-mode-pane aidb-mode-pane/);
  assert.match(html.slice(modeSurfacesStart), /id="snapshot-json"[\s\S]*class="ce-report-section ce-results-mode-pane aidb-mode-pane aidb-raw-results-modal-pane|class="ce-report-section ce-results-mode-pane aidb-mode-pane aidb-raw-results-modal-pane[\s\S]*id="snapshot-json"/);
  assert.doesNotMatch(html.slice(modeSurfacesStart), /ce-results-mode-pane aidb-view-section/);
  assert.doesNotMatch(html.slice(modeSurfacesStart), /class="ce-results-mode-pane-header"/);
  assert.match(html, /data-ce-pane-title="Debate Map"/);
  assert.match(html, /data-ce-pane-subtitle="Circle prominence currently reflects question count; quadratic importance allocations can replace this fallback"/);
  assert.match(html, /class="[^"]*aidb-raw-results-modal-pane/);
  assert.doesNotMatch(html, /class="[^"]*aidb-raw-results-modal-pane resultsModal/);
  assert.match(html, /class="modal-dialog resultsModal aidb-raw-results-dialog" role="document"/);
  assert.match(html, /class="modal-content aidb-raw-results-surface"/);
  assert.match(html, /\.aidb-raw-results-modal-pane \{ position: fixed; inset: 0; z-index: 1050; display: flex; align-items: flex-start; justify-content: center;/);
  assert.match(html, /\.aidb-raw-results-modal-pane\[hidden\] \{ display: none !important; \}/);
  assert.match(html, /\.aidb-raw-results-modal-pane > \.aidb-section-body\.graphSection \{ width: min\(100%, 1120px\); margin: 0 auto; padding: 0; background: transparent; \}/);
  assert.match(html, /body\[data-ce-raw-results-open="true"\] \{ overflow: hidden; \}/);
  assert.match(html, /\.resultsModal \{ max-width: 80%; width: 100%; background-color: var\(--ce-color-white\); overflow-y: auto; display: flex; flex-direction: column; border-radius: var\(--ce-radius-12\); \}/);
  assert.doesNotMatch(html, /\.resultsModal \{ max-width: none;/);
  assert.doesNotMatch(html, /\.aidb-raw-results-modal-pane\.resultsModal/);
  assert.match(html, /\.modalHeader \{ display: flex; position: relative; flex-direction: row; flex-wrap: wrap; overflow-wrap: anywhere; justify-content: space-between; align-items: center; border-bottom: 1px solid #dee2e6; padding-right: 4\.5rem; padding-bottom: 1rem; border-top-left-radius: 12px; border-top-right-radius: 12px; \}/);
  assert.match(html, /\.modalHeaderContent \{ display: flex; flex-direction: row; flex-wrap: wrap; flex-grow: 1; margin-right: 1rem; gap: 10px; \}/);
  assert.match(html, /\.modalHeaderControls \{ display: flex; align-items: center; justify-content: flex-end; gap: 10px; flex-wrap: wrap; margin-left: auto; \}/);
  assert.doesNotMatch(html, /\.modalHeader \{[^}]*padding: 1rem 4\.5rem 1rem 1rem/);
  assert.doesNotMatch(html, /\.modalHeader \{[^}]*background: #fff/);
  assert.doesNotMatch(html, /\.modalHeaderContent \{[^}]*min-width: 0/);
  assert.doesNotMatch(html, /\.modalHeaderControls \{[^}]*min-width: 0/);
  assert.match(html, /\.modalTitle \{ font-size: 2\.5rem; font-weight: bold; margin: 0; color: var\(--ce-color-black\); \}/);
  assert.doesNotMatch(html, /\.modalTitle \{[^}]*line-height: 1\.1/);
  assert.doesNotMatch(html, /class="modalSubtitle"/);
  assert.doesNotMatch(html, /class="surveyIdMeta"/);
  assert.doesNotMatch(html, /\.surveyIdMeta \{/);
  assert.doesNotMatch(html, /<section class="modal-header modalHeader">[\s\S]*Benchmark:/);
  assert.doesNotMatch(html, /<section class="modal-header modalHeader">[\s\S]*Generated:/);
  assert.match(html, /\.demoResultsViewButtonActive \{ background: #0f5ec7; border-color: #0f5ec7; color: var\(--ce-color-white\); box-shadow: 0 10px 24px rgba\(15, 94, 199, 0\.2\); \}/);
  assert.match(html, /\.demoResultsViewButtonActive:hover, \.demoResultsViewButtonActive:focus \{ background: #0b4da6; border-color: #0b4da6; color: var\(--ce-color-white\); \}/);
  assert.doesNotMatch(html, /\.demoResultsViewButtonActive[^}]*transform: none/);
  assert.match(html, /@media \(max-width: 768px\) \{\s*\.resultsModal \{ max-width: 95vw; \}/);
  assert.match(html, /\.aidb-raw-results-dialog \{ margin: 0\.5rem auto; \}/);
  assert.match(html, /\.modalHeader \{ flex-wrap: wrap; gap: 10px; padding-right: 7rem; \}/);
  assert.match(html, /\.modalHeaderTitleBlock \{ width: 100%; \}/);
  assert.match(html, /\.modalTitle \{ font-size: 1\.8rem; \}/);
  assert.match(html, /@media \(max-width: 767px\) \{\s*\.modalHeaderControls \{ width: 100%; justify-content: flex-start; flex-wrap: nowrap; gap: 6px; overflow-x: auto; padding-bottom: 2px; \}/);
  const rawResultsModalShellMediaStart = html.indexOf('@media (max-width: 768px) {', html.indexOf('.resultsModal { max-width: 95vw; }'));
  const rawResultsModalTabStripMediaStart = html.indexOf('@media (max-width: 767px) {', rawResultsModalShellMediaStart);
  assert.ok(rawResultsModalTabStripMediaStart > rawResultsModalShellMediaStart);
  assert.doesNotMatch(
    html.slice(rawResultsModalShellMediaStart, rawResultsModalTabStripMediaStart),
    /\.modalHeaderControls \{ width: 100%; justify-content: flex-start; flex-wrap: nowrap; gap: 6px; overflow-x: auto; padding-bottom: 2px; \}/
  );
  assert.match(html, /\.modalHeaderControls \{ width: 100%; justify-content: flex-start; flex-wrap: nowrap; gap: 6px; overflow-x: auto; padding-bottom: 2px; \}/);
  assert.match(html, /\.demoResultsViewNav \{ width: auto; min-width: 0; flex: 1 1 auto; flex-wrap: nowrap; gap: 6px; \}/);
  assert.match(html, /\.demoResultsViewButton \{ flex: 0 0 auto; justify-content: center; min-height: 34px; padding: 0\.38rem 0\.64rem; font-size: 0\.84rem; \}/);
  assert.match(html, /\.aidb-raw-results-dialog \{ position: relative; width: 100%; margin: 0 auto; pointer-events: none; \}/);
  assert.doesNotMatch(html, /\.aidb-raw-results-dialog \{[^}]*width: min\(100%, 1120px\)/);
  assert.match(html, /\.aidb-raw-results-dialog \.modal-content \{ pointer-events: auto; \}/);
  assert.match(html, /\.aidb-raw-results-surface \{ background: #fff; color: #111827; border: 1px solid rgba\(15, 23, 42, 0\.16\); border-radius: var\(--ce-radius-12\); box-shadow: 0 24px 70px rgba\(15, 23, 42, 0\.34\); overflow: hidden; opacity: 1; \}/);
  assert.match(html, /class="modal-header modalHeader"/);
  assert.match(html, /class="modal-header modalHeader"[\s\S]*<h2 class="modalTitle">Question Results<\/h2>[\s\S]*data-ce-close-raw-results/);
  assert.match(html, /class="demoResultsViewNav" aria-label="Demo results views" data-testid="ce-surveyresults-demo-view-nav"/);
  assert.match(html, /class="demoResultsViewButton demoResultsViewButtonActive" aria-pressed="true" data-ce-raw-demo-view="report" data-testid="ce-surveyresults-demo-view-report">Report<\/button>/);
  assert.match(html, /class="demoResultsViewButton" aria-pressed="false" data-ce-raw-demo-view="debate-atlas" data-testid="ce-surveyresults-demo-view-atlas">Debate Map<\/button>/);
  assert.match(html, /class="demoResultsViewButton" aria-pressed="false" data-ce-raw-demo-view="breakdown" data-testid="ce-surveyresults-demo-view-breakdown">Breakdown<\/button>/);
  assert.match(html, /class="demoResultsViewButton" aria-pressed="false" data-ce-raw-demo-view="risk-matrix" data-testid="ce-surveyresults-demo-view-riskMatrix">Risk Matrix<\/button>/);
  assert.doesNotMatch(html, /class="demoResultsViewButton demoResultsViewButtonActive" aria-pressed="true">Raw<\/button>/);
  assert.doesNotMatch(html, /data-ce-raw-demo-view="debate-atlas"[^>]*>Atlas<\/button>/);
  assert.match(html, /class="modal-body modalBody aidb-raw-results-modal-body"/);
  assert.match(html, /var rawDemoViewButtons = Array\.from\(document\.querySelectorAll\('\[data-ce-raw-demo-view\]'\)\);/);
  assert.match(html, /function setRawDemoViewActive\(mode\) \{/);
  assert.match(html, /button\.classList\.toggle\('demoResultsViewButtonActive', isActive\);/);
  assert.match(html, /button\.setAttribute\('aria-pressed', isActive \? 'true' : 'false'\);/);
  assert.match(html, /setRawDemoViewActive\(displayMode\);/);
  assert.match(html, /rawDemoViewButtons\.forEach\(function \(button\) \{/);
  assert.match(html, /var nextMode = button\.getAttribute\('data-ce-raw-demo-view'\) \|\| 'report';/);
  assert.match(html, /<section class="modal-footer aidb-raw-results-footer"><\/section>/);
  assert.doesNotMatch(html, /<button type="button" class="htmlReportCancelButton" data-ce-close-raw-results>Cancel<\/button>/);
  assert.match(html, /\.downloadButton \{ background-color: var\(--ce-color-bg\) !important; background-image: none !important; border: 1px solid var\(--ce-color-bg\) !important; color: var\(--ce-color-white\) !important;/);
  assert.match(html, /class="close htmlReportCloseButton rawResultsCloseButton"/);
  assert.match(html, /\.modalHeader \.close,\s*\.modalHeader \.btn-close,\s*\.rawResultsCloseButton \{ position: absolute; top: 0\.85rem; right: 0\.85rem; z-index: 2; background: transparent; border: 0; box-shadow: none; color: #0f1222; opacity: 1; margin: 0; padding: 0\.25rem; align-self: flex-start; \}/);
  assert.match(html, /\.modalHeader \.close:hover,\s*\.modalHeader \.close:focus,\s*\.modalHeader \.btn-close:hover,\s*\.modalHeader \.btn-close:focus,\s*\.rawResultsCloseButton:hover,\s*\.rawResultsCloseButton:focus \{ background: transparent; color: #0f1222; opacity: 1; outline: none; \}/);
  assert.match(html, /\.htmlReportCloseButton \{ appearance: none; border: 0; background: transparent; color: #0f1222; cursor: pointer; font-size: 1\.5rem; font-weight: 700; line-height: 1; margin: 0; opacity: 1; padding: 0\.25rem; box-shadow: none; \}/);
  assert.match(html, /\.htmlReportCloseButton span \{ color: inherit; font-size: inherit; font-weight: inherit; letter-spacing: 0; line-height: inherit; text-transform: none; \}/);
  assert.doesNotMatch(html, /\.htmlReportCloseButton \{[^}]*margin: -0\.25rem -0\.25rem -0\.25rem auto/);
  assert.doesNotMatch(html, /\.htmlReportCloseButton \{[^}]*opacity: 0\.85/);
  assert.match(html, /class="exportDataBox aidb-raw-export-box" data-ce-export-data-box/);
  assert.match(html, /<button type="button" class="exportToggleButton" aria-expanded="false" aria-controls="surveyResultsExportArea" data-ce-export-toggle>Export Data<\/button>/);
  assert.match(html, /class="exportAreaExpanded" id="surveyResultsExportArea" hidden/);
  assert.match(html, /class="exportAreaHeader"[\s\S]*<label for="exportType" class="exportLabel">Export Data:<\/label>[\s\S]*class="exportCollapseButton" aria-label="Collapse export area" data-ce-export-toggle/);
  assert.doesNotMatch(html, /aria-disabled="true" disabled/);
  assert.match(html, /<button type="button" id="exportType" class="downloadButton" data-ce-download-snapshot>Download Snapshot JSON<\/button>/);
  assert.match(html, /data-icon="caret-up" class="svg-inline--fa fa-caret-up exportCollapseIcon"/);
  assert.match(html, /\.exportToggleButton \{ white-space: nowrap; background: rgba\(255, 255, 255, 0\.92\) !important; border: 1px solid rgba\(15, 23, 42, 0\.14\) !important; box-shadow: none !important; color: #111827 !important; font-weight: 600;/);
  assert.match(html, /\.exportCollapseButton \{ padding: 0 !important; min-width: auto; line-height: 1; color: #334155 !important;/);
  assert.match(html, /\.exportCollapseIcon \{ width: 1em; height: 1em; display: inline-block; overflow: visible; vertical-align: -0\.125em; \}/);
  assert.match(html, /\.exportDataBox \{ align-items: flex-end; flex: 0 1 auto; min-width: 0; \}/);
  assert.match(html, /\.exportToggleButton \{ min-height: 42px; padding: 0\.5rem 0\.75rem !important; font-size: 0\.95rem; line-height: 1\.1; \}/);
  assert.match(html, /\.exportAreaExpanded \{ align-items: flex-end; width: 100%; max-width: min\(100%, 360px\); padding: 8px; \}/);
  assert.match(html, /#exportOptions \{ flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: flex-end; width: 100%; gap: 8px; \}/);
  assert.match(html, /\.downloadButton \{ width: 100%; \}/);
  assert.match(html, /var exportToggleButtons = Array\.from\(document\.querySelectorAll\('\[data-ce-export-toggle\]'\)\);/);
  assert.match(html, /function setExportAreaOpen\(isOpen\) \{/);
  assert.match(html, /setExportAreaOpen\(false\);/);
  assert.match(html, /id="exportOptions"/);
  assert.doesNotMatch(html, /class="htmlReportOptionGroup"/);
  assert.match(html, /class="aidb-json-details htmlReportJsonDetails rawResultsJsonDetails"/);
  assert.doesNotMatch(html, /class="aidb-json-details rawResultsJsonDetails"/);
  assert.match(html, /\.rawResultsJsonDetails > summary \{ cursor: pointer; color: #111827; font-weight: 800; \}/);
  assert.match(html, /class="jsonContainer"><pre class="jsonDisplay">/);
  assert.match(html, /\.jsonDisplay \{ max-height: 460px; margin-top: 12px; background-color: #037df8;/);
  assert.match(html, /class="table-responsive htmlReportSectionTableResponsive"/);
  assert.match(html, /class="table table-sm htmlReportSectionTable"/);
  assert.match(html, /\.htmlReportSectionTableResponsive \{ width: 100%; margin: 1rem 0; overflow-x: auto; -webkit-overflow-scrolling: touch; \}/);
  assert.match(html, /\.htmlReportSectionTable \{ width: 100%; min-width: 640px; max-width: none; margin: 0; border-collapse: collapse; table-layout: auto;/);
  assert.match(html, /\.htmlReportSectionTable th, \.htmlReportSectionTable td \{ overflow-wrap: anywhere; \}/);
  assert.match(html, /\.htmlReportSectionTable th:first-child, \.htmlReportSectionTable td:first-child \{ width: 4\.25rem; text-align: center; \}/);
  assert.doesNotMatch(html, /\.htmlReportSectionTable th:first-child, \.htmlReportSectionTable td:first-child \{ min-width: 3\.25rem; width: 3\.25rem; \}/);
  assert.doesNotMatch(html, /\.htmlReportSectionTable \{ display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; \}/);
  assert.match(html, /class="htmlReportWarning"/);
  assert.match(html, /Context Engine Polis Import JSON/);
  assert.match(html, /CE Import JSON/);
  assert.match(html, /querySelectorAll\('\[data-ce-download-snapshot\]'\)/);
  assert.match(html, /querySelectorAll\('\[data-ce-download-polis-export\]'\)/);
  assert.match(html, /function downloadJsonFromElement/);
  assert.match(html, /function getHashTarget\(\)/);
  assert.match(html, /target\.closest\('\[data-ce-report-mode-section\]'\)/);
  assert.match(html, /function getScrollTargetForMode\(mode\)/);
  assert.match(html, /function scrollToReportViewTarget\(target\)/);
  assert.match(html, /target\.getBoundingClientRect\(\)\.top \+ yOffset - 24/);
  assert.match(html, /var htmlScrollBehavior = document\.documentElement && document\.documentElement\.style/);
  assert.match(html, /document\.documentElement\.style\.scrollBehavior = 'auto';/);
  assert.match(html, /document\.body\.style\.scrollBehavior = 'auto';/);
  assert.match(html, /window\.scrollTo\(\{ top: nextTop, left: xOffset, behavior: 'auto' \}\);/);
  assert.match(html, /document\.documentElement\.style\.scrollBehavior = htmlScrollBehavior;/);
  assert.match(html, /document\.body\.style\.scrollBehavior = bodyScrollBehavior;/);
  assert.match(html, /window\.scrollTo\(xOffset, nextTop\);/);
  assert.match(html, /if \(window\.requestAnimationFrame\) window\.requestAnimationFrame\(scroll\);/);
  assert.match(html, /window\.setTimeout\(scroll, 80\);/);
  assert.match(html, /window\.setTimeout\(scroll, 240\);/);
  assert.match(html, /window\.setTimeout\(scroll, 600\);/);
  assert.match(html, /setStaticSectionOpen\(containingSection, true\)/);
  assert.match(html, /var target = getScrollTargetForMode\(nextMode\);/);
  assert.match(html, /window\.addEventListener\('hashchange', function \(\) \{\s*notifyParentHash\(\);\s*if \(syncTagModalWithHash\(\)\) return;\s*setReportViewMode\(modeFromHash\(\), \{ scroll: true \}\);/);
  assert.doesNotMatch(html.slice(modeSurfacesStart), /id="debate-atlas"[\s\S]*?aidb-summary-toggle/);
  assert.match(html, /class="pdfIgnore settingsRow"/);
  assert.match(html, /Download as PDF/);
  assert.match(html, /data-icon="info-circle" class="svg-inline--fa fa-info-circle" style="margin-left:4px;"/);
  assert.doesNotMatch(html, /settingsInfoIcon/);
  assert.match(html, /data-ce-static-pdf-button/);
  assert.match(html, /data-ce-static-pdf-button title="Download the currently open sections of the report"/);
  assert.doesNotMatch(html, /PDF export is available in live Context Engine sessions/);
  assert.doesNotMatch(html, /data-ce-static-pdf-button[^>]*disabled/);
  assert.match(html, /staticPdfButton\.addEventListener\('click'/);
  assert.match(html, /window\.print\(\)/);
  assert.match(html, /type: 'ce-benchmark-hash-change'/);
  assert.match(html, /type !== 'ce-benchmark-set-hash'/);
  assert.match(html, /notifyParentHash\(\)/);
  assert.match(html, /<div style="margin-right:12px;position:relative;">\s*<button type="button" data-ce-static-pdf-button[^>]*style="padding:6px 12px;cursor:pointer;margin-right:4px;">Download as PDF/);
  assert.match(html, /<label class="demoToggleLabel" style="margin-right:10px;">\s*<input type="checkbox" class="demoToggleCheckbox" checked>\s*Demo Data/);
  assert.match(html, /<label class="demoToggleLabel" style="margin-right:5px;">\s*<input type="checkbox" checked style="margin-right:4px;cursor:pointer;">\s*Show Explainers/);
  assert.match(html, /<label class="demoToggleLabel" for="report-style-select" style="margin-right:6px;">Report style:<\/label>/);
  assert.match(html, /<button type="button" style="margin-right:4px;" data-ce-report-collapse-all>Collapse All<\/button>/);
  assert.match(html, /<button type="button" style="margin-right:8px;" data-ce-report-expand-all>Expand All<\/button>/);
  assert.doesNotMatch(html, /class="demoToggleCheckbox" checked disabled/);
  assert.match(html, /id="report-style-select" class="reportStyleSelect" aria-label="Report style" data-ce-report-style-select/);
  assert.match(html, /<option value="original" selected>Original<\/option>/);
  assert.match(html, /<option value="original" selected>Original<\/option>\s*<option value="modern">Modern<\/option>/);
  assert.match(html, /\.polisReportModern \{ background: radial-gradient\(900px 600px at 5% 0%, rgba\(122, 160, 255, 0\.2\), transparent 60%\), radial-gradient\(700px 500px at 95% 8%, rgba\(255, 180, 220, 0\.18\), transparent 55%\), #f4f6ff;/);
  assert.match(html, /\.polisReportDark \{ background: radial-gradient\(1000px 700px at 5% 0%, rgba\(80, 110, 255, 0\.18\), transparent 60%\), radial-gradient\(700px 500px at 95% 10%, rgba\(120, 90, 200, 0\.18\), transparent 55%\), #0b1020;/);
  assert.match(html, /\.reportInnerModern \{ background: rgba\(255, 255, 255, 0\.95\); border: none; border-radius: var\(--ce-radius-6\); padding: 24px;/);
  assert.match(html, /\.reportInnerDark \{ background: #0b1120; border: 1px solid #1f2937; border-radius: var\(--ce-radius-6\); padding: 24px;/);
  assert.match(html, /\.polisReportModern \.sectionHeader, \.polisReportModern \.sectionTitle, \.polisReportModern \.aidb-view-section \.sectionHeader, \.polisReportModern \.aidb-view-section \.sectionTitle \{ font-weight: 700; color: #1f2a44; \}/);
  assert.match(html, /\.polisReportDark \.sectionHeader, \.polisReportDark \.sectionTitle, \.polisReportDark \.aidb-view-section \.sectionHeader, \.polisReportDark \.aidb-view-section \.sectionTitle \{ font-weight: 700; color: #f3f4f6; \}/);
  assert.match(html, /var reportStyleSelect = document\.querySelector\('\[data-ce-report-style-select\]'\);/);
  assert.match(html, /function setReportStyle\(style\)/);
  assert.match(html, /reportShell\.classList\.toggle\('polisReportModern', nextStyle === 'modern'\)/);
  assert.match(html, /reportInner\.classList\.toggle\('reportInnerDark', nextStyle === 'dark'\)/);
  assert.match(html, /document\.body\.setAttribute\('data-ce-report-style', nextStyle\)/);
  assert.match(html, /data-ce-report-collapse-all/);
  assert.match(html, /data-ce-report-expand-all/);
  assert.doesNotMatch(html, /class="settingsSearchLabel"/);
  assert.doesNotMatch(html, /data-ce-report-search/);
  assert.match(html, /\.settingsRow \{ margin-bottom: 10px; display: flex; flex-direction: row; justify-content: space-between; align-items: center; background: #8080805e; padding: 10px; \}/);
  assert.doesNotMatch(html, /settingsControlGroup/);
  assert.doesNotMatch(html, /settingsPrimaryButton/);
  assert.doesNotMatch(html, /settingsActionButton/);
  assert.doesNotMatch(html, /\.settingsControlGroup/);
  assert.doesNotMatch(html, /\.settingsPrimaryButton/);
  assert.doesNotMatch(html, /\.settingsActionButton/);
  assert.match(html, /\.pdfIgnore \{ display: block; \}\s*\.settingsRow\.pdfIgnore \{ display: flex; \}\s*\.settingsRow > div \{ display: inline-flex; align-items: center; min-width: 0; \}/);
  assert.match(html, /@media \(max-width: 768px\) \{[\s\S]*?\.settingsRow \{ flex-wrap: wrap; justify-content: flex-start; gap: 10px; \}/);
  assert.match(html, /\.pdfIgnore \{ display: block; \}/);
  assert.match(html, /@media print \{[\s\S]*?\.pdfIgnore \{ display: none !important; \}[\s\S]*?\.beeTooltip \{ display: none !important; \}[\s\S]*?\.aidb-benchmark-intro \{ background: #ffffff; color: #111827; \}/);
  assert.match(html, /\.pdfMode \.pdfIgnore \{ display: none !important; \}/);
  assert.match(html, /\.pdfMode \.showWhenPdf \{ display: inline; \}/);
  assert.match(html, /\.pdfMode \.beeTooltip \{ display: none !important; \}/);
  assert.match(html, /\.showWhenPdf \{ display: none; \}/);
  assert.match(html, /\.ce-polis-report-shell \.sectionHeaderRow \{ align-items: center; justify-content: space-between; \}/);
  assert.match(html, /\.aidb-section-body \{ display: block; padding: 0; margin: 0; \}/);
  assert.doesNotMatch(html, /\.aidb-section-body \{ padding: 8px; margin-top: 8px; margin-bottom: 8px; \}/);
  assert.match(html, /\.aidb-section-body\.graphSection \{ display: flex; flex-wrap: wrap; margin-bottom: 20px; padding: 0; \}/);
  assert.match(html, /\.statsSectionCollapsible \{ padding: 8px; margin-top: 8px; margin-bottom: 8px; \}/);
  assert.match(html, /<div class="pdfIgnore aidb-summary-toggle">\s*<span data-ce-summary-toggle-label>Hide<\/span>\s*<span class="showWhenPdf aidb-omitted-note" data-ce-summary-toggle-omitted hidden>\(Omitted\)<\/span>\s*<\/div>/);
  assert.match(html, /\.aidb-omitted-note \{ margin-left: 10px; color: #555; \}/);
  assert.doesNotMatch(html, /\.aidb-summary-toggle::after/);
  assert.match(html, /\.aidb-native-summary \{ display: flex; align-items: center; justify-content: space-between; padding: 0; border: 0; list-style: none; flex-wrap: nowrap; width: 100%; \}/);
  assert.doesNotMatch(html, /\.aidb-native-summary \{[^}]*gap: 18px/);
  assert.doesNotMatch(html, /\.aidb-view-section \.sectionHeader \{[^}]*gap: 0;/);
  assert.match(html, /data-icon="caret-up" class="svg-inline--fa fa-caret-up aidb-section-caret-icon aidb-section-caret-up"/);
  assert.match(html, /data-icon="caret-down" class="svg-inline--fa fa-caret-down aidb-section-caret-icon aidb-section-caret-down"/);
  assert.match(html, /\.aidb-section-caret \{ display: inline-flex; margin-right: 6px; color: inherit; font-size: 1em; line-height: 1; \}/);
  assert.match(html, /\.aidb-section-caret-icon \{ width: 1em; height: 1em; display: inline-block; overflow: visible; vertical-align: -0\.125em; \}/);
  assert.match(html, /\[data-ce-static-collapsible\]\[data-ce-collapsible-open="false"\] \.aidb-section-caret-down \{ display: inline-block; \}/);
  assert.doesNotMatch(html, /\.aidb-section-caret::before/);
  assert.match(html, /\.demoToggleLabel \{ font-size: 0\.9rem; color: #555; cursor: pointer; \}/);
  assert.doesNotMatch(html, /\.demoToggleLabel \{[^}]*display: inline-flex/);
  assert.doesNotMatch(html, /\.demoToggleLabel \{[^}]*white-space: nowrap/);
  assert.match(html, /\.reportStyleSelect \{ padding: 4px 10px;/);
  assert.match(html, /class="sectionHeaderActionsScroller resultsModeActionsScroller"/);
  assert.match(html, /class="sectionHeaderActions resultsModeActions"/);
  assert.match(html, /\.sectionHeaderActionsScroller \{ box-sizing: border-box; display: flex; flex: 1 1 320px; justify-content: flex-end; max-width: 100%; min-width: 0; overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; \}/);
  assert.match(html, /class="tooltip sectionHeaderTooltip"/);
  assert.match(html, /data-icon="question-circle" class="svg-inline--fa fa-question-circle"/);
  assert.doesNotMatch(html, /data-icon="question-circle" class="svg-inline--fa fa-question-circle resultsTooltipIcon"/);
  assert.doesNotMatch(html, /class="resultsTooltipIcon" aria-hidden="true">\?<\/span>/);
  assert.doesNotMatch(html, /\.tooltip > \.resultsTooltipIcon/);
  assert.match(html, /class="tooltiptext">Click “Raw Results” to explore detailed breakdowns, filter by group membership, and export a pol\.is report\.<\/span>/);
  assert.match(html, /\.tooltip \.tooltiptext/);
  assert.match(html, /\.tooltip > svg \{ color: rgba\(255, 255, 255, 0\.75\); opacity: 0\.1; transition: opacity 0\.25s ease; \}/);
  assert.match(html, /\.tooltip:hover > svg,\s*\.tooltip:focus-within > svg,\s*\.tooltip:focus > svg \{ opacity: 0\.55; \}/);
  assert.match(html, /@media only screen and \(max-width: 600px\) \{\s*\.ce-session-results-section > \.sectionHeaderRow > \.sectionHeader \.tooltip \.tooltiptext \{ left: auto; right: -10px; transform: none; text-align: left; \}/);
  assert.match(html, /\.ce-session-results-section > \.sectionHeaderRow > \.sectionHeader \.tooltip \.tooltiptext::after \{ left: auto; right: 15px; margin-left: 0; \}/);
  assert.match(html, /\.sectionHeaderTooltip \{ margin-left: 6px; margin-top: 2px; align-self: flex-start; flex: 0 0 auto; \}/);
  assert.match(html, /@media only screen and \(max-width: 1024px\)[\s\S]*\.resultsModeActionsScroller/);
  assert.doesNotMatch(html, /@media \(max-width: 1024px\) \{\s*main\.onePageDemoContainer/);
  assert.doesNotMatch(html, /@media \(max-width: 1024px\) \{\s*\.resultsModeActionsScroller/);
  assert.match(html, /@media only screen and \(min-width: 768px\) and \(max-width: 1024px\) \{\s*\.onePageDemoContainer \{ font-size: 1\.15rem; padding: 15px 25px; padding-top: 0 !important; \}/);
  assert.match(html, /@media only screen and \(min-width: 601px\) and \(max-width: 767px\) \{\s*\.ce-session-results-section > \.sectionHeaderRow > \.sectionHeader \{ align-items: center; font-size: 1\.6em; padding-left: 10px; \}/);
  assert.doesNotMatch(html, /@media \(min-width: 601px\) and \(max-width: 767px\) \{\s*\.sectionHeader \{ align-items: center; font-size: 1\.6em; padding-left: 10px; \}/);
  assert.match(html, /<button type="button" class="sectionHeaderViewModeButton sectionHeaderViewModeButtonActive" data-ce-report-view-mode="report"/);
  assert.match(html, /class="sectionHeaderViewModeIcon"/);
  assert.match(html, /\.sectionHeaderViewModeIcon \{ display: inline-flex; align-items: center; justify-content: center; font-size: 1\.1rem; line-height: 1; \}/);
  assert.match(html, /sectionHeaderViewModeButton:hover/);
  assert.doesNotMatch(html, /\.sectionHeaderViewModeButton \{[^}]*appearance: none/);
  assert.doesNotMatch(html, /\.sectionHeaderViewModeButton \{[^}]*text-decoration: none/);
  assert.doesNotMatch(html, /\.sectionHeaderViewModeButton\[aria-pressed="true"\]/);
  assert.match(html, /rgba\(77, 255, 164, 0\.7\)/);
  assert.match(html, /<span class="sectionHeaderViewModeIcon" aria-hidden="true">🧾<\/span><span class="sectionHeaderViewModeLabel">Report<\/span>/);
  assert.match(html, /<span class="sectionHeaderViewModeIcon" aria-hidden="true">🗺️<\/span><span class="sectionHeaderViewModeLabel">Debate Map<\/span>/);
  assert.match(html, /<span class="sectionHeaderViewModeIcon" aria-hidden="true">📊<\/span><span class="sectionHeaderViewModeLabel">Breakdown<\/span>/);
  assert.match(html, /<span class="sectionHeaderViewModeIcon" aria-hidden="true">⚠️<\/span><span class="sectionHeaderViewModeLabel">Risk Matrix<\/span>/);
  assert.match(html, /class="sectionHeaderViewModeButton" data-ce-open-raw-results>/);
  assert.doesNotMatch(html, /data-ce-open-raw-results aria-expanded/);
  assert.doesNotMatch(html, /data-ce-open-raw-results aria-pressed/);
  assert.doesNotMatch(html, /data-ce-open-raw-results[^>]+title="Raw Results"/);
  assert.doesNotMatch(html, /sectionHeaderRawResultsButton/);
  assert.doesNotMatch(html, /data-ce-report-view-mode="snapshot-json" aria-pressed="false" title="Raw Results"/);
  assert.match(html, /<button type="button" class="sectionHeaderViewModeButton" data-ce-open-raw-results><svg[^>]+data-icon="expand" class="svg-inline--fa fa-expand"[\s\S]*?<\/svg>Raw Results<\/button>/);
  assert.doesNotMatch(html, /<span class="sectionHeaderViewModeIcon" aria-hidden="true"><svg[^>]+data-icon="expand"[\s\S]*?<\/svg><\/span><span class="sectionHeaderViewModeLabel">Raw Results<\/span>/);
  assert.doesNotMatch(html, /sectionHeaderRawResultsSvgIcon/);
  assert.match(html, /\.svg-inline--fa \{ display: inline-block; height: 1em; overflow: visible; vertical-align: -0\.125em; \}/);
  assert.doesNotMatch(html, /sectionHeaderRawResultsIcon::before/);
  assert.doesNotMatch(html, /aria-hidden="true">⛶<\/span><span class="sectionHeaderViewModeLabel">Raw Results/);
  assert.match(html, /data-icon="cog" class="svg-inline--fa fa-cog" style="font-size:1\.3rem;"/);
  assert.doesNotMatch(html, /reportSettingsToggleButton/);
  assert.doesNotMatch(html, /reportSettingsToggleIcon/);
  assert.doesNotMatch(html, /class="reportSettingsToggleIcon" aria-hidden="true">⚙<\/span>/);
  assert.match(html, /data-icon="caret-up" class="svg-inline--fa fa-caret-up sectionToggleIcon sectionToggleIconOpen"/);
  assert.match(html, /data-icon="caret-down" class="svg-inline--fa fa-caret-down sectionToggleIcon sectionToggleIconClosed"/);
  assert.match(html, /\.sectionToggleIcon \{ font-size: 1\.5em; margin-right: 10px; \}/);
  assert.doesNotMatch(html, /\.sectionHeaderViewModeSvgIcon \{/);
  assert.doesNotMatch(html, /\.sectionToggleIcon \{[^}]*width: 1em/);
  assert.match(html, /\.sectionToggleIconClosed \{ display: none; \}/);
  assert.match(html, /\.ce-session-results-section\[data-ce-results-open="false"\] \.sectionToggleIconOpen \{ display: none; \}/);
  assert.match(html, /\.ce-session-results-section\[data-ce-results-open="false"\] \.sectionToggleIconClosed \{ display: inline-block; \}/);
  assert.match(html, /\.ce-session-results-section\[data-ce-results-open="false"\] \.sectionHeaderTooltip \{ display: none; \}/);
  assert.match(html, /\.ce-session-results-section\[data-ce-results-open="false"\] \.resultsModeActionsScroller,\s*\.ce-session-results-section\[data-ce-results-open="false"\] \.miniSectionContent \{ display: none; \}/);
  assert.doesNotMatch(html, /sectionToggleIcon \{[^}]*transform: translateY/);
  assert.doesNotMatch(html, /sectionToggleIcon::before/);
  assert.match(html, /<div class="miniSectionContent">\s*<div>\s*<div class="polisReportContainer ce-polis-report-shell"/);
  assert.doesNotMatch(html, /<div class="miniSectionContent">\s*<div>\s*<div class="polisReportContainer ce-polis-report-shell polisReportModern"/);
  assert.doesNotMatch(html, /ce-results-mode-host/);
  assert.match(html, /\.ce-results-mode-pane \{ scroll-margin-top: 190px; \}/);
  assert.match(html, /\.ce-polis-report-shell \.sectionCollapse,\s*\.ce-polis-report-shell \.aidb-view-section,\s*\.ce-polis-report-shell \.questionListItem \{ scroll-margin-top: 24px; \}/);
  assert.doesNotMatch(html, /<span class="sectionCaret"/);
  assert.match(html, /data-ce-report-view-mode="debate-atlas"/);
  assert.match(html, /data-ce-report-mode-section="debate-atlas"/);
  assert.match(html, /function setReportViewMode/);
  assert.match(html, /var lastNonRawResultsMode = 'report';/);
  assert.match(html, /function setResultsSectionOpen\(isOpen\)/);
  assert.match(html, /resultsSection\.setAttribute\('data-ce-results-open', nextOpen \? 'true' : 'false'\);/);
  assert.match(html, /resultsSection\.classList\.toggle\('sectionExpanded', nextOpen\);/);
  assert.match(html, /resultsToggle\.setAttribute\('aria-expanded', nextOpen \? 'true' : 'false'\)/);
  assert.match(html, /var isRawResultsMode = nextMode === 'snapshot-json';/);
  assert.match(html, /var displayMode = isRawResultsMode \? lastNonRawResultsMode : nextMode;/);
  assert.match(html, /setResultsSectionOpen\(true\);\s*if \(!isRawResultsMode\)/);
  assert.match(html, /document\.body\.setAttribute\('data-ce-raw-results-open', isRawResultsMode \? 'true' : 'false'\);/);
  assert.match(html, /var shouldShow = isRawResultsMode\s*\?\s*\(sectionMode === 'snapshot-json' \|\| sectionMode === displayMode\)\s*:\s*sectionMode === displayMode;/);
  assert.match(html, /function getScrollTargetForMode\(mode\)/);
  assert.match(html, /return document\.querySelector\('\.ce-session-results-section'\) \|\| document\.getElementById\(mode\);/);
  assert.doesNotMatch(html, /return mode === 'report'\s*\?\s*document\.querySelector\('\.ce-session-results-section'\)\s*:\s*document\.getElementById\(mode\);/);
  assert.match(html, /if \(shouldScroll && target\) \{\s*scrollToReportViewTarget\(target\);\s*\}/);
  assert.doesNotMatch(html, /if \(shouldScroll && target && target\.scrollIntoView\)/);
  assert.match(html, /function syncInitialReportViewMode/);
  assert.match(html, /setReportViewMode\(modeFromHash\(\), \{ scroll: false \}\)/);
  assert.match(html, /setReportViewMode\(modeFromHash\(\), \{ scroll: false \}\);\s*if \(!syncTagModalWithHash\(\)\) syncAtlasIssueModalWithHash\(\);\s*syncInitialReportViewMode\(\);\s*notifyParentHash\(\);\s*setReportStyle/);
  assert.match(html, /window\.addEventListener\('load', syncInitialReportViewMode, \{ once: true \}\)/);
  assert.doesNotMatch(html, /if \(document\.readyState === 'complete'\) \{\s*syncInitialReportViewMode\(\);/);
  assert.match(html, /resultsToggle\.addEventListener\('click', function \(\) \{\s*setResultsSectionOpen\(resultsSection && resultsSection\.getAttribute\('data-ce-results-open'\) === 'false'\);/);
  assert.match(html, /resultsToggle\.addEventListener\('keydown', function \(event\) \{/);
  assert.match(html, /resultsTooltip\.addEventListener\('click', function \(event\) \{\s*event\.stopPropagation\(\);/);
  assert.match(html, /rawResultsButton\.addEventListener\('click'/);
  assert.match(html, /var closeRawResultsButtons = document\.querySelectorAll\('\[data-ce-close-raw-results\]'\);/);
  assert.match(html, /closeRawResultsButtons\.forEach\(function \(closeRawResultsButton\)/);
  assert.match(html, /closeRawResultsButton\.addEventListener\('click'/);
  assert.match(html, /rawResultsButton\.classList\.remove\('sectionHeaderViewModeButtonActive'\)/);
  assert.doesNotMatch(html, /rawResultsButton\.classList\.toggle\('sectionHeaderViewModeButtonActive', rawResultsActive\)/);
  assert.doesNotMatch(html, /rawResultsButton\.setAttribute\('aria-pressed', rawResultsActive \? 'true' : 'false'\)/);
  assert.doesNotMatch(html, /rawResultsButton\.setAttribute\('aria-pressed'/);
  assert.doesNotMatch(html, /rawResultsButton\.setAttribute\('aria-expanded'/);
  assert.doesNotMatch(html, /var rawResultsActive = nextMode === 'snapshot-json'/);
  assert.match(html, /setReportViewMode\('snapshot-json', \{ scroll: false \}\)/);
  assert.match(html, /var restoreMode = knownModes\.indexOf\(lastNonRawResultsMode\) === -1 \|\| lastNonRawResultsMode === 'snapshot-json'/);
  assert.match(html, /setReportViewMode\(restoreMode, \{ scroll: true \}\)/);
  assert.match(html, /function setStaticSectionOpen/);
  assert.match(html, /if \(label\) label\.textContent = nextOpen \? 'Hide' : 'Show';/);
  assert.match(html, /if \(omitted\) omitted\.hidden = nextOpen;/);
  assert.match(html, /staticCollapsibles\.forEach\(function \(section\) \{/);
  assert.match(html, /section\.hasAttribute\('data-ce-static-collapsible'\) && displayMode === 'report'/);
  assert.doesNotMatch(html, /section\.open = nextMode === 'report'/);
  assert.match(html, /<body class="index-page ce-report-viewer aidb-report" data-ce-results-view-mode="report" data-ce-report-style="original">/);
  assert.match(html, /setReportStyle\(reportStyleSelect \? reportStyleSelect\.value : 'original'\);/);
  assert.match(html, /data-ce-results-view-mode/);
  assert.match(html, /body:not\(\[data-ce-results-view-mode="report"\]\) \[data-ce-report-settings-toggle-row\]/);
  assert.match(html, /body:not\(\[data-ce-results-view-mode="report"\]\) \.ce-polis-report-shell/);
  assert.match(html, /body:not\(\[data-ce-results-view-mode="report"\]\) \.settingsRow/);
  assert.match(html, /settingsToggleButton\.addEventListener\('click'/);
  assert.match(html, /collapseAllButton\.addEventListener\('click'/);
  assert.match(html, /expandAllButton\.addEventListener\('click'/);
  assert.match(html, /\[data-ce-static-collapsible\]\[data-ce-report-mode-section="report"\]/);
  assert.doesNotMatch(html, /Context Engine report artifact/);
  assert.match(html, /data-ce-download-polis-export/);
  assert.match(html, /ce-ai-discourse-bench-polis-export/);
  assert.equal((html.match(/id="ce-ai-discourse-bench-report"/g) || []).length, 1);
  assert.equal((html.match(/id="ce-ai-discourse-bench-polis-export"/g) || []).length, 1);
  assert.match(html, /Model A/);
  assert.match(html, /Model B/);
  assert.doesNotMatch(html, /data-ce-report-mode-section="model-participants"/);
  assert.doesNotMatch(html, /data-ce-report-mode-section="polis-matrix"/);
  assert.doesNotMatch(html, /Model \/ Statement Matrix/);
  assert.match(html, /class="showWhenPdf participantIndex"/);
  assert.match(html, /<img src="data:image\/svg\+xml,%3Csvg[^"]+width%3D%2232%22[^"]+height%3D%2232%22[^"]+viewBox%3D%220%200%2032%2032%22/);
  assert.match(html, /alt="" width="24" height="24" class="participantBlockie">/);
  assert.match(html, /\.participantBlockie \{ border-radius: var\(--ce-radius-4\); flex: 0 0 auto; \}/);
  assert.match(html, /class="participantModelNumber"\s+style="--participant-model-color:#1f77b4"\s+title="Model marker 1"\s+aria-label="Model marker 1"\s*>1<\/span>/);
  assert.match(html, /\.participantModelNumber \{ display: inline-flex;[^}]*background: var\(--participant-model-color\);/);
  assert.match(html, /@media print \{[\s\S]*?\.participantModelNumber \{ display: none !important; \}/);
  assert.doesNotMatch(html, /aidb-participant-card/);
  assert.doesNotMatch(html, /aidb-participant-grid/);
  assert.doesNotMatch(html, /aidb-avatar/);
  assert.doesNotMatch(html, /aidb-chip-row/);
  assert.doesNotMatch(html, /aidb-model-blockie/);
  assert.match(html, /participantAddressFull/);
  assert.match(html, /participantAddressShort/);
  assert.match(html, /<div class="participantsList">/);
  assert.match(html, /<div class="participantListItem" data-ce-searchable title="[^"]+">/);
  assert.match(html, /\.participantsList \{ display: flex; flex-direction: column; gap: 8px; margin-top: 8px; width: 100%; \}/);
  assert.doesNotMatch(html, /\.participantsList \{[^}]*padding: 0/);
  assert.doesNotMatch(html, /<ol class="participantsList">/);
  assert.doesNotMatch(html, /<li class="participantListItem"/);
  assert.doesNotMatch(html, /class="aidb-participant-traits"/);
  assert.match(html, /\.questionList \{ margin-top: 10px; width: 100%; \}/);
  assert.doesNotMatch(html, /\.aidb-question-section \.questionList \{ max-height:/);
  assert.doesNotMatch(html, /\.aidb-question-section \.questionList \{[^}]*scrollbar-gutter: stable/);
  assert.match(html, /Participants Graph/);
  assert.match(html, /\.swarmLayoutContainer \{ width: 100%; max-width: 100%; min-width: 0; flex: 1 1 100%; box-sizing: border-box; \}/);
  assert.doesNotMatch(html, /\.swarmLayoutContainer \{[^}]*margin-bottom: 18px;/);
  assert.match(html, /class="swarmContainer"/);
  assert.match(html, /\.swarmContainer \{ position: relative; overflow-x: auto; overflow-y: hidden; \}/);
  assert.doesNotMatch(html, /\.swarmContainer \{[^}]*width: 100%/);
  assert.match(html, /@media \(max-width: 768px\) \{[\s\S]*\.swarmContainer \{ overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; scrollbar-width: none; \}/);
  assert.match(html, /@media \(max-width: 768px\) \{[\s\S]*\.swarmContainer::-webkit-scrollbar \{ display: none; \}/);
  assert.match(html, /data-ce-beeswarm-scroll-viewport/);
  assert.match(html, /class="swarmScrollControls"/);
  assert.match(html, /\.scrollButton \{ background: #f0f0f0; border: 1px solid var\(--ce-color-border-light\); border-radius: var\(--ce-radius-round\); width: 30px; height: 30px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background-color 0\.2s; \}/);
  assert.match(html, /\.scrollButton:hover \{ background: #e0e0e0; \}/);
  assert.doesNotMatch(html, /\.scrollButton \{[^}]*min-width: 32px; min-height: 32px;/);
  assert.match(html, /data-ce-beeswarm-scroll-controls/);
  assert.match(html, /data-ce-beeswarm-scroll="right"/);
  assert.match(html, /function updateBeeswarmScrollControls/);
  assert.match(html, /statements: '\.graph-statement'/);
  assert.match(html, /'radial-axes': '\.graph-radial-axes'/);
  assert.match(html, /node\.toggleAttribute\('hidden', !input\.checked\)/);
  assert.match(html, /<svg width="700" height="250" class="beeswarmSvg" role="img" aria-label="Questions by model disagreement and repeat consistency">/);
  assert.doesNotMatch(html, /class="beeswarmSvg" viewBox="0 0 700 250" preserveAspectRatio="none"/);
  assert.match(html, /class="beeswarmSvg"/);
  assert.match(html, /\.beeswarmSvg \{ border: 1px solid #ddd; background: var\(--ce-color-white\); overflow: scroll; \}/);
  assert.doesNotMatch(html, /\.beeswarmSvg \{[^}]*width: 100%/);
  assert.match(html, /class="beeswarmAxisTitle"[^>]*>Repeat consistency<\/text>/);
  assert.match(html, /class="beeswarmTickLabel"[^>]*>100%<\/text>/);
  assert.match(html, /class="beeswarmTickLabel"[^>]*>0%<\/text>/);
  assert.match(html, /<text class="beeswarmAxisLabel" x="62" y="232">Consensus<\/text>/);
  assert.match(html, /<text class="beeswarmAxisLabel" x="680" y="232" text-anchor="end">Difference<\/text>/);
  assert.match(html, /data-ce-beeswarm-point/);
  const mainBeeswarm = html.match(
    /<svg width="700" height="250" class="beeswarmSvg" role="img" aria-label="Questions by model disagreement and repeat consistency">[\s\S]*?<\/svg>/
  )?.[0];
  assert.ok(mainBeeswarm);
  assert.equal((mainBeeswarm.match(/data-question-has-votes="true"/g) || []).length, 1);
  assert.equal((mainBeeswarm.match(/data-question-has-votes="false"/g) || []).length, 0);
  assert.match(html, /data-question-status="2 modeled responses"/);
  assert.match(html, /data-question-extremity=/);
  assert.match(html, /data-question-difference=/);
  assert.match(html, /data-question-winning-response-consistency="1\.00"/);
  assert.match(html, /data-question-winning-responses=/);
  assert.match(html, /data-question-attempted-runs=/);
  assert.match(html, /data-question-prompt="Frontier AI developers should be required to disclose serious pre-deployment evaluation results to an independent regulator\."/);
  assert.match(html, /<circle class="beeswarmCircle" cx="[^"]+" cy="[^"]+" r="5" \/>/);
  assert.doesNotMatch(html, /<circle class="beeswarmCircle"[^>]+fill="/);
  assert.match(html, /\.beeswarmCircle \{ fill: steelblue; \}/);
  assert.match(html, /\.beeswarmCircleHover \{ fill: #ff9900; \}/);
  assert.match(html, /function setBeeswarmPointHovered\(point, isHovered\)/);
  assert.match(html, /circle\.classList\.toggle\('beeswarmCircleHover', !!isHovered\);/);
  assert.match(html, /setBeeswarmPointHovered\(point, true\);\s*renderBeeswarmTooltip\(point\);/);
  assert.match(html, /setBeeswarmPointHovered\(point, false\);\s*hideBeeswarmTooltip\(\);/);
  assert.doesNotMatch(html, /\.beeswarmCircle:hover \{ stroke-width:/);
  assert.match(html, /data-icon="chevron-left" class="svg-inline--fa fa-chevron-left"/);
  assert.match(html, /data-icon="chevron-right" class="svg-inline--fa fa-chevron-right"/);
  assert.doesNotMatch(html, /class="aidb-legend-row"/);
  assert.doesNotMatch(html, /\.aidb-legend-row/);
  assert.doesNotMatch(html, /class="aidb-dot/);
  assert.match(html, /data-ce-beeswarm-tooltip/);
  assert.match(html, /\.beeTooltip \{ position: absolute; width: 300px; background: var\(--ce-color-tooltip-bg\); border: 1px solid var\(--ce-color-tooltip-border\); padding: 10px; font-size: 0\.85rem; color: var\(--ce-color-tooltip-text\); pointer-events: auto; z-index: 999; box-shadow: 0 2px 6px rgba\(0, 0, 0, 0\.15\); \}/);
  assert.match(html, /'<div style="font-weight: bold; margin-bottom: 4px;">' \+ escapeText\(point\.dataset\.questionId\) \+ ': ' \+ escapeText\(point\.dataset\.questionPrompt\) \+ '<\/div>',/);
  assert.match(html, /'<div style="font-size: 0\.85rem; margin-bottom: 6px;"><strong>Agree:<\/strong> ' \+ escapeText\(point\.dataset\.questionAgree\)/);
  assert.match(html, /'<div style="font-size: 0\.85rem; margin-bottom: 6px;"><strong>Mean:<\/strong> ' \+ escapeText\(point\.dataset\.questionMean\)/);
  assert.match(html, /'<strong>' \+ escapeText\(differenceLabel\) \+ ':<\/strong> ' \+ escapeText\(point\.dataset\.questionDifference\)/);
  assert.match(html, /<strong>Winning-response consistency:<\/strong>/);
  assert.match(html, /point\.dataset\.questionAttemptedRuns/);
  assert.doesNotMatch(html, /\.beeTooltip strong \{ display: block;/);
  assert.doesNotMatch(html, /\.tooltipPrompt \{/);
  assert.doesNotMatch(html, /class="tooltipStats"/);
  assert.doesNotMatch(html, /\.tooltipStats span/);
  assert.match(html, /\.beeTooltip \.ce-report-muted \{ color: var\(--ce-color-tooltip-muted\); \}/);
  assert.match(html, /function renderBeeswarmTooltip/);
  assert.match(html, /var pageX = window\.pageXOffset \|\| document\.documentElement\.scrollLeft \|\| 0;/);
  assert.match(html, /beeswarmTooltip\.style\.left = \(pageX \+ Math\.max\(padding, left\)\) \+ 'px';/);
  assert.match(html, /id="embedding-choice-select"/);
  assert.match(html, /<option value="UMAP">UMAP<\/option>\s*<option value="SVD">SVD\/PCA<\/option>\s*<option value="POLIS" selected>Polis Auto<\/option>/);
  assert.match(html, /<input id="cluster-count-input" class="clusterNumberInput" data-ce-cluster-count-input type="number" value="[1-9][0-9]*" min="1" max="2" aria-label="Opinion-group count" title="Choose a deterministic K-medoids grouping/);
  assert.match(html, /Opinion Group/);
  assert.match(html, /Polis Auto/);
  assert.match(html, /id="embedding-choice-select" disabled aria-disabled="true" title="Static benchmark exports preserve the generated participant embedding\./);
  assert.doesNotMatch(html, /data-ce-graph-toggle="participants" checked disabled/);
  assert.doesNotMatch(html, /data-ce-graph-toggle="statements" disabled/);
  assert.match(html, /data-ce-graph-toggle="participants"/);
  assert.match(html, /data-ce-graph-toggle="statements"/);
  assert.match(html, /data-ce-graph-toggle="outline"/);
  assert.match(html, /data-ce-graph-toggle="axes"/);
  assert.match(html, /data-ce-graph-toggle="radial-axes" checked/);
  assert.match(html, /class="participantGraphControls"/);
  assert.match(html, /\.participantGraphControls \{ display: flex; flex-wrap: wrap; gap: 15px 20px; \}/);
  assert.doesNotMatch(html, /\.participantGraphControls \{[^}]*align-items: center/);
  assert.doesNotMatch(html, /\.participantGraphControls \{[^}]*margin: 0 0 15px/);
  assert.doesNotMatch(html, /\.participantGraphControls \{[^}]*font-size: 0\.9rem/);
  assert.match(html, /<span class="aidb-section-title">Participants Graph<\/span><span class="pdfIgnore aidb-inline-tooltip-reference" style="display: inline-flex;" title="This static diagram uses distributional answer similarity/);
  assert.match(html, /id="participant-graph"[\s\S]*<span id="participants-graph" class="aidb-anchor-alias" aria-hidden="true"><\/span>/);
  assert.match(html, /\.aidb-anchor-alias \{ display: block; height: 0; overflow: hidden; scroll-margin-top: 24px; \}/);
  assert.match(html, /<label for="embedding-choice-select">Embedding:<span class="pdfIgnore aidb-inline-tooltip-reference" style="display: inline-flex;" title="Polis Auto is the closest live control vocabulary for this static export\./);
  assert.match(html, /<label for="cluster-count-input">Opinion groups:<span class="pdfIgnore aidb-inline-tooltip-reference" style="display: inline-flex;" title="Choose a deterministic K-medoids grouping over the report similarity matrix\./);
  assert.match(html, /class="numberInputWrapper"/);
  assert.match(html, /class="stepperButton" data-ce-cluster-step="-1" aria-label="Decrease opinion-group count"/);
  assert.match(html, /class="stepperButton" data-ce-cluster-step="1" aria-label="Increase opinion-group count"/);
  assert.match(html, /class="clusterNumberInput"/);
  assert.match(html, /class="clusterAutoButton clusterAutoButtonActive" data-ce-cluster-auto aria-pressed="true" title="Choose a deterministic K-medoids grouping/);
  assert.match(html, /data-ce-opinion-group-status aria-live="polite"/);
  assert.match(html, /\.controlGroup \{ display: flex; align-items: center; gap: 8px; flex-wrap: wrap; \}/);
  assert.match(html, /\.controlGroup select \{ padding: 4px; \}/);
  assert.doesNotMatch(html, /\.controlGroup \{[^}]*display: inline-flex/);
  assert.doesNotMatch(html, /\.controlGroup label \{ font-weight: 700; \}/);
  assert.doesNotMatch(html, /\.controlGroup select \{[^}]*background: #f8fafc/);
  assert.doesNotMatch(html, /\.controlGroup select \{[^}]*font: inherit/);
  assert.match(html, /\.numberInputWrapper \{ display: flex; align-items: center; border: 1px solid var\(--ce-color-border-light\); border-radius: var\(--ce-radius-4\); overflow: hidden; \}/);
  assert.match(html, /\.clusterNumberInput \{ width: 50px; height: 28px; text-align: center; border: none; font-size: 1rem;/);
  assert.doesNotMatch(html, /\.clusterNumberInput \{[^}]*background: #f8fafc/);
  assert.doesNotMatch(html, /\.clusterNumberInput \{[^}]*color: #344054/);
  assert.doesNotMatch(html, /\.clusterNumberInput \{[^}]*font: inherit/);
  assert.match(html, /\.stepperButton \{ width: 30px; height: 30px; border: none; background-color: #f7f7f7;/);
  assert.match(html, /\.controlGroup select:disabled, \.clusterNumberInput:disabled, \.stepperButton:disabled, \.clusterAutoButton:disabled \{ opacity: 1; cursor: default; color: inherit; -webkit-text-fill-color: currentColor; \}/);
  assert.doesNotMatch(html, /\.controlGroup select:disabled, \.clusterNumberInput:disabled, \.stepperButton:disabled, \.clusterAutoButton:disabled \{ opacity: 0\.7; cursor: not-allowed; \}/);
  assert.match(html, /\.clusterAutoButton \{ margin-left: 6px; cursor: pointer; \}/);
  assert.match(html, /\.clusterAutoButtonActive \{ background: #e5e7eb; box-shadow: inset 0 0 0 1px #9ca3af; \}/);
  assert.match(html, /class="graphSection aidb-graph-layout"/);
  assert.match(html, /<div class="graphItem">\s*<svg width="500" height="400"/);
  assert.doesNotMatch(html, /aidb-participant-graph-item/);
  assert.match(html, /<svg width="500" height="400" viewBox="0 0 500 400" class="participantSvg graph"/);
  assert.match(html, /class="participantSvg graph"/);
  assert.match(html, /<g transform="translate\(250, 200\)">/);
  assert.match(html, /class="graph-radial-axes"/);
  assert.doesNotMatch(html, /class="graph-radial-axes" hidden/);
  assert.match(html, /<circle r="174" stroke="rgb\(230,230,230\)" stroke-width="1" fill="rgb\(248,248,248\)" \/>/);
  assert.match(html, /<line class="graph-axis" x1="-210" y1="0" x2="210" y2="0" stroke="black" stroke-width="1" \/>/);
  assert.match(html, /<line class="graph-axis" x1="0" y1="-160" x2="0" y2="160" stroke="black" stroke-width="1" \/>/);
  assert.match(html, /outline: '\.graph-outline'/);
  assert.match(html, /class="graph-outlines"/);
  assert.doesNotMatch(html, /<ellipse\s+class="graph-outline"/);
  assert.match(html, /class="graph-statement" data-ce-searchable hidden/);
  assert.match(html, /class="graph-participant" data-ce-searchable data-ce-graph-participant-point tabindex="0" focusable="true" role="img" aria-label="[^"]+" data-ce-graph-cluster=/);
  assert.match(html, /data-participant-label=/);
  assert.match(html, /data-participant-model=/);
  assert.match(html, /data-participant-provider=/);
  assert.match(html, /data-participant-traits=/);
  assert.match(html, /<circle cx="[^"]+" cy="[^"]+" r="5" fill="/);
  assert.doesNotMatch(html, /class="aidb-edge-list"/);
  assert.match(html, /\.aidb-section-body\.aidb-participant-graph-section \{ padding: 0; margin-top: 0; margin-bottom: 0; \}/);
  assert.match(html, /\.aidb-participant-graph-section \.graphSection \{ display: flex; flex-wrap: wrap; margin-bottom: 20px; \}/);
  assert.match(html, /\.graphItem \{ flex: 1 1 50%; max-width: 50%; margin-right: 0; margin-bottom: 20px; \}/);
  assert.match(html, /\.participantSvg \{ border: 1px solid #ddd; background: var\(--ce-color-white\); width: 100%; height: auto; \}/);
  assert.match(html, /\.graph-participant \{ cursor: pointer; outline: none; \}/);
  assert.match(html, /\.graph-participant:hover circle, \.graph-participant:focus-visible circle \{ stroke: rgba\(15, 23, 42, 0\.72\); stroke-width: 3; filter: drop-shadow\(0 6px 12px rgba\(15, 23, 42, 0\.16\)\); \}/);
  assert.match(html, /function renderGraphParticipantTooltip\(point\)/);
  assert.match(html, /event\.target\.closest\('\[data-ce-graph-participant-point\]'\)/);
  assert.match(html, /point\.dataset\.participantLabel \|\| point\.dataset\.participantId/);
  assert.match(html, /point\.dataset\.ceGraphCluster/);
  assert.match(html, /point\.dataset\.participantModel/);
  assert.match(html, /point\.dataset\.participantProvider/);
  assert.match(html, /point\.dataset\.participantTraits/);
  assert.match(html, /<strong>Model:<\/strong> ' \+ escapeText\(point\.dataset\.participantModel\)/);
  assert.match(html, /<strong>Provider:<\/strong> ' \+ escapeText\(point\.dataset\.participantProvider\)/);
  assert.match(html, /<strong>Traits:<\/strong> ' \+ escapeText\(point\.dataset\.participantTraits\)/);
  assert.doesNotMatch(html, /\n\s+\.graphItem \{[^}]*box-shadow/);
  assert.doesNotMatch(html, /\.aidb-participant-graph-section \.graphSection \{ display: grid; grid-template-columns: 1fr; \}/);
  assert.match(html, /@media \(max-width: 768px\) \{[\s\S]*\.graphItem \{ flex: 1 1 100%; max-width: 100%; width: 100%; \}/);
  assert.match(html, /<div class="pdfIgnore">\s*<button type="button" data-ce-clusters-action="collapse" style="margin-right: 10px;">Collapse Clusters<\/button>\s*<button type="button" data-ce-clusters-action="expand">Expand Clusters<\/button>/);
  assert.doesNotMatch(html, /class="pdfIgnore aidb-cluster-controls"/);
  assert.doesNotMatch(html, /\.aidb-cluster-controls \{/);
  assert.match(html, /class="analyzeClustersBtn" title="Use AI to summarize each cluster&#39;s unique viewpoint" style="margin-left: 10px;" disabled aria-disabled="true"/);
  assert.doesNotMatch(html, /title="AI cluster analysis runs during benchmark report generation or in live Context Engine sessions\."/);
  assert.match(html, /data-icon="magic" class="svg-inline--fa fa-magic analysisWandIcon"/);
  assert.match(html, /\.analysisWandIcon \{ width: 1em; height: 1em; display: inline-block; overflow: visible; vertical-align: -0\.125em; flex: 0 0 auto; \}/);
  assert.match(html, /class="analyzeClustersBtn" title="Use AI to summarize each cluster&#39;s unique viewpoint" style="margin-left: 10px;" disabled aria-disabled="true"><svg[^>]+data-icon="magic"[\s\S]*?<span>Analyze clusters<\/span><\/button>/);
  assert.match(html, /\.analyzeClustersBtn \{[^}]*cursor: pointer;/);
  assert.match(html, /\.analyzeClustersBtn:disabled \{ opacity: 0\.7; cursor: not-allowed; \}/);
  assert.match(html, /class="analyzeClustersBtn"[^>]+disabled/);
  assert.match(html, /class="clusterLegendSection"/);
  assert.match(html, /class="clusterLegendTitle">Opinion Groups<span class="pdfIgnore aidb-inline-tooltip-reference"/);
  assert.match(html, /class="clusterSectionDiv" data-ce-cluster-section data-ce-cluster-open="false"/);
  assert.match(html, /class="clusterLegendHeader" data-ce-cluster-toggle role="button" tabindex="0" aria-expanded="false"/);
  assert.match(html, /class="clusterSwatchSvg" aria-hidden="true"/);
  assert.match(html, /class="clusterLegendName">Opinion Group \d+<\/span>/);
  assert.doesNotMatch(html, /class="clusterLegendName">Opinion Group \d+: agree leaning/);
  assert.doesNotMatch(html, /agree leaning/);
  assert.doesNotMatch(html, /disagree leaning/);
  assert.match(html, /<div class="clusterLegendBody" data-ce-cluster-body hidden>\s*<div class="clusterRepresentativeList"/);
  assert.match(html, /class="clusterLegendOmitted" data-ce-cluster-omitted><em class="showWhenPdf">Omitted<\/em><\/div>/);
  assert.match(html, /class="clusterRepresentativeQuestion" data-ce-searchable/);
  assert.match(html, /Representative statement 1/);
  assert.match(html, /class="clusterRepresentativeComparisons" style="margin-top:6px;margin-bottom:6px;"/);
  assert.match(html, /class="clusterRepresentativeComparisonBox" data-ce-cluster-comparison="\d+" style="border:1px solid #[0-9a-f]+;padding:4px;"/);
  assert.match(html, /Opinion Group \d+<\/div>\s*<div class="polisBoxPlotContainer">/);
  assert.match(html, /data-icon="minus-square" class="svg-inline--fa fa-minus-square clusterToggleSvgIcon clusterToggleSvgIconOpen"/);
  assert.match(html, /data-icon="plus-square" class="svg-inline--fa fa-plus-square clusterToggleSvgIcon clusterToggleSvgIconClosed"/);
  assert.match(html, /\.clusterSectionDiv \{ margin-bottom: 8px; border: 1px dashed #ccc; padding: 6px; background: transparent; \}/);
  assert.match(html, /function setClusterSectionOpen/);
  assert.match(html, /var omitted = section\.querySelector\('\[data-ce-cluster-omitted\]'\);\s*if \(omitted\) omitted\.hidden = nextOpen;/);
  assert.match(html, /document\.querySelectorAll\('\[data-ce-cluster-section\]'\)\.forEach/);
  assert.match(html, /id="ce-ai-discourse-bench-participant-clusters">\s*\{\s*"method": "deterministic-k-medoids"/);
  assert.match(html, /"assignmentsByCount": \{\s*"1": \{/);
  assert.match(html, /function applyOpinionGroupCount\(requestedCount\)/);
  assert.match(html, /function restoreAutoOpinionGroups\(\)/);
  assert.match(html, /function renderOpinionGroupOutlines\(\)/);
  assert.match(html, /function renderManualClusterLegend\(assignments, clusterCount\)/);
  assert.match(html, /clusterLegendItems\.addEventListener\('click', toggleClusterFromEvent\)/);
  assert.match(html, /clusterAutoButton\.addEventListener\('click', restoreAutoOpinionGroups\)/);
  assert.match(html, /applyOpinionGroupCount\(activeOpinionGroupCount \+ Number/);
  assert.doesNotMatch(html, /<details class="clusterSectionDiv"/);
  assert.match(html, /Most Similar Participant Pairs/);
  assert.match(html, /<span class="aidb-section-title">All Questions<\/span>/);
  assert.match(html, /class="questionList"/);
  assert.match(html, /class="questionListItem"\s+data-ce-searchable\s+id="question-aidb_0001"/);
  assert.doesNotMatch(html, /class="aggregatorSummaryCard questionListItem"/);
  assert.doesNotMatch(html, /data-ce-question-card/);
  assert.doesNotMatch(html, /data-ce-question-open="false"/);
  assert.doesNotMatch(html, /class="questionSummaryHeader"/);
  assert.doesNotMatch(html, /class="responseCountContainer"/);
  assert.doesNotMatch(html, /data-icon="comments" class="svg-inline--fa fa-comments responseCountIcon"/);
  assert.match(html, /class="questionPromptLine"><span class="questionPromptLabel">#1<\/span>: Frontier AI developers should be required to disclose serious pre-deployment evaluation results to an independent regulator\.<\/div>/);
  assert.doesNotMatch(html, /class="questionPromptLine">aidb_0001:/);
  assert.match(html, /id="question-aidb_0001"[\s\S]*data-question-id="aidb_0001"[\s\S]*data-question-topic="frontier-evaluation-disclosure"/);
  assert.doesNotMatch(html, /class="questionMetaLine">aidb_0001 &middot; frontier-evaluation-disclosure<\/div>/);
  assert.doesNotMatch(html, /class="questionSummaryHeaderIcons" aria-hidden="true"/);
  assert.doesNotMatch(html, /class="surveyResultsResponseCard"/);
  assert.match(html, /class="questionVoteRow"/);
  assert.match(html, /class="questionVoteSummary"/);
  assert.doesNotMatch(html, /class="questionMetadataLine"/);
  assert.match(html, /class="polisBoxPlotContainer"/);
  assert.match(html, /class="polisBoxPlotSvg"/);
  assert.match(html, /<strong>Agree:<\/strong>/);
  assert.match(html, /<strong>Disagree:<\/strong>/);
  assert.match(html, /<strong>Unsure:<\/strong>/);
  assert.match(html, /data-question-reversed=/);
  assert.match(html, /\.questionList \{ margin-top: 10px; width: 100%; \}/);
  assert.match(html, /\.questionListItem \{ margin-bottom: 6px; border-bottom: 1px solid #ddd; padding-bottom: 6px; scroll-margin-top: 24px; \}/);
  assert.match(html, /\.questionPromptLine \{ font-weight: bold; font-size: 0\.9rem; color: var\(--ce-color-border\); line-height: 1\.35; overflow-wrap: anywhere; \}/);
  assert.match(html, /\.questionPromptLabel \{ font-weight: bold; \}/);
  assert.doesNotMatch(html, /\.questionMetaLine \{/);
  assert.doesNotMatch(html, /\.questionSummaryHeader \{/);
  assert.doesNotMatch(html, /\.questionListItem\.aggregatorSummaryCard/);
  assert.doesNotMatch(html, /\.surveyResultsResponseCard \{/);
  assert.doesNotMatch(html, /\.aidb-question-section \.questionList \{ max-height: min\(72vh, 720px\); overflow-y: auto; padding-right: 8px; scrollbar-gutter: stable; \}/);
  assert.match(html, /\.questionVoteRow \{ display: flex; flex-direction: column; \}/);
  assert.doesNotMatch(html, /\.questionVoteRow \{[^}]*align-items: flex-start/);
  assert.doesNotMatch(html, /\.questionVoteRow \{[^}]*gap: 8px/);
  assert.match(html, /\.questionVoteRow > span \{ margin-right: 0; \}/);
  assert.match(html, /\.questionVoteSummary \{ font-size: 0\.8rem; margin-right: 8px; color: var\(--ce-color-border\); \}/);
  assert.match(html, /\.polisBoxPlotSvg \{ display: block; border: var\(--ce-color-black\) solid 0\.5px; \}/);
  assert.doesNotMatch(html, /\.polisBoxPlotSvg \{[^}]*width: 200px/);
  assert.doesNotMatch(html, /\.polisBoxPlotSvg \{[^}]*max-width: 100%/);
  assert.doesNotMatch(html, /var questionCards = Array\.from\(document\.querySelectorAll\('\[data-ce-question-card\]'\)\);/);
  assert.doesNotMatch(html, /function setQuestionCardOpen/);
  assert.doesNotMatch(html, /card\.querySelector\('\[data-ce-question-body\]'\)/);
  assert.doesNotMatch(html, /class="question-explorer"/);
  assert.doesNotMatch(html, /class="question-detail"/);
  assert.match(html, /Debate Map/);
  assert.match(html, /id="debate-atlas"[\s\S]*class="ce-report-section ce-results-mode-pane aidb-mode-pane aidb-debate-atlas-pane"/);
  assert.doesNotMatch(html, /ce-results-dark-pane/);
  assert.doesNotMatch(html, /ce-results-scroll-pane/);
  assert.match(html, /\.ce-results-mode-pane \{ box-sizing: border-box; display: block; max-width: 100%; min-width: 0; margin-top: 0; position: relative; background: transparent; overflow-x: visible; \}/);
  assert.match(html, /\.ce-results-mode-pane > \.aidb-section-body\.graphSection \{ box-sizing: border-box; display: block; margin: 0; padding: 0; background: transparent; \}/);
  assert.match(html, /\.aidb-debate-atlas-pane,\s*\.aidb-demo-analysis-pane,\s*\.aidb-risk-matrix-pane \{ border: 0; padding: 0; background: transparent; overflow-x: visible; \}/);
  assert.match(html, /\.aidb-debate-atlas-pane > \.aidb-section-body\.graphSection,\s*\.aidb-demo-analysis-pane > \.aidb-section-body\.graphSection,\s*\.aidb-risk-matrix-pane > \.aidb-section-body\.graphSection \{ padding: 0; background: transparent; \}/);
  assert.doesNotMatch(html, /class="demoResultsAtlasSurface aidb-demo-results-atlas-surface"/);
  assert.doesNotMatch(html, /\.demoResultsAtlasSurface,\s*\.demoResultsRiskMatrixSurface \{/);
  assert.doesNotMatch(html, /\.demoResultsAtlasSurface \{ background:/);
  assert.doesNotMatch(html, /\.demoResultsRiskMatrixSurface \{ background:/);
  assert.match(html, /class="aidb-debate-map-scroll-shell"/);
  assert.match(html, /\.aidb-debate-map-scroll-shell \{ max-height: 80vh; overflow-y: auto; \}/);
  assert.doesNotMatch(html, /\.aidb-debate-map-scroll-shell \{ max-height: none; overflow: visible; \}/);
  assert.match(html, /<div class="aidb-debate-map-scroll-shell">\s*<div class="debateMapWrapper embeddedAtlas aidb-debate-map-embed">/);
  assert.match(html, /class="debateMapWrapper embeddedAtlas aidb-debate-map-embed"/);
  assert.match(html, /\.debateMapWrapper \{ display: block; box-sizing: border-box; color: #f1f5f9; font-family: var\(--ce-font-mono\); padding: 20px; \}/);
  assert.doesNotMatch(html, /\.debateMapWrapper \{[^}]*width: 100%/);
  assert.match(html, /\.debateMapWrapper\.embeddedAtlas \{ background: transparent; min-height: unset; \}/);
  assert.doesNotMatch(html, /\.ce-results-mode-pane \.debateMapWrapper\.embeddedAtlas \{ padding: 0; background: #fff; color: #212529; font-family: var\(--ce-font-body\); \}/);
  assert.match(html, /class="debateMap"/);
  assert.match(html, /class="controls"/);
  assert.match(html, /\.debateMap \.controls \{ position: relative; z-index: 200; display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 25px; margin-bottom: 25px; padding: 15px 20px; overflow: visible;/);
  assert.match(html, /\.debateMap \.primaryControls, \.debateMap \.secondaryControls \{ display: flex; align-items: center; gap: 14px; flex-wrap: wrap; \}/);
  assert.doesNotMatch(html, /\.debateMap \.primaryControls, \.debateMap \.secondaryControls \{[^}]*min-width: 0/);
  assert.match(html, /class="viewModeSwitch"/);
  assert.doesNotMatch(html, /\.ce-results-mode-pane \.debateMap \.viewModeSwitch \{ border: 1px solid #ddd; border-radius: var\(--ce-radius-4\); background: #fff; \}/);
  assert.match(html, /data-testid="ce-debate-view-mode" data-ce-view-mode="circles" class="active"/);
  assert.doesNotMatch(html, /data-testid="ce-debate-view-mode"[^>]*aria-pressed=/);
  assert.doesNotMatch(html, /data-testid="ce-debate-view-mode"[^>]*title="Static benchmark report includes/);
  assert.doesNotMatch(html, /data-testid="ce-debate-view-mode" data-ce-view-mode="atlas">/);
  assert.doesNotMatch(html, /data-testid="ce-debate-view-mode" data-ce-view-mode="tree">/);
  assert.match(html, /data-testid="ce-debate-view-mode" data-ce-view-mode="list">/);
  assert.doesNotMatch(html, /data-ce-view-mode="list" aria-pressed="false" aria-disabled="true"/);
  assert.match(html, /data-icon="circle" class="svg-inline--fa fa-circle debateViewModeIcon"[\s\S]*Circles/);
  assert.doesNotMatch(html, /data-icon="network-wired" class="svg-inline--fa fa-network-wired debateViewModeIcon"/);
  assert.doesNotMatch(html, /data-icon="sitemap" class="svg-inline--fa fa-sitemap debateViewModeIcon"/);
  assert.match(html, /data-icon="list" class="svg-inline--fa fa-list debateViewModeIcon"[\s\S]*List/);
  assert.match(html, /\.debateMap \.viewModeSwitch \{ display: flex; align-items: center; padding: 4px; border: 1px solid rgba\(255, 255, 255, 0\.1\); border-radius: var\(--ce-radius-8\); background: rgba\(0, 0, 0, 0\.3\); \}/);
  assert.match(html, /\.debateMap \.viewModeSwitch button \{ background: transparent; border: none; color: #94a3b8; padding: 6px 16px; border-radius: var\(--ce-radius-6\); cursor: pointer; font-family: inherit; font-weight: 600; text-transform: uppercase; font-size: 0\.8rem; transition: background-color 0\.3s ease, color 0\.3s ease; \}/);
  assert.doesNotMatch(html, /\.debateMap \.viewModeSwitch button \{[^}]*appearance: none/);
  assert.doesNotMatch(html, /\.debateMap \.viewModeSwitch button \{[^}]*box-shadow: none/);
  assert.doesNotMatch(html, /\.debateMap \.viewModeSwitch button \{[^}]*font: inherit/);
  assert.doesNotMatch(html, /\.debateMap \.viewModeSwitch button \{[^}]*line-height: 1/);
  assert.match(html, /\.debateMap \.viewModeSwitch button svg \{ margin-right: 6px; \}/);
  assert.doesNotMatch(html, /\.debateMap \.viewModeSwitch button svg \{[^}]*width: 1em/);
  assert.doesNotMatch(html, /\.debateMap \.viewModeSwitch button svg \{[^}]*height: 1em/);
  assert.doesNotMatch(html, /\.debateMap \.viewModeSwitch button svg \{[^}]*vertical-align: -0\.125em/);
  assert.match(html, /\.debateMap \.legendDot\.subcategory \{ background: #2dd4bf; color: #2dd4bf; \}/);
  assert.match(html, /\.debateMap \.legendDot\.topic \{ background: #4ade80; color: #4ade80; \}/);
  assert.match(html, /\.debateMap \.legendDot\.instance \{ background: #fde047; color: #fde047; \}/);
  assert.doesNotMatch(html, />Demo Mode</);
  assert.doesNotMatch(html, /Benchmark topics/);
  assert.doesNotMatch(html, /\.debateMap \.controlGroup/);
  assert.match(html, /class="inlineLegendItem"/);
  assert.match(html, /\.debateMap \.inlineLegendItem \{ display: inline-flex; align-items: center; gap: 5px; font-size: 0\.7rem; color: rgba\(255, 255, 255, 0\.5\); text-transform: uppercase; letter-spacing: 0\.03em; margin: 0 6px; \}/);
  assert.doesNotMatch(html, /\.debateMap \.viewModeSwitch \{ width: 100%; overflow-x: visible; flex-wrap: wrap; \}/);
  assert.doesNotMatch(html, /\.debateMap \.secondaryControls \{ margin-left: 0; width: 100%; justify-content: flex-start; row-gap: 8px; \}/);
  assert.doesNotMatch(html, /\.debateMap \.inlineLegendItem \{[^}]*white-space: nowrap/);
  assert.doesNotMatch(html, /\.debateMap \.inlineLegendItem \{ flex: 0 1 auto; margin: 0 4px 0 0; white-space: normal; \}/);
  assert.match(html, /class="atlasViewContainer packedAtlasViewContainer"/);
  assert.doesNotMatch(html, /\.ce-results-mode-pane \.debateMap \.atlasViewContainer \{ height: min\(70vh, 640px\); min-height: 420px; border: 1px solid #ddd; border-radius: 0; background: #fff; \}/);
  assert.doesNotMatch(html, /\.ce-results-mode-pane \.debateMap \.atlasNode\.packedAtlasNode \.packedNodeLabel \{ color: #333 !important; font-family: var\(--ce-font-body\); font-weight: 700; letter-spacing: 0; text-shadow: none; \}/);
  assert.doesNotMatch(html, /<div class="ce-results-mode-pane-header">[\s\S]*AI Discourse Topic Atlas/);
  assert.match(html, /\.debateMap \.controls \{ position: relative; z-index: 200;[^}]*overflow: visible;/);
  assert.match(html, /\.debateMap \.atlasViewContainer/);
  assert.match(html, /\.debateMap \.atlasViewContainer \{ position: relative; width: 100%; height: 85vh; overflow: hidden; cursor: grab; touch-action: none; border-radius: var\(--ce-radius-16\); \}/);
  assert.match(html, /@media \(max-width: 768px\) \{[\s\S]*\.debateMap \{ padding: 0; \}/);
  assert.match(html, /@media \(max-width: 768px\) \{[\s\S]*\.debateMap \.controls \{ flex-direction: column; align-items: stretch; \}/);
  assert.match(html, /@media \(max-width: 768px\) \{[\s\S]*\.debateMap \.viewModeSwitch \{ flex-wrap: wrap; gap: 4px; max-width: 100%; overflow: hidden; \}/);
  assert.match(html, /@media \(max-width: 768px\) \{[\s\S]*\.debateMap \.viewModeSwitch button \{ flex: 1 1 calc\(50% - 4px\); min-width: 7rem; \}/);
  assert.match(html, /@media \(max-width: 768px\) \{[\s\S]*\.debateMap \.viewModeSeparator \{ display: none; \}/);
  assert.match(html, /@media \(max-width: 768px\) \{[\s\S]*\.debateMap \.inlineLegendItem \{ flex: 1 1 42%; margin: 2px 0; white-space: normal; line-height: 1\.15; \}/);
  assert.match(html, /@media \(max-width: 768px\) \{[\s\S]*\.debateMap \.secondaryControls \{ margin-left: 0; \}/);
  assert.doesNotMatch(html, /@media \(max-width: 768px\) \{[\s\S]*\.debateMap \.primaryControls, \.debateMap \.secondaryControls \{ width: 100%; \}/);
  assert.match(html, /@media \(max-width: 768px\) \{[\s\S]*\.debateMap \.atlasViewContainer \{ height: 75vh; \}/);
  assert.doesNotMatch(html, /\.debateMap \.atlasViewContainer \{ height: max\(75vh, 920px\); \}/);
  assert.match(html, /\.debateMap \.packedAtlasViewContainer \{ cursor: default; touch-action: auto; \}/);
  assert.doesNotMatch(html, /\.debateMap \.atlasViewContainer \{[^}]*background: radial-gradient/);
  assert.match(html, /class="hotDebatesBtn" data-ce-atlas-top-debates-toggle aria-expanded="false"/);
  assert.match(html, /data-icon="fire" class="svg-inline--fa fa-fire atlasChromeIcon"/);
  assert.match(html, /Top Debates/);
  assert.match(html, /class="topNodesOverlay" data-ce-atlas-top-debates-overlay/);
  assert.match(html, /Active Debates/);
  assert.match(html, /data-ce-atlas-top-debates-close aria-label="Minimize active debates"/);
  assert.match(html, /\.debateMap \.hotDebatesBtn \{ position: absolute; top: 20px; right: 20px; z-index: 50;/);
  assert.match(html, /\.debateMap \.topNodesOverlay \{ position: absolute; top: 70px; right: 20px; width: 300px;/);
  assert.match(html, /\.debateMap \.topNodesOverlay\.visible \{ opacity: 1; transform: translateY\(0\); pointer-events: auto; z-index: 999; \}/);
  assert.match(html, /@media \(max-width: 768px\) \{[\s\S]*\.debateMap \.topNodesOverlay \{ width: calc\(100% - 40px\); top: 60px; \}/);
  assert.match(html, /function setAtlasTopDebatesOpen\(isOpen\)/);
  assert.match(html, /atlasTopDebatesOverlay\.classList\.toggle\('visible', nextOpen\)/);
  assert.match(html, /atlasTopDebatesButton\.setAttribute\('aria-expanded', nextOpen \? 'true' : 'false'\)/);
  assert.doesNotMatch(html, /\.debateMap \.atlasTopicGrid/);
  assert.doesNotMatch(html, /class="atlasTopicGrid"/);
  assert.doesNotMatch(html, /class="packedAtlasTitleRow"/);
  assert.doesNotMatch(html, /data-testid="ce-atlas-title-action"/);
  assert.doesNotMatch(html, /data-ce-node-id="ai-discourse-topic-atlas"/);
  assert.doesNotMatch(html, /\.debateMap \.packedAtlasTitle/);
  assert.match(html, /class="atlasNode packedAtlasNode/);
  assert.match(html, /class="nodeDot packedNodeDot"/);
  assert.match(html, /class="nodeLabel packedNodeLabel alwaysVisible"/);
  assert.match(html, /class="nodeLabel packedNodeLabel alwaysVisible" style="font-size:[^"]+">\s*Frontier Evaluation Disclosure\s*<\/div>/);
  assert.match(html, /aria-label="Frontier Evaluation Disclosure: \d+ questions,/);
  assert.match(html, /data-ce-node-id="frontier-evaluation-disclosure"/);
  assert.match(html, /data-testid="ce-atlas-node"/);
  assert.match(html, /data-ce-node-layout="packed"/);
  assert.match(html, /--atlas-left:[^;]+; --atlas-top:[^;]+; --atlas-mobile-left:[^;]+; --atlas-mobile-top:/);
  assert.match(html, /--topic-diameter:[^;]+px; --topic-mobile-diameter:[^;]+px/);
  assert.match(html, /--topic-mobile-font-size:[^;]+px/);
  assert.match(html, /\.debateMap \.atlasNode \{[^}]*position: absolute; left: var\(--atlas-left, 50%\); top: var\(--atlas-top, 50%\); transform: translate\(-50%, -50%\);/);
  assert.match(html, /\.debateMap \.atlasNode \{[^}]*cursor: pointer;/);
  assert.match(html, /\.debateMap \.atlasNode\.packedAtlasNode \.packedNodeDot/);
  assert.match(html, /\.debateMap \.atlasNode\.packedAtlasNode \.packedNodeDot \{ display: flex; align-items: center; justify-content: center; width: var\(--topic-diameter, 124px\); height: var\(--topic-diameter, 124px\); \}/);
  assert.match(html, /\.debateMap \.atlasNode\.packedAtlasNode \.packedNodeLabel [^{]*\{[^}]*overflow-wrap: normal; word-break: normal; hyphens: manual;/);
  assert.match(html, /@media \(max-width: 768px\) \{[\s\S]*\.debateMap \.atlasNode \{ left: var\(--atlas-mobile-left, var\(--atlas-left, 50%\)\); top: var\(--atlas-mobile-top, var\(--atlas-top, 50%\)\); \}/);
  assert.match(html, /@media \(max-width: 768px\) \{[\s\S]*\.debateMap \.atlasViewContainer \{ height: 75vh; \}/);
  assert.match(html, /@media \(max-width: 768px\) \{[\s\S]*\.debateMap \.atlasNode\.packedAtlasNode \.packedNodeDot \{ width: var\(--topic-mobile-diameter, var\(--topic-diameter, 124px\)\); height: var\(--topic-mobile-diameter, var\(--topic-diameter, 124px\)\); \}/);
  assert.doesNotMatch(html, /\.debateMap \.atlasNode\.packedAtlasNode \.packedNodeDot \{ width: clamp\(58px, 17vw, 68px\); height: clamp\(58px, 17vw, 68px\); \}/);
  assert.match(html, /@media \(max-width: 768px\) \{[\s\S]*\.debateMap \.atlasNode\.packedAtlasNode \.packedNodeLabel \{ font-size: var\(--topic-mobile-font-size, 9px\) !important; line-height: 1\.04; letter-spacing: 0; overflow-wrap: normal; word-break: normal; hyphens: none; \}/);
  assert.doesNotMatch(html, /@media \(max-width: 768px\) \{[\s\S]*\.debateMap \.atlasNode\.packedAtlasNode \.packedNodeLabel \{ overflow-wrap: anywhere; \}/);
  assert.match(html, /@media \(prefers-reduced-motion: reduce\) \{\s*\.debateMap,\s*\.debateMap \* \{ transition-duration: 0\.01ms !important; animation-duration: 0\.01ms !important; animation-iteration-count: 1 !important; \}\s*\.debateMap \.voteInputGroup \{ animation: none !important; \}\s*\}/);
  assert.doesNotMatch(html, /class="atlasTopicBubble"/);
  assert.match(html, /Breakdown/);
  assert.match(html, /class="workspace demoAnalysisWorkspace aidb-breakdown-workspace"/);
  assert.match(html, /data-testid="demo-analysis-workspace"/);
  assert.match(html, /data-ce-demo-analysis-workspace/);
  assert.match(html, /class="panel demoPanel filterPanel" data-testid="demo-analysis-demographic-selector"/);
  assert.match(html, /Compare Demographics/);
  assert.match(html, /Select any two or more model trait segments to power the comparison report\./);
  assert.match(html, /title="Auto-select the strongest correlation" aria-label="Auto-select strongest correlation"/);
  assert.match(html, /data-icon="magic" class="svg-inline--fa fa-magic selectorActionSvgIcon"/);
  assert.match(html, /<button type="button" class="clearButton" data-ce-breakdown-clear>Clear all<\/button>/);
  assert.match(html, /\.selectorActions \{ display: flex; align-items: center; gap: 0\.5rem; flex: 0 0 auto; \}/);
  assert.match(html, /\.clearButton \{ border: 1px solid #ced4da; border-radius: 999px; background: #f8f9fa; color: #495057; font-weight: 600; padding: 0\.45rem 0\.85rem; cursor: pointer; white-space: nowrap; transition: background-color 0\.2s ease, border-color 0\.2s ease; \}/);
  assert.match(html, /class="workspaceContainer"/);
  assert.match(html, /class="pillsLayout"/);
  assert.match(html, /class="filterPill" data-ce-searchable/);
  assert.match(html, /class="pillName">Parameter Class:/);
  assert.match(html, /data-icon="magic" class="svg-inline--fa fa-magic pillIconSvgIcon"/);
  assert.match(html, /data-icon="times" class="svg-inline--fa fa-times pillIconSvgIcon"/);
  assert.doesNotMatch(html, /Add filters from the dropdowns below to begin\./);
  assert.doesNotMatch(html, /class="activePills"/);
  assert.doesNotMatch(html, /<button type="button" class="clearButton">Clear<\/button>/);
  assert.match(html, /class="selectorLayout breakdownTraitGrid"/);
  assert.match(html, /class="selectorField breakdownTraitField"/);
  assert.match(html, /class="demographicSelect breakdownTraitMenu" data-ce-breakdown-trait=/);
  assert.match(html, /class="demoAnalysisSelect__control breakdownTraitSelect"/);
  assert.match(html, /class="breakdownTraitMenuList" role="group" aria-label="Country of Origin options"/);
  assert.match(html, /data-ce-breakdown-group-input\s+data-ce-breakdown-group-key="countryOfOrigin:/);
  assert.match(html, /data-ce-breakdown-selected-workspace/);
  assert.match(html, /data-ce-breakdown-selected-pills/);
  assert.match(html, /data-ce-breakdown-remove-group/);
  assert.match(html, /data-ce-breakdown-auto/);
  assert.match(html, /class="demoAnalysisSelect__placeholder">Parameter Class<\/span>/);
  assert.match(html, /class="breakdownTraitSelectValues"/);
  assert.match(html, /class="breakdownTraitSelectValue"[^>]*>\s*30B A3B\s*<\/span>/);
  assert.match(html, /class="breakdownTraitSelectValue"[^>]*>\s*Medium\s*<\/span>/);
  assert.doesNotMatch(html, /class="breakdownTraitSelectValue breakdownTraitSelectValueMore"/);
  assert.doesNotMatch(html, /class="panel demoPanel filterPanel breakdownTraitPanel"/);
  assert.match(html, /class="selectedQuestionBanner" data-testid="demo-analysis-question-banner"/);
  assert.match(html, /class="selectedQuestionFrame"/);
  assert.match(html, /class="selectedQuestionCardPrompt" data-testid="demo-analysis-selected-question" data-ce-breakdown-selected-prompt/);
  assert.match(html, /class="selectedQuestionGrounding"/);
  assert.match(html, /class="selectedQuestionTension" data-testid="demo-analysis-selected-question-tension"/);
  assert.match(html, /class="selectedQuestionGroundingPills" data-testid="demo-analysis-selected-question-tags"/);
  assert.match(html, /<a class="selectedQuestionTagButton selectedQuestionTagButtonActive" data-ce-breakdown-selected-topic data-ce-tag-open data-ce-tag="[^"]+" href="#tag-[^"]+" title="Open [^"]+ in the tag explorer">/);
  assert.doesNotMatch(html, /data-ce-breakdown-selected-stance/);
  assert.doesNotMatch(html, /data-ce-template-stance/);
  assert.doesNotMatch(html, /<span class="selectedQuestionTagButton selectedQuestionTagButtonActive"/);
  assert.match(html, /\.selectedQuestionTagButton \{[^}]*cursor: pointer;[^}]*transition: transform 0\.14s ease, background 0\.14s ease, border-color 0\.14s ease, color 0\.14s ease;/);
  assert.match(html, /\.selectedQuestionTagButton:hover, \.selectedQuestionTagButton:focus-visible \{ background: #c7ddff; border-color: rgba\(15, 94, 199, 0\.38\); color: #122c4d; outline: none; transform: translateY\(-1px\); \}/);
  assert.match(html, /Comparison Suggestions/);
  assert.match(html, /Suggestions compare cohorts within models matching the current filters\. Values in one category combine as OR; categories combine as AND\./);
  assert.match(html, /class="suggestionFilterStatus" data-ce-breakdown-suggestions-status aria-live="polite"/);
  assert.match(html, /class="suggestionsList" data-ce-breakdown-suggestions-list/);
  assert.match(html, /class="suggestionButton suggestionButtonActive"[\s\S]*?aria-pressed="true"[\s\S]*?data-ce-breakdown-suggestion[\s\S]*?data-ce-breakdown-template-id="breakdown-template-default"[\s\S]*?data-ce-selected-breakdown-suggestion/);
  assert.match(html, /class="suggestionButton"[\s\S]*?aria-pressed="false"[\s\S]*?data-ce-breakdown-suggestion[\s\S]*?data-ce-breakdown-template-id="breakdown-template-/);
  assert.match(html, /<template\s+id="breakdown-template-default"\s+data-ce-breakdown-template\s+data-ce-breakdown-question-id=/);
  assert.match(html, /data-ce-template-breakdown-list/);
  assert.match(html, /data-ce-template-comparison-report/);
  assert.match(html, /function applyBreakdownTemplate\(templateId, sourceButton\)/);
  assert.match(html, /function updateInteractiveBreakdown\(sourceButton\)/);
  assert.match(html, /function breakdownRenderComparisonReport\(groups\)/);
  assert.match(html, /function breakdownFilteredParticipantIds\(groups\)/);
  assert.match(html, /if \(!idsByTrait\[group\.trait\]\) idsByTrait\[group\.trait\] = new Set\(\);/);
  assert.match(html, /return traitSets\.every\(function \(ids\) \{ return ids\.has\(id\); \}\);/);
  assert.match(html, /function breakdownBuildFilteredSuggestions\(filterGroups\)/);
  assert.match(html, /return eligibleSet\.has\(id\);/);
  assert.match(html, /breakdownBestQuestionForPair\(left\.ids, right\.ids\)/);
  assert.match(html, /function breakdownRenderQuestionRows\(question, groups, filteredParticipantIds\)/);
  assert.match(html, /label: overallParticipantIds\.length === allParticipantIds\.length \? 'Overall' : 'Matching models'/);
  assert.match(html, /breakdownRenderQuestionRows\(question, groups, eligibleIds\)/);
  assert.match(html, /Suggestions are restricted to ' \+ result\.eligibleIds\.length \+ ' of ' \+ totalModels \+ ' models matching the current filters\.'/);
  assert.match(html, /data-ce-breakdown-filtered-suggestion data-ce-breakdown-suggestion-index=/);
  assert.match(html, /parameterClass: 'Parameter Class',\s*ossStatus: 'OSS Status',\s*countryOfOrigin: 'Country of Origin',\s*providerClass: 'Provider Class'/);
  assert.match(html, /input\.addEventListener\('change', function \(\) \{/);
  assert.match(html, /breakdownSelectedGroupKeys\.clear\(\);\s*breakdownActiveSuggestion = null;\s*updateInteractiveBreakdown\(null\);/);
  assert.match(html, /breakdownSuggestionsList\.addEventListener\('click', function \(event\) \{/);
  assert.match(html, /breakdownActiveSuggestion = suggestion;\s*breakdownCurrentQuestionId = String\(suggestion\.question\.id\);\s*updateInteractiveBreakdown\(button\);/);
  assert.match(html, /applyBreakdownTemplate\(button\.getAttribute\('data-ce-breakdown-template-id'\), button\);/);
  assert.match(html, /\.suggestionButton \{[^}]*cursor: pointer;[^}]*transition: background-color 0\.2s ease, box-shadow 0\.2s ease, border-color 0\.2s ease;/);
  assert.match(html, /\.suggestionButton:hover \{ background: var\(--ce-color-surface-light, #f8f9fa\); box-shadow: 0 2px 5px rgba\(0, 0, 0, 0\.08\); border-left-color: #e65516; \}/);
  assert.match(html, /class="suggestionPair"/);
  assert.match(html, /class="suggestionVs"/);
  assert.match(html, /World Results Map/);
  assert.doesNotMatch(html, /Choose a comparison suggestion or inspect a question below to load the country map\./);
  assert.match(html, /class="workspace demoAnalysisWorkspace aidb-breakdown-workspace"/);
  assert.match(html, /class="panel demoPanel filterPanel"/);
  assert.match(html, /class="panel demoPanel suggestionPanel"/);
  assert.match(html, /class="panel demoPanel mapPanel"/);
  assert.match(html, /class="mapFrameShell"/);
  assert.match(html, /class="mapFrameViewport"/);
  assert.doesNotMatch(html, /class="mapFrameViewport mapFrameViewportEmpty"/);
  assert.doesNotMatch(html, /class="mapViewportHint"/);
  assert.match(html, /data-testid="demo-analysis-world-map"/);
  assert.match(html, /class="aidb-world-map-svg"/);
  assert.match(html, /class="mapLegend" aria-label="Map answer legend"/);
  assert.match(html, /class="legendSwatch" style="background-color:#4dffa4"><\/span>\s*Agree/);
  assert.match(html, /class="legendSwatch" style="background-color:#ffd166"><\/span>\s*Unsure/);
  assert.match(html, /--unsure:#ffd166;/);
  assert.match(html, /\.aidb-answer-unsure \{ background: var\(--unsure\); \}/);
  assert.match(html, /\.tagExplorerUnsure \{ background: var\(--unsure\); \}/);
  assert.doesNotMatch(html, /--unsure:#cbd5e1;/);
  assert.match(html, /class="legendSwatch" style="background-color:#ff6b6b"><\/span>\s*Disagree/);
  assert.equal((html.match(/data-ce-world-map-country=/g) || []).length, 177);
  assert.match(html, /class="worldMapCountry worldMapCountryHasData"\s*fill="#4dffa4"\s*data-ce-world-map-country="United States of America"/);
  assert.match(html, /class="worldMapCountry worldMapCountryHasData"\s*fill="#ff6b6b"\s*data-ce-world-map-country="Canada"/);
  assert.match(html, /aria-label="US: Agree \(100%\)\. Models: Model A"/);
  assert.match(html, /aria-label="Canada: Disagree \(100%\)\. Models: Model B"/);
  assert.match(html, /class="worldMapSphere"/);
  assert.match(html, /class="worldMapGraticule"/);
  assert.doesNotMatch(html, /class="worldMapMarker"/);
  assert.doesNotMatch(html, /Model origin cohorts shown as static benchmark markers/);
  assert.match(html, /\.worldMapCountry \{ stroke: #ffffff; stroke-width: 0\.7; outline: none; transition: fill 0\.12s ease; \}/);
  assert.match(html, /\.worldMapCountry:hover, \.worldMapCountry:focus-visible \{ fill: #ff5533; outline: none; \}/);
  assert.match(html, /class="polisReportContainer comparisonReportContainer" data-testid="demo-analysis-empty-state"/);
  assert.match(html, /Select two or more model trait segments from the menus above to see a detailed comparison report\./);
  assert.match(html, /class="polisReportContainer comparisonReportContainer" data-testid="demo-analysis-comparison-report"/);
  assert.match(html, /data-testid="demo-analysis-comparison-report-toggle"/);
  assert.match(html, /class="reportCollapseBody"/);
  assert.match(html, /class="legendContainer"/);
  assert.match(html, /class="legendPills"/);
  assert.match(html, /class="sectionCollapse comparisonReportSectionCollapse"/);
  assert.match(html, /Similarity &amp; Difference Spectrum/);
  assert.match(html, /data-ce-comparison-beeswarm/);
  assert.match(html, /data-ce-comparison-beeswarm-point/);
  assert.match(html, /data-question-difference-label="Cohort difference"/);
  assert.match(html, /aria-label="Questions by model-cohort difference and repeat consistency"/);
  assert.match(html, /data-ce-comparison-beeswarm[\s\S]*?class="beeswarmAxisTitle"[^>]*>Repeat consistency<\/text>/);
  assert.match(html, /data-ce-comparison-beeswarm[\s\S]*?<text class="beeswarmAxisLabel" x="62" y="232">Similarity<\/text>/);
  assert.match(html, /data-ce-comparison-beeswarm[\s\S]*?<text class="beeswarmAxisLabel" x="680" y="232" text-anchor="end">Difference<\/text>/);
  assert.match(html, /aria-label="Scroll comparison spectrum to start"/);
  assert.match(html, /aria-label="Scroll comparison spectrum to end"/);
  assert.match(html, /document\.querySelectorAll\('\[data-ce-beeswarm-scroll-controls\]'\)\.forEach/);
  assert.match(html, /event\.target\.closest\('\[data-ce-beeswarm-scroll\]'\)/);
  assert.match(html, /var viewport = layout \? layout\.querySelector\('\[data-ce-beeswarm-scroll-viewport\]'\) : null;/);
  assert.match(html, /Top Similar Items/);
  assert.match(html, /Top Divergent Items/);
  assert.match(html, /class="analysisListItem"/);
  assert.match(html, /class="reportAnalysisContent"/);
  assert.match(html, /class="analysisDistributionList"/);
  assert.match(html, /class="analysisDistributionLegend"/);
  assert.match(html, /\.responsePill \{ display: inline-flex; align-items: center; justify-content: center; min-height: 28px; padding: 4px 10px; border: 1px solid transparent; border-radius: var\(--ce-radius-pill, 999px\); font-size: 0\.82rem; font-weight: 700; line-height: 1; letter-spacing: 0\.01em; white-space: nowrap; box-shadow: inset 0 1px 0 rgba\(255, 255, 255, 0\.2\); \}/);
  assert.doesNotMatch(html, /data-testid="ce-demo-analysis-response-pill-card-/);
  assert.doesNotMatch(html, /Similarity score \d/);
  assert.doesNotMatch(html, /Divergence score \d/);
  assert.match(html, /\.analysisCandleSegmentUnsure \{ background: linear-gradient\(90deg, #9b8016, #f5c84e\); \}/);
  assert.match(html, /\.analysisCandleSegmentDisagree \{ background: linear-gradient\(90deg, #96364a, #ff6b6b\); \}/);
  assert.match(html, /\.comparisonBeeswarmSvg \{ width: 700px; min-width: 700px; max-width: none; \}/);
  assert.match(html, /\.beeswarmCircleNoRepeat \{ fill: #94a3b8; opacity: 0\.62; stroke: #64748b; stroke-width: 1; \}/);
  assert.doesNotMatch(html, /\.analysisCandleSegmentUnsure \{ background: linear-gradient\(90deg, #d69f03, #ffd166\); \}/);
  assert.doesNotMatch(html, /\.analysisCandleSegmentDisagree \{ background: linear-gradient\(90deg, #b42318, #f97066\); \}/);
  assert.doesNotMatch(html, /Model Cohorts/);
  assert.match(html, /Parameter Class/);
  assert.match(html, /OSS Status/);
  assert.match(html, /Country of Origin/);
  assert.match(html, /Provider Class/);
  assert.match(html, /30B A3B/);
  assert.doesNotMatch(html, /30 B A3 B/);
  assert.doesNotMatch(html, />ParameterClass</);
  assert.doesNotMatch(html, />OssStatus</);
  assert.doesNotMatch(html, />CountryOfOrigin</);
  assert.doesNotMatch(html, />ProviderClass</);
  assert.match(html, /Question Breakdown/);
  assert.match(html, /id="breakdown"[\s\S]*class="ce-report-section ce-results-mode-pane aidb-mode-pane aidb-demo-analysis-pane"/);
  assert.match(html, /data-testid="demo-analysis-question-breakdown"/);
  assert.match(html, /class="panel demoPanel chartPanel"/);
  assert.match(html, /Selected statement distributions by model cohort/);
  assert.match(html, /class="breakdownList" data-ce-breakdown-list/);
  assert.ok(
    html.indexOf('data-testid="demo-analysis-question-banner"')
      < html.indexOf('data-testid="demo-analysis-question-breakdown"'),
    'the selected question should appear before its cohort breakdown'
  );
  assert.ok(
    html.indexOf('data-testid="demo-analysis-question-breakdown"')
      < html.indexOf('class="panel demoPanel suggestionPanel"'),
    'the selected-question breakdown should appear before comparison suggestions'
  );
  assert.doesNotMatch(html, /<section class="panel demoPanel chartPanel" data-testid="demo-analysis-question-breakdown">\s*<h3 class="panelTitle">Question Breakdown<\/h3>\s*<p class="emptyHint">Select a question to inspect its response breakdown\.<\/p>\s*<\/section>/);
  assert.match(html, /Select a question to inspect its response breakdown\./);
  assert.match(html, /class="breakdownDataset"/);
  assert.match(html, /class="breakdownDatasetHeader"/);
  assert.match(html, /class="breakdownCandlestick"/);
  assert.match(html, /class="breakdownCandleSegment breakdownCandleSegmentAgree"/);
  assert.match(html, /class="breakdownCandleSegment breakdownCandleSegmentUnsure"/);
  assert.match(html, /class="breakdownCandleSegment breakdownCandleSegmentDisagree"/);
  assert.match(html, /\.workspace \{ display: grid; gap: 1rem; color: var\(--ce-color-dark, #212529\); \}/);
  assert.match(html, /\.demoAnalysisWorkspace \{ display: grid; gap: 1rem; color: var\(--ce-color-dark, #212529\); \}/);
  assert.match(html, /\.primaryGrid,\s*\.secondaryGrid \{ display: grid; gap: 1rem; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); align-items: stretch; \}/);
  assert.match(html, /\.panel \{ padding: 1rem 1\.1rem; border: 1px solid #dee2e6; border-radius: var\(--ce-radius-8, 8px\); background: #ffffff; box-shadow: 0 2px 4px rgba\(0, 0, 0, 0\.05\); \}/);
  assert.match(html, /\.demoPanel \{ padding: 1rem 1\.1rem; border: 1px solid #dee2e6; border-radius: var\(--ce-radius-8, 8px\); background: #ffffff; box-shadow: 0 2px 4px rgba\(0, 0, 0, 0\.05\); \}/);
  assert.match(html, /\.panelTitle \{ margin: 0; font-size: 1\.08rem; font-weight: 600; color: var\(--ce-color-dark, #212529\); \}/);
  assert.match(html, /\.panelMeta \{ margin: 0\.3rem 0 0; color: var\(--ce-color-text-muted, #6c757d\); line-height: 1\.45; \}/);
  assert.match(html, /\.filterPanel \{ background: #ffffff; \}/);
  assert.match(html, /\.suggestionPanel \{ background: #fdfdea; border-color: #f0e68c; \}/);
  assert.match(html, /\.demoPanel\.suggestionPanel \{ background: #fdfdea; border-color: #f0e68c; \}/);
  assert.doesNotMatch(html, /\.workspace, \.demoAnalysisWorkspace \{/);
  assert.doesNotMatch(html, /\.panel, \.demoPanel \{/);
  assert.match(html, /\.selectorLayout \{ display: grid; gap: 1rem; grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(html, /\.selectorField \{ min-width: 0; \}/);
  assert.match(html, /\.demoAnalysisSelect__control \{ min-height: 48px; border: 1px solid #ced4da; background: #ffffff; box-shadow: none; cursor: pointer; border-radius: var\(--ce-radius-8, 8px\);/);
  assert.match(html, /\.clearButton \{[^}]*cursor: pointer;[^}]*transition: background-color 0\.2s ease, border-color 0\.2s ease;/);
  assert.match(html, /\.clearButton:hover \{ background: #e9ecef; border-color: #adb5bd; \}/);
  assert.match(html, /\.selectorActionSvgIcon \{ width: 1em; height: 1em; display: inline-block; overflow: visible; vertical-align: -0\.125em; \}/);
  assert.match(html, /\.pillButton \{ cursor: pointer; \}/);
  assert.doesNotMatch(html, /button\.pillButton \{ cursor: default;/);
  assert.match(html, /\.workspaceEmpty \{ display: flex; flex-direction: row; justify-content: center; align-items: center; text-align: center; padding: 10px; border: 2px dashed #d6d6d6; border-radius: var\(--ce-radius-8, 8px\); background-color: var\(--ce-color-surface-light, #f8f9fa\); color: var\(--ce-color-text-muted, #6c757d\); margin-bottom: 1rem; \}/);
  assert.match(html, /\.breakdownTraitSelectValues \{ display: flex; align-items: center; flex-wrap: wrap; gap: 4px;/);
  assert.match(html, /@media \(min-width: 1280px\) \{\s*\.selectorLayout, \.selectorLayout\.breakdownTraitGrid \{ grid-template-columns: repeat\(4, minmax\(0, 1fr\)\); \}/);
  assert.match(html, /@media \(max-width: 980px\) \{[\s\S]*?\.primaryGrid,\s*\.secondaryGrid \{ grid-template-columns: 1fr; \}[\s\S]*?\.selectorLayout, \.selectorLayout\.breakdownTraitGrid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
  assert.match(html, /@media \(max-width: 640px\) \{[\s\S]*?\.demoAnalysisWorkspace \.selectedQuestionFrame \{ padding: 1rem; \}[\s\S]*?\.demoAnalysisWorkspace \.demoPanel \{ padding: 0\.9rem; \}[\s\S]*?\.breakdownTraitGrid, \.selectorLayout, \.selectorLayout\.breakdownTraitGrid \{ grid-template-columns: 1fr; \}/);
  const max1024Block = html.slice(html.indexOf('@media only screen and (max-width: 1024px)'), html.indexOf('@media (max-width: 980px)'));
  assert.doesNotMatch(max1024Block, /\.primaryGrid,\s*\.secondaryGrid \{ grid-template-columns: 1fr; \}/);
  assert.doesNotMatch(max1024Block, /\.analysisList \{ padding: 0\.75rem; \}/);
  assert.doesNotMatch(max1024Block, /\.questionVoteRow \{ flex-direction: column; \}/);
  assert.doesNotMatch(max1024Block, /\.questionVoteRow > span \{ margin-right: 0; \}/);
  assert.doesNotMatch(html, /@media \(max-width: 600px\) \{[\s\S]*?\.selectedQuestionFrame \{ padding: 1rem; \}/);
  assert.match(html, /\.selectedQuestionFrame \{ background: linear-gradient\(145deg, #f8fbff 0%, #edf4ff 100%\);[^}]*border-radius: var\(--ce-radius-8, 8px\);/);
  assert.match(html, /\.mapFrameShell \{ display: grid; border: 1px solid #e0e6ef;/);
  assert.match(html, /\.mapFrameViewportEmpty \{ min-height: 280px; padding: 1\.5rem; text-align: center; \}/);
  assert.match(html, /\.mapViewportHint \{ margin: 0; max-width: 34rem; color: #5f6b7a; font-size: 1rem; line-height: 1\.55; \}/);
  assert.match(html, /\.breakdownCandlestick \{ display: flex; width: 100%; height: 1\.55rem;/);
  assert.match(html, /\.comparisonReportContainer/);
  assert.match(html, /\.comparisonReportContainer \{ background-color: #f4f6f9; border: 1px solid #dee2e6; border-radius: var\(--ce-radius-8, 8px\); padding: 1\.5rem; font-family: var\(--ce-font-body\); position: relative; \}/);
  assert.doesNotMatch(html, /\.comparisonReportContainer, \.riskMatrixSectionCard \{ padding: 12px; \}/);
  assert.match(html, /\.riskMatrixSectionCard \{ padding: 12px; \}/);
  assert.match(html, /\.comparisonReportEmptyState \{ text-align: center; padding: 2rem; \}/);
  assert.match(html, /\.comparisonReportEmptyIcon \{ color: #6c757d; display: inline-block; font-size: 2em; height: 1em; margin-bottom: 1rem; overflow: visible; vertical-align: -0\.125em; width: 1em; \}/);
  assert.match(html, /\.noData \{ font-style: italic; color: #666; \}/);
  assert.match(html, /\.demoAnalysisWorkspace \.noData, \.comparisonReportContainer \.noData \{ padding: 1\.5rem; text-align: center; color: var\(--ce-color-text-muted, #6c757d\); font-style: italic; \}/);
  assert.doesNotMatch(html, /\n\s*\.noData \{ padding: 1\.5rem; text-align: center; color: var\(--ce-color-text-muted, #6c757d\); font-style: italic; \}/);
  assert.match(html, /\.reportCollapseBody \{ display: grid; gap: 0; \}/);
  assert.match(html, /\.reportCollapseHeader \{ display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; width: 100%; margin: 0 0 1rem; padding: 0; border: 0; background: transparent; color: var\(--ce-color-dark, #212529\); text-align: left; cursor: pointer; \}/);
  assert.match(html, /\.reportCollapseHeader:hover \.mainReportTitle,\s*\.reportCollapseHeader:focus-visible \.mainReportTitle \{ color: #0f5ec7; \}/);
  assert.match(html, /\.reportCollapseHeader:focus-visible \{ outline: 2px solid #0f5ec7; outline-offset: 4px; border-radius: var\(--ce-radius-6, 6px\); \}/);
  assert.match(html, /\.comparisonReportContainer \.sectionCollapse,\s*\.comparisonReportSectionCollapse \{ margin-bottom: 1rem; padding: 0; border: 1px solid #e0e0e0; border-radius: var\(--ce-radius-8, 8px\); background-color: var\(--ce-color-white, #ffffff\); overflow: hidden; box-shadow: 0 2px 4px rgba\(0, 0, 0, 0\.05\); \}/);
  assert.match(html, /\.comparisonReportSectionCollapse \.sectionHeaderRow \{ display: flex; align-items: center; justify-content: flex-start; padding: 0\.75rem 1\.25rem; cursor: pointer; border-bottom: 1px solid var\(--ce-color-light, #f1f3f5\); margin-bottom: 0; \}/);
  assert.match(html, /\.comparisonReportSectionCollapse \.sectionHeaderRow:hover \{ background-color: var\(--ce-color-surface-light, #f8f9fa\); \}/);
  assert.match(html, /\.comparisonReportSectionCollapse \.sectionTitle \{ margin: 0; font-size: 1\.1rem; font-weight: 500; color: var\(--ce-color-dark, #212529\); line-height: 1\.2; \}/);
  assert.match(html, /\.comparisonReportSectionCollapse \.sectionTitle svg \{ margin-right: 10px; width: 1em; height: 1em; display: inline-block; overflow: visible; vertical-align: -0\.125em; \}/);
  assert.doesNotMatch(html, /\.comparisonReportSectionCollapse \{ margin-bottom: 1rem; padding: 0; background: transparent; border: 0; box-shadow: none; \}/);
  assert.match(html, /\.comparisonReportContainer \.analysisListItem \{ padding: 1rem 1\.25rem; justify-content: space-between; \}/);
  assert.match(html, /\.comparisonReportContainer \.reportAnalysisContent \{ gap: 0\.45rem; padding: 0; \}/);
  assert.match(html, /\.analysisList \{ list-style-type: none; padding: 1rem; margin: 0; display: grid; gap: 1rem; grid-template-columns: 1fr; \}/);
  assert.match(html, /@media \(min-width: 1024px\) \{\s*\.comparisonReportContainer \.analysisList \{ grid-template-columns: repeat\(2, 1fr\); \}\s*\}/);
  assert.match(html, /\.legendContainer \{ margin-bottom: 1rem; padding: 0\.75rem 1rem; background-color: var\(--ce-color-light, #f1f3f5\); border-radius: var\(--ce-radius-6, 6px\); display: flex; align-items: center; flex-wrap: wrap; gap: 10px; \}/);
  assert.match(html, /\.legendPills \{ display: flex; align-items: center; flex-wrap: wrap; gap: 8px; \}/);
  assert.match(html, /\.comparisonReportContainer \.legendPill \{ padding: 4px 12px; border: 0; border-radius: var\(--ce-radius-12, 12px\); color: var\(--ce-color-white, #ffffff\); font-size: 0\.9rem; font-weight: 500; text-shadow: 0 1px 1px rgba\(0, 0, 0, 0\.2\); box-shadow: 0 1px 2px rgba\(0, 0, 0, 0\.1\); \}/);
  assert.doesNotMatch(html, /class="demoResultsRiskMatrixSurface aidb-demo-results-risk-matrix-surface"/);
  assert.match(html, /id="risk-matrix"[\s\S]*?<div class="riskMatrixContainer container riskMatrixEmbedded embedded">/);
  assert.match(html, /class="riskMatrixContainer container riskMatrixEmbedded embedded"/);
  assert.match(html, /id="risk-matrix"[\s\S]*class="ce-report-section ce-results-mode-pane aidb-mode-pane aidb-risk-matrix-pane"/);
  assert.match(html, /class="riskMatrixShell shell"/);
  assert.match(html, /class="riskMatrixSectionCard sectionCard"/);
  assert.match(html, /class="riskMatrixGridScroll gridScroll"/);
  assert.match(html, /class="riskMatrixGridContainer gridContainer"/);
  assert.match(html, />Y \/ X</);
  assert.equal((html.match(/data-testid="ce-risk-matrix-header-x-/g) || []).length, 10);
  assert.equal((html.match(/data-testid="ce-risk-matrix-header-y-/g) || []).length, 10);
  assert.equal((html.match(/class="riskMatrixCell cell riskMatrixDiagonalCell diagonalCell"/g) || []).length, 10);
  assert.match(html, /data-testid="ce-risk-matrix-header-x-safety"/);
  assert.match(html, /data-testid="ce-risk-matrix-header-x-capabilities"/);
  assert.match(html, /data-testid="ce-risk-matrix-header-x-governance"/);
  assert.match(html, /data-testid="ce-risk-matrix-header-x-open-source"/);
  assert.match(html, /data-testid="ce-risk-matrix-header-x-crypto"/);
  assert.match(html, /data-testid="ce-risk-matrix-header-x-/);
  assert.match(html, /data-testid="ce-risk-matrix-header-y-/);
  assert.match(html, /data-testid="ce-risk-matrix-cell-/);
  assert.match(html, /data-ce-risk-matrix-cell/);
  assert.match(html, /data-ce-ai-analysis-target="risk-matrix-cell"/);
  assert.match(html, /data-ce-ai-analysis-target="risk-matrix-subcell"/);
  assert.match(html, /data-risk-cell-id="Capabilities_vs_Labor"/);
  assert.doesNotMatch(html, /"id": "Capabilities\.Reasoning\.Labor\.Productivity"/);
  assert.match(html, /data-risk-category-x="Safety"/);
  assert.match(html, /data-risk-category-y="Capabilities"/);
  assert.match(html, /data-risk-note-count="[0-9]+"/);
  assert.match(html, /id="ce-ai-discourse-bench-risk-matrix-analysis"/);
  assert.match(html, /"title": "Interaction: Capabilities vs Labor"/);
  assert.doesNotMatch(html, /AI-driven productivity gains could reshape knowledge work within 2 years/);
  assert.match(html, /<strong>Analysis not generated\.<\/strong> The measured benchmark does not infer risk or opportunity interactions\./);
  assert.match(html, /class="riskMatrixBackdrop" data-ce-risk-matrix-backdrop hidden/);
  assert.match(html, /class="riskMatrixCommentModal" data-ce-risk-matrix-modal hidden role="dialog" aria-modal="true"/);
  assert.match(html, /data-testid="ce-risk-matrix-modal"/);
  assert.match(html, /body\[data-ce-risk-matrix-modal-open="true"\] \{ overflow: hidden; \}/);
  assert.match(html, /document\.body\.setAttribute\('data-ce-risk-matrix-modal-open', 'true'\)/);
  assert.match(html, /document\.body\.removeAttribute\('data-ce-risk-matrix-modal-open'\)/);
  assert.match(html, /function openRiskMatrixModal\(point\)/);
  assert.match(html, /renderRiskCommentGroup\('Opportunities', opportunities, 'opportunity'/);
  assert.match(html, /document\.querySelectorAll\('\[data-ce-risk-matrix-cell\]'\)\.forEach/);
  assert.match(html, /class="riskMatrixCell cell riskMatrixHeaderCell headerCell activeHeaderCell"/);
  assert.match(html, /riskMatrixHeaderCell headerCell riskMatrixRowHeader activeHeaderCell/);
  assert.match(html, /class="riskMatrixCell cell riskMatrixGridCell gridCell/);
  assert.doesNotMatch(html, /opportunity balance \+/);
  assert.doesNotMatch(html, /risk balance -/);
  assert.doesNotMatch(html, /riskMatrixGridCellLinked gridCellLinked/);
  assert.match(html, /class="selectorGrid"/);
  assert.match(html, /class="selectorPanel"/);
  assert.match(html, /data-testid="ce-risk-matrix-selector-x-/);
  assert.match(html, /data-testid="ce-risk-matrix-selector-y-/);
  assert.match(html, /data-testid="ce-risk-matrix-selector-x-clear"[\s\S]*?disabled/);
  assert.match(html, /data-testid="ce-risk-matrix-subheader-x-/);
  assert.match(html, /data-testid="ce-risk-matrix-subheader-y-/);
  assert.match(html, /data-testid="ce-risk-matrix-subgrid"/);
  assert.match(html, /class="subgridContainer"/);
  assert.match(html, /data-testid="ce-risk-matrix-subcell-/);
  assert.match(html, /Refine generated analysis into sub-overlaps and open atlas-linked scenarios attached to each detail cell\./);
  assert.doesNotMatch(html, /class="riskMatrixCellMeta">AI analysis<\/span>/);
  assert.doesNotMatch(html, /AI Discourse Risk Matrix/);
  assert.doesNotMatch(html, /Facet Scenarios/);
  assert.doesNotMatch(html, /Raw material for AI-generated matrix narratives and atlas links\./);
  assert.match(html, /\.riskMatrixGridContainer/);
  assert.match(html, /\.riskMatrixGridCellLinked/);
  assert.match(html, /\.riskMatrixSectionHeader \{ display: flex;[\s\S]*font-size: 1rem;[\s\S]*cursor: default; \}/);
  assert.match(html, /\.riskMatrixContainer \.riskMatrixSectionHeader \{ font-size: 1rem; line-height: 1\.2; color: rgba\(244, 247, 255, 0\.96\); cursor: default; \}/);
  assert.match(html, /\.riskMatrixEmptyState \{ color: rgba\(190, 199, 230, 0\.82\); font-size: 0\.95rem; font-weight: 400; line-height: 1\.6; margin: 8px 0 0; \}/);
  assert.match(html, /grid-template-columns: 122px repeat\(10, minmax\(104px, 1fr\)\)/);
  assert.doesNotMatch(html, /grid-template-columns: 132px repeat\(10, minmax\(128px, 1fr\)\)/);
  assert.match(html, /\.riskMatrixContainer,\s*\.riskMatrixContainer\.container \{ color: rgba\(244, 247, 255, 0\.96\); font-family: var\(--ce-font-mono\); padding: 24px 18px 36px; \}/);
  assert.match(html, /\.riskMatrixEmbedded,\s*\.riskMatrixEmbedded\.embedded \{ background: transparent; min-height: unset; padding: 0; width: 100%; \}/);
  assert.match(html, /\.riskMatrixShell,\s*\.riskMatrixShell\.shell \{ display: flex; flex-direction: column; gap: 14px; \}/);
  assert.match(html, /\.riskMatrixSectionCard,\s*\.riskMatrixSectionCard\.sectionCard \{ padding: 16px; background: var\(--ce-card-bg\); border: 1px solid var\(--ce-card-border\); border-radius: var\(--ce-radius-14\); box-shadow: var\(--ce-card-shadow\); \}/);
  assert.match(html, /\.riskMatrixModalHeader \{[^}]*padding: 20px 20px 0; margin-bottom: 18px;[^}]*\}/);
  assert.doesNotMatch(html, /\.riskMatrixEmbedded \{ background: transparent; min-height: auto;/);
  assert.match(html, /\.riskMatrixCell,\s*\.riskMatrixCell\.cell \{[^}]*transition: transform 0\.16s ease, box-shadow 0\.2s ease, border-color 0\.16s ease, background-color 0\.16s ease; \}/);
  assert.match(html, /\.riskMatrixHeaderCell,\s*\.riskMatrixHeaderCell\.headerCell \{ min-height: 72px; padding: 10px;[\s\S]*font-size: 0\.88rem;[\s\S]*line-height: 1\.25;[^}]*\}/);
  assert.doesNotMatch(html, /\.riskMatrixHeaderCell \{[^}]*overflow-wrap: anywhere; word-break: break-word;/);
  assert.match(html, /\.riskMatrixHeaderCell,\s*\.riskMatrixHeaderCell\.headerCell \{[^}]*overflow-wrap: normal; word-break: normal; hyphens: manual;/);
  assert.match(html, /\.riskMatrixGridScroll,\s*\.riskMatrixGridScroll\.gridScroll \{ overflow-x: auto; padding-bottom: 6px; width: 100%; max-width: 100%; \}/);
  assert.match(html, /\.riskMatrixGridContainer,\s*\.riskMatrixGridContainer\.gridContainer \{ display: grid; gap: 8px; min-width: 980px; \}/);
  assert.doesNotMatch(html, /\.riskMatrixGridContainer \{ min-width: 1412px; \}/);
  assert.doesNotMatch(html, /@media \(max-width: 1024px\) \{[\s\S]*\.riskMatrixGridContainer \{ min-width: 1412px; \}/);
  assert.doesNotMatch(html, /@media \(max-width: 600px\) \{[\s\S]*\.riskMatrixGridContainer \{ min-width: 1412px; \}/);
  assert.match(html, /\.riskMatrixGridCell,\s*\.riskMatrixGridCell\.gridCell \{ min-height: 88px; align-items: center; justify-content: center; padding: 10px; background: #1f234f; \}/);
  assert.match(html, /\.riskMatrixGridCellLinked,\s*\.riskMatrixGridCellLinked\.gridCellLinked \{ border-color: rgba\(0, 197, 255, 0\.18\); box-shadow: inset 0 0 0 1px rgba\(0, 197, 255, 0\.08\), 0 12px 24px rgba\(0, 0, 0, 0\.14\); \}/);
  assert.match(html, /\.riskMatrixEmptyCell,\s*\.riskMatrixEmptyCell\.emptyCell \{ background: rgba\(255, 255, 255, 0\.04\); color: rgba\(244, 247, 255, 0\.35\); \}/);
  assert.match(html, /\.riskMatrixDiagonalCell, \.diagonalCell \{ cursor: default; background: rgba\(255, 255, 255, 0\.03\); color: rgba\(244, 247, 255, 0\.35\); font-size: 1\.35rem; \}/);
  assert.match(html, /\.riskMatrixContainer \.sectionTitle \{ color: rgba\(244, 247, 255, 0\.96\); \}/);
  assert.match(html, /\.selectorGrid \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(html, /\.subgridContainer \{ display: grid; gap: 8px; min-width: 100%; width: 100%; \}/);

  const ceExport = buildContextEnginePolisExport(report);
  assert.equal(ceExport.kind, 'ce_polis_question_responses_export');
  assert.equal(ceExport.counts.questions, 1);
  assert.equal(ceExport.counts.participants, 2);
  assert.equal(ceExport.counts.responses, 2);
  assert.equal(ceExport.displayNamesMap['model-a'], 'Model A');
  assert.equal(ceExport.displayNamesMap['model-b'], 'Model B');
  assert.equal(ceExport.questionResponses.aidb_0001.length, 2);
  assert.equal(ceExport.questionResponses.aidb_0001[0].responder, 'model-a');
  assert.deepEqual(JSON.parse(ceExport.questionResponses.aidb_0001[0].response).answer, {
    value: 'Agree',
    encrypted: false,
  });
});

test('report input helpers merge separate local model smoke artifacts', async () => {
  const modelRoster = mergeModelRosters([
    {
      schemaVersion: 1,
      models: [{
        id: 'model-a',
        label: 'Model A',
        model: 'provider/model-a',
        provider: 'local',
        traits: {},
      }],
    },
    {
      schemaVersion: 1,
      models: [{
        id: 'model-b',
        label: 'Model B',
        model: 'provider/model-b',
        provider: 'local',
        traits: {},
      }],
    },
  ]);
  const runsFile = mergeRunsFiles([
    {
      schemaVersion: 1,
      benchmarkId: 'bench',
      mode: 'self',
      runs: [{ modelId: 'model-a', questionId: 'q1', polarity: 'canonical', normalizedAnswer: 'Agree' }],
    },
    {
      schemaVersion: 1,
      benchmarkId: 'bench',
      mode: 'self',
      runs: [{ modelId: 'model-b', questionId: 'q1', polarity: 'canonical', normalizedAnswer: 'Disagree' }],
    },
  ]);

  assert.deepEqual(modelRoster.models.map((model) => model.id), ['model-a', 'model-b']);
  assert.equal(runsFile.runs.length, 2);
  assert.equal(runsFile.sourceRunFiles, 2);
});
