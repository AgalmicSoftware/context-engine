import { normalizeInterviewSettings } from '../../../../shared/interviewSettings.mjs';
import { getCorsProxyUrlOrThrow } from '../../utilities/worker/corsProxy';
import { fetchWorkerWithAuth } from '../../utilities/worker/workerAuth';
import { isTextInterviewQuestion } from './sessionInterviewResearch';

// The AI's drafted text, kept apart from responses where only the session's config admins
// can read it (Session Workers from 0.9.6). A response row holds only the consent.
type UnknownRecord = Record<string, unknown>;
const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
// Saved answers are keyed by lowercased question id, drafts by the id as written.
const byQuestion = (records: Record<string, unknown>) => {
  const found = new Map(Object.entries(records).map(([id, value]) => [id.toLowerCase(), value]));
  return (questionId: string) => asRecord(records[questionId] ?? found.get(questionId.toLowerCase()));
};

export type DraftTextItem = {
  questionId: string;
  aiAnswer?: string;
  aiComment?: string;
  origin?: string;
  condition?: 'shown' | 'blind';
};
export type DraftTextPlan = { put: DraftTextItem[]; remove: string[] };

/**
 * What one submit keeps and removes, from the responses it uploaded. Text is kept only for a
 * response saved with draft-text consent whose answer and comment are both unencrypted, from
 * this browser's draft (a reloaded saved record has no text, so its stored row stays). Every
 * other uploaded question is removed while the session keeps text, or when its earlier saved
 * consent kept some, so a withdrawal or an encrypted answer deletes what was stored.
 */
export const planDraftTextSync = ({
  sessionConfig,
  uploaded,
  drafts,
  earlier,
}: {
  sessionConfig: unknown;
  uploaded: unknown[];
  drafts: Record<string, unknown>;
  earlier: Record<string, unknown>;
}): DraftTextPlan => {
  const keeps = normalizeInterviewSettings(asRecord(sessionConfig).interviewMode).keepDraftTextForAdmins;
  const draftFor = byQuestion(drafts);
  const earlierFor = byQuestion(earlier);
  const plan: DraftTextPlan = { put: [], remove: [] };
  for (const value of uploaded) {
    const response = asRecord(value);
    const questionId = String(response.questionID || response.questionId || '').trim();
    if (!questionId) continue;
    const provenance = asRecord(response.interviewProvenance);
    const encrypted =
      asRecord(response.answer).encrypted === true ||
      asRecord(response.additional).encrypted === true ||
      (Array.isArray(provenance.redactedFields) && provenance.redactedFields.length > 0);
    if (provenance.draftTextConsent === true && !encrypted) {
      // Only an older saved record keeps its consent with the setting off; the Worker takes no new text.
      if (!keeps) continue;
      const original = asRecord(draftFor(questionId).originalPrediction);
      const aiAnswer = isTextInterviewQuestion(response) ? text(original.answer) : '';
      const aiComment = text(original.additionalComments);
      if (!aiAnswer && !aiComment) continue;
      const origin = text(provenance.draftOrigin);
      const condition = provenance.predictionCondition;
      plan.put.push({
        questionId,
        ...(aiAnswer ? { aiAnswer } : {}),
        ...(aiComment ? { aiComment } : {}),
        ...(origin ? { origin } : {}),
        ...(condition === 'shown' || condition === 'blind' ? { condition } : {}),
      });
    } else if (keeps || earlierFor(questionId).draftTextConsent === true) {
      plan.remove.push(questionId);
    }
  }
  return plan;
};

// account is the signed-in address, which the Worker keys rows by: requests go only while it is the
// one signed in, so a switch of account mid-sync fails rather than send under another sign-in.
// prompt: false sends only if that sign-in is already done.
type WorkerContext = { sessionConfig: UnknownRecord | null; sessionSlug: string; account?: string; prompt?: boolean };

const post = async (action: 'put' | 'delete' | 'export', body: unknown, context: WorkerContext) => {
  const { sessionConfig, sessionSlug, account, prompt } = context;
  if (!sessionConfig) throw new Error('Verified session context is required for AI draft text.');
  // The Worker target comes from the verified session, as for response field keys.
  const workerUrl = await getCorsProxyUrlOrThrow({ sessionConfig, sessionSlug, allowDemoFallback: false });
  const response = await fetchWorkerWithAuth(
    `${String(workerUrl).replace(/\/+$/, '')}/storage/draft-text/${action}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    {
      sessionConfig,
      sessionSlug,
      workerUrl,
      allowDemoFallback: false,
      ...(account ? { requireAccount: account } : {}),
      ...(prompt === false ? { prompt } : {}),
    },
  );
  const result = asRecord(await response.json().catch(() => ({})));
  if (!response.ok) throw new Error(String(result.error || 'The AI draft text request failed.'));
  return result;
};

const batches = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));

// Deletes that failed, kept in this browser per session and address and sent again by the next sync,
// so a withdrawn consent is not lost to one busy moment. Deleting twice is harmless.
const pendingDeletesKey = ({ sessionSlug, account }: WorkerContext) =>
  account ? `ce:draft-text-pending-deletes:v1:${sessionSlug}|${account.toLowerCase()}` : '';
const readPendingDeletes = (key: string): string[] => {
  try {
    const stored: unknown = JSON.parse((key && localStorage.getItem(key)) || '[]');
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string' && !!id) : [];
  } catch {
    return [];
  }
};
const writePendingDeletes = (key: string, questionIds: string[]) => {
  if (!key) return;
  try {
    if (questionIds.length) localStorage.setItem(key, JSON.stringify(questionIds));
    else localStorage.removeItem(key);
  } catch {
    // Storage full or blocked: the submit still reports the failure.
  }
};

// One sync at a time per session and address, so a resend never clears a delete a submit kept meanwhile,
// nor deletes text a later submit stored again.
const syncs = new Map<string, Promise<void>>();

/**
 * Removes first, so a failure part way never leaves text whose consent was withdrawn, and a failed
 * removal is kept to send again. Batches stay within the Worker's limits: 200 items a request, and puts
 * well under its 2 MiB body cap at 16,000 characters each.
 */
export const syncDraftText = (plan: DraftTextPlan, context: WorkerContext): Promise<void> => {
  const key = pendingDeletesKey(context);
  const run = async () => {
    const remove = Array.from(new Set([...readPendingDeletes(key), ...plan.remove]));
    try {
      for (const questionIds of batches(remove, 200)) await post('delete', { questionIds }, context);
    } catch (error) {
      writePendingDeletes(key, Array.from(new Set([...readPendingDeletes(key), ...remove])));
      throw error;
    }
    writePendingDeletes(
      key,
      readPendingDeletes(key).filter((id) => !remove.includes(id)),
    );
    for (const items of batches(plan.put, 25)) await post('put', { items }, context);
  };
  if (!key) return run();
  const next = (syncs.get(key) || Promise.resolve()).catch(() => undefined).then(run);
  const settled = next.catch(() => undefined);
  syncs.set(key, settled);
  void settled.then(() => {
    if (syncs.get(key) === settled) syncs.delete(key);
  });
  return next;
};

/** On page load: sends any deletes kept from an earlier failure, without asking anyone to sign in. */
export const resendPendingDraftTextDeletes = async (context: WorkerContext): Promise<void> => {
  if (readPendingDeletes(pendingDeletesKey(context)).length) {
    await syncDraftText({ put: [], remove: [] }, { ...context, prompt: false });
  }
};

/** Every page of the admin export, as one file; the Worker answers only config admins. */
export const exportDraftText = async (context: WorkerContext): Promise<UnknownRecord> => {
  const rows: unknown[] = [];
  let first: UnknownRecord | null = null;
  let cursor = '';
  do {
    const page = await post('export', cursor ? { cursor } : {}, context);
    if (page.type !== 'ce_draft_text_export' || page.version !== 1 || !Array.isArray(page.rows)) {
      throw new Error('The Worker sent an unexpected AI draft text export.');
    }
    first ||= page;
    rows.push(...page.rows);
    cursor = typeof page.cursor === 'string' ? page.cursor : '';
  } while (cursor);
  return {
    type: 'ce_draft_text_export',
    version: 1,
    sessionSlug: first?.sessionSlug,
    exportedAt: first?.exportedAt,
    rows,
  };
};
