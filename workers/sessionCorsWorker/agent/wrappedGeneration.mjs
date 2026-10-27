import { runBoundedPoster } from './posterBudget.mjs';
import { safeString, sanitizeSessionSlug } from './runtimePrimitives.mjs';
import { assertNoSecretShape } from './redaction.mjs';
import { SESSION_LAB_LOGO_REFERENCE_BASE64, SESSION_LAB_LOGO_REFERENCE_FILENAME } from './sessionLabLogoReference.mjs';
import { DEFAULT_WRAPPED_IMAGE_MODEL, DEFAULT_WRAPPED_IMAGE_SIZE, WRAPPED_STORY_FRAME_SECONDS, DEFAULT_OPENAI_IMAGE_EDIT_URL, base64ToUint8Array, normalizeAgentOnlyRunId, runIdFromBody } from './wrappedCore.mjs';
import { loadWrappedStatements } from './wrappedStatements.mjs';
import { loadAnswerState } from './wrappedAnswers.mjs';
import { loadVoteState } from './wrappedVotes.mjs';
import { normalizeWrappedImageQuality, normalizeWrappedImageMode, allowsExperimentalWrappedSvgStoryboard, resolveWrappedPosterOpenAiKey, resolveWrappedPosterRenderer, wrappedPredictionRows, answerStateForRun, agentOnlyResponseCoverage } from './wrappedEvidence.mjs';
import { saveAgentOnlyWrappedImage, loadAgentOnlyWrappedImageByRun } from './wrappedImageStorage.mjs';
import { buildAgentOnlyWrappedStoryboardPrompt, buildAgentOnlyWrappedImagePrompt } from './wrappedPrompts.mjs';
import { buildWrappedStoryboardSvgBase64, requestOpenAiWrappedImage, shouldRetryWrappedImageWithSaferPrompt, buildDeterministicWrappedPosterBase64 } from './wrappedImageRendering.mjs';

export async function saveDeterministicWrappedPoster({
  env = {},
  sessionSlug = '',
  space = {},
  state = {},
  coverage = {},
  telegramUserId = '',
  runId = '',
  imageMode = 'wrapped',
  now = null,
} = {}) {
  const imageBase64 = buildDeterministicWrappedPosterBase64({
    sessionSlug,
    space,
    state,
    runId,
    mode: imageMode,
  });
  const model = 'local-deterministic-v1';
  const size = '1600x900';
  const quality = 'deterministic';
  const prompt = `local-session-wrapped-v1:${sanitizeSessionSlug(sessionSlug)}:${runId}:${imageMode}`;
  const savedImage = await saveAgentOnlyWrappedImage({
    env,
    sessionSlug,
    telegramUserId,
    runId,
    mode: imageMode,
    model,
    size,
    quality,
    mediaKind: 'deterministic_svg_poster',
    imageContentType: 'image/svg+xml',
    imageBase64,
    prompt,
    now,
  });
  const payload = {
    ok: true,
    run_id: runId,
    mode: imageMode,
    statement_count: coverage.statementCount,
    agent_prediction_count: coverage.agentPredictionCount,
    agent_response_count: coverage.agentResponseCount,
    privacy_skip_count: coverage.privacySkipCount,
    all_statements_predicted: coverage.allStatementsPredicted,
    all_statements_covered: coverage.allStatementsCovered,
    model,
    size,
    quality,
    reference_image: '',
    media_kind: 'deterministic_svg_poster',
    image_content_type: 'image/svg+xml',
    image_base64: imageBase64,
    image_safety_retried: false,
    image_saved: savedImage.ok === true,
    ...(savedImage.ok ? {
      image_id: savedImage.imageId,
      image_view_id: savedImage.imageViewId,
      image_prompt_hash: savedImage.promptHash,
    } : {
      image_save_reason: savedImage.reason || 'wrapped_image_save_failed',
    }),
  };
  assertNoSecretShape({ ...payload, image_base64: '[image omitted]' }, 'Local Wrapped poster response metadata must not serialize secrets.');
  return payload;
}

export async function generateAgentOnlyWrappedImage(args = {}) {
  const { env, body = {} } = args;
  await env.AGENT_SERVICES.current();
  return runBoundedPoster(env.AGENT_CONTEXT, [runIdFromBody(body), normalizeWrappedImageMode(body.mode || body.image_mode || body.imageMode || body.view)],
    () => generateWrappedImage({ ...args, fetchImpl: env.AGENT_SERVICES.posterFetch }));
}

export async function generateWrappedImage({
  env = {},
  sessionSlug = '',
  telegramUserId = '',
  body = {},
  now = null,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (env.AGENT_CONTEXT.config.agentHttp?.wrapped?.posterEnabled !== true) return { ok: false, status: 403, reason: 'agent_poster_disabled' };
  await env.AGENT_SERVICES.current();
  const slug = sanitizeSessionSlug(sessionSlug || body.sessionSlug);
  const runId = runIdFromBody(body);
  if (!runId) return { ok: false, status: 400, reason: 'agent_only_run_id_required' };
  const materialized = await loadWrappedStatements({ env, sessionSlug: slug });
  if (!materialized.ok) return materialized;
  const currentSpace = materialized.space;
  const state = await loadAnswerState({ env, sessionSlug: slug, telegramUserId });
  const readableIds = new Set(currentSpace.statements.map(statement => statement.statement_id));
  const stateForRun = answerStateForRun({ ...state, byStatement: Object.fromEntries(
    Object.entries(state.byStatement).filter(([id]) => readableIds.has(id))) }, runId);
  const space = { ...currentSpace, statements: currentSpace.statements.map(statement => {
    const entry = stateForRun.byStatement[statement.statement_id];
    return entry?.agent?.statement || entry?.agentSkip?.statement || statement;
  }) };
  const coverage = agentOnlyResponseCoverage(space, stateForRun, { runId });
  const predictions = wrappedPredictionRows(space, stateForRun, { runId });
  if (!coverage.allStatementsCovered) {
    return {
      ok: false,
      status: 409,
      reason: 'agent_only_wrapped_incomplete_predictions',
      run_id: runId,
      statement_count: coverage.statementCount,
      agent_prediction_count: coverage.agentPredictionCount,
      agent_response_count: coverage.agentResponseCount,
      privacy_skip_count: coverage.privacySkipCount,
      all_statements_predicted: coverage.allStatementsPredicted,
      all_statements_covered: coverage.allStatementsCovered,
    };
  }
  if (!predictions.length) {
    return { ok: false, status: 409, reason: 'agent_only_wrapped_no_predictions', run_id: runId };
  }
  const imageMode = normalizeWrappedImageMode(body.mode || body.image_mode || body.imageMode || body.view);
  const cachedImage = await loadAgentOnlyWrappedImageByRun({
    env,
    sessionSlug: slug,
    telegramUserId,
    runId,
    mode: imageMode,
  });
  if (cachedImage?.ok) {
    return {
      ok: true,
      run_id: runId,
      mode: imageMode,
      statement_count: coverage.statementCount,
      agent_prediction_count: coverage.agentPredictionCount,
      agent_response_count: coverage.agentResponseCount,
      privacy_skip_count: coverage.privacySkipCount,
      all_statements_predicted: coverage.allStatementsPredicted,
      all_statements_covered: coverage.allStatementsCovered,
      ...cachedImage,
    };
  }
  const openAiKey = resolveWrappedPosterOpenAiKey(env);
  const posterRenderer = resolveWrappedPosterRenderer(env);
  if (imageMode !== 'wrapped_story' && posterRenderer !== 'openai') {
    return saveDeterministicWrappedPoster({
      env,
      sessionSlug: slug,
      space,
      state: stateForRun,
      coverage,
      telegramUserId,
      runId,
      imageMode,
      now,
    });
  }
  if (!openAiKey) {
    return { ok: false, status: 503, reason: 'wrapped_story_openai_key_missing' };
  }
  const loadedLinearVoteState = await loadVoteState({ env, sessionSlug: slug, telegramUserId, mode: 'linear' });
  const loadedQuadraticVoteState = await loadVoteState({ env, sessionSlug: slug, telegramUserId, mode: 'quadratic' });
  const linearVoteState = normalizeAgentOnlyRunId(loadedLinearVoteState.runId) === runId ? loadedLinearVoteState : null;
  const quadraticVoteState = normalizeAgentOnlyRunId(loadedQuadraticVoteState.runId) === runId ? loadedQuadraticVoteState : null;
  const model = DEFAULT_WRAPPED_IMAGE_MODEL;
  const quality = normalizeWrappedImageQuality('low');
  const targetUrl = DEFAULT_OPENAI_IMAGE_EDIT_URL;
  const referenceBytes = base64ToUint8Array(SESSION_LAB_LOGO_REFERENCE_BASE64);
  if (imageMode === 'wrapped_story') {
    if (!allowsExperimentalWrappedSvgStoryboard(body)) {
      return {
        ok: false,
        status: 501,
        reason: 'wrapped_story_mp4_unavailable',
        message: 'Session Wrapped story video is not enabled yet. Generate mode "wrapped" for the poster or mode "political_compass" for the Agent Norms Compass.',
      };
    }
    const storyboardSize = DEFAULT_WRAPPED_IMAGE_SIZE;
    const storyboardPrompt = buildAgentOnlyWrappedStoryboardPrompt({
      space,
      state: stateForRun,
      linearVoteState,
      quadraticVoteState,
      styleHint: body.style_hint || body.styleHint || '',
    });
    const storyboardResult = await requestOpenAiWrappedImage({
      fetchImpl,
      targetUrl,
      openAiKey,
      model,
      prompt: storyboardPrompt,
      size: storyboardSize,
      quality,
      referenceBytes,
    });
    if (!storyboardResult.ok) return storyboardResult;
    const frameKeys = ['summary', 'token_use', 'predictions', 'agent_guesses', 'comparison'];
    const storyImageBase64 = buildWrappedStoryboardSvgBase64(storyboardResult.imageBase64, frameKeys);
    if (!storyImageBase64) {
      return { ok: false, status: 502, reason: 'wrapped_story_svg_missing' };
    }
    const storyDurationSeconds = frameKeys.length * WRAPPED_STORY_FRAME_SECONDS;
    const savedImage = await saveAgentOnlyWrappedImage({
      env,
      sessionSlug: slug,
      telegramUserId,
      runId,
      mode: imageMode,
      model,
      size: storyboardSize,
      quality,
      referenceImage: SESSION_LAB_LOGO_REFERENCE_FILENAME,
      mediaKind: 'animated_svg_storyboard',
      frameCount: frameKeys.length,
      storyDurationSeconds,
      frameKeys,
      imageContentType: 'image/svg+xml',
      imageBase64: storyImageBase64,
      prompt: storyboardPrompt,
      now,
    });
    const payload = {
      ok: true,
      run_id: runId,
      mode: imageMode,
      statement_count: coverage.statementCount,
      agent_prediction_count: coverage.agentPredictionCount,
      agent_response_count: coverage.agentResponseCount,
      privacy_skip_count: coverage.privacySkipCount,
      all_statements_predicted: coverage.allStatementsPredicted,
      all_statements_covered: coverage.allStatementsCovered,
      model,
      size: storyboardSize,
      quality,
      reference_image: SESSION_LAB_LOGO_REFERENCE_FILENAME,
      media_kind: 'animated_svg_storyboard',
      image_content_type: 'image/svg+xml',
      image_base64: storyImageBase64,
      frame_count: frameKeys.length,
      story_duration_seconds: storyDurationSeconds,
      story_frame_seconds: WRAPPED_STORY_FRAME_SECONDS,
      frame_keys: frameKeys,
      story_source: 'single_storyboard',
      image_safety_retried: false,
      image_saved: savedImage.ok === true,
      ...(savedImage.ok ? {
        image_id: savedImage.imageId,
        image_view_id: savedImage.imageViewId,
        image_prompt_hash: savedImage.promptHash,
      } : {
        image_save_reason: savedImage.reason || 'wrapped_image_save_failed',
      }),
    };
    assertNoSecretShape({ ...payload, image_base64: '[image omitted]' }, 'Agent-only wrapped story response metadata must not serialize secrets.');
    return payload;
  }
  let prompt = buildAgentOnlyWrappedImagePrompt({
    space,
    state: stateForRun,
    linearVoteState,
    quadraticVoteState,
    styleHint: body.style_hint || body.styleHint || '',
    mode: imageMode,
  });
  const size = DEFAULT_WRAPPED_IMAGE_SIZE;
  let imageResult = await requestOpenAiWrappedImage({
    fetchImpl,
    targetUrl,
    openAiKey,
    model,
    prompt,
    size,
    quality,
    referenceBytes,
  });
  let imageSafetyRetried = false;
  if (
    !imageResult.ok &&
    imageMode === 'political_compass' &&
    shouldRetryWrappedImageWithSaferPrompt(imageResult)
  ) {
    prompt = buildAgentOnlyWrappedImagePrompt({
      space,
      state: stateForRun,
      linearVoteState,
      quadraticVoteState,
      styleHint: '',
      mode: imageMode,
      safetyRetry: true,
    });
    imageSafetyRetried = true;
    imageResult = await requestOpenAiWrappedImage({
      fetchImpl,
      targetUrl,
      openAiKey,
      model,
      prompt,
      size,
      quality,
      referenceBytes,
    });
  }
  if (!imageResult.ok) {
    return imageResult;
  }
  const imageBase64 = imageResult.imageBase64;
  const savedImage = await saveAgentOnlyWrappedImage({
    env,
    sessionSlug: slug,
    telegramUserId,
    runId,
    mode: imageMode,
    model,
    size,
    quality,
    referenceImage: SESSION_LAB_LOGO_REFERENCE_FILENAME,
    mediaKind: 'image',
    imageContentType: 'image/png',
    imageBase64,
    prompt,
    now,
  });
  const payload = {
    ok: true,
    run_id: runId,
    mode: imageMode,
    statement_count: coverage.statementCount,
    agent_prediction_count: coverage.agentPredictionCount,
    agent_response_count: coverage.agentResponseCount,
    privacy_skip_count: coverage.privacySkipCount,
    all_statements_predicted: coverage.allStatementsPredicted,
    all_statements_covered: coverage.allStatementsCovered,
    model,
    size,
    quality,
    reference_image: SESSION_LAB_LOGO_REFERENCE_FILENAME,
    media_kind: 'image',
    image_content_type: 'image/png',
    image_base64: imageBase64,
    image_safety_retried: imageSafetyRetried,
    image_saved: savedImage.ok === true,
    ...(savedImage.ok ? {
      image_id: savedImage.imageId,
      image_view_id: savedImage.imageViewId,
      image_prompt_hash: savedImage.promptHash,
    } : {
      image_save_reason: savedImage.reason || 'wrapped_image_save_failed',
    }),
  };
  assertNoSecretShape({ ...payload, image_base64: '[image omitted]' }, 'Agent-only wrapped image response metadata must not serialize secrets.');
  return payload;
}
