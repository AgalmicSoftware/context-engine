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

export const benchmarkFamilyId = (value) => String(value || '')
  .replace(/-first-\d+$/, '')
  .trim();

export const mergeRunsFiles = (runsFiles) => {
  const runs = (runsFiles || []).flatMap((runsFile) => runsFile.runs || []);
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
    runs,
  };
};
