import {
  analysisCardAnswersArePrivate, analysisCardOn, normalizeAnalysisCardDrawing, normalizeSavedAnalysisCard,
} from '../../shared/analysisCardSaved.mjs';
import { buildSessionEndedResponse } from '../shared/sessionLifecycle.mjs';
import { createRequesterAccessChecks } from './storageRouteExecution.js';
import { rateLimitRefusal } from './rateLimitRefusal.js';

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
// A card is made from its owner's answers and quotes up to three of them, so it goes only where those answers go.
// Where the session keeps answers to their author and its admins, none is saved, and one saved before the rules
// were tightened is deleted by the first save or read that meets it while the card is on and the session runs,
// so it does not come back if they are loosened again. (A card no request met in that time is still there, and
// is then given, as always, only to its owner and to someone who may read that person's answers.)
//
// The card as its owner's page drew it travels with the saved card and under the same rule:
// - POST /analysis-card/drawing/save { pages: [{ mime, base64 }] } keeps the caller's own drawn pages (one or
//   two, each a JPEG or PNG of at most 1 MiB) beside the card they have saved. With no saved card it is refused.
// - POST /analysis-card/drawing { account } answers { drawing: { pages, savedAt } } to whoever /published would
//   give that card to, and { drawing: null } to everyone else, as when none was kept.
// The pages are tied to the save they were drawn for: a new save, a withdrawal or tightened rules leave them
// unread, and delete them. Neither route calls a model or counts an AI call.
export const ANALYSIS_CARD_PUBLISH_PATH = '/analysis-card/publish';
export const ANALYSIS_CARD_PUBLISHED_PATH = '/analysis-card/published';
export const ANALYSIS_CARD_DRAWING_SAVE_PATH = '/analysis-card/drawing/save';
export const ANALYSIS_CARD_DRAWING_PATH = '/analysis-card/drawing';
export const ANALYSIS_CARD_SAVED_PATHS = [
  ANALYSIS_CARD_PUBLISH_PATH, ANALYSIS_CARD_PUBLISHED_PATH, ANALYSIS_CARD_DRAWING_SAVE_PATH, ANALYSIS_CARD_DRAWING_PATH,
];

// Saves one person may make in a day. Withdrawing is never counted, so nobody is kept from taking their card down;
// it writes only when there is something to take down, so the writes a person can cause stay bounded by their saves.
export const ANALYSIS_CARD_SAVES_PER_DAY = 20;
// Cards and markers sit beside the session's config in GROUP_KV, which no backup reads; each lasts a year from
// its last save.
const KEY_PREFIX = 'analysis-card-saved:v1:';
// Its own key, so a Worker from before the drawing never reads it and a card's read never loads the pages.
const DRAWING_KEY_PREFIX = 'analysis-card-drawing:v1:';
const SAVED_TTL_SECONDS = 365 * 24 * 60 * 60;
// Drawn pages one person may store in a day: one upload for each save they may make.
export const ANALYSIS_CARD_DRAWINGS_PER_DAY = ANALYSIS_CARD_SAVES_PER_DAY;
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
  const drawingKeyOf = (account) => `session:${slug}:${DRAWING_KEY_PREFIX}${account}`;
  const answersPrivate = analysisCardAnswersArePrivate(config);
  // The drawn pages go whenever the card they were drawn for does. A failed delete shows nothing: the pages are
  // only ever read beside the save they name.
  const forgetDrawing = async (account) => {
    try {
      await kv.delete?.(drawingKeyOf(account));
    } catch {
      // Left unread until its year runs out.
    }
  };
  // Deletes a stored card's words. A withdrawal's marker holds none and keeps the person's "no", so it stays.
  const forget = async (account, stored) => {
    await forgetDrawing(account);
    if (stored?.published !== true) return;
    try {
      await kv.delete?.(keyOf(account));
    } catch {
      // The card is still not given to anyone: every answer below is made without it.
    }
  };
  // The one rule for who is given a saved card, its words or its drawn pages: `{ published: true, card, savedAt }`,
  // `{ published: false }` (withdrawn), `{ published: null }` (none for this reader) or `{ unavailable: true }`.
  const readSavedFor = async (account) => {
    let stored;
    try {
      stored = parseJson(await kv.get(keyOf(account)));
    } catch {
      return { unavailable: true };
    }
    if (stored?.published === false) return { published: false };
    const card = stored?.published === true ? normalizeSavedAnalysisCard(stored.card) : null;
    const savedAt = Number(stored?.savedAt);
    if (answersPrivate) {
      await forget(account, stored);
      return { published: null };
    }
    if (!card || !Number.isFinite(savedAt)) return { published: null };
    // To anyone but its owner the card reads as not saved unless they may read the owner's answers, as a read of
    // one of those answers would decide. A check that cannot be made counts as no.
    if (account !== accountOf(address)) {
      const checks = (deps?.createRequesterAccessChecks || createRequesterAccessChecks)({
        env, config, slug, requesterAddress: address, authScopes: scopes, deps,
      });
      const mayRead = await checks.canRead({ resource: 'responses', responder: account }).catch(() => false);
      if (!mayRead) return { published: null };
    }
    return { published: true, card, savedAt };
  };

  if (path === ANALYSIS_CARD_PUBLISHED_PATH) {
    const account = accountOf(body?.account);
    if (!ACCOUNT_RE.test(account)) return send({ error: 'invalid_account' }, 400);
    const saved = await readSavedFor(account);
    return saved.unavailable ? send({ error: 'card_store_unavailable' }, 503) : send(saved, 200);
  }

  if (path === ANALYSIS_CARD_DRAWING_PATH) {
    const account = accountOf(body?.account);
    if (!ACCOUNT_RE.test(account)) return send({ error: 'invalid_account' }, 400);
    // First whether this reader is given the card at all; only then are its pages read.
    const saved = await readSavedFor(account);
    if (saved.unavailable) return send({ error: 'card_store_unavailable' }, 503);
    if (saved.published !== true) return send({ drawing: null }, 200);
    let kept;
    try {
      kept = parseJson(await kv.get(drawingKeyOf(account)));
    } catch {
      return send({ error: 'card_store_unavailable' }, 503);
    }
    const pages = Number(kept?.cardSavedAt) === saved.savedAt ? normalizeAnalysisCardDrawing(kept?.pages) : null;
    return send({ drawing: pages ? { pages, savedAt: saved.savedAt } : null }, 200);
  }

  if (path === ANALYSIS_CARD_DRAWING_SAVE_PATH) {
    const owner = accountOf(address);
    if (!ACCOUNT_RE.test(owner)) return send({ error: 'invalid_account' }, 400);
    if (body?.account !== undefined && accountOf(body.account) !== owner) {
      return send({ error: 'analysis_card_own_only' }, 403);
    }
    const pages = normalizeAnalysisCardDrawing(body?.pages);
    if (!pages) return send({ error: 'invalid_drawing' }, 400);
    // Only beside the caller's own saved card, under the rules as they are now.
    const saved = await readSavedFor(owner);
    if (saved.unavailable) return send({ error: 'card_store_unavailable' }, 503);
    if (saved.published !== true) return send({ error: 'analysis_card_not_saved' }, 409);
    const allowed = await deps?.checkRateLimit?.({
      env, slug, address: owner, route: 'analysis-card-drawing', limit: ANALYSIS_CARD_DRAWINGS_PER_DAY,
    });
    if (!allowed) return rateLimitRefusal(allowed, deps?.json, noStore);
    try {
      await kv.put(
        drawingKeyOf(owner),
        JSON.stringify({ cardSavedAt: saved.savedAt, pages }),
        { expirationTtl: SAVED_TTL_SECONDS },
      );
    } catch {
      return send({ error: 'card_store_unavailable' }, 503);
    }
    return send({ saved: true, pages: pages.length, savedAt: saved.savedAt }, 200);
  }

  // The card is the caller's own: it is filed under the signed-in address, and a request that names anyone else
  // is refused, to save or to withdraw.
  const owner = accountOf(address);
  if (!ACCOUNT_RE.test(owner)) return send({ error: 'invalid_account' }, 400);
  if (body?.account !== undefined && accountOf(body.account) !== owner) {
    return send({ error: 'analysis_card_own_only' }, 403);
  }
  if (typeof body?.published !== 'boolean') return send({ error: 'invalid_request' }, 400);
  const card = body.published ? normalizeSavedAnalysisCard(body.card) : null;
  if (body.published && !card) return send({ error: 'invalid_card' }, 400);
  // Withdrawing stays open. A card stored under looser rules goes with the refusal.
  if (card && answersPrivate) {
    try {
      await forget(owner, parseJson(await kv.get(keyOf(owner))));
    } catch {
      // Unreadable now: the next request that meets the card deletes it.
    }
    return send({ error: 'analysis_card_answers_private' }, 403);
  }
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
  // Pages drawn for an earlier save are for a card that is gone.
  await forgetDrawing(owner);
  return send(card ? { published: true, card, savedAt: now } : { published: false }, 200);
};
