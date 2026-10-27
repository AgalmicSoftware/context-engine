import { boundedAgentFetch } from './transport.mjs';
import { safeString, lower, safeJsonParse, sanitizeSessionSlug } from './runtimePrimitives.mjs';
import { assertNoSecretShape } from './redaction.mjs';
import { SESSION_LAB_LOGO_REFERENCE_CONTENT_TYPE, SESSION_LAB_LOGO_REFERENCE_FILENAME } from './sessionLabLogoReference.mjs';
import { WRAPPED_STORY_FRAME_COUNT, WRAPPED_STORY_FRAME_SECONDS, base64EncodeText } from './wrappedCore.mjs';
import { wrappedDisplayText, normalizeWrappedImageMode, wrappedPredictionRows } from './wrappedEvidence.mjs';

export function buildWrappedStoryboardSvgBase64(storyboardImageBase64 = '', frameKeys = []) {
  const imageBase64 = safeString(storyboardImageBase64);
  if (!imageBase64) return '';
  const keys = (Array.isArray(frameKeys) && frameKeys.length ? frameKeys : ['summary', 'token_use', 'predictions', 'agent_guesses', 'comparison'])
    .map((key, index) => safeString(key) || `frame_${index + 1}`)
    .slice(0, WRAPPED_STORY_FRAME_COUNT);
  if (!keys.length) return '';
  const frameCount = keys.length;
  const durationSeconds = frameCount * WRAPPED_STORY_FRAME_SECONDS;
  const keyTimes = [...Array.from({ length: frameCount }, (_, index) => (index / frameCount).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')), '1'].join(';');
  const clipId = 'story-frame-clip';
  const images = keys.map((key, frameIndex) => {
    const values = [
      ...Array.from({ length: frameCount }, (_, index) => (index === frameIndex ? '1' : '0')),
      frameIndex === 0 ? '1' : '0',
    ].join(';');
    const id = key.replace(/[^a-z0-9_-]/gi, '') || `frame_${frameIndex + 1}`;
    return `<g id="${id}" clip-path="url(#${clipId})" opacity="${frameIndex === 0 ? '1' : '0'}"><image href="data:image/png;base64,${imageBase64}" x="${-1080 * frameIndex}" y="0" width="${1080 * frameCount}" height="1920" preserveAspectRatio="none"/><animate attributeName="opacity" dur="${durationSeconds}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${keyTimes}" values="${values}"/></g>`;
  }).join('');
  const progress = keys.map((key, index) => {
    const x = 54 + index * (972 / frameCount);
    const width = (972 / frameCount) - 12;
    const values = [
      ...Array.from({ length: frameCount }, (_, frameIndex) => (frameIndex === index ? '1' : '0.28')),
      index === 0 ? '1' : '0.28',
    ].join(';');
    return `<rect x="${x.toFixed(1)}" y="36" width="${width.toFixed(1)}" height="8" rx="4" fill="#ffffff" opacity="${index === 0 ? '1' : '0.28'}"><animate attributeName="opacity" dur="${durationSeconds}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${keyTimes}" values="${values}"/></rect>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920" role="img" aria-label="Session Wrapped phone story"><title>Session Wrapped phone story</title><defs><clipPath id="${clipId}"><rect width="1080" height="1920"/></clipPath></defs><rect width="1080" height="1920" fill="#0b140d"/>${images}${progress}</svg>`;
  return base64EncodeText(svg);
}

export function buildOpenAiWrappedImageFormData({
  model = '',
  prompt = '',
  size = '',
  quality = '',
  referenceBytes = new Uint8Array(),
} = {}) {
  const referenceBlob = new Blob([referenceBytes], { type: SESSION_LAB_LOGO_REFERENCE_CONTENT_TYPE });
  const requestBody = new FormData();
  requestBody.append('model', model);
  requestBody.append('prompt', prompt);
  requestBody.append('size', size);
  requestBody.append('quality', quality);
  requestBody.append('output_format', 'png');
  requestBody.append('background', 'opaque');
  requestBody.append('n', '1');
  requestBody.append('image', referenceBlob, SESSION_LAB_LOGO_REFERENCE_FILENAME);
  assertNoSecretShape({
    model,
    prompt,
    size,
    quality,
    output_format: 'png',
    background: 'opaque',
    n: 1,
    referenceImageFilename: SESSION_LAB_LOGO_REFERENCE_FILENAME,
    referenceImageBytes: referenceBytes.byteLength,
  }, 'OpenAI wrapped image request must not serialize secrets.');
  return requestBody;
}

export async function requestOpenAiWrappedImage({
  fetchImpl = fetch,
  targetUrl = '',
  openAiKey = '',
  model = '',
  prompt = '',
  size = '',
  quality = '',
  referenceBytes = new Uint8Array(),
} = {}) {
  const requestBody = buildOpenAiWrappedImageFormData({
    model,
    prompt,
    size,
    quality,
    referenceBytes,
  });
  const response = await boundedAgentFetch(fetchImpl, { timeoutMs: 60_000, maxBytes: 8 * 1024 * 1024 })(targetUrl, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${openAiKey}`,
    },
    body: requestBody,
  });
  const responseText = await response.text().catch(() => '');
  const parsed = safeJsonParse(responseText, null);
  if (!response.ok) {
    return {
      ok: false,
      status: 502,
      reason: 'openai_image_generation_failed',
      upstreamStatus: response.status,
      upstreamReason: parsed?.error?.code === 'moderation_blocked' ? 'moderation_blocked' : 'provider_request_failed',
    };
  }
  const imageBase64 = safeString(parsed?.data?.[0]?.b64_json);
  if (!imageBase64) {
    return { ok: false, status: 502, reason: 'openai_image_generation_missing_image' };
  }
  return { ok: true, imageBase64 };
}

export function shouldRetryWrappedImageWithSaferPrompt(result = {}) {
  const rawText = lower(`${result.reason || ''} ${result.upstreamReason || ''} ${result.upstreamStatus || ''}`);
  const text = rawText.replace(/[^a-z0-9]+/g, ' ');
  return /\bsafety\b|\bpolicy\b|\breject|\bmoderation\b|\bcontent\b|\bfiltered\b/.test(text);
}

export function escapeWrappedPosterXml(value = '') {
  return wrappedDisplayText(value, 180)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildDeterministicWrappedPosterBase64({
  sessionSlug = '',
  space = {},
  state = {},
  runId = '',
  mode = 'wrapped',
} = {}) {
  const rows = wrappedPredictionRows(space, state, { runId }).slice(0, 5);
  const rowSvg = rows.map((row, index) => {
    const y = 260 + index * 112;
    const question = escapeWrappedPosterXml(row.question);
    const answer = escapeWrappedPosterXml(row.answer);
    return `<g transform="translate(112 ${y})"><rect width="1376" height="88" rx="18" fill="#ffffff" fill-opacity="0.08"/><text x="24" y="32" fill="#bfead0" font-family="system-ui,sans-serif" font-size="20">${question}</text><text x="24" y="64" fill="#ffffff" font-family="system-ui,sans-serif" font-size="25" font-weight="700">${answer}</text><text x="1328" y="64" text-anchor="end" fill="#7ee2a8" font-family="system-ui,sans-serif" font-size="20">${Math.max(0, Math.min(100, Number(row.confidence) || 0))}%</text></g>`;
  }).join('');
  const title = normalizeWrappedImageMode(mode) === 'political_compass'
    ? 'Agent Norms Compass'
    : 'What your agent thinks it knows about you';
  const subtitle = `${sanitizeSessionSlug(sessionSlug)} · ${rows.length} predictions · privacy-first local render`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900" role="img" aria-label="Session Wrapped poster"><title>Session Wrapped poster</title><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#091d17"/><stop offset="1" stop-color="#17392d"/></linearGradient></defs><rect width="1600" height="900" fill="url(#bg)"/><circle cx="1450" cy="80" r="260" fill="#65d39a" fill-opacity="0.12"/><text x="112" y="98" fill="#7ee2a8" font-family="system-ui,sans-serif" font-size="28" font-weight="800" letter-spacing="3">SESSION LAB</text><text x="112" y="164" fill="#ffffff" font-family="system-ui,sans-serif" font-size="46" font-weight="750">${escapeWrappedPosterXml(title)}</text><text x="112" y="208" fill="#b8cfc4" font-family="system-ui,sans-serif" font-size="22">${escapeWrappedPosterXml(subtitle)}</text>${rowSvg}<text x="112" y="842" fill="#91aa9f" font-family="system-ui,sans-serif" font-size="18">Deterministic local renderer · no external image provider</text></svg>`;
  return base64EncodeText(svg);
}
