/**
 * @file sessionInterviewKeptReview.ts: an interview's draft review, kept in this browser until it is submitted
 * or discarded, so a reload, Back, or reopening the tab brings it back. It is stored only on this device, for
 * one session and one owner: the signed-in account, or this browser when signed out. Nothing is sent anywhere.
 * Another browser, such as Safari after a chat app's own browser, has its own storage and starts empty.
 */
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  normalizeInterviewPrefillPacket,
  type InterviewDraftResponse,
  type InterviewPrefillPacket,
} from './sessionInterview';
import type { HiddenInterviewDraft } from './sessionInterviewHiddenDrafts';
import { displayResponderContext } from './sessionInterviewModalState';
import type { GeneratedSurveyStatement } from './SurveyGenerator/surveyGeneratorHelpers';

const KEY_PREFIX = 'ce:interview-review:v1:';
/** A kept review goes a day after it was first kept, like a held group-conversation part. */
export const KEPT_REVIEW_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SAVE_DELAY_MS = 300;

type SharingChoice = { contextToken: string; included: boolean } | null;

/** What a review needs to carry on where it was, its sharing choices included. */
export type KeptInterviewReview = {
  packet: InterviewPrefillPacket | null;
  transcript: string;
  mappedTranscript: string;
  responderContext: string;
  drafts: InterviewDraftResponse[];
  selected: Record<string, boolean>;
  removedDraftIds: Record<string, boolean>;
  editedDrafts: Record<string, InterviewDraftResponse>;
  prefillDraftIds: string[];
  suggestedQuestions: GeneratedSurveyStatement[];
  ownEvidenceIds: string[];
  hidden: Record<string, HiddenInterviewDraft>;
  includeProvenance: boolean;
  researchSharingChoice: SharingChoice;
  includeResponderName: boolean;
  draftText: SharingChoice;
};
/** A kept review, whose it is, and when it was first kept. */
export type RestoredReview = { owner: string; since: number; review: KeptInterviewReview };

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
const choice = (value: unknown): SharingChoice =>
  isRecord(value) && typeof value.contextToken === 'string' && typeof value.included === 'boolean'
    ? { contextToken: value.contextToken, included: value.included }
    : null;

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

const emptyReview = (packet: InterviewPrefillPacket | null): KeptInterviewReview => ({
  packet,
  transcript: '',
  mappedTranscript: '',
  responderContext: displayResponderContext(packet),
  drafts: [],
  selected: {},
  removedDraftIds: {},
  editedDrafts: {},
  prefillDraftIds: [],
  suggestedQuestions: [],
  ownEvidenceIds: [],
  hidden: {},
  includeProvenance: true,
  researchSharingChoice: null,
  includeResponderName: false,
  draftText: null,
});

/** This owner's kept review for this session, if there is one that hasn't run out. */
export const readKeptReview = (sessionSlug: string, owner: string, now = Date.now()): RestoredReview | null => {
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
      owner,
      since: Number(kept.savedAt),
      review: {
        packet: review.packet ? normalizeInterviewPrefillPacket(review.packet) : null,
        transcript,
        mappedTranscript: text(review.mappedTranscript),
        responderContext: text(review.responderContext),
        drafts,
        selected: records(review.selected),
        removedDraftIds: records(review.removedDraftIds),
        editedDrafts: records(review.editedDrafts),
        prefillDraftIds: strings(review.prefillDraftIds),
        suggestedQuestions: Array.isArray(review.suggestedQuestions) ? review.suggestedQuestions : [],
        ownEvidenceIds: strings(review.ownEvidenceIds),
        hidden: records(review.hidden),
        includeProvenance: review.includeProvenance !== false,
        researchSharingChoice: choice(review.researchSharingChoice),
        includeResponderName: review.includeResponderName === true,
        draftText: choice(review.draftText),
      },
    };
  } catch {
    return null;
  }
};

/** Keeps a review; `since` is when it was first kept, which its day counts from. */
export const writeKeptReview = (sessionSlug: string, owner: string, review: KeptInterviewReview, since: number) => {
  try {
    storage()?.setItem(keyFor(sessionSlug, owner), JSON.stringify({ v: 1, owner, savedAt: since, review }));
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
 * Where a review is kept, given by the Interview dialog: the session, who is signed in, what was restored, and
 * `keptFor`, whose key holds the review on screen now, so Discard clears that one.
 */
export type KeptReviewSource = {
  sessionSlug: string;
  owner: string;
  restored: RestoredReview | null;
  keptFor: { current: string };
};
export const KeptInterviewReviewContext = createContext<KeptReviewSource | null>(null);

/** Which drafts a restored review hid, and what it revealed; nothing when it had no drafts to hide. */
export const useRestoredHiddenDrafts = () => {
  const review = useContext(KeptInterviewReviewContext)?.restored?.review;
  return review?.drafts.length ? review.hidden : undefined;
};

type KeptParts = Omit<KeptInterviewReview, 'packet' | 'ownEvidenceIds' | 'hidden'>;

/**
 * A review's starting values, restored or empty, with `ownEvidenceIds` as a live set, and `keep`, given the review on every
 * render or `false` once there is nothing to keep. A changed review is kept a moment later and as the page goes;
 * `false` (submitted, or nothing left) clears it. Signing in mid-review moves it from this browser to the account;
 * signing out or into another account stops keeping it, so nobody else is shown it. A review fed by a group
 * conversation's part is never kept: that part has its own keeping.
 */
export const useKeptInterviewReview = (packet: InterviewPrefillPacket | null, claimed: boolean) => {
  const source = useContext(KeptInterviewReviewContext);
  const [initial] = useState(() => source?.restored?.review ?? emptyReview(packet));
  // Shared with the panel, which adds and removes questions in it as drafts change.
  const [ownEvidenceIds] = useState(() => new Set(initial.ownEvidenceIds));
  const keptFor = useRef(source?.restored?.owner || '');
  const since = useRef(source?.restored?.since || 0);
  // The parts last given, and the review last kept, so a render that changed nothing does no work.
  const given = useRef<{ parts: KeptParts | false; hidden: unknown }>({ parts: false, hidden: null });
  const latest = useRef({ review: null as KeptInterviewReview | null, json: '' });
  const keptJson = useRef('');
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const setKeptFor = (owner: string) => {
    keptFor.current = owner;
    if (sourceRef.current) sourceRef.current.keptFor.current = owner;
  };
  const write = () => {
    const { sessionSlug = '', owner = '' } = sourceRef.current || {};
    const { review, json } = latest.current;
    if (!sessionSlug) return;
    if (!review) {
      if (keptFor.current) clearKeptReview(sessionSlug, keptFor.current);
      setKeptFor('');
      since.current = 0;
      keptJson.current = '';
      return;
    }
    if (keptFor.current && keptFor.current !== owner) {
      if (keptFor.current !== 'browser' || owner === 'browser') return;
      clearKeptReview(sessionSlug, keptFor.current);
    } else if (keptFor.current === owner && keptJson.current === json) return;
    setKeptFor(owner);
    since.current ||= Date.now();
    keptJson.current = json;
    writeKeptReview(sessionSlug, owner, review, since.current);
  };
  const writeRef = useRef(write);
  writeRef.current = write;
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const scheduled = useRef('');
  // After every render: a changed review, or a change of owner, is written a moment later.
  useEffect(() => {
    const next = `${source?.owner}|${latest.current.json}`;
    if (next === scheduled.current) return;
    scheduled.current = next;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => writeRef.current(), latest.current.json ? SAVE_DELAY_MS : 0);
  });
  useEffect(() => {
    if (sourceRef.current) sourceRef.current.keptFor.current = keptFor.current;
    const flush = () => writeRef.current();
    window.addEventListener('pagehide', flush);
    return () => {
      clearTimeout(timer.current);
      window.removeEventListener('pagehide', flush);
    };
  }, []);
  const keep = (parts: KeptParts | false, hidden: KeptInterviewReview['hidden']) => {
    const last = given.current;
    given.current = { parts, hidden };
    const same =
      parts && last.parts && hidden === last.hidden
        ? (Object.keys(parts) as (keyof KeptParts)[]).every(
            (field) => parts[field] === (last.parts as KeptParts)[field],
          )
        : parts === last.parts;
    if (same) return;
    if (!parts || claimed) {
      latest.current = { review: null, json: '' };
      return;
    }
    const review = { ...parts, packet, ownEvidenceIds: [...ownEvidenceIds], hidden };
    latest.current = { review, json: JSON.stringify(review) };
  };
  return { ...initial, ownEvidenceIds, keep };
};
