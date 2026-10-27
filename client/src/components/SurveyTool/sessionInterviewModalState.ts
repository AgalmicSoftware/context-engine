import { DEFAULT_AI_MODEL } from '../../../../shared/aiDefaults.mjs';
import type { InterviewPrefillPacket, InterviewResearchCoverage } from './sessionInterview';

export type SessionInterviewModalRecord = Record<string, unknown>;

const asRecord = (value: unknown): SessionInterviewModalRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as SessionInterviewModalRecord) : {};

export const responseFieldValue = (
  slice: SessionInterviewModalRecord | null | undefined,
  field: string,
  questionId: string,
): unknown => asRecord(asRecord(asRecord(slice)[field])[questionId]).value;

// A masked ("*") comment is locked: review neither shows it as text nor sends it back.
export const responseCommentValue = (slice: SessionInterviewModalRecord | null | undefined, questionId: string) => {
  const value = responseFieldValue(slice, 'additionalComments', questionId);
  return value === '*' ? '' : String(value ?? '');
};

export const hasDraftValue = (value: unknown): boolean =>
  value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length > 0);

export const displayResponderContext = (packet: InterviewPrefillPacket | null): string => {
  if (!packet) return '';
  const summary = String(packet.responderContext?.summary || '').trim();
  if (summary) return summary;
  return (packet.responderContext?.facts || [])
    .map((entry) => String(entry?.fact || '').trim())
    .filter(Boolean)
    .join('\n');
};

export const describeResearchCoverage = (coverage: InterviewResearchCoverage | undefined): string[] => {
  if (!coverage) return [];
  const describeResource = (label: string, searched: number | null, used: number | null): string => {
    if (searched === null && used === null) return '';
    if (searched !== null) return `${label}: ${used === null ? 'unknown' : used} used / ${searched} searched`;
    return `${label}: ${used} used`;
  };
  return [
    describeResource('History chats', coverage.historyChatsSearched, coverage.historyChatsUsed),
    describeResource('Memories', coverage.memoryItemsSearched, coverage.memoryItemsUsed),
    describeResource('Connected sources', coverage.connectedSourcesSearched, coverage.connectedSourcesUsed),
    coverage.userStatementsUsed !== null ? `${coverage.userStatementsUsed} user statements used` : '',
  ].filter(Boolean);
};

export const shouldIgnorePromptCopyEvent = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return true;
  if (target.closest('button, a, input, textarea, select, [contenteditable="true"]')) return true;
  if (target.closest('[data-ce-no-background-copy="true"]')) return true;
  const selection = target.ownerDocument.defaultView?.getSelection?.();
  return Boolean(selection?.toString().trim());
};

export const buildResearchPacket = (
  prefillPacket: InterviewPrefillPacket | null,
  sessionSlug: string,
  modelId: string = DEFAULT_AI_MODEL,
): InterviewPrefillPacket =>
  prefillPacket || {
    version: 1,
    sessionSlug,
    source: { platform: 'other', modelId, verification: 'self_reported' },
    responderContext: {},
  };
