import { ANSWER_VALUES, PROVIDERS } from './config.mjs';

const isRecord = (value) => (
  !!value && typeof value === 'object' && !Array.isArray(value)
);

const requireString = (errors, value, path) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(`${path} must be a non-empty string`);
  }
};

const requireArray = (errors, value, path) => {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return [];
  }
  return value;
};

const requireHttpUrl = (errors, value, path) => {
  requireString(errors, value, path);
  if (typeof value !== 'string') return;
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      errors.push(`${path} must use http or https`);
    }
  } catch {
    errors.push(`${path} must be a valid URL`);
  }
};

export const validateQuestionBank = (questionBank) => {
  const errors = [];
  if (!isRecord(questionBank)) {
    return ['question bank must be an object'];
  }
  requireString(errors, questionBank.benchmarkId, 'benchmarkId');
  if (questionBank.releaseStatus !== undefined
    && !['development-seed', 'candidate', 'validated'].includes(questionBank.releaseStatus)) {
    errors.push('releaseStatus must be development-seed, candidate, or validated');
  }
  if (!isRecord(questionBank.runPlan)) {
    errors.push('runPlan must be an object');
  } else {
    if (!Number.isInteger(Number(questionBank.runPlan.repeatsPerPolarity)) || Number(questionBank.runPlan.repeatsPerPolarity) < 1) {
      errors.push('runPlan.repeatsPerPolarity must be a positive integer');
    }
    if (!Array.isArray(questionBank.runPlan.polarities)
      || questionBank.runPlan.polarities.length !== 2
      || !questionBank.runPlan.polarities.includes('canonical')
      || !questionBank.runPlan.polarities.includes('reversed')) {
      errors.push('runPlan.polarities must contain canonical and reversed');
    }
  }
  const questions = requireArray(errors, questionBank.questions, 'questions');
  const seen = new Set();
  questions.forEach((question, index) => {
    const base = `questions[${index}]`;
    if (!isRecord(question)) {
      errors.push(`${base} must be an object`);
      return;
    }
    requireString(errors, question.id, `${base}.id`);
    if (seen.has(question.id)) errors.push(`${base}.id duplicates ${question.id}`);
    seen.add(question.id);
    requireString(errors, question.canonicalPrompt, `${base}.canonicalPrompt`);
    requireString(errors, question.reversedPrompt, `${base}.reversedPrompt`);
    requireString(errors, question.agreeMeans, `${base}.agreeMeans`);
    requireString(errors, question.topic, `${base}.topic`);
    requireString(errors, question.disagreementAxis, `${base}.disagreementAxis`);
    if (question.answerType !== 'agree_unsure_disagree') {
      errors.push(`${base}.answerType must be agree_unsure_disagree`);
    }
    if (!Array.isArray(question.sourceAnchors) && !Array.isArray(question.agentVillageAnchors)) {
      errors.push(`${base} must include sourceAnchors or agentVillageAnchors`);
    }
  });
  return errors;
};

export const validateModelRoster = (modelRoster) => {
  const errors = [];
  if (!isRecord(modelRoster)) {
    return ['model roster must be an object'];
  }
  const models = requireArray(errors, modelRoster.models, 'models');
  const seen = new Set();
  models.forEach((model, index) => {
    const base = `models[${index}]`;
    if (!isRecord(model)) {
      errors.push(`${base} must be an object`);
      return;
    }
    requireString(errors, model.id, `${base}.id`);
    if (seen.has(model.id)) errors.push(`${base}.id duplicates ${model.id}`);
    seen.add(model.id);
    requireString(errors, model.label, `${base}.label`);
    requireString(errors, model.model, `${base}.model`);
    if (!PROVIDERS.includes(model.provider)) {
      errors.push(`${base}.provider must be one of ${PROVIDERS.join(', ')}`);
    }
    if (!isRecord(model.traits)) {
      errors.push(`${base}.traits must be an object`);
    }
    if (model.temperature !== undefined) {
      const temperature = Number(model.temperature);
      if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
        errors.push(`${base}.temperature must be between 0 and 2`);
      }
    }
    if (model.maxTokens !== undefined && (!Number.isInteger(Number(model.maxTokens)) || Number(model.maxTokens) < 1)) {
      errors.push(`${base}.maxTokens must be a positive integer`);
    }
    if (model.timeoutMs !== undefined && (!Number.isInteger(Number(model.timeoutMs)) || Number(model.timeoutMs) < 1)) {
      errors.push(`${base}.timeoutMs must be a positive integer`);
    }
  });
  return errors;
};

export const validatePersonas = (personasFile) => {
  const errors = [];
  if (!isRecord(personasFile)) {
    return ['personas file must be an object'];
  }
  const personas = requireArray(errors, personasFile.personas, 'personas');
  const seen = new Set();
  personas.forEach((persona, index) => {
    const base = `personas[${index}]`;
    if (!isRecord(persona)) {
      errors.push(`${base} must be an object`);
      return;
    }
    requireString(errors, persona.id, `${base}.id`);
    if (seen.has(persona.id)) errors.push(`${base}.id duplicates ${persona.id}`);
    seen.add(persona.id);
    requireString(errors, persona.label, `${base}.label`);
    requireString(errors, persona.instruction, `${base}.instruction`);
    if (persona.publicFigure !== true) {
      errors.push(`${base}.publicFigure must be true for benchmark personas`);
    }
    if (persona.profileType !== 'public-figure-counterfactual') {
      errors.push(`${base}.profileType must be public-figure-counterfactual`);
    }
    if (persona.evaluationClaim !== 'simulation-not-ground-truth') {
      errors.push(`${base}.evaluationClaim must be simulation-not-ground-truth`);
    }
    requireString(errors, persona.asOf, `${base}.asOf`);
    if (typeof persona.asOf === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(persona.asOf)) {
      errors.push(`${base}.asOf must use YYYY-MM-DD`);
    }
    const sources = requireArray(errors, persona.sources, `${base}.sources`);
    if (sources.length === 0) errors.push(`${base}.sources must contain at least one public source`);
    sources.forEach((source, sourceIndex) => {
      const sourceBase = `${base}.sources[${sourceIndex}]`;
      if (!isRecord(source)) {
        errors.push(`${sourceBase} must be an object`);
        return;
      }
      requireString(errors, source.title, `${sourceBase}.title`);
      requireHttpUrl(errors, source.url, `${sourceBase}.url`);
    });
  });
  return errors;
};

export const validateRuns = (runsFile, {
  modelIds = null,
  questionIds = null,
  benchmarkId = '',
  requireRunIds = false,
  requireRepeatIndex = false,
  maxRepeatIndex = null,
  requireProvenance = false,
  mode = '',
  personaId = null,
} = {}) => {
  const errors = [];
  if (!isRecord(runsFile)) return ['runs file must be an object'];
  const runs = requireArray(errors, runsFile.runs, 'runs');
  const seenRunIds = new Set();
  const seenCoordinates = new Set();
  runs.forEach((run, index) => {
    const base = `runs[${index}]`;
    if (!isRecord(run)) {
      errors.push(`${base} must be an object`);
      return;
    }
    requireString(errors, run.modelId, `${base}.modelId`);
    requireString(errors, run.questionId, `${base}.questionId`);
    if (modelIds && !modelIds.has(run.modelId)) {
      errors.push(`${base}.modelId references unknown model ${run.modelId}`);
    }
    if (questionIds && !questionIds.has(run.questionId)) {
      errors.push(`${base}.questionId references unknown question ${run.questionId}`);
    }
    if (benchmarkId && run.benchmarkId && run.benchmarkId !== benchmarkId && !run.benchmarkId.startsWith(`${benchmarkId}-first-`)) {
      errors.push(`${base}.benchmarkId ${run.benchmarkId} is incompatible with ${benchmarkId}`);
    }
    if (requireProvenance) {
      requireString(errors, run.benchmarkId, `${base}.benchmarkId`);
      requireString(errors, run.mode, `${base}.mode`);
      requireString(errors, run.provider, `${base}.provider`);
      if (run.provider && !PROVIDERS.includes(run.provider)) {
        errors.push(`${base}.provider must be one of ${PROVIDERS.join(', ')}`);
      }
      requireString(errors, run.promptHash, `${base}.promptHash`);
      if (typeof run.promptHash === 'string' && !/^[a-f0-9]{64}$/i.test(run.promptHash)) {
        errors.push(`${base}.promptHash must be a SHA-256 hex digest`);
      }
      if (!isRecord(run.generation)) {
        errors.push(`${base}.generation must be an object`);
      }
      if (mode && run.mode !== mode) errors.push(`${base}.mode ${run.mode || '(missing)'} does not match ${mode}`);
      if ((run.personaId || null) !== (personaId || null)) {
        errors.push(`${base}.personaId does not match ${personaId || 'self'}`);
      }
    }
    if (!['canonical', 'reversed'].includes(run.polarity)) {
      errors.push(`${base}.polarity must be canonical or reversed`);
    }
    if (run.normalizedAnswer !== null && !ANSWER_VALUES.includes(run.normalizedAnswer)) {
      errors.push(`${base}.normalizedAnswer must be Agree, Unsure, Disagree, or null`);
    }
    if (run.confidence !== null && run.confidence !== undefined) {
      const confidence = Number(run.confidence);
      if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
        errors.push(`${base}.confidence must be between 0 and 1`);
      }
    }
    if (requireRunIds) requireString(errors, run.runId, `${base}.runId`);
    if (run.runId) {
      if (seenRunIds.has(run.runId)) errors.push(`${base}.runId duplicates ${run.runId}`);
      seenRunIds.add(run.runId);
      if (requireProvenance && run.benchmarkId && run.mode && run.repeatIndex !== undefined) {
        const expectedRunId = [
          run.benchmarkId,
          run.mode,
          run.personaId || 'self',
          run.modelId,
          run.questionId,
          run.polarity,
          run.repeatIndex,
        ].join(':');
        if (run.runId !== expectedRunId) errors.push(`${base}.runId does not match its run coordinates`);
      }
    }
    if (requireRepeatIndex && run.repeatIndex === undefined) {
      errors.push(`${base}.repeatIndex is required`);
    }
    if (run.repeatIndex !== undefined && (!Number.isInteger(Number(run.repeatIndex)) || Number(run.repeatIndex) < 1)) {
      errors.push(`${base}.repeatIndex must be a positive integer`);
    }
    if (run.repeatIndex !== undefined
      && maxRepeatIndex !== null
      && maxRepeatIndex !== undefined
      && Number.isInteger(Number(maxRepeatIndex))
      && Number(run.repeatIndex) > Number(maxRepeatIndex)) {
      errors.push(`${base}.repeatIndex must not exceed ${maxRepeatIndex}`);
    }
    if (run.repeatIndex !== undefined) {
      const coordinate = [run.modelId, run.questionId, run.polarity, run.repeatIndex].join(':');
      if (seenCoordinates.has(coordinate)) errors.push(`${base} duplicates run coordinate ${coordinate}`);
      seenCoordinates.add(coordinate);
    }
  });
  return errors;
};

export const validateReleaseRunFile = (runsFile, {
  questionBankHash,
  requiredRepeats,
  questionCount,
  selectedModelsById = null,
} = {}) => {
  const errors = [];
  if (!isRecord(runsFile)) return ['release run file must be an object'];
  const manifest = runsFile.manifest;
  if (!isRecord(manifest)) return ['manifest must be an object for release'];
  if (manifest.kind !== 'ai_discourse_bench_run_manifest') {
    errors.push('manifest.kind must be ai_discourse_bench_run_manifest');
  }
  for (const field of ['harnessVersion', 'harnessCommit', 'questionBankHash', 'modelRosterHash', 'promptTemplateVersion', 'promptTemplateHash', 'scheduleSeed']) {
    requireString(errors, manifest[field], `manifest.${field}`);
  }
  if (typeof manifest.harnessCommit === 'string' && !/^[a-f0-9]{40,64}$/i.test(manifest.harnessCommit)) {
    errors.push('manifest.harnessCommit must be a git commit or source digest');
  }
  for (const field of ['questionBankHash', 'modelRosterHash', 'promptTemplateHash']) {
    if (typeof manifest[field] === 'string' && !/^[a-f0-9]{64}$/i.test(manifest[field])) {
      errors.push(`manifest.${field} must be a SHA-256 hex digest`);
    }
  }
  if (questionBankHash && manifest.questionBankHash !== questionBankHash) {
    errors.push('manifest.questionBankHash does not match the selected question bank');
  }
  if (!Number.isInteger(Number(manifest.repeats)) || Number(manifest.repeats) !== Number(requiredRepeats)) {
    errors.push(`manifest.repeats must equal the required ${requiredRepeats}`);
  }
  const runs = Array.isArray(runsFile.runs) ? runsFile.runs : [];
  const manifestModels = requireArray(errors, manifest.models, 'manifest.models');
  const manifestModelsById = new Map();
  manifestModels.forEach((model, index) => {
    if (!isRecord(model)) {
      errors.push(`manifest.models[${index}] must be an object`);
      return;
    }
    requireString(errors, model.id, `manifest.models[${index}].id`);
    requireString(errors, model.model, `manifest.models[${index}].model`);
    if (!PROVIDERS.includes(model.provider)) {
      errors.push(`manifest.models[${index}].provider must be one of ${PROVIDERS.join(', ')}`);
    }
    if (manifestModelsById.has(model.id)) errors.push(`manifest.models[${index}].id duplicates ${model.id}`);
    manifestModelsById.set(model.id, model);
    if (selectedModelsById) {
      const selected = selectedModelsById.get(model.id);
      if (!selected) {
        errors.push(`manifest.models[${index}].id is absent from the selected model roster`);
        return;
      }
      const expectedProvider = manifest.providerOverride || selected.provider;
      if (model.model !== selected.model) {
        errors.push(`manifest.models[${index}].model does not match the selected model roster`);
      }
      if (model.provider !== expectedProvider) {
        errors.push(`manifest.models[${index}].provider does not match the selected model roster or provider override`);
      }
      const expectedGeneration = {
        temperature: selected.temperature ?? 0.2,
        maxTokens: selected.maxTokens ?? 220,
        timeoutMs: selected.timeoutMs ?? null,
      };
      if (Number(model.temperature) !== Number(expectedGeneration.temperature)
        || Number(model.maxTokens) !== Number(expectedGeneration.maxTokens)
        || (model.timeoutMs ?? null) !== expectedGeneration.timeoutMs) {
        errors.push(`manifest.models[${index}] generation settings do not match the selected model roster`);
      }
    }
  });
  if (!Number.isInteger(Number(manifest.expectedRuns)) || Number(manifest.expectedRuns) < 1) {
    errors.push('manifest.expectedRuns must be a positive integer');
  }
  if (Number(manifest.completedRuns) !== Number(manifest.expectedRuns)) {
    errors.push('manifest.completedRuns must equal manifest.expectedRuns');
  }
  if (runs.length !== Number(manifest.completedRuns)) {
    errors.push('run count must equal manifest.completedRuns');
  }
  const calculatedExpectedRuns = Number(questionCount) * manifestModels.length * 2 * Number(requiredRepeats);
  if (Number.isInteger(calculatedExpectedRuns) && calculatedExpectedRuns > 0
    && Number(manifest.expectedRuns) !== calculatedExpectedRuns) {
    errors.push(`manifest.expectedRuns must equal ${calculatedExpectedRuns} for its models and question bank`);
  }
  runs.forEach((run, index) => {
    const model = manifestModelsById.get(run?.modelId);
    if (!model) {
      errors.push(`runs[${index}].modelId is absent from manifest.models`);
      return;
    }
    if (run.model !== model.model) errors.push(`runs[${index}].model does not match manifest.models`);
    if (run.provider !== model.provider) errors.push(`runs[${index}].provider does not match manifest.models`);
  });
  return errors;
};

export const validateAnalysisOverlay = (overlay, { questionIds = null } = {}) => {
  const errors = [];
  if (!isRecord(overlay)) return ['analysis overlay must be an object'];
  if (overlay.kind !== 'ai_discourse_bench_analysis_overlay') {
    errors.push('kind must be ai_discourse_bench_analysis_overlay');
  }
  const provenance = overlay.provenance;
  if (!isRecord(provenance)) {
    errors.push('provenance must be an object');
  } else {
    requireString(errors, provenance.generatedBy, 'provenance.generatedBy');
    requireString(errors, provenance.model, 'provenance.model');
    requireString(errors, provenance.promptVersion, 'provenance.promptVersion');
    requireString(errors, provenance.inputReportHash, 'provenance.inputReportHash');
    requireString(errors, provenance.generatedAt, 'provenance.generatedAt');
  }
  const cells = overlay.riskMatrix?.cells;
  if (cells !== undefined && !isRecord(cells)) errors.push('riskMatrix.cells must be an object');
  const topics = overlay.debateAtlas?.topicCircles;
  if (topics !== undefined && !Array.isArray(topics)) errors.push('debateAtlas.topicCircles must be an array');
  const compasses = overlay.debateAtlas?.compasses;
  if (compasses !== undefined && !Array.isArray(compasses)) errors.push('debateAtlas.compasses must be an array');
  if (isRecord(cells)) {
    Object.entries(cells).forEach(([cellId, cell]) => {
      const aggregateId = /^[A-Za-z][A-Za-z ]*_vs_[A-Za-z][A-Za-z ]*$/.test(cellId);
      const subcellId = cellId.split('.').length === 4 && cellId.split('.').every((part) => /^[A-Za-z][A-Za-z ]*$/.test(part));
      if (!aggregateId && !subcellId) errors.push(`riskMatrix.cells contains invalid cell id ${cellId}`);
      if (!isRecord(cell)) {
        errors.push(`riskMatrix.cells.${cellId} must be an object`);
        return;
      }
      for (const field of ['opportunities', 'risks', 'linkedQuestionIds', 'linkedTopicIds', 'scenarios']) {
        if (cell[field] !== undefined && !Array.isArray(cell[field])) {
          errors.push(`riskMatrix.cells.${cellId}.${field} must be an array`);
        }
      }
    });
  }
  if (Array.isArray(topics)) {
    topics.forEach((topic, index) => {
      if (!isRecord(topic)) {
        errors.push(`debateAtlas.topicCircles[${index}] must be an object`);
        return;
      }
      requireString(errors, topic.id, `debateAtlas.topicCircles[${index}].id`);
      if (topic.questionIds !== undefined && !Array.isArray(topic.questionIds)) {
        errors.push(`debateAtlas.topicCircles[${index}].questionIds must be an array`);
      }
    });
  }
  if (questionIds) {
    const linkedIds = [
      ...(Array.isArray(topics) ? topics.flatMap((topic) => Array.isArray(topic?.questionIds) ? topic.questionIds : []) : []),
      ...(isRecord(cells) ? Object.values(cells).flatMap((cell) => Array.isArray(cell?.linkedQuestionIds) ? cell.linkedQuestionIds : []) : []),
    ];
    linkedIds.forEach((questionId) => {
      if (!questionIds.has(questionId)) errors.push(`analysis overlay references unknown question ${questionId}`);
    });
  }
  return errors;
};

export const throwIfErrors = (label, errors) => {
  if (errors.length > 0) {
    throw new Error(`${label} validation failed:\n- ${errors.join('\n- ')}`);
  }
};
