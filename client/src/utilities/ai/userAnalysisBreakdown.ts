// The four short lines the analysis gives beside its text, shown as panels in the analysis box.

export type UserAnalysisBreakdown = {
  /** The position held most strongly. */
  holds: string;
  /** Something the person is open to, or accepts with conditions. */
  openTo: string;
  /** What the person is least sure about. */
  unsure: string;
  /** One whole sentence the person wrote, in their words as they wrote them. */
  ownWords: string;
};

const LINE_LENGTH = 160;
const QUOTE_LENGTH = 240;
const QUOTE_SHORTEST = 12;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const oneLine = (value: unknown, longest = Infinity): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, longest) : '';

// For telling whether two sentences are the same one: case, spacing, the kind of quote mark and the closing
// punctuation do not count; every word does.
const fold = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[“”"‘’'`]/g, "'")
    .replace(/^'+|'+$/g, '')
    .replace(/[.!?…\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// What the person wrote themselves, out of everything the analysis is sent: free-text answers and the comments
// added to any answer. Questions, option names, titles, group names and the address are other people's words.
const ownWritings = (userData: unknown): string[] => {
  const found: string[] = [];
  const take = (item: unknown): void => {
    const answered = asRecord(item);
    if (answered.type === 'freeform' && typeof answered.answer === 'string') found.push(answered.answer);
    if (typeof answered.additionalComment === 'string') found.push(answered.additionalComment);
  };
  const data = asRecord(userData);
  asList(data.questions).forEach(take);
  asList(data.surveys).forEach((survey) => {
    const answeredSurvey = asRecord(survey);
    asList(answeredSurvey.sample).forEach(take);
    asList(answeredSurvey.additionalCommentsSample).forEach((comment) => {
      if (typeof comment === 'string') found.push(comment);
    });
  });
  return found;
};

// The person's own sentence that the model's quote names, as they wrote it, or '' where there is none. Only a
// whole sentence counts (or a whole answer): a clause cut out of one can say the opposite of what was meant.
const ownSentence = (quote: string, userData: unknown): string => {
  const wanted = fold(quote);
  if (wanted.length < QUOTE_SHORTEST) return '';
  for (const writing of ownWritings(userData)) {
    const whole = oneLine(writing);
    for (const sentence of [whole, ...(writing.match(/[^.!?…\n]+[.!?…]*/g) || []).map((part) => oneLine(part))]) {
      if (sentence.length <= QUOTE_LENGTH && fold(sentence) === wanted) return sentence;
    }
  }
  return '';
};

/**
 * The breakdown as the page keeps it, or null where the reply had none. With `userData` (a fresh reply) the
 * quote is replaced by the person's own sentence it names, and dropped where they wrote no such sentence: a
 * model that paraphrases, or quotes the question, would otherwise put words in their mouth. Without it (a
 * breakdown kept with an earlier analysis) the quote is the sentence found when it was made.
 */
export const normalizeUserAnalysisBreakdown = (raw: unknown, userData?: unknown): UserAnalysisBreakdown | null => {
  const record = asRecord(raw);
  const quote = oneLine(record.ownWords, QUOTE_LENGTH);
  const breakdown = {
    holds: oneLine(record.holds, LINE_LENGTH),
    openTo: oneLine(record.openTo, LINE_LENGTH),
    unsure: oneLine(record.unsure, LINE_LENGTH),
    ownWords: userData === undefined ? quote : ownSentence(quote, userData),
  };
  return Object.values(breakdown).some(Boolean) ? breakdown : null;
};
