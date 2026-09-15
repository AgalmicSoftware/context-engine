import { resolveSessionLifecycle } from '../shared/sessionLifecycle.mjs';

const toPresent = (value) => {
  if (typeof value === 'string') return value.trim().length > 0;
  return value !== null && value !== undefined && value !== false;
};

export const buildSponsoredResourcePresence = (secrets) => {
  const source = secrets && typeof secrets === 'object' ? secrets : {};
  return {
    ai: ['openaiKey', 'anthropicKey', 'openrouterKey'].some((key) => toPresent(source[key])),
    arweave: toPresent(source.arweaveJwk),
    rpc: toPresent(source.customRpcUrl),
    txGas: toPresent(source.faucetPrivateKey),
  };
};

export const dispatchResourcePresenceRequest = async ({
  request,
  env,
  slugHint,
  baseHeaders,
  deps,
  constants,
} = {}) => {
  const slugResolution = deps?.resolveRequestSlugWithoutToken?.({ request, env, slugHint }) || {
    ok: false,
    error: 'Invalid session slug.',
  };
  if (!slugResolution.ok) {
    return deps?.json?.({ error: slugResolution.error }, 400, baseHeaders);
  }
  if (!slugResolution.explicitSlugProvided) {
    return deps?.json?.({ error: constants?.missingSlugError }, 400, baseHeaders);
  }

  const slug = slugResolution.slug;
  const config = await deps?.getSessionConfig?.(env, slug);
  if (!config) {
    return deps?.json?.({ error: constants?.sessionConfigNotFoundError }, 404, baseHeaders);
  }

  const corsContext = await deps?.getCorsContext?.({ request, config });
  if (!corsContext?.ok) return corsContext?.response;

  const secrets = (await deps?.getSessionSecrets?.(env, slug)) || {};
  let interview;
  if (request?.url && new URL(request.url).searchParams.get('interview') === '1') {
    const settings = config.interviewMode || config.interview || {};
    let reason = '';
    if (resolveSessionLifecycle(config).ended) reason = 'This session has ended.';
    else if (config.interviewModeEnabled === false || settings.enabled === false) reason = 'Interview mode is disabled for this session.';
    else if (String(settings.provider || 'openai').trim().toLowerCase() !== 'openai') reason = 'Voice interviews require the OpenAI provider.';
    else if (!String(secrets.openaiKey || '').trim()) reason = 'The session owner needs to configure an OpenAI key for voice interviews.';
    else {
      const access = await deps?.evaluateAnonymousRouteAccess?.({ slug, config, route: 'realtime' });
      if (!access?.ok) reason = 'Voice interview access is unavailable. Ask the session owner to check AI access settings.';
    }
    interview = { ready: !reason, ...(reason ? { reason } : {}) };
  }
  return deps?.json?.(
    {
      ok: true,
      sessionSlug: slug,
      // Presence is intentionally resource-level only; never expose secret names or values.
      resources: buildSponsoredResourcePresence(secrets),
      ...(interview ? { interview } : {}),
    },
    200,
    corsContext.headers,
  );
};
