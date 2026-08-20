import { DEFAULT_IMPORTANCE_MAX_ALLOCATIONS } from './config.mjs';
import { hashJson } from './provenance.mjs';

export const parseInputFileList = (value) => String(value || '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);

const parsePositiveInt = (value, label) => {
  if (value === undefined || value === null || value === '' || value === 0) return 0;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
};

export const limitQuestionBank = (questionBank, limitQuestionsInput = 0) => {
  const limitQuestions = parsePositiveInt(limitQuestionsInput, '--limit-questions');
  if (!limitQuestions) return questionBank;
  return {
    ...questionBank,
    benchmarkId: `${questionBank.benchmarkId}-first-${limitQuestions}`,
    questions: (questionBank.questions || []).slice(0, limitQuestions),
    runPlan: {
      ...(questionBank.runPlan || {}),
      limitQuestions,
    },
  };
};

export const mergeModelRosters = (modelRosters) => {
  const modelsById = new Map();
  (modelRosters || []).forEach((roster, rosterIndex) => {
    (roster.models || []).forEach((model) => {
      if (!modelsById.has(model.id)) {
        modelsById.set(model.id, model);
        return;
      }
      const existing = modelsById.get(model.id);
      if (existing.model !== model.model || existing.provider !== model.provider) {
        throw new Error(`Model roster ${rosterIndex + 1} reuses id ${model.id} with a different model/provider`);
      }
    });
  });
  return {
    schemaVersion: 1,
    models: Array.from(modelsById.values()),
  };
};

const uniqueNonEmpty = (items) => Array.from(new Set(
  items.map((item) => String(item || '').trim()).filter(Boolean)
));

const assertCompatibleManifestFields = (files, label, fields) => {
  fields.forEach((field) => {
    const values = uniqueNonEmpty((files || []).map((file) => file?.manifest?.[field]));
    if (values.length > 1) {
      throw new Error(`${label} files use incompatible manifest.${field} values`);
    }
  });
};

export const benchmarkFamilyId = (value) => String(value || '')
  .replace(/-first-\d+$/, '')
  .trim();

export const mergeRunsFiles = (runsFiles) => {
  assertCompatibleManifestFields(runsFiles, 'run', [
    'harnessVersion',
    'harnessCommit',
    'questionBankHash',
    'promptTemplateVersion',
    'promptTemplateHash',
    'mode',
    'personaId',
    'personaProfileHash',
    'scheduleSeed',
  ]);
  const runs = (runsFiles || []).flatMap((runsFile) => runsFile.runs || []);
  (runsFiles || []).forEach((runsFile, index) => {
    const manifest = runsFile?.manifest;
    if (!manifest) return;
    if ((runsFile.mode || 'self') !== (manifest.mode || 'self')) {
      throw new Error(`run file ${index + 1} mode does not match its manifest`);
    }
    if ((runsFile.personaId || null) !== (manifest.personaId || null)) {
      throw new Error(`run file ${index + 1} personaId does not match its manifest`);
    }
    (runsFile.runs || []).forEach((run) => {
      if ((run.mode || 'self') !== (manifest.mode || 'self')
        || (run.personaId || null) !== (manifest.personaId || null)) {
        throw new Error(`run file ${index + 1} contains rows with mode/persona identity that does not match its manifest`);
      }
    });
  });
  const benchmarkIds = uniqueNonEmpty(runsFiles.map((runsFile) => runsFile.benchmarkId));
  const benchmarkFamilies = uniqueNonEmpty(benchmarkIds.map(benchmarkFamilyId));
  const modes = uniqueNonEmpty(runsFiles.map((runsFile) => runsFile.mode || 'self'));
  const personaIds = uniqueNonEmpty(runsFiles.map((runsFile) => runsFile.personaId));
  if (benchmarkFamilies.length > 1) {
    throw new Error(`run files use incompatible benchmark families: ${benchmarkIds.join(', ')}`);
  }
  if (modes.length > 1) {
    throw new Error(`run files mix benchmark modes: ${modes.join(', ')}`);
  }
  if (personaIds.length > 1 || (modes[0] === 'persona' && personaIds.length !== 1)) {
    throw new Error(`run files mix persona targets: ${personaIds.join(', ') || '(missing)'}`);
  }
  const repeatValues = uniqueNonEmpty(runsFiles.map((runsFile) => runsFile.repeats));
  return {
    schemaVersion: 1,
    kind: 'ai_discourse_bench_runs',
    benchmarkId: benchmarkFamilies[0] || benchmarkFamilyId(runs[0]?.benchmarkId) || 'ai-discourse-bench',
    sourceBenchmarkIds: benchmarkIds,
    mode: modes[0] || 'self',
    personaId: personaIds.length === 1 ? personaIds[0] : null,
    generatedAt: new Date().toISOString(),
    repeats: Math.max(0, ...runsFiles.map((runsFile) => Number(runsFile.repeats || 0)).filter(Number.isFinite)),
    repeatValues: repeatValues.map(Number).filter(Number.isFinite),
    sourceRunFiles: runsFiles.length,
    sourceManifests: runsFiles.map((runsFile) => runsFile.manifest).filter(Boolean),
    sourceRunContentHashes: runsFiles.map((runsFile) => hashJson(runsFile.runs || [])),
    runs,
  };
};

export const mergeImportanceRunFiles = (importanceFiles) => {
  const files = importanceFiles || [];
  assertCompatibleManifestFields(files, 'importance', [
    'harnessVersion',
    'questionBankHash',
    'promptTemplateVersion',
    'promptTemplateHash',
    'questionOrderMethod',
    'budget',
    'maxAllocations',
    'maxVotesPerQuestion',
    'repeats',
  ]);
  const runs = files.flatMap((file) => file.runs || []);
  const benchmarkIds = uniqueNonEmpty(files.map((file) => file.benchmarkId));
  const benchmarkFamilies = uniqueNonEmpty(benchmarkIds.map(benchmarkFamilyId));
  const budgets = uniqueNonEmpty(files.map((file) => file.budget)).map(Number);
  const maxAllocationCounts = [...new Set(files.map((file) => (
    Number(file.maxAllocations ?? DEFAULT_IMPORTANCE_MAX_ALLOCATIONS)
  )))];
  const maxVoteCounts = [...new Set(files.map((file) => {
    const budget = Number(file.budget);
    const maxAllocations = Number(file.maxAllocations ?? DEFAULT_IMPORTANCE_MAX_ALLOCATIONS);
    return Number(file.maxVotesPerQuestion ?? Math.max(1, Math.floor(Math.sqrt(budget / maxAllocations))));
  }))];
  const questionOrderMethods = uniqueNonEmpty(files.map((file) => (
    file.questionOrderMethod || 'legacy-bank-order-v1'
  )));
  if (benchmarkFamilies.length > 1) {
    throw new Error(`importance files use incompatible benchmark families: ${benchmarkIds.join(', ')}`);
  }
  if (budgets.length !== 1 || !Number.isInteger(budgets[0]) || budgets[0] < 1) {
    throw new Error(`importance files must use one positive integer budget; received ${budgets.join(', ') || '(missing)'}`);
  }
  if (maxAllocationCounts.length !== 1 || !Number.isInteger(maxAllocationCounts[0]) || maxAllocationCounts[0] < 1) {
    throw new Error(`importance files must use one positive max allocation count; received ${maxAllocationCounts.join(', ') || '(missing)'}`);
  }
  if (maxVoteCounts.length !== 1 || !Number.isInteger(maxVoteCounts[0]) || maxVoteCounts[0] < 1) {
    throw new Error(`importance files must use one positive per-question vote cap; received ${maxVoteCounts.join(', ') || '(missing)'}`);
  }
  if (questionOrderMethods.length !== 1) {
    throw new Error(`importance files must use one question-order method; received ${questionOrderMethods.join(', ')}`);
  }
  const safeVoteMaximum = Math.max(1, Math.floor(Math.sqrt(budgets[0] / maxAllocationCounts[0])));
  if (maxVoteCounts[0] !== safeVoteMaximum) {
    throw new Error(`importance per-question vote cap must equal the budget-derived safe maximum ${safeVoteMaximum}`);
  }
  return {
    schemaVersion: 1,
    kind: 'ai_discourse_bench_importance_runs',
    benchmarkId: benchmarkFamilies[0] || benchmarkFamilyId(runs[0]?.benchmarkId) || 'ai-discourse-bench',
    sourceBenchmarkIds: benchmarkIds,
    mode: 'quadratic-importance',
    generatedAt: new Date().toISOString(),
    budget: budgets[0],
    maxAllocations: maxAllocationCounts[0],
    maxVotesPerQuestion: maxVoteCounts[0],
    questionOrderMethod: questionOrderMethods[0],
    repeats: Math.max(0, ...files.map((file) => Number(file.repeats || 0)).filter(Number.isFinite)),
    sourceRunFiles: files.length,
    sourceManifests: files.map((file) => file.manifest).filter(Boolean),
    sourceImportanceContentHashes: files.map((file) => hashJson(file.runs || [])),
    runs,
  };
};
