import { analysisCardAnswersArePrivate, analysisCardOn, normalizeSavedAnalysisCard } from '../../shared/analysisCardSaved.mjs';
import { buildSessionEndedResponse } from '../shared/sessionLifecycle.mjs';
import { createRequesterAccessChecks } from './storageRouteExecution.js';

// One personal analysis card per person, saved on their page so every visitor sees the same card without pressing
// Analyze.
// - POST /analysis-card/publish { published, card? } saves the caller's own card (published: true) or withdraws it
//   (published: false). A card is only ever filed under the signed-in caller's own address, so nobody can put a
//   card on someone else's page. Withdrawing replaces the card with a marker that holds no words of it, and the
//   marker keeps the person's "no" so their page does not save a new card on its own.
// - POST /analysis-card/published { account } answers { published: true, card, savedAt }, { published: false }
//   (withdrawn) or { published: null } (nothing saved).
// Both need what the card's picture needs: a sign-in with the `ai` scope, rechecked against the session's current
// rules, in a session that has not ended and has not turned the card off. Neither calls a model or counts an AI call.
// A card is made from its owner's answers and quotes up to three of them, so it goes only where those answers go:
// none is saved where the session keeps answers to their author and its admins, and a saved one is given only to
// someone who may read that person's answers (a card saved before the session's rules were tightened included).
export const ANALYSIS_CARD_PUBLISH_PATH = '/analysis-card/publish';
export const ANALYSIS_CARD_PUBLISHED_PATH = '/analysis-card/published';
export const ANALYSIS_CARD_SAVED_PATHS = [ANALYSIS_CARD_PUBLISH_PATH, ANALYSIS_CARD_PUBLISHED_PATH];

// Saves one person may make in a day. Withdrawing is never counted, so nobody is kept from taking their card down;
// it writes only when there is something to take down, so the writes a person can cause stay bounded by their saves.
export const ANALYSIS_CARD_SAVES_PER_DAY = 20;
// Cards and markers sit beside the session's config in GROUP_KV, which no backup reads; each lasts a year from
// its last save.
const KEY_PREFIX = 'analysis-card-saved:v1:';
const SAVED_TTL_SECONDS = 365 * 24 * 60 * 60;
const ACCOUNT_RE = /^0x[0-9a-f]{40}$/;

const parseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const accountOf = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

export const dispatchAnalysisCardSavedRoute = async ({
  path,
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

  // Turned off by an admin: nothing is then counted, read or stored. A card saved while it was on stays in storage,
  // unread, until the switch is on again or the card expires.
  if (!analysisCardOn(config)) return send({ error: 'analysis_card_off' }, 403);
  const ended = buildSessionEndedResponse({ config, headers: noStore, json: deps?.json, now: deps?.now });
  if (ended) return ended;
  const preflight = await deps?.evaluateAuthenticatedRoutePreflight?.({
    scopes,
    scope: 'ai',
    route: 'analysis-card-save',
    config,
    env,
    slug,
    address,
    limit: ANALYSIS_CARD_SAVES_PER_DAY,
    headers: noStore,
    deps: {
      checkRateLimit: deps?.checkRateLimit,
      computeScopesForLogin: deps?.computeScopesForLogin,
      json: deps?.json,
    },
    // Only a save is counted. A read is not: checking the count costs as much as the read itself.
    countLater: true,
  });
  if (!preflight?.ok) return preflight?.response;

  const kv = env?.GROUP_KV;
  if (!slug || typeof kv?.get !== 'function' || typeof kv?.put !== 'function') {
    return send({ error: 'card_store_unavailable' }, 503);
  }
  const keyOf = (account) => `session:${slug}:${KEY_PREFIX}${account}`;

  if (path === ANALYSIS_CARD_PUBLISHED_PATH) {
    const account = accountOf(body?.account);
    if (!ACCOUNT_RE.test(account)) return send({ error: 'invalid_account' }, 400);
    let stored;
    try {
      stored = parseJson(await kv.get(keyOf(account)));
    } catch {
      return send({ error: 'card_store_unavailable' }, 503);
    }
    if (stored?.published === false) return send({ published: false }, 200);
    const card = stored?.published === true ? normalizeSavedAnalysisCard(stored.card) : null;
    const savedAt = Number(stored?.savedAt);
    if (!card || !Number.isFinite(savedAt)) return send({ published: null }, 200);
    // To anyone but its owner the card reads as not saved unless they may read the owner's answers, as a read of
    // one of those answers would decide. A check that cannot be made counts as no.
    if (account !== accountOf(address)) {
      const checks = (deps?.createRequesterAccessChecks || createRequesterAccessChecks)({
        env, config, slug, requesterAddress: address, authScopes: scopes, deps,
      });
      const mayRead = await checks.canRead({ resource: 'responses', responder: account }).catch(() => false);
      if (!mayRead) return send({ published: null }, 200);
    }
    return send({ published: true, card, savedAt }, 200);
  }

  // The card is the caller's own: whatever the body names, it is filed under the signed-in address.
  const owner = accountOf(address);
  if (!ACCOUNT_RE.test(owner)) return send({ error: 'invalid_account' }, 400);
  if (typeof body?.published !== 'boolean') return send({ error: 'invalid_request' }, 400);
  const card = body.published ? normalizeSavedAnalysisCard(body.card) : null;
  if (body.published && !card) return send({ error: 'invalid_card' }, 400);
  // Withdrawing stays open, so a card saved under looser rules can still be taken down.
  if (card && analysisCardAnswersArePrivate(config)) return send({ error: 'analysis_card_answers_private' }, 403);
  if (card) {
    const refused = await preflight.count?.();
    if (refused) return refused;
  } else {
    let stored;
    try {
      stored = parseJson(await kv.get(keyOf(owner)));
    } catch {
      return send({ error: 'card_store_unavailable' }, 503);
    }
    if (stored?.published === false) return send({ published: false }, 200);
  }
  const now = Number(deps?.now?.() ?? Date.now());
  const value = card ? { published: true, card, savedAt: now } : { published: false, withdrawnAt: now };
  try {
    await kv.put(keyOf(owner), JSON.stringify(value), { expirationTtl: SAVED_TTL_SECONDS });
  } catch {
    return send({ error: 'card_store_unavailable' }, 503);
  }
  return send(card ? { published: true, card, savedAt: now } : { published: false }, 200);
};
