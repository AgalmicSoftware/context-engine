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
      // With the setting off the Worker takes no new text; what is stored stays until withdrawn.
      if (!keeps) continue;
      const original = asRecord(asRecord(drafts[questionId]).originalPrediction);
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
    } else if (keeps || asRecord(earlier[questionId]).draftTextConsent === true) {
      plan.remove.push(questionId);
    }
  }
  return plan;
};

type WorkerContext = { sessionConfig: UnknownRecord | null; sessionSlug: string };

const post = async (action: 'put' | 'delete' | 'export', body: unknown, context: WorkerContext) => {
  const { sessionConfig, sessionSlug } = context;
  if (!sessionConfig) throw new Error('Verified session context is required for AI draft text.');
  // The Worker target comes from the verified session, as for response field keys.
  const workerUrl = await getCorsProxyUrlOrThrow({ sessionConfig, sessionSlug, allowDemoFallback: false });
  const response = await fetchWorkerWithAuth(
    `${String(workerUrl).replace(/\/+$/, '')}/storage/draft-text/${action}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    { sessionConfig, sessionSlug, workerUrl, allowDemoFallback: false },
  );
  const result = asRecord(await response.json().catch(() => ({})));
  if (!response.ok) throw new Error(String(result.error || 'The AI draft text request failed.'));
  return result;
};

/** Removes first, so a failure part way never leaves text whose consent was withdrawn. */
export const syncDraftText = async (plan: DraftTextPlan, context: WorkerContext): Promise<void> => {
  if (plan.remove.length) await post('delete', { questionIds: plan.remove }, context);
  if (plan.put.length) await post('put', { items: plan.put }, context);
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
  return { type: 'ce_draft_text_export', version: 1, sessionSlug: first?.sessionSlug, exportedAt: first?.exportedAt, rows };
};
