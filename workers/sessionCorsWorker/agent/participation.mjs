import { normalizeAgentRatingAnswer } from './ratingScale.mjs';
import { buildAgentQuestionAnswerSchema } from './agentAnswerSchema.mjs';
import { formatQuadraticAllocation, validateQuadraticAllocation } from '../../../shared/questions/quadraticAllocation.mjs';
import { safeString, lower } from './runtimePrimitives.mjs';
import { LEGACY_TRANSPORT_LANES } from './constants.mjs';
import { loadQuestionsForSession, persistAnswerDraft, persistAgentSubmitRequest, readAnswerDraft } from './agentSessionRuntime.mjs';
import { assertNoSecretShape } from './redaction.mjs';
import { loadAgentSettings } from './agentSettings.mjs';
import { answerFromAgentInitial, answerFromStoredDraft, persistDraftEditMetric } from './agentDraftEditMetrics.mjs';
import { firstValue, json, normalizeBoolean, titleAnswer } from './httpInput.mjs';
import { questionIsLocked, questionIsUnavailable } from './questions.mjs';
import { normalizeAgentMetadata } from './questionVotes.mjs';

export function normalizePreferenceEntries(input = {}) {
  const preferences =
    input.preferences && typeof input.preferences === 'object' && !Array.isArray(input.preferences)
      ? input.preferences
      : input;
  const preferenceArray = Array.isArray(input.preferences) ? input.preferences : [];
  if (preferenceArray.length) {
    return preferenceArray.map((entry) => {
      const source = entry && typeof entry === 'object' && !Array.isArray(entry) ? entry : { answer: entry };
      const nestedAnswer =
        source.answer && typeof source.answer === 'object' && !Array.isArray(source.answer) ? source.answer : null;
      return {
        questionId: safeString(source.questionId || source.id),
        answer: nestedAnswer ? { ...source, ...nestedAnswer } : source,
      };
    });
  }
  const byId = preferences.answersByQuestionId || preferences.draftsByQuestionId || input.answersByQuestionId;
  if (byId && typeof byId === 'object' && !Array.isArray(byId)) {
    const initialById =
      preferences.initialAnswersByQuestionId ||
      preferences.initialDraftsByQuestionId ||
      input.initialAnswersByQuestionId ||
      input.initialDraftsByQuestionId ||
      {};
    return Object.entries(byId).map(([questionId, answer]) => {
      const initialAnswer =
        initialById && typeof initialById === 'object' && !Array.isArray(initialById) ? initialById[questionId] : null;
      if (!initialAnswer) return { questionId, answer };
      const source = answer && typeof answer === 'object' && !Array.isArray(answer) ? answer : { value: answer };
      return { questionId, answer: { ...source, initialAnswer } };
    });
  }
  const drafts = preferences.answers || preferences.drafts || input.answers || input.drafts;
  if (Array.isArray(drafts)) {
    return drafts.map((entry) => {
      const source = entry && typeof entry === 'object' && !Array.isArray(entry) ? entry : { answer: entry };
      const nestedAnswer =
        source.answer && typeof source.answer === 'object' && !Array.isArray(source.answer) ? source.answer : null;
      return {
        questionId: safeString(source.questionId || source.id),
        answer: nestedAnswer ? { ...source, ...nestedAnswer } : source,
      };
    });
  }
  return [];
}

export function normalizeDraftForQuestion(answer = {}, question = {}) {
  const source = answer && typeof answer === 'object' && !Array.isArray(answer) ? answer : { value: answer };
  const questionType = safeString(question.questionType || source.questionType || 'freeform');
  const comments = safeString(source.comments || source.additionalComments || source.reason || source.rationale);
  if (questionType === 'quadratic') {
    const value = source.value ?? source.answer;
    if (validateQuadraticAllocation(value, question)) return null;
    return { label: formatQuadraticAllocation(value, question.options), value: { questionType, value, comments }, controlType: 'quadratic_allocation' };
  }
  if (questionType === 'binary') {
    const raw = lower(firstValue(source.value, source.answer, source.choice, source.stance, source.label));
    const value =
      raw === 'yes' || raw === 'true'
        ? 'agree'
        : raw === 'no' || raw === 'false'
          ? 'disagree'
          : raw === 'maybe' || raw === 'unknown'
            ? 'unsure'
            : raw;
    if (!['agree', 'disagree', 'unsure'].includes(value)) return null;
    return {
      label: titleAnswer(value),
      value: { questionType: 'binary', value, comments },
      controlType: 'agree_unsure_disagree',
    };
  }
  if (questionType === 'rating') {
    const value = normalizeAgentRatingAnswer(firstValue(source.value, source.rating, source.answer, source.label), question);
    if (value === null) return null;
    return {
      label: String(value),
      value: { questionType: 'rating', value, comments },
      controlType: 'rating_button',
    };
  }
  if (questionType === 'multichoice') {
    const values = Array.isArray(source.values)
      ? source.values.map(safeString).filter(Boolean)
      : [firstValue(source.value, source.answer, source.choice, source.label)].map(safeString).filter(Boolean);
    const schema = buildAgentQuestionAnswerSchema(question).answerSchema;
    if (!values.length || new Set(values).size !== values.length || values.length > schema.maxSelections ||
        values.some(value => !schema.options.includes(value))) return null;
    return {
      label: values.join(', '),
      value: { questionType: 'multichoice', values, comments },
      controlType: 'multi_select_toggle',
    };
  }
  const text = safeString(firstValue(source.text, source.value, source.answer, source.label));
  if (!text) return null;
  return {
    label: text.slice(0, 80),
    value: { questionType: 'freeform', text, comments },
    controlType: 'freeform_text',
  };
}

export function directSubmitRequested(input = {}) {
  const preferences =
    input.preferences && typeof input.preferences === 'object' && !Array.isArray(input.preferences)
      ? input.preferences
      : {};
  const submit = normalizeBoolean(
    firstValue(input.submit, input.submitAnswers, preferences.submit, preferences.submitAnswers),
    false,
  );
  const approved = normalizeBoolean(
    firstValue(
      input.humanApproved,
      input.approved,
      input.userApproved,
      preferences.humanApproved,
      preferences.approved,
      preferences.userApproved,
    ),
    false,
  );
  return submit === true && approved === true;
}

export async function handlePreferencesRequest({ env = {}, context = {}, input = {}, waitUntil = null } = {}) {
  const loaded = await loadQuestionsForSession(env, context.session.sessionSlug, { waitUntil });
  const questions = (Array.isArray(loaded.questions) ? loaded.questions : []).filter(
    (question) => !questionIsLocked(question) && !questionIsUnavailable(question),
  );
  const byId = new Map(questions.map((question) => [safeString(question.questionId || question.id), question]));
  const entries = normalizePreferenceEntries(input);
  const agentMetadata = normalizeAgentMetadata(input);
  const hasAgentMetadata =
    agentMetadata &&
    typeof agentMetadata === 'object' &&
    Object.values(agentMetadata).some((value) => value !== null && value !== undefined && value !== '');
  const clientSource = safeString(firstValue(input.source, input.client, input.integration)).slice(0, 120);
  const rootSubmitRequested = directSubmitRequested(input);
  const drafts = [];
  const submitted = [];
  const skipped = [];
  const draftEditMetrics = [];
  let submitRequestedCount = 0;
  const settings = await loadAgentSettings({
    env,
    sessionSlug: context.session.sessionSlug,
    telegramUserId: context.storageContext?.user?.telegramUserId,
  });
  const draftEditOptIn = settings.draftDivergenceOptIn === true;
  let reviewRequired = false;
  if (rootSubmitRequested && entries.length === 0) {
    submitRequestedCount = 1;
    skipped.push({ questionId: '', reason: 'preference_entries_missing' });
  }
  for (const entry of entries) {
    const questionId = safeString(entry.questionId);
    const shouldSubmit = rootSubmitRequested || directSubmitRequested(entry.answer);
    if (shouldSubmit) submitRequestedCount += 1;
    const question = byId.get(questionId);
    if (!question) {
      skipped.push({ questionId, reason: 'question_not_active_or_answerable' });
      continue;
    }
    const draft = normalizeDraftForQuestion(entry.answer, question);
    if (!draft) {
      skipped.push({ questionId, reason: 'answer_not_understood' });
      continue;
    }
    if (!shouldSubmit) reviewRequired = true;
    const previousDraft = draftEditOptIn
      ? await readAnswerDraft({
          env,
          normalized: context.storageContext,
          sessionSlug: context.session.sessionSlug,
          selectedQuestionId: questionId,
        })
      : null;
    const saved = await persistAnswerDraft({
      env,
      normalized: context.storageContext,
      sessionSlug: context.session.sessionSlug,
      selectedQuestionId: questionId,
      answerLabel: draft.label,
      answerValue: JSON.stringify(draft.value),
      controlType: draft.controlType,
      submitLane: LEGACY_TRANSPORT_LANES.MINI_APP,
      metadata: {
        source: 'agent_handoff',
        authMode: safeString(context.authMode),
        endpoint: '/api/agent/preferences',
        reviewRequired: !shouldSubmit,
        submitRequested: shouldSubmit,
        ...(clientSource ? { clientSource } : {}),
      },
      agentMetadata: hasAgentMetadata ? agentMetadata : null,
      // Server-stamped: origin.savedAt anchors the draftToSubmitMs research
      // metric, so an agent-supplied createdAt must not be able to skew it.
      createdAt: null,
    });
    if (!saved.ok) {
      skipped.push({ questionId, reason: saved.reason || 'draft_save_failed' });
      continue;
    }
    const draftRecord = { ...saved.draft, key: saved.key };
    drafts.push({
      questionId,
      answerLabel: draft.label,
      controlType: draft.controlType,
    });
    if (draftEditOptIn) {
      const initialAnswer = answerFromAgentInitial(entry.answer) || answerFromStoredDraft(previousDraft);
      if (initialAnswer) {
        const metric = await persistDraftEditMetric({
          env,
          telegramUserId: context.storageContext?.user?.telegramUserId,
          sessionSlug: context.session.sessionSlug,
          questionId,
          questionType: question.questionType,
          draftAnswer: initialAnswer,
          sentAnswer: draft.value,
          source: 'agent_preferences',
          finality: shouldSubmit ? 'submitted' : 'draft_saved',
          // Draft and submission times are server-owned provenance.
          createdAt: null,
        });
        draftEditMetrics.push({
          questionId,
          stored: metric.stored === true,
          reason: metric.reason || '',
          changed: metric.metrics?.changed === true,
          answerChanged: metric.metrics?.answerChanged === true,
          commentChanged: metric.metrics?.commentChanged === true,
        });
      } else {
        draftEditMetrics.push({
          questionId,
          stored: false,
          reason: 'initial_draft_missing',
        });
      }
    }
    if (shouldSubmit) {
      const submit = await persistAgentSubmitRequest({
        env,
        normalized: context.storageContext,
        draft: draftRecord,
        sessionSlug: context.session.sessionSlug,
        selectedQuestionId: questionId,
        createdAt: null,
      });
      if (!submit.ok) {
        skipped.push({
          questionId,
          reason: submit.reason || 'submit_request_failed',
          // Submitting the same answer again resumes a retryable request.
          ...(submit.retryable === true ? { retryable: true } : {}),
        });
        continue;
      }
      submitted.push({
        questionId,
        requestId: submit.requestId,
        status: submit.status,
        queued: submit.queued === true,
        replayed: submit.replayed === true,
      });
    }
  }
  const finalReviewRequired = drafts.length > 0 ? reviewRequired : true;
  const directSubmitIncomplete = submitRequestedCount > 0 && submitted.length < submitRequestedCount;
  const payload = {
    ok: !directSubmitIncomplete,
    ...(directSubmitIncomplete ? { reason: 'direct_submit_incomplete' } : {}),
    sessionSlug: context.session.sessionSlug,
    draftCount: drafts.length,
    submitRequestedCount,
    submittedCount: submitted.length,
    skipped,
    drafts,
    ...(submitted.length ? { submitted } : {}),
    ...(draftEditMetrics.length ? { draftEditMetrics } : {}),
    reviewRequired: finalReviewRequired,
    review: !finalReviewRequired
      ? {
          route: '/api/agent/preferences',
          note: 'Authorized submissions were accepted. Check each request status before reporting completion.',
        }
      : submitted.length
        ? {
            route: '/api/agent/preferences',
            note: 'Authorized submissions were accepted; remaining drafts need explicit user authorization before submission.',
          }
        : {
            route: '/api/agent/preferences',
            note: 'Drafted preferences are saved for user review. Add submit=true and humanApproved=true only when the user explicitly authorizes direct submission.',
          },
  };
  assertNoSecretShape(payload, "Agent preference response must not serialize secrets.");
  return json(payload, { status: directSubmitIncomplete ? 422 : 200 });
}
