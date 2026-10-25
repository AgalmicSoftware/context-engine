import { reserveCoordinatedHostedFaucet, finalizeCoordinatedHostedFaucet } from './sessionWriteCoordinator.js';
import { DEFAULT_AI_MODEL } from '../../shared/aiDefaults.mjs';
import { isModelAllowed } from './aiRequestNormalization.js';
import { executeSessionLitChipotleAction } from './chipotleClient.js';
import { buildSessionEndedResponse } from '../shared/sessionLifecycle.mjs';

const resolveDefaultModelForProvider = (provider) => {
  if (provider === 'anthropic') return 'claude-3-5-sonnet-20240620';
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

export const dispatchAuthenticatedSecretActionRoute = async ({
  path,
  action,
  body,
  config,
  slug,
  address,
  env,
  limit,
  headers,
  scopes,
  deps,
} = {}) => {
  const isFaucetAction = action === 'request_test_eth';
  const isAiAction = path === '/ai' || action === 'ai';
  const isLitChipotleAction = path === '/lit/chipotle-action' || action === 'lit_chipotle_execute';
  if (!isFaucetAction && !isAiAction && !isLitChipotleAction) {
    return { handled: false };
  }
  if (isAiAction) {
    const endedResponse = buildSessionEndedResponse({
      config,
      headers,
      json: deps?.json,
      now: deps?.now,
    });
    if (endedResponse) {
      return {
        handled: true,
        response: endedResponse,
      };
    }
  }

  if (isFaucetAction) {
    const toStr = typeof deps?.toStr === 'function'
      ? deps.toStr
      : (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));
    const hasProofBackedFaucetRequest = !!toStr(body?.sbtAddress).trim();
    const requestedRecipient = toStr(body?.to || body?.recipient || body?.address).trim().toLowerCase();
    const normalizedAddress = toStr(address).trim().toLowerCase();
    const isSelfFundingRequest = !!requestedRecipient && requestedRecipient === normalizedAddress;
    const hosted = config?.sessionModeProfile?.authority?.mode === 'worker_canonical';
    if (hosted && !isSelfFundingRequest) {
      return { handled: true, response: deps?.json?.({ error: 'Test ETH can only be sent to your own address.' }, 403, headers) };
    }
    const preflight = await deps?.evaluateAuthenticatedRoutePreflight?.({
      scopes,
      scope: 'faucet',
      route: 'faucet',
      config,
      allowWithoutScope: !hosted && (hasProofBackedFaucetRequest || isSelfFundingRequest),
      env,
      slug,
      address,
      limit,
      headers,
      deps: {
        checkRateLimit: hosted ? async () => true : deps?.checkRateLimit,
        computeScopesForLogin: deps?.computeScopesForLogin,
        json: deps?.json,
      },
    });
    if (!preflight?.ok) {
      return {
        handled: true,
        response: preflight?.response,
      };
    }

    const secretContext = await deps?.resolveAuthenticatedRouteSecrets?.({
      env,
      slug,
      headers,
      deps: {
        getSessionSecrets: deps?.getSessionSecrets,
        json: deps?.json,
      },
    });
    if (!secretContext?.ok) {
      return {
        handled: true,
        response: secretContext?.response,
      };
    }

    const reserve = deps?.reserveCoordinatedHostedFaucet || reserveCoordinatedHostedFaucet;
    const finalize = deps?.finalizeCoordinatedHostedFaucet || finalizeCoordinatedHostedFaucet;
    const reservation = hosted ? await reserve({ env, slug, address }) : null;
    if (hosted && reservation?.ok !== true) {
      return { handled: true, response: deps?.json?.({ error: 'Faucet coordination is unavailable; try later.' }, 503, headers) };
    }
    if (hosted && !reservation.allowed) {
      return { handled: true, response: deps?.json?.({ error: "Today's test-ETH limit for this address is used up." }, 429, headers) };
    }
    let submissionAttempted = false;
    let response;
    try {
      response = await deps?.faucet?.({
        payload: body,
        secrets: secretContext.secrets,
        config,
        baseHeaders: headers,
        slug,
        requesterAddress: address,
        tokenHasFaucetScope: preflight.tokenHasScope,
        ...(hosted ? {
          onSubmissionAttempt: () => { submissionAttempted = true; },
          retryAfterSubmissionFailure: false,
        } : {}),
      });
    } catch (error) {
      // A failure before submission, such as a malformed key, must not hold a slot.
      if (hosted && !submissionAttempted) {
        await finalize({ env, slug, address, requestId: reservation.requestId, sent: false });
      }
      throw error;
    }
    if (hosted) {
      // HTTP errors do not prove a transfer was rejected. Only release a failed
      // request when no submission was attempted; ambiguous sends expire normally.
      if (!submissionAttempted || response?.status === 200) {
        await finalize({ env, slug, address, requestId: reservation.requestId, sent: response?.status === 200 });
      }
    }
    return { handled: true, response };
  }

  if (isAiAction) {
    const preflight = await deps?.evaluateAuthenticatedRoutePreflight?.({
      scopes,
      scope: 'ai',
      route: 'ai',
      config,
      env,
      slug,
      address,
      limit,
      headers,
      deps: {
        checkRateLimit: deps?.checkRateLimit,
        computeScopesForLogin: deps?.computeScopesForLogin,
        json: deps?.json,
      },
    });
    if (!preflight?.ok) {
      return {
        handled: true,
        response: preflight?.response,
      };
    }

    const secretContext = await deps?.resolveAuthenticatedRouteSecrets?.({
      env,
      slug,
      headers,
      deps: {
        getSessionSecrets: deps?.getSessionSecrets,
        json: deps?.json,
      },
    });
    if (!secretContext?.ok) {
      return {
        handled: true,
        response: secretContext?.response,
      };
    }

    const aiRequest = deps?.normalizeAiRequestPayload?.({ payload: body }) || {};
    const provider = aiRequest.provider;
    const model = resolveModelForProvider({ payload: aiRequest.payload || body, provider });
    if (!isModelAllowed(model, provider)) {
      return {
        handled: true,
        response: deps?.json?.({ error: 'Model not allowed for provider' }, 400, headers),
      };
    }
    if (provider === 'anthropic') {
      return {
        handled: true,
        response: await deps?.proxyAnthropic?.({
          payload: body,
          secrets: secretContext.secrets,
          baseHeaders: headers,
        }),
      };
    }
    if (provider === 'openai') {
      return {
        handled: true,
        response: await deps?.proxyOpenAI?.({
          payload: body,
          secrets: secretContext.secrets,
          baseHeaders: headers,
        }),
      };
    }
    if (provider === 'openrouter') {
      return {
        handled: true,
        response: await deps?.proxyOpenRouter?.({
          payload: body,
          secrets: secretContext.secrets,
          baseHeaders: headers,
        }),
      };
    }
    if (provider === 'custom') {
      return {
        handled: true,
        response: await deps?.proxyCustomRPC?.({
          payload: body,
          secrets: secretContext.secrets,
          baseHeaders: headers,
          auth: {
            address,
            scopes,
          },
        }),
      };
    }

    return {
      handled: true,
      response: deps?.json?.({ error: `Unsupported provider: ${provider}` }, 400, headers),
    };
  }

  const preflight = await deps?.evaluateAuthenticatedRoutePreflight?.({
    scopes,
    scope: 'lit',
    route: 'lit',
    config,
    env,
    slug,
    address,
    limit,
    headers,
    deps: {
      checkRateLimit: deps?.checkRateLimit,
      computeScopesForLogin: deps?.computeScopesForLogin,
      json: deps?.json,
    },
  });
  if (!preflight?.ok) {
    return {
      handled: true,
      response: preflight?.response,
    };
  }

  const secretContext = await deps?.resolveAuthenticatedRouteSecrets?.({
    env,
    slug,
    headers,
    deps: {
      getSessionSecrets: deps?.getSessionSecrets,
      json: deps?.json,
    },
  });
  if (!secretContext?.ok) {
    return {
      handled: true,
      response: secretContext?.response,
    };
  }

  try {
    const result = await (
      deps?.executeSessionLitChipotleAction || executeSessionLitChipotleAction
    )({
      env,
      config,
      secrets: secretContext.secrets,
      request: body,
      requesterAddress: address,
      sessionSlug: slug,
      fetchImpl: deps?.fetchImpl,
    });
    return {
      handled: true,
      response: deps?.json?.(result, 200, headers),
    };
  } catch (error) {
    const message = error?.message || 'Failed to execute Lit Chipotle action.';
    const normalized = String(message).toLowerCase();
    const status = (
      normalized.includes('required') ||
      normalized.includes('missing') ||
      normalized.includes('invalid') ||
      normalized.includes('must be') ||
      normalized.includes('not configured') ||
      normalized.includes('does not match')
    ) ? 400 : 502;
    return {
      handled: true,
      response: deps?.json?.({ error: message }, status, headers),
    };
  }
};
