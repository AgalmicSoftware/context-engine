import { DEFAULT_AI_MODEL } from '../../shared/aiDefaults.mjs';
import {
  ANALYSIS_CARD_LOOK_SCHEMA,
  ANALYSIS_CARD_LOOKS_REMEMBERED,
  ANALYSIS_CARD_PICTURE_QUALITY,
  ANALYSIS_CARD_PICTURE_SIZE,
  analysisCardFigureKey,
  buildAnalysisCardLookPrompt,
  buildAnalysisCardPicturePrompt,
  normalizeAnalysisCardLook,
  parseAnalysisCardFigure,
} from '../../shared/analysisCardPicture.mjs';
import { buildSessionEndedResponse } from '../shared/sessionLifecycle.mjs';
import { assertNoSecretShape } from './agent/redaction.mjs';
import { boundedAgentFetch } from './agent/transport.mjs';
import { DEFAULT_WRAPPED_IMAGE_MODEL } from './agent/wrappedCore.mjs';
import { proxyOpenAI } from './aiProviderExecution.js';
import { resolveAiDailyLimit } from './aiRateLimitPolicy.js';
import { resolveSessionAiModel } from './aiRequestPolicy.js';
import { rateLimitRefusal } from './rateLimitRefusal.js';

// POST /analysis-card/picture draws the picture on a personal analysis card: the matched historical figure, in a
// style of their own time. The page sends only the figure's name. One request to the session's OpenAI key
// art-directs the picture (the "look"), a second draws it from that look alone, and the result is kept per figure
// so each figure is drawn once per session. Neither request sees an answer, a participant's name or an address.
export const ANALYSIS_CARD_PICTURE_PATH = '/analysis-card/picture';

// New pictures a session may draw in a day, whoever asks, as Wrapped bounds its posters.
export const ANALYSIS_CARD_PICTURES_PER_SESSION_PER_DAY = 60;

const OPENAI_IMAGE_URL = 'https://api.openai.com/v1/images/generations';
const LOOK_TIMEOUT_MS = 60_000;
const PICTURE_TIMEOUT_MS = 120_000;
const PICTURE_MAX_BYTES = 8 * 1024 * 1024;
// The look is a few lines of JSON, but a model that thinks spends part of the cap on thinking.
const LOOK_MAX_TOKENS = 6000;
const CACHE_PREFIX = 'analysis-card-picture:v1:';
const LOOKS_KEY = 'looks';
const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;
// A figure that could not be drawn, and a session that has drawn its day's pictures, are remembered for a
// while, so reopening a card does not spend another request or one of the viewer's AI calls on the same answer.
const REFUSAL_TTL_SECONDS = 24 * 60 * 60;
const SESSION_LIMIT_KEY = 'session-limit';
const SESSION_LIMIT_TTL_SECONDS = 60 * 60;

const parseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

// Pictures sit beside the session's config in GROUP_KV, the one binding every Session Worker has. A Worker
// without it still draws; it only draws each time. Reads and writes never fail the request: a lost write costs
// one more drawing later.
const pictureStore = (env, slug) => {
  const kv = env?.GROUP_KV;
  if (!slug || typeof kv?.get !== 'function' || typeof kv?.put !== 'function') return null;
  const key = (name) => `session:${slug}:${CACHE_PREFIX}${name}`;
  return {
    read: async (name) => {
      try {
        return parseJson(await kv.get(key(name)));
      } catch {
        return null;
      }
    },
    write: async (name, value, expirationTtl = CACHE_TTL_SECONDS) => {
      try {
        await kv.put(key(name), JSON.stringify(value), { expirationTtl });
      } catch {
        // Best effort.
      }
    },
  };
};

// The session's own text model when it is an OpenAI model, since the picture needs the session's OpenAI key
// either way; otherwise the default OpenAI model.
const lookModelOf = (config) => {
  const session = resolveSessionAiModel(config);
  return session.provider === 'openai' ? session.model : DEFAULT_AI_MODEL;
};

// { look } for a real person who has died, { look: null, unknown } otherwise: unknown says the model itself
// answered that it knows no such person (rather than naming somebody else). Throws when OpenAI can't be asked.
const requestLook = async ({ figure, askedName, takenLooks, model, openaiKey, fetchImpl, nowYear }) => {
  const response = await proxyOpenAI({
    payload: {
      model,
      messages: [{ role: 'user', content: buildAnalysisCardLookPrompt(figure, takenLooks) }],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'analysis_card_look', schema: ANALYSIS_CARD_LOOK_SCHEMA, strict: true },
      },
      reasoning_effort: 'low',
      max_tokens: LOOK_MAX_TOKENS,
    },
    secrets: { openaiKey },
    // The request policy holds a caller's request to the session's models. This request is the Worker's own,
    // so the policy is given the one model chosen above.
    config: { ai: { provider: 'openai', model } },
    baseHeaders: {},
    deps: { fetch: boundedAgentFetch(fetchImpl, { timeoutMs: LOOK_TIMEOUT_MS }) },
  });
  if (!response.ok) throw new Error('look_request_failed');
  const raw = parseJson((await response.json())?.completion);
  if (!raw) throw new Error('look_unreadable');
  return { look: normalizeAnalysisCardLook(raw, { nowYear, askedName }), unknown: raw.died === 0 };
};

// { base64 } when drawn, { refused: true } when OpenAI's moderation refuses the prompt, {} for any other failure.
const requestPicture = async ({ prompt, openaiKey, fetchImpl }) => {
  const body = {
    model: DEFAULT_WRAPPED_IMAGE_MODEL,
    prompt,
    size: ANALYSIS_CARD_PICTURE_SIZE,
    quality: ANALYSIS_CARD_PICTURE_QUALITY,
    output_format: 'jpeg',
    output_compression: 90,
    n: 1,
  };
  assertNoSecretShape(body, 'Analysis card picture request must not serialize secrets.');
  const response = await boundedAgentFetch(fetchImpl, { timeoutMs: PICTURE_TIMEOUT_MS, maxBytes: PICTURE_MAX_BYTES })(
    OPENAI_IMAGE_URL,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify(body),
    },
  );
  const parsed = parseJson(await response.text().catch(() => ''));
  if (!response.ok) return parsed?.error?.code === 'moderation_blocked' ? { refused: true } : {};
  const base64 = parsed?.data?.[0]?.b64_json;
  return typeof base64 === 'string' && base64 ? { base64 } : {};
};

// The portrait, or a still life of the figure's objects when the portrait is refused.
const drawPicture = async ({ look, openaiKey, fetchImpl }) => {
  const portrait = await requestPicture({ prompt: buildAnalysisCardPicturePrompt(look), openaiKey, fetchImpl });
  if (!portrait.refused) return { ...portrait, portrait: true };
  if (!look.objects) return { refused: true };
  const emblem = await requestPicture({
    prompt: buildAnalysisCardPicturePrompt(look, { emblem: true }),
    openaiKey,
    fetchImpl,
  });
  return { ...emblem, portrait: false };
};

const REFUSALS = new Set(['figure_not_recognised', 'picture_refused']);

export const dispatchAnalysisCardPictureRoute = async ({
  body,
  config,
  slug,
  address,
  env,
  headers,
  scopes,
  deps,
} = {}) => {
  const noStore = new Headers(headers || {});
  noStore.set('cache-control', 'no-store');
  const send = (data, status) => deps?.json?.(data, status, noStore);

  // Who may ask, and when, is the signed-in /ai route's rule.
  const ended = buildSessionEndedResponse({ config, headers: noStore, json: deps?.json, now: deps?.now });
  if (ended) return ended;
  const preflight = await deps?.evaluateAuthenticatedRoutePreflight?.({
    scopes,
    scope: 'ai',
    route: 'ai',
    config,
    env,
    slug,
    address,
    limit: resolveAiDailyLimit(config),
    headers: noStore,
    deps: {
      checkRateLimit: deps?.checkRateLimit,
      computeScopesForLogin: deps?.computeScopesForLogin,
      json: deps?.json,
    },
    countLater: true,
  });
  if (!preflight?.ok) return preflight?.response;

  const parsed = parseAnalysisCardFigure(body?.figure);
  if (!parsed) return send({ error: 'invalid_figure' }, 400);

  const store = pictureStore(env, slug);
  const figureKey = `figure:${analysisCardFigureKey(parsed.figure)}`;
  const kept = await store?.read(figureKey);
  if (kept?.image?.base64) return send({ ...kept, figure: parsed.figure, cached: true }, 200);
  if (REFUSALS.has(kept?.refused)) return send({ error: kept.refused }, 422);
  if (await store?.read(SESSION_LIMIT_KEY)) return send({ error: 'picture_session_limit' }, 429);

  const openaiKey = String((await deps?.getSessionSecrets?.(env, slug))?.openaiKey || '').trim();
  if (!openaiKey) return send({ error: 'picture_needs_openai_key' }, 409);

  // A name the model doesn't recognise costs none of the day's AI calls, so the look requests themselves are
  // bounded per person by the same number. Otherwise unrecognised names, or a person already past their AI
  // calls, could spend the session's key without limit.
  const mayAsk = await deps?.checkRateLimit?.({
    env,
    slug,
    address,
    route: 'analysis-card-look',
    limit: resolveAiDailyLimit(config),
  });
  if (!mayAsk) return rateLimitRefusal(mayAsk, deps?.json, noStore);

  const fetchImpl = deps?.fetch || fetch;
  const takenLooks = await store?.read(LOOKS_KEY);
  const taken = Array.isArray(takenLooks) ? takenLooks : [];
  // A refusal is kept only where no picture is, so one request can't undo what another has just drawn.
  const rememberRefusal = async (refused) => {
    if (!(await store?.read(figureKey))?.image) await store?.write(figureKey, { refused }, REFUSAL_TTL_SECONDS);
  };
  let look;
  let unknown;
  try {
    ({ look, unknown } = await requestLook({
      figure: parsed.figure,
      askedName: parsed.name,
      takenLooks: taken,
      model: lookModelOf(config),
      openaiKey,
      fetchImpl,
      nowYear: new Date(deps?.now?.() ?? Date.now()).getUTCFullYear(),
    }));
  } catch {
    return send({ error: 'picture_unavailable' }, 502);
  }
  if (!look) {
    // Remembered only when the model knows no such person; an answer naming somebody else may be a spelling
    // the next request gets right.
    if (unknown) await rememberRefusal('figure_not_recognised');
    return send({ error: 'figure_not_recognised' }, 422);
  }

  // Counted only now, for a picture about to be drawn. The person's own count comes first, so someone past
  // their AI calls can't use up the session's pictures.
  const refused = await preflight.count?.();
  if (refused) return refused;
  const sessionAllows = await deps?.checkRateLimit?.({
    env,
    slug,
    address: 'session',
    route: 'analysis-card-picture-session',
    limit: ANALYSIS_CARD_PICTURES_PER_SESSION_PER_DAY,
  });
  if (sessionAllows === null) return rateLimitRefusal(null, deps?.json, noStore);
  if (!sessionAllows) {
    await store?.write(SESSION_LIMIT_KEY, { reached: true }, SESSION_LIMIT_TTL_SECONDS);
    return send({ error: 'picture_session_limit' }, 429);
  }

  let picture;
  try {
    picture = await drawPicture({ look, openaiKey, fetchImpl });
  } catch {
    return send({ error: 'picture_unavailable' }, 502);
  }
  if (picture.refused) {
    await rememberRefusal('picture_refused');
    return send({ error: 'picture_refused' }, 422);
  }
  if (!picture.base64) return send({ error: 'picture_unavailable' }, 502);

  const result = {
    figure: parsed.figure,
    name: look.name,
    portrait: picture.portrait,
    look: { era: look.era, ground: look.ground, accentHex: look.accentHex },
    image: { mime: 'image/jpeg', base64: picture.base64 },
  };
  await Promise.all([
    store?.write(figureKey, result),
    store?.write(
      LOOKS_KEY,
      [{ style: look.style, ground: look.ground }, ...taken].slice(0, ANALYSIS_CARD_LOOKS_REMEMBERED),
    ),
  ]);
  return send({ ...result, cached: false }, 200);
};
