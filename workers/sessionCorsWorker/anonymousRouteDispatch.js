import { isModelAllowed } from './aiRequestNormalization.js';
import {
  dispatchPublicWorkerGroupListRequest as dispatchPublicWorkerGroupListRequestBoundary,
} from './workerGroups.js';
import { buildSessionEndedResponse } from '../shared/sessionLifecycle.mjs';
import {
  proxyOpenAiRealtimeCall as proxyOpenAiRealtimeCallBoundary,
  readRealtimeCallRequestPayload as readRealtimeCallRequestPayloadBoundary,
} from './realtimeCallExecution.js';

const resolveDefaultModelForProvider = (provider) => {
  if (provider === 'anthropic') return 'claude-3-5-sonnet-20240620';
  if (provider === 'openrouter') return 'openrouter/auto';
  if (provider === 'openai' || provider === 'custom') return 'gpt-5';
  return '';
};

const resolveModelForProvider = ({ payload, provider } = {}) => {
  const rawModel = payload?.model;
  const model = typeof rawModel === 'string'
    ? rawModel.trim()
    : (rawModel == null ? '' : String(rawModel).trim());
  return model || resolveDefaultModelForProvider(provider);
};

export const dispatchAnonymousRoute = async ({
  path,
  request,
  anonymousContext,
  deps,
} = {}) => {
  const {
    slug,
    config,
    headers,
    env,
  } = anonymousContext || {};

  if (path === '/groups/list') {
    const dispatchPublicWorkerGroupListRequest =
      deps?.dispatchPublicWorkerGroupListRequest || dispatchPublicWorkerGroupListRequestBoundary;
    return dispatchPublicWorkerGroupListRequest({
      request,
      config,
      env,
      slug,
      baseHeaders: headers,
      deps: {
        json: deps?.json,
      },
    });
  }

  if (
    (path === '/storage/read' || path === '/storage/list') &&
    typeof deps?.storageRoute === 'function'
  ) {
    return deps.storageRoute({
      path,
      method: request?.method || 'GET',
      request,
      env: env || {},
      config,
      slug,
      uploaderAddress: '',
      baseHeaders: headers,
    });
  }
  const endedResponse = buildSessionEndedResponse({
    config,
    headers,
    json: deps?.json,
    now: deps?.now,
  });
  if (endedResponse) return endedResponse;

  if (path === '/transcribe') {
    const transcribeRequest = await deps?.readTranscribeRequestPayload?.({ request });
    if (!transcribeRequest?.ok) {
      return deps?.json?.(
        { error: transcribeRequest?.error },
        transcribeRequest?.status || 400,
        headers,
      );
    }

    const anonymousAccess = await deps?.evaluateAnonymousRouteAccess?.({
      slug,
      config,
      route: 'transcribe',
      apiKey: transcribeRequest?.payload?.requestApiKey,
    });
    if (!anonymousAccess?.ok) {
      return deps?.json?.(
        { error: anonymousAccess?.error || deps?.ANONYMOUS_ROUTE_DENIED_ERROR },
        anonymousAccess?.status || 403,
        headers,
      );
    }

    const secrets = anonymousAccess?.reason === 'request-api-key'
      ? {}
      : ((await deps?.getSessionSecrets?.(slug)) || {});
    return deps?.transcribe?.({
      request: null,
      secrets,
      baseHeaders: headers,
      transcribeRequest,
    });
  }

  if (path === '/realtime/call') {
    const readRealtimeCallRequestPayload = deps?.readRealtimeCallRequestPayload || readRealtimeCallRequestPayloadBoundary;
    const realtimeRequest = await readRealtimeCallRequestPayload({ request });
    if (!realtimeRequest?.ok) {
      return deps?.json?.(
        { error: realtimeRequest?.error },
        realtimeRequest?.status || 400,
        headers,
      );
    }
    const anonymousAccess = await deps?.evaluateAnonymousRouteAccess?.({
      slug,
      config,
      route: 'realtime',
    });
    if (!anonymousAccess?.ok) {
      return deps?.json?.(
        { error: anonymousAccess?.error || deps?.ANONYMOUS_ROUTE_DENIED_ERROR },
        anonymousAccess?.status || 403,
        headers,
      );
    }
    const secrets = (await deps?.getSessionSecrets?.(slug)) || {};
    const proxyOpenAiRealtimeCall = deps?.proxyOpenAiRealtimeCall || proxyOpenAiRealtimeCallBoundary;
    return proxyOpenAiRealtimeCall({
      payload: realtimeRequest.payload,
      secrets,
      config,
      baseHeaders: headers,
      deps: { json: deps?.json },
    });
  }

  const aiRequest = await deps?.readAiRequestPayload?.({
    request: typeof request?.clone === 'function' ? request.clone() : request,
  });
  if (!aiRequest?.ok) {
    return deps?.json?.(
      { error: aiRequest?.error },
      aiRequest?.status || 400,
      headers,
    );
  }

  const {
    payload,
    provider,
    requestApiKey,
    requestRpcUrl,
  } = aiRequest;
  const anonymousAccess = await deps?.evaluateAnonymousRouteAccess?.({
    slug,
    config,
    route: 'ai',
    apiKey: requestApiKey,
  });
  if (!anonymousAccess?.ok) {
    return deps?.json?.(
      { error: anonymousAccess?.error || deps?.ANONYMOUS_ROUTE_DENIED_ERROR },
      anonymousAccess?.status || 403,
      headers,
    );
  }

  const aiValidation = deps?.validateAnonymousAiRequest?.({
    provider,
    requestRpcUrl,
    anonymousAccessReason: anonymousAccess?.reason,
  }) || {};
  if (!aiValidation?.ok) {
    return deps?.json?.(
      { error: aiValidation?.error },
      aiValidation?.status || 400,
      headers,
    );
  }

  const model = resolveModelForProvider({ payload, provider });
  if (!isModelAllowed(model, provider)) {
    return deps?.json?.(
      { error: 'Model not allowed for provider' },
      400,
      headers,
    );
  }
  if (provider === 'custom') {
    return deps?.json?.(
      { error: 'Custom RPC not available for anonymous requests' },
      403,
      headers,
    );
  }

  const secrets = anonymousAccess?.reason === 'request-api-key'
    ? {}
    : ((await deps?.getSessionSecrets?.(slug)) || {});
  if (provider === 'anthropic') {
    return deps?.proxyAnthropic?.({ payload, secrets, baseHeaders: headers });
  }
  if (provider === 'openai') {
    return deps?.proxyOpenAI?.({ payload, secrets, baseHeaders: headers });
  }
  if (provider === 'openrouter') {
    return deps?.proxyOpenRouter?.({ payload, secrets, baseHeaders: headers });
  }

  return deps?.json?.({ error: `Unsupported provider: ${provider}` }, 400, headers);
};
