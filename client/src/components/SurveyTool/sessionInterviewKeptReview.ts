/**
 * @file sessionInterviewKeptReview.ts: an interview's draft review, kept in this browser until it is submitted
 * or discarded, so a reload, Back, or reopening the tab brings it back. It is stored only on this device, for
 * one session and one owner: the signed-in account, or this browser when signed out. Nothing is sent anywhere.
 * Another browser, such as Safari after a chat app's own browser, has its own storage and starts empty.
 */
import { useEffect, useRef } from 'react';
import {
  normalizeInterviewPrefillPacket,
  type InterviewDraftResponse,
  type InterviewPrefillPacket,
} from './sessionInterview';
import type { HiddenInterviewDraft } from './sessionInterviewHiddenDrafts';
import type { GeneratedSurveyStatement } from './SurveyGenerator/surveyGeneratorHelpers';

const KEY_PREFIX = 'ce:interview-review:v1:';
/** A kept review goes after a day, like a held group-conversation part. */
export const KEPT_REVIEW_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SAVE_DELAY_MS = 300;

/** What a review needs to carry on where it was. */
export type KeptInterviewReview = {
  packet: InterviewPrefillPacket | null;
  transcript: string;
  mappedTranscript: string;
  responderContext: string;
  drafts: InterviewDraftResponse[];
  selected: Record<string, boolean>;
  removedDraftIds: Record<string, boolean>;
  editedDrafts: Record<string, InterviewDraftResponse>;
  leftOutIds: string[];
  stillFitIds: string[];
  prefillDraftIds: string[];
  suggestedQuestions: GeneratedSurveyStatement[];
  ownEvidenceIds: string[];
  hidden: Record<string, HiddenInterviewDraft>;
};

/** Whose review this is: the signed-in account, or this browser alone when signed out. */
export const keptReviewOwner = (account: unknown, signedIn: boolean): string => {
  const address = String(account || '')
    .trim()
    .toLowerCase();
  return signedIn && address ? `account:${address}` : 'browser';
};

const keyFor = (sessionSlug: string, owner: string) => `${KEY_PREFIX}${sessionSlug.trim().toLowerCase()}:${owner}`;

const storage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const text = (value: unknown) => (typeof value === 'string' ? value : '');
const records = <T>(value: unknown): Record<string, T> => (isRecord(value) ? (value as Record<string, T>) : {});

// Drops this browser's kept reviews that have run out, whoever they belong to.
const dropExpired = (store: Storage, now: number) => {
  for (let index = store.length - 1; index >= 0; index -= 1) {
    const key = store.key(index);
    if (!key?.startsWith(KEY_PREFIX)) continue;
    try {
      const age = now - Number(JSON.parse(store.getItem(key) || 'null')?.savedAt);
      if (!(age >= 0 && age < KEPT_REVIEW_MAX_AGE_MS)) store.removeItem(key);
    } catch {
      store.removeItem(key);
    }
  }
};

/** This owner's kept review for this session, if there is one that hasn't run out. */
export const readKeptReview = (sessionSlug: string, owner: string, now = Date.now()): KeptInterviewReview | null => {
  const store = storage();
  if (!store || !sessionSlug.trim()) return null;
  try {
    dropExpired(store, now);
    const kept = JSON.parse(store.getItem(keyFor(sessionSlug, owner)) || 'null');
    if (!isRecord(kept) || kept.v !== 1 || kept.owner !== owner) return null;
    const review = isRecord(kept.review) ? kept.review : {};
    const drafts = Array.isArray(review.drafts)
      ? (review.drafts.filter(
          (draft) => isRecord(draft) && typeof draft.questionId === 'string',
        ) as InterviewDraftResponse[])
      : [];
    const transcript = text(review.transcript);
    if (!drafts.length && !transcript.trim()) return null;
    return {
      packet: review.packet ? normalizeInterviewPrefillPacket(review.packet) : null,
      transcript,
      mappedTranscript: text(review.mappedTranscript),
      responderContext: text(review.responderContext),
      drafts,
      selected: records(review.selected),
      removedDraftIds: records(review.removedDraftIds),
      editedDrafts: records(review.editedDrafts),
      leftOutIds: strings(review.leftOutIds),
      stillFitIds: strings(review.stillFitIds),
      prefillDraftIds: strings(review.prefillDraftIds),
      suggestedQuestions: Array.isArray(review.suggestedQuestions) ? review.suggestedQuestions : [],
      ownEvidenceIds: strings(review.ownEvidenceIds),
      hidden: records(review.hidden),
    };
  } catch {
    return null;
  }
};

export const writeKeptReview = (sessionSlug: string, owner: string, review: KeptInterviewReview, now = Date.now()) => {
  try {
    storage()?.setItem(keyFor(sessionSlug, owner), JSON.stringify({ v: 1, owner, savedAt: now, review }));
  } catch {
    /* Full or disabled storage: the review lives only on this page, as before. */
  }
};

export const clearKeptReview = (sessionSlug: string, owner: string) => {
  try {
    storage()?.removeItem(keyFor(sessionSlug, owner));
  } catch {
    /* Storage can be disabled. */
  }
};

/**
 * Keeps `review` for its owner while there is one, a moment after it changes and as the page goes. Once it has
 * kept one, `null` (submitted, or nothing left) clears it. Signing in mid-review moves it from this browser to
 * the account; signing out or into another account stops keeping it, so nobody else is shown it.
 */
export const useKeepInterviewReview = ({
  sessionSlug,
  owner,
  review,
  restoredFor,
}: {
  sessionSlug: string;
  owner: string;
  review: KeptInterviewReview | null;
  /** The owner a restored review came from, so a review that was kept is cleared too. */
  restoredFor?: string;
}) => {
  const keptFor = useRef(restoredFor || '');
  // What was last kept, so a render that changed nothing writes nothing.
  const keptJson = useRef('');
  const json = review ? JSON.stringify(review) : '';
  // Reassigned each render, so the timer and the page leaving both write the latest review.
  const write = useRef(() => {});
  write.current = () => {
    if (!sessionSlug) return;
    if (!review) {
      if (keptFor.current) clearKeptReview(sessionSlug, keptFor.current);
      keptFor.current = '';
      keptJson.current = '';
      return;
    }
    if (keptFor.current && keptFor.current !== owner) {
      if (keptFor.current !== 'browser' || owner === 'browser') return;
      clearKeptReview(sessionSlug, keptFor.current);
    } else if (keptFor.current === owner && keptJson.current === json) return;
    keptFor.current = owner;
    keptJson.current = json;
    writeKeptReview(sessionSlug, owner, review);
  };
  useEffect(() => {
    const timer = setTimeout(() => write.current(), json ? SAVE_DELAY_MS : 0);
    return () => clearTimeout(timer);
  }, [json, owner, sessionSlug]);
  useEffect(() => {
    const flush = () => write.current();
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);
};
