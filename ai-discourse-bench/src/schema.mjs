import {
  ANSWER_VALUES,
  HARNESS_VERSION,
  PROVIDERS,
  QUESTION_PROMPT_TEMPLATE_VERSION,
} from './config.mjs';
import {
  buildQuestionPrompt,
  normalizeAnswer,
  normalizeForCanonicalPolarity,
} from './normalize.mjs';
import {
  registerCaseFoldedIdentifier,
  validateSafeIdentifier,
} from './identifiers.mjs';
import { hashJson, sha256 } from './provenance.mjs';

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
  validateSafeIdentifier(errors, questionBank.benchmarkId, 'benchmarkId');
  if (questionBank.releaseStatus !== undefined
    && !['development-seed', 'candidate', 'validated'].includes(questionBank.releaseStatus)) {
    errors.push('releaseStatus must be development-seed, candidate, or validated');
  }
  const requiresReleaseMetadata = ['candidate', 'validated'].includes(questionBank.releaseStatus);
  const validatedBank = questionBank.releaseStatus === 'validated';
  if (validatedBank) {
    if (!isRecord(questionBank.reviewPolicy)) {
      errors.push('reviewPolicy must be an object for validated banks');
    } else {
      for (const field of [
        'humanClaimReviewComplete',
        'humanReversalReviewComplete',
        'humanSingleAxisReviewComplete',
      ]) {
        if (questionBank.reviewPolicy[field] !== true) {
          errors.push(`reviewPolicy.${field} must be true for validated banks`);
        }
      }
      if (questionBank.reviewPolicy.releaseBlockedUntilApproved !== false) {
        errors.push('reviewPolicy.releaseBlockedUntilApproved must be false for validated banks');
      }
      if (!Number.isInteger(Number(questionBank.reviewPolicy.minimumIndependentReviewers))
        || Number(questionBank.reviewPolicy.minimumIndependentReviewers) < 2) {
        errors.push('reviewPolicy.minimumIndependentReviewers must be at least 2 for validated banks');
      }
    }
  }
  if (requiresReleaseMetadata) {
    requireString(errors, questionBank.track, 'track');
    requireString(errors, questionBank.version, 'version');
    if (!isRecord(questionBank.sourceCorpus)) {
      errors.push('sourceCorpus must be an object for candidate and validated banks');
    } else {
      requireString(errors, questionBank.sourceCorpus.name, 'sourceCorpus.name');
      requireString(errors, questionBank.sourceCorpus.revision, 'sourceCorpus.revision');
    }
  }
  if (!isRecord(questionBank.runPlan)) {
    errors.push('runPlan must be an object');
  } else {
    if (!Number.isInteger(Number(questionBank.runPlan.repeatsPerPolarity)) || Number(questionBank.runPlan.repeatsPerPolarity) < 1) {
      errors.push('runPlan.repeatsPerPolarity must be a positive integer');
    }
    if (questionBank.runPlan.importanceRepeats !== undefined
      && (!Number.isInteger(Number(questionBank.runPlan.importanceRepeats))
        || Number(questionBank.runPlan.importanceRepeats) < 1)) {
      errors.push('runPlan.importanceRepeats must be a positive integer when provided');
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
    validateSafeIdentifier(errors, question.id, `${base}.id`);
    registerCaseFoldedIdentifier(errors, seen, question.id, `${base}.id`);
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
    if (requiresReleaseMetadata) {
      if (!['normative', 'empirical', 'forecast', 'moral', 'institutional'].includes(question.claimType)) {
        errors.push(`${base}.claimType must be normative, empirical, forecast, moral, or institutional`);
      }
      requireString(errors, question.selectionRationale, `${base}.selectionRationale`);
      const sourceEvidence = requireArray(errors, question.sourceEvidence, `${base}.sourceEvidence`);
      if (sourceEvidence.length === 0) errors.push(`${base}.sourceEvidence must not be empty`);
      sourceEvidence.forEach((evidence, evidenceIndex) => {
        const evidenceBase = `${base}.sourceEvidence[${evidenceIndex}]`;
        if (!isRecord(evidence)) {
          errors.push(`${evidenceBase} must be an object`);
          return;
        }
        requireString(errors, evidence.corpus, `${evidenceBase}.corpus`);
        requireString(errors, evidence.idOrUrl, `${evidenceBase}.idOrUrl`);
        requireString(errors, evidence.title, `${evidenceBase}.title`);
        requireString(errors, evidence.sourceRecordHash, `${evidenceBase}.sourceRecordHash`);
        if (typeof evidence.sourceRecordHash === 'string' && !/^[a-f0-9]{64}$/i.test(evidence.sourceRecordHash)) {
          errors.push(`${evidenceBase}.sourceRecordHash must be a SHA-256 hex digest`);
        }
        if (evidence.resolution !== 'resolved') errors.push(`${evidenceBase}.resolution must be resolved`);
        const supportingRecords = requireArray(errors, evidence.supportingRecords, `${evidenceBase}.supportingRecords`);
        const hasConcreteUrl = typeof evidence.url === 'string'
          || supportingRecords.some((record) => typeof record?.url === 'string');
        if (!hasConcreteUrl) errors.push(`${evidenceBase} must include a concrete source URL`);
      });
      if (!isRecord(question.review)) {
        errors.push(`${base}.review must be an object`);
      } else {
        if (question.review.sourceResolution !== 'resolved') {
          errors.push(`${base}.review.sourceResolution must be resolved`);
        }
        if (validatedBank) {
          for (const field of ['claimSupport', 'reversal', 'singleAxis']) {
            if (question.review[field] !== 'approved') {
              errors.push(`${base}.review.${field} must be approved for validated banks`);
            }
          }
          if (question.review.adjudicationStatus !== 'approved') {
            errors.push(`${base}.review.adjudicationStatus must be approved for validated banks`);
          }
          const minimumReviewers = Number(questionBank.reviewPolicy?.minimumIndependentReviewers || 2);
          const independentReviews = requireArray(
            errors,
            question.review.independentReviews,
            `${base}.review.independentReviews`,
          );
          const reviewerIds = new Set();
          independentReviews.forEach((review, reviewIndex) => {
            const reviewBase = `${base}.review.independentReviews[${reviewIndex}]`;
            if (!isRecord(review)) {
              errors.push(`${reviewBase} must be an object`);
              return;
            }
            requireString(errors, review.reviewerId, `${reviewBase}.reviewerId`);
            if (reviewerIds.has(review.reviewerId)) {
              errors.push(`${reviewBase}.reviewerId duplicates ${review.reviewerId}`);
            }
            reviewerIds.add(review.reviewerId);
            for (const field of ['claimSupport', 'reversal', 'singleAxis']) {
              if (review[field] !== 'approved') {
                errors.push(`${reviewBase}.${field} must be approved`);
              }
            }
          });
          if (reviewerIds.size < minimumReviewers) {
            errors.push(`${base}.review.independentReviews must include at least ${minimumReviewers} distinct reviewers`);
          }
          const expectedQuestionHash = hashJson({
            canonicalPrompt: question.canonicalPrompt,
            reversedPrompt: question.reversedPrompt,
            agreeMeans: question.agreeMeans,
            disagreementAxis: question.disagreementAxis,
          });
          if (question.review.questionHash !== expectedQuestionHash) {
            errors.push(`${base}.review.questionHash must match the reviewed question wording`);
          }
        }
      }
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
    validateSafeIdentifier(errors, model.id, `${base}.id`);
    registerCaseFoldedIdentifier(errors, seen, model.id, `${base}.id`);
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
    if (model.structuredOutput !== undefined
      && !['auto', 'none', 'json_object', 'json_schema'].includes(model.structuredOutput)) {
      errors.push(`${base}.structuredOutput must be auto, none, json_object, or json_schema`);
    }
    if (model.providerRouting !== undefined && !isRecord(model.providerRouting)) {
      errors.push(`${base}.providerRouting must be an object`);
    }
    if (isRecord(model.providerRouting)) {
      if (model.provider !== 'openrouter') {
        errors.push(`${base}.providerRouting is only valid for openrouter models`);
      }
      const allowedRoutingFields = new Set(['order', 'allow_fallbacks', 'require_parameters', 'data_collection', 'zdr']);
      Object.keys(model.providerRouting).forEach((field) => {
        if (!allowedRoutingFields.has(field)) errors.push(`${base}.providerRouting.${field} is not supported`);
      });
      if (model.providerRouting.order !== undefined) {
        const order = requireArray(errors, model.providerRouting.order, `${base}.providerRouting.order`);
        const seenProviders = new Set();
        order.forEach((providerName, providerIndex) => {
          requireString(errors, providerName, `${base}.providerRouting.order[${providerIndex}]`);
          if (seenProviders.has(providerName)) errors.push(`${base}.providerRouting.order duplicates ${providerName}`);
          seenProviders.add(providerName);
        });
      }
      for (const field of ['allow_fallbacks', 'require_parameters', 'zdr']) {
        if (model.providerRouting[field] !== undefined && typeof model.providerRouting[field] !== 'boolean') {
          errors.push(`${base}.providerRouting.${field} must be a boolean`);
        }
      }
      if (model.providerRouting.data_collection !== undefined
        && !['allow', 'deny'].includes(model.providerRouting.data_collection)) {
        errors.push(`${base}.providerRouting.data_collection must be allow or deny`);
      }
    }
    if (model.provenance !== undefined && !isRecord(model.provenance)) {
      errors.push(`${base}.provenance must be an object`);
    }
    if (isRecord(model.provenance)) {
      for (const field of ['modelRevision', 'weightsRevision', 'quantization', 'inferenceEngine', 'runtimeVersion', 'systemPromptId', 'license', 'asOf']) {
        if (model.provenance[field] !== undefined) requireString(errors, model.provenance[field], `${base}.provenance.${field}`);
      }
      if (model.provenance.sourceUrl !== undefined) requireHttpUrl(errors, model.provenance.sourceUrl, `${base}.provenance.sourceUrl`);
    }
    if (model.pricing !== undefined && !isRecord(model.pricing)) {
      errors.push(`${base}.pricing must be an object`);
    }
    if (isRecord(model.pricing)) {
      for (const field of ['inputPerMillion', 'outputPerMillion']) {
        if (model.pricing[field] !== undefined
          && (!Number.isFinite(Number(model.pricing[field])) || Number(model.pricing[field]) < 0)) {
          errors.push(`${base}.pricing.${field} must be a non-negative number`);
        }
      }
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
    validateSafeIdentifier(errors, persona.id, `${base}.id`);
    registerCaseFoldedIdentifier(errors, seen, persona.id, `${base}.id`);
    requireString(errors, persona.label, `${base}.label`);
    if (persona.publicFigure !== true) {
      errors.push(`${base}.publicFigure must be true for benchmark personas`);
    }
    if (persona.profileType !== 'public-figure-weights-only') {
      errors.push(`${base}.profileType must be public-figure-weights-only`);
    }
    if (persona.evaluationClaim !== 'model-interpretation-not-ground-truth') {
      errors.push(`${base}.evaluationClaim must be model-interpretation-not-ground-truth`);
    }
    const allowedFields = new Set(['id', 'label', 'publicFigure', 'profileType', 'evaluationClaim']);
    Object.keys(persona).forEach((field) => {
      if (!allowedFields.has(field)) {
        errors.push(`${base}.${field} is not allowed in weights-only persona mode`);
      }
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
    validateSafeIdentifier(errors, run.modelId, `${base}.modelId`);
    validateSafeIdentifier(errors, run.questionId, `${base}.questionId`);
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
      const coordinate = JSON.stringify([run.modelId, run.questionId, run.polarity, run.repeatIndex]);
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
  questionBank = null,
  expectedHarnessVersion = HARNESS_VERSION,
  expectedPromptTemplateVersion = QUESTION_PROMPT_TEMPLATE_VERSION,
  expectedPromptTemplateHash = '',
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
  if (expectedHarnessVersion && manifest.harnessVersion !== expectedHarnessVersion) {
    errors.push(`manifest.harnessVersion must equal ${expectedHarnessVersion}`);
  }
  if (expectedPromptTemplateVersion && manifest.promptTemplateVersion !== expectedPromptTemplateVersion) {
    errors.push(`manifest.promptTemplateVersion must equal ${expectedPromptTemplateVersion}`);
  }
  if (expectedPromptTemplateHash && manifest.promptTemplateHash !== expectedPromptTemplateHash) {
    errors.push('manifest.promptTemplateHash does not match the current question prompt template');
  }
  if (!Number.isInteger(Number(manifest.repeats)) || Number(manifest.repeats) !== Number(requiredRepeats)) {
    errors.push(`manifest.repeats must equal the required ${requiredRepeats}`);
  }
  const runs = Array.isArray(runsFile.runs) ? runsFile.runs : [];
  const questionsById = new Map((questionBank?.questions || []).map((question) => [question.id, question]));
  const manifestModels = requireArray(errors, manifest.models, 'manifest.models');
  const manifestModelsById = new Map();
  const manifestModelIds = new Set();
  manifestModels.forEach((model, index) => {
    if (!isRecord(model)) {
      errors.push(`manifest.models[${index}] must be an object`);
      return;
    }
    validateSafeIdentifier(errors, model.id, `manifest.models[${index}].id`);
    requireString(errors, model.model, `manifest.models[${index}].model`);
    if (!PROVIDERS.includes(model.provider)) {
      errors.push(`manifest.models[${index}].provider must be one of ${PROVIDERS.join(', ')}`);
    }
    registerCaseFoldedIdentifier(errors, manifestModelIds, model.id, `manifest.models[${index}].id`);
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
        structuredOutput: selected.structuredOutput || 'auto',
        providerRouting: selected.providerRouting || null,
      };
      if (Number(model.temperature) !== Number(expectedGeneration.temperature)
        || Number(model.maxTokens) !== Number(expectedGeneration.maxTokens)
        || (model.timeoutMs ?? null) !== expectedGeneration.timeoutMs
        || (model.structuredOutput || 'auto') !== expectedGeneration.structuredOutput
        || hashJson(model.providerRouting || null) !== hashJson(expectedGeneration.providerRouting)) {
        errors.push(`manifest.models[${index}] generation settings do not match the selected model roster`);
      }
      if (hashJson(model.provenance || {}) !== hashJson(selected.provenance || {})) {
        errors.push(`manifest.models[${index}].provenance does not match the selected model roster`);
      }
      if (hashJson(model.traits || {}) !== hashJson(selected.traits || {})) {
        errors.push(`manifest.models[${index}].traits does not match the selected model roster`);
      }
      if (hashJson(model.pricing || null) !== hashJson(selected.pricing || null)) {
        errors.push(`manifest.models[${index}].pricing does not match the selected model roster`);
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
  if ((runsFile.mode || 'self') !== (manifest.mode || 'self')) {
    errors.push('runs file mode does not match manifest.mode');
  }
  if ((runsFile.personaId || null) !== (manifest.personaId || null)) {
    errors.push('runs file personaId does not match manifest.personaId');
  }
  if ((manifest.mode || 'self') === 'self') {
    if (manifest.personaId || manifest.personaProfile || manifest.personaProfileHash) {
      errors.push('self-mode manifest must not include persona identity');
    }
  } else if ((manifest.mode || 'self') === 'persona') {
    if (!manifest.personaId || !isRecord(manifest.personaProfile)) {
      errors.push('persona-mode manifest must include personaId and personaProfile');
    } else if (manifest.personaProfile.id !== manifest.personaId) {
      errors.push('manifest.personaProfile.id must match manifest.personaId');
    }
    if (manifest.personaProfileHash !== hashJson(manifest.personaProfile)) {
      errors.push('manifest.personaProfileHash must match manifest.personaProfile');
    }
  } else {
    errors.push('manifest.mode must be self or persona');
  }
  const deploymentIdentitiesByModel = new Map();
  runs.forEach((run, index) => {
    const model = manifestModelsById.get(run?.modelId);
    if (!model) {
      errors.push(`runs[${index}].modelId is absent from manifest.models`);
      return;
    }
    if (run.model !== model.model) errors.push(`runs[${index}].model does not match manifest.models`);
    if (run.provider !== model.provider) errors.push(`runs[${index}].provider does not match manifest.models`);
    if ((run.mode || 'self') !== (manifest.mode || 'self')) {
      errors.push(`runs[${index}].mode does not match manifest.mode`);
    }
    if ((run.personaId || null) !== (manifest.personaId || null)) {
      errors.push(`runs[${index}].personaId does not match manifest.personaId`);
    }
    if (isRecord(run.generation)) {
      const generationMatches = Number(run.generation.temperature) === Number(model.temperature ?? 0.2)
        && Number(run.generation.maxTokens) === Number(model.maxTokens ?? 220)
        && (run.generation.timeoutMs ?? null) === (model.timeoutMs ?? null)
        && (run.generation.structuredOutput || 'auto') === (model.structuredOutput || 'auto')
        && hashJson(run.generation.providerRouting || null) === hashJson(model.providerRouting || null);
      if (!generationMatches) errors.push(`runs[${index}].generation does not match manifest.models`);
    }
    if (isRecord(run.modelProvenance)
      && hashJson(run.modelProvenance) !== hashJson(model.provenance || {})) {
      errors.push(`runs[${index}].modelProvenance does not match manifest.models`);
    }
    const metadata = run.responseMetadata || {};
    const resolvedProvider = String(metadata.resolvedProvider || metadata.provider || run.provider || '').trim();
    const resolvedModel = String(metadata.resolvedModel || run.model || '').trim();
    const systemFingerprint = String(metadata.systemFingerprint || '').trim();
    const endpoint = String(metadata.endpoint || '').trim();
    if (!deploymentIdentitiesByModel.has(run.modelId)) {
      deploymentIdentitiesByModel.set(run.modelId, {
        providers: new Set(), models: new Set(), fingerprints: new Set(), endpoints: new Set(),
      });
    }
    const deploymentIdentity = deploymentIdentitiesByModel.get(run.modelId);
    if (resolvedProvider) deploymentIdentity.providers.add(resolvedProvider);
    if (resolvedModel) deploymentIdentity.models.add(resolvedModel);
    if (systemFingerprint) deploymentIdentity.fingerprints.add(systemFingerprint);
    if (endpoint) deploymentIdentity.endpoints.add(endpoint);
    if (resolvedProvider && resolvedProvider !== run.provider) {
      errors.push(`runs[${index}] resolved provider does not match its declared provider`);
    }
    if (resolvedModel && resolvedModel !== run.model) {
      errors.push(`runs[${index}] resolved model does not match its declared model`);
    }
    if (questionBank) {
      const question = questionsById.get(run.questionId);
      if (!question) {
        errors.push(`runs[${index}].questionId is absent from the selected question bank`);
      } else {
        const parsedRawAnswer = normalizeAnswer(run.rawAnswer);
        const expectedNormalizedAnswer = normalizeForCanonicalPolarity(parsedRawAnswer, run.polarity);
        if (!parsedRawAnswer) {
          errors.push(`runs[${index}].rawAnswer must be Agree, Unsure, or Disagree for release`);
        } else if (run.normalizedAnswer !== expectedNormalizedAnswer) {
          errors.push(`runs[${index}].normalizedAnswer does not match rawAnswer and polarity`);
        }
        const expectedPromptHash = sha256(buildQuestionPrompt({
          question,
          mode: manifest.mode || run.mode || 'self',
          persona: manifest.personaProfile || null,
          polarity: run.polarity,
        }));
        if (run.promptHash !== expectedPromptHash) {
          errors.push(`runs[${index}].promptHash does not match the selected question and prompt template`);
        }
      }
    }
  });
  deploymentIdentitiesByModel.forEach((identity, modelId) => {
    if (identity.providers.size > 1
      || identity.models.size > 1
      || identity.fingerprints.size > 1
      || identity.endpoints.size > 1) {
      errors.push(`model ${modelId} resolved to multiple deployment identities`);
    }
  });
  return errors;
};

export const validateAnalysisOverlay = (overlay, { questionIds = null, topicIds = null } = {}) => {
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
  const issueAreas = overlay.debateAtlas?.issueAreas;
  if (issueAreas !== undefined && !Array.isArray(issueAreas)) errors.push('debateAtlas.issueAreas must be an array');
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
  if (Array.isArray(issueAreas)) {
    const issueAreaIds = new Set();
    issueAreas.forEach((issueArea, index) => {
      const path = `debateAtlas.issueAreas[${index}]`;
      if (!isRecord(issueArea)) {
        errors.push(`${path} must be an object`);
        return;
      }
      requireString(errors, issueArea.id, `${path}.id`);
      if (typeof issueArea.id === 'string' && issueArea.id.trim()) {
        if (issueAreaIds.has(issueArea.id)) errors.push(`debateAtlas.issueAreas contains duplicate id ${issueArea.id}`);
        issueAreaIds.add(issueArea.id);
      }
      for (const field of ['title', 'summary']) {
        if (issueArea[field] !== undefined) requireString(errors, issueArea[field], `${path}.${field}`);
      }
      for (const field of [
        'tags',
        'keyTensions',
        'pointsOfAgreement',
        'pointsOfDisagreement',
        'openQuestions',
        'implications',
        'linkedQuestionIds',
        'analysisSections',
      ]) {
        if (issueArea[field] !== undefined && !Array.isArray(issueArea[field])) {
          errors.push(`${path}.${field} must be an array`);
        }
      }
      for (const field of [
        'tags',
        'keyTensions',
        'pointsOfAgreement',
        'pointsOfDisagreement',
        'openQuestions',
        'implications',
        'linkedQuestionIds',
      ]) {
        if (!Array.isArray(issueArea[field])) continue;
        issueArea[field].forEach((value, valueIndex) => {
          requireString(errors, value, `${path}.${field}[${valueIndex}]`);
        });
      }
      if (issueArea.confidence !== undefined && !['low', 'medium', 'high'].includes(issueArea.confidence)) {
        errors.push(`${path}.confidence must be low, medium, or high`);
      }
      if (Array.isArray(issueArea.analysisSections)) {
        issueArea.analysisSections.forEach((section, sectionIndex) => {
          const sectionPath = `${path}.analysisSections[${sectionIndex}]`;
          if (!isRecord(section)) {
            errors.push(`${sectionPath} must be an object`);
            return;
          }
          requireString(errors, section.title, `${sectionPath}.title`);
          if (section.body !== undefined) requireString(errors, section.body, `${sectionPath}.body`);
          if (section.bullets !== undefined && !Array.isArray(section.bullets)) {
            errors.push(`${sectionPath}.bullets must be an array`);
          }
          if (section.linkedQuestionIds !== undefined && !Array.isArray(section.linkedQuestionIds)) {
            errors.push(`${sectionPath}.linkedQuestionIds must be an array`);
          }
          for (const field of ['bullets', 'linkedQuestionIds']) {
            if (!Array.isArray(section[field])) continue;
            section[field].forEach((value, valueIndex) => {
              requireString(errors, value, `${sectionPath}.${field}[${valueIndex}]`);
            });
          }
        });
      }
    });
  }
  if (topicIds && Array.isArray(issueAreas)) {
    const allowedTopicIds = new Set([
      ...topicIds,
      ...(Array.isArray(topics) ? topics.map((topic) => topic?.id).filter(Boolean) : []),
    ]);
    issueAreas.forEach((issueArea) => {
      if (typeof issueArea?.id === 'string' && issueArea.id.trim() && !allowedTopicIds.has(issueArea.id)) {
        errors.push(`analysis overlay issue area references unknown topic ${issueArea.id}`);
      }
    });
  }
  if (questionIds) {
    const linkedIds = [
      ...(Array.isArray(topics) ? topics.flatMap((topic) => Array.isArray(topic?.questionIds) ? topic.questionIds : []) : []),
      ...(Array.isArray(issueAreas) ? issueAreas.flatMap((issueArea) => [
        ...(Array.isArray(issueArea?.linkedQuestionIds) ? issueArea.linkedQuestionIds : []),
        ...(Array.isArray(issueArea?.analysisSections)
          ? issueArea.analysisSections.flatMap((section) => Array.isArray(section?.linkedQuestionIds) ? section.linkedQuestionIds : [])
          : []),
      ]) : []),
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
