import { safeString, lower, sanitizeSessionSlug } from './runtimePrimitives.mjs';
import { loadSessionPolicy } from './sessionPolicyLoader.mjs';
import { assertNoSecretShape } from './redaction.mjs';
import { AGENT_ONLY_ENDPOINTS, buildAgentOnlyStartPayload, generateAgentOnlyWrappedImage, getAgentOnlyStatementsPage, loadAgentOnlyWrappedImageByViewId, recordAgentOnlyAttemptEventQuietly, submitAgentOnlyAnswersBulk, submitAgentOnlyTokenVotesBulk } from './agentOnlyMode.mjs';
import { CE_AGENT_ACCESS_SKILL_VERSION } from './httpConstants.mjs';
import { sessionAgentOrigin, json, normalizeBoolean, toCanonicalAgentApiPathname } from './httpInput.mjs';
import { jsonSessionMeta, sessionMetaCorsHeaders } from './cors.mjs';

export async function handleAgentOnlyStartRequest({ request, env = {} } = {}) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: sessionMetaCorsHeaders(),
    });
  }
  if (request.method !== 'GET') {
    return jsonSessionMeta(request, env, { ok: false, reason: 'method_not_allowed' }, { status: 405 });
  }
  const policy = await loadSessionPolicy(env);
  const sessionSlug = sanitizeSessionSlug(policy.defaultSessionSlug);
  const payload = buildAgentOnlyStartPayload({
    sessionSlug,
    skillVersion: CE_AGENT_ACCESS_SKILL_VERSION,
    visualDefaults: {
      wrapped: env.AGENT_CONTEXT.config.agentHttp?.wrapped?.posterEnabled === true,
      wrapped_story: false,
      political_compass: false,
    },
  });
  return jsonSessionMeta(request, env, { ...payload, enabled: env.AGENT_CONTEXT.config.sessionModeProfile.surfaces.agentHttp === true });
}

export function agentOnlyRequestNow(env) { return new Date(env.AGENT_CONTEXT.now()).toISOString(); }

export async function handleAgentOnlyStatementsRequest({ env = {}, context = {}, input = {} } = {}) {
  const page = await getAgentOnlyStatementsPage({
    env,
    sessionSlug: context.session.sessionSlug,
    cursor: input.cursor,
    limit: input.limit,
    compact: normalizeBoolean(input.compact, false) || lower(input.format) === 'compact',
    now: agentOnlyRequestNow(env),
  });
  const status = page.ok === false ? page.status || 500 : 200;
  assertNoSecretShape(page, 'Agent-only statements response must not serialize secrets.');
  return json(page, { status });
}

export async function handleAgentOnlyAnswersBulkRequest({ env = {}, context = {}, input = {}, body = {} } = {}) {
  const result = await submitAgentOnlyAnswersBulk({
    env,
    sessionSlug: context.session.sessionSlug,
    telegramUserId: context.storageSubjectId,
    body,
    now: agentOnlyRequestNow(env),
  });
  const status = result.ok === false ? result.status || 400 : 200;
  await recordAgentOnlyAttemptEventQuietly({
    env,
    sessionSlug: context.session.sessionSlug,
    telegramUserId: context.storageSubjectId,
    stage: 'answers_bulk',
    status,
    result,
    body,
    now: agentOnlyRequestNow(env),
  });
  assertNoSecretShape(result, 'Agent-only answers response must not serialize secrets.');
  return json(result, { status });
}

export async function handleAgentOnlyTokenVotesBulkRequest({ env = {}, context = {}, input = {}, body = {} } = {}) {
  const result = await submitAgentOnlyTokenVotesBulk({
    env,
    sessionSlug: context.session.sessionSlug,
    telegramUserId: context.storageSubjectId,
    body,
    now: agentOnlyRequestNow(env),
  });
  const status = result.ok === false ? result.status || 400 : 200;
  await recordAgentOnlyAttemptEventQuietly({
    env,
    sessionSlug: context.session.sessionSlug,
    telegramUserId: context.storageSubjectId,
    stage: 'token_votes_bulk',
    status,
    result,
    body,
    now: agentOnlyRequestNow(env),
  });
  assertNoSecretShape(result, 'Agent-only token-votes response must not serialize secrets.');
  return json(result, { status });
}

export function base64ToBytes(value = '') {
  const binary = atob(String(value || ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function agentOnlyWrappedImageViewUrl(env = {}, imageViewId = '') {
  const id = safeString(imageViewId)
    .replace(/[^a-fA-F0-9]/g, '')
    .slice(0, 32);
  return id
    ? `${sessionAgentOrigin(env)}${toCanonicalAgentApiPathname(AGENT_ONLY_ENDPOINTS.wrappedImage)}/view/${encodeURIComponent(id)}?sessionSlug=${encodeURIComponent(env.AGENT_CONTEXT.slug)}`
    : '';
}

export async function handleAgentOnlyWrappedImageViewRequest({ env = {}, imageViewId = '', method = 'GET' } = {}) {
  const result = await loadAgentOnlyWrappedImageByViewId({ env, imageViewId });
  if (!result.ok) {
    return json(
      {
        ok: false,
        reason: result.reason || 'wrapped_image_not_found',
      },
      { status: result.status || 404 },
    );
  }
  const imageResponse = new Response(base64ToBytes(result.image_base64), {
    status: 200,
    headers: {
      'content-type': result.image_content_type || 'image/png',
      'cache-control': 'private, max-age=3600',
      'content-disposition': `inline; filename="session-wrapped.${lower(result.image_content_type).includes('svg') ? 'svg' : 'png'}"`,
      'x-agent-only-image-id': result.image_id || '',
      'x-agent-only-image-view-id': result.image_view_id || '',
    },
  });
  if (method === 'HEAD') {
    return new Response(null, {
      status: imageResponse.status,
      headers: imageResponse.headers,
    });
  }
  return imageResponse;
}

export async function handleAgentOnlyWrappedImageRequest({
  env = {},
  context = {},
  input = {},
  body = {},
  fetchImpl = globalThis.fetch,
} = {}) {
  const result = await generateAgentOnlyWrappedImage({
    env,
    sessionSlug: context.session.sessionSlug,
    telegramUserId: context.storageSubjectId,
    body: { ...body, format: input.format || body.format },
    now: agentOnlyRequestNow(env),
    fetchImpl,
  });
  const status = result.ok === false ? result.status || 400 : 200;
  await recordAgentOnlyAttemptEventQuietly({
    env,
    sessionSlug: context.session.sessionSlug,
    telegramUserId: context.storageSubjectId,
    stage: 'wrapped_image',
    status,
    result,
    body: { ...body, format: input.format || body.format },
    now: agentOnlyRequestNow(env),
  });
  if (!result.ok) {
    assertNoSecretShape(result, 'Agent-only wrapped image error must not serialize secrets.');
    return json(result, { status });
  }
  const responseFormat = lower(input.format || body.format);
  const wantsPng = responseFormat === 'png';
  if (wantsPng) {
    return new Response(base64ToBytes(result.image_base64), {
      status: 200,
      headers: {
        'content-type': result.image_content_type || 'image/png',
        'cache-control': 'no-store',
      },
    });
  }
  const includeBase64Input = lower(input.include_base64 || input.includeBase64);
  const omitBase64 =
    responseFormat === 'json_url' ||
    body.compact === true ||
    body.include_base64 === false ||
    body.includeBase64 === false ||
    includeBase64Input === 'false';
  const includeBase64 =
    !omitBase64 &&
    (responseFormat === 'json_base64' ||
      responseFormat === 'json_with_base64' ||
      body.include_base64 === true ||
      body.includeBase64 === true ||
      includeBase64Input === 'true');
  const payload = {
    ...result,
    ...(result.image_view_id
      ? {
          image_url: agentOnlyWrappedImageViewUrl(env, result.image_view_id),
        }
      : {}),
  };
  if (!includeBase64) {
    delete payload.image_base64;
  }
  delete payload.prompt;
  assertNoSecretShape(
    { ...payload, image_base64: '[image omitted]' },
    'Agent-only wrapped image response metadata must not serialize secrets.',
  );
  return json(payload, { status, headers: { 'cache-control': 'no-store' } });
}
