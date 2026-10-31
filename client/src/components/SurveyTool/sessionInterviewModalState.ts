import { DEFAULT_AI_MODEL } from '../../../../shared/aiDefaults.mjs';
import type { InterviewPrefillPacket, InterviewQuestion, InterviewResearchCoverage } from './sessionInterview';

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

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isWordCharacter = (character = ''): boolean => /[\p{L}\p{M}\p{N}_]/u.test(character);

/** Where a phrase appears as whole words, ignoring case, as [start, end) spans. */
const findWholePhrase = (text: string, phrase: string): Array<[number, number]> => {
  const spans: Array<[number, number]> = [];
  const pattern = new RegExp(escapeRegExp(phrase), 'giu');
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    const start = match.index;
    const end = start + match[0].length;
    // Step one character, so a match rejected below cannot hide a whole-word match inside it.
    pattern.lastIndex = start + 1;
    const wholeStart = !isWordCharacter(text[start]) || !isWordCharacter(text[start - 1]);
    const wholeEnd = !isWordCharacter(text[end - 1]) || !isWordCharacter(text[end]);
    if (wholeStart && wholeEnd) spans.push([start, end]);
  }
  return spans;
};

// Where a fact was cut, drop the punctuation left standing alone and spare spaces.
const tidyCutLine = (line: string): string =>
  line
    .replace(/(^|\s)[.,;:!?]+(?=\s|$)/g, '$1')
    .replace(/[ \t]+/g, ' ')
    .trim();

export const omitConcealedInterviewFacts = (
  context: string,
  packet: InterviewPrefillPacket | null,
  isConcealed: (questionId: string) => boolean,
  questions: Array<Pick<InterviewQuestion, 'id'>>,
): string => {
  const questionIds = new Set(questions.map(({ id }) => id));
  const facts = (packet?.responderContext?.facts || []).map((entry) => {
    // As in the realtime prefill, related questions outside this interview do not count.
    const ids = (entry.relatedQuestionIds || []).filter((id) => questionIds.has(id));
    return { fact: String(entry.fact || '').trim(), concealed: ids.length > 0 && ids.every(isConcealed) };
  });
  // A concealed fact goes wherever it appears as whole words, the summary and edited lines included,
  // except inside a shown fact: those spans stay, so a shown fact with the same words is kept whole.
  const cut = new Uint8Array(context.length);
  for (const { fact, concealed } of facts) {
    if (fact && concealed) for (const [start, end] of findWholePhrase(context, fact)) cut.fill(1, start, end);
  }
  for (const { fact, concealed } of facts) {
    if (fact && !concealed) for (const [start, end] of findWholePhrase(context, fact)) cut.fill(0, start, end);
  }
  // Line breaks stay, so each line can be compared with the original; a cut line left without words goes.
  const originalLines = context.split('\n');
  return context
    .split('')
    .filter((character, index) => !cut[index] || character === '\n')
    .join('')
    .split('\n')
    .map((line, index) => (line === originalLines[index] ? line : tidyCutLine(line)))
    .filter((line, index) => line === originalLines[index] || /[\p{L}\p{N}]/u.test(line))
    .join('\n')
    .trim();
};

/** "ChatGPT", "Claude" or "Other": the platform an AI prefill reports for itself. */
export const describeInterviewPlatform = (platform: InterviewPrefillPacket['source']['platform']): string =>
  ({ chatgpt: 'ChatGPT', claude: 'Claude', other: 'Other' })[platform];

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
