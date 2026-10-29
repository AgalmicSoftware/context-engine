import { AI_MODEL_NOT_ALLOWED, isSessionTranscriptionModelAllowed } from './aiRequestPolicy.js';
import { readTranscribeRequestPayload } from './transcribeRequestNormalization.js';
import { resolveOpenAiTranscribeUrl } from './endpointConfig.js';
import { STRICT_HTTPS_NO_CREDENTIALS_POLICY } from './outboundUrlSafetyBinding.js';

const normalizeSpeakerSegments = (segments) => (Array.isArray(segments) ? segments : []).flatMap((segment) => {
  const speaker = typeof segment?.speaker === 'string' ? segment.speaker.trim().slice(0, 128) : '';
  const text = typeof segment?.text === 'string' ? segment.text.trim() : '';
  const { start, end } = segment || {};
  if (!speaker || !text || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) return [];
  return [{ speaker, start, end, text }];
});

const toTrimmedString = (value, deps) => (
  deps?.toStr
    ? deps.toStr(value).trim()
    : (typeof value === 'string' ? value : value == null ? '' : String(value)).trim()
);

export const transcribe = async ({
  request,
  secrets,
  config,
  baseHeaders,
  transcribeRequest = null,
  deps,
  constants,
} = {}) => {
  const json = deps?.json;
  const normalizedRequest = transcribeRequest || await (deps?.readTranscribeRequestPayload || readTranscribeRequestPayload)({ request });
  if (!normalizedRequest?.ok) {
    return json?.({ error: normalizedRequest?.error }, normalizedRequest?.status || 400, baseHeaders);
  }

  const {
    provider,
    requestApiKey,
    requestRpcUrl,
    upstreamFormData,
    groupSpeakerLabels,
  } = normalizedRequest.payload || {};

  let targetUrl = resolveOpenAiTranscribeUrl({ constants });
  let key = requestApiKey || toTrimmedString(secrets?.openaiKey, deps);
  let outboundUrlPolicy = '';
  if (provider === 'custom') {
    targetUrl = requestRpcUrl;
    let parsedTargetUrl;
    try {
      parsedTargetUrl = new URL(targetUrl);
    } catch {
      return json?.({ error: 'Custom transcription URL target is not allowed' }, 403, baseHeaders);
    }
    if (parsedTargetUrl.protocol !== 'https:') {
      return json?.({ error: 'Custom transcription URL must use HTTPS' }, 403, baseHeaders);
    }
    if (parsedTargetUrl.username || parsedTargetUrl.password) {
      return json?.({ error: 'Custom transcription URL must not contain credentials' }, 403, baseHeaders);
    }
    if (deps?.isBlockedOutboundUrl?.(targetUrl)) {
      return json?.({ error: 'Custom transcription URL target is not allowed' }, 403, baseHeaders);
    }
    key = requestApiKey;
    outboundUrlPolicy = STRICT_HTTPS_NO_CREDENTIALS_POLICY;
  }
  if (provider !== 'custom' && !key) {
    return json?.({ error: 'Server misconfigured: openaiKey is missing.' }, 401, baseHeaders);
  }

  if (provider === 'openai' && !requestApiKey && !isSessionTranscriptionModelAllowed({
    config, provider, groupSpeakerLabels, model: normalizedRequest.payload.model || upstreamFormData.get('model') || 'whisper-1',
  })) return json?.(AI_MODEL_NOT_ALLOWED, 403, baseHeaders);

  const headers = {};
  if (key) headers.authorization = `Bearer ${key}`;

  const fetchOptions = {
    method: 'POST',
    headers,
    body: upstreamFormData,
  };
  if (outboundUrlPolicy) fetchOptions.outboundUrlPolicy = outboundUrlPolicy;
  const response = await deps?.safeFetch?.(targetUrl, fetchOptions);
  if (!(response instanceof Response)) {
    return json?.({ error: response?.error }, response?.status, baseHeaders);
  }

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const message =
      typeof data?.error === 'string'
        ? data.error
        : data?.error?.message ||
          data?.message ||
          (response.status === 401 ? 'Unauthorized: invalid API key on server.' : 'Transcription failed.');
    return json?.({ error: String(message), details: data }, response.status, baseHeaders);
  }

  return json?.({
    text: data?.text || '',
    ...(groupSpeakerLabels ? { segments: normalizeSpeakerSegments(data?.segments) } : {}),
  }, 200, baseHeaders);
};
