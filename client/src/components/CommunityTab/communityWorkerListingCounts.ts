/** @file communityWorkerListingCounts.ts: a Worker-hosted session's Stats counts, taken from its listings alone. */
import { listSessionStorageRefsPage } from '../../utilities/storage/storageClient';

/**
 * The Stats tiles count a session the panel's dropdown names, which need not be the one the app has loaded. A
 * session's Worker lists every stored question, survey and answer with its id (and an answer's responder) without
 * sending the records themselves, so three listings, read side by side, give the counts for any session.
 */
/** Each count stands on its own listing: null where that listing was refused, failed, or cannot be complete. */
export type WorkerListingCounts = {
  /** Questions as the session shows them: one per question however many versions are stored, hidden ones left out. */
  questions: number | null;
  surveys: number | null;
  /** Lowercased addresses of everyone with at least one stored answer. */
  responders: string[] | null;
};

type ListedItem = Record<string, unknown>;
type ListPageOptions = NonNullable<Parameters<typeof listSessionStorageRefsPage>[0]>;
type ListPage = (options: ListPageOptions) => Promise<{ items?: unknown; cursor?: unknown; listComplete?: unknown }>;

export type WorkerListingCountsInput = {
  sessionSlug: string;
  sessionConfig: unknown;
  /**
   * Whether this viewer's answers listing holds everyone's answers (the session lets its readers see all of them).
   * Where that is not known, or people see only their own, a signed-in person may be listed just their own rows,
   * which is not a count of the session's people. Answers are then read only as anyone at all would be given
   * them: a session that shows its answers to everyone still counts, and any other gives no number.
   */
  everyAnswerListed: boolean;
  account?: string;
  providerLike?: unknown;
  /** Questions the session's Settings hide (see settingsHiddenQuestionIds); left out of the count as on its page. */
  hiddenQuestionIds?: readonly string[];
};

// Answers come 500 to a page where the Worker allows it; an older Worker simply returns fewer per page.
const PAGE_SIZE = { questions: 100, surveys: 100, responses: 500 } as const;
const MAX_PAGES = 80;

const asRecord = (value: unknown): ListedItem =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as ListedItem) : {};
const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const listAll = async (
  resource: keyof typeof PAGE_SIZE,
  input: WorkerListingCountsInput,
  listPage: ListPage,
  { anonymousOnly = false }: { anonymousOnly?: boolean } = {},
): Promise<ListedItem[]> => {
  const items: ListedItem[] = [];
  const seen = new Set<string>();
  let cursor = '';
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const reply = await listPage({
      sessionSlug: input.sessionSlug,
      sessionConfig: input.sessionConfig,
      context: { account: input.account, providerLike: input.providerLike },
      resource,
      cursor: cursor || null,
      limit: PAGE_SIZE[resource],
      // Read as anyone would where the session allows it; a sign-in already held is used, none is asked for.
      preferAnonymous: true,
      prompt: false,
      ...(anonymousOnly ? { anonymousOnly: true } : {}),
    });
    for (const item of Array.isArray(reply.items) ? reply.items : []) items.push(asRecord(item));
    if (reply.listComplete) return items;
    const next = text(reply.cursor);
    // A listing that neither ends nor moves on is not a count.
    if (!next || seen.has(next)) throw new Error('listing_did_not_finish');
    seen.add(next);
    cursor = next;
  }
  throw new Error('listing_too_long');
};

/**
 * A session's "Hidden questions" list in its Settings, lowercased as the session page reads it. It is in the
 * Worker's own config, which the app holds once the session has been opened in this browser; before that the list
 * is not known here and only an admin's hide, which the listing itself marks, is left out.
 */
export const settingsHiddenQuestionIds = (sessionConfig: unknown): string[] => {
  const listed = asRecord(sessionConfig).BLOCKED_QUESTION_IDS;
  return Array.isArray(listed) ? [...new Set(listed.map((id) => text(id).toLowerCase()).filter(Boolean))].sort() : [];
};

/**
 * Distinct ids among what is listed and not hidden, by the listing's own mark or by `alsoHidden`. A stored version
 * without an id counts by its own record.
 */
export const countShown = (items: ListedItem[], alsoHidden: readonly string[] = []): number => {
  const shown = new Set<string>();
  const hidden = new Set<string>(alsoHidden);
  for (const item of items) {
    const metadata = asRecord(item.metadata);
    const id = text(metadata.resourceId).toLowerCase();
    if (item.hidden === true || metadata.hidden === true) {
      if (id) hidden.add(id);
      continue;
    }
    shown.add(id || `record:${text(asRecord(item.storageRef).id) || shown.size}`);
  }
  hidden.forEach((id) => shown.delete(id));
  return shown.size;
};

export const listedResponders = (items: ListedItem[]): string[] => {
  const responders = new Set<string>();
  for (const item of items) {
    const metadata = asRecord(item.metadata);
    if (item.hidden === true || metadata.hidden === true) continue;
    const responder = text(metadata.responder).toLowerCase();
    if (/^0x[0-9a-f]{40}$/.test(responder)) responders.add(responder);
  }
  return [...responders].sort();
};

/** Whether a session's results setting lets a reader who is let in list every answer, not only their own. */
export const listsEveryAnswer = (sessionConfig: unknown): boolean => {
  const visibility = text(asRecord(asRecord(asRecord(sessionConfig).sessionModeProfile).results).visibility);
  return visibility === 'public_full_if_storage_public' || visibility === 'session_member_full';
};

/** Rejects only when nothing could be read; otherwise each count is its own listing's, or null. */
export const loadWorkerListingCounts = async (
  input: WorkerListingCountsInput,
  { listPage = listSessionStorageRefsPage }: { listPage?: ListPage } = {},
): Promise<WorkerListingCounts> => {
  const [questions, surveys, responses] = await Promise.allSettled([
    listAll('questions', input, listPage),
    listAll('surveys', input, listPage),
    listAll('responses', input, listPage, { anonymousOnly: !input.everyAnswerListed }),
  ]);
  const read = <T>(result: PromiseSettledResult<ListedItem[]>, count: (items: ListedItem[]) => T): T | null =>
    result.status === 'fulfilled' ? count(result.value) : null;
  const counts = {
    questions: read(questions, (items) => countShown(items, input.hiddenQuestionIds)),
    surveys: read(surveys, countShown),
    responders: read(responses, listedResponders),
  };
  if (counts.questions === null && counts.surveys === null && counts.responders === null) {
    throw new Error('listings_unread');
  }
  return counts;
};
