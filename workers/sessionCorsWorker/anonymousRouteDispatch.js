import { AI_MODEL_NOT_ALLOWED } from './aiRequestPolicy.js';
import { answerAiCall } from './aiKeepAlive.js';
import { DEFAULT_AI_MODEL, DEFAULT_ANTHROPIC_MODEL } from '../../shared/aiDefaults.mjs';
import { dispatchWorkerCapabilities } from './workerCapabilities.js';
import { isModelAllowed } from './aiRequestNormalization.js';
import {
  dispatchPublicWorkerGroupListRequest as dispatchPublicWorkerGroupListRequestBoundary,
  normalizeWorkerGroupId,
} from './workerGroups.js';
import { buildSessionEndedResponse } from '../shared/sessionLifecycle.mjs';
import { PRIVATE_SESSION_INVITE_INVALID, parseWorkerGroupReadInvite } from '../../shared/workerGroupJoin.mjs';
import {
  evaluatePrivateSessionAccess,
  isPrivateSession,
  privateSessionRefusal,
  readGroupReadInviteHeader,
} from './privateSessionAccess.js';
import {
  isInterviewModeEnabled,
  proxyOpenAiRealtimeCall as proxyOpenAiRealtimeCallBoundary,
  readRealtimeCallRequestPayload as readRealtimeCallRequestPayloadBoundary,
} from './realtimeCallExecution.js';

const resolveDefaultModelForProvider = (provider) => {
  if (provider === 'anthropic') return DEFAULT_ANTHROPIC_MODEL;
  if (provider === 'openrouter') return 'openrouter/auto';
  if (provider === 'openai' || provider === 'custom') return DEFAULT_AI_MODEL;
  return '';
};

const resolveModelForProvider = ({ payload, provider } = {}) => {
  const rawModel = payload?.model;
  const model = typeof rawModel === 'string'
    ? rawModel.trim()
    : (rawModel == null ? '' : String(rawModel).trim());
  return model || resolveDefaultModelForProvider(provider);
};

// Whether the read invite is for the one group the list request names.
const sameGroup = (header, request) => {
  let joinGroups = [];
  try {
    joinGroups = new URL(request?.url || '').searchParams.getAll('joinGroup');
  } catch {
    return false;
  }
  const invite = parseWorkerGroupReadInvite(header);
  return joinGroups.length === 1 && !!invite && invite.groupId === normalizeWorkerGroupId(joinGroups[0]);
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

  if (path === '/capabilities') return dispatchWorkerCapabilities({ request, env, headers });

  // A private session shows a signed-out visitor nothing its rule doesn't
  // admit them to; storage reads check the rule themselves, part by part.
  const privateSession = isPrivateSession(config);
  const refusePrivate = async ({ codeReads = false } = {}) => {
    if (!privateSession) return null;
    const access = await evaluatePrivateSessionAccess({
      env, slug, config, request, part: 'questions', codeReads,
      // Voice calls arrive here signed in too: the signed-in Worker has no route for them.
      resolveRequester: () => deps?.resolveOptionalRequester?.({ request, env, slug, config, headers }),
    });
    return access.ok ? null : privateSessionRefusal({ access, json: deps?.json, headers });
  };

  if (path === '/groups/list') {
    // A read: the one group a link's invite is for, also by one-use code.
    const refused = await refusePrivate({ codeReads: true });
    if (refused) return refused;
    // In a private session the list shows only the group the invite opens.
    if (privateSession && !sameGroup(readGroupReadInviteHeader(request), request)) {
      return privateSessionRefusal({
        access: { status: 403, reason: PRIVATE_SESSION_INVITE_INVALID },
        json: deps?.json,
        headers,
      });
    }
    const dispatchPublicWorkerGroupListRequest =
      deps?.dispatchPublicWorkerGroupListRequest || dispatchPublicWorkerGroupListRequestBoundary;
    return dispatchPublicWorkerGroupListRequest({
      request,
      config,
      env,
      slug,
      baseHeaders: headers,
      invitedOnly: privateSession,
      deps: {
        json: deps?.json,
      },
    });
  }

  if (
    ['/storage/read', '/storage/list', '/storage/read-batch'].includes(path) &&
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
  const refused = await refusePrivate();
  if (refused) return refused;
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
      config,
    });
  }

  if (path === '/realtime/call') {
    if (!isInterviewModeEnabled(config)) {
      return deps?.json?.({ error: 'Interview mode is disabled for this session.' }, 403, headers);
    }
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
    config,
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
      requestApiKey ? { error: 'Model not allowed for provider' } : AI_MODEL_NOT_ALLOWED,
      requestApiKey ? 400 : 403,
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
    return answerAiCall(payload, () => deps?.proxyAnthropic?.({ payload, secrets, config, baseHeaders: headers }), headers);
  }
  if (provider === 'openai') {
    return answerAiCall(payload, () => deps?.proxyOpenAI?.({ payload, secrets, config, baseHeaders: headers }), headers);
  }
  if (provider === 'openrouter') {
    return answerAiCall(payload, () => deps?.proxyOpenRouter?.({ payload, secrets, config, baseHeaders: headers }), headers);
  }

  return deps?.json?.({ error: `Unsupported provider: ${provider}` }, 400, headers);
};
