import { safeString, safeJsonParse, nowIsoOrCurrent as nowIso, sanitizeSessionSlug, sha256Hex } from './runtimePrimitives.mjs';
import { assertNoSecretShape } from './redaction.mjs';
import { AGENT_ONLY_WRAPPED_IMAGE_KV_PREFIX, WRAPPED_STORY_FRAME_COUNT, randomHex, wrappedImagePrefix, normalizeAgentOnlyRunId, wrappedImageRunKey, normalizeWrappedImageViewId, wrappedImageViewKey } from './wrappedCore.mjs';
import { eventId } from './wrappedAnswers.mjs';
import { normalizeWrappedImageMode, wrappedImageModeMetadata } from './wrappedEvidence.mjs';

export async function saveAgentOnlyWrappedImage({
  env = {},
  sessionSlug = '',
  telegramUserId = '',
  runId = '',
  mode = 'wrapped',
  model = '',
  size = '',
  quality = '',
  referenceImage = '',
  mediaKind = '',
  frameCount = 0,
  storyDurationSeconds = 0,
  frameKeys = [],
  imageContentType = 'image/png',
  imageBase64 = '',
  prompt = '',
  now = null,
} = {}) {
  const kv = env?.AGENT_ACTION_KV;
  const prefix = wrappedImagePrefix(sessionSlug, telegramUserId, mode);
  if (!prefix || !kv || typeof kv.put !== 'function') {
    return { ok: false, reason: 'wrapped_image_storage_unavailable' };
  }
  const imageText = safeString(imageBase64);
  if (!imageText) return { ok: false, reason: 'wrapped_image_missing' };
  const createdAt = nowIso(now);
  const sessionId = env.AGENT_CONTEXT.sessionId;
  const expiresAt = new Date(Date.parse(createdAt) + 7 * 86400_000).toISOString();
  const imageId = eventId();
  const imageViewId = randomHex(16);
  const promptHash = `sha256:${(await sha256Hex(prompt)).slice(0, 32)}`;
  const normalizedRunId = normalizeAgentOnlyRunId(runId);
  const key = `${prefix}${imageId}`;
  const viewKey = wrappedImageViewKey(imageViewId);
  const runKey = wrappedImageRunKey(sessionSlug, telegramUserId, mode, normalizedRunId);
  const record = {
    type: 'telegram_agent_only_wrapped_image',
    version: 1, sessionId, expiresAt,
    sessionSlug: sanitizeSessionSlug(sessionSlug),
    telegramUserId: safeString(telegramUserId),
    runId: normalizedRunId,
    mode: normalizeWrappedImageMode(mode),
    model: safeString(model),
    size: safeString(size),
    quality: safeString(quality),
    referenceImage: safeString(referenceImage),
    mediaKind: safeString(mediaKind),
    frameCount: Math.max(0, Math.floor(Number(frameCount) || 0)),
    storyDurationSeconds: Math.max(0, Math.floor(Number(storyDurationSeconds) || 0)),
    frameKeys: Array.isArray(frameKeys) ? frameKeys.map((key) => safeString(key)).filter(Boolean).slice(0, WRAPPED_STORY_FRAME_COUNT) : [],
    imageContentType: safeString(imageContentType) || 'image/png',
    imageBase64: imageText,
    imageByteLengthApprox: Math.floor((imageText.length * 3) / 4),
    imageId,
    imageViewId,
    promptHash,
    createdAt,
  };
  assertNoSecretShape({
    ...record,
    imageBase64: '[image omitted]',
  }, 'Agent-only wrapped image metadata must not serialize secrets.');
  const viewRecord = {
    type: 'telegram_agent_only_wrapped_image_view',
    version: 1, sessionId, expiresAt,
    imageViewId,
    imageKey: key,
    sessionSlug: record.sessionSlug,
    runId: record.runId,
    mode: record.mode,
    mediaKind: record.mediaKind,
    frameCount: record.frameCount,
    storyDurationSeconds: record.storyDurationSeconds,
    frameKeys: record.frameKeys,
    imageContentType: record.imageContentType,
    createdAt,
  };
  const runRecord = {
    type: 'telegram_agent_only_wrapped_image_run',
    version: 1, sessionId, expiresAt,
    sessionSlug: record.sessionSlug,
    telegramUserId: record.telegramUserId,
    runId: record.runId,
    mode: record.mode,
    mediaKind: record.mediaKind,
    frameCount: record.frameCount,
    storyDurationSeconds: record.storyDurationSeconds,
    frameKeys: record.frameKeys,
    imageKey: key,
    imageId,
    imageViewId,
    promptHash,
    createdAt,
  };
  assertNoSecretShape(viewRecord, 'Agent-only wrapped image view metadata must not serialize secrets.');
  assertNoSecretShape(runRecord, 'Agent-only wrapped image run metadata must not serialize secrets.');
  await kv.put(key, JSON.stringify(record), {
    expirationTtl: 7 * 86400,
    metadata: {
      v: 1,
      t: 'ao_img',
      m: wrappedImageModeMetadata(mode),
      b: record.imageByteLengthApprox,
    },
  });
  await kv.put(viewKey, JSON.stringify(viewRecord), {
    expirationTtl: 7 * 86400,
    metadata: {
      v: 1,
      t: 'ao_img_view',
      m: wrappedImageModeMetadata(record.mode),
    },
  });
  if (runKey) {
    await kv.put(runKey, JSON.stringify(runRecord), {
      expirationTtl: 7 * 86400,
      metadata: {
        v: 1,
        t: 'ao_img_run',
        m: wrappedImageModeMetadata(record.mode),
      },
    });
  }
  return { ok: true, imageId, imageViewId, key, viewKey, runKey, createdAt, promptHash };
}

export async function loadAgentOnlyWrappedImageByViewId({
  env = {},
  imageViewId = '',
} = {}) {
  const kv = env?.AGENT_ACTION_KV;
  const viewKey = wrappedImageViewKey(imageViewId);
  if (!viewKey || !kv || typeof kv.get !== 'function') {
    return { ok: false, status: 404, reason: 'wrapped_image_not_found' };
  }
  const viewRecord = safeJsonParse(await kv.get(viewKey), null);
  if (!viewRecord || viewRecord.sessionId !== env.AGENT_CONTEXT.sessionId || !(Date.parse(viewRecord.expiresAt) > env.AGENT_CONTEXT.now()) || safeString(viewRecord.type) !== 'telegram_agent_only_wrapped_image_view') {
    return { ok: false, status: 404, reason: 'wrapped_image_not_found' };
  }
  const imageKey = safeString(viewRecord.imageKey);
  if (!imageKey.startsWith(AGENT_ONLY_WRAPPED_IMAGE_KV_PREFIX)) {
    return { ok: false, status: 404, reason: 'wrapped_image_not_found' };
  }
  const imageRecord = safeJsonParse(await kv.get(imageKey), null);
  if (!imageRecord || imageRecord.sessionId !== env.AGENT_CONTEXT.sessionId || !(Date.parse(imageRecord.expiresAt) > env.AGENT_CONTEXT.now()) || safeString(imageRecord.type) !== 'telegram_agent_only_wrapped_image') {
    return { ok: false, status: 404, reason: 'wrapped_image_not_found' };
  }
  const imageBase64 = safeString(imageRecord.imageBase64);
  if (!imageBase64) {
    return { ok: false, status: 404, reason: 'wrapped_image_not_found' };
  }
  return {
    ok: true,
    image_content_type: safeString(imageRecord.imageContentType) || safeString(viewRecord.imageContentType) || 'image/png',
    image_base64: imageBase64,
    image_id: safeString(imageRecord.imageId) || safeString(imageKey).split(':').pop() || '',
    image_view_id: normalizeWrappedImageViewId(imageViewId),
    media_kind: safeString(imageRecord.mediaKind || viewRecord.mediaKind),
    frame_count: Number(imageRecord.frameCount || viewRecord.frameCount || 0) || 0,
    story_duration_seconds: Number(imageRecord.storyDurationSeconds || viewRecord.storyDurationSeconds || 0) || 0,
    frame_keys: Array.isArray(imageRecord.frameKeys) ? imageRecord.frameKeys : [],
  };
}

export async function loadAgentOnlyWrappedImageByRun({
  env = {},
  sessionSlug = '',
  telegramUserId = '',
  runId = '',
  mode = 'wrapped',
} = {}) {
  const kv = env?.AGENT_ACTION_KV;
  const runKey = wrappedImageRunKey(sessionSlug, telegramUserId, mode, runId);
  if (!runKey || !kv || typeof kv.get !== 'function') return null;
  const runRecord = safeJsonParse(await kv.get(runKey), null);
  if (!runRecord || runRecord.sessionId !== env.AGENT_CONTEXT.sessionId || !(Date.parse(runRecord.expiresAt) > env.AGENT_CONTEXT.now()) || safeString(runRecord.type) !== 'telegram_agent_only_wrapped_image_run') return null;
  const imageKey = safeString(runRecord.imageKey);
  if (!imageKey.startsWith(AGENT_ONLY_WRAPPED_IMAGE_KV_PREFIX)) return null;
  const imageRecord = safeJsonParse(await kv.get(imageKey), null);
  if (!imageRecord || imageRecord.sessionId !== env.AGENT_CONTEXT.sessionId || !(Date.parse(imageRecord.expiresAt) > env.AGENT_CONTEXT.now()) || safeString(imageRecord.type) !== 'telegram_agent_only_wrapped_image') return null;
  const imageBase64 = safeString(imageRecord.imageBase64);
  if (!imageBase64) return null;
  return {
    ok: true,
    cached: true,
    image_saved: true,
    image_content_type: safeString(imageRecord.imageContentType) || 'image/png',
    image_base64: imageBase64,
    image_id: safeString(imageRecord.imageId || runRecord.imageId),
    image_view_id: normalizeWrappedImageViewId(imageRecord.imageViewId || runRecord.imageViewId),
    image_prompt_hash: safeString(imageRecord.promptHash || runRecord.promptHash),
    image_safety_retried: imageRecord.imageSafetyRetried === true,
    media_kind: safeString(imageRecord.mediaKind || runRecord.mediaKind),
    frame_count: Number(imageRecord.frameCount || runRecord.frameCount || 0) || 0,
    story_duration_seconds: Number(imageRecord.storyDurationSeconds || runRecord.storyDurationSeconds || 0) || 0,
    frame_keys: Array.isArray(imageRecord.frameKeys) ? imageRecord.frameKeys : [],
    created_at: safeString(imageRecord.createdAt || runRecord.createdAt),
  };
}
